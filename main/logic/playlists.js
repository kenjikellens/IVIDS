// logic/playlists.js
import { getRecentlyWatched, addToRecentlyWatched, removeFromRecentlyWatched } from './recentlyWatched.js';

const STORAGE_KEY = 'user_playlists';
const HISTORY_ID = 'history';

export const Playlists = {
    getPlaylists() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            let playlists = stored ? JSON.parse(stored) : [];

            // Get real recently watched data
            const historyItems = getRecentlyWatched();

            // Construct history playlist dynamically
            const historyPlaylist = {
                id: HISTORY_ID,
                name: 'Recently Watched',
                items: historyItems,
                createdAt: 0, // Always first
                isSystem: true
            };

            // Remove any old stored history playlist to avoid stale data
            playlists = playlists.filter(p => p.id !== HISTORY_ID);

            // Add fresh history playlist to beginning
            playlists.unshift(historyPlaylist);

            return playlists;
        } catch (e) {
            console.error('Error loading playlists:', e);
            // Return at least the history playlist on error
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
            // Don't save the history playlist to user_playlists storage
            // It is managed by recentlyWatched.js
            const playlistsToSave = playlists.filter(p => p.id !== HISTORY_ID);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(playlistsToSave));
        } catch (e) {
            console.error('Error saving playlists:', e);
        }
    },

    createPlaylist(name) {
        const playlists = this.getPlaylists();
        const newPlaylist = {
            id: Date.now().toString(),
            name: name,
            items: [],
            createdAt: Date.now()
        };
        // Add after history
        playlists.splice(1, 0, newPlaylist);
        this.savePlaylists(playlists);
        return newPlaylist;
    },

    deletePlaylist(id) {
        if (id === HISTORY_ID) return; // Cannot delete history
        let playlists = this.getPlaylists();
        playlists = playlists.filter(p => p.id !== id);
        this.savePlaylists(playlists);
    },



    addToPlaylist(playlistId, item) {
        if (playlistId === HISTORY_ID) {
            addToRecentlyWatched(item);
            return true;
        }

        const playlists = this.getPlaylists();
        const playlist = playlists.find(p => p.id === playlistId);
        if (playlist) {
            // Check for duplicates
            const existingIndex = playlist.items.findIndex(i => i.id === item.id && i.media_type === item.media_type);

            if (existingIndex !== -1) {
                return false; // Already exists
            }

            const newItem = {
                id: item.id,
                title: item.title || item.name,
                name: item.name || item.title,
                poster_path: item.poster_path,
                backdrop_path: item.backdrop_path,
                media_type: item.media_type || item.type || 'movie',
                overview: item.overview,
                addedAt: Date.now()
            };

            playlist.items.push(newItem);
            this.savePlaylists(playlists);
            return true;
        }
        return false;
    },

    removeFromPlaylist(playlistId, itemId) {
        if (playlistId === HISTORY_ID) {
            removeFromRecentlyWatched(itemId);
            return;
        }

        const playlists = this.getPlaylists();
        const playlist = playlists.find(p => p.id === playlistId);
        if (playlist) {
            playlist.items = playlist.items.filter(i => i.id !== itemId);
            this.savePlaylists(playlists);
        }
    },

    getPlaylist(id) {
        const playlists = this.getPlaylists();
        return playlists.find(p => p.id === id);
    },

    sortPlaylist(id, sortBy) {
        if (id === HISTORY_ID) return false; // Cannot sort history manually

        const playlists = this.getPlaylists();
        const playlist = playlists.find(p => p.id === id);
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
            this.savePlaylists(playlists);
            return true;
        }
        return false;
    },

    moveItem(playlistId, fromIndex, toIndex) {
        if (playlistId === HISTORY_ID) return false; // Cannot reorder history manually

        const playlists = this.getPlaylists();
        const playlist = playlists.find(p => p.id === playlistId);
        if (playlist && fromIndex >= 0 && fromIndex < playlist.items.length && toIndex >= 0 && toIndex < playlist.items.length) {
            const item = playlist.items.splice(fromIndex, 1)[0];
            playlist.items.splice(toIndex, 0, item);
            this.savePlaylists(playlists);
            return true;
        }
        return false;
    }
};
