import { SpatialNav } from './spatial-nav.js';
import { getLoaderHtml } from './loader.js';
import { Splash } from './splash.js';

/** In-memory cache of fetched page HTML templates, keyed by page name. Eliminates re-fetching on back-nav. */
const _htmlCache = new Map();

/** Flag to track whether the initial boot page has loaded. Used to skip splash signals on subsequent loads. */
let _initialLoadComplete = false;

/** Tracks the current loading generation to prevent race conditions during rapid navigation. */
let _loadGeneration = 0;

/** Active AbortController for aborting in-flight HTML template fetches on page change or timeout. */
let _activeAbortController = null;

export const Router = {
    currentPage: null,
    params: {},
    history: [],
    isLoading: false,

    /**
     * Loads page HTML templates, JS controllers, and spatial navigation rules, updating viewport layout and sidebar display status.
     * Affects page loading state, route history stack, active sidebar visibility/display style, and focus target.
     * @param {string} pageName - The ID of the page to load.
     * @param {Object} params - Route parameter mapping.
     * @param {boolean} addToHistory - Whether to push the previous route onto the history stack.
     * @param {HTMLElement|string} targetFocus - Optional element/selector to focus after load.
     */
    async loadPage(pageName, params = {}, addToHistory = true, targetFocus = null) {
        if (this.isLoading) return; // Prevent double loading

        // Prevent loading the same page again
        if (this.currentPage === pageName && JSON.stringify(this.params) === JSON.stringify(params)) {
            console.log(`Already on page: ${pageName}, skipping load.`);
            return;
        }

        // Save current page to history before navigating away
        if (addToHistory && this.currentPage) {
            this.history.push({
                page: this.currentPage,
                params: this.params
            });
        }

        _loadGeneration++;
        const currentGen = _loadGeneration;

        if (_activeAbortController) {
            _activeAbortController.abort();
            _activeAbortController = null;
        }

        this.isLoading = true;
        this.params = params;

        const mainView = document.getElementById('main-view');
        if (!mainView) {
            console.error('Main view container not found');
            if (currentGen === _loadGeneration) {
                this.isLoading = false;
            }
            return;
        }

        // Show Loader
        const app = document.getElementById('app');
        if (app) {
            app.classList.remove('fullscreen-layout');
            // Toggle always-expanded sidebar class based on page
            const alwaysExpandedPages = ['search', 'playlists', 'settings', 'account'];
            if (alwaysExpandedPages.includes(pageName)) {
                app.classList.add('sidebar-always-expanded');
            } else {
                app.classList.remove('sidebar-always-expanded');
            }
        }

        // Explicitly hide sidebar for player pages to prevent DOM traversal/focus issues
        const sidebar = document.getElementById('sidebar-container');
        if (sidebar) {
            if (pageName === 'player' || pageName === 'tv-player' || pageName === 'profiles') {
                sidebar.style.display = 'none';
            } else {
                sidebar.style.display = '';
            }
        }

        const originalContent = mainView.innerHTML;
        mainView.innerHTML = `<div class="page-loader" style="display: flex; justify-content: center; align-items: center; height: 100vh;">${getLoaderHtml()}</div>`;

        try {
            console.log(`Loading page: ${pageName}`);

            // 1. Fetch HTML (use cache if available, otherwise fetch with timeout and abort signal)
            let html;
            if (_htmlCache.has(pageName)) {
                html = _htmlCache.get(pageName);
            } else {
                const controller = new AbortController();
                _activeAbortController = controller;
                const fetchPromise = fetch(`pages/${pageName}.html`, { signal: controller.signal });
                
                let timeoutId;
                const timeoutPromise = new Promise((_, reject) => {
                    timeoutId = setTimeout(() => {
                        controller.abort();
                        reject(new Error('Request timed out'));
                    }, 10000);
                });

                try {
                    const response = await Promise.race([fetchPromise, timeoutPromise]);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch page HTML: ${response.status} ${response.statusText}`);
                    }
                    html = await response.text();
                    _htmlCache.set(pageName, html);
                } finally {
                    clearTimeout(timeoutId);
                    if (_activeAbortController === controller) {
                        _activeAbortController = null;
                    }
                }
            }

            if (currentGen !== _loadGeneration) return;

            // Clear loader and set content
            mainView.innerHTML = html;
            mainView.scrollTop = 0;

            // 2. Load JS Module
            try {
                const module = await import(`../pages/${pageName}.js`);
                if (currentGen !== _loadGeneration) return;

                // 3. Initialize Page
                if (module && module.init) {
                    await module.init(params);
                } else {
                    console.warn(`No init function found for ${pageName}`);
                }
                if (currentGen !== _loadGeneration) return;

                // 4. Load Spatial Navigation Logic
                try {
                    const navModule = await import(`../../logic/spatial-nav/spatial-nav-${pageName}.js`);
                    if (currentGen !== _loadGeneration) return;
                    const logicKey = `spatialNav${pageName.charAt(0).toUpperCase()}${pageName.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase())}`;
                    if (navModule && navModule[logicKey]) {
                        SpatialNav.setPageLogic(navModule[logicKey]);
                    } else {
                        SpatialNav.setPageLogic(null);
                    }
                } catch (navError) {
                    console.log(`No spatial nav logic for ${pageName}`);
                    if (currentGen !== _loadGeneration) return;
                    SpatialNav.setPageLogic(null);
                }
            } catch (moduleError) {
                console.error(`Error loading module for ${pageName}:`, moduleError);
                if (currentGen !== _loadGeneration) return;
            }

            // Signal Splash that HTML is rendered (only on first boot, skip on subsequent navigations)
            if (!_initialLoadComplete) {
                _initialLoadComplete = true;
                Splash.signalContentLoaded();

                // Pre-import critical page modules after initial load for faster subsequent navigation
                setTimeout(() => {
                    const criticalPages = ['home', 'details', 'search', 'movies', 'series'];
                    criticalPages.forEach(p => {
                        if (p !== pageName) {
                            import(`../pages/${p}.js`).catch(() => { /* silent preload failure is OK */ });
                        }
                    });
                }, 2000);
            }

            // Apply translations
            try {
                if (window.i18n && typeof window.i18n.applyTranslations === 'function') {
                    window.i18n.applyTranslations();
                }
            } catch (i18nError) {
                console.error('Error applying translations:', i18nError);
            }
            if (currentGen !== _loadGeneration) return;

            this.currentPage = pageName;

            // 4. Update active nav item
            this.updateActiveNavLink(pageName);

            // 5. Reset Navigation Focus
            this.resetFocus(targetFocus);

        } catch (error) {
            if (currentGen !== _loadGeneration) return;
            console.error(`Critical error loading page ${pageName}:`, error);

            // Restore original content or show error
            mainView.innerHTML = `
                <div class="error-page-container" style="text-align: center; padding: 50px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
                    <h1 data-i18n="error.pageTitle">Error loading page</h1>
                    <p>${error.message || 'An unexpected error occurred.'}</p>
                    <div style="margin-top: 20px;">
                        <button id="retry-page-btn" class="btn btn-primary focusable" data-i18n="error.retry">Retry</button>
                        <button id="home-page-btn" class="btn btn-secondary focusable" data-i18n="error.goHome" style="margin-left: 10px;">Go Home</button>
                    </div>
                </div>
            `;

            // Bind retry buttons
            setTimeout(() => {
                const retryBtn = document.getElementById('retry-page-btn');
                const homeBtn = document.getElementById('home-page-btn');

                if (retryBtn) {
                    retryBtn.onclick = () => {
                        this.isLoading = false; // Reset state before retry
                        this.loadPage(pageName, params);
                    };
                }
                if (homeBtn) {
                    homeBtn.onclick = () => {
                        this.isLoading = false;
                        this.loadPage('home');
                    };
                }

                if (window.i18n) window.i18n.applyTranslations();
                if (retryBtn && SpatialNav) SpatialNav.setFocus(retryBtn);
            }, 100);

            // Ensure Splash is dismissed if it encountered an error
            Splash.signalContentLoaded();

        } finally {
            if (currentGen === _loadGeneration) {
                this.isLoading = false;
            }
        }
    },

    updateActiveNavLink(pageName) {
        try {
            document.querySelectorAll('.nav-item').forEach(link => {
                link.classList.remove('active');
                if (link.dataset.route === pageName) {
                    link.classList.add('active');
                }
            });
        } catch (navError) {
            console.error('Error updating navigation:', navError);
        }
    },

    resetFocus(targetFocus = null) {
        try {
            setTimeout(() => {
                // If we have a target focus element, use it
                if (targetFocus) {
                    const el = typeof targetFocus === 'string' ? document.querySelector(targetFocus) : targetFocus;
                    if (el && SpatialNav && typeof SpatialNav.isVisible === 'function' && SpatialNav.isVisible(el)) {
                        SpatialNav.setFocus(el);
                        return;
                    }
                }

                if (SpatialNav && typeof SpatialNav.focusFirst === 'function') {
                    SpatialNav.focusFirst();
                }
            }, 100);
        } catch (focusError) {
            console.error('Error setting initial focus:', focusError);
        }
    },

    goBack(fallbackPage = null, fallbackParams = {}) {
        if (this.history.length > 0) {
            const lastPage = this.history.pop();
            this.loadPage(lastPage.page, lastPage.params, false);
        } else {
            // No history (likely after reload)
            const fallback = fallbackPage || this.getFallbackPage(this.currentPage, this.params);
            if (fallback) {
                console.log(`No history, using fallback: ${fallback}`);
                this.loadPage(fallback, fallbackParams, false);
            } else if (this.currentPage !== 'home') {
                // Absolute fallback to home
                this.loadPage('home', {}, false);
            } else {
                console.log('Already on home and no history. App will not close.');
            }
        }
    },

    getFallbackPage(currentPage, params) {
        const fallbacks = {
            'player': 'details',
            'tv-player': 'livetv',
            'details': 'home',
            'playlist-details': 'playlists',
            'playlists': 'home',
            'settings': 'home',
            'account': 'home',
            'search': 'home',
            'movies': 'home',
            'series': 'home',
            'livetv': 'home'
        };

        return fallbacks[currentPage] || 'home';
    }
};
window.Router = Router;
