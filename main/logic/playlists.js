// logic/playlists.js

const STORAGE_KEY = 'user_playlists';

export const Playlists = {
    getPlaylists() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            console.error('Error loading playlists:', e);
            return [];
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
        let playlists = this.getPlaylists();
        playlists = playlists.filter(p => p.id !== id);
        this.savePlaylists(playlists);
    },

    renamePlaylist(id, newName) {
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
            if (!playlist.items.some(i => i.id === item.id && i.media_type === item.media_type)) {
                playlist.items.push({
                    id: item.id,
                    title: item.title || item.name,
                    name: item.name || item.title,
                    poster_path: item.poster_path,
                    backdrop_path: item.backdrop_path,
                    media_type: item.media_type || item.type || 'movie', // Default to movie if unknown, but try to get it
                    overview: item.overview,
                    addedAt: Date.now()
                });
                this.savePlaylists(playlists);
                return true;
            }
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
    }
};
