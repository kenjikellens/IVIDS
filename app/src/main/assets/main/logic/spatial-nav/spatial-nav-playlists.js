import { SpatialNav } from '../../gui/js/spatial-nav.js';
import { isElementVisible, getActiveSidebarItem } from './spatial-nav-helpers.js';

/**
 * Resolves the adjacent playlist card to the left or right within the same grid row.
 * @param {HTMLElement} current - The currently focused playlist card.
 * @param {string} direction - 'left' or 'right'.
 * @returns {HTMLElement|null} The next card in row, or null if at row boundary.
 */
function findRowCardSibling(current, direction) {
    const grid = document.getElementById('playlists-grid');
    if (!grid) return null;
    const cards = Array.from(grid.querySelectorAll('.card.focusable, .playlist-card.focusable')).filter(isElementVisible);
    const currentRect = current.getBoundingClientRect();
    const rowCards = cards.filter(c => Math.abs(c.getBoundingClientRect().top - currentRect.top) < 25);
    rowCards.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

    const colIndex = rowCards.indexOf(current);
    if (colIndex === -1) return null;

    if (direction === 'left') {
        return colIndex > 0 ? rowCards[colIndex - 1] : null;
    } else if (direction === 'right') {
        return colIndex < rowCards.length - 1 ? rowCards[colIndex + 1] : null;
    }
    return null;
}

/**
 * Finds the closest focusable playlist card in an adjacent grid row (above or below).
 * Works across responsive multi-column grid layouts.
 * @param {HTMLElement} current - The currently focused playlist card.
 * @param {string} direction - 'up' or 'down'.
 * @returns {HTMLElement|null} The target card in the adjacent row, or null if no row exists in that direction.
 */
function findAdjacentGridCard(current, direction) {
    const grid = document.getElementById('playlists-grid');
    if (!grid) return null;
    const cards = Array.from(grid.querySelectorAll('.card.focusable, .playlist-card.focusable')).filter(isElementVisible);
    if (cards.length === 0) return null;

    const currentRect = current.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;

    if (direction === 'down') {
        const cardsBelow = cards.filter(c => c.getBoundingClientRect().top > currentRect.top + 15);
        if (cardsBelow.length === 0) return null;
        const minTopBelow = Math.min(...cardsBelow.map(c => c.getBoundingClientRect().top));
        const rowBelow = cardsBelow.filter(c => Math.abs(c.getBoundingClientRect().top - minTopBelow) < 25);

        let closest = null;
        let minDiff = Infinity;
        for (const card of rowBelow) {
            const rect = card.getBoundingClientRect();
            const diff = Math.abs((rect.left + rect.width / 2) - currentCenterX);
            if (diff < minDiff) {
                minDiff = diff;
                closest = card;
            }
        }
        return closest;
    } else if (direction === 'up') {
        const cardsAbove = cards.filter(c => c.getBoundingClientRect().top < currentRect.top - 15);
        if (cardsAbove.length === 0) return null;
        const maxTopAbove = Math.max(...cardsAbove.map(c => c.getBoundingClientRect().top));
        const rowAbove = cardsAbove.filter(c => Math.abs(c.getBoundingClientRect().top - maxTopAbove) < 25);

        let closest = null;
        let minDiff = Infinity;
        for (const card of rowAbove) {
            const rect = card.getBoundingClientRect();
            const diff = Math.abs((rect.left + rect.width / 2) - currentCenterX);
            if (diff < minDiff) {
                minDiff = diff;
                closest = card;
            }
        }
        return closest;
    }
    return null;
}

/**
 * Spatial Navigation rules for the Playlists overview page.
 * Coordinates 2D grid card navigation, header action traversal, and sidebar rail boundaries.
 */
export const spatialNavPlaylists = {
    id: 'playlists',

    /**
     * Retrieves the default focus element when loading the playlists page.
     * Prefers the first playlist card, falling back to the empty-state CTA or header Create button.
     * @returns {HTMLElement|null} The initial focus target element.
     */
    getDefaultFocus: () => {
        const firstCard = document.querySelector('#playlists-grid .card.focusable, #playlists-grid .playlist-card.focusable, #playlists-grid .focusable');
        if (firstCard && isElementVisible(firstCard)) return firstCard;
        const emptyCreateBtn = document.getElementById('empty-create-playlist-btn');
        if (emptyCreateBtn && isElementVisible(emptyCreateBtn)) return emptyCreateBtn;
        const createBtn = document.getElementById('create-playlist-btn');
        if (createBtn && isElementVisible(createBtn)) return createBtn;
        return null;
    },

    /**
     * Calculates custom next focus node across header actions, 2D playlist cards grid, and sidebar.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
     * @returns {HTMLElement|null} The targeted element, or null to trigger default search.
     */
    findNext: (current, direction) => {
        if (!current) return null;

        // 1. Sidebar Boundary: Returning into Playlists content (Right from desktop sidebar, Up from mobile bottom nav)
        const inSidebar = current.closest('#sidebar-container') !== null;
        if (inSidebar) {
            const isMobileBottom = SpatialNav.isPortrait && SpatialNav.isPortrait();
            const shouldEnter = isMobileBottom ? (direction === 'up') : (direction === 'right');
            if (shouldEnter) {
                if (SpatialNav.lastFocusedElement && document.getElementById('main-view')?.contains(SpatialNav.lastFocusedElement) && isElementVisible(SpatialNav.lastFocusedElement)) {
                    return SpatialNav.lastFocusedElement;
                }
                return spatialNavPlaylists.getDefaultFocus();
            }
            return null;
        }

        // 2. Modal Focus Trap / Dialog Navigation: Create Playlist Dialog
        const inCreateModal = current.closest('#create-playlist-modal') !== null;
        if (inCreateModal) {
            const backBtn = document.getElementById('create-playlist-back-btn');
            const input = document.getElementById('new-playlist-name');
            const confirmBtn = document.getElementById('confirm-create-btn');

            if (current.id === 'create-playlist-back-btn') {
                if (direction === 'down' && input && isElementVisible(input)) return input;
                return current;
            }
            if (current.id === 'new-playlist-name') {
                if (direction === 'up' && backBtn && isElementVisible(backBtn)) return backBtn;
                if (direction === 'down' && confirmBtn && isElementVisible(confirmBtn)) return confirmBtn;
                return current;
            }
            if (current.id === 'confirm-create-btn') {
                if (direction === 'up' && input && isElementVisible(input)) return input;
                return current;
            }
            return current;
        }

        // 3. Header Actions: 'Create Playlist' button
        const inHeader = current.closest('.page-header') !== null || current.id === 'create-playlist-btn';
        if (inHeader) {
            const headerActions = Array.from(document.querySelectorAll('.page-header .focusable, #create-playlist-btn.focusable')).filter(isElementVisible);
            const currentIndex = headerActions.indexOf(current);

            if (direction === 'left') {
                if (currentIndex > 0) return headerActions[currentIndex - 1];
                return getActiveSidebarItem() || current;
            }
            if (direction === 'right') {
                if (currentIndex >= 0 && currentIndex < headerActions.length - 1) return headerActions[currentIndex + 1];
                return current;
            }
            if (direction === 'down') {
                const firstCard = document.querySelector('#playlists-grid .card.focusable, #playlists-grid .playlist-card.focusable, #playlists-grid .focusable');
                if (firstCard && isElementVisible(firstCard)) return firstCard;
                return current;
            }
            if (direction === 'up') {
                return current;
            }
        }

        // 4. Playlist Cards Vertical List: Left -> Sidebar, Up/Down between cards, Portrait bottom -> Bottom Nav
        const inGrid = current.closest('#playlists-grid') !== null || current.classList.contains('playlist-card');
        if (inGrid) {
            if (direction === 'left') {
                const sibling = findRowCardSibling(current, 'left');
                if (sibling) return sibling;
                return getActiveSidebarItem() || current;
            }
            if (direction === 'right') {
                return findRowCardSibling(current, 'right') || current;
            }
            if (direction === 'up') {
                const above = findAdjacentGridCard(current, 'up');
                if (above) return above;
                const headerActions = Array.from(document.querySelectorAll('.page-header .focusable, #create-playlist-btn.focusable')).filter(isElementVisible);
                if (headerActions.length > 0) {
                    return headerActions[headerActions.length - 1];
                }
                return current;
            }
            if (direction === 'down') {
                const below = findAdjacentGridCard(current, 'down');
                if (below) return below;
                if (SpatialNav.isPortrait && SpatialNav.isPortrait()) {
                    return getActiveSidebarItem() || current;
                }
                return current;
            }
        }

        return null;
    },

    /**
     * Handles Back key press on the Playlists page.
     * Dismisses the creation modal if open, or shifts focus to sidebar if in content.
     * @returns {boolean} True if the back event was handled.
     */
    handleBack: () => {
        const modal = document.getElementById('create-playlist-modal');
        if (modal && isElementVisible(modal)) {
            const backBtn = document.getElementById('create-playlist-back-btn');
            if (backBtn) {
                backBtn.click();
                return true;
            }
        }
        const current = document.querySelector('.focused') || document.activeElement;
        if (current && !current.closest('#sidebar-container')) {
            const sidebar = getActiveSidebarItem();
            if (sidebar) {
                SpatialNav.setFocus(sidebar);
                return true;
            }
        }
        return false;
    }
};
