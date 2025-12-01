import { Router } from './router.js';
import { SpatialNav } from './spatial-nav.js';
import { Sidebar } from '../components/sidebar/sidebar.js';
import { Splash } from './splash.js';
import { ErrorHandler } from './error-handler.js';
import { Screensaver } from './screensaver.js';
import './i18n.js';

// Global Error Handling
window.onerror = function(message, source, lineno, colno, error) {
    console.error('Global error caught:', message, error);
    ErrorHandler.show(
        'An unexpected error occurred. The application may need to restart.',
        () => window.location.reload(),
        'System Error'
    );
    return true; // Prevent default browser error handling
};

window.onunhandledrejection = function(event) {
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
                if (Router.currentPage === 'home') {
                    // Exit app if on home screen
                    try {
                        if (window.tizen) {
                            tizen.application.getCurrentApplication().exit();
                        } else {
                            console.log('Exit app (not on Tizen)');
                        }
                    } catch (e) {
                        console.log('Exit app error:', e);
                    }
                } else {
                    // Go back to home from other pages
                    Router.loadPage('home');
                    Sidebar.updateActiveLink('home');
                }
            } catch (backError) {
                console.error('Error handling back navigation:', backError);
                // Fallback to home
                try {
                    Router.loadPage('home');
                    Sidebar.updateActiveLink('home');
                } catch (homeError) {
                    console.error('Failed to navigate to home:', homeError);
                }
            }
        });
    } catch (navError) {
        console.error('Error initializing spatial navigation:', navError);
    }
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
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        initServices();
        initNetworkListeners();
        initUI();
        initNavigation();

        // Load Home Page by default
        try {
            Router.loadPage('home');
        } catch (homeError) {
            console.error('Error loading home page:', homeError);
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
