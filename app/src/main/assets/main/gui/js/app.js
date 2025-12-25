import { Router } from './router.js';
import { SpatialNav } from './spatial-nav.js';
import { Sidebar } from '../components/sidebar/sidebar.js';
import { Splash } from './splash.js';
import { ErrorHandler } from './error-handler.js';
import { Screensaver } from './screensaver.js';
import './loader.js';
import './i18n.js';

// Global Error Handling
window.onerror = function (message, source, lineno, colno, error) {
    console.error('Global error caught:', message, error);

    // Ignore "Script error." which often happens for external resource failures
    // that don't affect the app's functionality but have no details due to CORS.
    if (message === 'Script error.') {
        console.warn('Ignoring generic "Script error." (likely non-critical resource failure)');
        return true;
    }

    const errorMsg = error ? `${message}\n${error.stack}` : `${message} (${source}:${lineno}:${colno})`;
    ErrorHandler.show(
        `An unexpected system error occurred:\n\n${errorMsg}`,
        () => window.location.reload(),
        'System Error'
    );
    return true; // Prevent default browser error handling
};

window.onunhandledrejection = function (event) {
    console.error('Unhandled promise rejection:', event.reason);
    // Don't show modal for every background promise failure, but log it
    // Only show if it seems critical or if we want to be very strict
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

                if (Router.history.length > 0) {
                    Router.goBack();
                } else if (Router.currentPage === 'home') {
                    // Check if exit modal is visible
                    const exitModal = document.getElementById('exit-modal');
                    if (exitModal && exitModal.classList.contains('visible')) {
                        // If visible, close it (Cancel action)
                        closeExitModal();
                        return;
                    }

                    // Show Exit Modal
                    showExitModal();
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
            SpatialNav.setFocus(focusable);
        }
    });
}

// Exit Modal Logic
let lastFocusElement = null;

function showExitModal() {
    const exitModal = document.getElementById('exit-modal');
    const cancelBtn = document.getElementById('exit-btn-cancel');
    const confirmBtn = document.getElementById('exit-btn-confirm');

    if (!exitModal || !cancelBtn || !confirmBtn) return;

    // Save current focus
    lastFocusElement = document.activeElement;

    // Show modal
    exitModal.classList.add('visible');

    // Bind events
    cancelBtn.onclick = closeExitModal;
    confirmBtn.onclick = () => {
        try {
            if (window.tizen) {
                tizen.application.getCurrentApplication().exit();
            } else {
                console.log('Exit app triggered (not on Tizen)');
                // window.close() often blocked, but good for testing
                try { window.close(); } catch (e) { }
            }
        } catch (e) {
            console.log('Exit app error:', e);
        }
    };

    // Delay focus set to ensure visibility
    setTimeout(() => {
        if (SpatialNav && typeof SpatialNav.setFocus === 'function') {
            // Default to Cancel for safety, as requested user needs to move to Yes
            SpatialNav.setFocus(cancelBtn);
        } else {
            cancelBtn.focus();
        }
    }, 100);
}

function closeExitModal() {
    const exitModal = document.getElementById('exit-modal');
    if (!exitModal) return;

    exitModal.classList.remove('visible');

    // Restore focus
    setTimeout(() => {
        if (lastFocusElement && document.body.contains(lastFocusElement)) {
            if (SpatialNav && typeof SpatialNav.setFocus === 'function') {
                SpatialNav.setFocus(lastFocusElement);
            } else {
                lastFocusElement.focus();
            }
        } else {
            // Fallback if element is gone
            if (SpatialNav && typeof SpatialNav.focusFirst === 'function') {
                SpatialNav.focusFirst();
            }
        }
    }, 100);
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
        ErrorHandler.show(
            'No internet connection. Please check your network settings.',
            () => window.location.reload(),
            'Connection Lost'
        );
    });

    window.addEventListener('online', () => {
        ErrorHandler.hide();
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
            const currentProfile = localStorage.getItem('ivids-current-profile');
            const lastRouteData = localStorage.getItem('ivids-last-route');
            const lastActive = localStorage.getItem('ivids-last-active');

            // Reset profile if inactive for more than 3 minutes
            if (lastActive) {
                const threeMinutes = 3 * 60 * 1000;
                const inactiveTime = Date.now() - parseInt(lastActive);
                if (inactiveTime > threeMinutes) {
                    console.log(`App: Inactive for ${Math.round(inactiveTime / 1000)}s. Resetting to profiles.`);
                    localStorage.removeItem('ivids-current-profile');
                }
            }

            if (!localStorage.getItem('ivids-current-profile')) {
                // No profile selected, go to profiles screen
                Router.loadPage('profiles');
            } else {
                // Profile exists, try to load last route
                if (lastRouteData) {
                    try {
                        const { page, params } = JSON.parse(lastRouteData);
                        Router.loadPage(page, params);
                    } catch (e) {
                        console.error('Error parsing last route:', e);
                        Router.loadPage('home');
                    }
                } else {
                    Router.loadPage('home');
                }
            }
        } catch (homeError) {
            console.error('Error in initial routing:', homeError);
            ErrorHandler.show('Failed to initialize application. Please reload the page.', () => window.location.reload());
        }
    } catch (error) {
        console.error('Critical error in DOMContentLoaded:', error);
        // Try to show error handler if it was initialized, otherwise alert
        try {
            ErrorHandler.show('A critical error occurred during initialization.', () => window.location.reload());
        } catch (e) {
            alert('A critical error occurred during initialization.');
        }
    }
});
