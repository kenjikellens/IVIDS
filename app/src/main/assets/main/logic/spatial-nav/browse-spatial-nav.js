import { SpatialNav } from '../../gui/js/spatial-nav.js';
import { isElementVisible, getActiveSidebarItem } from './spatial-nav-helpers.js';

export { isElementVisible, getActiveSidebarItem };

/**
 * Shared OOP Spatial Navigation controller for Hero + carousel browse pages (Home, Movies, Series).
 * Eliminates duplicated D-pad geometry and row traversal logic across browse views.
 */
export class BrowseSpatialNavController {
    /**
     * Constructs a browse spatial navigation controller bound to a route ID.
     *
     * @param {string} routeId - Route identifier ('home' | 'movies' | 'series').
     */
    constructor(routeId) {
        this.id = routeId;
        this.isCarouselPage = true;
    }

    /**
     * Collects visible action buttons inside the Hero banner container.
     *
     * @returns {HTMLElement[]} Visible hero action buttons.
     */
    getHeroButtons() {
        const hero = document.getElementById('hero') || document.querySelector('.hero, .hero-content');
        if (!hero || !isElementVisible(hero)) return [];
        return Array.from(hero.querySelectorAll('.hero-buttons .focusable, .hero-actions .focusable, .btn.focusable'))
            .filter(isElementVisible);
    }

    /**
     * Collects visible carousel media rail containers across category rows.
     *
     * @returns {HTMLElement[]} Visible media rail elements.
     */
    getVisibleRails() {
        return Array.from(document.querySelectorAll('.media-rail, .row-posters')).filter(rail => {
            if (!isElementVisible(rail)) return false;
            const parentRow = rail.closest('.row, .row-container');
            if (parentRow && !isElementVisible(parentRow)) return false;
            const cards = rail.querySelectorAll('.card.focusable, .card--poster.focusable, .poster-wrapper.focusable, .focusable');
            return Array.from(cards).some(isElementVisible);
        });
    }

    /**
     * Collects visible interactive cards within a media rail, prioritizing non-skeleton cards.
     *
     * @param {HTMLElement|null} rail - Media rail container.
     * @returns {HTMLElement[]} Visible poster card elements.
     */
    getCardsInRail(rail) {
        if (!rail) return [];
        const allCards = Array.from(rail.querySelectorAll('.card.focusable, .card--poster.focusable, .poster-wrapper.focusable, .focusable'))
            .filter(card => !card.classList.contains('has-error') && isElementVisible(card));
        const realCards = allCards.filter(card => !card.classList.contains('is-skeleton'));
        return realCards.length > 0 ? realCards : allCards;
    }

    /**
     * Returns the first visible poster card from the first active media rail.
     *
     * @returns {HTMLElement|null} First card element, or null when no rails exist.
     */
    getFirstItemOfFirstRow() {
        const rails = this.getVisibleRails();
        for (const rail of rails) {
            const cards = this.getCardsInRail(rail);
            if (cards.length > 0) return cards[0];
        }
        return null;
    }

    /**
     * Finds the horizontally closest poster card inside targetRail relative to current element.
     *
     * @param {HTMLElement} current - Currently focused card.
     * @param {HTMLElement} targetRail - Target row container.
     * @returns {HTMLElement|null} Closest card element in targetRail.
     */
    findClosestCardInRail(current, targetRail) {
        const candidates = this.getCardsInRail(targetRail);
        if (candidates.length === 0) return null;

        const currentRect = current.getBoundingClientRect();
        const currentCenterX = currentRect.left + currentRect.width / 2;

        let closest = candidates[0];
        let minDiff = Infinity;
        for (let i = 0; i < candidates.length; i++) {
            const candRect = candidates[i].getBoundingClientRect();
            const diff = Math.abs((candRect.left + candRect.width / 2) - currentCenterX);
            if (diff < minDiff) {
                minDiff = diff;
                closest = candidates[i];
            }
        }
        return closest;
    }

    /**
     * Resolves the initial default focus element when opening the browse page.
     *
     * @returns {HTMLElement|null} Hero play button or first available poster card.
     */
    getDefaultFocus() {
        const playBtn = document.getElementById('play-btn');
        if (playBtn && isElementVisible(playBtn)) return playBtn;
        const heroButtons = this.getHeroButtons();
        if (heroButtons.length > 0) return heroButtons[0];
        return this.getFirstItemOfFirstRow();
    }

    /**
     * Calculates the next D-pad focus target across sidebar, hero actions, and carousel rows.
     *
     * @param {HTMLElement} current - Currently focused element.
     * @param {string} direction - Navigation direction ('left', 'right', 'up', 'down').
     * @returns {HTMLElement|null} Target focusable element, or null to defer to default SpatialNav search.
     */
    findNext(current, direction) {
        if (!current) return null;

        if (current.closest('#sidebar-container')) {
            const isMobileBottom = SpatialNav.isPortrait && SpatialNav.isPortrait();
            const shouldEnter = isMobileBottom ? (direction === 'up') : (direction === 'right');
            if (!shouldEnter) return null;

            const last = SpatialNav.lastFocusedElement;
            if (last && document.getElementById('main-view')?.contains(last) && isElementVisible(last)) {
                return last;
            }
            return this.getDefaultFocus();
        }

        if (current.closest('#hero, .hero, .hero-content, .hero-buttons, .hero-actions')) {
            const heroButtons = this.getHeroButtons();
            const idx = heroButtons.indexOf(current);
            if (direction === 'left') return idx > 0 ? heroButtons[idx - 1] : getActiveSidebarItem(this.id);
            if (direction === 'right') return (idx >= 0 && idx < heroButtons.length - 1) ? heroButtons[idx + 1] : null;
            if (direction === 'down') return this.getFirstItemOfFirstRow();
            return null;
        }

        const currentRail = current.closest('.media-rail, .row-posters');
        if (currentRail) {
            const cards = this.getCardsInRail(currentRail);
            const cardIndex = cards.indexOf(current);

            if (direction === 'left') return cardIndex <= 0 ? getActiveSidebarItem(this.id) : cards[cardIndex - 1];
            if (direction === 'right') return (cardIndex >= 0 && cardIndex < cards.length - 1) ? cards[cardIndex + 1] : null;

            if (direction === 'up') {
                const rails = this.getVisibleRails();
                const rowIndex = rails.indexOf(currentRail);
                if (rowIndex <= 0) {
                    const heroButtons = this.getHeroButtons();
                    if (heroButtons.length > 0) return heroButtons[0];
                    const playBtn = document.getElementById('play-btn');
                    return (playBtn && isElementVisible(playBtn)) ? playBtn : null;
                }
                return this.findClosestCardInRail(current, rails[rowIndex - 1]);
            }

            if (direction === 'down') {
                const rails = this.getVisibleRails();
                const rowIndex = rails.indexOf(currentRail);
                if (rowIndex >= 0 && rowIndex < rails.length - 1) {
                    return this.findClosestCardInRail(current, rails[rowIndex + 1]);
                }
            }
        }

        return null;
    }

    /**
     * Intercepts D-pad Back while browsing content rows to jump back to the Hero Play button before exiting.
     *
     * @returns {boolean} True if focus moved back to the Hero Play button.
     */
    handleBack() {
        const current = document.querySelector('.focused');
        if (current?.closest('.media-rail, .row-posters, .row')) {
            const playBtn = document.getElementById('play-btn');
            if (playBtn && isElementVisible(playBtn)) {
                SpatialNav.setFocus(playBtn);
                return true;
            }
        }
        return false;
    }
}
