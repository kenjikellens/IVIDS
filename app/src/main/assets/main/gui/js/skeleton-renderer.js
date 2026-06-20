import { createLoaderElement } from './loader.js';

/**
 * Renders a skeleton row with placeholder posters.
 * @param {string} elementId - The ID of the row container element.
 * @param {number} count - Number of skeleton posters to render (default 20).
 * @param {string} cardType - The type of card to render (e.g. 'collection' or 'poster').
 */
export function renderSkeletonRow(elementId, count = 20, cardType = 'poster') {
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

    const fragment = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
        const skeleton = document.createElement('button');
        skeleton.type = 'button';
        skeleton.className = cardType === 'collection'
            ? 'collection-card focusable is-skeleton'
            : 'poster-wrapper focusable focusable-card is-skeleton';
        skeleton.setAttribute('aria-hidden', 'true'); // Placeholder only

        // We use a CSS-only shimmer effect instead of injecting multiple loader dots
        // but we'll keep the simple loader element if the user wants the "IVIDS" spinner look
        const loader = createLoaderElement();
        skeleton.appendChild(loader);

        fragment.appendChild(skeleton);
    }

    rowPosters.appendChild(fragment);
}

/**
 * Puts the skeleton elements of a row into an error state when API load fails.
 * It replaces the loaders with an error icon, retains D-pad focus, and sets up a click toast handler.
 * @param {string} elementId - The ID of the row container element.
 * @param {Error|any} error - The error object that caused the fetch failure.
 */
export function renderSkeletonErrorRow(elementId, error) {
    const rowPosters = document.getElementById(elementId);
    if (!rowPosters) return;

    const skeletons = rowPosters.querySelectorAll('.is-skeleton');
    skeletons.forEach(skeleton => {
        // Stop shimmer/loading animation
        skeleton.classList.remove('is-skeleton');
        skeleton.classList.add('has-error');

        // Replace loading spinner with error SVG icon (using localized title for accessibility)
        skeleton.innerHTML = `
            <div class="skeleton-error-container">
                <img src="svg/error.svg" class="skeleton-error-icon" alt="${window.i18n.t('error.title')}" />
            </div>
        `;

        // Handle click event to show Toast with dynamic error context
        skeleton.onclick = async () => {
            try {
                // Dynamically import Toast to avoid circular dependency issues
                const { Toast } = await import('./toast.js');
                let message = window.i18n.t('error.contentLoadFailed');

                const isOffline = !navigator.onLine;
                const errMessage = error?.message || String(error || '');

                if (isOffline || errMessage.includes('Failed to fetch') || errMessage.includes('NetworkError') || errMessage.includes('network')) {
                    message = window.i18n.t('error.networkError');
                } else {
                    const httpMatch = errMessage.match(/HTTP error! status:\s*(\d+)/i);
                    if (httpMatch && httpMatch[1]) {
                        message = window.i18n.t('error.serverError').replace('{status}', httpMatch[1]);
                    }
                }

                Toast.show(message, {
                    title: window.i18n.t('error.title'),
                    type: 'error',
                    duration: 5000
                });
            } catch (err) {
                console.error('Failed to show error toast:', err);
            }
        };
    });
}
