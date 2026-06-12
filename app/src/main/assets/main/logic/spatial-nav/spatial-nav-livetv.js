/**
 * Spatial navigation configuration stub for the Live TV list page.
 */
export const spatialNavLivetv = {
    id: 'livetv',
    /**
     * Determines the next focusable element on the Live TV list page based on direction.
     * Returns null to fall back to the default spatial navigation list algorithm.
     * 
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - The direction of navigation.
     * @returns {HTMLElement|null} The next element to focus, or null.
     */
    findNext: (current, direction) => {
        return null;
    }
};
