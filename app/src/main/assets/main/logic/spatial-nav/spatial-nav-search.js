export const spatialNavSearch = {
    id: 'search',
    /**
     * Handles custom spatial navigation focus routing between search input, actions, recents, and results.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - The direction of navigation (up, down, left, right).
     * @returns {HTMLElement|null} The next element to focus, or null to fallback to default spatial calculation.
     */
    findNext: (current, direction) => {
        const scope = document;
        // Check if the current element is located within the global sidebar navigation panel
        const inSidebar = current.closest('#sidebar-container') !== null;
        const inMain = current.closest('.search-main') !== null;

        if (inSidebar) {
            if (direction === 'right') {
                const input = scope.querySelector('#search-input');
                if (input) return input;
            }
            if (direction === 'left') {
                if (current.closest('.filter-options')) {
                    if (current.textContent.trim().toLowerCase().includes('series') || current.textContent.trim().toLowerCase().includes('serie')) {
                        const moviesChip = current.previousElementSibling;
                        if (moviesChip && moviesChip.classList.contains('filter-chip')) return moviesChip;
                    }
                }
                const activeNavItem = document.querySelector('.nav-item.active') || document.querySelector('.nav-item[data-route="search"]');
                if (activeNavItem) return activeNavItem;
            }
        }

        if (inMain) {
            if (direction === 'left') {
                if (current.id === 'search-input' && !current.classList.contains('active-typing')) {
                    const activeNavItem = document.querySelector('.nav-item.active') || document.querySelector('.nav-item[data-route="search"]');
                    if (activeNavItem) return activeNavItem;
                }
            }
        }

        if (current.id === 'search-input') {
            if (direction === 'down') {
                return scope.querySelector('#search-btn') || scope.querySelector('#filter-btn');
            }
            if (direction === 'up') {
                const recentsRow = scope.querySelector('#recent-searches-row');
                if (recentsRow && !recentsRow.classList.contains('hidden')) {
                    const recentItem = scope.querySelector('.recent-item');
                    const clearBtn = scope.querySelector('#clear-recents-btn');
                    return recentItem || clearBtn;
                }
            }
        }

        if (current.id === 'search-btn') {
            if (direction === 'left') {
                const activeNavItem = document.querySelector('.nav-item.active') || document.querySelector('.nav-item[data-route="search"]');
                return activeNavItem;
            }
            if (direction === 'right') return scope.querySelector('#filter-btn');
            if (direction === 'up') return scope.querySelector('#search-input');
            if (direction === 'down') return scope.querySelector('#search-results .focusable');
        }

        if (current.id === 'filter-btn') {
            if (direction === 'left') return scope.querySelector('#search-btn');
            if (direction === 'up') return scope.querySelector('#search-input');
            if (direction === 'down') return scope.querySelector('#search-results .focusable');
        }

        if (current.closest('.recent-list') || current.id === 'clear-recents-btn') {
            if (direction === 'down') return scope.querySelector('#search-input');
        }

        if (current.closest('#search-results')) {
            if (direction === 'up' && current === scope.querySelector('#search-results .focusable')) {
                return scope.querySelector('#search-btn') || scope.querySelector('#filter-btn');
            }
        }

        return null;
    }
};
