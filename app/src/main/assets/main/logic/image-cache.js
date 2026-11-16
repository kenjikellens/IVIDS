/**
 * ImageCache - In-memory blob URL cache for TMDb images.
 *
 * Prevents re-downloading identical images when navigating between pages.
 * Stores fetched image data as Object URLs (blob:// references) keyed by
 * their original network URL. Uses LRU eviction to cap memory usage.
 *
 * Lifecycle: lives only for the current session. Blob URLs are revoked
 * on eviction or when destroy() is called.
 */

import { CACHE_CONFIG, NETWORK_CONFIG } from './constants.js';

/** Maximum time in milliseconds to wait for a high-res image before falling back to low-res. */
const HIGH_RES_TIMEOUT_MS = 8000;

/** Maximum time in milliseconds to wait for a downgraded/low-res fallback image. */
const FALLBACK_TIMEOUT_MS = 10000;

/** Maximum time in milliseconds to wait for an image when already in slow-network mode. */
const SLOW_MODE_TIMEOUT_MS = 10000;

/** Maximum single image blob size eligible for RAM caching (2 MB) to avoid evicting dozens of posters. */
const MAX_SINGLE_BLOB_BYTES = 2 * 1024 * 1024;

/**
 * Detects whether the runtime is a low-memory / Android device to apply stricter RAM and concurrency budgets.
 * @returns {boolean} True on Android or low-memory devices.
 */
function isConstrainedDevice() {
    try {
        if (typeof window !== 'undefined' && (window.AndroidSettings || window.AndroidUpdate)) {
            return true;
        }
        if (typeof navigator !== 'undefined') {
            if (/Android/i.test(navigator.userAgent || '')) return true;
            if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2) return true;
        }
    } catch (e) {
        // Ignore environment probe errors
    }
    return false;
}

class ImageCache {
    constructor() {
        const constrained = isConstrainedDevice();
        /** @type {number} Maximum cached items in LRU memory. */
        this.maxItems = constrained ? 50 : 120;
        /** @type {number} Maximum total blob bytes retained in RAM (10 MB Android/TV, 25 MB PC). */
        this.maxBytes = constrained ? (10 * 1024 * 1024) : (25 * 1024 * 1024);
        /** @type {number} Total byte size of all blobs currently held in cache. */
        this.totalBytes = 0;
        /** @type {Map<string, {blobUrl: string, size: number, lastAccess: number}>} */
        this.cache = new Map();
        /** @type {Map<string, Promise<string|null>>} In-flight fetch promises to deduplicate concurrent requests. */
        this.inflight = new Map();
        /** @type {Array<{task: Function, resolve: Function, reject: Function, generation: number}>} Concurrency task queue. */
        this.queue = [];
        /** @type {number} Current active fetch request count. */
        this.activeRequests = 0;
        /** @type {number} Maximum concurrent network blob fetch requests. */
        this.MAX_CONCURRENT = constrained ? 4 : 8;
        /** @type {number} Generation counter to isolate active tasks across cache purges and reloads. */
        this._generation = 0;
        /** @type {boolean} When true, bypasses browser HTTP disk cache via { cache: 'reload' } for one refresh wave. */
        this._bypassActive = false;
        /** @type {Set<string>} Tracks URLs reloaded during the active bypass cycle to prevent infinite cache bypass loops. */
        this._bypassedUrls = new Set();
    }

    /**
     * Checks whether a blob URL is already cached for the given image URL.
     * @param {string} url - The original image network URL.
     * @returns {boolean} True if the image is cached.
     */
    has(url) {
        return this.cache.has(url);
    }

    /**
     * Returns the cached blob URL for a given image URL, or null if not cached.
     * Updates the last-access timestamp for LRU ordering.
     * @param {string} url - The original image network URL.
     * @returns {string|null} The blob URL or null.
     */
    get(url) {
        const entry = this.cache.get(url);
        if (!entry) return null;

        // Refresh LRU position by re-inserting
        this.cache.delete(url);
        entry.lastAccess = Date.now();
        this.cache.set(url, entry);
        return entry.blobUrl;
    }

    /**
     * Stores an image blob within both byte and item LRU budgets.
     * Skips caching oversized blobs (>2 MB) directly into RAM so one large backdrop never evicts dozens of posters.
     * @param {string} url - The original image network URL.
     * @param {Blob} blob - The fetched image blob data.
     * @returns {string|null} The created Object URL, or null when skipped/invalid.
     */
    put(url, blob) {
        if (!blob) return null;
        const blobSize = typeof blob.size === 'number' ? blob.size : 0;

        if (blobSize > MAX_SINGLE_BLOB_BYTES) {
            return url;
        }

        // If already cached, revoke old blob and subtract its bytes before replacing
        if (this.cache.has(url)) {
            const existing = this.cache.get(url);
            if (existing) {
                URL.revokeObjectURL(existing.blobUrl);
                this.totalBytes = Math.max(0, this.totalBytes - (existing.size || 0));
            }
            this.cache.delete(url);
        }

        // Evict oldest LRU entries until within both item count and byte budgets
        while (this.cache.size > 0 && (this.cache.size >= this.maxItems || (this.totalBytes + blobSize) > this.maxBytes)) {
            const oldestKey = this.cache.keys().next().value;
            const oldestEntry = this.cache.get(oldestKey);
            if (oldestEntry) {
                URL.revokeObjectURL(oldestEntry.blobUrl);
                this.totalBytes = Math.max(0, this.totalBytes - (oldestEntry.size || 0));
            }
            this.cache.delete(oldestKey);
        }

        const blobUrl = URL.createObjectURL(blob);
        this.cache.set(url, { blobUrl, size: blobSize, lastAccess: Date.now() });
        this.totalBytes += blobSize;
        return blobUrl;
    }

    /**
     * Returns a cached blob URL or fetches the image, caches it, and returns the blob URL.
     * Deduplicates concurrent fetches for the same URL.
     * @param {string} url - The original image network URL.
     * @returns {Promise<string|null>} The blob URL, or null on fetch failure.
     */
    async getOrFetch(url) {
        if (!url) return null;

        // 1. Check existing cache
        if (this.has(url)) {
            return this.get(url);
        }

        // 2. Deduplicate in-flight requests
        if (this.inflight.has(url)) {
            return this.inflight.get(url);
        }

        // 3. Fetch, cache, and return
        const promise = this._fetchAndCache(url);
        this.inflight.set(url, promise);

        try {
            return await promise;
        } finally {
            this.inflight.delete(url);
        }
    }

    /**
     * Enqueues a blob download task into the concurrency-limited worker queue with generation tagging.
     * @param {Function} task - Async function returning a Blob or null.
     * @returns {Promise<any>}
     */
    _enqueue(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                task,
                resolve,
                reject,
                generation: this._generation
            });
            this._processQueue();
        });
    }

    /**
     * Drains the queue up to MAX_CONCURRENT active requests while discarding stale generation tasks.
     */
    _processQueue() {
        while (this.activeRequests < this.MAX_CONCURRENT && this.queue.length > 0) {
            const item = this.queue.shift();
            if (!item) break;

            if (item.generation !== this._generation) {
                // Task was enqueued prior to a cache reset/purge; resolve with null
                item.resolve(null);
                continue;
            }

            this.activeRequests++;
            const currentGen = item.generation;

            item.task()
                .then(result => item.resolve(result))
                .catch(err => item.reject(err))
                .finally(() => {
                    if (this._generation === currentGen) {
                        this.activeRequests = Math.max(0, this.activeRequests - 1);
                    }
                    this._processQueue();
                });
        }
    }

    /**
     * Rewrites a TMDb image URL to the single unified low-resolution mode (w185 for posters, w300 for backdrops).
     * @param {string} url - Original TMDb image URL.
     * @returns {string} Downgraded low-resolution TMDb image URL.
     */
    _rewriteUrlForSlowNetwork(url) {
        if (!url || typeof url !== 'string' || !url.includes('/t/p/')) return url;
        return url.replace(/\/t\/p\/(w154|w185|w342|w500|w780|w1280|original)\//, (match, size) => {
            const isBackdrop = size === 'w780' || size === 'w1280' || size === 'original';
            return `/t/p/${isBackdrop ? 'w300' : 'w185'}/`;
        });
    }

    /**
     * Activates global slow-network mode when a download stalls or falls below throughput thresholds.
     */
    _triggerSlowNetworkMode() {
        const now = Date.now();
        if (typeof window !== 'undefined') {
            const wasSlow = now < (window.__ividsSlowUntil || 0);
            window.__ividsSlowUntil = now + 60000;
            window.__ividsSlowConnection = true;
            if (!wasSlow) {
                window.dispatchEvent(new CustomEvent('networkslowdetected'));
            }
        }
    }

    /**
     * Fetches a network resource and extracts its Blob within an explicit timeout window.
     * @param {string} url - Network URL to fetch.
     * @param {number} timeoutMs - Timeout in milliseconds.
     * @param {RequestInit} [options={}] - Custom fetch options.
     * @returns {Promise<Blob|null>} The downloaded blob or null.
     */
    async _fetchBlobWithTimeout(url, timeoutMs, options = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            if (!response.ok) return null;
            return await response.blob();
        } catch (e) {
            return null;
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Internal: fetches an image URL through the concurrency queue and stores the blob in cache.
     * Dynamically downgrades TMDb image sizes to w92/w300 when slow internet is detected or when a request stalls.
     * @param {string} url - The image URL to fetch.
     * @returns {Promise<string|null>} The blob URL on success, null on failure.
     */
    async _fetchAndCache(url) {
        return this._enqueue(async () => {
            const now = Date.now();
            const isSlow = typeof window !== 'undefined' && (
                (window.__ividsSlowUntil && now < window.__ividsSlowUntil) ||
                window.__ividsSlowConnection === true
            );

            const downgradedUrl = this._rewriteUrlForSlowNetwork(url);
            const targetUrl = isSlow ? downgradedUrl : url;
            const canDowngrade = !isSlow && downgradedUrl !== url;

            const shouldBypass = this._bypassActive && !this._bypassedUrls.has(targetUrl);
            if (shouldBypass) {
                this._bypassedUrls.add(targetUrl);
            }
            const fetchOptions = shouldBypass ? { cache: 'reload' } : {};

            try {
                const startTime = Date.now();
                let blob = null;

                if (!isSlow) {
                    blob = await this._fetchBlobWithTimeout(targetUrl, HIGH_RES_TIMEOUT_MS, fetchOptions);

                    if (!blob && canDowngrade) {
                        this._triggerSlowNetworkMode();
                        const fbOptions = this._bypassActive && !this._bypassedUrls.has(downgradedUrl)
                            ? { cache: 'reload' }
                            : {};
                        if (fbOptions.cache) this._bypassedUrls.add(downgradedUrl);
                        blob = await this._fetchBlobWithTimeout(downgradedUrl, FALLBACK_TIMEOUT_MS, fbOptions);
                    }
                } else {
                    blob = await this._fetchBlobWithTimeout(targetUrl, SLOW_MODE_TIMEOUT_MS, fetchOptions);
                }

                if (!blob) return null;

                const elapsedMs = Date.now() - startTime;
                const mbps = elapsedMs > 0 ? (blob.size * 8) / (elapsedMs * 1000) : 999;

                if (elapsedMs > 5000 || (blob.size > 20480 && mbps < NETWORK_CONFIG.SLOW_THRESHOLD_MBPS)) {
                    this._triggerSlowNetworkMode();
                }

                return this.put(url, blob);
            } catch (e) {
                return null;
            }
        });
    }

    /**
     * Checks whether a cache-bypass reload cycle is currently active.
     * @returns {boolean} True if cache bypass mode is active.
     */
    isBypassActive() {
        return Boolean(this._bypassActive);
    }

    /**
     * Revokes all stored Object URLs, drains pending queues, and clears the cache.
     * Call during app teardown or account switches.
     */
    destroy() {
        this._generation++;
        for (const entry of this.cache.values()) {
            if (entry && entry.blobUrl) {
                URL.revokeObjectURL(entry.blobUrl);
            }
        }
        this.cache.clear();
        this.totalBytes = 0;
        this.inflight.clear();

        // Safely discard queue items from previous generation
        while (this.queue.length > 0) {
            const item = this.queue.shift();
            if (item && typeof item.resolve === 'function') {
                try { item.resolve(null); } catch (e) {}
            }
        }

        this.activeRequests = 0;
        this._bypassActive = false;
        this._bypassedUrls.clear();
    }

    /**
     * Purges all cached blob URLs and enables HTTP disk-cache bypass ({ cache: 'reload' })
     * so all subsequently requested images are freshly downloaded at full quality.
     */
    clearAndBypassHttpCache() {
        this.destroy();
        this._bypassActive = true;
        this._bypassedUrls.clear();
    }
}

/** Singleton image cache instance. */
export const imageCache = new ImageCache();
