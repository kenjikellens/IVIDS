import { Router } from '../../js/router.js';

let _cachedHtml = null;

export const Sidebar = {
    /**
     * init method:
     * Initializes the Netflix-style global navigation rail.
     * It mounts the sidebar into the sidebar viewport container, fetches the sidebar HTML structure,
     * binds clicks and touch-focus listeners to nav links, applies translations,
     * and highlights the active route button.
     *
     * Note: Dynamic creation of a sidebar.css link element is commented out because
     * all sidebar styles are now merged into global.css to prevent loading delays.
     */
    init: async () => {
        console.log('Initializing Sidebar...');
        const container = document.getElementById('sidebar-container');
        if (!container) {
            console.error('Sidebar container not found');
            return;
        }

        // Sidebar CSS is loaded via global.css. Dynamic appending is disabled.
        /*
        // Load CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'components/sidebar/sidebar.css';
        document.head.appendChild(link);
        */

        // Load HTML
        try {
            let html;
            if (_cachedHtml) {
                html = _cachedHtml;
            } else {
                const response = await fetch('components/sidebar/sidebar.html');
                if (!response.ok) throw new Error('Failed to load sidebar HTML');
                html = await response.text();
                _cachedHtml = html;
            }
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
                    Router.loadPage(route, {}, false, e.currentTarget);
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
