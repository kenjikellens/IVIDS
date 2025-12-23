// Utility for managing recently watched content

const MAX_RECENTLY_WATCHED = 20;

export function addToRecentlyWatched(item) {
    try {
        // Get existing recently watched
        let recentlyWatched = getRecentlyWatched();

        // Remove if already exists (to avoid duplicates)
        recentlyWatched = recentlyWatched.filter(i => !(i.id === item.id && i.media_type === item.media_type));

        // Add to beginning
        recentlyWatched.unshift({
            id: item.id,
            title: item.title || item.name,
            name: item.name || item.title,
            poster_path: item.poster_path,
            backdrop_path: item.backdrop_path,
            media_type: item.media_type || item.type,
            overview: item.overview,
            season: item.season,
            episode: item.episode,
            timestamp: Date.now()
        });

        // Keep only MAX_RECENTLY_WATCHED items
        recentlyWatched = recentlyWatched.slice(0, MAX_RECENTLY_WATCHED);

        // Save to localStorage
        localStorage.setItem('recentlyWatched', JSON.stringify(recentlyWatched));

        console.log('Added to recently watched:', item.title || item.name);
    } catch (e) {
        console.error('Error adding to recently watched:', e);
    }
}

export function getRecentlyWatched() {
    try {
        const stored = localStorage.getItem('recentlyWatched');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error('Error loading recently watched:', e);
        return [];
    }
}

export function getWatchedItem(id, type) {
    const recentlyWatched = getRecentlyWatched();
    return recentlyWatched.find(i => i.id == id && i.media_type == type);
}

export function clearRecentlyWatched() {
    try {
        localStorage.removeItem('recentlyWatched');
        console.log('Recently watched cleared');
    } catch (e) {
        console.error('Error clearing recently watched:', e);
    }
}

export function removeFromRecentlyWatched(id) {
    try {
        let recentlyWatched = getRecentlyWatched();
        recentlyWatched = recentlyWatched.filter(i => i.id != id);
        localStorage.setItem('recentlyWatched', JSON.stringify(recentlyWatched));
        console.log('Removed from recently watched:', id);
    } catch (e) {
        console.error('Error removing from recently watched:', e);
    }
}
