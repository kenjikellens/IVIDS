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
 * It replaces the loaders with error icons and establishes a delegated click listener on the parent container
 * to display detailed error toast alerts without attaching individual event listeners to each card.
 * @param {string} elementId - The ID of the row container element.
 * @param {Error|any} error - The error object that caused the fetch failure.
 */
export function renderSkeletonErrorRow(elementId, error) {
    const rowPosters = document.getElementById(elementId);
    if (!rowPosters) return;

    // Cache the error context on the row element for delegated retrieval
    rowPosters._errorContext = error;

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
    });

    // Establish a single delegated listener on the parent container if not already present
    if (!rowPosters._hasErrorDelegation) {
        rowPosters.addEventListener('click', async (e) => {
            const errorCard = e.target.closest('.has-error');
            if (!errorCard || !rowPosters.contains(errorCard)) return;

            try {
                // Dynamically import Toast to avoid circular dependency issues
                const { Toast } = await import('./toast.js');
                const rowErr = rowPosters._errorContext;
                let message = window.i18n.t('error.contentLoadFailed');

                const isOffline = !navigator.onLine;
                const errMessage = rowErr?.message || String(rowErr || '');

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
        });
        rowPosters._hasErrorDelegation = true;
    }
}
