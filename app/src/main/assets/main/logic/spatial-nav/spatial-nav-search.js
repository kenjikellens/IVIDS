export const spatialNavSearch = {
    id: 'search',
    findNext: (current, direction) => {
        const scope = document;
        const inSidebar = current.closest('.search-sidebar') !== null;
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
                const clearBtn = scope.querySelector('#clear-filters-btn');
                const searchInput = scope.querySelector('#search-input');
                return clearBtn || searchInput;
            }
        }

        if (current.id === 'search-input') {
            if (direction === 'right') return scope.querySelector('#search-btn');
            if (direction === 'down') {
                const firstResult = scope.querySelector('#search-results .focusable');
                const recentItem = scope.querySelector('.recent-item');
                return recentItem || firstResult;
            }
        }
        if (current.id === 'search-btn') {
            if (direction === 'left') return scope.querySelector('#search-input');
            if (direction === 'down') return scope.querySelector('#search-results .focusable') || scope.querySelector('.recent-item');
        }

        if (current.closest('#search-results')) {
            if (direction === 'up' && current === scope.querySelector('#search-results .focusable')) {
                return scope.querySelector('#search-input');
            }
        }

        return null;
    }
};
