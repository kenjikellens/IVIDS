import { SpatialNav } from '../../gui/js/spatial-nav.js';

/**
 * Checks if a DOM element is currently visible, rendered, and not hidden.
 * @param {HTMLElement|null} el - The element to check.
 * @returns {boolean} True if the element is visible and interactable.
 */
function isElementVisible(el) {
    if (!el) return false;
    if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;
    if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
    if (el.classList.contains('hidden') && el.style.display !== 'flex' && el.style.display !== 'block' && el.style.display !== 'inline-block') {
        return false;
    }
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
 * Retrieves the currently active or open modal element in the document.
 * @returns {HTMLElement|null} The active modal container or null if none is open.
 */
function getActiveModal() {
    const openModals = Array.from(document.querySelectorAll('.modal.is-open, .modal.show, .modal.active, .modal[style*="display: flex"]'));
    return openModals.find(m => isElementVisible(m)) || null;
}

/**
 * Resolves the next focusable target within an open modal dialog in Settings.
 * Enforces a strict focus trap to prevent D-pad escape from the modal boundaries.
 * @param {HTMLElement} current - The currently focused element inside the modal.
 * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
 * @param {HTMLElement} modal - The active modal dialog container.
 * @returns {HTMLElement|null} Next focusable element inside the modal.
 */
function findNextInModal(current, direction, modal) {
    const focusables = Array.from(modal.querySelectorAll('.focusable')).filter(isElementVisible);
    if (focusables.length === 0) return current;

    // 1. Language Stepper Modal
    if (modal.id === 'language-modal') {
        const prevBtn = document.getElementById('lang-prev-btn');
        const nextBtn = document.getElementById('lang-next-btn');
        const applyBtn = modal.querySelector('.modal__footer .btn--primary');
        const cancelBtn = modal.querySelector('.modal__footer .btn--secondary');

        if (current === prevBtn) {
            if (direction === 'right') return nextBtn;
            if (direction === 'down') return applyBtn || cancelBtn;
            return current;
        }
        if (current === nextBtn) {
            if (direction === 'left') return prevBtn;
            if (direction === 'down') return applyBtn || cancelBtn;
            return current;
        }
        if (current === applyBtn) {
            if (direction === 'up') return nextBtn || prevBtn;
            if (direction === 'down') return cancelBtn;
            return current;
        }
        if (current === cancelBtn) {
            if (direction === 'up') return applyBtn || nextBtn;
            return current;
        }
    }

    // 2. Accent Color Modal (Grid of color chips + footer buttons)
    if (modal.id === 'color-modal') {
        const chips = Array.from(modal.querySelectorAll('.chip--color.focusable')).filter(isElementVisible);
        const applyBtn = modal.querySelector('.modal__footer .btn--primary');
        const cancelBtn = modal.querySelector('.modal__footer .btn--secondary');
        const chipIdx = chips.indexOf(current);

        if (chipIdx !== -1) {
            if (direction === 'left') {
                return chipIdx > 0 ? chips[chipIdx - 1] : current;
            }
            if (direction === 'right') {
                return chipIdx < chips.length - 1 ? chips[chipIdx + 1] : current;
            }
            if (direction === 'down') {
                const currentRect = current.getBoundingClientRect();
                const nextRowChip = chips.find(c => c.getBoundingClientRect().top > currentRect.top + 20 && Math.abs(c.getBoundingClientRect().left - currentRect.left) < 30);
                if (nextRowChip) return nextRowChip;
                return applyBtn || cancelBtn;
            }
            if (direction === 'up') {
                const currentRect = current.getBoundingClientRect();
                const prevRowChip = chips.find(c => c.getBoundingClientRect().top < currentRect.top - 20 && Math.abs(c.getBoundingClientRect().left - currentRect.left) < 30);
                return prevRowChip || current;
            }
        }

        if (current === applyBtn) {
            if (direction === 'up') {
                const activeChip = modal.querySelector('.chip--color.is-active, .chip--color.active') || chips[chips.length - 1];
                return activeChip || chips[0];
            }
            if (direction === 'down') return cancelBtn;
            return current;
        }

        if (current === cancelBtn) {
            if (direction === 'up') return applyBtn;
            return current;
        }
    }

    // 3. Update Mode Modal (2-column chip grid + footer buttons)
    if (modal.id === 'update-mode-modal') {
        const chips = Array.from(modal.querySelectorAll('.chip--option.focusable')).filter(isElementVisible);
        const applyBtn = modal.querySelector('.modal__footer .btn--primary');
        const cancelBtn = modal.querySelector('.modal__footer .btn--secondary');
        const chipIdx = chips.indexOf(current);

        if (chipIdx !== -1) {
            if (direction === 'left') {
                return (chipIdx % 2 === 1) ? chips[chipIdx - 1] : current;
            }
            if (direction === 'right') {
                return (chipIdx % 2 === 0 && chipIdx + 1 < chips.length) ? chips[chipIdx + 1] : current;
            }
            if (direction === 'down') {
                if (chipIdx + 2 < chips.length) return chips[chipIdx + 2];
                return applyBtn || cancelBtn;
            }
            if (direction === 'up') {
                if (chipIdx - 2 >= 0) return chips[chipIdx - 2];
                return current;
            }
        }

        if (current === applyBtn) {
            if (direction === 'up') {
                const activeChip = modal.querySelector('.chip--option.is-active, .chip--option.active') || chips[chips.length - 1];
                return activeChip || chips[0];
            }
            if (direction === 'down') return cancelBtn;
            return current;
        }

        if (current === cancelBtn) {
            if (direction === 'up') return applyBtn;
            return current;
        }
    }

    // 4. Version Selector Modal (Vertical list of release build chips + cancel button)
    if (modal.id === 'version-selector-modal') {
        const cards = Array.from(modal.querySelectorAll('#version-options .chip--option.focusable')).filter(isElementVisible);
        const cancelBtn = modal.querySelector('.modal__footer .btn--secondary');
        const cardIdx = cards.indexOf(current);

        if (cardIdx !== -1) {
            if (direction === 'down') {
                return cardIdx < cards.length - 1 ? cards[cardIdx + 1] : cancelBtn;
            }
            if (direction === 'up') {
                return cardIdx > 0 ? cards[cardIdx - 1] : current;
            }
            return current;
        }

        if (current === cancelBtn) {
            if (direction === 'up') return cards.length > 0 ? cards[cards.length - 1] : current;
            return current;
        }
    }

    // 5. Player Providers and Live TV M3U Playlists Modals
    if (modal.id === 'player-modal' || modal.id === 'm3u-modal') {
        const isPlayer = modal.id === 'player-modal';
        const addBtn = document.getElementById(isPlayer ? 'add-provider-btn' : 'add-m3u-btn');
        const applyBtn = modal.querySelector('.modal__footer .btn--primary');
        const cancelBtn = modal.querySelector('.modal__footer .btn--secondary');
        const items = Array.from(modal.querySelectorAll('.provider-item'));

        const itemContainer = current.closest('.provider-item');
        if (itemContainer) {
            const itemIdx = items.indexOf(itemContainer);
            const input = itemContainer.querySelector('.form-input.focusable');
            const moveBtn = itemContainer.querySelector('.provider-move-btn.focusable');
            const deleteBtn = itemContainer.querySelector('.provider-delete-btn.focusable');

            if (current === input) {
                if (direction === 'right') return moveBtn || current;
                if (direction === 'down') {
                    if (itemIdx < items.length - 1) {
                        return items[itemIdx + 1].querySelector('.form-input.focusable') || items[itemIdx + 1].querySelector('.focusable');
                    }
                    return addBtn || applyBtn;
                }
                if (direction === 'up') {
                    if (itemIdx > 0) {
                        return items[itemIdx - 1].querySelector('.form-input.focusable') || items[itemIdx - 1].querySelector('.focusable');
                    }
                    return current;
                }
                return current;
            }

            if (current === moveBtn) {
                if (direction === 'left') return input;
                if (direction === 'right') return deleteBtn || current;
                if (direction === 'down') {
                    if (itemIdx < items.length - 1) {
                        return items[itemIdx + 1].querySelector('.provider-move-btn.focusable') || items[itemIdx + 1].querySelector('.focusable');
                    }
                    return addBtn || applyBtn;
                }
                if (direction === 'up') {
                    if (itemIdx > 0) {
                        return items[itemIdx - 1].querySelector('.provider-move-btn.focusable') || items[itemIdx - 1].querySelector('.focusable');
                    }
                    return current;
                }
            }

            if (current === deleteBtn) {
                if (direction === 'left') return moveBtn || input;
                if (direction === 'down') {
                    if (itemIdx < items.length - 1) {
                        return items[itemIdx + 1].querySelector('.provider-delete-btn.focusable') || items[itemIdx + 1].querySelector('.focusable');
                    }
                    return addBtn || applyBtn;
                }
                if (direction === 'up') {
                    if (itemIdx > 0) {
                        return items[itemIdx - 1].querySelector('.provider-delete-btn.focusable') || items[itemIdx - 1].querySelector('.focusable');
                    }
                    return current;
                }
                return current;
            }
        }

        if (current === addBtn) {
            if (direction === 'up') {
                if (items.length > 0) {
                    const lastItem = items[items.length - 1];
                    return lastItem.querySelector('.form-input.focusable') || lastItem.querySelector('.focusable');
                }
                return current;
            }
            if (direction === 'down') return applyBtn || cancelBtn;
            return current;
        }

        if (current === applyBtn) {
            if (direction === 'up') return addBtn || (items.length > 0 ? items[items.length - 1].querySelector('.focusable') : current);
            if (direction === 'down') return cancelBtn;
            return current;
        }

        if (current === cancelBtn) {
            if (direction === 'up') return applyBtn;
            return current;
        }
    }

    // 6. Release Changes Modal (Close X at top right + bottom Close button)
    if (modal.id === 'changes-modal') {
        const closeX = modal.querySelector('.modal__close.focusable');
        const closeBtn = modal.querySelector('.modal__footer .btn--secondary.focusable');
        if (current === closeX && direction === 'down') return closeBtn || current;
        if (current === closeBtn && direction === 'up') return closeX || current;
        return current;
    }

    // 7. App Info Modal
    if (modal.id === 'app-info-modal') {
        return current;
    }

    // Generic fallback: preserve strict focus trap inside the modal
    const idx = focusables.indexOf(current);
    if (idx !== -1) {
        if (direction === 'down' || direction === 'right') {
            return idx < focusables.length - 1 ? focusables[idx + 1] : focusables[0];
        }
        if (direction === 'up' || direction === 'left') {
            return idx > 0 ? focusables[idx - 1] : focusables[focusables.length - 1];
        }
    }

    return current;
}

/**
 * Resolves the next focusable control in the main Settings page body.
 * Manages clean vertical list progression, UI scale horizontal button adjustment,
 * top tabs navigation, and boundary transitions to the sidebar.
 * @param {HTMLElement} current - Currently focused settings element.
 * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
 * @returns {HTMLElement|null} Targeted element or null.
 */
function findNextInSettingsPage(current, direction) {
    // 1. Sidebar Boundary: Returning into Settings content (Right from desktop sidebar, Up from mobile bottom nav)
    const inSidebar = current.closest('#sidebar-container') !== null;
    if (inSidebar) {
        const isMobileBottom = SpatialNav.isPortrait && SpatialNav.isPortrait();
        const shouldEnter = isMobileBottom ? (direction === 'up') : (direction === 'right');
        if (shouldEnter) {
            if (SpatialNav.lastFocusedElement && document.getElementById('main-view')?.contains(SpatialNav.lastFocusedElement) && isElementVisible(SpatialNav.lastFocusedElement)) {
                return SpatialNav.lastFocusedElement;
            }
            return document.getElementById('edit-language-btn') || document.querySelector('.settings-container .focusable');
        }
        return null;
    }

    // 2. Navigation Tabs / Pills at top of Settings (if present)
    const tabs = Array.from(document.querySelectorAll('#settings-tabs .tab-btn, .settings-tabs .tab-btn, .settings-header .tab-btn, .settings-container .tab-bar .tab-btn')).filter(isElementVisible);
    const inTabs = tabs.includes(current);
    if (inTabs) {
        const tabIdx = tabs.indexOf(current);
        if (direction === 'left') {
            if (tabIdx > 0) return tabs[tabIdx - 1];
            return getActiveSidebarItem();
        }
        if (direction === 'right') {
            if (tabIdx < tabs.length - 1) return tabs[tabIdx + 1];
            return null;
        }
        if (direction === 'down') {
            return document.getElementById('edit-language-btn') || document.querySelector('.settings-section .focusable');
        }
        if (direction === 'up') {
            return null;
        }
    }

    // 3. UI Scale decrement / increment buttons (Horizontal row inside Appearance section)
    if (current.id === 'dec-uiscale-btn') {
        if (direction === 'right') return document.getElementById('inc-uiscale-btn');
        if (direction === 'left') return getActiveSidebarItem();
        if (direction === 'up') return document.getElementById('edit-language-btn');
        if (direction === 'down') return document.getElementById('edit-color-btn');
    }

    if (current.id === 'inc-uiscale-btn') {
        if (direction === 'left') return document.getElementById('dec-uiscale-btn');
        if (direction === 'right') return null;
        if (direction === 'up') return document.getElementById('edit-language-btn');
        if (direction === 'down') return document.getElementById('edit-color-btn');
    }

    // 4. Update Section Controls: Check Updates and Cancel Update buttons
    if (current.id === 'check-updates-btn') {
        const cancelBtn = document.getElementById('cancel-update-btn');
        if (direction === 'right' && cancelBtn && isElementVisible(cancelBtn)) return cancelBtn;
        if (direction === 'left') return getActiveSidebarItem();
        if (direction === 'up') return document.getElementById('edit-update-mode-btn');
        if (direction === 'down') return document.getElementById('app-info-btn');
    }

    if (current.id === 'cancel-update-btn') {
        if (direction === 'left') return document.getElementById('check-updates-btn');
        if (direction === 'right') return null;
        if (direction === 'up') return document.getElementById('edit-update-mode-btn');
        if (direction === 'down') return document.getElementById('app-info-btn');
    }

    // 5. Left boundary for any settings item: Return to sidebar navigation rail
    if (direction === 'left') {
        return getActiveSidebarItem();
    }

    // 6. Right boundary: Form controls are aligned in full-width rows; right boundary halts
    if (direction === 'right') {
        return null;
    }

    // 7. Clean vertical list progression through setting sections:
    const settingSequence = [
        'edit-language-btn',
        'dec-uiscale-btn',
        'edit-color-btn',
        'toggle-adult-btn',
        'toggle-datasaver-btn',
        'edit-player-btn',
        'edit-m3u-btn',
        'edit-update-mode-btn',
        'check-updates-btn',
        'app-info-btn'
    ];

    const currentId = current.id;
    const seqIdx = settingSequence.indexOf(currentId);

    if (seqIdx !== -1) {
        if (direction === 'down') {
            for (let i = seqIdx + 1; i < settingSequence.length; i++) {
                const nextEl = document.getElementById(settingSequence[i]);
                if (nextEl && isElementVisible(nextEl)) return nextEl;
            }
            return null;
        }

        if (direction === 'up') {
            for (let i = seqIdx - 1; i >= 0; i--) {
                const prevEl = document.getElementById(settingSequence[i]);
                if (prevEl && isElementVisible(prevEl)) return prevEl;
            }
            if (tabs.length > 0) return tabs[0];
            return null;
        }
    }

    // Generic fallback for any other focusable controls (.form-select, .form-input, .btn)
    const allFocusables = Array.from(document.querySelectorAll('.settings-container .focusable')).filter(isElementVisible);
    const idx = allFocusables.indexOf(current);
    if (idx !== -1) {
        if (direction === 'down' && idx < allFocusables.length - 1) return allFocusables[idx + 1];
        if (direction === 'up' && idx > 0) return allFocusables[idx - 1];
    }

    return null;
}

/**
 * Spatial Navigation rules for the Settings page.
 * Manages spatial focus traversal across appearance, content, player, updates, and app info sections,
 * handles modal focus traps with back restoration, and connects to the global sidebar navigation rail.
 */
export const spatialNavSettings = {
    id: 'settings',

    /**
     * Retrieves the default focus element when loading the settings page.
     * Returns the first setting section button or first interactive input/toggle.
     * @returns {HTMLElement|null} The default focusable element.
     */
    getDefaultFocus: () => {
        const modal = getActiveModal();
        if (modal) {
            const firstModal = modal.querySelector('.focusable');
            if (firstModal && isElementVisible(firstModal)) return firstModal;
        }
        const tabs = Array.from(document.querySelectorAll('#settings-tabs .tab-btn, .settings-tabs .tab-btn')).filter(isElementVisible);
        if (tabs.length > 0) return tabs[0];
        const langBtn = document.getElementById('edit-language-btn');
        if (langBtn && isElementVisible(langBtn)) return langBtn;
        const first = document.querySelector('.settings-container .focusable');
        return (first && isElementVisible(first)) ? first : null;
    },

    /**
     * Calculates custom next focus node across all Settings page UI sections and modals.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
     * @returns {HTMLElement|null} The targeted element, or null to trigger default search.
     */
    findNext: (current, direction) => {
        if (!current) return null;

        // Check if currently inside an open modal dialog
        const modal = getActiveModal();
        if (modal && modal.contains(current)) {
            return findNextInModal(current, direction, modal);
        }

        return findNextInSettingsPage(current, direction);
    },

    /**
     * Handles the Back key event on the Settings page.
     * If a modal is open, closes it and restores focus to the triggering element.
     * If in settings content, navigates focus back to the sidebar navigation rail.
     * @returns {boolean} True if the back event was fully consumed.
     */
    handleBack: () => {
        const modal = getActiveModal();
        if (modal) {
            if (window.settingsInstance && typeof window.settingsInstance.closeModal === 'function') {
                window.settingsInstance.closeModal();
                return true;
            }
            const closeBtn = modal.querySelector('.modal__close, .btn[data-i18n="common.close"], .btn[data-i18n="common.cancel"], .modal__footer .btn--secondary');
            if (closeBtn) {
                closeBtn.click();
                return true;
            }
        }

        const current = document.querySelector('.focused');
        const sidebar = getActiveSidebarItem();
        if (sidebar && (!current || !current.closest('#sidebar-container'))) {
            SpatialNav.setFocus(sidebar);
            return true;
        }

        return false;
    }
};
