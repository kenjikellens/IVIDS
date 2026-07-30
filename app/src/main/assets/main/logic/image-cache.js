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

/** Maximum number of cached image blobs before LRU eviction kicks in. */
const MAX_ITEMS = 200;

class ImageCache {
    constructor() {
        /** @type {Map<string, {blobUrl: string, lastAccess: number}>} */
        this.cache = new Map();
        /** @type {Map<string, Promise<string>>} In-flight fetch promises to deduplicate concurrent requests. */
        this.inflight = new Map();
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
            const result = await promise;
            return result;
        } finally {
            this.inflight.delete(url);
        }
    }

    /**
     * Internal: fetches an image URL and stores the blob in the cache.
     * @param {string} url - The image URL to fetch.
     * @returns {Promise<string|null>} The blob URL on success, null on failure.
     */
    async _fetchAndCache(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;

            const blob = await response.blob();
            return this.put(url, blob);
        } catch (e) {
            return null;
        }
    }

    /**
     * Revokes all stored Object URLs and clears the cache.
     * Call during app teardown or account switches.
     */
    destroy() {
        for (const entry of this.cache.values()) {
            URL.revokeObjectURL(entry.blobUrl);
        }
        this.cache.clear();
        this.inflight.clear();
    }
}

/** Singleton image cache instance. */
export const imageCache = new ImageCache();
