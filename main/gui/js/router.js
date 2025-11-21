import { SpatialNav } from './spatial-nav.js';

export const Router = {
    currentPage: null,

    async loadPage(pageName, params = {}) {
        console.log(`Loading page: ${pageName}`);
        const mainView = document.getElementById('main-view');

        try {
            // Update page-specific CSS
            const pageCssLink = document.getElementById('page-css');
            if (pageCssLink) {
                pageCssLink.href = `css/${pageName}.css`;
            }

            // 1. Fetch HTML
            const response = await fetch(`pages/${pageName}.html`);
            const html = await response.text();
            mainView.innerHTML = html;

            // 2. Load JS Module
            // We use a timestamp to bust cache during development
            const module = await import(`../pages/${pageName}.js?t=${Date.now()}`);

            // 3. Initialize Page
            if (module.init) {
                await module.init(params);
            }

            // Apply translations
            if (window.i18n) {
                window.i18n.applyTranslations();
            }

            this.currentPage = pageName;

            // 4. Update active nav item
            document.querySelectorAll('.nav-item').forEach(link => {
                link.classList.remove('active');
                if (link.dataset.route === pageName) {
                    link.classList.add('active');
                }
            });

            // 5. Reset Navigation Focus
            // Give the DOM a moment to render
            setTimeout(() => {
                SpatialNav.focusFirst();
            }, 100);

        } catch (error) {
            console.error(`Error loading page ${pageName}:`, error);
            mainView.innerHTML = `<h1>Error loading page</h1><p>${error.message}</p>`;
        }
    }
};
