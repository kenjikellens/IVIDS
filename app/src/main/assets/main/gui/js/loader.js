/**
 * Loader Engine: Automatically populates elements with class "ivids-loader"
 * with the necessary internal structure for the Windows 10 style animation.
 */

/**
 * Returns the simplified HTML structure for the loader.
 * @returns {string} HTML string
 */
export function getLoaderHtml() {
    return `<div class="ivids-loader"><img src="svg/loader.svg" class="ivids-loader-svg" alt="Loading..." /></div>`;
}

/**
 * Creates a DOM element for the loader.
 * @returns {HTMLElement} The loader container element
 */
export function createLoaderElement() {
    const div = document.createElement('div');
    div.className = 'ivids-loader';
    div.innerHTML = `<img src="svg/loader.svg" class="ivids-loader-svg" alt="Loading..." />`;
    return div;
}

/**
 * Injects the required SVG circle into a loader container if it doesn't exist.
 * @param {HTMLElement} container 
 */
function injectCircle(container) {
    const isLoader = container.classList.contains('ivids-loader') || container.classList.contains('windows-loader');
    if (container && isLoader && container.children.length === 0) {
        const img = document.createElement('img');
        img.src = 'svg/loader.svg';
        img.className = 'ivids-loader-svg';
        img.alt = 'Loading...';
        container.appendChild(img);
    }
}

/**
 * Initializes existing static loaders in the DOM.
 */
export function initLoader() {
    // Handle existing static loaders in DOM
    document.querySelectorAll('.ivids-loader, .windows-loader').forEach(injectCircle);
}

// Auto-initialize if this script is loaded (works best as a side-effect import)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoader);
} else {
    initLoader();
}
