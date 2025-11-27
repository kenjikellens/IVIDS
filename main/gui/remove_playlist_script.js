// This script is intended to be run in the browser console to remove the specific playlist.
const STORAGE_KEY = 'user_playlists';
try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        let playlists = JSON.parse(stored);
        const initialCount = playlists.length;

        // Filter out playlists created in 2023 (checking createdAt timestamp)
        // 2023 timestamps are between 1672531200000 and 1704067199999
        playlists = playlists.filter(p => {
            const date = new Date(p.createdAt);
            const year = date.getFullYear();
            if (year === 2023 && !p.isSystem) {
                console.log(`Removing playlist: ${p.name} (ID: ${p.id})`);
                return false;
            }
            return true;
        });

        if (playlists.length < initialCount) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
            console.log('Playlist removed successfully. Please refresh the page.');
            alert('Playlist removed. Please refresh the page.');
        } else {
            console.log('No custom playlist from 2023 found.');
            alert('No custom playlist from 2023 found.');
        }
    }
} catch (e) {
    console.error('Error removing playlist:', e);
}
