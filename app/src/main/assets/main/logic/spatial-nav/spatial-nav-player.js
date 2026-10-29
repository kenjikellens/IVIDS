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
 * Checks if the player HUD overlay is currently visible to the user.
 * @returns {boolean} True if player HUD is active and visible.
 */
function isHudVisible() {
    const hud = document.getElementById('player-hud');
    if (!hud) return false;
    if (hud.classList.contains('hidden') || hud.style.display === 'none' || hud.style.visibility === 'hidden') return false;
    return hud.classList.contains('visible');
}

/**
 * Checks if the audio, subtitle, or quality modal sheet is currently open.
 * @returns {HTMLElement|null} The modal sheet element if open, or null.
 */
function getActiveModalSheet() {
    const modal = document.getElementById('player-modal-sheet') || document.querySelector('.player-modal-sheet');
    if (!modal) return null;
    const isOpen = modal.classList.contains('is-open') || (modal.style.display !== 'none' && !modal.classList.contains('hidden'));
    return isOpen ? modal : null;
}

/**
 * Retrieves all visible and focusable items inside the modal sheet.
 * @param {HTMLElement} modal - The active modal sheet element.
 * @returns {HTMLElement[]} Array of focusable option elements.
 */
function getModalItems(modal) {
    if (!modal) return [];
    return Array.from(modal.querySelectorAll('.focusable')).filter(isElementVisible);
}

/**
 * Closes the active modal sheet and restores spatial focus to the triggering OSD button.
 */
function closeModalSheet() {
    if (typeof window !== 'undefined' && typeof window.playerCloseModal === 'function') {
        window.playerCloseModal();
        return;
    }
    const modal = document.getElementById('player-modal-sheet') || document.querySelector('.player-modal-sheet');
    if (modal) {
        modal.classList.remove('is-open');
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }
    const trigger = document.getElementById('player-audio-sub') || document.getElementById('player-settings') || document.getElementById('play-pause-btn');
    if (trigger && isElementVisible(trigger)) {
        SpatialNav.setFocus(trigger);
    }
}

/**
 * Reveals the player HUD overlay and shifts spatial focus to the primary Play/Pause button.
 */
function showHudAndFocusPlayPause() {
    if (typeof window !== 'undefined' && typeof window.playerShowHud === 'function') {
        window.playerShowHud();
    } else {
        const hud = document.getElementById('player-hud');
        if (hud) {
            hud.style.display = 'flex';
            hud.classList.remove('hidden');
            hud.classList.add('visible');
        }
    }
    const playPause = document.getElementById('play-pause-btn') || document.getElementById('player-play-pause') || document.querySelector('.play-pause-btn.focusable');
    if (playPause && isElementVisible(playPause)) {
        SpatialNav.setFocus(playPause);
    }
}

/**
 * Hides the player HUD overlay immediately and shifts focus back to the video container.
 */
function hideHud() {
    if (typeof window !== 'undefined' && typeof window.playerHideHud === 'function') {
        window.playerHideHud();
    } else {
        const hud = document.getElementById('player-hud');
        if (hud) {
            hud.classList.remove('visible');
            hud.classList.add('hidden');
            hud.style.display = 'none';
        }
    }
}

/**
 * Retrieves the primary Play/Pause button element.
 * @returns {HTMLElement|null} The Play/Pause button or fallback control.
 */
function getPlayPauseBtn() {
    return document.getElementById('play-pause-btn') ||
        document.getElementById('player-play-pause') ||
        document.querySelector('.play-pause-btn.focusable') ||
        document.getElementById('player-back');
}

/**
 * Retrieves the scrub / progress bar element.
 * @returns {HTMLElement|null} The focusable progress bar element.
 */
function getProgressBar() {
    return document.getElementById('player-progress-bar') ||
        document.querySelector('.progress-bar.focusable');
}

/**
 * Retrieves the ordered list of focusable Top Bar controls (Back button, Episodes selector).
 * @returns {HTMLElement[]} Array of visible Top Bar button elements.
 */
function getTopBarControls() {
    const list = [
        document.getElementById('player-back'),
        document.getElementById('player-episodes-btn')
    ];
    return list.filter(isElementVisible);
}

/**
 * Retrieves the canonical ordered sequence of control bar buttons:
 * Previous Track -> Rewind 10s -> Play/Pause -> Fast Forward 10s -> Next Track -> Audio/Subtitles -> Settings/Quality -> Fullscreen.
 * @returns {HTMLElement[]} Array of visible control bar button elements.
 */
function getControlBarItems() {
    const orderedIds = [
        'player-prev',
        'player-rewind',
        'play-pause-btn',
        'player-forward',
        'player-next',
        'player-audio-sub',
        'player-settings',
        'player-fullscreen'
    ];
    const items = [];
    for (const id of orderedIds) {
        const el = document.getElementById(id);
        if (el && isElementVisible(el)) {
            items.push(el);
        }
    }
    return items;
}

/**
 * Retrieves all visible streaming server selection buttons.
 * @returns {HTMLElement[]} Array of server buttons.
 */
function getServerListItems() {
    return Array.from(document.querySelectorAll('#player-server-list .server-btn.focusable')).filter(isElementVisible);
}

/**
 * Spatial Navigation controller for the VOD Media Player page.
 * Implements D-pad focus routing across Top Bar, Scrub Bar, Control Bar, Server Pickers, and Modal Sheets,
 * and handles hardware TV remote media keys and multi-layered back navigation.
 */
export const spatialNavPlayer = {
    id: 'player',

    /**
     * Retrieves the default focus element when loading the player or waking up OSD.
     * Returns the primary Play/Pause button, active modal option if open, or status back button.
     * @returns {HTMLElement|null} The default focus target element.
     */
    getDefaultFocus() {
        // 1. If audio / subtitle / quality modal sheet is open, focus first focusable option
        const modal = getActiveModalSheet();
        if (modal) {
            const items = getModalItems(modal);
            const active = modal.querySelector('.modal-option.is-active, .modal-option.active');
            if (active && isElementVisible(active)) return active;
            if (items.length > 0) return items[0];
        }

        // 2. If timeout / warning status panel is visible, focus Back button
        const statusPanel = document.getElementById('player-status-panel');
        if (statusPanel && isElementVisible(statusPanel)) {
            return document.getElementById('player-status-back') || statusPanel.querySelector('.focusable');
        }

        // 3. Primary playback control: Play/Pause button
        const playPauseBtn = getPlayPauseBtn();
        if (playPauseBtn && isElementVisible(playPauseBtn)) {
            return playPauseBtn;
        }

        // 4. Fallback to any focusable element in HUD or Top Bar
        const backBtn = document.getElementById('player-back');
        if (backBtn && isElementVisible(backBtn)) return backBtn;

        const hud = document.getElementById('player-hud');
        if (hud && isElementVisible(hud)) {
            const any = hud.querySelector('.focusable');
            if (any && isElementVisible(any)) return any;
        }

        return null;
    },

    /**
     * Resolves deterministic D-pad focus transitions across OSD layers:
     * - Modal sheet focus trapping
     * - Top Bar (Back, Title, Episode selector)
     * - Scrub / Progress Bar (.progress-bar.focusable)
     * - Control Bar (Prev -> Rewind 10s -> Play/Pause -> Forward 10s -> Next -> Audio/Subtitles -> Settings -> Fullscreen)
     * - Server provider buttons
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - Navigation direction ('up', 'down', 'left', 'right').
     * @returns {HTMLElement|null} Next focus target element, or current to trap focus.
     */
    findNext(current, direction) {
        if (!current) return null;

        // 1. Modal Sheet: Strictly trap focus within the active modal sheet
        const modal = getActiveModalSheet();
        if (modal && modal.contains(current)) {
            const items = getModalItems(modal);
            const idx = items.indexOf(current);

            if (direction === 'up') {
                if (idx > 0) return items[idx - 1];
                return items[items.length - 1];
            }
            if (direction === 'down') {
                if (idx >= 0 && idx < items.length - 1) return items[idx + 1];
                return items[0];
            }
            if (direction === 'left' || direction === 'right') {
                return current;
            }
            return current;
        }

        // 2. Status Warning Panel: Navigate between Back and Settings buttons
        const statusPanel = document.getElementById('player-status-panel');
        if (statusPanel && statusPanel.contains(current)) {
            const statusBtns = Array.from(statusPanel.querySelectorAll('.btn.focusable')).filter(isElementVisible);
            const idx = statusBtns.indexOf(current);
            if (direction === 'left' && idx > 0) return statusBtns[idx - 1];
            if (direction === 'right' && idx >= 0 && idx < statusBtns.length - 1) return statusBtns[idx + 1];
            return current;
        }

        // 3. Top Bar Layer: Back button and Episodes selector
        const topBarControls = getTopBarControls();
        const inTopBar = topBarControls.includes(current) || current.closest('#hud-top-bar') !== null;
        if (inTopBar) {
            const idx = topBarControls.indexOf(current);
            if (direction === 'left') {
                if (idx > 0) return topBarControls[idx - 1];
                return current;
            }
            if (direction === 'right') {
                if (idx >= 0 && idx < topBarControls.length - 1) return topBarControls[idx + 1];
                return current;
            }
            if (direction === 'down') {
                // Moving down from Top Bar focuses the scrub/progress bar
                const progressBar = getProgressBar();
                if (progressBar && isElementVisible(progressBar)) return progressBar;
                return getPlayPauseBtn();
            }
            if (direction === 'up') {
                return current;
            }
        }

        // 4. Scrub / Progress Bar Layer: .progress-bar.focusable
        const isProgressBar = current.classList.contains('progress-bar') || current.id === 'player-progress-bar';
        if (isProgressBar) {
            if (direction === 'up') {
                // Moving up from progress bar focuses Top Bar (Back button, Title, Episode selector)
                const topControls = getTopBarControls();
                if (topControls.length > 0) return topControls[0];
                return current;
            }
            if (direction === 'down') {
                // Moving down from progress bar returns to Control Bar (Play/Pause)
                const playPause = getPlayPauseBtn();
                if (playPause && isElementVisible(playPause)) return playPause;
                const controls = getControlBarItems();
                return controls.length > 0 ? controls[0] : current;
            }
            if (direction === 'left') {
                // Seek backward 10 seconds while keeping focus on scrub bar
                if (typeof window !== 'undefined' && typeof window.playerSeek === 'function') {
                    window.playerSeek(-10);
                }
                return current;
            }
            if (direction === 'right') {
                // Seek forward 10 seconds while keeping focus on scrub bar
                if (typeof window !== 'undefined' && typeof window.playerSeek === 'function') {
                    window.playerSeek(10);
                }
                return current;
            }
        }

        // 5. Control Bar Layer:
        // Previous Track -> Rewind 10s -> Play/Pause -> Fast Forward 10s -> Next Track -> Audio/Subtitles -> Settings/Quality -> Fullscreen
        const controls = getControlBarItems();
        const inControlBar = controls.includes(current) || current.closest('#hud-control-bar') !== null;
        if (inControlBar) {
            const idx = controls.indexOf(current);

            if (direction === 'left') {
                if (idx > 0) return controls[idx - 1];
                return current;
            }
            if (direction === 'right') {
                if (idx >= 0 && idx < controls.length - 1) return controls[idx + 1];
                return current;
            }
            if (direction === 'up') {
                // Moving up from control bar focuses the scrub/progress bar
                const progressBar = getProgressBar();
                if (progressBar && isElementVisible(progressBar)) return progressBar;

                // Fallback to Top Bar if scrub bar is not rendered
                const topControls = getTopBarControls();
                if (topControls.length > 0) return topControls[0];
                return current;
            }
            if (direction === 'down') {
                // Moving down from control bar navigates to server list if visible
                const servers = getServerListItems();
                if (servers.length > 0) {
                    const activeServer = servers.find(s => s.classList.contains('active') || s.classList.contains('is-active'));
                    return activeServer || servers[0];
                }
                return current;
            }
        }

        // 6. Server Selection Buttons Layer
        const serverItems = getServerListItems();
        const inServerList = serverItems.includes(current) || current.closest('#player-server-list') !== null;
        if (inServerList) {
            const idx = serverItems.indexOf(current);

            if (direction === 'left') {
                if (idx > 0) return serverItems[idx - 1];
                return current;
            }
            if (direction === 'right') {
                if (idx >= 0 && idx < serverItems.length - 1) return serverItems[idx + 1];
                return current;
            }
            if (direction === 'up') {
                // Return to Control Bar (Settings button or Play/Pause)
                const settingsBtn = document.getElementById('player-settings');
                if (settingsBtn && isElementVisible(settingsBtn)) return settingsBtn;
                return getPlayPauseBtn() || current;
            }
            if (direction === 'down') {
                return current;
            }
        }

        // If HUD is not visible, show it and land on Play/Pause
        if (!isHudVisible()) {
            showHudAndFocusPlayPause();
            return getPlayPauseBtn();
        }

        return null;
    },

    /**
     * Handles hardware TV remote media keys and navigation key triggers when OSD is hidden.
     * @param {KeyboardEvent} e - Keydown event object.
     * @param {number} keyCode - Numeric keycode.
     * @returns {boolean} True if the key event was intercepted and handled.
     */
    handleKey(e, keyCode) {
        const code = keyCode || e.keyCode;
        const key = e.key || '';

        // 1. Navigation keys pressed while OSD is hidden: Wake up OSD and focus Play/Pause
        const isNavKey = (code >= 37 && code <= 40) || code === 13 || code === 23 || code === 66;
        if (!isHudVisible() && !getActiveModalSheet()) {
            if (isNavKey) {
                showHudAndFocusPlayPause();
                return true;
            }
        }

        // 2. Activity reset for OSD auto-hide timer
        if (isHudVisible() && typeof window !== 'undefined' && typeof window.playerResetHudTimer === 'function') {
            window.playerResetHudTimer();
        }

        // 3. Hardware TV Media Keys: Play, Pause, Play/Pause, Rewind, Fast Forward, Stop, Next, Previous
        const isMediaPlay = code === 415 || key === 'MediaPlay';
        const isMediaPause = code === 19 || key === 'MediaPause';
        const isMediaPlayPause = code === 179 || key === 'MediaPlayPause';
        const isMediaRewind = code === 412 || key === 'MediaRewind';
        const isMediaFastForward = code === 417 || key === 'MediaFastForward';
        const isMediaStop = code === 413 || key === 'MediaStop';
        const isMediaNext = key === 'MediaTrackNext';
        const isMediaPrev = key === 'MediaTrackPrevious';

        if (isMediaPlay) {
            if (typeof window !== 'undefined' && typeof window.playerTogglePlayPause === 'function') {
                window.playerTogglePlayPause();
            }
            showHudAndFocusPlayPause();
            return true;
        }

        if (isMediaPause) {
            if (typeof window !== 'undefined' && typeof window.playerTogglePlayPause === 'function') {
                window.playerTogglePlayPause();
            }
            showHudAndFocusPlayPause();
            return true;
        }

        if (isMediaPlayPause) {
            if (typeof window !== 'undefined' && typeof window.playerTogglePlayPause === 'function') {
                window.playerTogglePlayPause();
            }
            showHudAndFocusPlayPause();
            return true;
        }

        if (isMediaRewind) {
            if (typeof window !== 'undefined' && typeof window.playerSeek === 'function') {
                window.playerSeek(-10);
            }
            showHudAndFocusPlayPause();
            return true;
        }

        if (isMediaFastForward) {
            if (typeof window !== 'undefined' && typeof window.playerSeek === 'function') {
                window.playerSeek(10);
            }
            showHudAndFocusPlayPause();
            return true;
        }

        if (isMediaStop) {
            if (typeof window !== 'undefined' && typeof window.playerTogglePlayPause === 'function') {
                window.playerTogglePlayPause();
            }
            showHudAndFocusPlayPause();
            return true;
        }

        if (isMediaNext) {
            const nextBtn = document.getElementById('player-next');
            if (nextBtn) nextBtn.click();
            return true;
        }

        if (isMediaPrev) {
            const prevBtn = document.getElementById('player-prev');
            if (prevBtn) prevBtn.click();
            return true;
        }

        return false;
    },

    /**
     * Executes back navigation action in a multi-layered hierarchy:
     * - If modal/sheet is open: close sheet and return true.
     * - If OSD is visible: hide OSD and return true.
     * - If OSD is already hidden: return false (allows Router to navigate back to Details/Home).
     * @returns {boolean} True if back action was handled locally, false to exit player.
     */
    handleBack() {
        // 1. If audio / subtitle / quality modal sheet is open: close sheet and consume event
        const modal = getActiveModalSheet();
        if (modal) {
            closeModalSheet();
            return true;
        }

        // 2. If OSD is currently visible: hide OSD and consume event
        if (isHudVisible()) {
            hideHud();
            return true;
        }

        // 3. If OSD is already hidden: return false (allows Router to navigate back)
        return false;
    }
};
