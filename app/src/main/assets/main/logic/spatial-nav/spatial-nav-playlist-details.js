import { SpatialNav } from '../../gui/js/spatial-nav.js';
import { Router } from '../../gui/js/router.js';
import { isElementVisible, getActiveSidebarItem } from './spatial-nav-helpers.js';
import {
    getActiveMoveIndex,
    setActiveMoveIndex,
    getPlaylistItemsCount,
    moveItemInActivePlaylist,
    reRenderList,
    clearMoveModeBackHandler,
    closePlaylistOptionsPanel,
    navigatePlaylistOptionsBack
} from '../../gui/pages/playlist-details.js';

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
        const firstItem = document.querySelector('#playlist-items-container .episode-item.focusable, #playlist-items-container .focusable');
        if (firstItem && isElementVisible(firstItem)) return firstItem;
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

        // 0. Modal Focus Trap: Keep D-pad navigation inside active modals
        const activeModal = current.closest('#confirmation-modal, #edit-playlist-modal, #item-context-modal, #add-to-other-playlist-modal');
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
                navigatePlaylistOptionsBack();
                return document.querySelector('.focused') || document.getElementById('playlist-options-btn') || current;
            }
            return current;
        }

        // 1. Move Mode: Active Item Reordering Interception
        const moveIndex = getActiveMoveIndex();
        if (moveIndex !== null) {
            if (direction === 'up') {
                if (moveIndex > 0) {
                    moveItemInActivePlaylist(moveIndex, moveIndex - 1);
                    setActiveMoveIndex(moveIndex - 1);
                    reRenderList({ skipFocusFirst: true });
                    setTimeout(() => {
                        const newBtn = document.querySelector(`.playlist-action-btn[data-index="${moveIndex - 1}"]`);
                        if (newBtn) SpatialNav.setFocus(newBtn);
                    }, 10);
                }
                return current;
            } else if (direction === 'down') {
                const total = getPlaylistItemsCount();
                if (moveIndex < total - 1) {
                    moveItemInActivePlaylist(moveIndex, moveIndex + 1);
                    setActiveMoveIndex(moveIndex + 1);
                    reRenderList({ skipFocusFirst: true });
                    setTimeout(() => {
                        const newBtn = document.querySelector(`.playlist-action-btn[data-index="${moveIndex + 1}"]`);
                        if (newBtn) SpatialNav.setFocus(newBtn);
                    }, 10);
                }
                return current;
            } else if (direction === 'left' || direction === 'right') {
                // Cancel Move Mode and let spatial nav navigate normally
                setActiveMoveIndex(null);
                clearMoveModeBackHandler();
                reRenderList({ skipFocusFirst: true });
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

        // 2b. Top Bar: Back Button <-> Play All <-> Options Button
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

        // 4. Media Item Card: Focusable item card in playlist item row
        const inItemCard = current.classList.contains('episode-item') || current.closest('.playlist-item-card-wrapper') !== null;
        if (inItemCard) {
            const row = current.closest('.playlist-item-row');
            const allCards = Array.from(document.querySelectorAll('#playlist-items-container .episode-item.focusable')).filter(isElementVisible);
            const cardIndex = allCards.indexOf(current);

            if (direction === 'right') {
                // Right into first visible row action button (Move/Delete on Landscape, More on Mobile)
                if (row) {
                    const visibleRowBtns = Array.from(row.querySelectorAll('.playlist-item-actions .focusable')).filter(isElementVisible);
                    if (visibleRowBtns.length > 0) return visibleRowBtns[0];
                }
                return null;
            }
            if (direction === 'left') {
                // Moving left goes to sidebar navigation rail
                return getActiveSidebarItem();
            }
            if (direction === 'up') {
                // Moving up from first item focuses top-left Back button (or Options fallback)
                if (cardIndex === 0) {
                    const backBtn = document.getElementById('back-btn');
                    return (backBtn && isElementVisible(backBtn)) ? backBtn : getPrimaryActionBtn();
                }
                if (cardIndex > 0) return allCards[cardIndex - 1];
                const backBtn = document.getElementById('back-btn');
                return (backBtn && isElementVisible(backBtn)) ? backBtn : getPrimaryActionBtn();
            }
            if (direction === 'down') {
                if (cardIndex >= 0 && cardIndex < allCards.length - 1) return allCards[cardIndex + 1];
                return null;
            }
        }

        // 5. Item Row Action Buttons: Index-based traversal across visible row action buttons
        const inItemActions = current.closest('.playlist-item-actions') !== null;
        if (inItemActions) {
            const row = current.closest('.playlist-item-row');
            const allRows = Array.from(document.querySelectorAll('#playlist-items-container .playlist-item-row')).filter(isElementVisible);
            const rowIndex = allRows.indexOf(row);
            const visibleRowBtns = row ? Array.from(row.querySelectorAll('.playlist-item-actions .focusable')).filter(isElementVisible) : [];
            const btnIdx = visibleRowBtns.indexOf(current);

            if (direction === 'left') {
                if (btnIdx > 0) return visibleRowBtns[btnIdx - 1];
                const card = row?.querySelector('.episode-item.focusable');
                if (card && isElementVisible(card)) return card;
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                if (btnIdx >= 0 && btnIdx < visibleRowBtns.length - 1) return visibleRowBtns[btnIdx + 1];
                return null;
            }
            if (direction === 'up') {
                if (rowIndex === 0) return getPrimaryActionBtn();
                if (rowIndex > 0) {
                    const prevBtns = Array.from(allRows[rowIndex - 1].querySelectorAll('.playlist-item-actions .focusable')).filter(isElementVisible);
                    if (prevBtns.length > 0) return prevBtns[Math.min(Math.max(btnIdx, 0), prevBtns.length - 1)];
                    const prevCard = allRows[rowIndex - 1].querySelector('.episode-item.focusable');
                    if (prevCard && isElementVisible(prevCard)) return prevCard;
                }
                return getPrimaryActionBtn();
            }
            if (direction === 'down') {
                if (rowIndex >= 0 && rowIndex < allRows.length - 1) {
                    const nextBtns = Array.from(allRows[rowIndex + 1].querySelectorAll('.playlist-item-actions .focusable')).filter(isElementVisible);
                    if (nextBtns.length > 0) return nextBtns[Math.min(Math.max(btnIdx, 0), nextBtns.length - 1)];
                    const nextCard = allRows[rowIndex + 1].querySelector('.episode-item.focusable');
                    if (nextCard && isElementVisible(nextCard)) return nextCard;
                }
                return null;
            }
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
        // 1. Cancel Move Mode if active
        const moveIndex = getActiveMoveIndex();
        if (moveIndex !== null) {
            setActiveMoveIndex(null);
            clearMoveModeBackHandler();
            reRenderList({ skipFocusFirst: true });
            return true;
        }

        // 2. Close/Step Back Options Sidebar if open
        const optionsPanel = document.getElementById('playlist-options-panel');
        if (optionsPanel && isElementVisible(optionsPanel)) {
            navigatePlaylistOptionsBack();
            return true;
        }

        // 3. Dismiss any open modal
        const openModal = document.querySelector('.modal.is-open, .modal.active, .modal[style*="display: flex"], .modal[style*="display: block"]');
        if (openModal && isElementVisible(openModal)) {
            const cancelBtn = openModal.querySelector('#modal-cancel-btn, #edit-playlist-cancel-btn, #context-back-btn, #other-playlist-back-btn, .modal__back-btn, .btn--secondary:not(#edit-playlist-confirm-btn)');
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