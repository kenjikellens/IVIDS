/**
 * Spatial Navigation rules for the Live Sports page.
 */
export const spatialNavLivesports = {
    id: 'livesports',
    isCarouselPage: false,

    /**
     * Retrieves the default focus element when loading the Live Sports page.
     * @returns {HTMLElement|null} The first focusable match card or tab button.
     */
    getDefaultFocus: () => {
        return document.querySelector('.livesports-page-layout .focusable') || document.querySelector('#livesports-rows-container .focusable');
    },

    findNext: (current, direction) => {
        return null;
    }
};
