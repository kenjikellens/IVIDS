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
 * Retrieves the top Back button in the TV player overlay.
 * @returns {HTMLElement|null} Back button element.
 */
function getBackBtn() {
    return document.getElementById('tv-back-btn') || document.getElementById('tv-back');
}

/**
 * Retrieves the center error Retry button if visible.
 * @returns {HTMLElement|null} Retry button element or null.
 */
function getRetryBtn() {
    const btn = document.getElementById('tv-retry-btn');
    return (btn && isElementVisible(btn)) ? btn : null;
}

/**
 * Retrieves all visible focusable controls in the bottom overlay bar in logical left-to-right DOM order.
 * @returns {HTMLElement[]} Array of visible bottom bar control elements.
 */
function getBottomControls() {
    const selector = [
        '#tv-play-pause.focusable',
        '#tv-prev-btn.focusable',
        '#tv-next-btn.focusable',
        '#tv-aspect-ratio.focusable',
        '.tv-overlay-bottom .focusable'
    ].join(', ');
    const items = Array.from(document.querySelectorAll(selector));
    const unique = Array.from(new Set(items));
    return unique.filter(isElementVisible);
}

/**
 * Spatial Navigation controller for the Live TV Player page.
 * Coordinates D-pad navigation across Channel OSD controls, fast channel zapping with Up/Down keys
 * when overlay is hidden, and tiered back navigation.
 */
export const spatialNavTvPlayer = {
    id: 'tv-player',

    /**
     * Retrieves the default focus element when loading the TV player or revealing overlays.
     * Prefers retry button if in error state, or the primary Play/Pause button (#tv-play-pause) in the bottom bar.
     * Never defaults to the Back button.
     * @returns {HTMLElement|null} The default focus target element.
     */
    getDefaultFocus() {
        // 1. If center Retry button is visible, focus it
        const retryBtn = getRetryBtn();
        if (retryBtn) return retryBtn;

        // 2. Primary focus: Play/Pause button (#tv-play-pause)
        const playPause = document.getElementById('tv-play-pause');
        if (playPause && isElementVisible(playPause)) return playPause;

        // 3. Fallback to first visible bottom control
        const bottomControls = getBottomControls();
        if (bottomControls.length > 0) return bottomControls[0];

        // 4. Ultimate fallback to Back button if no other controls exist
        const backBtn = getBackBtn();
        if (backBtn && isElementVisible(backBtn)) return backBtn;

        return null;
    },

    /**
     * Resolves directional D-pad focus routing on the Live TV player:
     * - Traversal between Top Bar (#tv-back), Center Retry, and Bottom Controls
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
            const retryBtn = getRetryBtn();
            const bottomControls = getBottomControls();

            // Top Bar: Back button (#tv-back)
            if (current === backBtn || current.closest('.tv-overlay-top')) {
                if (direction === 'down') {
                    if (retryBtn) return retryBtn;
                    const playPause = document.getElementById('tv-play-pause');
                    if (playPause && isElementVisible(playPause)) return playPause;
                    if (bottomControls.length > 0) return bottomControls[0];
                }
                return current;
            }

            // Center Error State: Retry button (#tv-retry-btn)
            if (current === retryBtn) {
                if (direction === 'up') {
                    if (backBtn && isElementVisible(backBtn)) return backBtn;
                }
                if (direction === 'down') {
                    if (bottomControls.length > 0) return bottomControls[0];
                }
                return current;
            }

            // Bottom Controls Bar
            const idx = bottomControls.indexOf(current);
            if (idx !== -1) {
                if (direction === 'left') {
                    if (idx > 0) return bottomControls[idx - 1];
                    return current;
                }
                if (direction === 'right') {
                    if (idx >= 0 && idx < bottomControls.length - 1) return bottomControls[idx + 1];
                    return current;
                }
                if (direction === 'up') {
                    if (retryBtn) return retryBtn;
                    if (backBtn && isElementVisible(backBtn)) return backBtn;
                    return current;
                }
                if (direction === 'down') {
                    return current;
                }
            }
        }

        return current;
    },

    /**
     * Intercepts key events for fast channel switching, overlay reveal, and hardware media keys:
     * - When overlay is hidden:
     *   - ArrowUp / ArrowDown: Immediately switches to previous/next channel and briefly shows banner.
     *   - Enter / Space / ArrowLeft / ArrowRight: Reveals the overlay and focuses #tv-play-pause.
     * - Hardware Media Keys: Play, Pause, Play/Pause, Stop.
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

        // When Overlay is HIDDEN or passively displayed during channel zapping (no control focused):
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
                const target = document.getElementById('tv-play-pause') || this.getDefaultFocus();
                if (target && isElementVisible(target)) {
                    SpatialNav.setFocus(target);
                }
                return true;
            }
        } else {
            // When overlay is actively focused, keep auto-hide timer alive on any key interaction
            if (typeof window !== 'undefined' && typeof window.tvResetOverlayTimer === 'function') {
                window.tvResetOverlayTimer();
            }
        }

        // Hardware TV Media Keys: Play, Pause, Play/Pause, Stop
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
     * Executes back navigation action in a multi-layered hierarchy for TV remotes:
     * - If TV controls overlay is visible: hide overlay and return true.
     * - Else (overlay is already hidden): return false so the core router exits the player back to Live TV!
     * @returns {boolean} True if handled locally, false to exit player.
     */
    handleBack() {
        // 1. If TV controls overlay is visible: hide overlay and consume back event
        if (isOverlayVisible()) {
            if (typeof window !== 'undefined' && typeof window.tvHideOverlay === 'function') {
                window.tvHideOverlay();
            } else {
                const overlay = document.getElementById('tv-overlay');
                if (overlay) overlay.classList.remove('show', 'active');
            }
            return true;
        }

        // 2. Overlay is already hidden: return false to let router exit the player back to Live TV!
        return false;
    }
};
