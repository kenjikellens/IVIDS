/**
 * Account Helper Utility for IVIDS.
 * Coordinates user-specific data isolation and namespaced storage keys.
 */

/**
 * Returns the currently active account object, or null if in anonymous mode.
 * @returns {Object|null}
 */
export function getActiveAccount() {
    try {
        const cloudSession = localStorage.getItem('ivids-cloud-session');
        if (cloudSession) {
            const session = JSON.parse(cloudSession);
            if (session && session.pushId && session.username) {
                return { id: session.pushId, name: session.username, isCloud: true };
            }
        }

        const stored = localStorage.getItem('ivids-current-profile');
        if (!stored) return null;
        const acc = JSON.parse(stored);
        // Ensure guest is treated as not logged in (anonymous)
        if (acc && (acc.id === 'guest' || acc.name === 'Guest')) {
            return null;
        }
        return acc;
    } catch (e) {
        console.error('AccountHelper: Error parsing active account:', e);
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
