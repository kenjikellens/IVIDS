/**
 * Spatial Navigation rules for the Details page.
 * Sets default focus to the primary Play action and delegates layout flow to standard calculations.
 */
export const spatialNavDetails = {
    id: 'details',

    /**
     * Retrieves the default focus element when loading the details page.
     * @returns {HTMLElement|null} The Details Play button.
     */
    getDefaultFocus: () => document.getElementById('details-play'),

    /**
     * Calculates custom next focus node. Delegates to standard proximity navigation by returning null.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigating direction.
     * @returns {HTMLElement|null} Null to trigger default search.
     */
    findNext: (current, direction) => {
        return null;
    }
};
