import { Playlists } from '../../logic/playlists.js';
import { Router } from '../js/router.js';
import { Api } from '../../logic/api.js';
import { SpatialNav } from '../js/spatial-nav.js';

/**
 * Initializes the playlists overview page controller.
 * Establishes spatial navigation routing and initiates rendering.
 */
export const init = async () => {
    console.log('Initializing Playlists Page');

    // Register page logic for SpatialNav
    SpatialNav.setPageLogic({
        id: 'playlists',
        findNext: (current, direction) => {
            if (current.id === 'create-playlist-btn' && direction === 'down') {
                const firstCard = document.querySelector('.playlist-card.focusable');
                if (firstCard) return firstCard;
            }
            return null;
        }
    });

    render();
    attachListeners();
};

/**
 * Fetches all playlists and renders them into the playlists grid container.
 */
function render() {
    const grid = document.getElementById('playlists-grid');
    if (!grid) return;

    const playlists = Playlists.getPlaylists();
    grid.innerHTML = '';

    if (playlists.length === 0) {
        grid.innerHTML = '<div class="empty-state">No playlists found. Create one to get started!</div>';
        return;
    }

    playlists.forEach(playlist => {
        const card = createPlaylistCard(playlist);
        grid.appendChild(card);
    });

    // Re-initialize spatial nav to pick up new elements
    setTimeout(() => {
        SpatialNav.focusFirst();
    }, 100);
}

/**
 * Constructs a focusable playlist widescreen 16:9 card with a cover image, overlay title/size, and a playlist badge icon.
 * It manages card markup generation and routes click interactions to the playlist details view.
 * 
 * @param {object} playlist - The playlist data model containing items and name.
 * @returns {HTMLDivElement} A focusable widescreen playlist card element.
 */
function createPlaylistCard(playlist) {
    const card = document.createElement('div');
    card.className = 'playlist-card focusable';
    card.dataset.id = playlist.id;

    // Get cover image from first item or use placeholder
    let imageUrl = 'images/placeholder-playlist.svg';
    if (playlist.items && playlist.items.length > 0) {
        const firstItem = playlist.items[0];
        if (firstItem.backdrop_path || firstItem.poster_path) {
            imageUrl = Api.getImageUrl(firstItem.backdrop_path || firstItem.poster_path);
        }
    }

    const itemCount = playlist.items ? playlist.items.length : 0;
    const itemText = itemCount === 1 ? '1 item' : `${itemCount} items`;

    card.innerHTML = `
        <div class="playlist-cover">
            <img src="${imageUrl}" alt="${playlist.name}" loading="lazy">
            <div class="playlist-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <line x1="8" y1="6" x2="21" y2="6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="8" y1="12" x2="21" y2="12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="8" y1="18" x2="21" y2="18" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="3" y1="6" x2="3.01" y2="6" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="3" y1="12" x2="3.01" y2="12" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <line x1="3" y1="18" x2="3.01" y2="18" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <div class="playlist-overlay">
                <div class="playlist-name">${playlist.name}</div>
                <div class="playlist-meta">${itemText}</div>
            </div>
        </div>
    `;

    card.addEventListener('click', () => {
        Router.loadPage('playlist-details', { id: playlist.id });
    });

    return card;
}

/**
 * Attaches event listeners for the playlist creation modal triggers and actions.
 */
function attachListeners() {
    const createBtn = document.getElementById('create-playlist-btn');
    const modal = document.getElementById('create-playlist-modal');
    const cancelBtn = document.getElementById('cancel-create-btn');
    const confirmBtn = document.getElementById('confirm-create-btn');
    const input = document.getElementById('new-playlist-name');

    // Fix for invisible buttons: remove focusable class initially
    const modalElements = [input, cancelBtn, confirmBtn];
    modalElements.forEach(el => {
        if (el) el.classList.remove('focusable');
    });

    if (createBtn) {
        createBtn.addEventListener('click', () => {
            modal.classList.add('active');
            // Make modal elements focusable
            modalElements.forEach(el => {
                if (el) el.classList.add('focusable');
            });
            input.value = '';
            input.focus();
        });
    }

    const closeModal = () => {
        modal.classList.remove('active');
        // Remove focusable from modal elements
        modalElements.forEach(el => {
            if (el) el.classList.remove('focusable');
        });
        if (createBtn) createBtn.focus();
    };

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            const name = input.value.trim();
            if (name) {
                Playlists.createPlaylist(name);
                closeModal();
                render();
            }
        });
    }

    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmBtn.click();
            if (e.key === 'Escape') closeModal();
        });
    }
}
