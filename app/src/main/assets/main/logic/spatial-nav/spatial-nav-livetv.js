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
 * Remembers the current content element and returns the active sidebar navigation item.
 * @param {HTMLElement} current - Currently focused Live TV element.
 * @returns {HTMLElement|null} Sidebar navigation item.
 */
function sidebarTarget(current) {
    if (current) {
        SpatialNav.lastFocusedElement = current;
    }
    return getActiveSidebarItem();
}

/**
 * Retrieves visible top search controls in logical left-to-right order.
 * @returns {HTMLElement[]} Array of visible interactive controls in the top bar.
 */
function getVisibleTopControls() {
    const selector = '#search-input.focusable, #search-clear.focusable, .livetv-top-bar .focusable';
    const items = Array.from(document.querySelectorAll(selector));
    const unique = Array.from(new Set(items));
    return unique.filter(isElementVisible);
}

/**
 * Retrieves all visible focusable category/country items inside #categories-list.
 * @returns {HTMLElement[]} Array of visible category list item elements.
 */
function getCategoryItems() {
    const list = document.getElementById('categories-list');
    if (!list) return [];
    return Array.from(list.querySelectorAll('.category-list-item.focusable')).filter(isElementVisible);
}

/**
 * Retrieves all visible focusable channel items inside #channels-list.
 * @returns {HTMLElement[]} Array of visible channel card elements.
 */
function getChannelCards() {
    const list = document.getElementById('channels-list');
    if (!list) return [];
    return Array.from(
        list.querySelectorAll('.channel-list-item.focusable, .channel-card.focusable')
    ).filter(isElementVisible);
}

let lastFocusedCategoryItem = null;
let lastFocusedChannelCard = null;

/**
 * Resolves the preferred category item in #categories-list (active, last focused, or first).
 * @returns {HTMLElement|null} Target category element.
 */
function getPreferredCategoryItem() {
    const items = getCategoryItems();
    if (items.length === 0) return null;
    if (lastFocusedCategoryItem && items.includes(lastFocusedCategoryItem) && isElementVisible(lastFocusedCategoryItem)) {
        return lastFocusedCategoryItem;
    }
    const active = items.find(el => el.classList.contains('active') || el.classList.contains('is-selected'));
    if (active) return active;
    return items[0];
}

/**
 * Resolves the preferred channel item in #channels-list (last focused, active, or first).
 * @returns {HTMLElement|null} Target channel element.
 */
function getPreferredChannelCard() {
    const channels = getChannelCards();
    if (channels.length === 0) return null;
    if (lastFocusedChannelCard && channels.includes(lastFocusedChannelCard) && isElementVisible(lastFocusedChannelCard)) {
        return lastFocusedChannelCard;
    }
    const active = channels.find(
        el => el.classList.contains('active') || el.classList.contains('focused') || el.dataset.selected === 'true'
    );
    if (active) return active;
    return channels[0];
}

/**
 * Spatial Navigation rules for the 3-column Live TV page:
 * [Sidebar] <-> [Categories/Countries List (#categories-list)] <-> [Channels List (#channels-list)] <-> [Preview Card (#livetv-preview-card)]
 * with Top Search Bar (#search-input) above the lists.
 */
export const spatialNavLivetv = {
    id: 'livetv',

    /**
     * Retrieves the default focus element when loading the Live TV page.
     * Prefers the first channel card, or the active category item, or search input.
     * @returns {HTMLElement|null} The initial focus target element.
     */
    getDefaultFocus: () => {
        const firstChannel = getPreferredChannelCard();
        if (firstChannel) return firstChannel;

        const firstCategory = getPreferredCategoryItem();
        if (firstCategory) return firstCategory;

        const topControls = getVisibleTopControls();
        if (topControls.length > 0) return topControls[0];

        return null;
    },

    /**
     * Handles custom spatial navigation focus routing across the 3-column Live TV layout.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
     * @returns {HTMLElement|null} The target element to focus, or null to delegate to standard calculations.
     */
    findNext: (current, direction) => {
        if (!current) return null;

        const scrollBehavior = SpatialNav.getScrollBehavior ? SpatialNav.getScrollBehavior() : 'smooth';

        // 1. Sidebar Boundary: Returning into Live TV content (Right from desktop sidebar, Up from mobile bottom nav)
        const inSidebar = current.closest('#sidebar-container') !== null;
        if (inSidebar) {
            const isMobileBottom = SpatialNav.isPortrait && SpatialNav.isPortrait();
            const shouldEnter = isMobileBottom ? (direction === 'up') : (direction === 'right');
            if (shouldEnter) {
                const cat = getPreferredCategoryItem();
                if (cat) return cat;
                return spatialNavLivetv.getDefaultFocus();
            }
            return null;
        }

        // 2. Top Search Bar (#search-input, #search-clear)
        const topControls = getVisibleTopControls();
        const inTopBar = topControls.includes(current) || current.closest('.livetv-top-bar') !== null;
        if (inTopBar) {
            const currentIndex = topControls.indexOf(current);

            if (direction === 'left') {
                if (currentIndex > 0) return topControls[currentIndex - 1];
                return sidebarTarget(current);
            }
            if (direction === 'right') {
                if (currentIndex >= 0 && currentIndex < topControls.length - 1) {
                    return topControls[currentIndex + 1];
                }
                return current;
            }
            if (direction === 'down') {
                const channel = getPreferredChannelCard();
                if (channel) return channel;
                const cat = getPreferredCategoryItem();
                if (cat) return cat;
                return current;
            }
            if (direction === 'up') {
                return current;
            }
        }

        // 3. Left Column: Categories & Countries List (#categories-list .category-list-item.focusable)
        const parentCat = current.closest('#categories-list .category-list-item.focusable');
        const inCategoriesList = parentCat !== null || current.closest('#categories-list') !== null;
        if (inCategoriesList) {
            const categories = getCategoryItems();
            const activeCat = parentCat || current;
            const currentIndex = categories.indexOf(activeCat);

            if (activeCat && categories.includes(activeCat)) {
                lastFocusedCategoryItem = activeCat;
            }

            if (direction === 'up') {
                if (currentIndex > 0) {
                    const prev = categories[currentIndex - 1];
                    prev.scrollIntoView({ block: 'nearest', behavior: scrollBehavior });
                    lastFocusedCategoryItem = prev;
                    return prev;
                }
                return topControls.length > 0 ? topControls[0] : current;
            }
            if (direction === 'down') {
                if (currentIndex >= 0 && currentIndex < categories.length - 1) {
                    const next = categories[currentIndex + 1];
                    next.scrollIntoView({ block: 'nearest', behavior: scrollBehavior });
                    lastFocusedCategoryItem = next;
                    return next;
                }
                return current;
            }
            if (direction === 'left') {
                return sidebarTarget(current);
            }
            if (direction === 'right') {
                const channel = getPreferredChannelCard();
                if (channel) return channel;
                return current;
            }
        }

        // 4. Middle Column: Channel List (#channels-list .channel-list-item.focusable)
        const parentCard = current.closest('#channels-list .channel-list-item.focusable, #channels-list .channel-card.focusable');
        const inChannelList = parentCard !== null || current.closest('#channels-list') !== null;
        if (inChannelList) {
            const channels = getChannelCards();
            const activeCard = parentCard || current;
            const currentIndex = channels.indexOf(activeCard);

            if (activeCard && channels.includes(activeCard)) {
                lastFocusedChannelCard = activeCard;
            }

            if (direction === 'up') {
                if (currentIndex > 0) {
                    const prev = channels[currentIndex - 1];
                    prev.scrollIntoView({ block: 'nearest', behavior: scrollBehavior });
                    lastFocusedChannelCard = prev;
                    return prev;
                }
                return topControls.length > 0 ? topControls[0] : current;
            }
            if (direction === 'down') {
                if (currentIndex >= 0 && currentIndex < channels.length - 1) {
                    const next = channels[currentIndex + 1];
                    next.scrollIntoView({ block: 'nearest', behavior: scrollBehavior });
                    lastFocusedChannelCard = next;
                    return next;
                }
                return current;
            }
            if (direction === 'left') {
                const cat = getPreferredCategoryItem();
                if (cat) return cat;
                return sidebarTarget(current);
            }
            if (direction === 'right') {
                const previewCard = document.getElementById('livetv-preview-card');
                if (previewCard && isElementVisible(previewCard)) return previewCard;
                return current;
            }
        }

        // 5. Right Column: Video Preview Card (#livetv-preview-card)
        const inPreview = current.closest('.livetv-preview-column') !== null || current.id === 'livetv-preview-card';
        if (inPreview) {
            if (direction === 'left') {
                const channel = getPreferredChannelCard();
                if (channel) return channel;
                const cat = getPreferredCategoryItem();
                if (cat) return cat;
                return sidebarTarget(current);
            }
            if (direction === 'up') {
                return topControls.length > 0 ? topControls[0] : current;
            }
            return current;
        }

        return null;
    },

    /**
     * Handles Back key press on the Live TV page:
     * - From Preview Card -> returns to active channel in #channels-list.
     * - From Channels List -> moves left to active category in #categories-list.
     * - From Categories List -> moves to Sidebar.
     * @returns {boolean} True if the back event was handled.
     */
    handleBack: () => {
        const current = document.activeElement || document.querySelector('.focused');

        if (current && (current.id === 'livetv-preview-card' || current.closest('.livetv-preview-column'))) {
            const channel = getPreferredChannelCard();
            if (channel) {
                SpatialNav.setFocus(channel);
                return true;
            }
        }

        if (current && current.closest('#channels-list')) {
            const cat = getPreferredCategoryItem();
            if (cat) {
                SpatialNav.setFocus(cat);
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
