import { Router } from './router.js';
import { SpatialNav } from './spatial-nav.js';
import './i18n.js';

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

document.addEventListener('DOMContentLoaded', () => {
    try {
        // Load saved settings first
        try {
            loadSettings();
        } catch (settingsError) {
            console.error('Error loading settings:', settingsError);
        }

        // Initialize Navigation
        try {
            SpatialNav.init(() => {
                try {
                    if (Router.currentPage === 'home') {
                        // Exit app if on home screen
                        try {
                            tizen.application.getCurrentApplication().exit();
                        } catch (e) {
                            console.log('Exit app (not on Tizen)');
                        }
                    } else {
                        // Go back to home from other pages
                        Router.loadPage('home');
                    }
                } catch (backError) {
                    console.error('Error handling back navigation:', backError);
                    // Fallback to home
                    try {
                        Router.loadPage('home');
                    } catch (homeError) {
                        console.error('Failed to navigate to home:', homeError);
                    }
                }
            });
        } catch (navError) {
            console.error('Error initializing spatial navigation:', navError);
        }

        // Handle Navbar Links
        try {
            document.querySelectorAll('.nav-item').forEach(link => {
                try {
                    link.addEventListener('click', (e) => {
                        try {
                            e.preventDefault();
                            const route = e.target.dataset.route;
                            if (route) {
                                Router.loadPage(route);

                            } else {
                                console.warn('Nav item clicked but no route found');
                            }
                        } catch (clickError) {
                            console.error('Error handling nav item click:', clickError);
                        }
                    });
                } catch (linkError) {
                    console.error('Error setting up nav link:', linkError);
                }
            });
        } catch (navLinksError) {
            console.error('Error setting up navigation links:', navLinksError);
        }



        // Handle Settings Button
        try {
            const settingsBtn = document.querySelector('.settings-btn');
            if (settingsBtn) {
                settingsBtn.addEventListener('click', (e) => {
                    try {
                        e.preventDefault();
                        const route = settingsBtn.dataset.route;
                        if (route) {
                            Router.loadPage(route);
                        }
                    } catch (clickError) {
                        console.error('Error handling settings click:', clickError);
                    }
                });
            }
        } catch (settingsBtnError) {
            console.error('Error setting up settings button:', settingsBtnError);
        }

        // Load Home Page by default
        try {
            Router.loadPage('home');
        } catch (homeError) {
            console.error('Error loading home page:', homeError);
            alert('Failed to initialize application. Please reload the page.');
        }
    } catch (error) {
        console.error('Critical error in DOMContentLoaded:', error);
        alert('A critical error occurred during initialization.');
    }
});
