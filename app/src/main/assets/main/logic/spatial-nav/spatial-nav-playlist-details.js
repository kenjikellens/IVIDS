import {
    getActiveMoveIndex,
    setActiveMoveIndex,
    getPlaylistItemsCount,
    moveItemInActivePlaylist,
    reRenderList
} from '../../gui/pages/playlist-details.js';

/**
 * Spatial navigation configuration object for the Playlist Details page.
 * Intercepts up/down direction navigation to reorder items if Move Mode is active,
 * and cancels Move Mode when moving left/right.
 */
export const spatialNavPlaylistDetails = {
    id: 'playlist-details',
    
    /**
     * Custom findNext override that detects active reordering mode.
     * Swaps playlist items on up/down keys and cancels Move Mode on left/right keys.
     * 
     * @param {HTMLElement} current - Currently focused element.
     * @param {string} direction - Direction of the navigation request ('up', 'down', 'left', 'right').
     * @returns {HTMLElement|null} The next focus element, or null to fallback to default spatial calculations.
     */
    findNext: (current, direction) => {
        const moveIndex = getActiveMoveIndex();
        
        if (moveIndex !== null) {
            // We are in Move Mode
            if (direction === 'up') {
                if (moveIndex > 0) {
                    moveItemInActivePlaylist(moveIndex, moveIndex - 1);
                    setActiveMoveIndex(moveIndex - 1);
                    reRenderList();
                    // Refocus the newly reordered move button
                    setTimeout(() => {
                        const newBtn = document.querySelector(`.playlist-action-btn[data-index="${moveIndex - 1}"]`);
                        if (newBtn) newBtn.focus();
                    }, 10);
                }
                return current;
            } else if (direction === 'down') {
                const total = getPlaylistItemsCount();
                if (moveIndex < total - 1) {
                    moveItemInActivePlaylist(moveIndex, moveIndex + 1);
                    setActiveMoveIndex(moveIndex + 1);
                    reRenderList();
                    // Refocus the newly reordered move button
                    setTimeout(() => {
                        const newBtn = document.querySelector(`.playlist-action-btn[data-index="${moveIndex + 1}"]`);
                        if (newBtn) newBtn.focus();
                    }, 10);
                }
                return current;
            } else if (direction === 'left' || direction === 'right') {
                // Cancel Move Mode and let spatial nav navigate normally
                setActiveMoveIndex(null);
                reRenderList();
                return null;
            }
        }
        
        return null;
    }
};
