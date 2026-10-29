import { SpatialNav } from '../../gui/js/spatial-nav.js';

/**
 * Checks if a DOM element is currently visible, rendered, and not hidden.
 * @param {HTMLElement|null} el - The element to check.
 * @returns {boolean} True if the element is visible.
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
 * Spatial Navigation rules for the Account page.
 * Manages spatial focus traversal between profile action buttons, switch user,
 * sync status, and logout button, and coordinates boundary navigation to the sidebar rail.
 */
export const spatialNavAccount = {
    id: 'account',

    /**
     * Retrieves the default focus element when loading the account page.
     * Returns the first profile action button or switch user button.
     * @returns {HTMLElement|null} The default focus target.
     */
    getDefaultFocus: () => {
        const switchUserBtn = document.getElementById('switch-user-btn');
        if (switchUserBtn && isElementVisible(switchUserBtn)) return switchUserBtn;

        const syncStatusBtn = document.getElementById('sync-status-btn');
        if (syncStatusBtn && isElementVisible(syncStatusBtn)) return syncStatusBtn;

        const signInBtn = document.getElementById('account-sign-in-btn');
        if (signInBtn && isElementVisible(signInBtn)) return signInBtn;

        const createAccBtn = document.getElementById('account-create-acc-btn');
        if (createAccBtn && isElementVisible(createAccBtn)) return createAccBtn;

        const signOutBtn = document.getElementById('account-sign-out-btn');
        if (signOutBtn && isElementVisible(signOutBtn)) return signOutBtn;

        const actions = Array.from(document.querySelectorAll('.profile-actions .focusable, .account-container .focusable')).filter(isElementVisible);
        return actions.length > 0 ? actions[0] : null;
    },

    /**
     * Calculates custom next focus node across Account page options.
     * Manages horizontal traversal within button groups and vertical traversal between sections.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
     * @returns {HTMLElement|null} Targeted element or null.
     */
    findNext: (current, direction) => {
        if (!current) return null;

        // 1. Sidebar Boundary: Returning into Account view (Right from desktop sidebar, Up from mobile bottom nav)
        const inSidebar = current.closest('#sidebar-container') !== null;
        if (inSidebar) {
            const isMobileBottom = SpatialNav.isPortrait && SpatialNav.isPortrait();
            const shouldEnter = isMobileBottom ? (direction === 'up') : (direction === 'right');
            if (shouldEnter) {
                if (SpatialNav.lastFocusedElement && document.getElementById('main-view')?.contains(SpatialNav.lastFocusedElement) && isElementVisible(SpatialNav.lastFocusedElement)) {
                    return SpatialNav.lastFocusedElement;
                }
                return spatialNavAccount.getDefaultFocus();
            }
            return null;
        }

        // 2. Traversal between Account options, sync status, and action buttons
        const focusables = Array.from(document.querySelectorAll('.profile-actions .focusable, .account-section .focusable, .account-container .focusable')).filter(isElementVisible);
        const idx = focusables.indexOf(current);

        if (idx !== -1) {
            if (direction === 'left') {
                if (idx > 0) {
                    const currentRect = current.getBoundingClientRect();
                    const prevRect = focusables[idx - 1].getBoundingClientRect();
                    // If elements share approximately the same horizontal row (within 20px), navigate left
                    if (Math.abs(currentRect.top - prevRect.top) < 20) {
                        return focusables[idx - 1];
                    }
                }
                return getActiveSidebarItem();
            }

            if (direction === 'right') {
                if (idx < focusables.length - 1) {
                    const currentRect = current.getBoundingClientRect();
                    const nextRect = focusables[idx + 1].getBoundingClientRect();
                    // If elements share approximately the same horizontal row (within 20px), navigate right
                    if (Math.abs(currentRect.top - nextRect.top) < 20) {
                        return focusables[idx + 1];
                    }
                }
                return null;
            }

            if (direction === 'down') {
                if (idx < focusables.length - 1) {
                    return focusables[idx + 1];
                }
                return null;
            }

            if (direction === 'up') {
                if (idx > 0) {
                    return focusables[idx - 1];
                }
                return null;
            }
        }

        if (direction === 'left') {
            return getActiveSidebarItem();
        }

        return null;
    },

    /**
     * Handles the Back key event on the Account page.
     * Navigates focus back to the global sidebar navigation rail.
     * @returns {boolean} True if handled.
     */
    handleBack: () => {
        const current = document.querySelector('.focused');
        const sidebar = getActiveSidebarItem();
        if (sidebar && (!current || !current.closest('#sidebar-container'))) {
            SpatialNav.setFocus(sidebar);
            return true;
        }
        return false;
    }
};
