// logic/playlists.js
import { getRecentlyWatched, addToRecentlyWatched, removeFromRecentlyWatched } from './recentlyWatched.js';

const STORAGE_KEY = 'user_playlists';
const HISTORY_ID = 'history';

// Module-level cache
let _playlistsCache = null;

function isMusic(item) {
    const type = item.media_type;
    return type === 'music' || type === 'music_song' || type === 'music_track';
}

export const Playlists = {
    getPlaylists() {
        try {
            if (!_playlistsCache) {
                const stored = localStorage.getItem(STORAGE_KEY);
                _playlistsCache = stored ? JSON.parse(stored) : [];

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

    savePlaylists(playlists) {
        try {
            // Only save user playlists (filter out system ones like history)
            _playlistsCache = (playlists || []).filter(p => !p.isSystem && p.id !== HISTORY_ID);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_playlistsCache));
        } catch (e) {
            console.error('Error saving playlists:', e);
        }
    },

    createPlaylist(name) {
        // Ensure cache is loaded
        this.getPlaylists();

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
    }
}
