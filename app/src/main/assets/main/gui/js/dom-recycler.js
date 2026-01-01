/**
 * DomRecycler - Optimizes long lists by pruning off-screen elements.
 */
export class DomRecycler {
    constructor(options = {}) {
        this.margin = options.margin || '500px';
        this.observer = null;
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
     * Start watching an element (e.g. a row or a large grid item).
     */
    observe(element) {
        if (!element) return;
        this.observer.observe(element);
    }

    /**
     * Replaces content with a placeholder or hides it to save memory.
     */
    prune(element) {
        if (element.dataset.pruned === 'true') return;

        // Strategy: Hide content but keep layout box to prevent scroll jumps
        // We can use content-visibility: hidden for modern browsers, 
        // or manually remove children while keeping a fixed height/width.

        // For simplicity and compatibility on TV:
        element.style.visibility = 'hidden';
        // HTML5 optimization: contain layout/paint/style for hidden elements
        element.style.contain = 'layout paint style';
        element.dataset.pruned = 'true';
    }

    /**
     * Restores the content.
     */
    restore(element) {
        if (element.dataset.pruned !== 'true') return;

        element.style.visibility = 'visible';
        element.style.contain = ''; // Reset containment to avoid clipping (e.g. focus scales)
        element.dataset.pruned = 'false';
    }
}

export const domRecycler = new DomRecycler();
