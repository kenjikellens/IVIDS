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

    init() {
        const options = {
            root: null, // viewport
            rootMargin: '400px', // Pre-load well before it comes into view
            threshold: 0.01 // Trigger as soon as 1% is visible
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
                    reg.renderer(id, data);
                }
            } catch (error) {
                console.error(`Lazy load failed for row ${id}:`, error);
            }
            return;
        }

        // Case 2: Individual Image Item
        // Find the image in or as the element
        const img = element.tagName === 'IMG' ? element : element.querySelector('img');

        if (img && img.dataset.src) {
            this.observer.unobserve(element);

            // Handle fade-in using addEventListener to avoid overwriting existing onload handlers
            img.addEventListener('load', () => {
                img.style.opacity = '1';
            });

            // Set source
            img.src = img.dataset.src;
            img.removeAttribute('data-src');

            // Fallback for cached images
            if (img.complete) {
                img.style.opacity = '1';
            }
        }
    }
}

// Export a singleton instance for easy access
export const lazyLoader = new LazyLoader();
