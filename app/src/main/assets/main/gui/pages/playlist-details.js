import { Playlists } from '../../logic/playlists.js';
import { Router } from '../js/router.js';
import { Api } from '../../logic/api.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { manageModal, loadBackgroundWithLoader } from '../js/utils/ui-helper.js';
import { escapeHtml, isSafeMediaUrl } from '../js/utils/sanitize.js';


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
            container.innerHTML = `
                <div class="empty-state playlists-empty-state">
                    <p data-i18n="playlists.emptyPlaylist" class="empty-state__text">This playlist is empty.</p>
                </div>
            `;
        } else {
            const fragment = document.createDocumentFragment();
            playlist.items.forEach((item, index) => {
                const el = createItemElement(item, index, playlist.items.length);
                fragment.appendChild(el);
            });
            container.appendChild(fragment);
        }
    }

    attachListeners(playlist);

    // Apply translations scoped to #main-view instead of rescanning the full document
    const mainView = document.getElementById('main-view');
    if (window.i18n) window.i18n.applyTranslations(mainView || document);

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
    itemCard.className = 'card card--row card--interactive episode-item disney-episode-item focusable universal-onclick';
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
                <span class="card__title">${escapeHtml(item.title || item.name || '')}</span>
            </div>
        </div>
    `;

    // Click on item card navigates to content details
    if (isSafeMediaUrl(imageUrl)) loadBackgroundWithLoader(itemCard.querySelector('.card__thumb'), imageUrl);
    itemCard.onclick = () => {
        Router.loadPage('details', { id: item.id, type: item.media_type });
    };

    const actionsWrapper = document.createElement('div');
    actionsWrapper.className = 'card__actions playlist-item-actions';

    // Mobile overflow context menu button
    const moreBtn = document.createElement('button');
    moreBtn.className = 'btn btn--secondary btn--circle-lg playlist-action-more focusable universal-onclick';
    moreBtn.type = 'button';
    moreBtn.dataset.index = index;
    moreBtn.title = window.i18n ? window.i18n.t('common.options') : 'Options';
    moreBtn.innerHTML = `<img src="images/more.svg" class="btn__icon" alt="" aria-hidden="true">`;
    moreBtn.onclick = (e) => {
        e.stopPropagation();
        openItemContextModal(item, index, total);
    };

    // Circular Move button
    const moveBtn = document.createElement('button');
    moveBtn.className = 'btn btn--secondary btn--circle-lg playlist-action-btn playlist-action-move focusable';
    if (activeMoveIndex === index) {
        moveBtn.classList.add('is-active', 'active');
    }
    moveBtn.dataset.index = index;
    moveBtn.title = window.i18n ? window.i18n.t('playlists.moveItem') : "Move Item";
    moveBtn.innerHTML = `<img src="images/move-vertical.svg" class="btn__icon" alt="" aria-hidden="true">`;

    moveBtn.onclick = (e) => {
        e.stopPropagation();
        toggleMoveMode(index);
    };

    // Circular Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn--secondary btn--circle-lg playlist-action-delete focusable';
    deleteBtn.dataset.index = index;
    deleteBtn.title = window.i18n ? window.i18n.t('playlists.deleteItem') : "Remove Item";
    deleteBtn.innerHTML = `<img src="images/trash.svg" class="btn__icon" alt="" aria-hidden="true">`;

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
    actionsWrapper.appendChild(moreBtn);
    actionsWrapper.appendChild(moveBtn);
    actionsWrapper.appendChild(deleteBtn);

    row.appendChild(cardWrapper);
    row.appendChild(actionsWrapper);

    return row;
}

/**
 * Opens the mobile/context item action modal for playing, inspecting, reordering, or removing a playlist item.
 * @param {object} item - Playlist media entry.
 * @param {number} index - Current zero-based index in the playlist.
 * @param {number} total - Total item count in the playlist.
 */
function openItemContextModal(item, index, total) {
    const modal = document.getElementById('item-context-modal');
    const titleEl = document.getElementById('context-item-title');
    const playBtn = document.getElementById('context-play-btn');
    const detailsBtn = document.getElementById('context-details-btn');
    const moveUpBtn = document.getElementById('context-move-up-btn');
    const moveDownBtn = document.getElementById('context-move-down-btn');
    const addToOtherBtn = document.getElementById('context-add-to-playlist-btn');
    const removeBtn = document.getElementById('context-remove-btn');
    const backBtn = document.getElementById('context-back-btn');

    if (!modal || !titleEl || !playBtn || !detailsBtn || !moveUpBtn || !moveDownBtn || !removeBtn || !backBtn) {
        console.error('Context modal elements not found');
        return;
    }

    const otherPlaylists = Playlists.getPlaylists().filter(p => !p.isSystem && p.id !== currentPlaylistId);
    if (addToOtherBtn) {
        addToOtherBtn.classList.toggle('hidden', otherPlaylists.length === 0);
    }

    titleEl.textContent = item.title || item.name || '';
    moveUpBtn.classList.toggle('hidden', index <= 0);
    moveDownBtn.classList.toggle('hidden', index >= total - 1);

    const closeModal = manageModal(modal, playBtn);

    if (addToOtherBtn && otherPlaylists.length > 0) {
        addToOtherBtn.onclick = () => {
            closeModal();
            openAddToOtherPlaylistModal(item, otherPlaylists);
        };
    }

    playBtn.onclick = () => {
        closeModal();
        Router.loadPage('player', {
            id: item.id,
            type: item.media_type,
            season: item.season || 1,
            episode: item.episode || 1
        });
    };

    detailsBtn.onclick = () => {
        closeModal();
        Router.loadPage('details', { id: item.id, type: item.media_type });
    };

    moveUpBtn.onclick = () => {
        Playlists.moveItem(currentPlaylistId, index, index - 1);
        closeModal();
        render();
    };

    moveDownBtn.onclick = () => {
        Playlists.moveItem(currentPlaylistId, index, index + 1);
        closeModal();
        render();
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
    resetOptionsToRoot();
    const optionsBtn = document.getElementById('playlist-options-btn');
    if (panel) panel.classList.add('hidden');
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
    const optionsCloseBtn = document.getElementById('playlist-options-close');
    const optionsEmptyEl = document.getElementById('playlist-options-empty');

    if (optionsBtn && optionsPanel) {
        optionsBtn.onclick = (e) => {
            e.stopPropagation();
            const isHidden = optionsPanel.classList.contains('hidden');
            if (isHidden) {
                resetOptionsToRoot();
                optionsPanel.classList.remove('hidden');
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
                const title = window.i18n ? window.i18n.t('playlists.clearHistoryTitle') : 'Clear Recently Watched';
                const confirmLabel = window.i18n ? window.i18n.t('playlists.clearHistory') : 'Clear History';
                openOptionsConfirmSubmenu(title, confirmLabel, () => {
                    closePlaylistOptionsPanel(false);
                    Playlists.clearPlaylist(currentPlaylistId);
                    render();
                });
            };
        }
    }

    if (!playlist.isSystem) {
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                const title = window.i18n ? window.i18n.t('playlists.deleteConfirmTitle') : 'Delete Playlist';
                const confirmLabel = window.i18n ? window.i18n.t('playlists.confirmDelete') : 'Delete';
                openOptionsConfirmSubmenu(title, confirmLabel, () => {
                    closePlaylistOptionsPanel(false);
                    Playlists.deletePlaylist(currentPlaylistId);
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
