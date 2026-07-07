/**
 * Spatial Navigation rules for the Account page.
 * Manages spatial focus boundaries and provides the initial focus element.
 */
export const spatialNavAccount = {
    id: 'account',

    /**
     * Retrieves the default focus element when loading the account page.
     * @returns {HTMLElement|null} The first visible action button inside profile-actions.
     */
    getDefaultFocus: () => {
        const actions = document.querySelectorAll('.profile-actions .focusable');
        for (const btn of actions) {
            if (btn.offsetParent !== null) {
                return btn;
            }
        }
        return null;
    },

    /**
     * Calculates custom next focus node if proximity scoring is insufficient.
     * Falls back to standard proximity navigation by returning null.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
     * @returns {HTMLElement|null} The targeted element, or null to trigger default search.
     */
    findNext: (current, direction) => {
        return null;
    }
};
