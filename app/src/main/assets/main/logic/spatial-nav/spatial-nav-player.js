import { SpatialNav } from '../../gui/js/spatial-nav.js';
import { isElementVisible } from './spatial-nav-helpers.js';

/**
 * Checks whether the VOD HUD overlay is currently visible (`show` class).
 *
 * @returns {boolean} True when #player-hud has `.show`.
 */
function isOverlayVisible() {
    const hud = document.getElementById('player-hud');
    return Boolean(hud && hud.classList.contains('show'));
}

/**
 * Checks whether the right-edge Settings sidebar is open.
 *
 * @returns {boolean} True when #player-settings-panel is visible.
 */
function isSettingsPanelOpen() {
    const panel = document.getElementById('player-settings-panel');
    return Boolean(panel && (panel.classList.contains('is-open') || panel.classList.contains('active')));
}

/**
 * Retrieves focusable items inside the open Stream Options modal (back button + setting rows).
 *
 * @returns {HTMLElement[]} Ordered modal controls.
 */
function getSettingsSidebarItems() {
    const panel = document.getElementById('player-settings-panel');
    if (!panel || !isSettingsPanelOpen()) return [];
    const backBtn = document.getElementById('player-settings-back');
    const opts = Array.from(panel.querySelectorAll('.setting-item.focusable')).filter(isElementVisible);
    return (backBtn && isElementVisible(backBtn)) ? [backBtn, ...opts] : opts;
}

/**
 * Returns visible top bar buttons (`#player-back` and `#player-settings`).
 *
 * @returns {HTMLElement[]} Visible top bar buttons.
 */
function getTopBarControls() {
    return [
        document.getElementById('player-back'),
        document.getElementById('player-settings')
    ].filter(isElementVisible);
}

/**
 * Returns visible bottom transport buttons in left-to-right order:
 * -30s -> -10s -> Play/Pause -> +10s -> +30s.
 *
 * @returns {HTMLElement[]} Visible transport buttons.
 */
function getTransportButtons() {
    return [
        'player-rewind-30',
        'player-rewind-10',
        'play-pause-btn',
        'player-forward-10',
        'player-forward-30'
    ]
        .map(id => document.getElementById(id))
        .filter(isElementVisible);
}

/**
 * Returns the bottom progress scrub bar if rendered.
 *
 * @returns {HTMLElement|null} Progress bar element or null.
 */
function getProgressBar() {
    const bar = document.getElementById('player-progress-bar');
    return isElementVisible(bar) ? bar : null;
}

/**
 * Shows the player overlay and focuses the primary Play/Pause button (or Settings button in embed mode).
 */
function showHudAndFocusPrimary() {
    if (typeof window !== 'undefined' && typeof window.playerShowHud === 'function') {
        window.playerShowHud(true);
        return;
    }
    const playPause = document.getElementById('play-pause-btn');
    const target = isElementVisible(playPause) ? playPause : document.getElementById('player-settings');
    if (target) SpatialNav.setFocus(target);
}

/**
 * Spatial Navigation controller for the Live TV-matched VOD Player:
 * - Top bar: Back (top-left) <-> Settings (top-right)
 * - Right-edge Settings sidebar (Quality, Subtitles, Audio, Server Settings)
 * - Scrub bar (-10s / +10s via Left/Right)
 * - Transport bar (-30s, -10s, Play/Pause, +10s, +30s)
 */
export const spatialNavPlayer = {
    id: 'player',

    /**
     * Resolves the initial focus element when loading or waking the VOD overlay.
     *
     * @returns {HTMLElement|null} Target focus element.
     */
    getDefaultFocus() {
        if (isSettingsPanelOpen()) {
            const items = getSettingsSidebarItems();
            const active = document.querySelector('#player-settings-options .setting-item.is-active');
            if (active && isElementVisible(active)) return active;
            if (items.length > 0) return items[0];
        }

        const statusPanel = document.getElementById('player-status-panel');
        if (statusPanel && isElementVisible(statusPanel)) {
            return document.getElementById('player-status-back') || statusPanel.querySelector('.focusable');
        }

        const playPause = document.getElementById('play-pause-btn');
        if (isElementVisible(playPause)) return playPause;

        const settingsBtn = document.getElementById('player-settings');
        if (isElementVisible(settingsBtn)) return settingsBtn;

        const backBtn = document.getElementById('player-back');
        return isElementVisible(backBtn) ? backBtn : null;
    },

    /**
     * Resolves deterministic D-pad navigation transitions between VOD overlay layers.
     *
     * @param {HTMLElement} current - Currently focused element.
     * @param {string} direction - 'up' | 'down' | 'left' | 'right'.
     * @returns {HTMLElement|null} Next focusable element.
     */
    findNext(current, direction) {
        if (!current) return null;

        // 1. Right-edge Settings Sidebar
        const panel = document.getElementById('player-settings-panel');
        if (panel && isElementVisible(panel) && panel.contains(current)) {
            const items = getSettingsSidebarItems();
            const idx = items.indexOf(current);
            if (direction === 'up') {
                return idx > 0 ? items[idx - 1] : current;
            }
            if (direction === 'down') {
                return (idx >= 0 && idx < items.length - 1) ? items[idx + 1] : current;
            }
            if (direction === 'left') {
                if (typeof window !== 'undefined' && typeof window.playerSettingsBack === 'function') {
                    window.playerSettingsBack();
                }
                return document.activeElement || document.getElementById('player-settings');
            }
            return current;
        }

        // 2. Error / Status Panel
        const statusPanel = document.getElementById('player-status-panel');
        if (statusPanel && isElementVisible(statusPanel) && statusPanel.contains(current)) {
            const btns = Array.from(statusPanel.querySelectorAll('.btn.focusable')).filter(isElementVisible);
            const idx = btns.indexOf(current);
            if (direction === 'left' && idx > 0) return btns[idx - 1];
            if (direction === 'right' && idx >= 0 && idx < btns.length - 1) return btns[idx + 1];
            return current;
        }

        // 3. Top Bar: Back <-> Settings
        const topControls = getTopBarControls();
        if (topControls.includes(current)) {
            const idx = topControls.indexOf(current);
            if (direction === 'left') return idx > 0 ? topControls[idx - 1] : current;
            if (direction === 'right') return (idx >= 0 && idx < topControls.length - 1) ? topControls[idx + 1] : current;
            if (direction === 'down') {
                return getProgressBar() || getTransportButtons().find(b => b.id === 'play-pause-btn') || current;
            }
            return current;
        }

        // 4. Scrub Bar
        if (current.id === 'player-progress-bar') {
            if (direction === 'up') {
                return document.getElementById('player-settings') || document.getElementById('player-back') || current;
            }
            if (direction === 'down') {
                return document.getElementById('play-pause-btn') || getTransportButtons()[0] || current;
            }
            if (direction === 'left') {
                if (typeof window.playerSeek === 'function') window.playerSeek(-10);
                return current;
            }
            if (direction === 'right') {
                if (typeof window.playerSeek === 'function') window.playerSeek(10);
                return current;
            }
        }

        // 5. Bottom 5-button Transport Bar (-30s, -10s, Play/Pause, +10s, +30s)
        const transport = getTransportButtons();
        if (transport.includes(current)) {
            const idx = transport.indexOf(current);
            if (direction === 'left') return idx > 0 ? transport[idx - 1] : current;
            if (direction === 'right') return (idx >= 0 && idx < transport.length - 1) ? transport[idx + 1] : current;
            if (direction === 'up') {
                return getProgressBar() || document.getElementById('player-settings') || document.getElementById('player-back') || current;
            }
            return current;
        }

        if (!isOverlayVisible()) {
            showHudAndFocusPrimary();
            return this.getDefaultFocus();
        }

        return null;
    },

    /**
     * Handles Spacebar, remote media keys, and waking up the overlay when hidden.
     *
     * @param {KeyboardEvent} e - Keydown event.
     * @param {number} keyCode - Numeric keycode.
     * @returns {boolean} True when handled.
     */
    handleKey(e, keyCode) {
        const code = keyCode || e.keyCode;
        const key = e.key || '';
        const isNavKey = (code >= 37 && code <= 40) || code === 13 || code === 23 || code === 66;

        if (!isOverlayVisible() && !isSettingsPanelOpen() && isNavKey) {
            showHudAndFocusPrimary();
            return true;
        }

        if (isOverlayVisible() && typeof window.playerResetHudTimer === 'function') {
            window.playerResetHudTimer();
        }

        if ((key === ' ' || key === 'Spacebar' || code === 32) && !isSettingsPanelOpen()) {
            const tag = (document.activeElement && document.activeElement.tagName) || '';
            if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
                e.preventDefault();
                if (typeof window.playerTogglePlayPause === 'function') window.playerTogglePlayPause();
                if (typeof window.playerShowHud === 'function') window.playerShowHud(false);
                return true;
            }
        }

        if (code === 415 || code === 19 || code === 179 || code === 413 ||
            key === 'MediaPlay' || key === 'MediaPause' || key === 'MediaPlayPause' || key === 'MediaStop') {
            if (typeof window.playerTogglePlayPause === 'function') window.playerTogglePlayPause();
            showHudAndFocusPrimary();
            return true;
        }

        if (code === 412 || key === 'MediaRewind') {
            if (typeof window.playerSeek === 'function') window.playerSeek(-10);
            showHudAndFocusPrimary();
            return true;
        }

        if (code === 417 || key === 'MediaFastForward') {
            if (typeof window.playerSeek === 'function') window.playerSeek(10);
            showHudAndFocusPrimary();
            return true;
        }

        return false;
    },

    /**
     * Layered Back key handling:
     * 1. Step back inside Settings sidebar or close sidebar if at root.
     * 2. Hide overlay if visible in D-pad mode (skip on touch/mobile so Back exits player directly).
     * 3. Return false so Router navigates back out of player.
     *
     * @returns {boolean} True if consumed locally.
     */
    handleBack() {
        if (isSettingsPanelOpen()) {
            if (typeof window.playerSettingsBack === 'function') {
                window.playerSettingsBack();
                return true;
            }
        }

        const isTouchOrMobile = SpatialNav.isMouseInteraction || SpatialNav.isPortrait();
        if (!isTouchOrMobile && isOverlayVisible()) {
            if (typeof window.playerHideHud === 'function') {
                window.playerHideHud();
                return true;
            }
        }

        return false;
    }
};
