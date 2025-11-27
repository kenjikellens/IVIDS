import { SpatialNav } from './spatial-nav.js';

export const Router = {
    currentPage: null,

    async loadPage(pageName, params = {}) {
        try {
            console.log(`Loading page: ${pageName}`);
            const mainView = document.getElementById('main-view');

            if (!mainView) {
                console.error('Main view container not found');
                alert('Critical error: Main view container missing.');
                return;
            }

            try {
                // Update page-specific CSS
                const pageCssLink = document.getElementById('page-css');
                if (pageCssLink) {
                    pageCssLink.href = `css/${pageName}.css?t=${Date.now()}`;
                }


            } catch (cssError) {
                console.error('Error updating page CSS:', cssError);
                // Non-critical, continue loading
            }

            try {
                // 1. Fetch HTML
                const response = await fetch(`pages/${pageName}.html`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch page HTML: ${response.status} ${response.statusText}`);
                }
                const html = await response.text();
                mainView.innerHTML = html;
            } catch (fetchError) {
                console.error(`Error fetching HTML for ${pageName}:`, fetchError);
                mainView.innerHTML = `<h1>Error loading page</h1><p>Failed to load page content. Please try again.</p>`;
                return;
            }

            try {
                // 2. Load JS Module
                // We use a timestamp to bust cache during development
                const module = await import(`../pages/${pageName}.js?t=${Date.now()}`);

                // 3. Initialize Page
                if (module && module.init) {
                    try {
                        await module.init(params);
                    } catch (initError) {
                        console.error(`Error initializing page ${pageName}:`, initError);
                        mainView.innerHTML += `<div style="color: #f44; padding: 20px;">Warning: Page initialization encountered errors.</div>`;
                    }
                } else {
                    console.warn(`No init function found for ${pageName}`);
                }
            } catch (moduleError) {
                console.error(`Error loading module for ${pageName}:`, moduleError);
                mainView.innerHTML += `<div style="color: #f44; padding: 20px;">Warning: Failed to load page scripts.</div>`;
            }

            // Apply translations
            try {
                if (window.i18n && typeof window.i18n.applyTranslations === 'function') {
                    window.i18n.applyTranslations();
                }
            } catch (i18nError) {
                console.error('Error applying translations:', i18nError);
            }

            this.currentPage = pageName;

            // 4. Update active nav item
            try {
                document.querySelectorAll('.nav-item').forEach(link => {
                    try {
                        link.classList.remove('active');
                        if (link.dataset.route === pageName) {
                            link.classList.add('active');
                        }
                    } catch (linkError) {
                        console.error('Error updating nav link:', linkError);
                    }
                });
            } catch (navError) {
                console.error('Error updating navigation:', navError);
            }

            // 5. Reset Navigation Focus
            try {
                // Give the DOM a moment to render
                setTimeout(() => {
                    try {
                        SpatialNav.focusFirst();
                    } catch (focusError) {
                        console.error('Error setting initial focus:', focusError);
                    }
                }, 100);
            } catch (timeoutError) {
                console.error('Error setting up focus timeout:', timeoutError);
            }

        } catch (error) {
            console.error(`Critical error loading page ${pageName}:`, error);
            const mainView = document.getElementById('main-view');
            if (mainView) {
                mainView.innerHTML = `<h1>Error loading page</h1><p>${error.message || 'An unexpected error occurred.'}</p>`;
            } else {
                alert(`Critical error: Failed to load page ${pageName}`);
            }
        }
    }
};
