import { Router } from './router.js';
import { SpatialNav } from './spatial-nav.js';
import './i18n.js';

// Load and apply saved settings
function loadSettings() {
    const savedSettings = localStorage.getItem('ivids-settings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);

        // Apply accent color
        if (settings.accentColor) {
            document.documentElement.style.setProperty('--primary-color', settings.accentColor);
        }

        // Language settings would be applied here when implemented
        if (settings.language) {
            document.documentElement.setAttribute('lang', settings.language);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Load saved settings first
    loadSettings();

    // Initialize Navigation
    SpatialNav.init();

    // Handle Navbar Links
    document.querySelectorAll('.nav-item').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const route = e.target.dataset.route;
            if (route) {
                Router.loadPage(route);
            }
        });
    });

    // Handle Settings Button
    const settingsBtn = document.querySelector('.settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const route = settingsBtn.dataset.route;
            if (route) {
                Router.loadPage(route);
            }
        });
    }

    // Load Home Page by default
    Router.loadPage('home');
});
