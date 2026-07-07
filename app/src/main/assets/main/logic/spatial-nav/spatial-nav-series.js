/**
 * Spatial Navigation rules for the Series page.
 * Sets the default entry focus to the play button and configures carousel centering flags.
 */
export const spatialNavSeries = {
    id: 'series',
    isCarouselPage: true,

    /**
     * Retrieves the default focus element when loading the Series page.
     * @returns {HTMLElement|null} The Hero Play button.
     */
    getDefaultFocus: () => document.getElementById('play-btn'),

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
