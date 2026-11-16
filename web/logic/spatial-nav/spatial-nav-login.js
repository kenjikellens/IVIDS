import { SpatialNav } from '../../gui/js/spatial-nav.js';

/**
 * Checks if a DOM element is currently visible, rendered, and not hidden.
 * @param {HTMLElement|null} el - The element to check.
 * @returns {boolean} True if the element is visible.
 */
function isElementVisible(el) {
    if (!el) return false;
    if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;
    if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
    if (el.classList.contains('hidden') && el.style.display !== 'flex' && el.style.display !== 'block' && el.style.display !== 'inline-block') {
        return false;
    }
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
 * Retrieves the ordered list of candidate interactive elements on the Login page in vertical form order.
 * Dynamically resolves Server URL, Email, Username, Password/PIN, Remember Me, Submit, and Back buttons.
 * @returns {HTMLElement[]} Array of currently visible login form elements in visual order.
 */
function getVisibleLoginFormElements() {
    const candidateIds = [
        'login-server',
        'server-url',
        'login-server-url',
        'login-email',
        'login-username',
        'login-password',
        'login-pin',
        'login-remember',
        'remember-me',
        'login-remember-me',
        'login-submit',
        'login-back'
    ];

    const elements = [];
    for (const id of candidateIds) {
        const el = document.getElementById(id);
        if (el && isElementVisible(el)) {
            elements.push(el);
        }
    }

    // Include any custom remember-me toggles or additional form controls
    const rememberToggle = document.querySelector('.remember-toggle.focusable, #login-form .form-toggle.focusable');
    if (rememberToggle && isElementVisible(rememberToggle) && !elements.includes(rememberToggle)) {
        const submitBtn = document.getElementById('login-submit');
        const submitIdx = elements.indexOf(submitBtn);
        if (submitIdx !== -1) {
            elements.splice(submitIdx, 0, rememberToggle);
        } else {
            elements.push(rememberToggle);
        }
    }

    return elements;
}

/**
 * Spatial Navigation rules for the Login and Registration page.
 * Manages clean vertical traversal through server URL, username/email, password/PIN,
 * remember me, and submit buttons, handles mode switching tabs, and facilitates Enter activation.
 */
export const spatialNavLogin = {
    id: 'login',

    /**
     * Returns the default element to focus when entering the login page.
     * Prioritizes Server URL, visible Username field, Email field, or top Sign In tab.
     * @returns {HTMLElement|null} The default focusable element.
     */
    getDefaultFocus: () => {
        const byId = id => document.getElementById(id);

        const serverEl = byId('login-server') || byId('server-url') || byId('login-server-url');
        if (serverEl && isElementVisible(serverEl)) return serverEl;

        const usernameEl = byId('login-username');
        if (usernameEl && isElementVisible(usernameEl)) return usernameEl;

        const emailEl = byId('login-email');
        if (emailEl && isElementVisible(emailEl)) return emailEl;

        const firstInput = document.querySelector('#login-form input.focusable');
        if (firstInput && isElementVisible(firstInput)) return firstInput;

        const activeTab = document.querySelector('.tab-btn.is-active, .login-tab.active') || byId('login-signin-tab');
        if (activeTab && isElementVisible(activeTab)) return activeTab;

        const first = document.querySelector('.login-card-container .focusable');
        return (first && isElementVisible(first)) ? first : null;
    },

    /**
     * Determines the next focusable element based on current node and D-pad direction.
     * Manages sequential Server URL -> Username -> Password -> Remember Me -> Login Button flow.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigating direction ('left', 'right', 'up', 'down').
     * @returns {HTMLElement|null} The target element to focus, or null.
     */
    findNext: (current, direction) => {
        if (!current) return null;

        const byId = id => document.getElementById(id);
        const circleBackEl = byId('login-circle-back');
        const isCircleBackVisible = circleBackEl && isElementVisible(circleBackEl);
        const activeTab = document.querySelector('.tab-btn.is-active, .login-tab.active') || byId('login-signin-tab');

        // 1. Sidebar Boundary: Returning into Login view (Right from desktop sidebar, Up from mobile bottom nav)
        const inSidebar = current.closest('#sidebar-container') !== null;
        if (inSidebar) {
            const isMobileBottom = SpatialNav.isPortrait && SpatialNav.isPortrait();
            const shouldEnter = isMobileBottom ? (direction === 'up') : (direction === 'right');
            if (shouldEnter) {
                return spatialNavLogin.getDefaultFocus();
            }
            return null;
        }

        // 2. Top Circle Back Button
        if (current.id === 'login-circle-back') {
            if (direction === 'right' || direction === 'down') {
                return activeTab || spatialNavLogin.getDefaultFocus();
            }
            if (direction === 'left') {
                return getActiveSidebarItem();
            }
            return null;
        }

        // 3. Tab Bar: Sign In vs Register tabs
        if (current.id === 'login-signin-tab') {
            if (direction === 'right') {
                const registerTab = byId('login-register-tab');
                if (registerTab) {
                    try { registerTab.click(); } catch (e) { /* ignore */ }
                    return registerTab;
                }
                return null;
            }
            if (direction === 'left') {
                return isCircleBackVisible ? circleBackEl : getActiveSidebarItem();
            }
            if (direction === 'up') {
                return isCircleBackVisible ? circleBackEl : null;
            }
            if (direction === 'down') {
                const formElements = getVisibleLoginFormElements();
                return formElements.length > 0 ? formElements[0] : null;
            }
        }

        if (current.id === 'login-register-tab') {
            if (direction === 'left') {
                const signinTab = byId('login-signin-tab');
                if (signinTab) {
                    try { signinTab.click(); } catch (e) { /* ignore */ }
                    return signinTab;
                }
                return null;
            }
            if (direction === 'up') {
                return isCircleBackVisible ? circleBackEl : null;
            }
            if (direction === 'down') {
                const formElements = getVisibleLoginFormElements();
                return formElements.length > 0 ? formElements[0] : null;
            }
            if (direction === 'right') {
                return null;
            }
        }

        // 4. Form Controls Vertical Progression:
        // Sequence: Server URL -> Username/Email -> Password/PIN -> Remember Me -> Login Button -> Back Button
        const formElements = getVisibleLoginFormElements();
        const currentIndex = formElements.indexOf(current);

        if (currentIndex !== -1) {
            if (direction === 'down') {
                if (currentIndex < formElements.length - 1) {
                    return formElements[currentIndex + 1];
                }
                return null;
            }

            if (direction === 'up') {
                if (currentIndex > 0) {
                    return formElements[currentIndex - 1];
                }
                // At top of form inputs, navigate up to active tab or circle back
                if (activeTab && isElementVisible(activeTab)) return activeTab;
                return isCircleBackVisible ? circleBackEl : null;
            }

            if (direction === 'left') {
                // Left from inputs goes to sidebar navigation rail, or circle back if sidebar is hidden
                const sidebarItem = getActiveSidebarItem();
                if (sidebarItem) return sidebarItem;
                return isCircleBackVisible ? circleBackEl : null;
            }

            if (direction === 'right') {
                return null;
            }
        }

        return null;
    },

    /**
     * Intercepts key events on the login page to handle Enter on inputs and submit buttons.
     * Pressing Enter on an input triggers SpatialNav.activateInput to start typing.
     * Pressing Enter on the submit button triggers form submission.
     * @param {KeyboardEvent} e - Keydown event.
     * @param {number} keyCode - Numeric keycode.
     * @returns {boolean} True if handled and default event was prevented.
     */
    handleKey: (e, keyCode) => {
        const isAction = (keyCode === 13 || keyCode === 23 || keyCode === 66);
        if (!isAction) return false;

        const current = document.querySelector('.focused');
        if (!current) return false;

        // Activate input for virtual keyboard / remote typing
        if (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA') {
            if (current.readOnly) {
                e.preventDefault();
                SpatialNav.activateInput(current);
                return true;
            }
            return false;
        }

        // Submit form when Enter is pressed on submit button
        if (current.id === 'login-submit' || current.type === 'submit') {
            e.preventDefault();
            current.click();
            return true;
        }

        return false;
    },

    /**
     * Handles the Back key event on the Login page.
     * Closes active typing mode if input is being edited, or navigates back.
     * @returns {boolean} True if handled.
     */
    handleBack: () => {
        const current = document.querySelector('.focused');
        if (current && (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA') && !current.readOnly) {
            SpatialNav.deactivateInput(current);
            return true;
        }

        const circleBack = document.getElementById('login-circle-back');
        if (circleBack && isElementVisible(circleBack)) {
            circleBack.click();
            return true;
        }

        const backBtn = document.getElementById('login-back');
        if (backBtn && isElementVisible(backBtn)) {
            backBtn.click();
            return true;
        }

        return false;
    }
};
