// Utility for managing recently watched content
import { Toast } from '../gui/js/toast.js';
import { getActiveAccountId, getNamespacedKey } from './account-helper.js';

const MAX_RECENTLY_WATCHED = 20;
const STORAGE_KEY = 'recentlyWatched';

// In-memory cache to reduce localStorage access
let _recentlyWatchedCache = null;
let _cacheOwnerId = null;

function isMusic(item) {
    const type = item.media_type;
    return type === 'music' || type === 'music_song' || type === 'music_track';
}

/**
 * Adds an item to the recently watched list, capping it at 20 items.
 * Attempts to trim the list further and retry on QuotaExceededError, displaying a toast on final failure.
 * @param {Object} item - The media item details to add.
 */
export function addToRecentlyWatched(item) {
    if (!item || isMusic(item)) return;

    try {
        const currentId = getActiveAccountId();
        const namespacedKey = getNamespacedKey(STORAGE_KEY);

        // Get existing recently watched
        let recentlyWatched = getRecentlyWatched();

        // Remove if already exists (to avoid duplicates)
        recentlyWatched = recentlyWatched.filter(i => !(String(i.id) === String(item.id) && i.media_type === item.media_type));

        // Add to beginning
        recentlyWatched.unshift({
            id: item.id,
            title: item.title || item.name,
            name: item.name || item.title,
            poster_path: item.poster_path,
            backdrop_path: item.backdrop_path,
            media_type: item.media_type,
            overview: item.overview,
            season: item.season,
            episode: item.episode,
            timestamp: Date.now()
        });

        // Keep only MAX_RECENTLY_WATCHED items
        recentlyWatched = recentlyWatched.slice(0, MAX_RECENTLY_WATCHED);

        // Update cache and localStorage
        _recentlyWatchedCache = recentlyWatched;
        _cacheOwnerId = currentId;

        try {
            localStorage.setItem(namespacedKey, JSON.stringify(recentlyWatched));
        } catch (setItemError) {
            console.error('Error saving recently watched:', setItemError);
            if (setItemError.name === 'QuotaExceededError' || (setItemError.message && setItemError.message.includes('quota'))) {
                // Attempt to trim further to 10 items and retry once
                if (recentlyWatched.length > 10) {
                    recentlyWatched = recentlyWatched.slice(0, 10);
                    _recentlyWatchedCache = recentlyWatched;
                    _cacheOwnerId = currentId;
                    try {
                        localStorage.setItem(namespacedKey, JSON.stringify(recentlyWatched));
                    } catch (retryError) {
                        const title = window.i18n ? window.i18n.t('toast.storageFullTitle') : 'Storage Full';
                        const msg = window.i18n ? window.i18n.t('toast.storageFull') : 'Storage limit reached. Changes cannot be saved permanently.';
                        if (typeof Toast !== 'undefined') {
                            Toast.show(msg, { title, duration: 5000 });
                        }
                    }
                } else {
                    const title = window.i18n ? window.i18n.t('toast.storageFullTitle') : 'Storage Full';
                    const msg = window.i18n ? window.i18n.t('toast.storageFull') : 'Storage limit reached. Changes cannot be saved permanently.';
                    if (typeof Toast !== 'undefined') {
                        Toast.show(msg, { title, duration: 5000 });
                    }
                }
            }
        }

        console.log('Added to recently watched:', item.title || item.name);
    } catch (e) {
        console.error('Error adding to recently watched:', e);
    }
}

export function getRecentlyWatched() {
    const currentId = getActiveAccountId();
    if (_recentlyWatchedCache && _cacheOwnerId === currentId) return [..._recentlyWatchedCache];

    try {
        const namespacedKey = getNamespacedKey(STORAGE_KEY);
        const stored = localStorage.getItem(namespacedKey);
        let items = stored ? JSON.parse(stored) : [];

        // Sanitize data once on load
        _recentlyWatchedCache = items.filter(i => !isMusic(i));
        _cacheOwnerId = currentId;
        return [..._recentlyWatchedCache];
    } catch (e) {
        console.error('Error loading recently watched:', e);
        return [];
    }
}

/**
 * Retrieves a watched item matching the specific ID and media type.
 * Normalizes parameters to perform a strict type comparison.
 * @param {string|number} id - The ID of the media item.
 * @param {string} type - The media type (movie or tv).
 * @returns {Object|undefined} The matching media item, or undefined.
 */
export function getWatchedItem(id, type) {
    const recentlyWatched = getRecentlyWatched();
    return recentlyWatched.find(i => String(i.id) === String(id) && i.media_type === type);
}

export function clearRecentlyWatched() {
    try {
        const namespacedKey = getNamespacedKey(STORAGE_KEY);
        _recentlyWatchedCache = [];
        _cacheOwnerId = getActiveAccountId();
        localStorage.removeItem(namespacedKey);
        console.log('Recently watched cleared');
    } catch (e) {
        console.error('Error clearing recently watched:', e);
    }
}

/**
 * Removes an item from the recently watched list by its ID.
 * Normalizes the item ID before comparison to ensure reliable matching.
 * @param {string|number} id - The ID of the item to remove.
 */
export function removeFromRecentlyWatched(id) {
    try {
        const currentId = getActiveAccountId();
        const namespacedKey = getNamespacedKey(STORAGE_KEY);

        let recentlyWatched = getRecentlyWatched();
        recentlyWatched = recentlyWatched.filter(i => String(i.id) !== String(id));

        _recentlyWatchedCache = recentlyWatched;
        _cacheOwnerId = currentId;

        try {
            localStorage.setItem(namespacedKey, JSON.stringify(recentlyWatched));
        } catch (setItemError) {
            console.error('Error removing from recently watched:', setItemError);
            if (setItemError.name === 'QuotaExceededError' || (setItemError.message && setItemError.message.includes('quota'))) {
                const title = window.i18n ? window.i18n.t('toast.storageFullTitle') : 'Storage Full';
                const msg = window.i18n ? window.i18n.t('toast.storageFull') : 'Storage limit reached. Changes cannot be saved permanently.';
                if (typeof Toast !== 'undefined') {
                    Toast.show(msg, { title, duration: 5000 });
                }
            }
        }
        console.log('Removed from recently watched:', id);
    } catch (e) {
        console.error('Error removing from recently watched:', e);
    }
}
