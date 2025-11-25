// logic/playlists.js

const STORAGE_KEY = 'user_playlists';
const HISTORY_ID = 'history';

export const Playlists = {
    getPlaylists() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            let playlists = stored ? JSON.parse(stored) : [];

            // Ensure "Recently Watched" exists
            if (!playlists.find(p => p.id === HISTORY_ID)) {
                const historyPlaylist = {
                    id: HISTORY_ID,
                    name: 'Recently Watched',
                    items: [],
                    createdAt: 0, // Always first
                    isSystem: true
                };
                // Add to beginning
                playlists.unshift(historyPlaylist);
                this.savePlaylists(playlists);
            }

            return playlists;
        } catch (e) {
            console.error('Error loading playlists:', e);
            // Return at least the history playlist on error
            return [{
                id: HISTORY_ID,
                name: 'Recently Watched',
                items: [],
                createdAt: 0,
                isSystem: true
            }];
        }
    },

    savePlaylists(playlists) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
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
        playlists.push(newPlaylist);
        this.savePlaylists(playlists);
        return newPlaylist;
    },

    deletePlaylist(id) {
        if (id === HISTORY_ID) return; // Cannot delete history
        let playlists = this.getPlaylists();
        playlists = playlists.filter(p => p.id !== id);
        this.savePlaylists(playlists);
    },

    renamePlaylist(id, newName) {
        if (id === HISTORY_ID) return; // Cannot rename history
        const playlists = this.getPlaylists();
        const playlist = playlists.find(p => p.id === id);
        if (playlist) {
            playlist.name = newName;
            this.savePlaylists(playlists);
        }
    },

    addToPlaylist(playlistId, item) {
        const playlists = this.getPlaylists();
        const playlist = playlists.find(p => p.id === playlistId);
        if (playlist) {
            // Check for duplicates
            const existingIndex = playlist.items.findIndex(i => i.id === item.id && i.media_type === item.media_type);

            if (existingIndex !== -1) {
                // If it's history, move to top
                if (playlistId === HISTORY_ID) {
                    playlist.items.splice(existingIndex, 1);
                } else {
                    return false; // Already exists in normal playlist
                }
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

            if (playlistId === HISTORY_ID) {
                playlist.items.unshift(newItem); // Add to top for history
                // Limit history size
                if (playlist.items.length > 50) {
                    playlist.items.pop();
                }
            } else {
                playlist.items.push(newItem);
            }

            this.savePlaylists(playlists);
            return true;
        }
        return false;
    },

    removeFromPlaylist(playlistId, itemId) {
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
