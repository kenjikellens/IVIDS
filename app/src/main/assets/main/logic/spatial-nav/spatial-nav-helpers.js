/**
 * Checks whether a DOM element is currently rendered, visible, and not hidden.
 *
 * @param {HTMLElement|null} el - Element to inspect.
 * @returns {boolean} True when the element occupies layout space and is visible.
 */
export function isElementVisible(el) {
    if (!el) return false;
    if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;
    if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
    if (el.classList.contains('hidden') && el.style.display !== 'flex' && el.style.display !== 'block' && el.style.display !== 'inline-block') {
        return false;
    }
    return true;
}

/**
 * Retrieves the preferred or currently active focusable navigation item in the global sidebar.
 *
 * @param {string|null} [routeHint=null] - Optional route data attribute match to prefer first.
 * @returns {HTMLElement|null} Target sidebar navigation element, or null if the sidebar is hidden.
 */
export function getActiveSidebarItem(routeHint = null) {
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
