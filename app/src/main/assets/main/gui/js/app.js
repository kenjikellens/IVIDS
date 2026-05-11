import { Router } from './router.js';
import { SpatialNav } from './spatial-nav.js';
import { Sidebar } from '../components/sidebar/sidebar.js';
import { Splash } from './splash.js';
import { ErrorHandler } from './error-handler.js';
import { Screensaver } from './screensaver.js';
import { Toast } from './toast.js';
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

// Load and apply saved settings
function loadSettings() {
    try {
        const savedSettings = localStorage.getItem('ivids-settings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);

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
            } catch (parseError) {
                console.error('Error parsing saved settings:', parseError);
                // Clear invalid settings
                localStorage.removeItem('ivids-settings');
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

function initUpdateCheck() {
    // Global state for update findings
    window.latestFoundVersion = null;
    window.onUpdateFound = (version) => {
        window.latestFoundVersion = version;
        console.log('App: Update found globally:', version);
    };

    try {
        const savedSettings = localStorage.getItem('ivids-settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.updateMode === 'auto' || settings.updateMode === 'manual') {
                if (window.AndroidUpdate) {
                    console.log('App: Triggering startup update check');
                    window.AndroidUpdate.checkForUpdates();
                }
            }
        }
    } catch (e) {
        console.error('App: Error in initUpdateCheck', e);
    }
}

function initUI() {
    // Initialize Splash Screen
    Splash.init();

    // Initialize Sidebar
    try {
        Sidebar.init();
    } catch (sidebarError) {
        console.error('Error initializing sidebar:', sidebarError);
    }
}

function initNavigation() {
    try {
        SpatialNav.init(() => {
            try {
                // 1. Check for any open modals first (Global Handler)
                const openModal = document.querySelector('.modal[style*="display: flex"], .modal[style*="display: block"], .modal-overlay.active, .color-modal-overlay.show, .modal.active');
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

                    // Specific fix for settings color modal
                    if (openModal.id === 'color-modal') {
                        document.getElementById('portrait-color-trigger')?.focus();
                    }
                    return;
                }

                // Use Router's consolidated back logic (handles history + fallbacks)
                Router.goBack();
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
            SpatialNav.setFocus(focusable);
        }
    });
}



function initHistoryTrap() {
    // Push an initial state to allow capturing the back button
    window.history.pushState({ page: 'home' }, document.title, window.location.href);

    window.addEventListener('popstate', (event) => {
        // Prevent browser back
        window.history.pushState({ page: 'home' }, document.title, window.location.href);

        // Delegate to our internal back logic
        if (SpatialNav && typeof SpatialNav.onBack === 'function') {
            SpatialNav.onBack();
        }
    });
}



function initNetworkListeners() {
    window.addEventListener('offline', () => {
        Toast.show(window.i18n.t('toast.connectionLost'), {
            title: window.i18n.t('toast.connectionLostTitle'),
            type: 'error',
            duration: 0 // Keep visible until online
        });
    });

    window.addEventListener('online', () => {
        // Find existing error toasts and hide them
        const toasts = document.querySelectorAll('.toast-error');
        toasts.forEach(t => Toast.hide(t));

        Toast.show(window.i18n.t('toast.connected'), {
            title: window.i18n.t('toast.connectedTitle'),
            type: 'success',
            duration: 3000
        });
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

document.addEventListener('DOMContentLoaded', () => {
    try {
        initServices();
        initHistoryTrap();
        initNetworkListeners();
        initUI();
        initNavigation();

        // Initial Routing Flow
        try {
            // Remove lingering state data so the app always starts fresh
            localStorage.removeItem('ivids-last-route');
            localStorage.removeItem('ivids-current-profile');
            localStorage.removeItem('ivids-last-active');

            // Always go to profiles screen on startup
            Router.loadPage('profiles');
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
            alert('A critical error occurred during initialization.');
        }
    }
});
