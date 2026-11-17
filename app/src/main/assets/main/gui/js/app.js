import { Router } from './router.js';
import { SpatialNav } from './spatial-nav.js';
import { Sidebar } from '../components/sidebar/sidebar.js';
import { Splash } from './splash.js';
import { ErrorHandler } from './error-handler.js';
import { Toast, NetworkStatusOverlay } from './toast.js';
import { Api } from '../../logic/api.js';
import { getNamespacedKey } from '../../logic/account-helper.js';
import { PersistentStorage } from '../../logic/persistent-storage.js';
import { manageModal } from './utils/ui-helper.js';
import { NETWORK_CONFIG } from '../../logic/constants.js';
import { imageCache } from '../../logic/image-cache.js';
import { cacheManager } from '../../logic/cache-manager.js';
import { RippleEffect } from './ripple.js';
import { ActionDelayManager } from './action-delay.js';
import './loader.js';
import './i18n.js';

if (typeof window !== 'undefined') {
    window.SpatialNav = SpatialNav;
}

/**
 * Defers flag-emoji polyfill import until idle so initial boot bandwidth stays free for UI and API requests.
 */
const _loadFlagPolyfill = () => {
    import('https://cdn.jsdelivr.net/npm/country-flag-emoji-polyfill@0.1.7/+esm')
        .then(({ polyfillCountryFlagEmojis }) => {
            try { polyfillCountryFlagEmojis(); } catch (e) { console.warn('Failed to run flag emoji polyfill:', e); }
        })
        .catch(err => console.warn('Failed to load country-flag-emoji-polyfill script:', err));
};

if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(_loadFlagPolyfill, { timeout: 4000 });
} else {
    setTimeout(_loadFlagPolyfill, 2000);
}

/**
 * Captures uncaught runtime script errors, dismisses any blocking splash overlay, and renders ErrorHandler UI.
 */
window.onerror = function onGlobalError(message, source, lineno, colno, error) {
    console.error('Global error caught:', message, error);
    if (message === 'Script error.' || (message && message.includes('fetch'))) {
        console.warn('Ignoring likely non-critical resource/network failure');
        return true;
    }

    const errorMsg = error ? `${message}\n${error.stack}` : `${message} (${source}:${lineno}:${colno})`;
    if (typeof Splash !== 'undefined' && Splash.signalContentLoaded) Splash.signalContentLoaded();

    ErrorHandler.show(
        `${window.i18n.t('error.systemError')}:\n\n${errorMsg}`,
        () => window.location.reload(),
        window.i18n.t('error.defaultTitle')
    );
    return true;
};

/** Logs unhandled Promise rejections without interrupting active media playback. */
window.onunhandledrejection = function onGlobalRejection(event) {
    console.warn('Unhandled promise rejection:', event.reason);
};

/**
 * Coordinates native AndroidUpdate and Electron update callbacks across Settings UI, floating UpdatePrompt, and idle background downloads.
 */
class UpdateCoordinator {
    constructor() {
        this._updatePromptPromise = null;
    }

    /**
     * Reads active update mode ('auto', 'manual', 'advanced', 'none') from PersistentStorage or fallback cookies.
     *
     * @returns {string} Active update strategy identifier.
     */
    getUpdateMode() {
        try {
            const saved = PersistentStorage.getItem('ivids-settings');
            if (saved) {
                const settings = JSON.parse(saved);
                if (settings.updateMode) return settings.updateMode;
            }
            const match = document.cookie.match(/(?:^|; )updateMode=([^;]*)/);
            if (match) return decodeURIComponent(match[1]);
        } catch (e) {
            console.error('App: Failed to get update mode', e);
        }
        return 'manual';
    }

    /**
     * Lazily loads and memoizes the UpdatePrompt module so download progress callbacks avoid repeated dynamic imports.
     *
     * @returns {Promise<Object>} Resolved UpdatePrompt controller class.
     */
    getUpdatePrompt() {
        if (!this._updatePromptPromise) {
            this._updatePromptPromise = import('./update-prompt.js').then(m => m.UpdatePrompt);
        }
        return this._updatePromptPromise;
    }

    /**
     * Monitors user input inactivity and triggers silent background update installation after 5 minutes idle.
     */
    triggerAutoIdleDownload() {
        console.log('App: Auto Mode - Observing user inactivity for silent download');
        let downloadStarted = false;
        let lastActivity = Date.now();
        const onUserActivity = () => { lastActivity = Date.now(); };
        const activityEvents = ['keydown', 'mousemove', 'mousedown', 'touchstart', 'click'];
        activityEvents.forEach(evt => window.addEventListener(evt, onUserActivity, { passive: true }));

        const checkIdle = setInterval(() => {
            if (Date.now() - lastActivity <= 5 * 60 * 1000 || downloadStarted) return;
            downloadStarted = true;
            clearInterval(checkIdle);
            activityEvents.forEach(evt => window.removeEventListener(evt, onUserActivity));

            console.log('App: Auto Mode - User is idle. Commencing silent background update download!');
            if (window.AndroidUpdate) {
                window.AndroidUpdate.downloadAndInstall();
            } else if (window.ElectronAPI) {
                const downloadUrl = window.latestUpdateDownloadUrl;
                const ver = window.latestUpdateVersion;
                if (downloadUrl && ver) {
                    window.ElectronAPI.downloadPcUpdate(downloadUrl, ver)
                        .then((result) => {
                            if (result && result.status === 'downloaded') {
                                return window.ElectronAPI.installPcUpdate(result.filePath);
                            }
                            return null;
                        })
                        .catch(err => console.error('App: Auto Mode - Failed Electron idle update:', err));
                }
            }
        }, 10000);
    }

    /**
     * Renders a non-blocking update notification toast with interactive action buttons on non-TV layouts.
     *
     * @param {Object} options - Toast message, severity type, duration, actionsHtml, and mount callback.
     */
    showUpdateToast({ message, type = 'info', duration = 15000, actionsHtml = '', onMount }) {
        const title = window.i18n?.t('settings.updateNotification') || 'Update Available';
        const isTV = typeof Api !== 'undefined' && typeof Api.isTV === 'function' ? Api.isTV() : false;
        const msgHtml = isTV ? `<span>${message}</span>` : `<span>${message}</span>${actionsHtml}`;
        const toastEl = Toast.show(msgHtml, { title, type, duration, isHtml: true });
        if (toastEl && !isTV) {
            setTimeout(() => {
                if (typeof onMount === 'function') onMount(toastEl);
                if (typeof SpatialNav !== 'undefined' && SpatialNav.refocus) SpatialNav.refocus();
            }, 100);
        }
    }

    /**
     * Displays the manual update available toast with a download modal trigger.
     *
     * @param {string} version - Available release tag version string.
     */
    triggerManualToast(version) {
        this.showUpdateToast({
            message: `v${version} is available.`,
            type: 'info',
            duration: 15000,
            actionsHtml: `<div class="toast-actions btn-group"><button class="btn btn--primary focusable" id="toast-download-btn">${window.i18n?.t('settings.toast.download') || 'Download'}</button></div>`,
            onMount: (toastEl) => {
                const dlBtn = toastEl.querySelector('#toast-download-btn');
                if (dlBtn) {
                    dlBtn.onclick = (e) => {
                        e.stopPropagation();
                        Toast.hide(toastEl);
                        this.getUpdatePrompt().then(UpdatePrompt => UpdatePrompt.show(version));
                    };
                }
            }
        });
    }

    /**
     * Displays developer-mode update toast offering instant download or navigating to Settings version picker.
     *
     * @param {string} version - Available developer build tag string.
     */
    triggerDevToast(version) {
        this.showUpdateToast({
            message: `Developer version v${version} found.`,
            type: 'warning',
            duration: 20000,
            actionsHtml: `<div class="toast-actions btn-group"><button class="btn btn--primary focusable" id="toast-dev-dl-btn">${window.i18n?.t('settings.toast.download') || 'Download'}</button><button class="btn btn--secondary focusable" id="toast-dev-select-btn">${window.i18n?.t('settings.toast.select') || 'Select Version'}</button></div>`,
            onMount: (toastEl) => {
                const dlBtn = toastEl.querySelector('#toast-dev-dl-btn');
                const selectBtn = toastEl.querySelector('#toast-dev-select-btn');
                if (dlBtn) {
                    dlBtn.onclick = (e) => {
                        e.stopPropagation();
                        Toast.hide(toastEl);
                        if (window.AndroidUpdate) window.AndroidUpdate.downloadAndInstall();
                    };
                }
                if (selectBtn) {
                    selectBtn.onclick = (e) => {
                        e.stopPropagation();
                        Toast.hide(toastEl);
                        Router.navigate('settings').then(() => {
                            setTimeout(() => {
                                if (window.settingsInstance?.openVersionSelector) {
                                    window.settingsInstance.openVersionSelector();
                                }
                            }, 150);
                        });
                    };
                }
            }
        });
    }

    /**
     * Routes an update lifecycle signal either to the active Settings handler or the floating UpdatePrompt dialog.
     *
     * @param {string} settingsHandlerName - Property name on window for Settings handler callback.
     * @param {string} promptMethodName - Method name on UpdatePrompt module.
     * @param {Array} args - Arguments forwarded to the resolved handler.
     */
    _dispatchUpdateSignal(settingsHandlerName, promptMethodName, ...args) {
        const overlay = document.getElementById('update-overlay');
        const isPromptActive = overlay ? overlay.style.display === 'flex' : false;
        const settingsHandler = window[settingsHandlerName];
        if (Router.currentPage === 'settings' && typeof settingsHandler === 'function' && !isPromptActive) {
            settingsHandler(...args);
        } else {
            this.getUpdatePrompt()
                .then(UpdatePrompt => UpdatePrompt[promptMethodName](...args))
                .catch(err => console.error(`App: Failed UpdatePrompt.${promptMethodName}:`, err));
        }
    }

    /**
     * Binds global window update bridge callbacks expected by MainActivity/UpdateManager and Electron preload,
     * then launches the initial startup update check.
     */
    init() {
        window.latestFoundVersion = null;
        window.pendingUpdateVersion = null;

        window.onUpdateFound = (version) => {
            window.latestFoundVersion = version;
            const overlay = document.getElementById('update-overlay');
            const isPromptActive = overlay ? overlay.style.display === 'flex' : false;

            if (Router.currentPage === 'settings' && typeof window.settingsUpdateFoundHandler === 'function' && !isPromptActive) {
                window.settingsUpdateFoundHandler(version);
            } else if (typeof Splash !== 'undefined' && !Splash.isDismissed) {
                window.pendingUpdateVersion = version;
            } else {
                const mode = this.getUpdateMode();
                if (mode === 'auto') this.triggerAutoIdleDownload();
                else if (mode === 'manual') this.triggerManualToast(version);
                else if (mode === 'advanced') this.triggerDevToast(version);
            }
        };

        window.onUpdateStatus = (statusKey) => this._dispatchUpdateSignal('settingsUpdateStatusHandler', 'handleStatus', statusKey);
        window.onUpdateProgress = (progress) => this._dispatchUpdateSignal('settingsUpdateProgressHandler', 'handleProgress', progress);
        window.onUpdateCheckError = () => this._dispatchUpdateSignal('settingsUpdateErrorHandler', 'handleError');
        window.onNoUpdateFound = () => {
            if (Router.currentPage === 'settings' && typeof window.settingsNoUpdateHandler === 'function') {
                window.settingsNoUpdateHandler();
            }
        };
        window.onAppResume = () => {
            this.getUpdatePrompt()
                .then(UpdatePrompt => UpdatePrompt.checkAppResume())
                .catch(err => console.error('App: Failed to check app resume in UpdatePrompt:', err));
        };

        import('./updater.js')
            .then(({ Updater }) => Updater.initAutoCheck())
            .catch(err => console.error('App: Failed to load updater.js module:', err));
    }
}

/**
 * Tracks network online/offline status, slow connection alerts, F5 cache purges, and background timestamps.
 */
class NetworkMonitor {
    constructor() {
        this.lastSlowAlertTimestamp = 0;
        this.slowHideTimer = null;
    }

    /**
     * Evaluates active throughput/RTT and shows or dismisses the slow-connection status overlay with cooldown throttling.
     */
    checkSpeed() {
        try {
            const now = Date.now();
            let isActuallySlow = Boolean(typeof window !== 'undefined' && now < (window.__ividsSlowUntil || 0));
            if (!isActuallySlow && typeof Api !== 'undefined' && typeof Api.isSlowConnection === 'function') {
                isActuallySlow = Api.isSlowConnection();
            }
            if (typeof navigator !== 'undefined' && navigator.connection) {
                const conn = navigator.connection;
                if (conn.saveData || ['slow-2g', '2g', '3g'].includes(conn.effectiveType)
                    || (typeof conn.rtt === 'number' && conn.rtt > 500)
                    || (typeof conn.downlink === 'number' && conn.downlink > 0 && conn.downlink < NETWORK_CONFIG.SLOW_THRESHOLD_MBPS)) {
                    isActuallySlow = true;
                }
            }

            if (isActuallySlow) {
                if (now - this.lastSlowAlertTimestamp >= NETWORK_CONFIG.ALERT_COOLDOWN_MS) {
                    this.lastSlowAlertTimestamp = now;
                    if (this.slowHideTimer) clearTimeout(this.slowHideTimer);
                    NetworkStatusOverlay.show('slow');
                    this.slowHideTimer = setTimeout(() => {
                        const overlay = document.getElementById('network-status-overlay');
                        if (overlay && overlay.classList.contains('slow')) NetworkStatusOverlay.show('connected');
                        this.slowHideTimer = null;
                    }, NETWORK_CONFIG.ALERT_DURATION_MS);
                }
            } else {
                if (this.slowHideTimer) {
                    clearTimeout(this.slowHideTimer);
                    this.slowHideTimer = null;
                }
                const overlay = document.getElementById('network-status-overlay');
                if (overlay && (overlay.classList.contains('slow') || overlay.classList.contains('lost')) && overlay.classList.contains('visible')) {
                    NetworkStatusOverlay.show('connected');
                }
            }
        } catch (e) {
            console.error('App: Error in checkSpeed execution:', e);
        }
    }

    /**
     * Purges in-memory image blob cache, API cacheManager entries, and image tier memoization, optionally reloading the current view.
     *
     * @param {boolean} [reloadCurrentRoute=true] - Re-renders the active page when true.
     */
    purgeImageAndApiCaches(reloadCurrentRoute = true) {
        try {
            if (imageCache?.clearAndBypassHttpCache) imageCache.clearAndBypassHttpCache();
            if (cacheManager?.clear) cacheManager.clear();
            if (Api?.invalidateImageQualityCache) Api.invalidateImageQualityCache();
            if (typeof window !== 'undefined') {
                window.__ividsSlowUntil = 0;
                window.__ividsSlowConnection = false;
            }
            sessionStorage.setItem('ivids_force_image_reload', '1');
            if (reloadCurrentRoute && Router?.reloadCurrentPage) Router.reloadCurrentPage();
        } catch (err) {
            console.error('App: Failed to purge image and API caches:', err);
        }
    }

    /**
     * Registers window/navigator connectivity listeners, F5 cache purge shortcut, and visibility persistence hooks.
     */
    init() {
        window.addEventListener('offline', () => NetworkStatusOverlay.show('lost'));
        window.addEventListener('online', () => NetworkStatusOverlay.show('connected'));

        if (navigator.connection) navigator.connection.addEventListener('change', () => this.checkSpeed());
        setTimeout(() => this.checkSpeed(), 1000);

        window.addEventListener('networkslowdetected', () => {
            if (this._handlingSlowDetected) return;
            this._handlingSlowDetected = true;
            try {
                if (Api?.markSlowConnection) Api.markSlowConnection(60000);
                this.checkSpeed();
            } finally {
                this._handlingSlowDetected = false;
            }
        });

        window.addEventListener('datasaverchanged', () => {
            try {
                if (imageCache?.destroy) imageCache.destroy();
                if (Api?.invalidateImageQualityCache) Api.invalidateImageQualityCache();
            } catch (e) {
                console.error('App: Error resetting image cache on datasaverchanged:', e);
            }
            this.checkSpeed();
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') localStorage.setItem('ivids-last-active', Date.now());
        });
        window.addEventListener('pagehide', () => {
            if (document.visibilityState === 'hidden') localStorage.setItem('ivids-last-active', Date.now());
        });

        window.addEventListener('keydown', (e) => {
            if ((e.key === 'F5' || e.keyCode === 116) && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
                e.preventDefault();
                this.purgeImageAndApiCaches(true);
            }
        }, { capture: true });

        try {
            const navEntry = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
            if ((navEntry && navEntry.type === 'reload') || sessionStorage.getItem('ivids_force_image_reload') === '1') {
                sessionStorage.removeItem('ivids_force_image_reload');
                this.purgeImageAndApiCaches(false);
            }
        } catch {
            // Ignore navigation timing errors
        }
    }
}

/**
 * Orchestrates application startup: settings restoration, UI engines, spatial navigation, back-trap handling, and initial route load.
 */
class AppBootstrapper {
    constructor() {
        this.updateCoordinator = new UpdateCoordinator();
        this.networkMonitor = new NetworkMonitor();
    }

    /**
     * Reads global and user-namespaced PersistentStorage settings with cookie fallbacks and applies theme variables to documentElement.
     */
    loadSettings() {
        try {
            const parseJson = (raw) => {
                if (!raw || raw === 'null' || raw === 'undefined') return {};
                try { return JSON.parse(raw) || {}; } catch { return {}; }
            };
            const readCookie = (key) => {
                const match = document.cookie.match(new RegExp(`(?:^|; )${key}=([^;]*)`));
                return match ? decodeURIComponent(match[1]) : null;
            };

            const globalSettings = parseJson(PersistentStorage.getItem('ivids-settings'));
            globalSettings.updateMode = globalSettings.updateMode || readCookie('updateMode');
            globalSettings.language = globalSettings.language || readCookie('language');
            globalSettings.uiScale = globalSettings.uiScale || readCookie('uiScale');

            const userSettings = parseJson(PersistentStorage.getItem(getNamespacedKey('settings')));
            const settings = { ...globalSettings, ...userSettings };

            if (settings.accentColor) {
                const hex = settings.accentColor.replace('#', '');
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                document.documentElement.style.setProperty('--primary-color', settings.accentColor);
                document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
            }
            if (settings.language) document.documentElement.setAttribute('lang', settings.language);
            if (settings.uiScale) document.documentElement.style.setProperty('--ui-scale', settings.uiScale);
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    /** Initializes global ErrorHandler, applies persisted settings, and binds native update listeners. */
    initServices() {
        ErrorHandler.init();
        this.loadSettings();
        this.updateCoordinator.init();
    }

    /** Initializes ripple feedback, action-delay timing, splash auto-dismiss safety timer, and the navigation sidebar. */
    initUI() {
        try { RippleEffect.init(); } catch (err) { console.error('App: Failed to initialize RippleEffect:', err); }
        try { ActionDelayManager.init(); } catch (err) { console.error('App: Failed to initialize ActionDelayManager:', err); }
        Splash.init();

        setTimeout(() => {
            if (window.bootImagesLoadedCount !== undefined) {
                if (typeof Splash !== 'undefined' && Splash.signalContentLoaded) Splash.signalContentLoaded();
                delete window.bootImagesLoadedCount;
            }
        }, 3500);

        try { Sidebar.init(); } catch (err) { console.error('Error initializing sidebar:', err); }
    }

    /** Opens the exit confirmation modal on TV/desktop layouts and invokes platform exit bridges when confirmed. */
    showExitConfirmation() {
        const exitModal = document.getElementById('exit-modal');
        if (!exitModal) return;

        const confirmBtn = document.getElementById('confirm-exit-btn');
        const cancelBtn = document.getElementById('cancel-exit-btn');
        const closeModal = manageModal(exitModal, cancelBtn);

        confirmBtn.onclick = () => {
            closeModal();
            try { window.tizen?.application?.getCurrentApplication()?.exit(); } catch (e) { console.error('Tizen exit failed:', e); }
            try { if (typeof window.webOS?.platformBack === 'function') window.webOS.platformBack(); } catch (e) { console.error('webOS exit failed:', e); }
            try { if (typeof window.AndroidUpdate?.exitApp === 'function') window.AndroidUpdate.exitApp(); } catch (e) { console.error('Android exit failed:', e); }
            window.close();
        };
        cancelBtn.onclick = () => closeModal();
    }

    /** Configures SpatialNav fallback back-navigation, modal auto-closing, exit prompts, and touch focus syncing. */
    initNavigation() {
        try {
            SpatialNav.init(() => {
                try {
                    const openModal = document.querySelector('.modal.is-open, .modal.active, .modal.show, .modal-overlay.active, .modal-overlay.show, .modal[style*="display: flex"], .modal[style*="display: block"]');
                    if (openModal) {
                        openModal.style.display = 'none';
                        openModal.classList.remove('is-open', 'active', 'show', 'visible');
                        SpatialNav.clearFocusTrap();
                        SpatialNav.focusFirst();
                        return;
                    }
                    if (Router.currentPage === 'home' && Router.history.length === 0) {
                        if (SpatialNav.isPortrait()) {
                            if (window.AndroidUpdate && typeof window.AndroidUpdate.exitApp === 'function') window.AndroidUpdate.exitApp();
                            else window.close();
                        } else {
                            this.showExitConfirmation();
                        }
                    } else {
                        Router.goBack();
                    }
                } catch (backError) {
                    console.error('Error handling back navigation:', backError);
                }
            });
        } catch (navError) {
            console.error('Error initializing spatial navigation:', navError);
        }

        document.addEventListener('focusin', (e) => {
            if (e.target.classList.contains('focusable') && !e.target.classList.contains('focused')) {
                SpatialNav.setFocus(e.target);
            }
        });
        document.addEventListener('click', (e) => {
            const focusable = e.target.closest('.focusable');
            if (focusable && !focusable.classList.contains('focused') && document.activeElement === focusable) {
                SpatialNav.setFocus(focusable);
            }
        });
    }

    /**
     * Pushes a synthetic history entry on file:// platforms and synchronizes browser popstate deep-links on HTTP origins.
     * Ensures Back closes open modals first or delegates to Router history navigation.
     */
    initHistoryTrap() {
        if (window.location.protocol === 'file:') {
            window.history.pushState({ page: 'home' }, document.title, window.location.href);
            window.addEventListener('popstate', () => {
                window.history.pushState({ page: 'home' }, document.title, window.location.href);
                if (SpatialNav && typeof SpatialNav.back === 'function') SpatialNav.back();
                else if (SpatialNav && typeof SpatialNav.onBack === 'function') SpatialNav.onBack();
            });
            return;
        }

        window.addEventListener('popstate', (event) => {
            if (SpatialNav && Array.isArray(SpatialNav.backHandlers) && SpatialNav.backHandlers.length > 0) {
                if (SpatialNav.back()) {
                    if (Router.currentPage) Router.syncUrl(Router.currentPage, Router.params, true);
                    return;
                }
            }
            if (Router.history.length > 0) {
                Router.history.pop();
                Router.saveHistory();
            }
            if (event.state && event.state.page) {
                Router.loadPage(event.state.page, event.state.params || {}, false);
            } else {
                const currentRoute = Router.parseCurrentUrl();
                Router.loadPage(currentRoute.page, currentRoute.params, false);
            }
        });
    }

    /** Executes asynchronous app initialization sequence on DOMContentLoaded: migrations, services, i18n, and initial route. */
    async boot() {
        window.bootImagesLoadedCount = 0;
        try {
            try {
                const { runMigration } = await import('../../logic/migration.js');
                await runMigration();
            } catch (migError) {
                console.error('App: Migration failure:', migError);
            }

            this.initServices();
            this.initHistoryTrap();
            this.networkMonitor.init();
            this.initUI();
            this.initNavigation();

            if (window.i18n && typeof window.i18n.init === 'function') {
                try { await window.i18n.init(); } catch (i18nErr) { console.error('Error waiting for i18n initialization:', i18nErr); }
            }

            try {
                Router.restoreHistory();
                const initialRoute = Router.parseCurrentUrl();
                Router.loadPage(initialRoute.page, initialRoute.params, false);
                if (location.hash.includes('modal=language') || initialRoute.params?.modal === 'language') {
                    setTimeout(() => { document.getElementById('edit-language-btn')?.click(); }, 400);
                }
            } catch (homeError) {
                console.error('Error in initial routing:', homeError);
                ErrorHandler.show(window.i18n.t('error.initError'), () => window.location.reload());
            }
        } catch (error) {
            console.error('Critical error in DOMContentLoaded:', error);
            try {
                ErrorHandler.show(window.i18n.t('error.criticalInit'), () => window.location.reload());
            } catch {
                try {
                    document.body.innerHTML = '<div class="critical-init-error"><h1>Initialization Error</h1><p>A critical error occurred during initialization. Please restart the app.</p></div>';
                } catch (domErr) {
                    console.error('Failed to inject critical init DOM error:', domErr);
                }
            }
        }
    }
}

const appBootstrapper = new AppBootstrapper();
document.addEventListener('DOMContentLoaded', () => appBootstrapper.boot());
