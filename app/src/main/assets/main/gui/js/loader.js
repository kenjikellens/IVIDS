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
        <svg class="spinner" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20"></circle>
        </svg>
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
        // Create SVG element with NS
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "spinner");
        svg.setAttribute("viewBox", "0 0 50 50");

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", "25");
        circle.setAttribute("cy", "25");
        circle.setAttribute("r", "20");

        svg.appendChild(circle);
        container.appendChild(svg);
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
