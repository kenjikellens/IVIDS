/**
 * CacheManager - Simple TTL-based cache for API responses.
 * Uses a hybrid approach: In-memory (fast) and SessionStorage (survives page refreshes but not app restart).
 * Runs a periodic cleanup sweep every 5 minutes to prevent storage quota pressure.
 */
class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.PREFIX = 'ivids_api_cache_';
        this.MAX_MEMORY_ITEMS = 50; // Prevent unbounded memory growth
        this._startPeriodicCleanup();
    }

    /**
     * Checks if a key exists in cache and is not expired, without deserializing the value.
     * Useful for quick existence checks before committing to a full get().
     */
    has(key) {
        if (this.memoryCache.has(key)) {
            const memItem = this.memoryCache.get(key);
            if (Date.now() < memItem.expiry) return true;
            this.memoryCache.delete(key);
        }
        try {
            const stored = sessionStorage.getItem(this.PREFIX + key);
            if (stored) {
                const { expiry } = JSON.parse(stored);
                if (Date.now() < expiry) return true;
                sessionStorage.removeItem(this.PREFIX + key);
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    /**
     * Gets a cached item by key if it exists and has not expired.
     * Checks in-memory first, then falls back to SessionStorage with memory backfill.
     */
    get(key) {
        // 1. Check Memory
        if (this.memoryCache.has(key)) {
            const memItem = this.memoryCache.get(key);
            if (Date.now() < memItem.expiry) {
                // Refresh position in Map (LRU)
                this.memoryCache.delete(key);
                this.memoryCache.set(key, memItem);
                return memItem.value;
            }
            this.memoryCache.delete(key);
        }

        // 2. Check Session Storage
        try {
            const stored = sessionStorage.getItem(this.PREFIX + key);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Date.now() < parsed.expiry) {
                    // Backfill memory directly with the parsed object (avoids extra allocation)
                    this.setMemoryCache(key, parsed);
                    return parsed.value;
                }
                sessionStorage.removeItem(this.PREFIX + key);
            }
        } catch (e) {
            console.warn('CacheManager: Storage error', e);
        }

        return null;
    }

    /**
     * Set item in cache.
     */
    set(key, value, ttlMinutes = 10) {
        const expiry = Date.now() + (ttlMinutes * 60 * 1000);
        const item = { value, expiry };

        // Save to memory
        this.setMemoryCache(key, item);

        // Save to Session Storage
        try {
            sessionStorage.setItem(this.PREFIX + key, JSON.stringify(item));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn('CacheManager: SessionStorage quota exceeded, clearing old items');
                this.clearExpiredStorage();
            }
        }
    }

    /**
     * Helper to set memory cache with LRU eviction.
     */
    setMemoryCache(key, item) {
        if (this.memoryCache.has(key)) {
            this.memoryCache.delete(key);
        } else if (this.memoryCache.size >= this.MAX_MEMORY_ITEMS) {
            // Remove oldest item (first key in Map)
            const firstKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(firstKey);
        }
        this.memoryCache.set(key, item);
    }

    /**
     * Clear all cached items.
     */
    clear() {
        this.memoryCache.clear();
        try {
            const keysToRemove = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith(this.PREFIX)) keysToRemove.push(key);
            }
            keysToRemove.forEach(k => sessionStorage.removeItem(k));
        } catch (e) { }
    }

    /**
     * Sweeps expired items from sessionStorage to reclaim quota.
     * Called reactively on QuotaExceededError and periodically via background timer.
     */
    clearExpiredStorage() {
        try {
            const now = Date.now();
            const keysToRemove = [];
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith(this.PREFIX)) {
                    try {
                        const stored = sessionStorage.getItem(key);
                        if (stored) {
                            const { expiry } = JSON.parse(stored);
                            if (now >= expiry) keysToRemove.push(key);
                        }
                    } catch (e) { /* skip malformed entries */ }
                }
            }
            keysToRemove.forEach(k => sessionStorage.removeItem(k));
        } catch (e) { }
    }

    /**
     * Starts a background interval that sweeps expired cache entries every 5 minutes.
     * Prevents gradual sessionStorage quota pressure during long sessions.
     */
    _startPeriodicCleanup() {
        setInterval(() => this.clearExpiredStorage(), 5 * 60 * 1000);
    }
}

export const cacheManager = new CacheManager();
