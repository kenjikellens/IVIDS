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
 * @param {string} [routeHint='movies'] - Preferred route data attribute match.
 * @returns {HTMLElement|null} The target sidebar element.
 */
function getActiveSidebarItem(routeHint = 'movies') {
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
 * Retrieves visible action buttons within the Hero banner container.
 * @returns {HTMLElement[]} Array of visible Hero action button elements.
 */
function getHeroButtons() {
    const hero = document.getElementById('hero') || document.querySelector('.hero, .hero-content');
    if (!hero || !isElementVisible(hero)) return [];
    const buttons = Array.from(hero.querySelectorAll('.hero-buttons .focusable, .hero-actions .focusable, .btn.focusable'));
    return buttons.filter(btn => isElementVisible(btn));
}

/**
 * Retrieves all visible carousel media rails across movie category rows.
 * @returns {HTMLElement[]} Array of visible media rail DOM elements.
 */
function getVisibleRails() {
    const rails = Array.from(document.querySelectorAll('.media-rail, .row-posters'));
    return rails.filter(rail => {
        if (!isElementVisible(rail)) return false;
        const parentRow = rail.closest('.row, .row-container');
        if (parentRow && !isElementVisible(parentRow)) return false;
        const cards = rail.querySelectorAll('.card.focusable, .card--poster.focusable, .poster-wrapper.focusable, .focusable');
        return Array.from(cards).some(isElementVisible);
    });
}

/**
 * Retrieves all visible and interactive poster cards within a specific media rail container.
 * @param {HTMLElement|null} rail - The media rail container element.
 * @returns {HTMLElement[]} Array of visible card elements.
 */
function getCardsInRail(rail) {
    if (!rail) return [];
    const allCards = Array.from(rail.querySelectorAll('.card.focusable, .card--poster.focusable, .poster-wrapper.focusable, .focusable'))
        .filter(card => !card.classList.contains('has-error') && isElementVisible(card));
    const realCards = allCards.filter(card => !card.classList.contains('is-skeleton'));
    return realCards.length > 0 ? realCards : allCards;
}

/**
 * Retrieves the very first poster card of the first visible media rail on the Movies page.
 * @returns {HTMLElement|null} The first poster card element, or null.
 */
function getFirstItemOfFirstRow() {
    const rails = getVisibleRails();
    for (const rail of rails) {
        const cards = getCardsInRail(rail);
        if (cards.length > 0) {
            return cards[0];
        }
    }
    return null;
}

/**
 * Finds the closest poster card in a target media rail matching the horizontal position of current element.
 * @param {HTMLElement} current - The currently focused element.
 * @param {HTMLElement} targetRail - The target row media rail container.
 * @returns {HTMLElement|null} The closest card element in the target rail.
 */
function findClosestCardInRail(current, targetRail) {
    const candidates = getCardsInRail(targetRail);
    if (candidates.length === 0) return null;

    const currentRect = current.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;

    let closest = null;
    let minDiff = Infinity;

    for (let i = 0; i < candidates.length; i++) {
        const cand = candidates[i];
        const candRect = cand.getBoundingClientRect();
        const candCenterX = candRect.left + candRect.width / 2;
        const diff = Math.abs(candCenterX - currentCenterX);

        if (diff < minDiff) {
            minDiff = diff;
            closest = cand;
        }
    }

    return closest || candidates[0];
}

/**
 * Spatial Navigation rules for the Movies page.
 * Implements D-pad navigation for Movies Hero banner actions and multi-row carousel media rails.
 */
export const spatialNavMovies = {
    id: 'movies',
    isCarouselPage: true,

    /**
     * Retrieves the default focus element when loading the Movies page.
     * @returns {HTMLElement|null} The Hero Play button or first available focusable element.
     */
    getDefaultFocus: () => {
        const playBtn = document.getElementById('play-btn');
        if (playBtn && isElementVisible(playBtn)) return playBtn;
        const heroButtons = getHeroButtons();
        if (heroButtons.length > 0) return heroButtons[0];
        return getFirstItemOfFirstRow();
    },

    /**
     * Calculates custom next focus node across Movies page Hero banner, carousel rows, and sidebar boundaries.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
     * @returns {HTMLElement|null} The targeted element, or null to delegate to default search.
     */
    findNext: (current, direction) => {
        if (!current) return null;

        // 1. Sidebar Boundary: Returning into Movies page content (Right from desktop sidebar, Up from mobile bottom nav)
        const inSidebar = current.closest('#sidebar-container') !== null;
        if (inSidebar) {
            const isMobileBottom = SpatialNav.isPortrait && SpatialNav.isPortrait();
            const shouldEnter = isMobileBottom ? (direction === 'up') : (direction === 'right');
            if (shouldEnter) {
                if (SpatialNav.lastFocusedElement && document.getElementById('main-view')?.contains(SpatialNav.lastFocusedElement) && isElementVisible(SpatialNav.lastFocusedElement)) {
                    return SpatialNav.lastFocusedElement;
                }
                const playBtn = document.getElementById('play-btn');
                if (playBtn && isElementVisible(playBtn)) return playBtn;
                const heroButtons = getHeroButtons();
                if (heroButtons.length > 0) return heroButtons[0];
                return getFirstItemOfFirstRow();
            }
            return null;
        }

        // 2. Hero Action Buttons (Play, Details, Watchlist, etc.)
        const inHero = current.closest('#hero, .hero, .hero-content, .hero-buttons, .hero-actions') !== null;
        if (inHero) {
            const heroButtons = getHeroButtons();
            const currentIndex = heroButtons.indexOf(current);

            if (direction === 'left') {
                if (currentIndex > 0) {
                    return heroButtons[currentIndex - 1];
                }
                // Leftmost hero button navigates to active sidebar item
                return getActiveSidebarItem('movies');
            }

            if (direction === 'right') {
                if (currentIndex >= 0 && currentIndex < heroButtons.length - 1) {
                    return heroButtons[currentIndex + 1];
                }
                return null;
            }

            if (direction === 'down') {
                // Moving down from Hero buttons lands on the first item of the first poster row
                return getFirstItemOfFirstRow();
            }

            if (direction === 'up') {
                return null;
            }
        }

        // 3. Carousel Poster Rows (.media-rail / .row-posters)
        const currentRail = current.closest('.media-rail, .row-posters');
        if (currentRail) {
            const cards = getCardsInRail(currentRail);
            const cardIndex = cards.indexOf(current);

            if (direction === 'left') {
                // If on the very first poster card of the row, moving left goes to the sidebar!
                if (cardIndex <= 0) {
                    return getActiveSidebarItem('movies');
                }
                return cards[cardIndex - 1];
            }

            if (direction === 'right') {
                // Moving right focuses the next poster card in the row
                if (cardIndex >= 0 && cardIndex < cards.length - 1) {
                    return cards[cardIndex + 1];
                }
                return null;
            }

            if (direction === 'up') {
                // Moving up from Row 0 focuses the Hero action buttons.
                // Moving up from Row N focuses the corresponding/closest poster card in Row N-1.
                const rails = getVisibleRails();
                const rowIndex = rails.indexOf(currentRail);

                if (rowIndex <= 0) {
                    const heroButtons = getHeroButtons();
                    if (heroButtons.length > 0) return heroButtons[0];
                    const playBtn = document.getElementById('play-btn');
                    if (playBtn && isElementVisible(playBtn)) return playBtn;
                    return null;
                }

                const prevRail = rails[rowIndex - 1];
                return findClosestCardInRail(current, prevRail);
            }

            if (direction === 'down') {
                // Moving down from Row N focuses the corresponding/closest poster card in Row N+1.
                const rails = getVisibleRails();
                const rowIndex = rails.indexOf(currentRail);

                if (rowIndex >= 0 && rowIndex < rails.length - 1) {
                    const nextRail = rails[rowIndex + 1];
                    return findClosestCardInRail(current, nextRail);
                }

                return null;
            }
        }

        return null;
    },

    /**
     * Intercepts back button press while browsing Movies content rows.
     * Returns focus back to the Hero Play button before triggering router fallback.
     * @returns {boolean} True if back action was consumed, false to proceed with default handler.
     */
    handleBack: () => {
        const current = document.querySelector('.focused');
        const inRows = current?.closest('.media-rail, .row-posters, .row');
        if (inRows) {
            const playBtn = document.getElementById('play-btn');
            if (playBtn && isElementVisible(playBtn)) {
                SpatialNav.setFocus(playBtn);
                return true;
            }
        }
        return false;
    }
};
