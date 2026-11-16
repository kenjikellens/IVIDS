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
 * @param {string} [routeHint='search'] - Preferred route data attribute match.
 * @returns {HTMLElement|null} The target sidebar element.
 */
function getActiveSidebarItem(routeHint = 'search') {
    const sidebar = document.getElementById('sidebar-container');
    if (!sidebar || !isElementVisible(sidebar)) return null;
    if (routeHint) {
        const hint = sidebar.querySelector(`.nav-item[data-route="${routeHint}"].focusable`);
        if (hint && isElementVisible(hint)) return hint;
    }
    const active = sidebar.querySelector('.nav-item.is-active.focusable, .nav-item.active.focusable');
    if (active && isElementVisible(active)) return active;
    const first = sidebar.querySelector('.nav-item.focusable');
    return (first && isElementVisible(first)) ? first : null;
}

/**
 * Retrieves all visible, interactive poster card buttons within the search results grid.
 * @returns {HTMLElement[]} Array of visible card elements.
 */
function getGridCards() {
    const grid = document.getElementById('search-results');
    if (!grid || !isElementVisible(grid)) return [];
    const allCards = Array.from(grid.querySelectorAll('.card.focusable, .card--poster.focusable, .poster-wrapper.focusable, .focusable'))
        .filter(card => !card.classList.contains('has-error') && isElementVisible(card));
    const realCards = allCards.filter(card => !card.classList.contains('is-skeleton'));
    return realCards.length > 0 ? realCards : allCards;
}

/**
 * Retrieves the first card element in the search results grid.
 * @returns {HTMLElement|null} The first grid card or null.
 */
function getFirstGridCard() {
    const cards = getGridCards();
    return cards.length > 0 ? cards[0] : null;
}

/**
 * Retrieves all cards located in the top-most visual row of the search results grid.
 * @returns {HTMLElement[]} Array of card elements in row 0 of the grid.
 */
function getTopRowCards() {
    const cards = getGridCards();
    if (cards.length === 0) return [];
    const firstTop = cards[0].getBoundingClientRect().top;
    return cards.filter(c => Math.abs(c.getBoundingClientRect().top - firstTop) < 25);
}

/**
 * Finds the candidate card closest in horizontal X center position to the reference element.
 * @param {HTMLElement} fromElement - The source reference element.
 * @param {HTMLElement[]} candidateCards - Array of candidate target card elements.
 * @returns {HTMLElement|null} The horizontally closest card.
 */
function findClosestCardByX(fromElement, candidateCards) {
    if (!candidateCards || candidateCards.length === 0) return null;
    const fromRect = fromElement.getBoundingClientRect();
    const fromCenterX = fromRect.left + fromRect.width / 2;

    let best = candidateCards[0];
    let minDiff = Infinity;

    for (const c of candidateCards) {
        const rect = c.getBoundingClientRect();
        const candCenterX = rect.left + rect.width / 2;
        const diff = Math.abs(candCenterX - fromCenterX);
        if (diff < minDiff) {
            minDiff = diff;
            best = c;
        }
    }

    return best;
}

/**
 * Coordinates deterministic 2D grid navigation between cards across dynamic multi-column rows.
 * Handles left/right column traversal, up/down row transitions, and boundaries.
 * @param {HTMLElement} current - The currently focused card within #search-results.
 * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
 * @returns {HTMLElement|null} The calculated target element.
 */
function navigateGrid(current, direction) {
    const cards = getGridCards();
    if (cards.length === 0) return null;

    const currentRect = current.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const rowTolerance = Math.max(15, currentRect.height * 0.35);

    if (direction === 'left') {
        const inSameRow = cards.filter(c => c !== current && Math.abs(c.getBoundingClientRect().top - currentRect.top) < rowTolerance);
        const toLeft = inSameRow.filter(c => c.getBoundingClientRect().right <= currentRect.left + 5);

        if (toLeft.length > 0) {
            toLeft.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
            return toLeft[0];
        }

        // At column 0 (leftmost card of row) -> navigate to sidebar
        return getActiveSidebarItem('search');
    }

    if (direction === 'right') {
        const inSameRow = cards.filter(c => c !== current && Math.abs(c.getBoundingClientRect().top - currentRect.top) < rowTolerance);
        const toRight = inSameRow.filter(c => c.getBoundingClientRect().left >= currentRect.right - 5);

        if (toRight.length > 0) {
            toRight.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
            return toRight[0];
        }

        return null;
    }

    if (direction === 'up') {
        const aboveCards = cards.filter(c => c.getBoundingClientRect().top < currentRect.top - 15);

        if (aboveCards.length === 0) {
            // Top row of results -> return to action buttons or search input
            const filterBtn = document.getElementById('filter-btn');
            const searchBtn = document.getElementById('search-btn');
            const searchInput = document.getElementById('search-input');

            const filterVis = filterBtn && isElementVisible(filterBtn);
            const searchVis = searchBtn && isElementVisible(searchBtn);

            if (filterVis && searchVis) {
                const filterCenter = filterBtn.getBoundingClientRect().left + filterBtn.getBoundingClientRect().width / 2;
                const searchCenter = searchBtn.getBoundingClientRect().left + searchBtn.getBoundingClientRect().width / 2;
                return Math.abs(currentCenterX - filterCenter) < Math.abs(currentCenterX - searchCenter) ? filterBtn : searchBtn;
            }
            if (filterVis) return filterBtn;
            if (searchVis) return searchBtn;
            if (searchInput && isElementVisible(searchInput)) return searchInput;
            return null;
        }

        // Find cards in the row immediately above
        let maxTop = -Infinity;
        for (const c of aboveCards) {
            const top = c.getBoundingClientRect().top;
            if (top > maxTop) maxTop = top;
        }

        const immediateAbove = aboveCards.filter(c => Math.abs(c.getBoundingClientRect().top - maxTop) < rowTolerance);
        return findClosestCardByX(current, immediateAbove);
    }

    if (direction === 'down') {
        const belowCards = cards.filter(c => c.getBoundingClientRect().top > currentRect.top + 15);

        if (belowCards.length === 0) {
            return null;
        }

        // Find cards in the row immediately below
        let minTop = Infinity;
        for (const c of belowCards) {
            const top = c.getBoundingClientRect().top;
            if (top < minTop) minTop = top;
        }

        const immediateBelow = belowCards.filter(c => Math.abs(c.getBoundingClientRect().top - minTop) < rowTolerance);
        return findClosestCardByX(current, immediateBelow);
    }

    return null;
}

/**
 * Spatial Navigation rules for the Search page.
 * Coordinates focus between search input, recent searches, filter actions, 2D results grid, and sidebar.
 */
export const spatialNavSearch = {
    id: 'search',

    /**
     * Retrieves the default focus element when loading the Search page.
     * Prioritizes the search input field or first filter action element.
     * @returns {HTMLElement|null} The search input element or fallback focusable.
     */
    getDefaultFocus: () => {
        const input = document.getElementById('search-input');
        if (input && isElementVisible(input)) return input;
        const firstRecent = document.querySelector('#recent-list .recent-item.focusable');
        if (firstRecent && isElementVisible(firstRecent)) return firstRecent;
        return document.querySelector('.search-main .focusable');
    },

    /**
     * Calculates custom next focus node across Search page layout sections.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
     * @returns {HTMLElement|null} The targeted element, or null to trigger default search.
     */
    findNext: (current, direction) => {
        if (!current) return null;

        // 0. Modal Boundary: Delegate to SpatialNav default within open filter modals
        if (current.closest('.modal, .modal-overlay')) {
            return null;
        }

        // 1. Sidebar Boundary: Returning into Search page content
        const inSidebar = current.closest('#sidebar-container') !== null;
        if (inSidebar) {
            const isMobileBottom = SpatialNav.isPortrait && SpatialNav.isPortrait();
            const shouldEnter = isMobileBottom ? (direction === 'up') : (direction === 'right');
            if (shouldEnter) {
                if (SpatialNav.lastFocusedElement && document.getElementById('main-view')?.contains(SpatialNav.lastFocusedElement) && isElementVisible(SpatialNav.lastFocusedElement)) {
                    return SpatialNav.lastFocusedElement;
                }
                const input = document.getElementById('search-input');
                if (input && isElementVisible(input)) return input;
                return document.querySelector('.search-main .focusable');
            }
            return null;
        }

        // 2. Recent Searches Row (.recent-searches-row: clear button & recent chips)
        const inRecents = current.closest('#recent-searches-row') !== null;
        if (inRecents) {
            const recents = Array.from(document.querySelectorAll('#clear-recents-btn, #recent-list .recent-item.focusable')).filter(isElementVisible);
            const idx = recents.indexOf(current);

            if (direction === 'left') {
                if (idx > 0) return recents[idx - 1];
                return getActiveSidebarItem('search');
            }
            if (direction === 'right') {
                if (idx >= 0 && idx < recents.length - 1) return recents[idx + 1];
                return null;
            }
            if (direction === 'down') {
                const input = document.getElementById('search-input');
                if (input && isElementVisible(input)) return input;
                return null;
            }
            if (direction === 'up') {
                return null;
            }
        }

        // 3. Search Input (#search-input)
        if (current.id === 'search-input') {
            if (direction === 'left') {
                if (!current.classList.contains('active-typing')) {
                    return getActiveSidebarItem('search');
                }
                return null;
            }
            if (direction === 'right') {
                return null;
            }
            if (direction === 'up') {
                const recentsRow = document.getElementById('recent-searches-row');
                if (recentsRow && !recentsRow.classList.contains('hidden') && isElementVisible(recentsRow)) {
                    const firstRecent = document.querySelector('#recent-list .recent-item.focusable') || document.getElementById('clear-recents-btn');
                    if (firstRecent && isElementVisible(firstRecent)) return firstRecent;
                }
                return null;
            }
            if (direction === 'down') {
                const searchBtn = document.getElementById('search-btn');
                const filterBtn = document.getElementById('filter-btn');
                if (searchBtn && isElementVisible(searchBtn)) return searchBtn;
                if (filterBtn && isElementVisible(filterBtn)) return filterBtn;
                return getFirstGridCard();
            }
        }

        // 4. Action Buttons (#search-btn and #filter-btn)
        if (current.id === 'search-btn') {
            if (direction === 'left') return getActiveSidebarItem('search');
            if (direction === 'right') {
                const filterBtn = document.getElementById('filter-btn');
                if (filterBtn && isElementVisible(filterBtn)) return filterBtn;
                return null;
            }
            if (direction === 'up') return document.getElementById('search-input');
            if (direction === 'down') {
                const topRowCards = getTopRowCards();
                if (topRowCards.length > 0) {
                    return findClosestCardByX(current, topRowCards);
                }
                return null;
            }
        }

        if (current.id === 'filter-btn') {
            if (direction === 'left') {
                const searchBtn = document.getElementById('search-btn');
                if (searchBtn && isElementVisible(searchBtn)) return searchBtn;
                return getActiveSidebarItem('search');
            }
            if (direction === 'right') return null;
            if (direction === 'up') return document.getElementById('search-input');
            if (direction === 'down') {
                const topRowCards = getTopRowCards();
                if (topRowCards.length > 0) {
                    return findClosestCardByX(current, topRowCards);
                }
                return null;
            }
        }

        // 5. Search Results Grid (#search-results .card)
        if (current.closest('#search-results')) {
            return navigateGrid(current, direction);
        }

        return null;
    },

    /**
     * Intercepts back button press while browsing Search results or actions.
     * Returns focus back to the search input field before triggering router navigation.
     * @returns {boolean} True if back action was consumed, false to proceed with default handler.
     */
    handleBack: () => {
        const current = document.querySelector('.focused');
        if (current && current.closest('#search-results, .search-actions, #recent-searches-row')) {
            const input = document.getElementById('search-input');
            if (input && isElementVisible(input)) {
                SpatialNav.setFocus(input);
                return true;
            }
        }
        return false;
    }
};
