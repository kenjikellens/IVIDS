/**
 * Returns the HTML structure for the premium loader.
 * This matches the structure required by loader.css
 * @returns {string} HTML string
 */
export function getLoaderHtml() {
    return `
    <div class="premium-loader">
        <div class="loader-ring"></div>
        <div class="loader-ring"></div>
        <div class="loader-ring"></div>
        <div class="loader-core"></div>
    </div>
    `;
}

/**
 * Creates a DOM element for the loader.
 * @returns {HTMLElement} The loader container element
 */
export function createLoaderElement() {
    const div = document.createElement('div');
    div.innerHTML = getLoaderHtml();
    return div.firstElementChild;
}
