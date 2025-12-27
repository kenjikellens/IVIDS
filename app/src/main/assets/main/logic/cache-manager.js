/**
 * CacheManager - Simple TTL-based cache for API responses.
 * Uses a hybrid approach: In-memory (fast) and SessionStorage (survives page refreshes but not app restart).
 */
class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.PREFIX = 'ivids_api_cache_';
    }

    /**
     * Get item from cache if not expired.
     */
    get(key) {
        // 1. Check Memory
        const memItem = this.memoryCache.get(key);
        if (memItem) {
            if (Date.now() < memItem.expiry) return memItem.value;
            this.memoryCache.delete(key);
        }

        // 2. Check Session Storage
        try {
            const stored = sessionStorage.getItem(this.PREFIX + key);
            if (stored) {
                const { value, expiry } = JSON.parse(stored);
                if (Date.now() < expiry) {
                    // Backfill memory
                    this.memoryCache.set(key, { value, expiry });
                    return value;
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
     * @param {string} key 
     * @param {any} value 
     * @param {number} ttlMinutes 
     */
    set(key, value, ttlMinutes = 10) {
        const expiry = Date.now() + (ttlMinutes * 60 * 1000);
        const item = { value, expiry };

        // Save to memory
        this.memoryCache.set(key, item);

        // Save to Session Storage
        try {
            sessionStorage.setItem(this.PREFIX + key, JSON.stringify(item));
        } catch (e) {
            // Probably quota exceeded or restricted environment
        }
    }

    /**
     * Clear all cached items.
     */
    clear() {
        this.memoryCache.clear();
        try {
            Object.keys(sessionStorage).forEach(key => {
                if (key.startsWith(this.PREFIX)) sessionStorage.removeItem(key);
            });
        } catch (e) { }
    }
}

export const cacheManager = new CacheManager();
