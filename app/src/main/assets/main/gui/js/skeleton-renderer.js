import { createLoaderElement } from './loader.js';

/**
 * Renders a skeleton row with placeholder posters.
 * @param {string} elementId - The ID of the row container element.
 * @param {number} count - Number of skeleton posters to render (default 20).
 */
export function renderSkeletonRow(elementId, count = 20) {
    const rowPosters = document.getElementById(elementId);
    if (!rowPosters) return;

    rowPosters.innerHTML = '';

    // Create container if not already wrapped
    let container = rowPosters.parentElement;
    if (container && !container.classList.contains('row-container')) {
        container = document.createElement('div');
        container.className = 'row-container';
        rowPosters.parentNode.insertBefore(container, rowPosters);
        container.appendChild(rowPosters);
    }

    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('button');
        skeleton.type = 'button';
        skeleton.className = 'skeleton-poster focusable';
        skeleton.setAttribute('aria-hidden', 'true'); // Placeholder only

        // We use a CSS-only shimmer effect instead of injecting multiple loader dots
        // but we'll keep the simple loader element if the user wants the "IVIDS" spinner look
        const loader = createLoaderElement();
        skeleton.appendChild(loader);

        rowPosters.appendChild(skeleton);
    }
}
