import { SpatialNav } from '../../gui/js/spatial-nav.js';

export const spatialNavPlayer = {
    id: 'player',

    /**
     * Scopes D-pad navigation on the player page strictly within the HUD or status panel if either is visible.
     * Prevents focus from leaving the active panel, or blocks navigation entirely when both are hidden.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - The direction of D-pad navigation.
     * @returns {HTMLElement|null} The next focus target, or current element to block movement.
     */
    findNext(current, direction) {
        const playerHud = document.getElementById('player-hud');
        const isHudVisible = playerHud && playerHud.classList.contains('visible') && playerHud.style.display !== 'none';

        const statusPanel = document.getElementById('player-status-panel');
        const isStatusVisible = statusPanel && statusPanel.style.display !== 'none';

        let targetContainer = null;
        if (isStatusVisible) {
            targetContainer = statusPanel;
        } else if (isHudVisible) {
            targetContainer = playerHud;
        }

        if (!targetContainer) {
            return current;
        }

        const prevLogic = SpatialNav.currentPageLogic;
        const prevTrap = SpatialNav.focusTrapContainer;

        SpatialNav.currentPageLogic = null;
        SpatialNav.focusTrapContainer = targetContainer;

        try {
            const next = SpatialNav.findNext(current, direction);
            return next || current;
        } finally {
            SpatialNav.currentPageLogic = prevLogic;
            SpatialNav.focusTrapContainer = prevTrap;
        }
    },

    /**
     * Provides the default element to focus when the player page loads or needs refocusing.
     * Selects appropriate buttons within the HUD or status panel if they are visible.
     * @returns {HTMLElement|null} The default focusable element, or null if HUD is hidden.
     */
    getDefaultFocus() {
        const statusPanel = document.getElementById('player-status-panel');
        if (statusPanel && statusPanel.style.display !== 'none') {
            return document.getElementById('player-status-back');
        }

        const playerHud = document.getElementById('player-hud');
        const isHudVisible = playerHud && playerHud.classList.contains('visible') && playerHud.style.display !== 'none';
        if (isHudVisible) {
            const activeServer = playerHud.querySelector('.server-btn.active');
            if (activeServer && SpatialNav.isVisible(activeServer)) {
                return activeServer;
            }
            const backBtn = document.getElementById('player-back');
            if (backBtn && SpatialNav.isVisible(backBtn)) {
                return backBtn;
            }
        }
        return null;
    }
};
