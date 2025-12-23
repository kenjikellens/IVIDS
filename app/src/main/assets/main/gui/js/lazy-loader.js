/**
 * LazyLoader - Handles visibility-based fetching and rendering.
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
            rootMargin: '200px', // Pre-load before it comes into view
            threshold: 0.01 // Trigger as soon as 1% is visible
        };

        this.observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.handleIntersection(entry.target);
                }
            });
        }, options);
    }

    /**
     * Register a row for lazy loading.
     * @param {string} elementId - DOM ID of the row container.
     * @param {Function} fetcher - Async function that returns data.
     * @param {Function} renderer - Function(elementId, data) that renders the data.
     */
    register(elementId, fetcher, renderer) {
        const element = document.getElementById(elementId);
        if (!element) return;

        // Store callbacks
        this.registrations.set(elementId, { fetcher, renderer });

        // Start observing
        this.observer.observe(element);
    }

    async handleIntersection(element) {
        const id = element.id;
        const reg = this.registrations.get(id);

        if (reg) {
            // Unobserve immediately to prevent double-fetch
            this.observer.unobserve(element);
            this.registrations.delete(id);

            try {
                // Fetch data
                const data = await reg.fetcher();

                // Render data
                if (reg.renderer) {
                    reg.renderer(id, data);
                }
            } catch (error) {
                console.error(`Lazy load failed for ${id}:`, error);
                // Optionally handle error UI here, e.g. keep skeleton or show retry
            }
        }
    }
}
