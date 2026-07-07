/**
 * Spatial Navigation rules for the Playlists page.
 * Manages spatial focus boundaries and provides the initial focus element.
 */
export const spatialNavPlaylists = {
    id: 'playlists',

    /**
     * Retrieves the default focus element when loading the playlists page.
     * @returns {HTMLElement|null} The Create Playlist button.
     */
    getDefaultFocus: () => {
        return document.getElementById('create-playlist-btn') || document.querySelector('#playlists-grid .focusable');
    },

    /**
     * Calculates custom next focus node if proximity scoring is insufficient.
     * Falls back to standard proximity navigation by returning null.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
     * @returns {HTMLElement|null} The targeted element, or null to trigger default search.
     */
    findNext: (current, direction) => {
        return null;
    }
};
