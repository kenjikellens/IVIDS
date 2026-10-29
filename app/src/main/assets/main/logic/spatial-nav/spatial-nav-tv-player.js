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
 * @returns {boolean} True if the overlay has class 'show' and is rendered.
 */
function isOverlayVisible() {
    const overlay = document.getElementById('tv-overlay');
    if (!overlay) return false;
    if (overlay.classList.contains('hidden') || overlay.style.display === 'none' || overlay.style.visibility === 'hidden') return false;
    return overlay.classList.contains('show');
}

/**
 * Checks if the Quick EPG / Channel Guide overlay is currently open.
 * @returns {boolean} True if Quick EPG modal is open and visible.
 */
function isQuickEpgOpen() {
    const quickEpg = document.getElementById('tv-quick-epg');
    if (!quickEpg) return false;
    return quickEpg.classList.contains('is-open') || (quickEpg.style.display !== 'none' && !quickEpg.classList.contains('hidden'));
}

/**
 * Retrieves all visible channel items within the Quick EPG list.
 * @returns {HTMLElement[]} Array of focusable channel button elements.
 */
function getQuickEpgItems() {
    const list = document.getElementById('tv-quick-epg-list');
    if (!list) return [];
    return Array.from(list.querySelectorAll('.channel-list-item.focusable')).filter(isElementVisible);
}

/**
 * Retrieves the primary Play/Pause button on the TV controls overlay.
 * @returns {HTMLElement|null} Play/Pause button element.
 */
function getPlayPauseBtn() {
    return document.getElementById('tv-play-pause') || document.querySelector('.play-pause-btn.focusable');
}

/**
 * Retrieves the Back button on the TV controls overlay.
 * @returns {HTMLElement|null} Back button element.
 */
function getBackBtn() {
    return document.getElementById('tv-back');
}

/**
 * Spatial Navigation controller for the Live TV Player page.
 * Coordinates D-pad navigation across Channel OSD controls, Quick EPG channel guide,
 * fast channel zapping with Up/Down keys, and aspect ratio adjustments.
 */
export const spatialNavTvPlayer = {
    id: 'tv-player',

    /**
     * Retrieves the default focus element when loading the TV player or toggling overlays.
     * Returns the active channel in Quick EPG if open, or the primary Play/Pause button.
     * @returns {HTMLElement|null} The default focus target element.
     */
    getDefaultFocus() {
        // 1. If Quick EPG overlay is open, focus active or first channel item
        if (isQuickEpgOpen()) {
            const items = getQuickEpgItems();
            const active = items.find(el => el.classList.contains('is-active') || el.classList.contains('btn--primary'));
            if (active && isElementVisible(active)) return active;
            if (items.length > 0) return items[0];
            const closeBtn = document.getElementById('tv-epg-close');
            if (closeBtn && isElementVisible(closeBtn)) return closeBtn;
        }

        // 2. Return primary Channel OSD Play/Pause button
        const playPauseBtn = getPlayPauseBtn();
        if (playPauseBtn && isElementVisible(playPauseBtn)) {
            return playPauseBtn;
        }

        // 3. Fallback to Back button
        const backBtn = getBackBtn();
        if (backBtn && isElementVisible(backBtn)) {
            return backBtn;
        }

        return null;
    },

    /**
     * Resolves directional D-pad focus routing on the Live TV player:
     * - Quick EPG channel list navigation (trapped in guide)
     * - TV controls overlay traversal between Top Bar (#tv-back) and Bottom Controls
     * - Horizontal movement across bottom controls: Play/Pause <-> Aspect Ratio <-> EPG Guide
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigation direction ('up', 'down', 'left', 'right').
     * @returns {HTMLElement|null} Next focus target element, or current to trap focus.
     */
    findNext(current, direction) {
        if (!current) return null;

        // 1. Quick EPG Channel Guide: Focus trapped within modal channel list
        if (isQuickEpgOpen()) {
            const quickEpg = document.getElementById('tv-quick-epg');
            if (quickEpg && quickEpg.contains(current)) {
                const items = getQuickEpgItems();
                const idx = items.indexOf(current);

                if (direction === 'up') {
                    if (idx > 0) return items[idx - 1];
                    const closeBtn = document.getElementById('tv-epg-close');
                    if (closeBtn && isElementVisible(closeBtn) && idx === 0) return closeBtn;
                    return items[items.length - 1];
                }
                if (direction === 'down') {
                    if (current.id === 'tv-epg-close' && items.length > 0) return items[0];
                    if (idx >= 0 && idx < items.length - 1) return items[idx + 1];
                    return items[0];
                }
                if (direction === 'left' || direction === 'right') {
                    return current;
                }
                return current;
            }
        }

        // 2. TV Controls Overlay (Top Bar and Bottom Bar)
        if (isOverlayVisible()) {
            // Top Bar: Back button
            if (current.id === 'tv-back' || current.closest('.tv-overlay-top')) {
                if (direction === 'down') {
                    const playPause = getPlayPauseBtn();
                    if (playPause && isElementVisible(playPause)) return playPause;
                }
                return current;
            }

            // Bottom Controls Bar: Play/Pause, Aspect Ratio, EPG Button
            const bottomControls = [
                getPlayPauseBtn(),
                document.getElementById('tv-aspect-ratio'),
                document.getElementById('tv-epg-btn')
            ].filter(isElementVisible);

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
                    const backBtn = getBackBtn();
                    if (backBtn && isElementVisible(backBtn)) return backBtn;
                    return current;
                }
                if (direction === 'down') {
                    return current;
                }
            }
        }

        // When overlay is hidden, block focus movement
        return current;
    },

    /**
     * Intercepts key events for fast channel switching, quick guide toggles, and hardware media keys:
     * - Up/Down: Change channel when OSD is not focused, or navigate quick channel list
     * - Left/Right: Open Quick EPG / Channel Guide or volume/aspect ratio controls
     * - Hardware Media Keys: Play, Pause, Play/Pause, Stop
     * @param {KeyboardEvent} e - Keydown event object.
     * @param {number} keyCode - Numeric keycode.
     * @returns {boolean} True if the key event was intercepted and handled.
     */
    handleKey(e, keyCode) {
        const code = keyCode || e.keyCode;
        const key = e.key || '';

        // 1. Up / Down keys:
        if (code === 38 || key === 'ArrowUp' || key === 'Up') {
            // If Quick EPG is open, let findNext navigate the channel list
            if (isQuickEpgOpen()) {
                return false;
            }
            // If OSD is NOT visible or focused, zap channel up
            if (!isOverlayVisible()) {
                if (typeof window !== 'undefined' && typeof window.tvZapChannel === 'function') {
                    window.tvZapChannel(-1);
                }
                return true;
            }
            // If OSD is visible, allow findNext to navigate up to back button
            return false;
        }

        if (code === 40 || key === 'ArrowDown' || key === 'Down') {
            // If Quick EPG is open, let findNext navigate the channel list
            if (isQuickEpgOpen()) {
                return false;
            }
            // If OSD is NOT visible or focused, zap channel down
            if (!isOverlayVisible()) {
                if (typeof window !== 'undefined' && typeof window.tvZapChannel === 'function') {
                    window.tvZapChannel(1);
                }
                return true;
            }
            // If OSD is visible, allow findNext to navigate down from back button
            return false;
        }

        // 2. Left / Right keys:
        if (code === 37 || key === 'ArrowLeft' || key === 'Left' || code === 39 || key === 'ArrowRight' || key === 'Right') {
            // If Quick EPG is open, let user stay inside or close
            if (isQuickEpgOpen()) {
                return false;
            }
            // If OSD is hidden, Left/Right opens Quick EPG / Channel Guide
            if (!isOverlayVisible()) {
                if (typeof window !== 'undefined' && typeof window.tvToggleQuickEpg === 'function') {
                    window.tvToggleQuickEpg(true);
                }
                return true;
            }
            // If OSD is visible, let findNext navigate between controls
            return false;
        }

        // 3. Hardware TV Media Keys: Play, Pause, Play/Pause, Stop
        const isMediaPlay = code === 415 || key === 'MediaPlay';
        const isMediaPause = code === 19 || key === 'MediaPause';
        const isMediaPlayPause = code === 179 || key === 'MediaPlayPause';
        const isMediaStop = code === 413 || key === 'MediaStop';

        if (isMediaPlay || isMediaPause || isMediaPlayPause) {
            if (typeof window !== 'undefined' && typeof window.tvPlayPause === 'function') {
                window.tvPlayPause();
            }
            return true;
        }

        if (isMediaStop) {
            if (typeof window !== 'undefined' && typeof window.tvPlayPause === 'function') {
                window.tvPlayPause();
            }
            return true;
        }

        return false;
    },

    /**
     * Executes back navigation action in a multi-layered hierarchy:
     * - If Quick EPG overlay is open: close overlay and return true.
     * - If TV controls overlay is visible: hide overlay and return true.
     * - Else: return false to exit player back to Live TV guide.
     * @returns {boolean} True if handled locally, false to exit player.
     */
    handleBack() {
        // 1. If Quick EPG overlay is open: close overlay and consume back event
        if (isQuickEpgOpen()) {
            if (typeof window !== 'undefined' && typeof window.tvToggleQuickEpg === 'function') {
                window.tvToggleQuickEpg(false);
            } else {
                const q = document.getElementById('tv-quick-epg');
                if (q) {
                    q.classList.remove('is-open');
                    q.classList.add('hidden');
                    q.style.display = 'none';
                }
            }
            const playPause = getPlayPauseBtn();
            if (playPause && isElementVisible(playPause)) {
                SpatialNav.setFocus(playPause);
            }
            return true;
        }

        // 2. If TV controls overlay is visible: hide overlay and consume back event
        if (isOverlayVisible()) {
            if (typeof window !== 'undefined' && typeof window.tvHideOverlay === 'function') {
                window.tvHideOverlay();
            } else {
                const overlay = document.getElementById('tv-overlay');
                if (overlay) overlay.classList.remove('show');
            }
            return true;
        }

        // 3. Otherwise: return false to exit player back to Live TV guide
        return false;
    }
};
