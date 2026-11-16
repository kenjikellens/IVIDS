import { SpatialNav } from '../../gui/js/spatial-nav.js';
import { Router } from '../../gui/js/router.js';
import {
    getActiveMoveIndex,
    setActiveMoveIndex,
    getPlaylistItemsCount,
    moveItemInActivePlaylist,
    reRenderList
} from '../../gui/pages/playlist-details.js';

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
 * Resolves the primary focusable action button inside the details action header row.
 * Prefers 'Play All' or falls back to the first visible action button.
 * @returns {HTMLElement|null} The target action button.
 */
function getPrimaryActionBtn() {
    const playAll = document.getElementById('play-all-btn');
    if (playAll && isElementVisible(playAll)) return playAll;
    const actions = Array.from(document.querySelectorAll('.details-actions .btn.focusable')).filter(isElementVisible);
    return actions.length > 0 ? actions[0] : null;
}

/**
 * Spatial navigation configuration object for the Playlist Details page.
 * Manages D-pad routing across hero actions, vertical playlist items, Move Mode reordering, and modals.
 */
export const spatialNavPlaylistDetails = {
    id: 'playlist-details',

    /**
     * Retrieves the default focus element when loading the Playlist Details page.
     * Prefers the 'Play All' button or the first track/media item.
     * @returns {HTMLElement|null} The initial focus target element.
     */
    getDefaultFocus: () => {
        const playAll = document.getElementById('play-all-btn');
        if (playAll && isElementVisible(playAll)) return playAll;
        const firstItem = document.querySelector('#playlist-items-container .episode-item.focusable, #playlist-items-container .focusable');
        if (firstItem && isElementVisible(firstItem)) return firstItem;
        const actions = Array.from(document.querySelectorAll('.details-actions .btn.focusable')).filter(isElementVisible);
        if (actions.length > 0) return actions[0];
        const emptyBtn = document.getElementById('empty-browse-btn');
        if (emptyBtn && isElementVisible(emptyBtn)) return emptyBtn;
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

        // 1. Move Mode: Active Item Reordering Interception
        const moveIndex = getActiveMoveIndex();
        if (moveIndex !== null) {
            if (direction === 'up') {
                if (moveIndex > 0) {
                    moveItemInActivePlaylist(moveIndex, moveIndex - 1);
                    setActiveMoveIndex(moveIndex - 1);
                    reRenderList();
                    setTimeout(() => {
                        const newBtn = document.querySelector(`.playlist-action-btn[data-index="${moveIndex - 1}"]`);
                        if (newBtn) newBtn.focus();
                    }, 10);
                }
                return current;
            } else if (direction === 'down') {
                const total = getPlaylistItemsCount();
                if (moveIndex < total - 1) {
                    moveItemInActivePlaylist(moveIndex, moveIndex + 1);
                    setActiveMoveIndex(moveIndex + 1);
                    reRenderList();
                    setTimeout(() => {
                        const newBtn = document.querySelector(`.playlist-action-btn[data-index="${moveIndex + 1}"]`);
                        if (newBtn) newBtn.focus();
                    }, 10);
                }
                return current;
            } else if (direction === 'left' || direction === 'right') {
                // Cancel Move Mode and let spatial nav navigate normally
                setActiveMoveIndex(null);
                reRenderList();
                return null;
            }
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

        // 3. Action Row: Play All, Edit Info, Back, Clear History, Delete Playlist
        const inActions = current.closest('.details-actions') !== null;
        if (inActions) {
            const actions = Array.from(document.querySelectorAll('.details-actions .btn.focusable')).filter(isElementVisible);
            const currentIndex = actions.indexOf(current);

            if (direction === 'left') {
                if (currentIndex > 0) return actions[currentIndex - 1];
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                if (currentIndex >= 0 && currentIndex < actions.length - 1) return actions[currentIndex + 1];
                return null;
            }
            if (direction === 'up') {
                return null;
            }
            if (direction === 'down') {
                // Moving down enters the playlist items list
                const firstItem = document.querySelector('#playlist-items-container .episode-item.focusable, #playlist-items-container .focusable');
                if (firstItem && isElementVisible(firstItem)) return firstItem;
                const browseBtn = document.getElementById('empty-browse-btn');
                if (browseBtn && isElementVisible(browseBtn)) return browseBtn;
                return null;
            }
        }

        // 4. Media Item Card: Focusable item card in playlist item row
        const inItemCard = current.classList.contains('episode-item') || current.closest('.playlist-item-card-wrapper') !== null;
        if (inItemCard) {
            const row = current.closest('.playlist-item-row');
            const allCards = Array.from(document.querySelectorAll('#playlist-items-container .episode-item.focusable')).filter(isElementVisible);
            const cardIndex = allCards.indexOf(current);

            if (direction === 'right') {
                // Right into row action buttons (Move or Delete)
                if (row) {
                    const moveBtn = row.querySelector('.playlist-action-btn.focusable');
                    if (moveBtn && isElementVisible(moveBtn)) return moveBtn;
                    const deleteBtn = row.querySelector('.playlist-item-actions button:last-child.focusable, .playlist-item-actions .btn--circle.focusable');
                    if (deleteBtn && isElementVisible(deleteBtn)) return deleteBtn;
                }
                return null;
            }
            if (direction === 'left') {
                // Moving left goes to sidebar navigation rail
                return getActiveSidebarItem();
            }
            if (direction === 'up') {
                // Moving up from first item returns to action row
                if (cardIndex === 0) {
                    return getPrimaryActionBtn();
                }
                if (cardIndex > 0) return allCards[cardIndex - 1];
                return getPrimaryActionBtn();
            }
            if (direction === 'down') {
                if (cardIndex >= 0 && cardIndex < allCards.length - 1) return allCards[cardIndex + 1];
                return null;
            }
        }

        // 5. Item Row Action Buttons: Move Button and Delete Button
        const inItemActions = current.closest('.playlist-item-actions') !== null;
        if (inItemActions) {
            const row = current.closest('.playlist-item-row');
            const isMoveBtn = current.classList.contains('playlist-action-btn');
            const allRows = Array.from(document.querySelectorAll('#playlist-items-container .playlist-item-row')).filter(isElementVisible);
            const rowIndex = allRows.indexOf(row);

            if (isMoveBtn) {
                if (direction === 'left') {
                    const card = row?.querySelector('.episode-item.focusable');
                    if (card && isElementVisible(card)) return card;
                    return getActiveSidebarItem();
                }
                if (direction === 'right') {
                    // Right into delete icon if present
                    const deleteBtn = row?.querySelector('.playlist-item-actions button:last-child.focusable');
                    if (deleteBtn && deleteBtn !== current && isElementVisible(deleteBtn)) return deleteBtn;
                    return null;
                }
                if (direction === 'up') {
                    if (rowIndex === 0) return getPrimaryActionBtn();
                    if (rowIndex > 0) {
                        const prevMove = allRows[rowIndex - 1].querySelector('.playlist-action-btn.focusable');
                        if (prevMove && isElementVisible(prevMove)) return prevMove;
                        const prevCard = allRows[rowIndex - 1].querySelector('.episode-item.focusable');
                        if (prevCard && isElementVisible(prevCard)) return prevCard;
                    }
                    return getPrimaryActionBtn();
                }
                if (direction === 'down') {
                    if (rowIndex >= 0 && rowIndex < allRows.length - 1) {
                        const nextMove = allRows[rowIndex + 1].querySelector('.playlist-action-btn.focusable');
                        if (nextMove && isElementVisible(nextMove)) return nextMove;
                        const nextCard = allRows[rowIndex + 1].querySelector('.episode-item.focusable');
                        if (nextCard && isElementVisible(nextCard)) return nextCard;
                    }
                    return null;
                }
            } else {
                // Delete button in row
                if (direction === 'left') {
                    const moveBtn = row?.querySelector('.playlist-action-btn.focusable');
                    if (moveBtn && isElementVisible(moveBtn)) return moveBtn;
                    const card = row?.querySelector('.episode-item.focusable');
                    if (card && isElementVisible(card)) return card;
                    return getActiveSidebarItem();
                }
                if (direction === 'right') {
                    return null;
                }
                if (direction === 'up') {
                    if (rowIndex === 0) return getPrimaryActionBtn();
                    if (rowIndex > 0) {
                        const prevDel = allRows[rowIndex - 1].querySelector('.playlist-item-actions button:last-child.focusable');
                        if (prevDel && isElementVisible(prevDel)) return prevDel;
                    }
                    return getPrimaryActionBtn();
                }
                if (direction === 'down') {
                    if (rowIndex >= 0 && rowIndex < allRows.length - 1) {
                        const nextDel = allRows[rowIndex + 1].querySelector('.playlist-item-actions button:last-child.focusable');
                        if (nextDel && isElementVisible(nextDel)) return nextDel;
                    }
                    return null;
                }
            }
        }

        // 6. Empty State Button
        if (current.id === 'empty-browse-btn') {
            if (direction === 'up') {
                return getPrimaryActionBtn();
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
        // 1. Cancel Move Mode if active
        const moveIndex = getActiveMoveIndex();
        if (moveIndex !== null) {
            setActiveMoveIndex(null);
            reRenderList();
            return true;
        }

        // 2. Dismiss any open modal
        const openModal = document.querySelector('.modal.is-open, .modal.active, .modal[style*="display: flex"], .modal[style*="display: block"]');
        if (openModal && isElementVisible(openModal)) {
            const cancelBtn = openModal.querySelector('.btn--secondary, #modal-cancel-btn, #edit-playlist-cancel-btn, #context-cancel-btn');
            if (cancelBtn) {
                cancelBtn.click();
                return true;
            }
            openModal.style.display = 'none';
            openModal.classList.remove('is-open', 'active');
            return true;
        }

        // 3. Navigate back to Playlists overview
        Router.goBack('playlists');
        return true;
    }
};