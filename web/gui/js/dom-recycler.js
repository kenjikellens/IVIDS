/**
 * DomRecycler - Optimizes long lists by pruning off-screen elements.
 */
export class DomRecycler {
    constructor(options = {}) {
        this.margin = options.margin || '500px';
        this.observer = null;
        this.supportsContentVisibility = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('content-visibility', 'hidden');
        this.init();
    }

    init() {
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const element = entry.target;
                if (entry.isIntersecting) {
                    this.restore(element);
                } else {
                    this.prune(element);
                }
            });
        }, {
            root: null, // viewport
            rootMargin: this.margin
        });
    }

    /**
     * Resets the DOM recycler by disconnecting the observer and reinitializing it.
     * Drops detached element references across page transitions to prevent memory leaks.
     */
    reset() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.init();
    }

    /**
     * Start watching an element (e.g. a row or a large grid item).
     * @param {HTMLElement} element - The DOM element to observe.
     */
    observe(element) {
        if (!element) return;
        this.observer.observe(element);
    }

    /**
     * Replaces content with a placeholder or hides it to save memory and rendering overhead.
     * Uses content-visibility: hidden if supported, falling back to visibility: hidden.
     * @param {HTMLElement} element - The DOM element to prune.
     */
    prune(element) {
        if (element.dataset.pruned === 'true') return;

        if (this.supportsContentVisibility) {
            element.style.contentVisibility = 'hidden';
            element.style.containIntrinsicSize = 'auto 300px';
        } else {
            element.style.visibility = 'hidden';
            element.style.contain = 'layout paint style';
        }
        element.dataset.pruned = 'true';
    }

    /**
     * Restores pruned content when scrolling back into the viewport.
     * @param {HTMLElement} element - The DOM element to restore.
     */
    restore(element) {
        if (element.dataset.pruned !== 'true') return;

        if (this.supportsContentVisibility) {
            element.style.contentVisibility = 'visible';
            element.style.containIntrinsicSize = '';
        } else {
            element.style.visibility = 'visible';
            element.style.contain = '';
        }
        element.dataset.pruned = 'false';
    }
}

export const domRecycler = new DomRecycler();
