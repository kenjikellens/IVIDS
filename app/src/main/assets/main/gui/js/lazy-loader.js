import { createLoaderElement } from './loader.js';
import { imageCache } from '../../logic/image-cache.js';

/**
 * Configuration options for visibility-based intersection observer lazy loading.
 */
const CONFIG = {
    ROOT_MARGIN: '200px', // Pre-load elements before they enter viewport (px or %)
    THRESHOLD: 0.01       // Visibility percentage required to trigger load (0.0 to 1.0)
};

/**
 * LazyLoader - Handles visibility-based fetching, rendering, and 3-phase progressive preloading.
 * 
 * Pipeline:
 * Phase 1: Load all poster images physically visible inside the active viewport.
 * Phase 2: Once Phase 1 finishes, preload remaining offscreen images (to the right) in active rows.
 * Phase 3: Once Phase 2 finishes, preload the next 2 rows vertically below the viewport, then STOP.
 */
export class LazyLoader {
    constructor() {
        this.observer = null;
        this.registrations = new Map();
        this.pipelineRunning = false;
        this.init();
    }

    /**
     * Initializes the IntersectionObserver options (root margin and threshold).
     */
    init() {
        const options = {
            root: null, // viewport
            rootMargin: CONFIG.ROOT_MARGIN,
            threshold: CONFIG.THRESHOLD
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
     * Resets the lazy loader state, disconnects the observer, and clears registered items.
     * Crucial during page transitions to prevent memory leaks and zombie observer callbacks.
     */
    reset() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.registrations.clear();
        this.pipelineRunning = false;
        this.init();
    }

    /**
     * Register a row for lazy loading data.
     */
    register(elementId, fetcher, renderer) {
        const element = document.getElementById(elementId);
        if (!element) return;

        this.registrations.set(elementId, { element, fetcher, renderer, type: 'row' });
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
     * Helper to load a single poster element's image dataset.src and return a Promise that resolves when loaded.
     */
    loadImage(element) {
        if (!element) return Promise.resolve();
        const img = element.tagName === 'IMG' ? element : element.querySelector('img');
        if (!img || !img.dataset.src) return Promise.resolve();

        if (this.observer) {
            this.observer.unobserve(element);
        }

        const originalUrl = img.dataset.src;

        return new Promise((resolve) => {
            if (!img.complete && !element.querySelector('.poster-loader')) {
                const loader = createLoaderElement();
                loader.classList.add('poster-loader');
                element.appendChild(loader);
            }

            let resolved = false;
            const onComplete = () => {
                if (resolved) return;
                resolved = true;
                img.style.opacity = '1';
                const loader = element.querySelector('.poster-loader');
                if (loader) loader.remove();
                resolve();
            };

            img.addEventListener('load', onComplete, { once: true });
            img.addEventListener('error', onComplete, { once: true });
            img.loading = 'lazy';
            img.src = originalUrl;
            img.removeAttribute('data-src');
            if (img.complete) {
                onComplete();
            }
        });
    }

    /**
     * Preloads the next 2 adjacent horizontal posters within the same row during user navigation.
     * Prevents empty poster frames when fast-scrolling horizontally with D-pad or keyboard.
     * @param {HTMLElement} currentElement - The currently focused poster-wrapper or child element
     */
    preloadAdjacentRowPosters(currentElement) {
        if (!currentElement) return;
        const wrapper = currentElement.classList?.contains('poster-wrapper')
            ? currentElement
            : currentElement.closest?.('.poster-wrapper');
        if (!wrapper) return;

        let next = wrapper.nextElementSibling;
        let count = 0;
        while (next && count < 2) {
            if (next.classList?.contains('poster-wrapper') || next.tagName === 'IMG') {
                this.loadImage(next);
                count++;
            }
            next = next.nextElementSibling;
        }
    }

    /**
     * Handles intersection events for registered elements by loading row data or setting image sources.
     */
    async handleIntersection(element) {
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

        // Individual Image Item
        this.loadImage(element);
    }

    /**
     * Executes the 3-Phase Progressive Preloading Pipeline.
     * Phase 1: Load visible posters in viewport rows.
     * Phase 2: Load offscreen posters to the right in visible rows.
     * Phase 3: Preload next 2 rows vertically below viewport, then STOP.
     * 
     * @param {Array<Object>} categories - Ordered list of category objects registered on the page.
     */
    async runProgressivePipeline(categories) {
        if (this.pipelineRunning || !categories || categories.length === 0) return;
        this.pipelineRunning = true;

        try {
            const vh = window.innerHeight;
            const vw = window.innerWidth;

            // Determine visible rows in initial viewport
            const visibleCategoryIndices = [];
            categories.forEach((cat, idx) => {
                const el = document.getElementById(cat.id);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    if (rect.top < vh + 100 && rect.bottom > -100) {
                        visibleCategoryIndices.push(idx);
                    }
                }
            });

            // If no visible categories detected, default to first 2 categories
            if (visibleCategoryIndices.length === 0) {
                visibleCategoryIndices.push(0);
                if (categories.length > 1) visibleCategoryIndices.push(1);
            }

            // Fetch & render content for visible categories first
            for (const idx of visibleCategoryIndices) {
                const cat = categories[idx];
                const reg = this.registrations.get(cat.id);
                if (reg && reg.type === 'row') {
                    await this.handleIntersection(reg.element);
                }
            }

            // Calculate maximum visible columns mathematically to eliminate layout thrashing getBoundingClientRect() calls
            // Average poster width is ~154px + 14px gap = 168px
            const maxCols = Math.min(20, Math.ceil(vw / 168) + 1);

            // FASE 1: Collect & load images physically visible on screen
            const phase1Promises = [];
            visibleCategoryIndices.forEach(idx => {
                const cat = categories[idx];
                const rowEl = document.getElementById(cat.id);
                if (rowEl) {
                    const posters = Array.from(rowEl.querySelectorAll('.poster-wrapper, img[data-src]'));
                    posters.slice(0, maxCols).forEach(poster => {
                        phase1Promises.push(this.loadImage(poster));
                    });
                }
            });

            // Wait for Phase 1 images to complete
            await Promise.allSettled(phase1Promises);
            console.log('ProgressiveLoader: Phase 1 (Visible Viewport Images) Complete');

            // FASE 2: Preload next 2 offscreen images in visible rows (lookahead buffer instead of entire row storm)
            const phase2Promises = [];
            visibleCategoryIndices.forEach(idx => {
                const cat = categories[idx];
                const rowEl = document.getElementById(cat.id);
                if (rowEl) {
                    const posters = Array.from(rowEl.querySelectorAll('.poster-wrapper, img[data-src]'));
                    posters.slice(maxCols, maxCols + 2).forEach(poster => {
                        phase2Promises.push(this.loadImage(poster));
                    });
                }
            });

            // Wait for Phase 2 images to complete
            await Promise.allSettled(phase2Promises);
            console.log('ProgressiveLoader: Phase 2 (Horizontal Offscreen Images) Complete');

            // FASE 3: Load the next 2 rows vertically below viewport (scoped to visible columns)
            const maxVisibleIdx = Math.max(...visibleCategoryIndices);
            const extraRowsToLoad = [maxVisibleIdx + 1, maxVisibleIdx + 2];

            for (const rowIdx of extraRowsToLoad) {
                if (rowIdx < categories.length) {
                    const cat = categories[rowIdx];
                    const reg = this.registrations.get(cat.id);
                    if (reg && reg.type === 'row') {
                        await this.handleIntersection(reg.element);
                    }

                    const rowEl = document.getElementById(cat.id);
                    if (rowEl) {
                        const posters = Array.from(rowEl.querySelectorAll('.poster-wrapper, img[data-src]'));
                        const phase3RowPromises = posters.slice(0, maxCols).map(poster => this.loadImage(poster));
                        await Promise.allSettled(phase3RowPromises);
                    }
                }
            }

            console.log('ProgressiveLoader: Phase 3 (Next 2 Vertical Rows) Complete - STOPPING PRELOADER');

        } catch (err) {
            console.error('ProgressiveLoader: Error executing progressive pipeline', err);
        } finally {
            this.pipelineRunning = false;
        }
    }
}

export const lazyLoader = new LazyLoader();
