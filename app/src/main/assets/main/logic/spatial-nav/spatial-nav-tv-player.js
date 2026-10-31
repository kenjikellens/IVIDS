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
 * Retrieves the side channel panel or Quick EPG modal element.
 * @returns {HTMLElement|null} Side panel or Quick EPG container element.
 */
function getChannelGuidePanel() {
    return document.getElementById('tv-side-panel') || document.getElementById('tv-quick-epg');
}

/**
 * Checks if the side channel list panel or Quick EPG modal is currently open.
 * @returns {boolean} True if the channel guide panel is open and visible.
 */
function isChannelGuideOpen() {
    const panel = getChannelGuidePanel();
    if (!panel) return false;
    if (panel.classList.contains('hidden') || panel.style.display === 'none' || panel.style.visibility === 'hidden') return false;
    if (panel.classList.contains('is-open') || panel.classList.contains('active') || panel.classList.contains('open')) return true;
    return panel.offsetWidth > 0 && panel.offsetHeight > 0 && panel.offsetParent !== null;
}

/**
 * Retrieves all visible focusable channel items inside the side panel / Quick EPG list.
 * @returns {HTMLElement[]} Array of focusable channel list item elements.
 */
function getChannelGuideItems() {
    const list = document.getElementById('tv-channel-list') || document.getElementById('tv-quick-epg-list');
    if (!list) return [];
    return Array.from(list.querySelectorAll('.channel-list-item.focusable, .focusable')).filter(isElementVisible);
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
 * Retrieves the Channel Guide trigger button on the bottom bar.
 * @returns {HTMLElement|null} Channels/EPG button element.
 */
function getChannelsBtn() {
    return document.getElementById('tv-channels-btn') || document.getElementById('tv-epg-btn');
}

/**
 * Retrieves all visible focusable controls in the bottom overlay bar in logical left-to-right DOM order.
 * Supports #tv-play-pause, #tv-fav-btn, #tv-prev-btn, #tv-next-btn, #tv-aspect-ratio,
 * #tv-Subtitles-btn, #tv-audio-btn, #tv-epg-btn, and #tv-channels-btn.
 * @returns {HTMLElement[]} Array of visible bottom bar control elements.
 */
function getBottomControls() {
    const selector = [
        '.tv-overlay-bottom .focusable',
        '#tv-play-pause.focusable',
        '#tv-fav-btn.focusable',
        '#tv-prev-btn.focusable',
        '#tv-next-btn.focusable',
        '#tv-aspect-ratio.focusable',
        '#tv-Subtitles-btn.focusable',
        '#tv-audio-btn.focusable',
        '#tv-epg-btn.focusable',
        '#tv-channels-btn.focusable'
    ].join(', ');
    const items = Array.from(document.querySelectorAll(selector));
    const unique = Array.from(new Set(items));
    return unique.filter(isElementVisible);
}

/**
 * Spatial Navigation controller for the Live TV Player page.
 * Coordinates D-pad navigation across Channel OSD controls, Side Panel / Quick EPG channel guide,
 * fast channel zapping with Up/Down keys when overlay is hidden, and overlay visibility.
 */
export const spatialNavTvPlayer = {
    id: 'tv-player',

    /**
     * Retrieves the default focus element when loading the TV player or revealing overlays.
     * Prefers active channel in the channel guide if open, retry button if in error state,
     * or primary bottom bar controls (#tv-fav-btn, #tv-prev-btn, #tv-play-pause).
     * @returns {HTMLElement|null} The default focus target element.
     */
    getDefaultFocus() {
        // 1. If Side Panel / Quick EPG overlay is open, focus active or first channel item
        if (isChannelGuideOpen()) {
            const items = getChannelGuideItems();
            const active = items.find(el => el.classList.contains('is-active') || el.classList.contains('active') || el.classList.contains('btn--primary'));
            if (active && isElementVisible(active)) return active;
            if (items.length > 0) return items[0];
            const closeBtn = document.getElementById('tv-epg-close');
            if (closeBtn && isElementVisible(closeBtn)) return closeBtn;
        }

        // 2. If center Retry button is visible, focus it
        const retryBtn = getRetryBtn();
        if (retryBtn) return retryBtn;

        // 3. Return preferred bottom control (#tv-play-pause, #tv-fav-btn, #tv-prev-btn, or first visible bottom control)
        const playPause = document.getElementById('tv-play-pause');
        if (playPause && isElementVisible(playPause)) return playPause;

        const favBtn = document.getElementById('tv-fav-btn');
        if (favBtn && isElementVisible(favBtn)) return favBtn;

        const prevBtn = document.getElementById('tv-prev-btn');
        if (prevBtn && isElementVisible(prevBtn)) return prevBtn;

        const bottomControls = getBottomControls();
        if (bottomControls.length > 0) return bottomControls[0];

        // 4. Fallback to Back button
        const backBtn = getBackBtn();
        if (backBtn && isElementVisible(backBtn)) return backBtn;

        return null;
    },

    /**
     * Resolves directional D-pad focus routing on the Live TV player:
     * - Side Panel / Quick EPG channel list navigation (up/down in list, left closes panel)
     * - TV controls overlay traversal between Top Bar (#tv-back-btn / #tv-back), Center Retry (#tv-retry-btn), and Bottom Controls
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigation direction ('up', 'down', 'left', 'right').
     * @returns {HTMLElement|null} Next focus target element, or current to trap focus.
     */
    findNext(current, direction) {
        if (!current) return null;

        // 1. Side Panel / Quick EPG Channel Guide
        if (isChannelGuideOpen()) {
            const panel = getChannelGuidePanel();
            const items = getChannelGuideItems();
            const closeBtn = document.getElementById('tv-epg-close');

            if (panel && !panel.contains(current)) {
                const active = items.find(el => el.classList.contains('is-active') || el.classList.contains('active'));
                return active || items[0] || closeBtn || current;
            }

            const idx = items.indexOf(current);

            if (direction === 'up') {
                if (idx > 0) {
                    const prev = items[idx - 1];
                    prev.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    return prev;
                }
                if (closeBtn && isElementVisible(closeBtn) && idx === 0) return closeBtn;
                return current;
            }
            if (direction === 'down') {
                if (current === closeBtn && items.length > 0) return items[0];
                if (idx >= 0 && idx < items.length - 1) {
                    const next = items[idx + 1];
                    next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    return next;
                }
                return current;
            }
            if (direction === 'left') {
                // Closing side panel on Left and returning focus to #tv-channels-btn / #tv-epg-btn
                if (typeof window !== 'undefined' && typeof window.tvToggleQuickEpg === 'function') {
                    window.tvToggleQuickEpg(false);
                }
                const channelsBtn = getChannelsBtn();
                if (channelsBtn && isElementVisible(channelsBtn)) return channelsBtn;
                const bottomControls = getBottomControls();
                return bottomControls.length > 0 ? bottomControls[bottomControls.length - 1] : current;
            }
            if (direction === 'right') {
                return current;
            }
            return current;
        }

        // 2. TV Controls Overlay (Top Bar, Center Retry, and Bottom Bar)
        if (isOverlayVisible()) {
            if (typeof window !== 'undefined' && typeof window.tvResetOverlayTimer === 'function') {
                window.tvResetOverlayTimer();
            }

            const backBtn = getBackBtn();
            const retryBtn = getRetryBtn();
            const bottomControls = getBottomControls();

            // Top Bar: Back button (#tv-back-btn / #tv-back)
            if (current === backBtn || current.closest('.tv-overlay-top')) {
                if (direction === 'down') {
                    if (retryBtn) return retryBtn;
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
     * - When overlay & side panel are hidden:
     *   - ArrowUp / ArrowDown: Immediately switches to previous/next channel and briefly shows banner without focusing a button.
     *   - Enter / ArrowLeft / ArrowRight: Reveals the overlay and focuses the primary bottom control (#tv-fav-btn / #tv-prev-btn / #tv-play-pause).
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
        const isEnter = (code === 13 || code === 23 || code === 66 || key === 'Enter');

        // 1. If Channel Guide / Side Panel is open, let SpatialNav handle Up/Down/Left/Enter
        if (isChannelGuideOpen()) {
            return false;
        }

        // 2. When Overlay is HIDDEN or passively displayed during channel zapping (no control focused):
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
                const target = document.getElementById('tv-fav-btn') ||
                    document.getElementById('tv-prev-btn') ||
                    document.getElementById('tv-play-pause') ||
                    this.getDefaultFocus();
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

        // 3. Hardware TV Media Keys: Play, Pause, Play/Pause, Stop
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
     * Executes back navigation action in a multi-layered hierarchy:
     * - If Side Panel / Quick EPG is open: close it, focus #tv-channels-btn / #tv-epg-btn, and return true.
     * - If TV controls overlay is visible: hide overlay and return true.
     * - Else: return false to exit player back to Live TV guide.
     * @returns {boolean} True if handled locally, false to exit player.
     */
    handleBack() {
        // 1. If Side Panel / Quick EPG overlay is open: close and return focus to #tv-channels-btn / #tv-epg-btn
        if (isChannelGuideOpen()) {
            if (typeof window !== 'undefined' && typeof window.tvToggleQuickEpg === 'function') {
                window.tvToggleQuickEpg(false);
            } else {
                const panel = getChannelGuidePanel();
                if (panel) {
                    panel.classList.remove('is-open', 'active', 'open');
                    panel.classList.add('hidden');
                }
            }
            const channelsBtn = getChannelsBtn();
            if (channelsBtn && isElementVisible(channelsBtn)) {
                SpatialNav.setFocus(channelsBtn);
            }
            return true;
        }

        // 2. If TV controls overlay is visible: hide overlay and consume back event
        if (isOverlayVisible()) {
            if (typeof window !== 'undefined' && typeof window.tvHideOverlay === 'function') {
                window.tvHideOverlay();
            } else {
                const overlay = document.getElementById('tv-overlay');
                if (overlay) overlay.classList.remove('show', 'active');
            }
            return true;
        }

        // 3. Otherwise: return false to exit player back to Live TV guide
        return false;
    }
};
