import { Api } from '../../../logic/api.js';
import { Router } from '../router.js';
import { createLoaderElement } from '../loader.js';
import { lazyLoader } from '../lazy-loader.js';
import { domRecycler } from '../dom-recycler.js';
import { renderSkeletonRow } from '../skeleton-renderer.js';
import { SpatialNav } from '../spatial-nav.js';


/**
 * Populates a content row with poster buttons, configures lazy loading, and runs DOM recycling.
 * It dynamically creates button/image elements in the specified container and links clicking them to page routing.
 * @param {string} elementId - The ID of the target row element.
 * @param {Array<Object>} items - List of content objects to render.
 * @param {string} [defaultType] - Default media type ('movie' or 'tv') if not present on the item.
 */
export function setupRow(elementId, items, defaultType = null) {
    try {
        const rowPosters = document.getElementById(elementId);
        if (!rowPosters) {
            console.warn(`Row element ${elementId} not found`);
            return;
        }

        // Get existing skeleton or poster buttons
        const existingButtons = Array.from(rowPosters.querySelectorAll('.poster-wrapper'));

        if (!items || items.length === 0) {
            console.log(`No items for row ${elementId}`);
            // Remove all existing buttons if no items
            existingButtons.forEach(btn => btn.remove());
            return;
        }

        // Create container if not already wrapped (idempotency check)
        try {
            let container = rowPosters.parentElement;
            if (container && !container.classList.contains('row-container')) {
                container = document.createElement('div');
                container.className = 'row-container';
                rowPosters.parentNode.insertBefore(container, rowPosters);
                container.appendChild(rowPosters);

                // Observe container for DOM recycling (pruning off-screen rows)
                domRecycler.observe(container);
            }
        } catch (containerError) {
            console.error('Error creating row container:', containerError);
        }

        items.forEach((item, index) => {
            try {
                if (!item.poster_path) return;

                let btn;
                if (existingButtons[index]) {
                    btn = existingButtons[index];
                    btn.innerHTML = '';
                    btn.classList.remove('is-skeleton');
                    btn.removeAttribute('aria-hidden');
                } else {
                    btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'poster-wrapper focusable';
                    rowPosters.appendChild(btn);
                }

                // Create loader for the image session
                const loader = createLoaderElement();
                loader.classList.add('poster-loader');
                btn.appendChild(loader);

                const img = document.createElement('img');
                img.className = 'poster';
                img.decoding = 'async';
                img.style.opacity = '0'; // Hide initially
                img.onload = () => {
                    img.style.opacity = '1';
                    if (loader.parentNode) loader.parentNode.removeChild(loader);
                };
                img.onerror = () => {
                    if (loader.parentNode) loader.parentNode.removeChild(loader);
                    img.style.opacity = '1';
                };
                const containerWidth = btn.clientWidth;
                const sizeKey = Api.getRecommendedSizeForContainer(containerWidth, false);
                img.dataset.src = Api.getImageUrl(item.poster_path, sizeKey);
                img.alt = item.title || item.name || 'Unknown';

                btn.appendChild(img);

                // Determine media type
                let type = item.media_type;
                if (!type) {
                    if (defaultType) {
                        type = defaultType;
                    } else if (item.title) {
                        type = 'movie';
                    } else if (item.name) {
                        type = 'tv';
                    } else {
                        type = 'movie';
                    }
                }

                btn.onclick = () => {
                    try {
                        Router.loadPage('details', { id: item.id, type: type });
                    } catch (navError) {
                        console.error('Error navigating to details:', navError);
                    }
                };

                // Observe the container for lazy loading the image
                lazyLoader.observeItem(btn);
            } catch (itemError) {
                console.error('Error rendering poster item:', itemError);
            }
        });

        // Remove any remaining skeletons if data count is smaller
        for (let i = items.length; i < existingButtons.length; i++) {
            existingButtons[i].remove();
        }
    } catch (error) {
        console.error(`Error in setupRow for ${elementId}:`, error);
    }
}

/**
 * Sets up skeleton rows immediately and registers lazy loaders to populate content.
 * It manages the lifecycle of rendering skeletons, fetching actual content, and updating rows.
 * @param {Array<Object>} categories - List of category objects containing element id and fetcher function.
 * @param {string} [defaultType] - Default media type ('movie' or 'tv') passed down to setupRow.
 */
export function setupLazyLoadedRows(categories, defaultType = null) {
    categories.forEach(cat => {
        renderSkeletonRow(cat.id, 20, 'poster');
    });

    categories.forEach(cat => {
        lazyLoader.register(cat.id, async () => {
            return await cat.fetcher();
        }, (id, data) => {
            if (data) {
                setupRow(id, data, defaultType);
            } else {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '';
            }
        });
    });
}

/**
 * Manages modal container lifecycle, portaling it to document.body, updating inline style attributes, 
 * applying activation transitions, and configuring spatial navigation focus traps.
 * @param {HTMLElement} modal - The modal container element to manage.
 * @param {HTMLElement} [focusTarget] - The element to focus initially when opening the modal.
 * @returns {Function} A cleanup function to safely close the modal, fade it out, and return it to its original DOM parent.
 */
export function manageModal(modal, focusTarget = null) {
    const originalParent = modal.parentElement;

    // Move to body to escape parent stacking context or overflow bounds
    document.body.appendChild(modal);

    // Force inline display settings to override any stylesheet conflicts
    modal.style.setProperty('display', 'flex', 'important');
    modal.style.setProperty('visibility', 'visible', 'important');
    modal.style.setProperty('z-index', '99999', 'important');

    let modalBackHandler;

    const closeModal = () => {
        if (modalBackHandler) {
            SpatialNav.popBackHandler(modalBackHandler);
            modalBackHandler = null;
        }
        modal.classList.remove('show');
        modal.style.setProperty('opacity', '0', 'important');
        setTimeout(() => {
            modal.classList.remove('active');
            modal.style.setProperty('display', 'none', 'important');
            modal.style.setProperty('visibility', 'hidden', 'important');
            if (originalParent && originalParent.appendChild) {
                originalParent.appendChild(modal);
            }
        }, 300);
        SpatialNav.clearFocusTrap();
        SpatialNav.refocus();
    };

    modalBackHandler = () => {
        closeModal();
        return true; // Handled
    };
    SpatialNav.pushBackHandler(modalBackHandler);

    setTimeout(() => {
        modal.style.setProperty('opacity', '1', 'important');
        modal.classList.add('active', 'show');
    }, 10);
    SpatialNav.setFocusTrap(modal);
    if (focusTarget) {
        SpatialNav.setFocus(focusTarget);
        if (typeof focusTarget.focus === 'function') {
            focusTarget.focus();
        }
    } else {
        SpatialNav.focusFirst();
    }

    return closeModal;
}
