import { SpatialNav } from '../../gui/js/spatial-nav.js';
import { Router } from '../../gui/js/router.js';
import { isElementVisible, getActiveSidebarItem } from './spatial-nav-helpers.js';

/**
 * Returns the live mounted Playlist Details controller bridge, avoiding ES module cache-buster splits.
 * @returns {object|null} Live playlist-details controller methods.
 */
function getPageController() {
    return window.__ividsPlaylistDetails || null;
}

/**
 * Resolves the primary focusable top-bar control (Options button or Back button).
 *
 * @returns {HTMLElement|null} The target top-bar button.
 */
function getPrimaryActionBtn() {
    const optionsBtn = document.getElementById('playlist-options-btn');
    if (optionsBtn && isElementVisible(optionsBtn)) return optionsBtn;
    const backBtn = document.getElementById('back-btn');
    return (backBtn && isElementVisible(backBtn)) ? backBtn : null;
}

/**
 * Spatial navigation configuration object for the Playlist Details page.
 * Manages D-pad routing across top bar, options sidebar, vertical playlist items, Move Mode reordering, and modals.
 */
export const spatialNavPlaylistDetails = {
    id: 'playlist-details',

    /**
     * Retrieves the default focus element when loading the Playlist Details page.
     * Prefers the first item in the playlist, otherwise the top-right Options button or Back button.
     * @returns {HTMLElement|null} The initial focus target element.
     */
    getDefaultFocus: () => {
        const firstItem = document.querySelector('#playlist-items-container .card--poster.focusable, #playlist-items-container .focusable');
        if (firstItem && isElementVisible(firstItem)) return firstItem;
        const playAllBtn = document.getElementById('play-all-btn');
        if (playAllBtn && isElementVisible(playAllBtn)) return playAllBtn;
        const optionsBtn = document.getElementById('playlist-options-btn');
        if (optionsBtn && isElementVisible(optionsBtn)) return optionsBtn;
        const backBtn = document.getElementById('back-btn');
        if (backBtn && isElementVisible(backBtn)) return backBtn;
        return null;
    },

    /**
     * Custom findNext override for Playlist Details.
     * Intercepts up/down direction navigation to reorder items if Move Mode is active,
     * routes action row buttons, item cards, and row action controls.
     * 
     * @param {HTMLElement} current - Currently focused element.
     * @param {string} direction - Direction of the navigation request ('up', 'down', 'left', 'right').
     * @returns {HTMLElement|null} The next focus element, or null to fallback to default spatial calculations.
     */
    findNext: (current, direction) => {
        if (!current) return null;

        // 0. Modal Focus Trap: Keep D-pad navigation inside active (open) modals only
        const activeModal = current.closest('#confirmation-modal.is-open, #edit-playlist-modal.is-open, #item-context-modal.is-open, #add-to-other-playlist-modal.is-open');
        if (activeModal) {
            const modalFocusables = Array.from(activeModal.querySelectorAll('.focusable')).filter(isElementVisible);
            const idx = modalFocusables.indexOf(current);
            if (direction === 'up') {
                return idx > 0 ? modalFocusables[idx - 1] : modalFocusables[0] || current;
            }
            if (direction === 'down') {
                return (idx >= 0 && idx < modalFocusables.length - 1) ? modalFocusables[idx + 1] : modalFocusables[modalFocusables.length - 1] || current;
            }
            return current;
        }

        // 0b. Options Sidebar Focus Trap (reuses tv-settings-panel pattern)
        const optionsPanel = document.getElementById('playlist-options-panel');
        if (optionsPanel && isElementVisible(optionsPanel)) {
            const closeBtn = document.getElementById('playlist-options-close');
            const optBtns = Array.from(optionsPanel.querySelectorAll('.tv-opt-btn.focusable')).filter(isElementVisible);
            const sidebarItems = (closeBtn && isElementVisible(closeBtn)) ? [closeBtn, ...optBtns] : optBtns;
            const idx = sidebarItems.indexOf(current);
            if (direction === 'up') {
                return idx > 0 ? sidebarItems[idx - 1] : (sidebarItems[0] || current);
            }
            if (direction === 'down') {
                return (idx >= 0 && idx < sidebarItems.length - 1) ? sidebarItems[idx + 1] : (sidebarItems[sidebarItems.length - 1] || current);
            }
            if (direction === 'left') {
                getPageController()?.navigatePlaylistOptionsBack();
                return document.querySelector('.focused') || document.getElementById('playlist-options-btn') || current;
            }
            return current;
        }

        // 1. Move Mode: Active 2D Poster Reordering Interception
        const ctrl = getPageController();
        const moveIndex = ctrl ? ctrl.getActiveMoveIndex() : null;
        if (moveIndex !== null) {
            const total = ctrl.getPlaylistItemsCount();
            const tiles = Array.from(document.querySelectorAll('#playlist-items-container .playlist-poster-tile'));
            let targetIndex = moveIndex;
            if (direction === 'left' && moveIndex > 0) {
                targetIndex = moveIndex - 1;
            } else if (direction === 'right' && moveIndex < total - 1) {
                targetIndex = moveIndex + 1;
            } else if ((direction === 'up' || direction === 'down') && tiles.length > 0) {
                const firstRowTop = tiles[0].getBoundingClientRect().top;
                const rowCols = Math.max(1, tiles.filter(t => Math.abs(t.getBoundingClientRect().top - firstRowTop) < 25).length);
                if (direction === 'up') {
                    const candidate = moveIndex - rowCols;
                    if (candidate >= 0) targetIndex = candidate;
                } else {
                    const candidate = moveIndex + rowCols;
                    if (candidate < total) {
                        targetIndex = candidate;
                    } else if (Math.floor(moveIndex / rowCols) < Math.floor((total - 1) / rowCols)) {
                        targetIndex = total - 1;
                    }
                }
            }
            if (targetIndex !== moveIndex) {
                const movedPoster = ctrl.moveTileInDom(moveIndex, targetIndex);
                if (movedPoster) return movedPoster;
            }
            return current;
        }

        // 2. Sidebar Boundary: Returning into Details page content (Right from desktop sidebar, Up from mobile bottom nav)
        const inSidebar = current.closest('#sidebar-container') !== null;
        if (inSidebar) {
            const isMobileBottom = SpatialNav.isPortrait && SpatialNav.isPortrait();
            const shouldEnter = isMobileBottom ? (direction === 'up') : (direction === 'right');
            if (shouldEnter) {
                if (SpatialNav.lastFocusedElement && document.getElementById('main-view')?.contains(SpatialNav.lastFocusedElement) && isElementVisible(SpatialNav.lastFocusedElement)) {
                    return SpatialNav.lastFocusedElement;
                }
                return spatialNavPlaylistDetails.getDefaultFocus();
            }
            return null;
        }

        // 2b. Header Row: Back Button <-> Play All <-> Options Button
        if (current.id === 'back-btn') {
            if (direction === 'right') {
                const playAllBtn = document.getElementById('play-all-btn');
                if (playAllBtn && isElementVisible(playAllBtn)) return playAllBtn;
                const optionsBtn = document.getElementById('playlist-options-btn');
                if (optionsBtn && isElementVisible(optionsBtn)) return optionsBtn;
                return null;
            }
            if (direction === 'down') {
                const firstItem = document.querySelector('#playlist-items-container .episode-item.focusable, #playlist-items-container .focusable');
                if (firstItem && isElementVisible(firstItem)) return firstItem;
                return null;
            }
            if (direction === 'left') {
                return getActiveSidebarItem();
            }
            return null;
        }

        if (current.id === 'play-all-btn') {
            if (direction === 'left') {
                const backBtn = document.getElementById('back-btn');
                if (backBtn && isElementVisible(backBtn)) return backBtn;
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                const optionsBtn = document.getElementById('playlist-options-btn');
                if (optionsBtn && isElementVisible(optionsBtn)) return optionsBtn;
                return null;
            }
            if (direction === 'down') {
                const firstItem = document.querySelector('#playlist-items-container .episode-item.focusable, #playlist-items-container .focusable');
                if (firstItem && isElementVisible(firstItem)) return firstItem;
                return null;
            }
            return null;
        }

        if (current.id === 'playlist-options-btn') {
            if (direction === 'left') {
                const playAllBtn = document.getElementById('play-all-btn');
                if (playAllBtn && isElementVisible(playAllBtn)) return playAllBtn;
                const backBtn = document.getElementById('back-btn');
                if (backBtn && isElementVisible(backBtn)) return backBtn;
                return getActiveSidebarItem();
            }
            if (direction === 'down') {
                const firstItem = document.querySelector('#playlist-items-container .episode-item.focusable, #playlist-items-container .focusable');
                if (firstItem && isElementVisible(firstItem)) return firstItem;
                return null;
            }
            return null;
        }

        // 4. Poster Grid Card: 2D D-pad navigation across .card--poster tiles
        const inPosterCard = current.classList.contains('card--poster') && current.closest('#playlist-items-container') !== null;
        if (inPosterCard) {
            const allCards = Array.from(document.querySelectorAll('#playlist-items-container .card--poster.focusable')).filter(isElementVisible);
            const curRect = current.getBoundingClientRect();
            const curCenterX = curRect.left + curRect.width / 2;
            const sameRow = allCards.filter(c => Math.abs(c.getBoundingClientRect().top - curRect.top) < 25)
                .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
            const colIdx = sameRow.indexOf(current);

            if (direction === 'left') {
                if (colIdx > 0) return sameRow[colIdx - 1];
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                if (colIdx >= 0 && colIdx < sameRow.length - 1) return sameRow[colIdx + 1];
                return current;
            }
            if (direction === 'up') {
                const above = allCards.filter(c => c.getBoundingClientRect().top < curRect.top - 15);
                if (above.length === 0) {
                    const playAllBtn = document.getElementById('play-all-btn');
                    if (playAllBtn && isElementVisible(playAllBtn)) return playAllBtn;
                    const backBtn = document.getElementById('back-btn');
                    return (backBtn && isElementVisible(backBtn)) ? backBtn : getPrimaryActionBtn();
                }
                const maxTop = Math.max(...above.map(c => c.getBoundingClientRect().top));
                const rowAbove = above.filter(c => Math.abs(c.getBoundingClientRect().top - maxTop) < 25);
                return rowAbove.reduce((best, c) => {
                    const d = Math.abs((c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2) - curCenterX);
                    return (!best || d < best.d) ? { el: c, d } : best;
                }, null)?.el || current;
            }
            if (direction === 'down') {
                const tile = current.closest('.playlist-poster-tile');
                const settingsBtn = tile?.querySelector('.playlist-poster-settings-btn.focusable');
                if (settingsBtn && isElementVisible(settingsBtn)) return settingsBtn;
                const below = allCards.filter(c => c.getBoundingClientRect().top > curRect.top + 15);
                if (below.length === 0) return current;
                const minTop = Math.min(...below.map(c => c.getBoundingClientRect().top));
                const rowBelow = below.filter(c => Math.abs(c.getBoundingClientRect().top - minTop) < 25);
                return rowBelow.reduce((best, c) => {
                    const d = Math.abs((c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2) - curCenterX);
                    return (!best || d < best.d) ? { el: c, d } : best;
                }, null)?.el || current;
            }
        }

        // 5. Dwell-Revealed Settings Button Below Poster Tile
        if (current.classList.contains('playlist-poster-settings-btn')) {
            const tile = current.closest('.playlist-poster-tile');
            const ownPoster = tile?.querySelector('.card--poster.focusable');
            if (direction === 'up') {
                return (ownPoster && isElementVisible(ownPoster)) ? ownPoster : current;
            }
            const allCards = Array.from(document.querySelectorAll('#playlist-items-container .card--poster.focusable')).filter(isElementVisible);
            const refRect = (ownPoster || current).getBoundingClientRect();
            const refCenterX = refRect.left + refRect.width / 2;
            const sameRow = allCards.filter(c => Math.abs(c.getBoundingClientRect().top - refRect.top) < 25)
                .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
            const colIdx = ownPoster ? sameRow.indexOf(ownPoster) : -1;

            if (direction === 'left') {
                if (colIdx > 0) return sameRow[colIdx - 1];
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                if (colIdx >= 0 && colIdx < sameRow.length - 1) return sameRow[colIdx + 1];
                return current;
            }
            if (direction === 'down') {
                const below = allCards.filter(c => c.getBoundingClientRect().top > refRect.top + 15);
                if (below.length === 0) return current;
                const minTop = Math.min(...below.map(c => c.getBoundingClientRect().top));
                const rowBelow = below.filter(c => Math.abs(c.getBoundingClientRect().top - minTop) < 25);
                return rowBelow.reduce((best, c) => {
                    const d = Math.abs((c.getBoundingClientRect().left + c.getBoundingClientRect().width / 2) - refCenterX);
                    return (!best || d < best.d) ? { el: c, d } : best;
                }, null)?.el || current;
            }
            return current;
        }

        // 6. Empty State Button
        if (current.id === 'empty-browse-btn') {
            if (direction === 'up') {
                return getPrimaryActionBtn() || document.getElementById('back-btn');
            }
            if (direction === 'left') {
                return getActiveSidebarItem();
            }
            return null;
        }

        return null;
    },

    /**
     * Handles Back key press on the Playlist Details page.
     * Cancels Move Mode if active, dismisses open confirmation/edit modals, or navigates back to Playlists.
     * @returns {boolean} True if the back event was handled.
     */
    handleBack: () => {
        const ctrl = getPageController();

        // 1. Cancel Move Mode if active
        if (ctrl && ctrl.getActiveMoveIndex() !== null) {
            ctrl.exitMoveMode();
            return true;
        }

        // 2. Close/Step Back Options Sidebar if open
        const optionsPanel = document.getElementById('playlist-options-panel');
        if (optionsPanel && isElementVisible(optionsPanel)) {
            ctrl?.navigatePlaylistOptionsBack();
            return true;
        }

        // 3. Dismiss any open modal
        const openModal = document.querySelector('.modal.is-open, .modal.active, .modal[style*="display: flex"], .modal[style*="display: block"]');
        if (openModal && isElementVisible(openModal)) {
            const cancelBtn = openModal.querySelector('#modal-cancel-btn, #edit-playlist-cancel-btn, #context-cancel-btn, #context-back-btn, #other-playlist-back-btn, .modal__back-btn, .btn--secondary:not(#edit-playlist-confirm-btn)');
            if (cancelBtn) {
                cancelBtn.click();
                return true;
            }
            openModal.classList.remove('is-open', 'active', 'show');
            return true;
        }

        // 3. Navigate back to Playlists overview
        Router.goBack('playlists');
        return true;
    }
};