import { Playlists } from '../../logic/playlists.js';
import { Router } from '../js/router.js';
import { Api } from '../../logic/api.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { Toast } from '../js/toast.js';
import { manageModal, attachImageWithLoader } from '../js/utils/ui-helper.js';
import { escapeHtml, isSafeMediaUrl } from '../js/utils/sanitize.js';

/**
 * Formats a localized item count string for playlist cards.
 *
 * @param {number} count - Number of items in the playlist.
 * @returns {string} Localized count label.
 */
function formatItemCount(count) {
    if (count === 1) {
        return window.i18n ? window.i18n.t('playlists.itemSingle') : '1 item';
    }
    const template = window.i18n ? window.i18n.t('playlists.itemPlural') : '{count} items';
    return template.replace('{count}', String(count));
}

/**
 * Initializes the playlists overview page controller.
 * Supports subpage deep-linking (?page=playlists&sub=details&id=...) and renders the playlist grid.
 * @param {object} [params] - Optional route/subpage parameters.
 */
export const init = async (params = {}) => {
    console.log('Initializing Playlists Page', params);

    if (params && params.sub === 'details' && params.id) {
        Router.loadPage('playlist-details', { id: params.id }, false);
        return;
    }

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
        const emptyText = window.i18n ? window.i18n.t('playlists.empty') : 'No playlists found. Create one!';
        const createText = window.i18n ? window.i18n.t('playlists.create_new') : 'Create New Playlist';
        grid.innerHTML = `
            <div class="empty-state playlists-empty-state">
                <p class="empty-state__text">${escapeHtml(emptyText)}</p>
                <button id="empty-create-playlist-btn" class="btn btn--primary focusable universal-onclick" type="button" data-i18n="playlists.create_new">${escapeHtml(createText)}</button>
            </div>
        `;
        const emptyCreateBtn = document.getElementById('empty-create-playlist-btn');
        if (emptyCreateBtn) {
            emptyCreateBtn.onclick = () => document.getElementById('create-playlist-btn')?.click();
        }
        setTimeout(() => {
            SpatialNav.focusFirst();
        }, 100);
        return;
    }

    const fragment = document.createDocumentFragment();
    playlists.forEach(playlist => {
        const card = createPlaylistCard(playlist);
        fragment.appendChild(card);
    });
    grid.appendChild(fragment);
    initPlaylistItemTickers(grid);

    // Re-initialize spatial nav to pick up new elements
    setTimeout(() => {
        SpatialNav.focusFirst();
    }, 100);
}

/**
 * Attaches focus/hover-gated vertical ping-pong scrolling on playlist item lists that overflow their box height.
 * Respects prefers-reduced-motion and avoids simultaneous infinite animations at rest.
 * @param {HTMLElement} grid - The playlists container element.
 */
function initPlaylistItemTickers(grid) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    requestAnimationFrame(() => {
        if (!grid) return;
        const measurements = [];
        grid.querySelectorAll('.playlist-card').forEach(card => {
            const box = card.querySelector('.playlist-card__items-box');
            if (!box || box.clientHeight <= 0) return;
            const track = box.querySelector('.playlist-card__items-track');
            if (!track || typeof track.animate !== 'function') return;
            const overflow = track.scrollHeight - box.clientHeight;
            if (overflow > 2) {
                measurements.push({ card, track, overflow });
            }
        });
        measurements.forEach(({ card, track, overflow }) => {
            let activeAnim = null;
            const startTicker = () => {
                if (activeAnim) return;
                const durationMs = Math.max(3500, Math.round(overflow * 45) + 1800);
                activeAnim = track.animate(
                    [
                        { transform: 'translateY(0px)', offset: 0 },
                        { transform: 'translateY(0px)', offset: 0.14 },
                        { transform: `translateY(-${overflow}px)`, offset: 0.86 },
                        { transform: `translateY(-${overflow}px)`, offset: 1 }
                    ],
                    {
                        duration: durationMs,
                        iterations: Infinity,
                        direction: 'alternate',
                        easing: 'ease-in-out'
                    }
                );
            };
            const stopTicker = () => {
                if (!activeAnim) return;
                activeAnim.cancel();
                activeAnim = null;
            };
            card.addEventListener('mouseenter', startTicker);
            card.addEventListener('focus', startTicker);
            card.addEventListener('mouseleave', stopTicker);
            card.addEventListener('blur', stopTicker);
        });
    });
}

/**
 * Constructs a focusable horizontal playlist card with the first item's 16:9 cover on the left,
 * centered playlist title and item count in the middle, and a vertically scrolling list of items on the right.
 *
 * @param {object} playlist - The playlist data model containing items and name.
 * @returns {HTMLDivElement} A focusable playlist card element.
 */
function createPlaylistCard(playlist) {
    const card = document.createElement('div');
    card.className = 'card card--interactive playlist-card focusable focusable-card universal-onclick';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.dataset.id = playlist.id;

    // Use strictly the first item with a backdrop/poster as the single cover image
    let imageUrl = '';
    if (playlist.items && playlist.items.length > 0) {
        const firstWithArt = playlist.items.find(item => item.backdrop_path || item.poster_path);
        if (firstWithArt) {
            const coverSize = firstWithArt.backdrop_path ? Api.getRecommendedBackdropSize() : Api.getRecommendedPosterSize();
            const candidate = Api.getImageUrl(firstWithArt.backdrop_path || firstWithArt.poster_path, coverSize);
            if (candidate && isSafeMediaUrl(candidate)) {
                imageUrl = candidate;
            }
        }
    }

    const itemCount = playlist.items ? playlist.items.length : 0;
    const itemText = formatItemCount(itemCount);
    const rawName = (playlist.isSystem || playlist.id === 'history')
        ? (window.i18n ? window.i18n.t('nav.recently_watched') : playlist.name)
        : (playlist.name || '');
    const safeName = escapeHtml(rawName);

    const coverContent = imageUrl ? `<img class="playlist-cover-img" alt="${safeName}" loading="lazy">` : '';

    const items = Array.isArray(playlist.items) ? playlist.items : [];
    const emptyLabel = window.i18n ? window.i18n.t('playlists.emptyPlaylist') : 'This playlist is empty.';
    const itemsHtml = items.length > 0
        ? items.map(item => `<div class="playlist-card__item-line">${escapeHtml(item.title || item.name || '')}</div>`).join('')
        : `<div class="playlist-card__item-line playlist-card__item-line--empty">${escapeHtml(emptyLabel)}</div>`;

    card.innerHTML = `
        <div class="playlist-card__media">
            <div class="playlist-cover${imageUrl ? '' : ' playlist-cover--empty'}">
                ${coverContent}
            </div>
        </div>
        <div class="playlist-card__body">
            <div class="card__title playlist-card__title">${safeName}</div>
            <div class="playlist-card__count">${escapeHtml(itemText)}</div>
        </div>
        <div class="playlist-card__items-box">
            <div class="playlist-card__items-track">
                ${itemsHtml}
            </div>
        </div>
    `;

    const coverContainer = card.querySelector('.playlist-cover');
    const coverImg = card.querySelector('.playlist-cover-img');
    if (coverImg && imageUrl) {
        attachImageWithLoader(coverImg, coverContainer, imageUrl, () => coverImg.remove());
    }
    card.addEventListener('click', () => {
        Router.loadPage('playlist-details', { id: playlist.id });
    });
    card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            Router.loadPage('playlist-details', { id: playlist.id });
        }
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

    let activeModalClose = null;

    if (createBtn) {
        createBtn.addEventListener('click', () => {
            // Make modal elements focusable
            modalElements.forEach(el => {
                if (el) el.classList.add('focusable');
            });
            input.value = '';
            activeModalClose = manageModal(modal, input, () => closeModal());
        });
     }

     function closeModal() {
        if (activeModalClose) {
            activeModalClose();
            activeModalClose = null;
        }
        // Remove focusable from modal elements
        modalElements.forEach(el => {
            if (el) el.classList.remove('focusable');
        });
        if (createBtn) SpatialNav.setFocus(createBtn);
     };

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            const name = input.value.trim();
            if (!name) {
                const msg = window.i18n ? window.i18n.t('playlists.namePlaceholder') : 'Playlist Name';
                Toast.show(msg, { type: 'warning', duration: 2200 });
                input?.focus();
                return;
            }
            Playlists.createPlaylist(name);
            closeModal();
            render();
            Toast.show(name, { type: 'success', duration: 2000 });
        });
    }

    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmBtn.click();
            if (e.key === 'Escape') closeModal();
        });
    }
}