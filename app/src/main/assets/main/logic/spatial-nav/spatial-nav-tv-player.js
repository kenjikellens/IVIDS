/**
 * Spatial navigation configuration stub for the custom TV player page.
 */
export const spatialNavTvPlayer = {
    id: 'tv-player',
    /**
     * Determines the next focusable element on the TV player page based on direction.
     * Returns null to fall back to the default spatial navigation grid algorithm.
     * 
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - The direction of navigation.
     * @returns {HTMLElement|null} The next element to focus, or null.
     */
    findNext: (current, direction) => {
        return null;
    }
};
