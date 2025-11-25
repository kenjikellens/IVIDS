import { Playlists } from '../../logic/playlists.js';
import { Router } from '../js/router.js';
import { Api } from '../../logic/api.js';
import { SpatialNav } from '../js/spatial-nav.js';
import i18n from '../js/i18n.js';

export function init() {
    renderPlaylists();
    setupEventListeners();
    i18n.applyTranslations();
}

function renderPlaylists() {
    const grid = document.getElementById('playlists-grid');
    const sidebar = document.getElementById('playlists-sidebar');
    const emptyState = document.getElementById('playlists-empty-state');
    grid.innerHTML = '';

    const playlists = Playlists.getPlaylists();

    if (playlists.length === 0) {
        // Show empty state, hide sidebar
        emptyState.classList.add('visible');
        sidebar.classList.remove('visible');
        return;
    }

    // Hide empty state, show sidebar
    emptyState.classList.remove('visible');
    sidebar.classList.add('visible');

    playlists.forEach(playlist => {
        const card = document.createElement('div');
        card.className = 'playlist-card focusable';
        card.tabIndex = 0;

        // Use the first item's image as background if available
        let bgImage = '';
        if (playlist.items.length > 0) {
            const firstItem = playlist.items[0];
            const path = firstItem.backdrop_path || firstItem.poster_path;
            if (path) {
                bgImage = `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.8)), url(${Api.getImageUrl(path)})`;
            }
        }

        if (bgImage) {
            card.style.backgroundImage = bgImage;
            card.style.backgroundSize = 'cover';
            card.style.backgroundPosition = 'center';
        } else {
            card.style.background = '#333';
        }

        card.innerHTML = `
            <div class="playlist-card-title">
                ${playlist.name}
                <div class="playlist-card-count">${playlist.items.length} ${i18n.t('playlists.items')}</div>
            </div>
        `;

        card.onclick = () => openPlaylist(playlist.id);
        grid.appendChild(card);
    });

    // Initialize focus for TV navigation
    setTimeout(() => SpatialNav.focusFirst(), 100);
}

function setupEventListeners() {
    const createBtn = document.getElementById('create-playlist-btn');
    const createBtnSidebar = document.getElementById('create-playlist-btn-sidebar');
    const modal = document.getElementById('create-playlist-modal');
    const cancelBtn = document.getElementById('create-playlist-cancel');
    const confirmBtn = document.getElementById('create-playlist-confirm');
    const input = document.getElementById('new-playlist-name');
    const backBtn = document.getElementById('playlist-back-btn');
    const deleteBtn = document.getElementById('delete-playlist-btn');

    const openModal = () => {
        modal.style.display = 'flex';
        input.value = '';
        input.focus();
    };

    createBtn.onclick = openModal;
    createBtnSidebar.onclick = openModal;

    const closeModal = () => {
        modal.style.display = 'none';
        SpatialNav.refocus();
    };

    cancelBtn.onclick = closeModal;

    confirmBtn.onclick = () => {
        const name = input.value.trim();
        if (name) {
            Playlists.createPlaylist(name);
            renderPlaylists();
            closeModal();
        }
    };

    backBtn.onclick = () => {
        document.getElementById('playlist-details-view').style.display = 'none';
        document.getElementById('playlists-list-view').style.display = 'block';
        renderPlaylists(); // Refresh list
        setTimeout(() => SpatialNav.focusFirst(), 100);
    };

    // Delete button logic is specific to the open playlist, set in openPlaylist
}


function openPlaylist(id) {
    const playlist = Playlists.getPlaylist(id);
    if (!playlist) return;

    document.getElementById('playlists-list-view').style.display = 'none';
    const detailsView = document.getElementById('playlist-details-view');
    detailsView.style.display = 'block';

    document.getElementById('playlist-title').textContent = playlist.name;

    const deleteBtn = document.getElementById('delete-playlist-btn');
    const deleteModal = document.getElementById('delete-playlist-modal');
    const deleteMessage = document.getElementById('delete-playlist-message');
    const deleteCancelBtn = document.getElementById('delete-playlist-cancel');
    const deleteConfirmBtn = document.getElementById('delete-playlist-confirm');

    deleteBtn.onclick = () => {
        // Update message with playlist name
        deleteMessage.textContent = `${i18n.t('playlists.deleteConfirmMessageNamed')} "${playlist.name}"?`;
        deleteModal.style.display = 'flex';
        deleteConfirmBtn.focus();
    };

    deleteCancelBtn.onclick = () => {
        deleteModal.style.display = 'none';
        SpatialNav.refocus();
    };

    deleteConfirmBtn.onclick = () => {
        Playlists.deletePlaylist(id);
        deleteModal.style.display = 'none';
        document.getElementById('playlist-back-btn').click();
        // Focus handled by back button click
    };

    renderPlaylistItems(playlist);

    // Focus on the first item or back button
    setTimeout(() => SpatialNav.focusFirst(), 100);
}


function renderPlaylistItems(playlist) {
    const grid = document.getElementById('playlist-items-grid');
    grid.innerHTML = '';

    if (playlist.items.length === 0) {
        grid.innerHTML = `<p style="color: #aaa; grid-column: 1/-1; text-align: center;">${i18n.t('playlists.emptyPlaylist')}</p>`;
        return;
    }

    playlist.items.forEach(item => {
        const el = document.createElement('div');
        el.className = 'playlist-item focusable';
        el.tabIndex = 0;

        const img = document.createElement('img');
        img.src = Api.getImageUrl(item.poster_path);
        img.alt = item.title || item.name;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'playlist-item-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remove from playlist';
        removeBtn.onclick = (e) => {
            e.stopPropagation(); // Prevent navigation
            Playlists.removeFromPlaylist(playlist.id, item.id);
            // Refresh current view
            openPlaylist(playlist.id);
        };

        el.appendChild(img);
        el.appendChild(removeBtn);

        el.onclick = () => {
            Router.loadPage('details', { id: item.id, type: item.media_type });
        };

        grid.appendChild(el);
    });
}
