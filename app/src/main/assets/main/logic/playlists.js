// logic/playlists.js
import { getRecentlyWatched, addToRecentlyWatched, removeFromRecentlyWatched } from './recentlyWatched.js';
import { Toast } from '../gui/js/toast.js';
import { getActiveAccountId, getNamespacedKey } from './account-helper.js';
import { PersistentStorage } from './persistent-storage.js';

const STORAGE_KEY = 'user_playlists';
const HISTORY_ID = 'history';

// Module-level cache
let _playlistsCache = null;
let _cacheOwnerId = null;

function isMusic(item) {
    const type = item.media_type;
    return type === 'music' || type === 'music_song' || type === 'music_track';
}

export const Playlists = {
    getPlaylists() {
        try {
            const currentId = getActiveAccountId();
            const namespacedKey = getNamespacedKey(STORAGE_KEY);

            if (!_playlistsCache || _cacheOwnerId !== currentId) {
                const stored = PersistentStorage.getItem(namespacedKey);
                _playlistsCache = stored ? JSON.parse(stored) : [];
                _cacheOwnerId = currentId;

                // Content sanitization on initial load
                _playlistsCache.forEach(p => {
                    if (p.items) {
                        p.items = p.items.filter(i => !isMusic(i));
                    }
                });
            }

            // Get real recently watched data (already cached in recentlyWatched.js)
            const historyItems = getRecentlyWatched();

            // Construct history playlist dynamically
            const historyPlaylist = {
                id: HISTORY_ID,
                name: 'Recently Watched',
                items: historyItems,
                createdAt: 0, // Always first
                isSystem: true
            };

            // Combine system and user playlists
            // We return a fresh array to prevent accidental mutations of the cache
            return [historyPlaylist, ..._playlistsCache];
        } catch (e) {
            console.error('Error loading playlists:', e);
            return [{
                id: HISTORY_ID,
                name: 'Recently Watched',
                items: getRecentlyWatched(),
                createdAt: 0,
                isSystem: true
            }];
        }
    },

    /**
     * Serializes user playlists into localStorage, filtering out system playlists.
     * Shows a toast notification if the browser's localStorage quota is exceeded.
     */
    savePlaylists(playlists) {
        try {
            const currentId = getActiveAccountId();
            const namespacedKey = getNamespacedKey(STORAGE_KEY);

            // Only save user playlists (filter out system ones like history)
            _playlistsCache = (playlists || []).filter(p => !p.isSystem && p.id !== HISTORY_ID);
            _cacheOwnerId = currentId;
            PersistentStorage.setItem(namespacedKey, JSON.stringify(_playlistsCache));
        } catch (e) {
            console.error('Error saving playlists:', e);
            if (e.name === 'QuotaExceededError' || (e.message && e.message.includes('quota'))) {
                const title = window.i18n ? window.i18n.t('toast.storageFullTitle') : 'Storage Full';
                const msg = window.i18n ? window.i18n.t('toast.storageFull') : 'Storage limit reached. Changes cannot be saved permanently.';
                if (typeof Toast !== 'undefined') {
                    Toast.show(msg, { title, duration: 5000 });
                }
            }
        }
    },

    /**
     * Creates a new user playlist with the given name, subject to a limit of 50.
     * Displays a toast notification and returns null if the limit is reached.
     */
    createPlaylist(name) {
        // Ensure cache is loaded
        this.getPlaylists();

        // Enforce max 50 user playlists limit
        if (_playlistsCache.length >= 50) {
            const title = window.i18n ? window.i18n.t('toast.storageFullTitle') : 'Storage Full';
            const msg = window.i18n ? window.i18n.t('toast.storageFull') : 'Storage limit reached. Changes cannot be saved permanently.';
            if (typeof Toast !== 'undefined') {
                Toast.show(msg, { title, duration: 5000 });
            }
            return null;
        }

        const newPlaylist = {
            id: Date.now().toString(),
            name: name,
            items: [],
            createdAt: Date.now()
        };

        _playlistsCache.unshift(newPlaylist);
        this.savePlaylists(_playlistsCache);
        return newPlaylist;
    },

    deletePlaylist(id) {
        if (id === HISTORY_ID) return;
        this.getPlaylists();
        _playlistsCache = _playlistsCache.filter(p => p.id !== id);
        this.savePlaylists(_playlistsCache);
    },

    /**
     * Adds an item to a playlist, enforcing duplicate prevention and a 200-item cap.
     * Displays a toast notification and returns false if the item limit is exceeded.
     */
    addToPlaylist(playlistId, item) {
        if (!item || isMusic(item)) return false;

        if (playlistId === HISTORY_ID) {
            addToRecentlyWatched(item);
            return true;
        }

        this.getPlaylists();
        const playlist = _playlistsCache.find(p => p.id === playlistId);

        if (playlist) {
            // Check for duplicates
            const exists = playlist.items.some(i => i.id === item.id && i.media_type === item.media_type);
            if (exists) return false;

            // Enforce max 200 items per playlist limit
            if (playlist.items.length >= 200) {
                const title = window.i18n ? window.i18n.t('toast.storageFullTitle') : 'Storage Full';
                const msg = window.i18n ? window.i18n.t('toast.storageFull') : 'Storage limit reached. Changes cannot be saved permanently.';
                if (typeof Toast !== 'undefined') {
                    Toast.show(msg, { title, duration: 5000 });
                }
                return false;
            }

            const newItem = {
                id: item.id,
                title: item.title || item.name,
                name: item.name || item.title,
                poster_path: item.poster_path,
                backdrop_path: item.backdrop_path,
                media_type: item.media_type,
                overview: item.overview,
                addedAt: Date.now()
            };

            playlist.items.push(newItem);
            this.savePlaylists(_playlistsCache);
            return true;
        }
        return false;
    },

    removeFromPlaylist(playlistId, itemId) {
        if (playlistId === HISTORY_ID) {
            removeFromRecentlyWatched(itemId);
            return;
        }

        this.getPlaylists();
        const playlist = _playlistsCache.find(p => p.id === playlistId);
        if (playlist) {
            playlist.items = playlist.items.filter(i => i.id !== itemId);
            this.savePlaylists(_playlistsCache);
        }
    },

    getPlaylist(id) {
        if (id === HISTORY_ID) return this.getPlaylists()[0];
        this.getPlaylists();
        return _playlistsCache.find(p => p.id === id);
    },

    sortPlaylist(id, sortBy) {
        if (id === HISTORY_ID) return false;

        this.getPlaylists();
        const playlist = _playlistsCache.find(p => p.id === id);
        if (playlist) {
            switch (sortBy) {
                case 'name_asc':
                    playlist.items.sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name));
                    break;
                case 'name_desc':
                    playlist.items.sort((a, b) => (b.title || b.name).localeCompare(a.title || a.name));
                    break;
                case 'date_added_newest':
                    playlist.items.sort((a, b) => b.addedAt - a.addedAt);
                    break;
                case 'date_added_oldest':
                    playlist.items.sort((a, b) => a.addedAt - b.addedAt);
                    break;
            }
            this.savePlaylists(_playlistsCache);
            return true;
        }
        return false;
    },

    moveItem(playlistId, fromIndex, toIndex) {
        if (playlistId === HISTORY_ID) return false;

        this.getPlaylists();
        const playlist = _playlistsCache.find(p => p.id === playlistId);
        if (playlist && fromIndex >= 0 && fromIndex < playlist.items.length && toIndex >= 0 && toIndex < playlist.items.length) {
            const item = playlist.items.splice(fromIndex, 1)[0];
            playlist.items.splice(toIndex, 0, item);
            this.savePlaylists(_playlistsCache);
            return true;
        }
        return false;
    },

    /**
     * Renames an existing user playlist.
     * Updates the name string inside the cached list and serializes back to local storage.
     * 
     * @param {string} id - The unique ID of the playlist to rename.
     * @param {string} newName - The new name to assign to the playlist.
     * @returns {boolean} True if the renaming was successful, false otherwise.
     */
    renamePlaylist(id, newName) {
        if (id === HISTORY_ID) return false;
        this.getPlaylists();
        const playlist = _playlistsCache.find(p => p.id === id);
        if (playlist && newName && newName.trim()) {
            playlist.name = newName.trim();
            this.savePlaylists(_playlistsCache);
            return true;
        }
        return false;
    }
}

