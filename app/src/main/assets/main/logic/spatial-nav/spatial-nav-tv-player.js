import { SpatialNav } from '../../gui/js/spatial-nav.js';

export const spatialNavTvPlayer = {
    id: 'tv-player',

    /**
     * Scopes D-pad navigation on the TV player page strictly within the controls overlay when shown.
     * Prevents focus from leaving the overlay, or blocks focus navigation completely when overlay is hidden.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - The direction of D-pad navigation.
     * @returns {HTMLElement|null} The next element to focus, or current element to block movement.
     */
    findNext(current, direction) {
        const overlay = document.getElementById('tv-overlay');
        const isOverlayVisible = overlay && overlay.classList.contains('show');

        if (!isOverlayVisible) {
            return current;
        }

        const prevLogic = SpatialNav.currentPageLogic;
        const prevTrap = SpatialNav.focusTrapContainer;

        SpatialNav.currentPageLogic = null;
        SpatialNav.focusTrapContainer = overlay;

        try {
            const next = SpatialNav.findNext(current, direction);
            return next || current;
        } finally {
            SpatialNav.currentPageLogic = prevLogic;
            SpatialNav.focusTrapContainer = prevTrap;
        }
    },

    /**
     * Provides the default element to focus when the TV player page loads or overlays are toggled.
     * Returns the play/pause button if the overlay is visible, or null if hidden.
     * @returns {HTMLElement|null} The default focus target element.
     */
    getDefaultFocus() {
        const overlay = document.getElementById('tv-overlay');
        const isOverlayVisible = overlay && overlay.classList.contains('show');

        if (isOverlayVisible) {
            const playPauseBtn = document.getElementById('tv-play-pause');
            if (playPauseBtn && SpatialNav.isVisible(playPauseBtn)) {
                return playPauseBtn;
            }
        }
        return null;
    }
};
