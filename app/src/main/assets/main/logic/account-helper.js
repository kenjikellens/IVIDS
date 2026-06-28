/**
 * Account Helper Utility for IVIDS.
 * Coordinates user-specific data isolation and namespaced storage keys.
 */
import { PersistentStorage } from './persistent-storage.js';

let _activeAccountCache = null;
let _cacheInitialized = false;

/**
 * Clears the active account cache, forcing the next lookup to query localStorage.
 */
export function clearActiveAccountCache() {
    _activeAccountCache = null;
    _cacheInitialized = false;
}

/**
 * Returns the currently active account object, or null if in anonymous mode.
 * Uses an in-memory cache to avoid redundant synchronous localStorage query and parse calls.
 * @returns {Object|null}
 */
export function getActiveAccount() {
    if (_cacheInitialized) {
        return _activeAccountCache;
    }

    try {
        const cloudSession = PersistentStorage.getItem('ivids-cloud-session');
        if (cloudSession) {
            const session = JSON.parse(cloudSession);
            if (session && session.pushId && session.username) {
                _activeAccountCache = { id: session.pushId, name: session.username, isCloud: true };
                _cacheInitialized = true;
                return _activeAccountCache;
            }
        }

        const stored = PersistentStorage.getItem('ivids-current-profile');
        if (!stored) {
            _activeAccountCache = null;
            _cacheInitialized = true;
            return null;
        }
        const acc = JSON.parse(stored);
        // Ensure guest is treated as not logged in (anonymous)
        if (acc && (acc.id === 'guest' || acc.name === 'Guest')) {
            _activeAccountCache = null;
            _cacheInitialized = true;
            return null;
        }
        _activeAccountCache = acc;
        _cacheInitialized = true;
        return _activeAccountCache;
    } catch (e) {
        console.error('AccountHelper: Error parsing active account:', e);
        _activeAccountCache = null;
        _cacheInitialized = true;
        return null;
    }
}

/**
 * Returns the ID of the active account, or 'anon' if anonymous.
 * @returns {string}
 */
export function getActiveAccountId() {
    const acc = getActiveAccount();
    return acc && acc.id ? acc.id : 'anon';
}

/**
 * Generates a namespaced storage key based on the current active account.
 * @param {string} baseKey - The base storage key (e.g. 'playlists')
 * @returns {string} The fully namespaced key (e.g. 'ivids-acc-123-playlists')
 */
export function getNamespacedKey(baseKey) {
    const id = getActiveAccountId();
    if (id === 'anon') {
        // Fallback for settings or other files where global config is separate
        if (baseKey === 'settings') {
            return 'ivids-settings';
        }
        return `ivids-anon-${baseKey}`;
    }
    return `ivids-acc-${id}-${baseKey}`;
}
