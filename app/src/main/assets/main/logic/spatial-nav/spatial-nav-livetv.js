/**
 * Spatial Navigation rules for the Live TV page.
 * Defines custom focus transitions between the search box, filter dropdowns, and the channel list.
 */
export const spatialNavLivetv = {
    id: 'livetv',

    /**
     * Retrieves the default focus element when loading the Live TV page.
     * @returns {HTMLElement|null} The search input element or the first focusable channel list item.
     */
    getDefaultFocus: () => {
        return document.getElementById('search-input') || document.querySelector('#channels-list .focusable');
    },

    /**
     * Handles custom spatial navigation focus routing.
     * Prevents navigation traps and ensures easy traversal between the filter header and the channels.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
     * @returns {HTMLElement|null} The target element to focus, or null to delegate to standard calculations.
     */
    findNext: (current, direction) => {
        const scope = document;

        // Custom routing from search input
        if (current.id === 'search-input') {
            if (direction === 'right') {
                return scope.getElementById('filter-genre');
            }
            if (direction === 'down') {
                return scope.querySelector('#channels-list .focusable');
            }
        }

        // Custom routing from genre filter
        if (current.id === 'filter-genre') {
            if (direction === 'left') {
                return scope.getElementById('search-input');
            }
            if (direction === 'right') {
                return scope.getElementById('filter-country');
            }
            if (direction === 'down') {
                return scope.querySelector('#channels-list .focusable');
            }
        }

        // Custom routing from country filter
        if (current.id === 'filter-country') {
            if (direction === 'left') {
                return scope.getElementById('filter-genre');
            }
            if (direction === 'down') {
                return scope.querySelector('#channels-list .focusable');
            }
        }

        // Custom routing from channels list item back up to the search input or filters
        if (current.classList.contains('channel-list-item')) {
            if (direction === 'up') {
                // If it is the first focusable channel item, navigate up to the search/filters header
                const items = Array.from(scope.querySelectorAll('#channels-list .focusable'));
                if (current === items[0]) {
                    return scope.getElementById('search-input') || scope.getElementById('filter-genre') || scope.getElementById('filter-country');
                }
            }
        }

        return null;
    }
};
