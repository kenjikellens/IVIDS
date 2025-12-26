import { Playlists } from '../../logic/playlists.js';
import { Router } from '../js/router.js';
import { Api } from '../../logic/api.js';
import { SpatialNav } from '../js/spatial-nav.js';

let currentPlaylistId = null;

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
    if (countEl) countEl.textContent = `${playlist.items.length} items`;

    // Cinematic Backdrop
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

    // Hide delete button for system playlists
    if (deleteBtn) {
        deleteBtn.style.display = playlist.isSystem ? 'none' : 'flex';
    }

    // Render Items
    const container = document.getElementById('playlist-items-container');
    if (container) {
        container.innerHTML = '';

        if (playlist.items.length === 0) {
            container.innerHTML = `
                <div class="playlist-empty-state">
                    <div class="empty-icon">
                        <span style="font-size: 60px;">📺</span>
                    </div>
                    <h2 data-i18n="playlists.emptyPlaylist">This playlist is empty.</h2>
                    <button id="empty-browse-btn" class="empty-action-btn focusable">Browse Content</button>
                </div>
            `;

            // Add listener for the browse button
            setTimeout(() => {
                const browseBtn = document.getElementById('empty-browse-btn');
                if (browseBtn) {
                    browseBtn.addEventListener('click', () => {
                        Router.loadPage('home');
                    });
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

    // Re-init spatial nav after a short delay to allow DOM to settle
    setTimeout(() => {
        SpatialNav.focusFirst();
    }, 50);
}

function createItemElement(item, index, total) {
    const el = document.createElement('div');
    el.className = 'playlist-item-card focusable';
    el.dataset.id = item.id;
    el.dataset.type = item.media_type;

    const imageUrl = Api.getImageUrl(item.backdrop_path || item.poster_path);

    el.innerHTML = `
        <div class="item-thumbnail">
            <img src="${imageUrl}" loading="lazy">
            <div class="item-actions-overlay">
                ${index > 0 ? `<button class="icon-btn-mini move-up-btn focusable" title="Move Up">▲</button>` : ''}
                ${index < total - 1 ? `<button class="icon-btn-mini move-down-btn focusable" title="Move Down">▼</button>` : ''}
                <button class="icon-btn-mini remove-btn focusable" title="Remove">✕</button>
            </div>
        </div>
        <div class="item-info">
            <div class="item-title">${item.title || item.name}</div>
            <div class="item-meta">
                <span>${item.media_type === 'tv' ? 'Series' : 'Movie'}</span>
                <span>#${index + 1}</span>
            </div>
        </div>
    `;

    // Click to play/details
    el.addEventListener('click', (e) => {
        // If clicked on action buttons, don't navigate
        if (e.target.closest('.icon-btn-mini')) return;
        Router.loadPage('details', { id: item.id, type: item.media_type });
    });

    // Action Listeners
    const moveUpBtn = el.querySelector('.move-up-btn');
    const moveDownBtn = el.querySelector('.move-down-btn');
    const removeBtn = el.querySelector('.remove-btn');

    if (moveUpBtn) {
        moveUpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            Playlists.moveItem(currentPlaylistId, index, index - 1);
            render();
        });
    }

    if (moveDownBtn) {
        moveDownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            Playlists.moveItem(currentPlaylistId, index, index + 1);
            render();
        });
    }

    if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showConfirmationModal(
                'Remove Item',
                'Are you sure you want to remove this item from the playlist?',
                () => {
                    Playlists.removeFromPlaylist(currentPlaylistId, item.id);
                    render();
                }
            );
        });
    }

    return el;
}

function attachListeners(playlist) {
    const deleteBtn = document.getElementById('delete-playlist-btn');
    const playAllBtn = document.getElementById('play-all-btn');
    const backBtn = document.getElementById('back-btn');
    const editInfoBtn = document.getElementById('edit-info-btn');

    const handleLeftNav = (e) => {
        if (e.key === 'ArrowLeft' || e.keyCode === 37) {
            e.preventDefault();
            e.stopPropagation();
            // Find the active sidebar link or the first one
            const sidebarLink = document.querySelector('#sidebar-container .nav-item.active') ||
                document.querySelector('#sidebar-container .nav-item');
            if (sidebarLink) {
                SpatialNav.setFocus(sidebarLink);
            }
        }
    };

    if (playAllBtn && playlist.items.length > 0) {
        playAllBtn.addEventListener('click', () => {
            // Navigate to details page of first item
            const firstItem = playlist.items[0];
            Router.loadPage('details', { id: firstItem.id, type: firstItem.media_type });
        });
        playAllBtn.addEventListener('keydown', handleLeftNav);
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            Router.goBack('playlists');
        });
        backBtn.addEventListener('keydown', handleLeftNav);
    }

    if (editInfoBtn) {
        editInfoBtn.addEventListener('click', () => {
            // Placeholder for Edit Info
            console.log('Edit Info clicked');
            alert('Edit Info feature coming soon!');
        });
        editInfoBtn.addEventListener('keydown', handleLeftNav);
    }

    if (!playlist.isSystem) {
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                showConfirmationModal(
                    'Delete Playlist',
                    'Are you sure you want to delete this playlist? This action cannot be undone.',
                    () => {
                        Playlists.deletePlaylist(currentPlaylistId);
                        Router.loadPage('playlists');
                    }
                );
            });
            // Also add left nav to delete button for consistency if it's in the same column
            deleteBtn.addEventListener('keydown', handleLeftNav);
        }
    }
}

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

    const closeModal = () => {
        modal.classList.remove('active');
        confirmBtn.removeEventListener('click', handleConfirm);
        cancelBtn.removeEventListener('click', handleCancel);
        // Restore focus to main view or previous element if possible
        // For now, just re-init spatial nav to find something focusable
    };

    const handleConfirm = () => {
        onConfirm();
        closeModal();
    };

    const handleCancel = () => {
        closeModal();
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);

    modal.classList.add('active');

    // Focus cancel button by default for safety
    cancelBtn.focus();
}
