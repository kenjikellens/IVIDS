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
 * Checks if the TV player controls overlay is currently visible.
 * @returns {boolean} True if the overlay has class 'show' or 'active' and is rendered.
 */
function isOverlayVisible() {
    const overlay = document.getElementById('tv-overlay');
    if (!overlay) return false;
    if (overlay.classList.contains('hidden') || overlay.style.display === 'none' || overlay.style.visibility === 'hidden') return false;
    return overlay.classList.contains('show') || overlay.classList.contains('active');
}

/**
 * Checks if the Stream Options panel is currently open and visible.
 * @returns {boolean} True if #tv-settings-panel is visible.
 */
function isSettingsPanelOpen() {
    const panel = document.getElementById('tv-settings-panel');
    return isElementVisible(panel);
}

/**
 * Retrieves the top-left Back button in the TV player overlay.
 * @returns {HTMLElement|null} Back button element.
 */
function getBackBtn() {
    return document.getElementById('tv-back-btn') || document.getElementById('tv-back');
}

/**
 * Retrieves the top-right Settings button in the TV player overlay.
 * @returns {HTMLElement|null} Settings button element.
 */
function getSettingsBtn() {
    const btn = document.getElementById('tv-settings-btn');
    return (btn && isElementVisible(btn)) ? btn : null;
}

/**
 * Retrieves the center offline Retry button if visible.
 * @returns {HTMLElement|null} Retry button element or null.
 */
function getRetryBtn() {
    const btn = document.getElementById('tv-retry-btn');
    return (btn && isElementVisible(btn)) ? btn : null;
}

/**
 * Retrieves all visible focusable option buttons inside the Stream Options panel.
 * @returns {HTMLElement[]} Array of option button elements.
 */
function getSettingsOptions() {
    const panel = document.getElementById('tv-settings-panel');
    if (!panel || !isElementVisible(panel)) return [];
    return Array.from(panel.querySelectorAll('.tv-opt-btn.focusable')).filter(isElementVisible);
}

/**
 * Retrieves ordered visible focusable items inside the Stream Options sidebar (close button + vertical option rows).
 * @returns {HTMLElement[]} Ordered vertical array of sidebar focus targets.
 */
function getSettingsSidebarItems() {
    const panel = document.getElementById('tv-settings-panel');
    if (!panel || !isElementVisible(panel)) return [];
    const backBtn = document.getElementById('tv-settings-back');
    const opts = Array.from(panel.querySelectorAll('.tv-opt-btn.focusable')).filter(isElementVisible);
    if (backBtn && isElementVisible(backBtn)) {
        return [backBtn, ...opts];
    }
    return opts;
}

/**
 * Spatial Navigation controller for the compact 4-item Live TV Player overlay:
 * - Top bar: #tv-back (left) <-> #tv-settings-btn (right)
 * - Right-edge Stream Options sidebar (#tv-settings-panel) linear Up/Down routing
 * - Offline Retry button (#tv-retry-btn) when stream is offline
 * - Fast channel zapping with ArrowUp/ArrowDown when overlay and sidebar are closed
 */
export const spatialNavTvPlayer = {
    id: 'tv-player',

    /**
     * Retrieves the default focus element when opening the player overlay.
     * Prefers #tv-retry-btn if offline, otherwise #tv-settings-btn (never defaults to Back).
     * @returns {HTMLElement|null} The default focus target element.
     */
    getDefaultFocus() {
        const retryBtn = getRetryBtn();
        if (retryBtn) return retryBtn;

        const settingsBtn = getSettingsBtn();
        if (settingsBtn) return settingsBtn;

        const backBtn = getBackBtn();
        if (backBtn && isElementVisible(backBtn)) return backBtn;

        return null;
    },

    /**
     * Resolves directional D-pad focus routing on the Live TV player across
     * top bar (#tv-back <-> #tv-settings-btn), Stream Options sidebar vertical list, and #tv-retry-btn.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigation direction ('up', 'down', 'left', 'right').
     * @returns {HTMLElement|null} Next focus target element, or current to trap focus.
     */
    findNext(current, direction) {
        if (!current) return null;

        if (isOverlayVisible()) {
            if (typeof window !== 'undefined' && typeof window.tvResetOverlayTimer === 'function') {
                window.tvResetOverlayTimer();
            }

            const backBtn = getBackBtn();
            const settingsBtn = getSettingsBtn();
            const retryBtn = getRetryBtn();

            // 1. Inside right-edge Stream Options sidebar (#tv-settings-panel): pure 1D vertical navigation
            if (isSettingsPanelOpen() && current.closest('#tv-settings-panel')) {
                const items = getSettingsSidebarItems();
                const idx = items.indexOf(current);
                if (idx === -1) {
                    const opts = getSettingsOptions();
                    return opts[0] || items[0] || settingsBtn || current;
                }
                if (direction === 'up') {
                    return idx > 0 ? items[idx - 1] : current;
                }
                if (direction === 'down') {
                    return idx < items.length - 1 ? items[idx + 1] : current;
                }
                return current;
            }

            // 2. Top-Left Back Button (#tv-back)
            if (current === backBtn) {
                if (direction === 'right' && settingsBtn) return settingsBtn;
                if (direction === 'down' && retryBtn) return retryBtn;
                return current;
            }

            // 3. Top-Right Settings Button (#tv-settings-btn)
            if (current === settingsBtn) {
                if (direction === 'left' && backBtn && isElementVisible(backBtn)) return backBtn;
                if (direction === 'down') {
                    if (isSettingsPanelOpen()) {
                        const opts = getSettingsOptions();
                        if (opts.length > 0) return opts[0];
                    }
                    if (retryBtn) return retryBtn;
                }
                return current;
            }

            // 4. Center Offline Retry Button (#tv-retry-btn)
            if (current === retryBtn) {
                if (direction === 'up') return settingsBtn || backBtn || current;
                if (direction === 'left' && backBtn && isElementVisible(backBtn)) return backBtn;
                if (direction === 'right' && settingsBtn) return settingsBtn;
                return current;
            }
        }

        return current;
    },

    /**
     * Intercepts key events for sidebar drawer lock/exit, fast channel zapping, overlay reveal, and media keys.
     * @param {KeyboardEvent} e - Keydown event object.
     * @param {number} keyCode - Numeric keycode.
     * @returns {boolean} True if the key event was intercepted and handled.
     */
    handleKey(e, keyCode) {
        const code = keyCode || e.keyCode;
        const key = e.key || '';

        const isUp = (code === 38 || key === 'ArrowUp' || key === 'Up');
        const isDown = (code === 40 || key === 'ArrowDown' || key === 'Down');
        const isLeft = (code === 37 || key === 'ArrowLeft' || key === 'Left');
        const isRight = (code === 39 || key === 'ArrowRight' || key === 'Right');
        const isEnter = (code === 13 || code === 23 || code === 66 || key === 'Enter' || code === 32 || key === ' ');

        // Never zap channels while Stream Options sidebar is open; Left closes drawer cleanly back to Settings button.
        if (isSettingsPanelOpen()) {
            if (typeof window !== 'undefined' && typeof window.tvResetOverlayTimer === 'function') {
                window.tvResetOverlayTimer();
            }
            const panel = document.getElementById('tv-settings-panel');
            const focusedEl = document.querySelector('.focused');
            const isInsideSidebar = Boolean(panel && focusedEl && panel.contains(focusedEl));

            if (!isInsideSidebar && (isUp || isDown || isLeft || isRight)) {
                const opts = getSettingsOptions();
                const target = opts[0] || document.getElementById('tv-settings-back');
                if (target && isElementVisible(target)) SpatialNav.setFocus(target);
                return true;
            }
            if (isInsideSidebar && isLeft) {
                if (typeof window !== 'undefined' && typeof window.tvSettingsBack === 'function') {
                    window.tvSettingsBack();
                } else if (typeof window !== 'undefined' && typeof window.tvCloseSettingsPanel === 'function') {
                    window.tvCloseSettingsPanel(true);
                } else if (panel) {
                    panel.classList.add('hidden');
                }
                return true;
            }
            if (isInsideSidebar && isRight) {
                if (focusedEl && focusedEl.dataset.submenu) {
                    focusedEl.click();
                }
                return true;
            }
            return false;
        }

        const hasFocusedOverlayControl = Boolean(document.querySelector('#tv-overlay .focused'));
        if (!isOverlayVisible() || !hasFocusedOverlayControl) {
            if (isUp) {
                if (typeof window !== 'undefined' && typeof window.tvZapChannel === 'function') {
                    window.tvZapChannel(-1);
                }
                return true;
            }
            if (isDown) {
                if (typeof window !== 'undefined' && typeof window.tvZapChannel === 'function') {
                    window.tvZapChannel(1);
                }
                return true;
            }
            if (isEnter || isLeft || isRight) {
                if (typeof window !== 'undefined' && typeof window.tvShowOverlay === 'function') {
                    window.tvShowOverlay(true);
                }
                const target = this.getDefaultFocus();
                if (target && isElementVisible(target)) {
                    SpatialNav.setFocus(target);
                }
                return true;
            }
        } else if (typeof window !== 'undefined' && typeof window.tvResetOverlayTimer === 'function') {
            window.tvResetOverlayTimer();
        }

        const isMediaPlay = code === 415 || key === 'MediaPlay';
        const isMediaPause = code === 19 || key === 'MediaPause';
        const isMediaPlayPause = code === 179 || key === 'MediaPlayPause';
        const isMediaStop = code === 413 || key === 'MediaStop';

        if (isMediaPlay || isMediaPause || isMediaPlayPause || isMediaStop) {
            if (typeof window !== 'undefined' && typeof window.tvPlayPause === 'function') {
                window.tvPlayPause();
            }
            return true;
        }

        return false;
    },

    /**
     * Executes layered Back navigation:
     * 1. If Stream Options panel is open -> close panel and focus #tv-settings-btn.
     * 2. Else if TV controls overlay is visible -> hide overlay.
     * 3. Else -> return false so router exits player back to Live TV guide.
     * @returns {boolean} True if handled locally, false to exit player.
     */
    handleBack() {
        if (isSettingsPanelOpen()) {
            if (typeof window !== 'undefined' && typeof window.tvSettingsBack === 'function') {
                window.tvSettingsBack();
            } else if (typeof window !== 'undefined' && typeof window.tvCloseSettingsPanel === 'function') {
                window.tvCloseSettingsPanel(true);
            } else {
                const panel = document.getElementById('tv-settings-panel');
                if (panel) panel.classList.add('hidden');
            }
            return true;
        }

        if (isOverlayVisible()) {
            if (typeof window !== 'undefined' && typeof window.tvHideOverlay === 'function') {
                window.tvHideOverlay();
            } else {
                const overlay = document.getElementById('tv-overlay');
                if (overlay) overlay.classList.remove('show', 'active');
            }
            return true;
        }

        return false;
    }
};
