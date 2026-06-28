/**
 * PersistentStorage provides a unified storage interface that automatically chooses between
 * Android's native SharedPreferences (via the window.AndroidSettings bridge) and standard
 * Web localStorage.
 *
 * It uses a dual-write approach on Android: writing to both SharedPreferences and localStorage.
 * When reading on Android, if a key exists in SharedPreferences but is missing from localStorage
 * (e.g. after an app update where WebView data was cleared), it automatically restores the value
 * to localStorage.
 */
class PersistentStorage {
    /**
     * Retrieves an item from storage.
     * On Android, it checks SharedPreferences. If found in SharedPreferences but not in
     * localStorage, it restores it to localStorage. If not found in SharedPreferences,
     * it falls back to localStorage.
     *
     * @param {string} key - The key of the item to retrieve.
     * @returns {string|null} The stored value, or null if not found.
     */
    static getItem(key) {
        if (window.AndroidSettings && typeof window.AndroidSettings.getString === 'function') {
            try {
                const nativeValue = window.AndroidSettings.getString(key);
                if (nativeValue !== null && nativeValue !== undefined) {
                    // Check if it's missing in localStorage and restore it if needed
                    const localValue = localStorage.getItem(key);
                    if (localValue === null) {
                        console.log(`PersistentStorage: Restoring key "${key}" from SharedPreferences to localStorage`);
                        localStorage.setItem(key, nativeValue);
                    }
                    return nativeValue;
                }
            } catch (e) {
                console.error(`PersistentStorage: Error reading "${key}" from AndroidSettings`, e);
            }
        }
        return localStorage.getItem(key);
    }

    /**
     * Stores an item in storage.
     * On Android, it writes to both SharedPreferences and localStorage.
     * On other platforms, it writes only to localStorage.
     *
     * @param {string} key - The key of the item to store.
     * @param {string} value - The value to store.
     */
    static setItem(key, value) {
        // Normalize value to a string
        const stringValue = typeof value === 'string' ? value : String(value);
        
        if (window.AndroidSettings && typeof window.AndroidSettings.setString === 'function') {
            try {
                window.AndroidSettings.setString(key, stringValue);
            } catch (e) {
                console.error(`PersistentStorage: Error writing "${key}" to AndroidSettings`, e);
            }
        }
        localStorage.setItem(key, stringValue);
    }

    /**
     * Removes an item from storage.
     * On Android, it removes from both SharedPreferences and localStorage.
     *
     * @param {string} key - The key of the item to remove.
     */
    static removeItem(key) {
        if (window.AndroidSettings && typeof window.AndroidSettings.remove === 'function') {
            try {
                window.AndroidSettings.remove(key);
            } catch (e) {
                console.error(`PersistentStorage: Error removing "${key}" from AndroidSettings`, e);
            }
        }
        localStorage.removeItem(key);
    }
}

export { PersistentStorage };
