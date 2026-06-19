/**
 * Spatial navigation configuration logic for the Collection Details page.
 * Relies on the default directional distance checks of the spatial nav engine.
 */
export const spatialNavCollectionDetails = {
    id: 'collection-details',
    /**
     * Determines the next focus candidate.
     * @param {HTMLElement} current - Currently focused element.
     * @param {string} direction - Nav direction.
     * @returns {HTMLElement|null} Override element or null to fallback to defaults.
     */
    findNext: (current, direction) => {
        return null;
    }
};
