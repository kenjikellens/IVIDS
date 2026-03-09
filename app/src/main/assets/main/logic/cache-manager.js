/**
 * CacheManager - Simple TTL-based cache for API responses.
 * Uses a hybrid approach: In-memory (fast) and SessionStorage (survives page refreshes but not app restart).
 */
class CacheManager {
    constructor() {
        this.memoryCache = new Map();
        this.PREFIX = 'ivids_api_cache_';
        this.MAX_MEMORY_ITEMS = 50; // Prevent unbounded memory growth
    }

    /**
     * Get item from cache if not expired.
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
                const { value, expiry } = JSON.parse(stored);
                if (Date.now() < expiry) {
                    // Backfill memory with LRU check
                    this.setMemoryCache(key, { value, expiry });
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
     * Periodically clear expired items from storage if quota is tight.
     */
    clearExpiredStorage() {
        try {
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                if (key && key.startsWith(this.PREFIX)) {
                    const stored = sessionStorage.getItem(key);
                    if (stored) {
                        const { expiry } = JSON.parse(stored);
                        if (Date.now() >= expiry) sessionStorage.removeItem(key);
                    }
                }
            }
        } catch (e) { }
    }
}

export const cacheManager = new CacheManager();
