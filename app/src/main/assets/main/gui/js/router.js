import { SpatialNav } from './spatial-nav.js';
import { getLoaderHtml } from './loader.js';
import { Splash } from './splash.js';

export const Router = {
    currentPage: null,
    params: {},
    history: [],
    isLoading: false,

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

        this.isLoading = true;
        this.params = params;

        const mainView = document.getElementById('main-view');
        if (!mainView) {
            console.error('Main view container not found');
            this.isLoading = false;
            return;
        }

        // Show Loader
        const app = document.getElementById('app');
        if (app) app.classList.remove('fullscreen-layout');

        const originalContent = mainView.innerHTML;
        mainView.innerHTML = `<div class="page-loader" style="display: flex; justify-content: center; align-items: center; height: 100vh;">${getLoaderHtml()}</div>`;

        try {
            console.log(`Loading page: ${pageName}`);

            // Update page-specific CSS
            try {
                const pageCssLink = document.getElementById('page-css');
                if (pageCssLink) {
                    pageCssLink.href = `css/${pageName}.css`;
                }
            } catch (cssError) {
                console.error('Error updating page CSS:', cssError);
            }

            // 1. Fetch HTML with Timeout
            const fetchPromise = fetch(`pages/${pageName}.html`);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timed out')), 10000)
            );

            const response = await Promise.race([fetchPromise, timeoutPromise]);

            if (!response.ok) {
                throw new Error(`Failed to fetch page HTML: ${response.status} ${response.statusText}`);
            }
            const html = await response.text();

            // Clear loader and set content
            mainView.innerHTML = html;

            // 2. Load JS Module
            try {
                const module = await import(`../pages/${pageName}.js`);

                // 3. Initialize Page
                if (module && module.init) {
                    await module.init(params);
                } else {
                    console.warn(`No init function found for ${pageName}`);
                }

                // 4. Load Spatial Navigation Logic
                try {
                    const navModule = await import(`../../logic/spatial-nav/spatial-nav-${pageName}.js`);
                    const logicKey = `spatialNav${pageName.charAt(0).toUpperCase()}${pageName.slice(1).replace(/-([a-z])/g, (g) => g[1].toUpperCase())}`;
                    if (navModule && navModule[logicKey]) {
                        SpatialNav.setPageLogic(navModule[logicKey]);
                    } else {
                        SpatialNav.setPageLogic(null);
                    }
                } catch (navError) {
                    console.log(`No spatial nav logic for ${pageName}`);
                    SpatialNav.setPageLogic(null);
                }
            } catch (moduleError) {
                console.error(`Error loading module for ${pageName}:`, moduleError);
                // Don't fail completely if JS fails, HTML might be enough
            }

            // Signal Splash that HTML is rendered (with a tiny delay for safety)
            setTimeout(() => {
                Splash.signalContentLoaded();
            }, 500);

            // Apply translations
            try {
                if (window.i18n && typeof window.i18n.applyTranslations === 'function') {
                    window.i18n.applyTranslations();
                }
            } catch (i18nError) {
                console.error('Error applying translations:', i18nError);
            }

            this.currentPage = pageName;

            // Save last route for persistence (if not profiles page)
            if (pageName !== 'profiles') {
                localStorage.setItem('ivids-last-route', JSON.stringify({
                    page: pageName,
                    params: params
                }));
            }

            // 4. Update active nav item
            this.updateActiveNavLink(pageName);

            // 5. Reset Navigation Focus
            this.resetFocus(targetFocus);

        } catch (error) {
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
            this.isLoading = false;
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
