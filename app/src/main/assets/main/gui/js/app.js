import { Router } from './router.js';
import { SpatialNav } from './spatial-nav.js';
import { Sidebar } from '../components/sidebar/sidebar.js';
import { Splash } from './splash.js';
import { ErrorHandler } from './error-handler.js';
import { Screensaver } from './screensaver.js';
import { Toast, NetworkStatusOverlay } from './toast.js';
import { getActiveAccountId, getNamespacedKey } from '../../logic/account-helper.js';
import { manageModal } from './utils/ui-helper.js';
import './loader.js';
import './i18n.js';

// Global Error Handling
window.onerror = function (message, source, lineno, colno, error) {
    console.error('Global error caught:', message, error);

    // Ignore non-critical resource failures
    if (message === 'Script error.' || (message && message.includes('fetch'))) {
        console.warn('Ignoring likely non-critical resource/network failure');
        return true;
    }

    const errorMsg = error ? `${message}\n${error.stack}` : `${message} (${source}:${lineno}:${colno})`;

    // Dismiss splash if it's blocking the error view
    if (typeof Splash !== 'undefined' && Splash.signalContentLoaded) {
        Splash.signalContentLoaded();
    }

    ErrorHandler.show(
        `${window.i18n.t('error.systemError')}:\n\n${errorMsg}`,
        () => window.location.reload(),
        window.i18n.t('error.defaultTitle')
    );
    return true;
};

window.onunhandledrejection = function (event) {
    console.warn('Unhandled promise rejection:', event.reason);
    // Don't show modal for every background promise failure unless it's critical
};

/**
 * Loads the application settings from localStorage and falls back to document cookies for global settings.
 * Merges and applies the theme and language configurations.
 */
function loadSettings() {
    try {
        const globalSaved = localStorage.getItem('ivids-settings');
        const globalSettings = globalSaved ? JSON.parse(globalSaved) : {};

        // Fallback to cookies for updateMode, language, and uiScale if not in localStorage
        if (!globalSettings.updateMode) {
            const match = document.cookie.match(/(?:^|; )updateMode=([^;]*)/);
            if (match) {
                globalSettings.updateMode = decodeURIComponent(match[1]);
            }
        }
        if (!globalSettings.language) {
            const match = document.cookie.match(/(?:^|; )language=([^;]*)/);
            if (match) {
                globalSettings.language = decodeURIComponent(match[1]);
            }
        }
        if (!globalSettings.uiScale) {
            const match = document.cookie.match(/(?:^|; )uiScale=([^;]*)/);
            if (match) {
                globalSettings.uiScale = decodeURIComponent(match[1]);
            }
        }

        const userKey = getNamespacedKey('settings');
        const userSaved = localStorage.getItem(userKey);
        const userSettings = userSaved ? JSON.parse(userSaved) : {};

        // Merge global settings (language, updateMode) and user settings (accentColor, preferred servers/M3U)
        const settings = { ...globalSettings, ...userSettings };

        if (settings) {
            // Apply accent color
            if (settings.accentColor) {
                try {
                    document.documentElement.style.setProperty('--primary-color', settings.accentColor);

                    // Convert hex to rgb for rgba() usage
                    const hex = settings.accentColor.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
                } catch (colorError) {
                    console.error('Error applying accent color:', colorError);
                }
            }

            // Language settings would be applied here when implemented
            if (settings.language) {
                try {
                    document.documentElement.setAttribute('lang', settings.language);
                } catch (langError) {
                    console.error('Error applying language setting:', langError);
                }
            }

            // Apply UI Scale setting
            if (settings.uiScale) {
                try {
                    document.documentElement.style.setProperty('--ui-scale', settings.uiScale);
                } catch (scaleError) {
                    console.error('Error applying UI scale setting:', scaleError);
                }
            }
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function initServices() {
    // Initialize Error Handler first
    ErrorHandler.init();

    // Load saved settings
    loadSettings();

    // Initialize Screensaver
    Screensaver.init();

    // Check for updates on boot
    initUpdateCheck();
}

/**
 * initUpdateCheck Function
 * ------------------------
 * Explanation:
 * Sets up global bridging callbacks on the window object to handle communication
 * from the native AndroidUpdate Java bridge.
 * It routes update checks dynamically:
 * - If the settings page is active, the callbacks are routed to the settings page handlers.
 * - If settings is not active, a premium TV-first update modal is displayed.
 * - If the splash screen is still visible, the update prompt is cached until the splash screen is dismissed.
 */
function initUpdateCheck() {
    // Global state for update findings
    window.latestFoundVersion = null;
    window.pendingUpdateVersion = null;

    /**
     * Helper to retrieve the current update mode from localStorage, falling back to document cookies.
     * @returns {string} The active update mode (e.g. 'auto', 'manual', 'advanced', 'none').
     */
    const getUpdateMode = () => {
        try {
            const saved = localStorage.getItem('ivids-settings');
            if (saved) {
                const settings = JSON.parse(saved);
                if (settings.updateMode) return settings.updateMode;
            }
            const match = document.cookie.match(/(?:^|; )updateMode=([^;]*)/);
            if (match) {
                return decodeURIComponent(match[1]);
            }
        } catch (e) {
            console.error('App: Failed to get update mode', e);
        }
        return 'manual';
    };

    /**
     * Periodically monitors user activity to silently download and install updates when idle.
     * Affects application lifecycles on Android (via Native bridge) and PC (via Electron IPC).
     * 
     * @param {string} version - The version tag name of the remote release.
     */
    const triggerAutoIdleDownload = (version) => {
        console.log('App: Auto Mode - Observing user inactivity for silent download');
        let downloadStarted = false;
        let lastActivity = Date.now();

        const onUserActivity = () => {
            lastActivity = Date.now();
        };

        const activityEvents = ['keydown', 'mousemove', 'mousedown', 'touchstart', 'click'];
        activityEvents.forEach(evt => window.addEventListener(evt, onUserActivity, { passive: true }));

        const checkIdle = setInterval(() => {
            const isScreensaverActive = Screensaver && Screensaver.isActive;
            const isIdle = Date.now() - lastActivity > 5 * 60 * 1000; // 5 minutes

            if ((isIdle || isScreensaverActive) && !downloadStarted) {
                downloadStarted = true;
                clearInterval(checkIdle);
                activityEvents.forEach(evt => window.removeEventListener(evt, onUserActivity));
                
                console.log('App: Auto Mode - User is idle. Commencing silent background update download!');
                if (window.AndroidUpdate) {
                    window.AndroidUpdate.downloadAndInstall();
                } else if (window.ElectronAPI) {
                    console.log('App: Auto Mode - Silent background download starting for Electron PC...');
                    const downloadUrl = window.latestUpdateDownloadUrl;
                    const ver = window.latestUpdateVersion;
                    if (downloadUrl && ver) {
                        window.ElectronAPI.downloadPcUpdate(downloadUrl, ver)
                            .then((result) => {
                                if (result && result.status === 'downloaded') {
                                    console.log('App: Auto Mode - PC update downloaded, executing installation...');
                                    window.ElectronAPI.installPcUpdate(result.filePath).catch(err => {
                                        console.error('App: Auto Mode - Failed to install Electron update on idle', err);
                                    });
                                }
                            })
                            .catch(err => {
                                console.error('App: Auto Mode - Failed to download Electron update on idle', err);
                            });
                    }
                }
            }
        }, 10000); // Check every 10 seconds
    };

    // Manual Mode toast trigger with Action Buttons
    const triggerManualToast = (version) => {
        console.log('App: Manual Mode - Displaying non-blocking clickable toast');
        
        const title = window.i18n?.t('settings.updateNotification') || 'Update Available';
        const msgHtml = `
            <span>v${version} is available.</span>
            <div class="toast-actions">
                <button class="btn btn-primary focusable" id="toast-download-btn">${window.i18n?.t('settings.toast.download') || 'Download'}</button>
                <button class="btn btn-secondary focusable" id="toast-close-btn">${window.i18n?.t('settings.toast.close') || 'Close'}</button>
            </div>
        `;

        const toastEl = Toast.show(msgHtml, {
            title: title,
            type: 'info',
            duration: 15000, // Display for 15 seconds
            isHtml: true
        });

        if (toastEl) {
            setTimeout(() => {
                const dlBtn = toastEl.querySelector('#toast-download-btn');
                const closeBtn = toastEl.querySelector('#toast-close-btn');

                if (dlBtn) {
                    dlBtn.onclick = (e) => {
                        e.stopPropagation();
                        Toast.hide(toastEl);
                        import('./update-prompt.js').then(({ UpdatePrompt }) => {
                            UpdatePrompt.show(version);
                        });
                    };
                }

                if (closeBtn) {
                    closeBtn.onclick = (e) => {
                        e.stopPropagation();
                        Toast.hide(toastEl);
                    };
                }
                
                // Scan to register new focusable buttons with SpatialNav
                if (typeof SpatialNav !== 'undefined' && SpatialNav.refocus) {
                    SpatialNav.refocus();
                }
            }, 100);
        }
    };

    // Developer Mode toast trigger with actions
    const triggerDevToast = (version) => {
        console.log('App: Developer Mode - Displaying dev console update prompt');
        
        const title = window.i18n?.t('settings.updateNotification') || 'Update Available';
        const msgHtml = `
            <span>Developer version v${version} found.</span>
            <div class="toast-actions">
                <button class="btn btn-primary focusable" id="toast-dev-dl-btn">${window.i18n?.t('settings.toast.download') || 'Download'}</button>
                <button class="btn btn-secondary focusable" id="toast-dev-select-btn">${window.i18n?.t('settings.toast.select') || 'Select Version'}</button>
                <button class="btn btn-secondary focusable" id="toast-dev-close-btn">${window.i18n?.t('settings.toast.close') || 'Close'}</button>
            </div>
        `;

        const toastEl = Toast.show(msgHtml, {
            title: title,
            type: 'warning',
            duration: 20000, // 20 seconds for developer choice
            isHtml: true
        });

        if (toastEl) {
            setTimeout(() => {
                const dlBtn = toastEl.querySelector('#toast-dev-dl-btn');
                const selectBtn = toastEl.querySelector('#toast-dev-select-btn');
                const closeBtn = toastEl.querySelector('#toast-dev-close-btn');

                if (dlBtn) {
                    dlBtn.onclick = (e) => {
                        e.stopPropagation();
                        Toast.hide(toastEl);
                        console.log('App: Quick-downloading latest tag...');
                        if (window.AndroidUpdate) {
                            window.AndroidUpdate.downloadAndInstall();
                        }
                    };
                }

                if (selectBtn) {
                    selectBtn.onclick = (e) => {
                        e.stopPropagation();
                        Toast.hide(toastEl);
                        console.log('App: Directing to settings version selector...');
                        Router.navigate('settings').then(() => {
                            setTimeout(() => {
                                if (window.settingsInstance && typeof window.settingsInstance.openVersionSelector === 'function') {
                                    window.settingsInstance.openVersionSelector();
                                }
                            }, 150);
                        });
                    };
                }

                if (closeBtn) {
                    closeBtn.onclick = (e) => {
                        e.stopPropagation();
                        Toast.hide(toastEl);
                    };
                }
                
                if (typeof SpatialNav !== 'undefined' && SpatialNav.refocus) {
                    SpatialNav.refocus();
                }
            }, 100);
        }
    };

    /**
     * Triggered when the native updater or static checker finds a newer release.
     * Caches the version tag name and routes update UI alerts or toasts.
     * @param {string} version - The found remote version tag name.
     */
    window.onUpdateFound = (version) => {
        window.latestFoundVersion = version;
        console.log('App: Update found globally:', version);

        const overlay = document.getElementById('update-overlay');
        const isPromptActive = overlay ? overlay.style.display === 'flex' : false;

        if (Router.currentPage === 'settings' && typeof window.settingsUpdateFoundHandler === 'function' && !isPromptActive) {
            window.settingsUpdateFoundHandler(version);
        } else {
            // If the splash screen is still visible, cache this version check
            if (typeof Splash !== 'undefined' && !Splash.isDismissed) {
                console.log('App: Caching pending update check until splash dismissed');
                window.pendingUpdateVersion = version;
            } else {
                // Route based on active Update Mode
                const mode = getUpdateMode();
                if (mode === 'auto') {
                    triggerAutoIdleDownload(version);
                } else if (mode === 'manual') {
                    triggerManualToast(version);
                } else if (mode === 'advanced') {
                    triggerDevToast(version);
                }
            }
        }
    };

    /**
     * Triggered when the native or background updater changes its state phase.
     * Updates the settings label status or notifies the active update dialog view.
     * @param {string} statusKey - Key representing the current update phase status.
     */
    window.onUpdateStatus = (statusKey) => {
        console.log('App: Native update status changed:', statusKey);

        const overlay = document.getElementById('update-overlay');
        const isPromptActive = overlay ? overlay.style.display === 'flex' : false;

        if (Router.currentPage === 'settings' && typeof window.settingsUpdateStatusHandler === 'function' && !isPromptActive) {
            window.settingsUpdateStatusHandler(statusKey);
        } else {
            import('./update-prompt.js').then(({ UpdatePrompt }) => {
                UpdatePrompt.handleStatus(statusKey);
            }).catch(err => console.error('App: Failed to handle update status', err));
        }
    };

    /**
     * Triggered when the native or background updater reports download progression.
     * Passes progress data to the settings updates panel or the active prompt bar.
     * @param {number} progress - Downloading percentage ratio (0-100).
     */
    window.onUpdateProgress = (progress) => {
        console.log('App: Native update progress retrieved:', progress);

        const overlay = document.getElementById('update-overlay');
        const isPromptActive = overlay ? overlay.style.display === 'flex' : false;

        if (Router.currentPage === 'settings' && typeof window.settingsUpdateProgressHandler === 'function' && !isPromptActive) {
            window.settingsUpdateProgressHandler(progress);
        } else {
            import('./update-prompt.js').then(({ UpdatePrompt }) => {
                UpdatePrompt.handleProgress(progress);
            }).catch(err => console.error('App: Failed to handle update progress', err));
        }
    };

    /**
     * Triggered if update operations fail natively.
     * Resets the active settings updating states or displays error notification dialogs.
     */
    window.onUpdateCheckError = () => {
        console.error('App: Update check or download error caught');

        const overlay = document.getElementById('update-overlay');
        const isPromptActive = overlay ? overlay.style.display === 'flex' : false;

        if (Router.currentPage === 'settings' && typeof window.settingsUpdateErrorHandler === 'function' && !isPromptActive) {
            window.settingsUpdateErrorHandler();
        } else {
            import('./update-prompt.js').then(({ UpdatePrompt }) => {
                UpdatePrompt.handleError();
            }).catch(err => console.error('App: Failed to handle update check error', err));
        }
    };

    // Triggered when no newer updates are available
    window.onNoUpdateFound = () => {
        console.log('App: App is up-to-date');

        if (Router.currentPage === 'settings' && typeof window.settingsNoUpdateHandler === 'function') {
            window.settingsNoUpdateHandler();
        }
    };
    // Trigger the initial bootloader check
    import('./updater.js')
        .then(({ Updater }) => {
            Updater.initAutoCheck();
        })
        .catch(err => console.error('App: Failed to load updater.js module', err));
}

function initUI() {
    // Initialize Splash Screen
    Splash.init();

    // Safety fallback timeout to guarantee splash screen dismissal after 3.5 seconds
    setTimeout(() => {
        if (window.bootImagesLoadedCount !== undefined) {
            console.log('App: Boot images target not met in 3.5s, dismissing splash screen...');
            if (typeof Splash !== 'undefined' && Splash.signalContentLoaded) {
                Splash.signalContentLoaded();
            }
            delete window.bootImagesLoadedCount;
        }
    }, 3500);

    // Initialize Sidebar
    try {
        Sidebar.init();
    } catch (sidebarError) {
        console.error('Error initializing sidebar:', sidebarError);
    }
}

/**
 * Initializes spatial navigation listeners and configures global click and focus synchronization.
 * This sets up remote key bindings, popstate history tracking, and mouse/touch sync, affecting page navigation state.
 */
function initNavigation() {
    try {
        SpatialNav.init(() => {
            try {
                // 1. Check for any open modals first (Global Fallback Handler)
                const openModal = document.querySelector('.modal[style*="display: flex"], .modal[style*="display: block"], .modal-overlay.active, .modal-overlay.show, .modal.active');
                if (openModal) {
                    console.log('Global back: Closing open modal');
                    // Try standard hide methods
                    openModal.style.display = 'none';
                    openModal.classList.remove('active');
                    openModal.classList.remove('show');
                    openModal.classList.remove('visible');

                    if (SpatialNav) {
                        SpatialNav.clearFocusTrap();
                        SpatialNav.focusFirst();
                    }

                    return;
                }

                // If on Home page and history is empty, handle application exit based on viewport layout.
                if (Router.currentPage === 'home' && Router.history.length === 0) {
                    if (SpatialNav.isPortrait()) {
                        if (window.AndroidUpdate && typeof window.AndroidUpdate.exitApp === 'function') {
                            window.AndroidUpdate.exitApp();
                        } else {
                            window.close();
                        }
                    } else {
                        showExitConfirmation();
                    }
                } else {
                    // Use Router's consolidated back logic (handles history + fallbacks)
                    Router.goBack();
                }
            } catch (backError) {
                console.error('Error handling back navigation:', backError);
            }
        });
    } catch (navError) {
        console.error('Error initializing spatial navigation:', navError);
    }

    // Global listeners to sync touch/click focus with SpatialNav (important for Mobile)
    document.addEventListener('focusin', (e) => {
        if (e.target.classList.contains('focusable') && !e.target.classList.contains('focused')) {
            SpatialNav.setFocus(e.target);
        }
    });

    document.addEventListener('click', (e) => {
        const focusable = e.target.closest('.focusable');
        if (focusable && !focusable.classList.contains('focused')) {
            // Only set focus if the clicked element is still the active focused element in the document.
            // This prevents stealing focus if the click event handler shifted focus elsewhere (e.g. opening a modal).
            if (document.activeElement === focusable) {
                SpatialNav.setFocus(focusable);
            }
        }
    });
}

/**
 * Triggers the Exit Application modal dialog, traps focus inside it,
 * and sets up platform-specific application shutdown upon confirmation.
 */
function showExitConfirmation() {
    const exitModal = document.getElementById('exit-modal');
    if (!exitModal) return;

    const confirmBtn = document.getElementById('confirm-exit-btn');
    const cancelBtn = document.getElementById('cancel-exit-btn');

    const closeModal = manageModal(exitModal, cancelBtn);

    confirmBtn.onclick = () => {
        closeModal();
        console.log('Exiting IVIDS application...');

        // Platform-specific exit strategies
        if (window.tizen && window.tizen.application) {
            try {
                window.tizen.application.getCurrentApplication().exit();
            } catch (e) {
                console.error('Tizen exit failed:', e);
            }
        }
        
        if (window.webOS && typeof window.webOS.platformBack === 'function') {
            try {
                window.webOS.platformBack();
            } catch (e) {
                console.error('webOS exit failed:', e);
            }
        }

        // Native Android exit bridge
        if (window.AndroidUpdate && typeof window.AndroidUpdate.exitApp === 'function') {
            try {
                window.AndroidUpdate.exitApp();
            } catch (e) {
                console.error('Android exit failed:', e);
            }
        }

        // Default closure (works for Electron and general browser window close)
        window.close();
    };

    cancelBtn.onclick = () => {
        closeModal();
    };
}



function initHistoryTrap() {
    // Push an initial state to allow capturing the back button
    window.history.pushState({ page: 'home' }, document.title, window.location.href);

    window.addEventListener('popstate', (event) => {
        // Prevent browser back
        window.history.pushState({ page: 'home' }, document.title, window.location.href);

        // Delegate to our unified back action logic
        if (SpatialNav && typeof SpatialNav.back === 'function') {
            SpatialNav.back();
        } else if (SpatialNav && typeof SpatialNav.onBack === 'function') {
            SpatialNav.onBack();
        }
    });
}



function initNetworkListeners() {
    window.addEventListener('offline', () => {
        NetworkStatusOverlay.show('lost');
    });

    window.addEventListener('online', () => {
        NetworkStatusOverlay.show('connected');
        console.log('Back online');
    });

    // Track when the app goes into the background
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            console.log('App: Saving last active timestamp');
            localStorage.setItem('ivids-last-active', Date.now());
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize boot images load counter for splash screen dismissal tracking
    window.bootImagesLoadedCount = 0;
    try {
        // Run database/storage keys migration first
        try {
            const { runMigration } = await import('../../logic/migration.js');
            await runMigration();
        } catch (migError) {
            console.error('App: Migration failure:', migError);
        }

        initServices();
        initHistoryTrap();
        initNetworkListeners();
        initUI();
        initNavigation();

        // Wait for translations to load to prevent any flashing of English keys
        if (window.i18n && typeof window.i18n.init === 'function') {
            try {
                await window.i18n.init();
            } catch (i18nInitError) {
                console.error('Error waiting for i18n initialization:', i18nInitError);
            }
        }

        // Initial Routing Flow
        try {
            // Remove lingering state data so the app always starts fresh
            localStorage.removeItem('ivids-last-route');
            localStorage.removeItem('ivids-last-active');

            // Always go to home on startup.
            Router.loadPage('home');
        } catch (homeError) {
            console.error('Error in initial routing:', homeError);
            ErrorHandler.show(window.i18n.t('error.initError'), () => window.location.reload());
        }
    } catch (error) {
        console.error('Critical error in DOMContentLoaded:', error);
        // Try to show error handler if it was initialized, otherwise alert
        try {
            ErrorHandler.show(window.i18n.t('error.criticalInit'), () => window.location.reload());
        } catch (e) {
            console.error('A critical error occurred during initialization:', e);
            try {
                document.body.innerHTML = '<div style="background:#800;color:#fff;padding:30px;font-family:sans-serif;text-align:center;"><h1>Initialization Error</h1><p>A critical error occurred during initialization. Please restart the app.</p></div>';
            } catch (domErr) {
                console.error('Failed to inject critical init DOM error:', domErr);
            }
        }
    }
});
