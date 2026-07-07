/**
 * Spatial Navigation rules for the Settings page.
 * Manages spatial focus boundaries and provides the initial focus element.
 */
export const spatialNavSettings = {
    id: 'settings',

    /**
     * Retrieves the default focus element when loading the settings page.
     * @returns {HTMLElement|null} The Language Edit button.
     */
    getDefaultFocus: () => document.getElementById('edit-language-btn'),

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
