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
 * Retrieves the list of visible tab buttons within the details tab bar.
 * @returns {HTMLElement[]} Array of visible tab button elements.
 */
function getVisibleTabs() {
    const tabs = Array.from(document.querySelectorAll('#details-tabs .tab-btn'));
    return tabs.filter(tab => isElementVisible(tab));
}

/**
 * Retrieves the active tab button, or the first visible tab button as fallback.
 * @returns {HTMLElement|null} The active tab button element.
 */
function getActiveTabBtn() {
    const active = document.querySelector('#details-tabs .tab-btn.is-active, #details-tabs .tab-btn.btn--primary');
    if (active && isElementVisible(active)) return active;
    const visibleTabs = getVisibleTabs();
    return visibleTabs.length > 0 ? visibleTabs[0] : null;
}

/**
 * Retrieves the currently visible tab content panel.
 * @returns {HTMLElement|null} The active panel DOM element.
 */
function getActiveTabPanel() {
    const panels = Array.from(document.querySelectorAll('.details-layout .tab-panel'));
    return panels.find(p => isElementVisible(p)) || null;
}

/**
 * Resolves the first focusable interactive element inside a given tab panel.
 * Checks mobile dropdown first, then desktop season list, extras, and cast.
 * @param {HTMLElement|null} panel - The panel container element.
 * @returns {HTMLElement|null} The first focusable target within the panel.
 */
function getFirstFocusableInPanel(panel) {
    if (!panel) return null;
    if (panel.id === 'panel-seasons') {
        const dropdown = panel.querySelector('#seasons-dropdown.focusable');
        if (dropdown && isElementVisible(dropdown)) return dropdown;
        const activeSeason = panel.querySelector('.season-btn.btn--primary');
        if (activeSeason && isElementVisible(activeSeason)) return activeSeason;
        const firstSeason = panel.querySelector('.season-btn.focusable');
        if (firstSeason && isElementVisible(firstSeason)) return firstSeason;
    } else if (panel.id === 'panel-extra') {
        const firstExtra = panel.querySelector('.disney-extra-item.focusable');
        if (firstExtra && isElementVisible(firstExtra)) return firstExtra;
    } else if (panel.id === 'panel-about') {
        const firstCast = panel.querySelector('.disney-cast-card.focusable');
        if (firstCast && isElementVisible(firstCast)) return firstCast;
    }
    const anyFocusable = panel.querySelector('.focusable');
    return (anyFocusable && isElementVisible(anyFocusable)) ? anyFocusable : null;
}

/**
 * Finds the closest focusable cast card in an adjacent grid row (above or below).
 * Works across responsive desktop and mobile multi-column layouts.
 * @param {HTMLElement} current - The currently focused cast card.
 * @param {string} direction - 'up' or 'down'.
 * @returns {HTMLElement|null} The target cast card in the adjacent row.
 */
function findAdjacentCastCard(current, direction) {
    const grid = current.closest('#about-cast');
    if (!grid) return null;
    const cards = Array.from(grid.querySelectorAll('.disney-cast-card.focusable')).filter(isElementVisible);
    if (cards.length === 0) return null;

    const currentRect = current.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;

    let targetCard = null;
    let minDistance = Infinity;

    for (const card of cards) {
        if (card === current) continue;
        const rect = card.getBoundingClientRect();
        const dy = rect.top - currentRect.top;

        if (direction === 'down' && dy > 15) {
            const dx = Math.abs((rect.left + rect.width / 2) - currentCenterX);
            const dist = dy * 10 + dx;
            if (dist < minDistance) {
                minDistance = dist;
                targetCard = card;
            }
        } else if (direction === 'up' && dy < -15) {
            const dx = Math.abs((rect.left + rect.width / 2) - currentCenterX);
            const dist = Math.abs(dy) * 10 + dx;
            if (dist < minDistance) {
                minDistance = dist;
                targetCard = card;
            }
        }
    }

    return targetCard;
}

/**
 * Spatial Navigation rules for the Details page.
 * Manages deterministic D-pad focus routing between hero actions, tabs, seasons, extras, and cast,
 * adapting dynamically to both desktop horizontal rows and mobile vertical stacked layouts.
 */
export const spatialNavDetails = {
    id: 'details',

    /**
     * Retrieves the default focus element when loading the details page.
     * @returns {HTMLElement|null} The Details Play button.
     */
    getDefaultFocus: () => document.getElementById('details-play'),

    /**
     * Calculates custom next focus node across all Details page UI sections.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
     * @returns {HTMLElement|null} The targeted element, or null to trigger default search.
     */
    findNext: (current, direction) => {
        if (!current) return null;

        // 1. Sidebar Boundary: Returning into Details page content (Right from desktop sidebar, Up from mobile bottom nav)
        const inSidebar = current.closest('#sidebar-container') !== null;
        if (inSidebar) {
            if (direction === 'right' || direction === 'up') {
                if (SpatialNav.lastFocusedElement && document.getElementById('main-view')?.contains(SpatialNav.lastFocusedElement) && isElementVisible(SpatialNav.lastFocusedElement)) {
                    return SpatialNav.lastFocusedElement;
                }
                const playBtn = document.getElementById('details-play');
                if (playBtn && isElementVisible(playBtn)) return playBtn;
                return getActiveTabBtn();
            }
            return null;
        }

        // 2. Genre Chips: Traversal across genre chips above the overview
        const inGenres = current.closest('#details-genres') !== null;
        if (inGenres) {
            if (direction === 'left') {
                const prev = current.previousElementSibling;
                if (prev && prev.classList.contains('chip--genre') && isElementVisible(prev)) return prev;
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                const next = current.nextElementSibling;
                if (next && next.classList.contains('chip--genre') && isElementVisible(next)) return next;
                return null;
            }
            if (direction === 'down') {
                const playBtn = document.getElementById('details-play');
                if (playBtn && isElementVisible(playBtn)) return playBtn;
                return null;
            }
            if (direction === 'up') {
                return null;
            }
        }

        // 3. Hero Action Buttons: Play, Trailer, Add to Playlist (Desktop Row & Mobile Column)
        const inActions = current.closest('.details-actions') !== null;
        if (inActions) {
            const actions = Array.from(document.querySelectorAll('.details-actions .btn.focusable')).filter(isElementVisible);
            const currentIndex = actions.indexOf(current);
            const isVertical = actions.length > 1 && Math.abs(actions[0].getBoundingClientRect().left - actions[1].getBoundingClientRect().left) < 15;

            if (isVertical) {
                // Mobile stacked layout: Up/Down moves between buttons, Left goes to sidebar
                if (direction === 'up') {
                    if (currentIndex > 0) return actions[currentIndex - 1];
                    const firstGenre = document.querySelector('#details-genres .chip--genre.focusable');
                    if (firstGenre && isElementVisible(firstGenre)) return firstGenre;
                    return null;
                }
                if (direction === 'down') {
                    if (currentIndex >= 0 && currentIndex < actions.length - 1) return actions[currentIndex + 1];
                    return getActiveTabBtn();
                }
                if (direction === 'left') {
                    return getActiveSidebarItem();
                }
                if (direction === 'right') {
                    return null;
                }
            } else {
                // Desktop horizontal row layout: Left/Right moves between buttons, Down moves to tabs
                if (direction === 'left') {
                    if (currentIndex > 0) return actions[currentIndex - 1];
                    return getActiveSidebarItem();
                }
                if (direction === 'right') {
                    if (currentIndex >= 0 && currentIndex < actions.length - 1) return actions[currentIndex + 1];
                    return null;
                }
                if (direction === 'up') {
                    const firstGenre = document.querySelector('#details-genres .chip--genre.focusable');
                    if (firstGenre && isElementVisible(firstGenre)) return firstGenre;
                    return null;
                }
                if (direction === 'down') {
                    return getActiveTabBtn();
                }
            }
        }

        // 4. Tab Bar Buttons: Seasons, Extra, About
        const inTabs = current.closest('#details-tabs') !== null;
        if (inTabs) {
            const visibleTabs = getVisibleTabs();
            const currentIndex = visibleTabs.indexOf(current);

            if (direction === 'left') {
                if (currentIndex > 0) {
                    const prevTab = visibleTabs[currentIndex - 1];
                    try { prevTab.click(); } catch (e) { /* ignore */ }
                    return prevTab;
                }
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                if (currentIndex >= 0 && currentIndex < visibleTabs.length - 1) {
                    const nextTab = visibleTabs[currentIndex + 1];
                    try { nextTab.click(); } catch (e) { /* ignore */ }
                    return nextTab;
                }
                return null;
            }
            if (direction === 'up') {
                const actions = Array.from(document.querySelectorAll('.details-actions .btn.focusable')).filter(isElementVisible);
                if (actions.length > 0) {
                    const isVertical = actions.length > 1 && Math.abs(actions[0].getBoundingClientRect().left - actions[1].getBoundingClientRect().left) < 15;
                    // On mobile (vertical stack), land on the bottom action button closest to tabs.
                    // On desktop (horizontal row), land on the primary "Play" button (actions[0]).
                    return isVertical ? actions[actions.length - 1] : actions[0];
                }
                const playBtn = document.getElementById('details-play');
                if (playBtn && isElementVisible(playBtn)) return playBtn;
                return null;
            }
            if (direction === 'down') {
                try { current.click(); } catch (e) { /* ignore */ }
                const panel = getActiveTabPanel();
                const target = getFirstFocusableInPanel(panel);
                if (target) return target;
                return current;
            }
        }

        // 5a. Seasons Panel: Mobile Seasons Dropdown (<select id="seasons-dropdown">)
        const isSeasonsDropdown = current.id === 'seasons-dropdown' || current.closest('.seasons-dropdown-wrapper') !== null;
        if (isSeasonsDropdown) {
            if (direction === 'up') {
                return document.getElementById('tab-seasons') || getActiveTabBtn();
            }
            if (direction === 'down') {
                const firstEpisode = document.querySelector('#details-episodes .disney-episode-item.focusable');
                if (firstEpisode && isElementVisible(firstEpisode)) return firstEpisode;
                return null;
            }
            if (direction === 'left') {
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                return null;
            }
        }

        // 5b. Seasons Panel: Desktop Season buttons list (left column)
        const inSeasonsList = current.closest('#seasons-list') !== null;
        if (inSeasonsList) {
            const seasons = Array.from(document.querySelectorAll('#seasons-list .season-btn.focusable')).filter(isElementVisible);
            const currentIndex = seasons.indexOf(current);

            if (direction === 'up') {
                if (currentIndex > 0) return seasons[currentIndex - 1];
                return document.getElementById('tab-seasons') || getActiveTabBtn();
            }
            if (direction === 'down') {
                if (currentIndex >= 0 && currentIndex < seasons.length - 1) return seasons[currentIndex + 1];
                return null;
            }
            if (direction === 'right') {
                const watched = document.querySelector('#details-episodes .disney-episode-item.watched.focusable');
                if (watched && isElementVisible(watched)) return watched;
                const firstEpisode = document.querySelector('#details-episodes .disney-episode-item.focusable');
                if (firstEpisode && isElementVisible(firstEpisode)) return firstEpisode;
                return null;
            }
            if (direction === 'left') {
                return getActiveSidebarItem();
            }
        }

        // 6. Seasons Panel: Episodes list (right column or mobile stacked list)
        const inEpisodesList = current.closest('#details-episodes') !== null;
        if (inEpisodesList) {
            const episodes = Array.from(document.querySelectorAll('#details-episodes .disney-episode-item.focusable')).filter(isElementVisible);
            const currentIndex = episodes.indexOf(current);

            if (direction === 'up') {
                if (currentIndex > 0) return episodes[currentIndex - 1];
                // On mobile, top episode navigates up to the seasons dropdown
                const dropdown = document.getElementById('seasons-dropdown');
                if (dropdown && isElementVisible(dropdown)) return dropdown;
                return document.getElementById('tab-seasons') || getActiveTabBtn();
            }
            if (direction === 'down') {
                if (currentIndex >= 0 && currentIndex < episodes.length - 1) return episodes[currentIndex + 1];
                return null;
            }
            if (direction === 'left') {
                const seasonsList = document.getElementById('seasons-list');
                if (seasonsList && isElementVisible(seasonsList)) {
                    const activeSeason = seasonsList.querySelector('.season-btn.btn--primary') || seasonsList.querySelector('.season-btn.focusable');
                    if (activeSeason && isElementVisible(activeSeason)) return activeSeason;
                }
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                return null;
            }
        }

        // 7. Extras Panel: Trailers & featurettes vertical list
        const inExtrasList = current.closest('#extras-list') !== null;
        if (inExtrasList) {
            const extras = Array.from(document.querySelectorAll('#extras-list .disney-extra-item.focusable')).filter(isElementVisible);
            const currentIndex = extras.indexOf(current);

            if (direction === 'up') {
                if (currentIndex > 0) return extras[currentIndex - 1];
                return document.getElementById('tab-extra') || getActiveTabBtn();
            }
            if (direction === 'down') {
                if (currentIndex >= 0 && currentIndex < extras.length - 1) return extras[currentIndex + 1];
                return null;
            }
            if (direction === 'left') {
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                return null;
            }
        }

        // 8. About Panel: Cast & Crew grid items
        const inCastGrid = current.closest('#about-cast') !== null;
        if (inCastGrid) {
            const castCards = Array.from(document.querySelectorAll('#about-cast .disney-cast-card.focusable')).filter(isElementVisible);
            const currentIndex = castCards.indexOf(current);

            if (direction === 'left') {
                if (currentIndex > 0) {
                    const currentRect = current.getBoundingClientRect();
                    const prev = castCards[currentIndex - 1];
                    const prevRect = prev.getBoundingClientRect();
                    if (Math.abs(currentRect.top - prevRect.top) < 25) return prev;
                }
                return getActiveSidebarItem();
            }
            if (direction === 'right') {
                if (currentIndex >= 0 && currentIndex < castCards.length - 1) {
                    const currentRect = current.getBoundingClientRect();
                    const next = castCards[currentIndex + 1];
                    const nextRect = next.getBoundingClientRect();
                    if (Math.abs(currentRect.top - nextRect.top) < 25) return next;
                }
                return null;
            }
            if (direction === 'up') {
                const target = findAdjacentCastCard(current, 'up');
                if (target) return target;
                return document.getElementById('tab-about') || getActiveTabBtn();
            }
            if (direction === 'down') {
                return findAdjacentCastCard(current, 'down');
            }
        }

        return null;
    }
};
