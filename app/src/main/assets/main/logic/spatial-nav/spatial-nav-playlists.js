import { SpatialNav } from '../../gui/js/spatial-nav.js';

/**
 * Checks if a DOM element is currently visible, rendered, and not hidden.
 * @param {HTMLElement|null} el - The element to check.
 * @returns {boolean} True if the element is visible.
 */
function isElementVisible(el) {
    if (!el) return false;
    if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;
    if (el.classList.contains('hidden') || el.style.display === 'none' || el.style.visibility === 'hidden') return false;
    return true;
}

/**
 * Retrieves the currently active or first focusable navigation item in the global sidebar.
 * @returns {HTMLElement|null} The target sidebar element.
 */
function getActiveSidebarItem() {
    const sidebar = document.getElementById('sidebar-container');
    if (!sidebar || !isElementVisible(sidebar)) return null;
    const active = sidebar.querySelector('.nav-item.is-active.focusable, .nav-item.active.focusable');
    if (active && isElementVisible(active)) return active;
    const first = sidebar.querySelector('.nav-item.focusable');
    return (first && isElementVisible(first)) ? first : null;
}

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
     * Prefers the 'Create Playlist' button or falls back to the first playlist card.
     * @returns {HTMLElement|null} The initial focus target element.
     */
    getDefaultFocus: () => {
        const createBtn = document.getElementById('create-playlist-btn');
        if (createBtn && isElementVisible(createBtn)) return createBtn;
        const firstCard = document.querySelector('#playlists-grid .card.focusable, #playlists-grid .playlist-card.focusable, #playlists-grid .focusable');
        if (firstCard && isElementVisible(firstCard)) return firstCard;
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
            if (current.id === 'new-playlist-name') {
                if (direction === 'down') {
                    const confirmBtn = document.getElementById('confirm-create-btn');
                    if (confirmBtn && isElementVisible(confirmBtn)) return confirmBtn;
                }
            } else if (current.id === 'confirm-create-btn') {
                if (direction === 'up') {
                    const input = document.getElementById('new-playlist-name');
                    if (input && isElementVisible(input)) return input;
                }
                if (direction === 'down') {
                    const cancelBtn = document.getElementById('cancel-create-btn');
                    if (cancelBtn && isElementVisible(cancelBtn)) return cancelBtn;
                }
            } else if (current.id === 'cancel-create-btn') {
                if (direction === 'up') {
                    const confirmBtn = document.getElementById('confirm-create-btn');
                    if (confirmBtn && isElementVisible(confirmBtn)) return confirmBtn;
                }
            }
            return null;
        }

        // 3. Header Actions: 'Create Playlist' button and optional filter/search controls
        const inHeader = current.closest('.page-header') !== null || current.id === 'create-playlist-btn';
        if (inHeader) {
            const headerActions = Array.from(document.querySelectorAll('.page-header .focusable, #create-playlist-btn.focusable')).filter(isElementVisible);
            const currentIndex = headerActions.indexOf(current);

            if (direction === 'left') {
                if (currentIndex > 0) return headerActions[currentIndex - 1];
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                if (currentIndex >= 0 && currentIndex < headerActions.length - 1) return headerActions[currentIndex + 1];
                return null;
            }
            if (direction === 'down') {
                // Down moves into the playlist cards grid (.media-grid)
                const firstCard = document.querySelector('#playlists-grid .card.focusable, #playlists-grid .playlist-card.focusable, #playlists-grid .focusable');
                if (firstCard && isElementVisible(firstCard)) return firstCard;
                return null;
            }
            if (direction === 'up') {
                return null;
            }
        }

        // 4. Playlist Cards 2D Grid: Left/Right within row, Up/Down across rows
        const inGrid = current.closest('#playlists-grid') !== null || current.classList.contains('playlist-card');
        if (inGrid) {
            if (direction === 'left') {
                const sibling = findRowCardSibling(current, 'left');
                if (sibling) return sibling;
                // Column 0 moving left returns to sidebar rail
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                return findRowCardSibling(current, 'right');
            }
            if (direction === 'up') {
                const above = findAdjacentGridCard(current, 'up');
                if (above) return above;
                // Row 0 moving up returns to header actions
                const headerActions = Array.from(document.querySelectorAll('.page-header .focusable, #create-playlist-btn.focusable')).filter(isElementVisible);
                if (headerActions.length > 0) {
                    const currentCenterX = current.getBoundingClientRect().left + current.getBoundingClientRect().width / 2;
                    let closest = headerActions[0];
                    let minDiff = Infinity;
                    for (const action of headerActions) {
                        const r = action.getBoundingClientRect();
                        const diff = Math.abs((r.left + r.width / 2) - currentCenterX);
                        if (diff < minDiff) {
                            minDiff = diff;
                            closest = action;
                        }
                    }
                    return closest;
                }
                return null;
            }
            if (direction === 'down') {
                return findAdjacentGridCard(current, 'down');
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
            const cancelBtn = document.getElementById('cancel-create-btn');
            if (cancelBtn) {
                cancelBtn.click();
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
