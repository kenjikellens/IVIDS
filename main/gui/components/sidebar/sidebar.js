import { Router } from '../../js/router.js';

export const Sidebar = {
    init: async () => {
        console.log('Initializing Sidebar...');
        const container = document.getElementById('sidebar-container');
        if (!container) {
            console.error('Sidebar container not found');
            return;
        }

        // Load CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'components/sidebar/sidebar.css';
        document.head.appendChild(link);

        // Load HTML
        try {
            const response = await fetch('components/sidebar/sidebar.html');
            if (!response.ok) throw new Error('Failed to load sidebar HTML');
            const html = await response.text();
            container.innerHTML = `<nav class="navbar" id="header">${html}</nav>`;

            // Initialize event listeners
            Sidebar.attachListeners();

            // Apply translations if available
            if (window.i18n && typeof window.i18n.applyTranslations === 'function') {
                window.i18n.applyTranslations();
            }

            // Highlight current route
            Sidebar.updateActiveLink(Router.currentPage);

        } catch (error) {
            console.error('Error loading sidebar:', error);
        }
    },

    attachListeners: () => {
        document.querySelectorAll('.nav-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const route = e.currentTarget.dataset.route;
                if (route) {
                    Router.loadPage(route);
                    Sidebar.updateActiveLink(route);
                }
            });
        });
    },

    updateActiveLink: (pageName) => {
        if (!pageName) return;
        document.querySelectorAll('.nav-item').forEach(link => {
            link.classList.remove('active');
            if (link.dataset.route === pageName) {
                link.classList.add('active');
            }
        });
    }
};
