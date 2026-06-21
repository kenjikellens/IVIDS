import { createLoaderElement } from './loader.js';

/**
 * Configuration options for visibility-based intersection observer lazy loading.
 */
const CONFIG = {
    ROOT_MARGIN: '400px', // Pre-load elements before they enter viewport (px or %)
    THRESHOLD: 0.01       // Visibility percentage required to trigger load (0.0 to 1.0)
};

/**
 * LazyLoader - Handles visibility-based fetching and rendering.
 * Supports:
 * 1. Row-based lazy loading (fetching data when row is visible)
 * 2. Item-based lazy loading (setting img.src when image is visible)
 */
export class LazyLoader {
    constructor() {
        this.observer = null;
        this.registrations = new Map();
        this.init();
    }

    /**
     * Initializes the IntersectionObserver options (root margin and threshold).
     * Binds visibility intersections to image source lazy loading.
     */
    init() {
        const options = {
            root: null, // viewport
            rootMargin: CONFIG.ROOT_MARGIN, // Pre-load well before it comes into view
            threshold: CONFIG.THRESHOLD // Trigger as soon as 1% is visible
        };

        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.handleIntersection(entry.target);
                }
            });
        }, options);
    }

    /**
     * Register a row for lazy loading data.
     */
    register(elementId, fetcher, renderer) {
        const element = document.getElementById(elementId);
        if (!element) return;

        this.registrations.set(elementId, { fetcher, renderer, type: 'row' });
        this.observer.observe(element);
    }

    /**
     * Observe an individual image or element for lazy source setting.
     */
    observeItem(element) {
        if (!element) return;
        this.observer.observe(element);
    }

    /**
     * Handles intersection events for registered elements by loading row data or setting image sources.
     * This coordinates row rendering on visibility, lazy-creates loading spinners, and manages image loaded state transitions.
     * @param {HTMLElement} element - The intersecting DOM element.
     */
    async handleIntersection(element) {
        // Case 1: Row registration
        const id = element.id;
        const reg = this.registrations.get(id);

        if (reg && reg.type === 'row') {
            this.observer.unobserve(element);
            this.registrations.delete(id);

            try {
                const data = await reg.fetcher();
                if (reg.renderer) {
                    reg.renderer(id, data, null);
                }
            } catch (error) {
                console.error(`Lazy load failed for row ${id}:`, error);
                if (reg.renderer) {
                    reg.renderer(id, null, error);
                }
            }
            return;
        }

        // Case 2: Individual Image Item
        // Find the image in or as the element
        const img = element.tagName === 'IMG' ? element : element.querySelector('img');

        if (img && img.dataset.src) {
            this.observer.unobserve(element);

            // Create and append spinner loader only when loading starts
            if (!img.complete && !element.querySelector('.poster-loader')) {
                const loader = createLoaderElement();
                loader.classList.add('poster-loader');
                element.appendChild(loader);
            }

            // Handle fade-in using addEventListener to avoid overwriting existing onload handlers
            img.addEventListener('load', () => {
                img.style.opacity = '1';
                const loader = element.querySelector('.poster-loader');
                if (loader) loader.remove();
            });

            // Set source
            img.src = img.dataset.src;
            img.removeAttribute('data-src');

            // Fallback for cached images
            if (img.complete) {
                img.style.opacity = '1';
                const loader = element.querySelector('.poster-loader');
                if (loader) loader.remove();
            }
        }
    }
}

// Export a singleton instance for easy access
export const lazyLoader = new LazyLoader();
