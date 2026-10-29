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

/** Maximum number of cached image blobs before LRU eviction kicks in. */
const MAX_ITEMS = CACHE_CONFIG.MAX_IMAGE_ITEMS;

/** Maximum time in milliseconds to wait for a high-res image before falling back to low-res. */
const HIGH_RES_TIMEOUT_MS = 3000;

/** Maximum time in milliseconds to wait for a downgraded/low-res fallback image. */
const FALLBACK_TIMEOUT_MS = 5000;

/** Maximum time in milliseconds to wait for an image when already in slow-network mode. */
const SLOW_MODE_TIMEOUT_MS = 6000;

class ImageCache {
    constructor() {
        /** @type {Map<string, {blobUrl: string, lastAccess: number}>} */
        this.cache = new Map();
        /** @type {Map<string, Promise<string|null>>} In-flight fetch promises to deduplicate concurrent requests. */
        this.inflight = new Map();
        /** @type {Array<{task: Function, resolve: Function, reject: Function, generation: number}>} Concurrency task queue. */
        this.queue = [];
        /** @type {number} Current active fetch request count. */
        this.activeRequests = 0;
        /** @type {number} Maximum concurrent network blob fetch requests. */
        this.MAX_CONCURRENT = 6;
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
     * Stores an image blob and returns its Object URL.
     * Evicts the oldest entry if the cache is full.
     * @param {string} url - The original image network URL.
     * @param {Blob} blob - The fetched image blob data.
     * @returns {string} The created Object URL.
     */
    put(url, blob) {
        if (!blob) return null;

        // Evict oldest if at capacity
        if (this.cache.size >= MAX_ITEMS && !this.cache.has(url)) {
            const oldestKey = this.cache.keys().next().value;
            const oldestEntry = this.cache.get(oldestKey);
            if (oldestEntry) {
                URL.revokeObjectURL(oldestEntry.blobUrl);
            }
            this.cache.delete(oldestKey);
        }

        // If already cached, revoke old blob before replacing
        if (this.cache.has(url)) {
            const existing = this.cache.get(url);
            if (existing) URL.revokeObjectURL(existing.blobUrl);
            this.cache.delete(url);
        }

        const blobUrl = URL.createObjectURL(blob);
        this.cache.set(url, { blobUrl, lastAccess: Date.now() });
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
     * Rewrites a TMDb image URL to its lightweight low-resolution equivalent (w92 for posters, w300 for backdrops).
     * @param {string} url - Original TMDb image URL.
     * @returns {string} Downgraded low-resolution TMDb image URL.
     */
    _rewriteUrlForSlowNetwork(url) {
        if (!url || typeof url !== 'string' || !url.includes('/t/p/')) return url;
        return url.replace(/\/t\/p\/(w154|w185|w342|w500|w780|w1280|original)\//, (match, size) => {
            const isBackdrop = size === 'w780' || size === 'w1280' || size === 'original';
            return `/t/p/${isBackdrop ? 'w300' : 'w92'}/`;
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

                if (elapsedMs > 2500 || (blob.size > 20480 && mbps < NETWORK_CONFIG.SLOW_THRESHOLD_MBPS)) {
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
