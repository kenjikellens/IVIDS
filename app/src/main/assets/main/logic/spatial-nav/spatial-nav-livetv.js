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
 * Retrieves visible top category chips, search input, and filter controls in logical horizontal order.
 * @returns {HTMLElement[]} Array of visible interactive controls in the top bar.
 */
function getVisibleTopControls() {
    const selector = '.livetv-top-bar .focusable, .categories-row .focusable, .category-chip.focusable, .filter-chip.focusable, #search-input.focusable, #search-clear.focusable, #filter-genre.focusable, #filter-country.focusable';
    const items = Array.from(document.querySelectorAll(selector));
    const unique = Array.from(new Set(items));
    return unique.filter(isElementVisible);
}

/**
 * Spatial Navigation rules for the Live TV page.
 * Manages D-pad routing across channel categories/filters, vertical channel rows, EPG preview pane, and sidebar.
 */
export const spatialNavLivetv = {
    id: 'livetv',

    /**
     * Retrieves the default focus element when loading the Live TV page.
     * Prefers the active or first category chip, or the first channel item in the list.
     * @returns {HTMLElement|null} The initial focus target element.
     */
    getDefaultFocus: () => {
        const activeChip = document.querySelector('.category-chip.active.focusable, .filter-chip.active.focusable, .chip.active.focusable, .category-chip.focusable, .filter-chip.focusable, .chip.focusable');
        if (activeChip && isElementVisible(activeChip)) return activeChip;

        const firstChannel = document.querySelector('#channels-list .channel-list-item.focusable, #channels-list .focusable');
        if (firstChannel && isElementVisible(firstChannel)) return firstChannel;

        const genre = document.getElementById('filter-genre');
        if (genre && isElementVisible(genre)) return genre;

        const searchInput = document.getElementById('search-input');
        if (searchInput && isElementVisible(searchInput)) return searchInput;

        return null;
    },

    /**
     * Handles custom spatial navigation focus routing for Live TV.
     * Defines deterministic transitions between categories/search top bar, channels list, and preview pane.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
     * @returns {HTMLElement|null} The target element to focus, or null to delegate to standard calculations.
     */
    findNext: (current, direction) => {
        if (!current) return null;

        // 1. Sidebar Boundary: Returning into Live TV content (Right from desktop sidebar, Up from mobile bottom nav)
        const inSidebar = current.closest('#sidebar-container') !== null;
        if (inSidebar) {
            const isMobileBottom = SpatialNav.isPortrait && SpatialNav.isPortrait();
            const shouldEnter = isMobileBottom ? (direction === 'up') : (direction === 'right');
            if (shouldEnter) {
                if (SpatialNav.lastFocusedElement && document.getElementById('main-view')?.contains(SpatialNav.lastFocusedElement) && isElementVisible(SpatialNav.lastFocusedElement)) {
                    return SpatialNav.lastFocusedElement;
                }
                return spatialNavLivetv.getDefaultFocus();
            }
            return null;
        }

        // 2. Categories Row & Top Controls: Search box, Clear button, Genre filter, Country filter, Category chips
        const topControls = getVisibleTopControls();
        const inTopControls = topControls.includes(current) || current.closest('.livetv-top-bar') !== null || current.closest('.categories-row') !== null;
        if (inTopControls) {
            const currentIndex = topControls.indexOf(current);

            if (direction === 'left') {
                if (currentIndex > 0) return topControls[currentIndex - 1];
                // Moving left from first control returns to sidebar navigation rail
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                if (currentIndex >= 0 && currentIndex < topControls.length - 1) return topControls[currentIndex + 1];
                return null;
            }
            if (direction === 'down') {
                // Moving down moves into channels list/grid
                const firstChannel = document.querySelector('#channels-list .channel-list-item.focusable, #channels-list .focusable');
                if (firstChannel && isElementVisible(firstChannel)) return firstChannel;
                return null;
            }
            if (direction === 'up') {
                return null;
            }
        }

        // 3. Channel list / EPG grid: Vertical channel navigation
        const inChannelList = current.classList.contains('channel-list-item') || current.closest('#channels-list') !== null;
        if (inChannelList) {
            const channels = Array.from(document.querySelectorAll('#channels-list .channel-list-item.focusable, #channels-list .focusable')).filter(isElementVisible);
            const currentIndex = channels.indexOf(current);

            if (direction === 'up') {
                if (currentIndex > 0) return channels[currentIndex - 1];
                // Moving up from first channel item returns to categories row / filter header
                const activeChip = document.querySelector('.category-chip.active.focusable, .filter-chip.active.focusable, .chip.active.focusable');
                if (activeChip && isElementVisible(activeChip)) return activeChip;
                const genre = document.getElementById('filter-genre');
                if (genre && isElementVisible(genre)) return genre;
                const searchInput = document.getElementById('search-input');
                if (searchInput && isElementVisible(searchInput)) return searchInput;
                return topControls.length > 0 ? topControls[0] : null;
            }
            if (direction === 'down') {
                if (currentIndex >= 0 && currentIndex < channels.length - 1) return channels[currentIndex + 1];
                return null;
            }
            if (direction === 'left') {
                // Moving left from channel list returns to categories or sidebar navigation rail
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                // Moving right on channel may enter EPG program guide details if applicable
                const previewFocusable = document.querySelector('.livetv-preview-column .focusable, #hero-active-content .focusable');
                if (previewFocusable && isElementVisible(previewFocusable)) {
                    return previewFocusable;
                }
                return null;
            }
        }

        // 4. Preview / EPG details pane
        const inPreview = current.closest('.livetv-preview-column') !== null;
        if (inPreview) {
            if (direction === 'left') {
                // Return to active or selected channel in list
                const activeChannel = document.querySelector('#channels-list .channel-list-item.focused, #channels-list .channel-list-item[data-selected="true"]');
                if (activeChannel && isElementVisible(activeChannel)) return activeChannel;
                const firstChannel = document.querySelector('#channels-list .channel-list-item.focusable');
                if (firstChannel && isElementVisible(firstChannel)) return firstChannel;
                return null;
            }
        }

        return null;
    },

    /**
     * Handles Back key press on the Live TV page.
     * Navigates from channel rows back up to the category/search controls, or from controls to the sidebar rail.
     * @returns {boolean} True if the back event was handled.
     */
    handleBack: () => {
        const current = document.activeElement || document.querySelector('.focused');
        const inChannelList = current && (current.classList.contains('channel-list-item') || current.closest('#channels-list') !== null);

        if (inChannelList) {
            const activeChip = document.querySelector('.category-chip.active.focusable, .filter-chip.active.focusable, .chip.active.focusable');
            if (activeChip && isElementVisible(activeChip)) {
                SpatialNav.setFocus(activeChip);
                return true;
            }
            const genre = document.getElementById('filter-genre');
            if (genre && isElementVisible(genre)) {
                SpatialNav.setFocus(genre);
                return true;
            }
            const searchInput = document.getElementById('search-input');
            if (searchInput && isElementVisible(searchInput)) {
                SpatialNav.setFocus(searchInput);
                return true;
            }
        }

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