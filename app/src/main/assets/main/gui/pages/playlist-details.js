import { Playlists } from '../../logic/playlists.js';
import { Router } from '../js/router.js';
import { Api } from '../../logic/api.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { Toast } from '../js/toast.js';
import { lazyLoader } from '../js/lazy-loader.js';
import { manageModal, createPosterElement } from '../js/utils/ui-helper.js';
import { escapeHtml } from '../js/utils/sanitize.js';


let currentPlaylistId = null;

let activeMoveIndex = null;
let activeMoveBackHandler = null;
let activeOptionsBackHandler = null;
let focusFirstTimerId = null;
let moveFocusTimerId = null;

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
 * Smoothly animates poster tile position changes inside the grid using FLIP (First-Last-Invert-Play).
 * Respects prefers-reduced-motion and skips the tile currently being dragged by a pointer.
 * @param {HTMLElement|null} container - The #playlist-items-container grid element.
 * @param {Function} mutateDom - Callback that performs the synchronous DOM tile reorder.
 */
function animateGridReorder(container, mutateDom) {
    if (!container) {
        mutateDom();
        return;
    }
    const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tiles = Array.from(container.children);
    const beforeRects = reducedMotion ? null : new Map(tiles.map(t => [t, t.getBoundingClientRect()]));

    mutateDom();

    if (reducedMotion || !beforeRects) return;

    tiles.forEach(tileEl => {
        if (tileEl.classList.contains('dragging')) return;
        const prev = beforeRects.get(tileEl);
        if (!prev) return;
        const next = tileEl.getBoundingClientRect();
        const dx = prev.left - next.left;
        const dy = prev.top - next.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

        if (tileEl._flipAnim) {
            try { tileEl._flipAnim.cancel(); } catch (_) { /* ignore */ }
        }
        if (typeof tileEl.animate === 'function') {
            tileEl._flipAnim = tileEl.animate(
                [
                    { transform: `translate3d(${dx}px, ${dy}px, 0)` },
                    { transform: 'translate3d(0, 0, 0)' }
                ],
                { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
            );
            tileEl._flipAnim.onfinish = () => { tileEl._flipAnim = null; };
            tileEl._flipAnim.oncancel = () => { tileEl._flipAnim = null; };
        }
    });
}

/**
 * Reorders an item in storage and relocates its existing poster tile in-place with smooth FLIP motion.
 * Keeps the selected poster visually elevated and focused while surrounding posters glide into position.
 * @param {number} fromIndex - Current zero-based index of the moving poster.
 * @param {number} toIndex - Target zero-based index in the grid.
 * @returns {HTMLElement|null} The focused poster button inside the relocated tile, or null on failure.
 */
export function moveTileInDom(fromIndex, toIndex) {
    if (fromIndex === toIndex) return null;
    if (!Playlists.moveItem(currentPlaylistId, fromIndex, toIndex)) return null;

    activeMoveIndex = toIndex;
    const container = document.getElementById('playlist-items-container');
    const tiles = container ? Array.from(container.children) : [];
    const movingTile = tiles[fromIndex];
    const targetTile = tiles[toIndex];

    if (movingTile && targetTile) {
        animateGridReorder(container, () => {
            if (fromIndex < toIndex) targetTile.after(movingTile);
            else targetTile.before(movingTile);
        });
        return movingTile.querySelector('.card--poster.focusable');
    }

    render({ skipFocusFirst: true });
    const updatedTiles = document.querySelectorAll('#playlist-items-container .playlist-poster-tile');
    return updatedTiles[toIndex]?.querySelector('.card--poster.focusable') || null;
}

/**
 * Exits active keyboard/D-pad Move Mode, removes elevated styling and sibling dimming, and keeps focus on the moved poster.
 */
export function exitMoveMode() {
    if (activeMoveIndex === null) return;
    const prevIndex = activeMoveIndex;
    activeMoveIndex = null;
    clearMoveModeBackHandler();

    const container = document.getElementById('playlist-items-container');
    if (container) container.classList.remove('is-reordering');

    const tiles = document.querySelectorAll('#playlist-items-container .playlist-poster-tile');
    tiles.forEach(t => {
        t.classList.remove('moving-active');
        const gearBtn = t.querySelector('.playlist-poster-settings-btn');
        if (gearBtn) gearBtn.classList.remove('hidden');
    });

    const targetPoster = tiles[prevIndex]?.querySelector('.card--poster.focusable');
    if (targetPoster) SpatialNav.setFocus(targetPoster);
}

/**
 * Pops any active Move Mode back handler from SpatialNav cleanly.
 */
export function clearMoveModeBackHandler() {
    if (activeMoveBackHandler) {
        SpatialNav.popBackHandler(activeMoveBackHandler);
        activeMoveBackHandler = null;
    }
}

/**
 * Re-renders the playlist details screen content.
 * @param {object} [options] - Render options such as { skipFocusFirst: true }.
 */
export function reRenderList(options = {}) {
    render(options);
}

/**
 * Registers the live page controller on window so cache-busted spatial-nav imports share exact module state.
 */
function syncPageBridge() {
    window.__ividsPlaylistDetails = {
        getActiveMoveIndex,
        setActiveMoveIndex,
        getPlaylistItemsCount,
        moveItemInActivePlaylist,
        moveTileInDom,
        toggleMoveMode,
        exitMoveMode,
        reRenderList,
        clearMoveModeBackHandler,
        closePlaylistOptionsPanel,
        navigatePlaylistOptionsBack
    };
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
    clearMoveModeBackHandler();
    syncPageBridge();
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
 * @param {object} [options] - Render configuration.
 * @param {boolean} [options.skipFocusFirst=false] - Skip resetting focus to the top element.
 */
function render({ skipFocusFirst = false } = {}) {
    const playlist = Playlists.getPlaylist(currentPlaylistId);
    if (!playlist) {
        console.error('Playlist not found');
        Router.loadPage('playlists');
        return;
    }

    // Update Top Bar Info
    const titleEl = document.getElementById('playlist-title');
    const countEl = document.getElementById('playlist-count');
    const deleteBtn = document.getElementById('delete-playlist-btn');
    const clearBtn = document.getElementById('clear-playlist-btn');

    const displayTitle = (playlist.isSystem || playlist.id === 'history')
        ? (window.i18n ? window.i18n.t('nav.recently_watched') : playlist.name)
        : playlist.name;
    if (titleEl) titleEl.textContent = displayTitle;
    if (countEl) {
        const count = playlist.items.length;
        if (count === 1) {
            countEl.textContent = window.i18n ? window.i18n.t('playlists.itemSingle') : '1 item';
        } else {
            const tpl = window.i18n ? window.i18n.t('playlists.itemPlural') : '{count} items';
            countEl.textContent = tpl.replace('{count}', String(count));
        }
    }

    // Hide delete button for system playlists (like history), manage clear button
    if (deleteBtn) {
        deleteBtn.classList.toggle('hidden', Boolean(playlist.isSystem));
    }
    if (clearBtn) {
        clearBtn.classList.toggle('hidden', !(playlist.isSystem && playlist.items.length > 0));
    }

    // Render Items
    const container = document.getElementById('playlist-items-container');
    if (container) {
        container.innerHTML = '';

        if (playlist.items.length === 0) {
            const homeLabel = window.i18n ? window.i18n.t('nav.home') : 'Home';
            container.innerHTML = `
                <div class="empty-state">
                    <p data-i18n="playlists.emptyPlaylist" class="empty-state__text">This playlist is empty.</p>
                    <button id="empty-browse-btn" class="btn btn--primary focusable universal-onclick" type="button" data-i18n="nav.home">${escapeHtml(homeLabel)}</button>
                </div>
            `;
            const emptyBrowseBtn = document.getElementById('empty-browse-btn');
            if (emptyBrowseBtn) {
                emptyBrowseBtn.onclick = () => Router.loadPage('home');
            }
        } else {
            const fragment = document.createDocumentFragment();
            playlist.items.forEach((item, index) => {
                const el = createItemElement(item, index, playlist.items.length);
                fragment.appendChild(el);
            });
            container.appendChild(fragment);
            container.querySelectorAll('.card--poster').forEach(btn => lazyLoader.loadImage(btn));
        }
    }

    attachListeners(playlist);

    // Apply translations scoped to #main-view instead of rescanning the full document
    const mainView = document.getElementById('main-view');
    if (window.i18n) window.i18n.applyTranslations(mainView || document);

    if (!skipFocusFirst) {
        if (focusFirstTimerId) clearTimeout(focusFirstTimerId);
        focusFirstTimerId = setTimeout(() => {
            focusFirstTimerId = null;
            SpatialNav.focusFirst();
        }, 50);
    }
}

/**
 * Toggles move reordering mode for a given playlist item index.
 * Highlights the selected poster in place without DOM teardown and binds the Back handler to exit cleanly.
 * 
 * @param {number} index - Index of the item to move.
 */
function toggleMoveMode(index) {
    if (moveFocusTimerId) {
        clearTimeout(moveFocusTimerId);
        moveFocusTimerId = null;
    }

    if (activeMoveIndex !== null && activeMoveIndex === index) {
        exitMoveMode();
        return;
    }

    activeMoveIndex = index;
    clearMoveModeBackHandler();
    SpatialNav.clearFocusTrap();

    const container = document.getElementById('playlist-items-container');
    if (container) container.classList.add('is-reordering');

    const tiles = document.querySelectorAll('#playlist-items-container .playlist-poster-tile');
    tiles.forEach((tileEl, idx) => {
        tileEl.classList.toggle('moving-active', idx === index);
        tileEl.classList.remove('is-settings-visible');
        const gearBtn = tileEl.querySelector('.playlist-poster-settings-btn');
        if (gearBtn) gearBtn.classList.add('hidden');
    });

    activeMoveBackHandler = () => {
        if (activeMoveIndex !== null) {
            exitMoveMode();
            return true;
        }
        return false;
    };
    SpatialNav.pushBackHandler(activeMoveBackHandler);

    const targetPoster = tiles[index]?.querySelector('.card--poster.focusable');
    if (targetPoster) SpatialNav.setFocus(targetPoster);
}

/**
 * Constructs a focusable poster tile with a 1-second dwell-triggered Settings button below it.
 *
 * @param {object} item - Movie or Series object details.
 * @param {number} index - Current position index.
 * @param {number} total - Total entries in the list.
 * @returns {HTMLDivElement} Configured poster tile element.
 */
function createItemElement(item, index, total) {
    const tile = document.createElement('div');
    tile.className = 'playlist-poster-tile';
    if (activeMoveIndex === index) {
        tile.classList.add('moving-active');
    }

    const getLiveIndex = () => {
        const container = tile.parentElement;
        return container ? Array.from(container.children).indexOf(tile) : index;
    };

    let posterBtn = createPosterElement(item, item.media_type);
    if (!posterBtn) {
        posterBtn = document.createElement('button');
        posterBtn.type = 'button';
        posterBtn.className = 'card card--poster card--interactive poster-wrapper focusable focusable-card universal-onclick playlist-poster-fallback';
        posterBtn.dataset.id = item.id;
        posterBtn.dataset.type = item.media_type;
        posterBtn.innerHTML = `<span class="playlist-poster-fallback__title">${escapeHtml(item.title || item.name || '')}</span>`;
        posterBtn.onclick = () => {
            Router.loadPage('details', { id: item.id, type: item.media_type });
        };
    }

    posterBtn.onclick = (e) => {
        if (posterBtn._justDragged) {
            e.preventDefault();
            return;
        }
        if (activeMoveIndex !== null) {
            e.preventDefault();
            exitMoveMode();
            return;
        }
        try {
            Router.loadPage('details', { id: item.id, type: item.media_type });
        } catch (navError) {
            console.error('Error navigating to details:', navError);
        }
    };

    const settingsSlot = document.createElement('div');
    settingsSlot.className = 'playlist-poster-settings-slot';

    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.className = 'btn btn--secondary btn--circle-sm playlist-poster-settings-btn focusable universal-onclick';
    settingsBtn.dataset.index = index;
    const optTitle = window.i18n ? window.i18n.t('common.options') : 'Options';
    settingsBtn.title = optTitle;
    settingsBtn.ariaLabel = optTitle;
    settingsBtn.innerHTML = `<img src="images/settings.svg" class="btn__icon" alt="" aria-hidden="true">`;
    settingsBtn.onclick = (e) => {
        e.stopPropagation();
        openItemContextModal(item, getLiveIndex(), false);
    };

    tile.classList.add('is-settings-visible');

    settingsSlot.appendChild(settingsBtn);
    tile.appendChild(posterBtn);
    tile.appendChild(settingsSlot);
    attachPosterPointerController(tile, posterBtn, item);

    return tile;
}

/**
 * Attaches live 2D press-and-hold pointer drag-and-drop (mouse and touch) plus mobile long-press
 * popup handling onto a playlist poster tile without breaking vertical touch scrolling.
 * @param {HTMLElement} tile - The .playlist-poster-tile container.
 * @param {HTMLElement} posterBtn - The inner .card--poster button element.
 * @param {object} item - Playlist media entry bound to this tile.
 */
function attachPosterPointerController(tile, posterBtn, item) {
    let isDragging = false;
    let holdArmed = false;
    let longPressFired = false;
    let holdTimer = null;
    let longPressTimer = null;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;
    let pointerType = 'mouse';

    const getTileIndex = () => {
        const container = tile.parentElement;
        return container ? Array.from(container.children).indexOf(tile) : -1;
    };

    const clearTimers = () => {
        if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
        if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    };

    const startDrag = () => {
        if (isDragging) return;
        isDragging = true;
        clearTimers();
        tile.classList.add('dragging');
        tile.style.pointerEvents = 'none';
        if (tile.parentElement) tile.parentElement.classList.add('is-reordering');
    };

    const cleanupListeners = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
    };

    const onPointerMove = (e) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const dist = Math.hypot(dx, dy);

        if (pointerType !== 'mouse') {
            if (!holdArmed && !isDragging) {
                if (dist > 10) {
                    clearTimers();
                    cleanupListeners();
                }
                return;
            }
            if (holdArmed && !isDragging && dist > 8) {
                startDrag();
            }
            if (isDragging) e.preventDefault();
        } else if (!isDragging && dist > 8) {
            startDrag();
        }

        if (!isDragging) return;

        tile.style.transform = `translate3d(${dx + offsetX}px, ${dy + offsetY}px, 0)`;
        const hitEl = document.elementFromPoint(e.clientX, e.clientY);
        const sibling = hitEl ? hitEl.closest('.playlist-poster-tile') : null;
        const container = tile.parentElement;

        if (sibling && sibling !== tile && sibling.parentElement === container) {
            const fromIdx = getTileIndex();
            const toIdx = Array.from(container.children).indexOf(sibling);
            if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
                const oldRect = tile.getBoundingClientRect();
                Playlists.moveItem(currentPlaylistId, fromIdx, toIdx);
                animateGridReorder(container, () => {
                    if (fromIdx < toIdx) sibling.after(tile);
                    else sibling.before(tile);
                });
                const newRect = tile.getBoundingClientRect();
                offsetX += (oldRect.left - newRect.left);
                offsetY += (oldRect.top - newRect.top);
                tile.style.transform = `translate3d(${dx + offsetX}px, ${dy + offsetY}px, 0)`;
            }
        }
    };

    const onPointerUp = () => {
        clearTimers();
        cleanupListeners();

        if (longPressFired) {
            longPressFired = false;
            return;
        }
        if (!isDragging) return;

        const finalIndex = getTileIndex();
        isDragging = false;
        holdArmed = false;
        tile.classList.remove('dragging');
        tile.style.transform = '';
        tile.style.pointerEvents = '';
        if (tile.parentElement) tile.parentElement.classList.remove('is-reordering');

        posterBtn._justDragged = true;
        setTimeout(() => { delete posterBtn._justDragged; }, 160);

        render({ skipFocusFirst: true });
        if (finalIndex >= 0) {
            const tiles = document.querySelectorAll('#playlist-items-container .playlist-poster-tile');
            const droppedPoster = tiles[finalIndex]?.querySelector('.card--poster.focusable');
            if (droppedPoster) SpatialNav.setFocus(droppedPoster);
        }
    };

    posterBtn.addEventListener('contextmenu', (e) => {
        if (SpatialNav.isPortrait && SpatialNav.isPortrait()) {
            e.preventDefault();
        }
    });

    posterBtn.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        if (activeMoveIndex !== null) return;

        pointerType = e.pointerType || 'mouse';
        startX = e.clientX;
        startY = e.clientY;
        offsetX = 0;
        offsetY = 0;
        isDragging = false;
        holdArmed = false;
        longPressFired = false;
        clearTimers();

        if (pointerType !== 'mouse') {
            holdTimer = setTimeout(() => {
                holdArmed = true;
            }, 220);
            longPressTimer = setTimeout(() => {
                if (isDragging) return;
                longPressFired = true;
                clearTimers();
                cleanupListeners();
                posterBtn._justDragged = true;
                setTimeout(() => { delete posterBtn._justDragged; }, 250);
                if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
                    navigator.vibrate(18);
                }
                const idx = getTileIndex();
                if (idx >= 0) openItemContextModal(item, idx, true);
            }, 500);
        }

        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    });
}

/**
 * Opens the item action modal to enter Move Mode (desktop/TV) or remove the item from the playlist.
 * @param {object} item - Playlist media entry.
 * @param {number} index - Current zero-based index in the playlist.
 * @param {boolean} [mobileLongPress=false] - True when triggered via mobile touch long-press.
 */
function openItemContextModal(item, index, mobileLongPress = false) {
    const modal = document.getElementById('item-context-modal');
    const titleEl = document.getElementById('context-item-title');
    const moveBtn = document.getElementById('context-move-btn');
    const removeBtn = document.getElementById('context-remove-btn');
    const backBtn = document.getElementById('context-back-btn');

    if (!modal || !titleEl || !moveBtn || !removeBtn || !backBtn) {
        console.error('Context modal elements not found');
        return;
    }

    const isMobile = mobileLongPress === true || Boolean(SpatialNav.isPortrait && SpatialNav.isPortrait());
    moveBtn.classList.toggle('hidden', isMobile);

    titleEl.textContent = item.title || item.name || '';
    const initialFocus = isMobile ? backBtn : moveBtn;
    const closeModal = manageModal(modal, initialFocus);

    moveBtn.onclick = () => {
        closeModal();
        toggleMoveMode(index);
    };

    removeBtn.onclick = () => {
        closeModal();
        const title = window.i18n ? window.i18n.t('playlists.removeItemTitle') : 'Remove Item';
        const msg = window.i18n ? window.i18n.t('playlists.removeItemMessage') : 'Are you sure you want to remove this item from the playlist?';
        showConfirmationModal(
            title,
            msg,
            () => {
                Playlists.removeFromPlaylist(currentPlaylistId, item.id);
                render();
                Toast.show(item.title || item.name || title, { type: 'info', duration: 2000 });
            }
        );
    };

    backBtn.onclick = () => {
        closeModal();
    };
}

/**
 * Opens a playlist picker modal in Player Options style allowing mobile users to copy an item into another playlist.
 * @param {object} item - Playlist media entry to add.
 * @param {Array<object>} targetPlaylists - Available destination playlists.
 */
function openAddToOtherPlaylistModal(item, targetPlaylists) {
    const modal = document.getElementById('add-to-other-playlist-modal');
    const listEl = document.getElementById('other-playlist-selection-list');
    const backBtn = document.getElementById('other-playlist-back-btn');

    if (!modal || !listEl || !backBtn) return;

    listEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    targetPlaylists.forEach(pl => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'setting-item focusable universal-onclick';
        btn.innerHTML = `<span class="setting-info"><span class="setting-label">${escapeHtml(pl.name || '')}</span></span><span class="setting-control"><span class="edit-trigger" aria-hidden="true"></span></span>`;
        fragment.appendChild(btn);
    });
    listEl.appendChild(fragment);

    const firstOption = listEl.querySelector('.setting-item');
    const closeModal = manageModal(modal, firstOption || backBtn);

    Array.from(listEl.querySelectorAll('.setting-item')).forEach((btn, idx) => {
        btn.onclick = () => {
            Playlists.addToPlaylist(targetPlaylists[idx].id, item);
            closeModal();
            Toast.show(targetPlaylists[idx].name || '', { type: 'success', duration: 2000 });
        };
    });

    backBtn.onclick = () => {
        closeModal();
    };
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
        if (!val) {
            const msg = window.i18n ? window.i18n.t('playlists.namePlaceholder') : 'Playlist Name';
            Toast.show(msg, { type: 'warning', duration: 2200 });
            inputEl.focus();
            return;
        }
        Playlists.renamePlaylist(currentPlaylistId, val);
        closeModal();
        render();
        Toast.show(val, { type: 'success', duration: 2000 });
    };

    cancelBtn.onclick = () => {
        closeModal();
    };

    inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmBtn.click();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
        }
    };
}

let activeOptionsSubmenu = false;

/**
 * Resets the playlist options sidebar back to level 1 (root options list).
 */
function resetOptionsToRoot() {
    activeOptionsSubmenu = false;
    const titleEl = document.getElementById('playlist-options-title');
    const rootList = document.getElementById('playlist-options-list');
    const submenuEl = document.getElementById('playlist-options-submenu');
    if (titleEl) {
        titleEl.textContent = window.i18n ? window.i18n.t('playlists.options') : 'Options';
    }
    if (submenuEl) {
        submenuEl.classList.add('hidden');
        submenuEl.innerHTML = '';
    }
    if (rootList) {
        rootList.classList.remove('hidden');
    }
}

/**
 * Opens a level-2 confirmation submenu inside the right-edge playlist options sidebar.
 * @param {string} title - Submenu header title.
 * @param {string} confirmLabel - Label for the confirm action row.
 * @param {function} onConfirm - Callback invoked when confirmed.
 */
function openOptionsConfirmSubmenu(title, confirmLabel, onConfirm) {
    const titleEl = document.getElementById('playlist-options-title');
    const rootList = document.getElementById('playlist-options-list');
    const submenuEl = document.getElementById('playlist-options-submenu');
    if (!rootList || !submenuEl) return;

    activeOptionsSubmenu = true;
    if (titleEl) titleEl.textContent = title;
    rootList.classList.add('hidden');
    submenuEl.classList.remove('hidden');

    const cancelLabel = window.i18n ? window.i18n.t('playlists.cancel') : 'Cancel';
    submenuEl.innerHTML = `
        <button id="playlist-opt-confirm-btn" type="button" class="tv-opt-btn focusable universal-onclick">
            <span class="tv-opt-label">${escapeHtml(confirmLabel)}</span>
        </button>
        <button id="playlist-opt-cancel-btn" type="button" class="tv-opt-btn focusable universal-onclick">
            <span class="tv-opt-label">${escapeHtml(cancelLabel)}</span>
        </button>
    `;

    const confirmBtn = document.getElementById('playlist-opt-confirm-btn');
    const cancelBtn = document.getElementById('playlist-opt-cancel-btn');

    if (confirmBtn) {
        confirmBtn.onclick = () => {
            onConfirm();
        };
    }
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            navigatePlaylistOptionsBack();
        };
    }
    if (cancelBtn) {
        SpatialNav.setFocus(cancelBtn);
    }
}

/**
 * Steps back from a level-2 options submenu to level 1, or closes the sidebar if at root.
 * @returns {boolean} True after handling back navigation.
 */
export function navigatePlaylistOptionsBack() {
    if (activeOptionsSubmenu) {
        resetOptionsToRoot();
        const rootList = document.getElementById('playlist-options-list');
        const closeBtn = document.getElementById('playlist-options-close');
        const firstOpt = rootList?.querySelector('.tv-opt-btn.focusable:not(.hidden)');
        if (firstOpt) {
            SpatialNav.setFocus(firstOpt);
        } else if (closeBtn) {
            SpatialNav.setFocus(closeBtn);
        }
        return true;
    }
    closePlaylistOptionsPanel(true);
    return true;
}

/**
 * Closes the right-edge playlist options sidebar and optionally restores focus to the options trigger.
 * @param {boolean} [restoreFocus=false] - Whether to focus #playlist-options-btn after closing.
 */
export function closePlaylistOptionsPanel(restoreFocus = false) {
    const panel = document.getElementById('playlist-options-panel');
    const backdrop = document.getElementById('playlist-options-backdrop');
    resetOptionsToRoot();
    if (activeOptionsBackHandler) {
        SpatialNav.popBackHandler(activeOptionsBackHandler);
        activeOptionsBackHandler = null;
    }
    const optionsBtn = document.getElementById('playlist-options-btn');
    if (panel) panel.classList.add('hidden');
    if (backdrop) backdrop.classList.add('hidden');
    if (restoreFocus && optionsBtn) {
        SpatialNav.setFocus(optionsBtn);
    }
}

/**
 * Attaches top-bar and options-sidebar handlers and button routing actions.
 * 
 * @param {object} playlist - Selected playlist metadata.
 */
function attachListeners(playlist) {
    const deleteBtn = document.getElementById('delete-playlist-btn');
    const clearBtn = document.getElementById('clear-playlist-btn');
    const playAllBtn = document.getElementById('play-all-btn');
    const backBtn = document.getElementById('back-btn');
    const editInfoBtn = document.getElementById('edit-info-btn');
    const optionsBtn = document.getElementById('playlist-options-btn');
    const optionsPanel = document.getElementById('playlist-options-panel');
    const optionsBackdrop = document.getElementById('playlist-options-backdrop');
    const optionsCloseBtn = document.getElementById('playlist-options-close');
    const optionsEmptyEl = document.getElementById('playlist-options-empty');

    if (optionsBackdrop) {
        optionsBackdrop.onclick = () => closePlaylistOptionsPanel(true);
    }

    if (optionsBtn && optionsPanel) {
        optionsBtn.onclick = (e) => {
            e.stopPropagation();
            const isHidden = optionsPanel.classList.contains('hidden');
            if (isHidden) {
                resetOptionsToRoot();
                optionsPanel.classList.remove('hidden');
                if (optionsBackdrop) optionsBackdrop.classList.remove('hidden');
                if (activeOptionsBackHandler) {
                    SpatialNav.popBackHandler(activeOptionsBackHandler);
                }
                activeOptionsBackHandler = () => {
                    navigatePlaylistOptionsBack();
                    return true;
                };
                SpatialNav.pushBackHandler(activeOptionsBackHandler);
                const firstOpt = optionsPanel.querySelector('#playlist-options-list .tv-opt-btn.focusable:not(.hidden)');
                if (firstOpt) {
                    SpatialNav.setFocus(firstOpt);
                } else if (optionsCloseBtn) {
                    SpatialNav.setFocus(optionsCloseBtn);
                }
            } else {
                closePlaylistOptionsPanel(true);
            }
        };
    }

    if (optionsCloseBtn) {
        optionsCloseBtn.onclick = () => {
            navigatePlaylistOptionsBack();
        };
    }

    if (playAllBtn) {
        if (playlist.items.length > 0) {
            playAllBtn.classList.remove('hidden');
            playAllBtn.onclick = () => {
                closePlaylistOptionsPanel(false);
                const firstItem = playlist.items[0];
                Router.loadPage('player', {
                    id: firstItem.id,
                    type: firstItem.media_type,
                    season: firstItem.season || 1,
                    episode: firstItem.episode || 1
                });
            };
        } else {
            playAllBtn.classList.add('hidden');
        }
    }

    if (backBtn) {
        backBtn.onclick = () => {
            Router.goBack('playlists');
        };
    }

    if (editInfoBtn) {
        editInfoBtn.classList.toggle('hidden', Boolean(playlist.isSystem));
        editInfoBtn.onclick = () => {
            closePlaylistOptionsPanel(false);
            openEditPlaylistModal(playlist);
        };
    }

    if (clearBtn) {
        if (playlist.isSystem) {
            clearBtn.onclick = () => {
                closePlaylistOptionsPanel(false);
                const title = window.i18n ? window.i18n.t('playlists.clearHistoryTitle') : 'Clear Recently Watched';
                const msg = window.i18n ? window.i18n.t('playlists.clearHistoryMessage') : title;
                showConfirmationModal(title, msg, () => {
                    Playlists.clearPlaylist(currentPlaylistId);
                    render();
                    Toast.show(title, { type: 'info', duration: 2000 });
                });
            };
        }
    }

    if (!playlist.isSystem) {
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                closePlaylistOptionsPanel(false);
                const title = window.i18n ? window.i18n.t('playlists.deleteConfirmTitle') : 'Delete Playlist';
                const msg = window.i18n ? window.i18n.t('playlists.deleteConfirmMessage') : title;
                showConfirmationModal(title, msg, () => {
                    Playlists.deletePlaylist(currentPlaylistId);
                    Toast.show(playlist.name || title, { type: 'info', duration: 2000 });
                    Router.loadPage('playlists');
                });
            };
        }
    }

    if (optionsEmptyEl && optionsPanel) {
        const hasVisibleAction = Array.from(optionsPanel.querySelectorAll('#playlist-options-list .tv-opt-btn.focusable'))
            .some(btn => !btn.classList.contains('hidden'));
        optionsEmptyEl.classList.toggle('hidden', hasVisibleAction);
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

    const closeModal = manageModal(modal, cancelBtn);

    confirmBtn.onclick = () => {
        onConfirm();
        closeModal();
    };

    cancelBtn.onclick = () => {
        closeModal();
    };
}
