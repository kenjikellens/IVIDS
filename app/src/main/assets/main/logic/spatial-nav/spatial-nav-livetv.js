import { SpatialNav } from '../../gui/js/spatial-nav.js';

let lastFocusedChannelCard = null;

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
 * Checks whether the Live TV Filter Modal is currently open and visible.
 * @returns {boolean} True if #livetv-filter-modal is open.
 */
function isFilterModalOpen() {
    const modal = document.getElementById('livetv-filter-modal');
    if (!modal) return false;
    if (modal.classList.contains('hidden') || modal.style.display === 'none' || modal.style.visibility === 'hidden') return false;
    if (modal.classList.contains('active') || modal.classList.contains('is-open') || modal.classList.contains('show')) {
        return modal.offsetWidth > 0 && modal.offsetHeight > 0;
    }
    return modal.offsetParent !== null && modal.offsetWidth > 0 && modal.offsetHeight > 0;
}

/**
 * Retrieves the currently active or first focusable navigation item in the global sidebar.
 * @param {HTMLElement|null} [current] - Currently focused element.
 * @returns {HTMLElement|null} The target sidebar element.
 */
function sidebarTarget(current = null) {
    const sidebar = document.getElementById('sidebar-container');
    if (!sidebar || !isElementVisible(sidebar)) return current;
    const active = sidebar.querySelector('.nav-item.is-active.focusable, .nav-item.active.focusable');
    if (active && isElementVisible(active)) return active;
    const first = sidebar.querySelector('.nav-item.focusable');
    return (first && isElementVisible(first)) ? first : current;
}

/**
 * Retrieves visible top bar search and filter controls in logical horizontal order.
 * Includes #channel-search / #search-input, #search-clear, #livetv-filter-btn, and #livetv-xtream-btn.
 * @returns {HTMLElement[]} Array of visible interactive controls in the top bar.
 */
function getVisibleTopControls() {
    const selector = [
        '#channel-search.focusable',
        '#search-input.focusable',
        '#search-clear.focusable',
        '#livetv-filter-btn.focusable',
        '#livetv-xtream-btn.focusable',
        '.livetv-top-bar .focusable'
    ].join(', ');
    const items = Array.from(document.querySelectorAll(selector));
    const unique = Array.from(new Set(items));
    return unique.filter(isElementVisible);
}

/**
 * Retrieves visible quick filter pill buttons inside #livetv-quick-filters.
 * Includes #pill-all, #pill-sports, and #pill-favorites.
 * @returns {HTMLElement[]} Array of visible quick filter pill buttons.
 */
function getQuickFilterPills() {
    const selector = '#livetv-quick-filters .focusable, #pill-all.focusable, #pill-sports.focusable, #pill-favorites.focusable';
    const items = Array.from(document.querySelectorAll(selector));
    const unique = Array.from(new Set(items));
    return unique.filter(isElementVisible);
}

/**
 * Retrieves the active or first visible quick filter pill.
 * @returns {HTMLElement|null} Active or first quick filter pill element.
 */
function getPreferredQuickFilterPill() {
    const pills = getQuickFilterPills();
    if (pills.length === 0) return null;
    const active = pills.find(el => el.classList.contains('active') || el.classList.contains('is-active'));
    return active || pills[0];
}

/**
 * Retrieves visible channel cards in #channels-list strictly by .channel-card.focusable
 * (or legacy .channel-list-item.focusable) so nested buttons can never trap focus.
 * @returns {HTMLElement[]} Array of visible channel card elements.
 */
function getChannelCards() {
    const items = Array.from(
        document.querySelectorAll('#channels-list .channel-card.focusable, #channels-list .channel-list-item.focusable')
    );
    return items.filter(isElementVisible);
}

/**
 * Retrieves the active, last-focused, or first visible channel card in #channels-list.
 * @returns {HTMLElement|null} Target channel card element.
 */
function getPreferredChannelCard() {
    const cards = getChannelCards();
    if (cards.length === 0) return null;
    const active = cards.find(el => el.classList.contains('active') || el.classList.contains('is-active') || el.dataset.selected === 'true');
    if (active) return active;
    if (lastFocusedChannelCard && cards.includes(lastFocusedChannelCard) && isElementVisible(lastFocusedChannelCard)) {
        return lastFocusedChannelCard;
    }
    return cards[0];
}

/**
 * Handles trapped D-pad navigation strictly inside #livetv-filter-modal.
 * Navigates cleanly across chip sections (#filter-country-chips, #filter-genre-chips,
 * #filter-category-chips, #filter-source-chips) and modal action buttons.
 * @param {HTMLElement} current - Currently focused element.
 * @param {string} direction - D-pad direction ('up', 'down', 'left', 'right').
 * @returns {HTMLElement|null} Next focus target inside the filter modal.
 */
function navigateFilterModal(current, direction) {
    const modal = document.getElementById('livetv-filter-modal');
    if (!modal) return current;

    const allFocusable = Array.from(modal.querySelectorAll('.focusable')).filter(isElementVisible);
    if (allFocusable.length === 0) return current;

    if (!modal.contains(current)) {
        const activeChip = allFocusable.find(el => el.classList.contains('active'));
        return activeChip || allFocusable[0];
    }

    const closeHeaderBtn = modal.querySelector('#livetv-filter-modal-close.focusable, .modal__close.focusable');
    const chipContainers = Array.from(
        modal.querySelectorAll('#filter-country-chips, #filter-genre-chips, #filter-category-chips, #filter-source-chips, .chip-grid')
    ).filter(c => c.querySelector('.focusable'));
    const footerBtns = Array.from(
        modal.querySelectorAll(
            '.modal__footer .focusable, #filter-apply-btn.focusable, #filter-clear-btn.focusable, #filter-cancel-btn.focusable, #livetv-filter-reset-btn.focusable, #livetv-filter-close-btn.focusable'
        )
    ).filter(isElementVisible);
    const uniqueFooterBtns = Array.from(new Set(footerBtns));

    // Group elements inside a container into visual horizontal rows by top coordinate
    const groupIntoRows = (elements) => {
        const rows = [];
        elements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            let row = rows.find(r => Math.abs(r.midY - midY) < 22);
            if (!row) {
                row = { midY, items: [] };
                rows.push(row);
            }
            row.items.push(el);
        });
        rows.sort((a, b) => a.midY - b.midY);
        rows.forEach(r => r.items.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left));
        return rows.map(r => r.items);
    };

    const pickClosestHorizontally = (rowItems, refEl) => {
        if (!rowItems || rowItems.length === 0) return null;
        const refRect = refEl.getBoundingClientRect();
        const refCenterX = refRect.left + refRect.width / 2;
        let best = rowItems[0];
        let minDiff = Infinity;
        rowItems.forEach(item => {
            const r = item.getBoundingClientRect();
            const diff = Math.abs((r.left + r.width / 2) - refCenterX);
            if (diff < minDiff) {
                minDiff = diff;
                best = item;
            }
        });
        return best;
    };

    // Build ordered visual rows across the entire modal (header -> chip grids -> footer)
    const modalRows = [];
    if (closeHeaderBtn && isElementVisible(closeHeaderBtn)) {
        modalRows.push([closeHeaderBtn]);
    }
    chipContainers.forEach(container => {
        const chips = Array.from(container.querySelectorAll('.focusable')).filter(isElementVisible);
        if (chips.length > 0) {
            modalRows.push(...groupIntoRows(chips));
        }
    });
    if (uniqueFooterBtns.length > 0) {
        modalRows.push(...groupIntoRows(uniqueFooterBtns));
    }

    if (modalRows.length === 0) {
        return allFocusable[0];
    }

    let rowIdx = modalRows.findIndex(r => r.includes(current));
    if (rowIdx === -1) {
        return allFocusable[0];
    }
    const currentRow = modalRows[rowIdx];
    const colIdx = currentRow.indexOf(current);

    if (direction === 'left') {
        if (colIdx > 0) return currentRow[colIdx - 1];
        return current;
    }
    if (direction === 'right') {
        if (colIdx < currentRow.length - 1) return currentRow[colIdx + 1];
        return current;
    }
    if (direction === 'up') {
        if (rowIdx > 0) {
            const target = pickClosestHorizontally(modalRows[rowIdx - 1], current);
            if (target) {
                target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                return target;
            }
        }
        return current;
    }
    if (direction === 'down') {
        if (rowIdx < modalRows.length - 1) {
            const target = pickClosestHorizontally(modalRows[rowIdx + 1], current);
            if (target) {
                target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                return target;
            }
        }
        return current;
    }

    return current;
}

/**
 * Spatial Navigation rules for the Live TV page.
 * Manages D-pad routing across top search/filter controls, quick filter pills,
 * channel cards, EPG preview controls, filter modal trap, and global sidebar.
 */
export const spatialNavLivetv = {
    id: 'livetv',

    /**
     * Retrieves the default focus element when loading the Live TV page.
     * Prefers the filter modal if open, active quick filter pill, first channel card, or search input.
     * @returns {HTMLElement|null} The initial focus target element.
     */
    getDefaultFocus: () => {
        if (isFilterModalOpen()) {
            const modal = document.getElementById('livetv-filter-modal');
            const activeModalChip = modal?.querySelector('.chip.active.focusable, .focusable');
            if (activeModalChip && isElementVisible(activeModalChip)) return activeModalChip;
        }

        const firstChannel = getPreferredChannelCard();
        if (firstChannel) return firstChannel;

        const quickPill = getPreferredQuickFilterPill();
        if (quickPill) return quickPill;

        const topControls = getVisibleTopControls();
        if (topControls.length > 0) return topControls[0];

        return null;
    },

    /**
     * Handles custom spatial navigation focus routing for Live TV.
     * Enforces modal focus trapping and deterministic transitions between top bar,
     * quick filter pills, channel cards, preview controls, and sidebar.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
     * @returns {HTMLElement|null} The target element to focus, or null to delegate to standard calculations.
     */
    findNext: (current, direction) => {
        if (!current) return null;

        // 0. Filter Modal Focus Trap: Strictly keep all D-pad navigation inside #livetv-filter-modal when open
        if (isFilterModalOpen()) {
            return navigateFilterModal(current, direction);
        }

        // 1. Sidebar Boundary: Returning into Live TV content (Right from desktop sidebar, Up from mobile bottom nav)
        const inSidebar = current.closest('#sidebar-container') !== null;
        if (inSidebar) {
            const isMobileBottom = SpatialNav.isPortrait && SpatialNav.isPortrait();
            const shouldEnter = isMobileBottom ? (direction === 'up') : (direction === 'right');
            if (shouldEnter) {
                if (
                    SpatialNav.lastFocusedElement &&
                    document.getElementById('main-view')?.contains(SpatialNav.lastFocusedElement) &&
                    !SpatialNav.lastFocusedElement.classList.contains('channel-card__fav-btn') &&
                    isElementVisible(SpatialNav.lastFocusedElement)
                ) {
                    return SpatialNav.lastFocusedElement;
                }
                return spatialNavLivetv.getDefaultFocus();
            }
            return null;
        }

        // 2. Top Bar Controls (#channel-search / #search-input, #search-clear, #livetv-filter-btn, #livetv-xtream-btn)
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
                const pill = getPreferredQuickFilterPill();
                if (pill) return pill;
                const channel = getPreferredChannelCard();
                if (channel) return channel;
                return current;
            }
            if (direction === 'up') {
                return current;
            }
        }

        // 3. Quick Filter Pills (#pill-all, #pill-sports, #pill-favorites)
        const quickPills = getQuickFilterPills();
        const inQuickPills = quickPills.includes(current) || current.closest('#livetv-quick-filters') !== null;
        if (inQuickPills) {
            const pillIndex = quickPills.indexOf(current);

            if (direction === 'left') {
                if (pillIndex > 0) return quickPills[pillIndex - 1];
                return sidebarTarget(current);
            }
            if (direction === 'right') {
                if (pillIndex >= 0 && pillIndex < quickPills.length - 1) {
                    return quickPills[pillIndex + 1];
                }
                return current;
            }
            if (direction === 'up') {
                const searchEl = document.getElementById('channel-search') || document.getElementById('search-input');
                const filterBtn = document.getElementById('livetv-filter-btn');
                if (pillIndex > 0 && filterBtn && isElementVisible(filterBtn)) {
                    return filterBtn;
                }
                if (searchEl && isElementVisible(searchEl)) return searchEl;
                if (filterBtn && isElementVisible(filterBtn)) return filterBtn;
                return topControls.length > 0 ? topControls[0] : current;
            }
            if (direction === 'down') {
                const channel = getPreferredChannelCard();
                if (channel) return channel;
                return current;
            }
        }

        // 4. Channel List (#channels-list .channel-card.focusable)
        const parentCard = current.closest('#channels-list .channel-card.focusable, #channels-list .channel-list-item.focusable');
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
                    prev.scrollIntoView({ block: 'nearest', behavior: SpatialNav.getScrollBehavior ? SpatialNav.getScrollBehavior() : 'smooth' });
                    lastFocusedChannelCard = prev;
                    return prev;
                }
                const pill = getPreferredQuickFilterPill();
                if (pill) return pill;
                return topControls.length > 0 ? topControls[0] : current;
            }
            if (direction === 'down') {
                if (currentIndex >= 0 && currentIndex < channels.length - 1) {
                    const next = channels[currentIndex + 1];
                    next.scrollIntoView({ block: 'nearest', behavior: SpatialNav.getScrollBehavior ? SpatialNav.getScrollBehavior() : 'smooth' });
                    lastFocusedChannelCard = next;
                    return next;
                }
                return current;
            }
            if (direction === 'left') {
                return sidebarTarget(current);
            }
            if (direction === 'right') {
                const watchBtn = document.getElementById('preview-watch-btn');
                if (watchBtn && isElementVisible(watchBtn)) return watchBtn;
                const retryBtn = document.getElementById('preview-retry-btn');
                if (retryBtn && isElementVisible(retryBtn)) return retryBtn;
                const favBtn = document.getElementById('preview-fav-btn');
                if (favBtn && isElementVisible(favBtn)) return favBtn;
                return current;
            }
        }

        // 5. Preview / EPG Controls (#preview-watch-btn, #preview-fav-btn, #preview-retry-btn)
        const inPreview = current.closest('.livetv-preview-column') !== null ||
            current.id === 'preview-watch-btn' ||
            current.id === 'preview-fav-btn' ||
            current.id === 'preview-retry-btn';
        if (inPreview) {
            const watchBtn = document.getElementById('preview-watch-btn');
            const favBtn = document.getElementById('preview-fav-btn');

            if (direction === 'left') {
                if (current.id === 'preview-fav-btn' && watchBtn && isElementVisible(watchBtn)) {
                    return watchBtn;
                }
                const channel = getPreferredChannelCard();
                if (channel) return channel;
                return sidebarTarget(current);
            }
            if (direction === 'right') {
                if (current.id === 'preview-watch-btn' && favBtn && isElementVisible(favBtn)) {
                    return favBtn;
                }
                return current;
            }
            if (direction === 'up') {
                const filterBtn = document.getElementById('livetv-filter-btn');
                if (filterBtn && isElementVisible(filterBtn)) return filterBtn;
                const pill = getPreferredQuickFilterPill();
                if (pill) return pill;
                return topControls.length > 0 ? topControls[topControls.length - 1] : current;
            }
            if (direction === 'down') {
                return current;
            }
        }

        return null;
    },

    /**
     * Handles Back key press on the Live TV page.
     * Closes the filter modal if open, returns from preview/channel list to quick filters/top bar,
     * or moves focus to the global sidebar rail.
     * @returns {boolean} True if the back event was handled.
     */
    handleBack: () => {
        // 1. If Filter Modal is open, close it and return focus to #livetv-filter-btn
        if (isFilterModalOpen()) {
            const modal = document.getElementById('livetv-filter-modal');
            const closeBtn = document.getElementById('livetv-filter-close-btn') ||
                document.getElementById('filter-cancel-btn') ||
                document.getElementById('livetv-filter-modal-close');
            if (closeBtn) {
                closeBtn.click();
            } else if (modal) {
                modal.classList.remove('active', 'is-open', 'show');
                modal.classList.add('hidden');
            }
            const filterBtn = document.getElementById('livetv-filter-btn');
            if (filterBtn && isElementVisible(filterBtn)) {
                SpatialNav.setFocus(filterBtn);
            }
            return true;
        }

        const current = document.querySelector('.focused') || document.activeElement;

        // 2. If in Preview Column, return to active channel card
        if (current && current.closest('.livetv-preview-column')) {
            const channel = getPreferredChannelCard();
            if (channel) {
                SpatialNav.setFocus(channel);
                return true;
            }
        }

        // 3. If in Channel List, return to active quick filter pill or top bar
        if (current && current.closest('#channels-list')) {
            const pill = getPreferredQuickFilterPill();
            if (pill) {
                SpatialNav.setFocus(pill);
                return true;
            }
            const topControls = getVisibleTopControls();
            if (topControls.length > 0) {
                SpatialNav.setFocus(topControls[0]);
                return true;
            }
        }

        // 4. If in Quick Filter Pills or Top Bar (outside sidebar), move focus to sidebar
        if (current && !current.closest('#sidebar-container')) {
            const sidebar = sidebarTarget(null);
            if (sidebar) {
                SpatialNav.setFocus(sidebar);
                return true;
            }
        }

        return false;
    }
};
