import { Playlists } from '../../logic/playlists.js';
import { Router } from '../js/router.js';
import { Api } from '../../logic/api.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { manageModal } from '../js/utils/ui-helper.js';


let currentPlaylistId = null;

/**
 * Initializes the Playlist Details page controller.
 * Establishes params, fetches the appropriate list entry, and paints the initial screen.
 * 
 * @param {object} params - Key value pairs matching route parameters.
 */
export const init = async (params) => {
    console.log('Initializing Playlist Details', params);
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
            const posterUrl = Api.getImageUrl(firstItem.backdrop_path || firstItem.poster_path);
            posterEl.src = posterUrl;
            posterEl.style.display = 'block';
        } else {
            posterEl.src = 'images/placeholder-playlist.svg';
        }
    }

    // Cinematic Ambient Backdrop
    if (backdropEl) {
        if (playlist.items.length > 0) {
            const firstItem = playlist.items[0];
            const backdropUrl = Api.getImageUrl(firstItem.backdrop_path || firstItem.poster_path, Api.getRecommendedBackdropSize());
            backdropEl.innerHTML = `
                <img src="${backdropUrl}" alt="Backdrop">
                <div class="backdrop-overlay"></div>
            `;
        } else {
            backdropEl.innerHTML = `<div class="backdrop-overlay" style="background-color:#111;"></div>`;
        }
    }

    // Hide delete button for system playlists (like history)
    if (deleteBtn) {
        deleteBtn.style.display = playlist.isSystem ? 'none' : 'flex';
    }

    // Render Items
    const container = document.getElementById('playlist-items-container');
    if (container) {
        container.innerHTML = '';

        if (playlist.items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon" style="font-size: 48px; margin-bottom: 18px;">
                        <span>📺</span>
                    </div>
                    <h2 data-i18n="playlists.emptyPlaylist" style="margin-bottom: 22px; color: #fff; font-size: 24px;">This playlist is empty.</h2>
                    <button id="empty-browse-btn" class="btn btn-secondary focusable">Browse Content</button>
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
 * Constructs a focusable item poster card.
 * Nested mini action overlays are completely removed to resolve Spatial D-pad conflict.
 * Clicking a card triggers the TV context action modal.
 * 
 * @param {object} item - Movie or Series object details.
 * @param {number} index - Current position index.
 * @param {number} total - Total entries in the list.
 * @returns {HTMLDivElement} Configured focusable DOM card element.
 */
function createItemElement(item, index, total) {
    const el = document.createElement('div');
    el.className = 'poster-wrapper focusable';
    el.dataset.id = item.id;
    el.dataset.type = item.media_type;

    const imageUrl = Api.getImageUrl(item.poster_path || item.backdrop_path);

    el.innerHTML = `
        <img class="poster" src="${imageUrl}" loading="lazy" decoding="async" alt="${item.title || item.name}">
    `;

    // Programmatic click opens custom context actions modal
    el.onclick = (e) => {
        e.stopPropagation();
        openItemContextModal(item, index, total);
    };

    return el;
}

/**
 * Opens a focused item actions sheet to play, inspect, remove, or shift indices.
 * Removes previous event bindings using cloneNode to prevent execution leaking.
 * 
 * @param {object} item - Target movie or series object.
 * @param {number} index - Position index.
 * @param {number} total - List total count.
 */
function openItemContextModal(item, index, total) {
    const modal = document.getElementById('item-context-modal');
    const titleEl = document.getElementById('context-item-title');
    const playBtn = document.getElementById('context-play-btn');
    const detailsBtn = document.getElementById('context-details-btn');
    const moveUpBtn = document.getElementById('context-move-up-btn');
    const moveDownBtn = document.getElementById('context-move-down-btn');
    const removeBtn = document.getElementById('context-remove-btn');
    const cancelBtn = document.getElementById('context-cancel-btn');

    if (!modal || !titleEl || !playBtn || !detailsBtn || !moveUpBtn || !moveDownBtn || !removeBtn || !cancelBtn) {
        console.error('Context modal elements not found');
        return;
    }

    titleEl.textContent = item.title || item.name;

    // Up/Down button boundary visibility
    moveUpBtn.style.display = index > 0 ? 'block' : 'none';
    moveDownBtn.style.display = index < total - 1 ? 'block' : 'none';

    // Clean listeners by node replacement
    const playClone = playBtn.cloneNode(true);
    const detailsClone = detailsBtn.cloneNode(true);
    const moveUpClone = moveUpBtn.cloneNode(true);
    const moveDownClone = moveDownBtn.cloneNode(true);
    const removeClone = removeBtn.cloneNode(true);
    const cancelClone = cancelBtn.cloneNode(true);

    playBtn.parentNode.replaceChild(playClone, playBtn);
    detailsBtn.parentNode.replaceChild(detailsClone, detailsBtn);
    moveUpBtn.parentNode.replaceChild(moveUpClone, moveUpBtn);
    moveDownBtn.parentNode.replaceChild(moveDownClone, moveDownBtn);
    removeBtn.parentNode.replaceChild(removeClone, removeBtn);
    cancelBtn.parentNode.replaceChild(cancelClone, cancelBtn);

    const closeModal = manageModal(modal);

    playClone.onclick = () => {
        closeModal();
        Router.loadPage('player', { id: item.id, type: item.media_type });
    };

    detailsClone.onclick = () => {
        closeModal();
        Router.loadPage('details', { id: item.id, type: item.media_type });
    };

    moveUpClone.onclick = () => {
        closeModal();
        Playlists.moveItem(currentPlaylistId, index, index - 1);
        render();
    };

    moveDownClone.onclick = () => {
        closeModal();
        Playlists.moveItem(currentPlaylistId, index, index + 1);
        render();
    };

    removeClone.onclick = () => {
        closeModal();
        showConfirmationModal(
            'Remove Item',
            'Are you sure you want to remove this item from the playlist?',
            () => {
                Playlists.removeFromPlaylist(currentPlaylistId, item.id);
                render();
            }
        );
    };

    cancelClone.onclick = () => {
        closeModal();
    };
}

/**
 * Handles opening the Edit Playlist name/title renaming modal.
 * 
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

    const confirmClone = confirmBtn.cloneNode(true);
    const cancelClone = cancelBtn.cloneNode(true);

    confirmBtn.parentNode.replaceChild(confirmClone, confirmBtn);
    cancelBtn.parentNode.replaceChild(cancelClone, cancelBtn);

    const closeModal = manageModal(modal, inputEl);

    confirmClone.onclick = () => {
        const val = inputEl.value.trim();
        if (val) {
            Playlists.renamePlaylist(currentPlaylistId, val);
            closeModal();
            render();
        }
    };

    cancelClone.onclick = () => {
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
    const playAllBtn = document.getElementById('play-all-btn');
    const backBtn = document.getElementById('back-btn');
    const editInfoBtn = document.getElementById('edit-info-btn');

    const handleLeftNav = (e) => {
        if (e.key === 'ArrowLeft' || e.keyCode === 37) {
            e.preventDefault();
            e.stopPropagation();
            const sidebarLink = document.querySelector('#sidebar-container .nav-item.active') ||
                document.querySelector('#sidebar-container .nav-item');
            if (sidebarLink) {
                SpatialNav.setFocus(sidebarLink);
            }
        }
    };

    if (playAllBtn) {
        if (playlist.items.length > 0) {
            playAllBtn.style.display = 'flex';
            playAllBtn.onclick = () => {
                const firstItem = playlist.items[0];
                Router.loadPage('details', { id: firstItem.id, type: firstItem.media_type });
            };
            playAllBtn.addEventListener('keydown', handleLeftNav);
        } else {
            playAllBtn.style.display = 'none';
        }
    }

    if (backBtn) {
        backBtn.onclick = () => {
            Router.goBack('playlists');
        };
        backBtn.addEventListener('keydown', handleLeftNav);
    }

    if (editInfoBtn) {
        editInfoBtn.style.display = playlist.isSystem ? 'none' : 'flex';
        editInfoBtn.onclick = () => {
            openEditPlaylistModal(playlist);
        };
        editInfoBtn.addEventListener('keydown', handleLeftNav);
    }

    if (!playlist.isSystem) {
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                showConfirmationModal(
                    'Delete Playlist',
                    'Are you sure you want to delete this playlist? This action cannot be undone.',
                    () => {
                        Playlists.deletePlaylist(currentPlaylistId);
                        Router.loadPage('playlists');
                    }
                );
            };
            deleteBtn.addEventListener('keydown', handleLeftNav);
        }
    }
}

/**
 * Triggers a full modal overlay to confirm destructive items removal or deletion.
 * 
 * @param {string} title - Heading title for the prompt.
 * @param {string} message - Explanatory prompt string.
 * @param {function} onConfirm - Success callback to invoke on proceed.
 */
function showConfirmationModal(title, message, onConfirm) {
    const modal = document.getElementById('confirmation-modal');
    const titleEl = modal.querySelector('.modal-title');
    const messageEl = modal.querySelector('.modal-message');
    const confirmBtn = document.getElementById('modal-confirm-btn');
    const cancelBtn = document.getElementById('modal-cancel-btn');

    if (!modal || !titleEl || !messageEl || !confirmBtn || !cancelBtn) {
        console.error('Modal elements not found');
        return;
    }

    titleEl.textContent = title;
    messageEl.textContent = message;

    const confirmClone = confirmBtn.cloneNode(true);
    const cancelClone = cancelBtn.cloneNode(true);

    confirmBtn.parentNode.replaceChild(confirmClone, confirmBtn);
    cancelBtn.parentNode.replaceChild(cancelClone, cancelBtn);

    const closeModal = manageModal(modal);

    confirmClone.onclick = () => {
        onConfirm();
        closeModal();
    };

    cancelClone.onclick = () => {
        closeModal();
    };
}

