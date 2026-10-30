import { Router } from '../../js/router.js';

let _cachedHtml = null;
let responsiveNavMediaQuery = null;
let responsiveNavMediaHandler = null;

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
            container.innerHTML = `<nav class="nav-rail navbar" id="header">${html}</nav>`;

            Sidebar.setupResponsiveNavigation(container);

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

    /**
     * Keeps desktop utility links in their footer group and moves them into the shared mobile grid.
     * @param {HTMLElement} container - Mounted sidebar root.
     */
    setupResponsiveNavigation: (container) => {
        const links = container.querySelector('#nav-links');
        const utilities = container.querySelector('#nav-utilities');
        if (!links || !utilities || typeof window.matchMedia !== 'function') return;

        if (responsiveNavMediaQuery && responsiveNavMediaHandler) {
            if (typeof responsiveNavMediaQuery.removeEventListener === 'function') {
                responsiveNavMediaQuery.removeEventListener('change', responsiveNavMediaHandler);
            } else if (typeof responsiveNavMediaQuery.removeListener === 'function') {
                responsiveNavMediaQuery.removeListener(responsiveNavMediaHandler);
            }
        }

        const mediaQuery = window.matchMedia('(max-aspect-ratio: 1/1), (max-height: 500px) and (pointer: coarse), (max-width: 950px) and (max-height: 500px)');
        const syncGroups = (event) => {
            const destination = event.matches ? links : utilities;
            ['account', 'settings'].forEach(route => {
                const link = container.querySelector(`.nav-item[data-route="${route}"]`);
                if (link && link.parentElement !== destination) destination.appendChild(link);
            });
        };

        syncGroups(mediaQuery);
        responsiveNavMediaQuery = mediaQuery;
        responsiveNavMediaHandler = syncGroups;
        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', responsiveNavMediaHandler);
        } else if (typeof mediaQuery.addListener === 'function') {
            mediaQuery.addListener(responsiveNavMediaHandler);
        }
    },

    /** Binds navigation destinations without changing their size or color on tap. */
    attachListeners: () => {
        document.querySelectorAll('#sidebar-container .nav-item').forEach(link => {
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
            const isTarget = link.dataset.route === pageName;
            link.classList.toggle('is-active', isTarget);
            link.classList.toggle('active', isTarget);
        });
    }
};
