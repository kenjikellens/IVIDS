import { Playlists } from '../../logic/playlists.js';
import { Router } from '../js/router.js';
import { Api } from '../../logic/api.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { manageModal, attachImageWithLoader, loadBackgroundWithLoader } from '../js/utils/ui-helper.js';


let currentPlaylistId = null;

let activeMoveIndex = null;

/**
 * Returns the current active reordering index, if any.
 * @returns {number|null} The index of the item currently being reordered.
 */
export function getActiveMoveIndex() {
    return activeMoveIndex;
}

/**
 * Sets the active reordering index.
 * @param {number|null} val - The new move index value.
 */
export function setActiveMoveIndex(val) {
    activeMoveIndex = val;
}

/**
 * Gets the total number of items in the current playlist.
 * @returns {number} The count of items.
 */
export function getPlaylistItemsCount() {
    const playlist = Playlists.getPlaylist(currentPlaylistId);
    return playlist ? playlist.items.length : 0;
}

/**
 * Performs a reorder move action directly from the navigation controls.
 * @param {number} fromIndex - Original index.
 * @param {number} toIndex - New target index.
 * @returns {boolean} True if successfully moved.
 */
export function moveItemInActivePlaylist(fromIndex, toIndex) {
    return Playlists.moveItem(currentPlaylistId, fromIndex, toIndex);
}

/**
 * Re-renders the playlist details screen content.
 */
export function reRenderList() {
    render();
}

/**
 * Initializes the Playlist Details page controller.
 * Establishes params, fetches the appropriate list entry, and paints the initial screen.
 * 
 * @param {object} params - Key value pairs matching route parameters.
 */
export const init = async (params) => {
    console.log('Initializing Playlist Details', params);
    activeMoveIndex = null;
    if (params && params.id) {
        currentPlaylistId = params.id;
        render();
    } else {
        console.error('No playlist ID provided');
        Router.loadPage('playlists');
    }
};

/**
 * Re-fetches the current playlist details state, sets ambient backdrop art,
 * renders child item cards, and triggers layout translations.
 */
function render() {
    const playlist = Playlists.getPlaylist(currentPlaylistId);
    if (!playlist) {
        console.error('Playlist not found');
        Router.loadPage('playlists');
        return;
    }

    // Update Sidebar Info
    const titleEl = document.getElementById('playlist-title');
    const countEl = document.getElementById('playlist-count');
    const backdropEl = document.getElementById('playlist-backdrop');
    const deleteBtn = document.getElementById('delete-playlist-btn');
    const clearBtn = document.getElementById('clear-playlist-btn');

    if (titleEl) titleEl.textContent = playlist.name;
    if (countEl) {
        const count = playlist.items.length;
        countEl.textContent = count === 1 ? '1 item' : `${count} items`;
    }

    // Update Hero Poster Image
    const posterEl = document.getElementById('playlist-poster');
    if (posterEl) {
        if (playlist.items.length > 0) {
            const firstItem = playlist.items[0];
            const posterSize = firstItem.backdrop_path ? Api.getRecommendedBackdropSize() : Api.getRecommendedDetailPosterSize();
            const posterUrl = Api.getImageUrl(firstItem.backdrop_path || firstItem.poster_path, posterSize);
            posterEl.classList.remove('hidden');
            posterEl.style.display = 'block';
            if (posterEl.parentElement) posterEl.parentElement.classList.remove('is-empty', 'is-widescreen');
            attachImageWithLoader(posterEl, posterEl.parentElement, posterUrl, () => {
                posterEl.classList.add('hidden');
                posterEl.style.display = 'none';
                if (posterEl.parentElement) posterEl.parentElement.classList.add('is-empty', 'is-widescreen');
            });
            if (false) {
                posterEl.src = posterUrl;
                posterEl.classList.remove('hidden');
                posterEl.style.display = 'block';
            }
            if (posterEl.parentElement) posterEl.parentElement.classList.remove('is-empty', 'is-widescreen');
            if (false && posterEl) {
                posterEl.onerror = () => {
                    posterEl.classList.add('hidden');
                    posterEl.style.display = 'none';
                    if (posterEl.parentElement) posterEl.parentElement.classList.add('is-empty', 'is-widescreen');
                };
                posterEl.style.display = 'block';
            }
        } else {
            posterEl.removeAttribute('src');
            posterEl.classList.add('hidden');
            posterEl.style.display = 'none';
            if (posterEl.parentElement) posterEl.parentElement.classList.add('is-empty', 'is-widescreen');
        }
    }

    // Cinematic Ambient Backdrop
    if (backdropEl) {
        if (playlist.items.length > 0) {
            const firstItem = playlist.items[0];
            const backdropUrl = Api.getImageUrl(firstItem.backdrop_path || firstItem.poster_path, Api.getRecommendedBackdropSize());
            backdropEl.classList.remove('media-backdrop--empty');
            backdropEl.innerHTML = `
                <img src="${backdropUrl}" alt="Backdrop">
                <div class="backdrop-overlay"></div>
            `;
        } else {
            backdropEl.classList.remove('media-backdrop--empty');
            backdropEl.classList.add('media-backdrop--empty');
            backdropEl.innerHTML = `<div class="media-backdrop__overlay backdrop-overlay backdrop-overlay-empty"></div>`;
        }
    }

    // Hide delete button for system playlists (like history), manage clear button
    if (deleteBtn) {
        deleteBtn.style.display = playlist.isSystem ? 'none' : 'flex';
    }
    if (clearBtn) {
        clearBtn.style.display = (playlist.isSystem && playlist.items.length > 0) ? 'flex' : 'none';
    }

    // Render Items
    const container = document.getElementById('playlist-items-container');
    if (container) {
        container.innerHTML = '';

        if (playlist.items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon empty-state-icon">
                        <span>📺</span>
                    </div>
                    <h2 data-i18n="playlists.emptyPlaylist" class="empty-state-heading">This playlist is empty.</h2>
                    <button id="empty-browse-btn" class="btn btn--secondary focusable">Browse Content</button>
                </div>
            `;

            // Programmatically bind empty state action
            setTimeout(() => {
                const browseBtn = document.getElementById('empty-browse-btn');
                if (browseBtn) {
                    browseBtn.onclick = () => {
                        Router.loadPage('home');
                    };
                }
            }, 0);
        } else {
            playlist.items.forEach((item, index) => {
                const el = createItemElement(item, index, playlist.items.length);
                container.appendChild(el);
            });
        }
    }

    attachListeners(playlist);

    // Apply translations
    if (window.i18n) window.i18n.applyTranslations();

    // Re-init spatial nav after DOM settles
    setTimeout(() => {
        SpatialNav.focusFirst();
    }, 50);
}

/**
 * Toggles move reordering mode for a given playlist item index.
 * Registers or removes spatial navigation back handlers accordingly.
 * 
 * @param {number} index - Index of the item to move.
 */
function toggleMoveMode(index) {
    if (activeMoveIndex === index) {
        activeMoveIndex = null;
        render();
        // Shift focus back to the move button of the item
        setTimeout(() => {
            const btn = document.querySelector(`.playlist-action-btn[data-index="${index}"], .btn--circle[data-index="${index}"]`);
            if (btn) btn.focus();
        }, 10);
    } else {
        activeMoveIndex = index;
        render();

        const moveBackHandler = () => {
            if (activeMoveIndex !== null) {
                activeMoveIndex = null;
                render();
                SpatialNav.popBackHandler(moveBackHandler);
                return true;
            }
            return false;
        };
        SpatialNav.pushBackHandler(moveBackHandler);

        // Shift focus back to the move button of the item
        setTimeout(() => {
            const btn = document.querySelector(`.playlist-action-btn[data-index="${index}"], .btn--circle[data-index="${index}"]`);
            if (btn) btn.focus();
        }, 10);
    }
}

/**
 * Constructs a focusable item row resembling the episode listings.
 * Contains the movie details card and circular Move and Delete action buttons.
 * 
 * @param {object} item - Movie or Series object details.
 * @param {number} index - Current position index.
 * @param {number} total - Total entries in the list.
 * @returns {HTMLDivElement} Configured item row element.
 */
function createItemElement(item, index, total) {
    const row = document.createElement('div');
    row.className = 'playlist-item-row';
    if (activeMoveIndex === index) {
        row.classList.add('moving-active');
    }

    const cardWrapper = document.createElement('div');
    cardWrapper.className = 'playlist-item-card-wrapper';

    const itemCard = document.createElement('div');
    itemCard.className = 'card card--row card--interactive episode-item focusable';
    itemCard.tabIndex = 0;
    itemCard.dataset.id = item.id;
    itemCard.dataset.type = item.media_type;

    const imageSize = item.backdrop_path ? Api.getRecommendedStillSize() : Api.getRecommendedPosterSize();
    const imageUrl = Api.getImageUrl(item.backdrop_path || item.poster_path, imageSize);
    const thumbStyle = '';

    itemCard.innerHTML = `
        <div class="card__thumb card__thumb--sm"${thumbStyle}></div>
        <div class="card__body">
            <div class="episode-header">
                <span class="episode-number">${index + 1}</span>
                <span class="card__title">${item.title || item.name}</span>
            </div>
            <p class="card__desc">${item.overview || ''}</p>
        </div>
    `;

    // Click on item card navigates to content details
    if (imageUrl) loadBackgroundWithLoader(itemCard.querySelector('.card__thumb'), imageUrl);
    itemCard.onclick = () => {
        Router.loadPage('details', { id: item.id, type: item.media_type });
    };

    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = 'card__actions playlist-item-actions';

    // Circular Move button
    const moveBtn = document.createElement('button');
    moveBtn.className = 'btn btn--secondary btn--circle playlist-action-btn focusable';
    if (activeMoveIndex === index) {
        moveBtn.classList.add('is-active', 'active');
    }
    moveBtn.dataset.index = index;
    moveBtn.title = window.i18n ? window.i18n.t('playlists.moveItem') : "Move Item";
    moveBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M7 15l5 5 5-5M7 9l5-5 5 5" />
        </svg>
    `;

    moveBtn.onclick = (e) => {
        e.stopPropagation();
        toggleMoveMode(index);
    };

    // Circular Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn--secondary btn--circle focusable';
    deleteBtn.dataset.index = index;
    deleteBtn.title = window.i18n ? window.i18n.t('playlists.deleteItem') : "Remove Item";
    deleteBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
        </svg>
    `;

    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        const title = window.i18n ? window.i18n.t('playlists.removeItemTitle') : 'Remove Item';
        const msg = window.i18n ? window.i18n.t('playlists.removeItemMessage') : 'Are you sure you want to remove this item from the playlist?';
        showConfirmationModal(
            title,
            msg,
            () => {
                Playlists.removeFromPlaylist(currentPlaylistId, item.id);
                render();
            }
        );
    };

    cardWrapper.appendChild(itemCard);
    actionsWrapper.appendChild(moveBtn);
    actionsWrapper.appendChild(deleteBtn);

    row.appendChild(cardWrapper);
    row.appendChild(actionsWrapper);

    return row;
}

/**
 * Handles opening the Edit Playlist name/title renaming modal.
 * Updates the modal input with the current playlist name and configures confirm/cancel click actions.
 * @param {object} playlist - Target playlist object.
 */
function openEditPlaylistModal(playlist) {
    const modal = document.getElementById('edit-playlist-modal');
    const inputEl = document.getElementById('edit-playlist-name-input');
    const confirmBtn = document.getElementById('edit-playlist-confirm-btn');
    const cancelBtn = document.getElementById('edit-playlist-cancel-btn');

    if (!modal || !inputEl || !confirmBtn || !cancelBtn) {
        console.error('Edit modal elements not found');
        return;
    }

    inputEl.value = playlist.name;

    const closeModal = manageModal(modal, inputEl);

    confirmBtn.onclick = () => {
        const val = inputEl.value.trim();
        if (val) {
            Playlists.renamePlaylist(currentPlaylistId, val);
            closeModal();
            render();
        }
    };

    cancelBtn.onclick = () => {
        closeModal();
    };
}

/**
 * Attaches core sidebar handlers and button routing actions.
 * 
 * @param {object} playlist - Selected playlist metadata.
 */
function attachListeners(playlist) {
    const deleteBtn = document.getElementById('delete-playlist-btn');
    const clearBtn = document.getElementById('clear-playlist-btn');
    const playAllBtn = document.getElementById('play-all-btn');
    const backBtn = document.getElementById('back-btn');
    const editInfoBtn = document.getElementById('edit-info-btn');

    if (playAllBtn) {
        if (playlist.items.length > 0) {
            playAllBtn.style.display = 'flex';
            playAllBtn.onclick = () => {
                const firstItem = playlist.items[0];
                Router.loadPage('details', { id: firstItem.id, type: firstItem.media_type });
            };
        } else {
            playAllBtn.style.display = 'none';
        }
    }

    if (backBtn) {
        backBtn.onclick = () => {
            Router.goBack('playlists');
        };
    }

    if (editInfoBtn) {
        editInfoBtn.style.display = playlist.isSystem ? 'none' : 'flex';
        editInfoBtn.onclick = () => {
            openEditPlaylistModal(playlist);
        };
    }

    if (clearBtn) {
        if (playlist.isSystem) {
            clearBtn.onclick = () => {
                const title = window.i18n ? window.i18n.t('playlists.clearHistoryTitle') : 'Clear Recently Watched';
                const msg = window.i18n ? window.i18n.t('playlists.clearHistoryMessage') : 'Are you sure you want to clear your recently watched history?';
                showConfirmationModal(
                    title,
                    msg,
                    () => {
                        Playlists.clearPlaylist(currentPlaylistId);
                        render();
                    }
                );
            };
        }
    }

    if (!playlist.isSystem) {
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                const title = window.i18n ? window.i18n.t('playlists.deleteConfirmTitle') : 'Delete Playlist';
                const msg = window.i18n ? window.i18n.t('playlists.deleteConfirmMessage') : 'Are you sure you want to delete this playlist? This action cannot be undone.';
                showConfirmationModal(
                    title,
                    msg,
                    () => {
                        Playlists.deletePlaylist(currentPlaylistId);
                        Router.loadPage('playlists');
                    }
                );
            };
        }
    }
}

/**
 * Triggers a full modal overlay to confirm destructive items removal or deletion.
 * Updates the confirmation dialog text and registers directly-assigned click actions for confirmation and cancellation.
 * @param {string} title - Heading title for the prompt.
 * @param {string} message - Explanatory prompt string.
 * @param {function} onConfirm - Success callback to invoke on proceed.
 */
function showConfirmationModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmation-modal');
    const titleEl = modal.querySelector('.modal__title, .modal-title');
    const messageEl = modal.querySelector('.modal__desc, .modal-message');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    if (!modal || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
        console.error('Modal elements not found');
        return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;

    const closeModal = manageModal(modal);

    confirmBtn.onclick = () => {
        onConfirm();
        closeModal();
    };

    cancelBtn.onclick = () => {
        closeModal();
    };
}
