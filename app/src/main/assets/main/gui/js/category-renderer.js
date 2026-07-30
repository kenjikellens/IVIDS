import { CATEGORY_CONFIG } from '../../logic/constants.js';

/**
 * CategoryRenderer - OOP Helper class responsible for dynamically constructing
 * category row DOM elements based on centralized configuration definitions.
 */
export class CategoryRenderer {
    /**
     * Renders category rows for a specific page type into a container element.
     * @param {HTMLElement} container - The target host container element.
     * @param {string} pageKey - The page key in CATEGORY_CONFIG ('home', 'movies', 'series').
     */
    static renderRows(container, pageKey) {
        if (!container) {
            console.error(`CategoryRenderer: Host container not found for page key '${pageKey}'`);
            return;
        }

        const categories = CATEGORY_CONFIG[pageKey];
        if (!Array.isArray(categories)) {
            console.error(`CategoryRenderer: No category definitions found for page key '${pageKey}'`);
            return;
        }

        // Clear host container before appending dynamic rows
        container.innerHTML = '';

        const fragment = document.createDocumentFragment();

        categories.forEach(cat => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'row';

            const titleH2 = document.createElement('h2');
            titleH2.className = 'row-title';
            if (cat.i18nKey) {
                titleH2.setAttribute('data-i18n', cat.i18nKey);
            }
            titleH2.textContent = cat.defaultTitle || '';

            const postersDiv = document.createElement('div');
            postersDiv.className = 'row-posters';
            postersDiv.id = cat.id;

            rowDiv.appendChild(titleH2);
            rowDiv.appendChild(postersDiv);
            fragment.appendChild(rowDiv);
        });

        // Add bottom spacer
        const spacer = document.createElement('div');
        spacer.className = 'spacer-y-50';
        fragment.appendChild(spacer);

        container.appendChild(fragment);

        // Apply i18n translations if window.i18n is initialized
        if (window.i18n && typeof window.i18n.translatePage === 'function') {
            window.i18n.translatePage();
        }
    }
}
