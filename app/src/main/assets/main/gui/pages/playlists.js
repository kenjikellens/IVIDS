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
 * Formats the localized total playlists count displayed in the page header.
 *
 * @param {number} count - Total number of playlists rendered.
 * @returns {string} Localized playlist total label.
 */
function formatPlaylistTotal(count) {
    if (count === 1) {
        const single = window.i18n ? window.i18n.t('playlists.type_label') : 'Playlist';
        return `1 ${single}`;
    }
    const template = window.i18n ? window.i18n.t('settings.playlistsCount') : '{count} Playlists';
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

    const createBtn = document.getElementById('create-playlist-btn');
    if (createBtn && window.i18n) {
        const createLabel = window.i18n.t('playlists.create_new');
        createBtn.setAttribute('aria-label', createLabel);
        createBtn.setAttribute('title', createLabel);
    }

    render();
    attachListeners();
};

/**
 * Fetches all playlists and renders them into the responsive visual card grid.
 * Updates the header playlist counter and focuses either a newly created card or the default target.
 * @param {string|null} [focusPlaylistId=null] - Optional playlist ID to focus after rendering.
 */
function render(focusPlaylistId = null) {
    const grid = document.getElementById('playlists-grid');
    if (!grid) return;

    const playlists = Playlists.getPlaylists();
    const totalEl = document.getElementById('playlists-total-count');
    if (totalEl) {
        totalEl.textContent = formatPlaylistTotal(playlists.length);
    }

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

    // Re-initialize spatial nav to pick up new elements or highlight a newly created playlist
    setTimeout(() => {
        if (focusPlaylistId) {
            const targetCard = Array.from(grid.querySelectorAll('.playlist-card'))
                .find(el => el.dataset.id === String(focusPlaylistId));
            if (targetCard) {
                SpatialNav.setFocus(targetCard);
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                return;
            }
        }
        SpatialNav.focusFirst();
    }, 100);
}

/**
 * Constructs a clean visual 16:9 playlist grid tile with a single cover or 2x2 artwork mosaic
 * and a minimalist title and item-count caption directly underneath.
 *
 * @param {object} playlist - The playlist data model containing items and name.
 * @returns {HTMLDivElement} A focusable playlist card element.
 */
function createPlaylistCard(playlist) {
    const isSystem = Boolean(playlist.isSystem || playlist.id === 'history');
    const card = document.createElement('div');
    card.className = 'playlist-card focusable universal-onclick';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.dataset.id = playlist.id;

    // Use 4-tile mosaic when 4+ items have artwork, otherwise single 16:9 cover
    const artItems = (playlist.items || []).filter(item => item.backdrop_path || item.poster_path);
    const mosaicUrls = artItems.length >= 4
        ? artItems.slice(0, 4).map(item => {
            const sz = item.backdrop_path ? Api.getRecommendedStillSize() : Api.getRecommendedPosterSize();
            const u = Api.getImageUrl(item.backdrop_path || item.poster_path, sz);
            return (u && isSafeMediaUrl(u)) ? u : '';
        }).filter(Boolean)
        : [];

    let imageUrl = '';
    if (mosaicUrls.length < 4 && artItems.length > 0) {
        const firstWithArt = artItems[0];
        const coverSize = firstWithArt.backdrop_path ? Api.getRecommendedBackdropSize() : Api.getRecommendedPosterSize();
        const candidate = Api.getImageUrl(firstWithArt.backdrop_path || firstWithArt.poster_path, coverSize);
        if (candidate && isSafeMediaUrl(candidate)) {
            imageUrl = candidate;
        }
    }

    const itemCount = playlist.items ? playlist.items.length : 0;
    const itemText = formatItemCount(itemCount);
    const rawName = isSystem
        ? (window.i18n ? window.i18n.t('nav.recently_watched') : playlist.name)
        : (playlist.name || '');
    const safeName = escapeHtml(rawName);
    card.setAttribute('aria-label', `${rawName}, ${itemText}`);

    const hasMosaic = mosaicUrls.length === 4;
    const coverContent = hasMosaic
        ? `<div class="playlist-cover-mosaic">${mosaicUrls.map(u => `<img class="playlist-mosaic-img" src="${escapeHtml(u)}" alt="" loading="lazy">`).join('')}</div>`
        : (imageUrl
            ? `<img class="playlist-cover-img" alt="${safeName}" loading="lazy">`
            : `<img src="images/playlists.svg" alt="" class="playlist-cover__empty-icon" aria-hidden="true">`);

    card.innerHTML = `
        <div class="playlist-card__media">
            <div class="playlist-cover${(imageUrl || hasMosaic) ? '' : ' playlist-cover--empty'}">
                ${coverContent}
            </div>
        </div>
        <div class="playlist-card__body">
            <div class="playlist-card__title">${safeName}</div>
            <div class="playlist-card__count">${escapeHtml(itemText)}</div>
        </div>
    `;

    const coverContainer = card.querySelector('.playlist-cover');
    const coverImg = card.querySelector('.playlist-cover-img');
    if (coverImg && imageUrl) {
        attachImageWithLoader(coverImg, coverContainer, imageUrl, () => {
            coverImg.remove();
            coverContainer?.classList.add('playlist-cover--empty');
        });
    }
    card.querySelectorAll('.playlist-mosaic-img').forEach(img => {
        img.addEventListener('error', () => {
            img.classList.add('hidden');
        }, { once: true });
    });

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
 * Attaches event listeners for the playlist creation modal triggers, Back button, and live character counter.
 */
function attachListeners() {
    const createBtn = document.getElementById('create-playlist-btn');
    const modal = document.getElementById('create-playlist-modal');
    const backBtn = document.getElementById('create-playlist-back-btn');
    const confirmBtn = document.getElementById('confirm-create-btn');
    const input = document.getElementById('new-playlist-name');
    const charCount = document.getElementById('new-playlist-char-count');
    const maxLen = Number(input?.getAttribute('maxlength')) || 30;

    /**
     * Synchronizes the live character count readout beneath the playlist name input.
     */
    const updateCharCount = () => {
        if (charCount && input) {
            charCount.textContent = `${input.value.length} / ${maxLen}`;
        }
    };

    // Fix for invisible buttons: remove focusable class initially
    const modalElements = [backBtn, input, confirmBtn];
    modalElements.forEach(el => {
        if (el) el.classList.remove('focusable');
    });

    let activeModalClose = null;

    if (createBtn) {
        createBtn.addEventListener('click', () => {
            modalElements.forEach(el => {
                if (el) el.classList.add('focusable');
            });
            if (input) input.value = '';
            updateCharCount();
            activeModalClose = manageModal(modal, input, () => closeModal(true));
        });
    }

    /**
     * Closes the create playlist modal, strips modal focusable classes, and optionally returns focus to the Create trigger.
     * @param {boolean} [restoreCreateFocus=true] - Whether to focus #create-playlist-btn after closing.
     */
    function closeModal(restoreCreateFocus = true) {
        if (activeModalClose) {
            activeModalClose();
            activeModalClose = null;
        }
        modalElements.forEach(el => {
            if (el) el.classList.remove('focusable');
        });
        if (restoreCreateFocus && createBtn) {
            SpatialNav.setFocus(createBtn);
        }
    }

    if (backBtn) {
        backBtn.addEventListener('click', () => closeModal(true));
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            const name = input ? input.value.trim() : '';
            if (!name) {
                const msg = window.i18n ? window.i18n.t('playlists.namePlaceholder') : 'Playlist Name';
                Toast.show(msg, { type: 'warning', duration: 2200 });
                input?.focus();
                return;
            }
            const created = Playlists.createPlaylist(name);
            closeModal(!created);
            if (created) {
                render(created.id);
                Toast.show(name, { type: 'success', duration: 2000 });
            }
        });
    }

    if (input) {
        input.addEventListener('input', updateCharCount);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmBtn?.click();
            if (e.key === 'Escape') closeModal(true);
        });
    }
}