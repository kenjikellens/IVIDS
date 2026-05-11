/**
 * Loader Engine: Automatically populates elements with class "ivids-loader"
 * with the necessary internal structure for the Windows 10 style animation.
 */

/**
 * Returns the simplified HTML structure for the loader.
 * @returns {string} HTML string
 */
export function getLoaderHtml() {
    return `<div class="ivids-loader"></div>`;
}

/**
 * Creates a DOM element for the loader.
 * @returns {HTMLElement} The loader container element
 */
export function createLoaderElement() {
    const div = document.createElement('div');
    div.className = 'ivids-loader';
    
    // Optimization: Inject structure immediately to bypass MutationObserver for this element
    div.innerHTML = `
        <div class="spinner"></div>
    `;
    return div;
}

/**
 * Injects the required SVG circle into a loader container if it doesn't exist.
 * @param {HTMLElement} container 
 */
function injectCircle(container) {
    const isLoader = container.classList.contains('ivids-loader') || container.classList.contains('windows-loader');
    if (container && isLoader && container.children.length === 0) {
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        container.appendChild(spinner);
    }
}

/**
 * Initializes the loader observer to handle both static and dynamic loaders.
 */
export function initLoader() {
    // 1. Handle existing loaders in DOM
    document.querySelectorAll('.ivids-loader, .windows-loader').forEach(injectCircle);

    // 2. Set up observer for dynamically added loaders
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    const isLoader = node.classList.contains('ivids-loader') || node.classList.contains('windows-loader');
                    if (isLoader) {
                        injectCircle(node);
                    }
                    node.querySelectorAll('.ivids-loader, .windows-loader').forEach(injectCircle);
                }
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

// Auto-initialize if this script is loaded (works best as a side-effect import)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoader);
} else {
    initLoader();
}
