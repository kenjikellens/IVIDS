/**
 * Reusable OOP component for rendering and reordering priority lists in Settings modals.
 * Supports D-pad move toggle buttons, animated row swaps, pointer drag reordering, inline URL editing, and custom item deletion.
 */
export class SourceListEditor {
    /**
     * Initializes the list editor bound to a SettingsManager owner instance.
     *
     * @param {Object} manager - Owning manager holding pendingSettings and active moving IDs.
     */
    constructor(manager) {
        this.manager = manager;
        this._isAnimatingMove = false;
    }

    /**
     * Renders a priority list container with optional URL inputs, move toggles, pointer drag, and delete buttons.
     * Mutates the target container DOM and binds state changes back to manager.pendingSettings[listKey].
     *
     * @param {Object} config - Rendering options (containerId, listKey, movingProp, formatTitle, editableUrl, urlPlaceholder, addBtnId).
     */
    renderList(config) {
        const {
            containerId,
            listKey,
            movingProp,
            formatTitle,
            editableUrl = false,
            urlPlaceholder = 'https://example.com',
            addBtnId = null
        } = config;

        const listContainer = document.getElementById(containerId);
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const items = this.manager.pendingSettings[listKey] || [];
        const rerender = () => this.renderList(config);

        items.forEach((entry, idx) => {
            const item = document.createElement('div');
            item.className = 'provider-item';
            if (this.manager[movingProp] === entry.id) item.classList.add('moving');
            item.dataset.id = entry.id;

            const header = document.createElement('div');
            header.className = 'provider-header';
            const title = document.createElement('span');
            title.className = 'provider-title';
            title.textContent = formatTitle(entry, idx);
            header.appendChild(title);
            item.appendChild(header);

            if (editableUrl) {
                const input = document.createElement('input');
                input.type = 'url';
                input.className = 'form-input focusable';
                input.value = entry.url || '';
                input.placeholder = urlPlaceholder;
                input.oninput = (e) => {
                    entry.url = e.target.value;
                };
                item.appendChild(input);
            }

            const actions = document.createElement('div');
            actions.className = 'provider-actions';

            const moveBtn = document.createElement('button');
            moveBtn.type = 'button';
            moveBtn.className = 'btn btn--ghost btn--circle edit-trigger provider-move-btn focusable';
            moveBtn.innerHTML = '<img src="svg/drag-handle.svg" class="setting-edit-icon" alt="Move" />';
            moveBtn.title = 'Move';
            if (this.manager[movingProp] === entry.id) moveBtn.classList.add('active-moving');

            moveBtn.onclick = (e) => {
                e.stopPropagation();
                if (moveBtn._justDragged) return;
                if (this.manager[movingProp] === null) {
                    this.manager[movingProp] = entry.id;
                    this.manager.movingOriginalList = this.manager.pendingSettings[listKey].map(p => ({ ...p }));
                    rerender();
                } else if (this.manager[movingProp] === entry.id) {
                    this.manager[movingProp] = null;
                    this.manager.movingOriginalList = null;
                    rerender();
                } else {
                    return;
                }
                const activeBtn = document.querySelector(`.provider-item[data-id="${entry.id}"] .provider-move-btn`);
                if (activeBtn) activeBtn.focus();
            };

            actions.appendChild(moveBtn);
            this.attachDragHandlers(item, moveBtn, listKey, entry.id, rerender);

            if (entry.isCustom) {
                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.className = 'btn btn--secondary btn--circle edit-trigger provider-delete-btn focusable';
                deleteBtn.innerHTML = '<img src="svg/trash.svg" class="setting-edit-icon" alt="Delete" />';
                deleteBtn.title = 'Delete';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.manager.pendingSettings[listKey].splice(idx, 1);
                    rerender();
                    if (addBtnId) {
                        const addBtn = document.getElementById(addBtnId);
                        if (addBtn) {
                            addBtn.focus();
                            if (window.SpatialNav) window.SpatialNav.setFocus(addBtn);
                        }
                    }
                };
                actions.appendChild(deleteBtn);
            }

            item.appendChild(actions);
            listContainer.appendChild(item);
        });

        if (window.SpatialNav && typeof window.SpatialNav.ensureTabindex === 'function') {
            window.SpatialNav.ensureTabindex();
        }
    }

    /**
     * Attaches pointer drag handlers to reorder list items smoothly via mouse or touch while preserving click activation.
     * Mutates manager.pendingSettings[key] order on drop and invokes rerender.
     *
     * @param {HTMLElement} item - List item container element.
     * @param {HTMLElement} moveBtn - Drag handle button element.
     * @param {string} key - Settings array property name on pendingSettings.
     * @param {string} id - Item identifier being dragged.
     * @param {Function} rerender - Callback that re-renders the list after drag completion.
     */
    attachDragHandlers(item, moveBtn, key, id, rerender) {
        let isDragging = false;
        let startClientY = 0;
        let dragOffset = 0;
        let listContainer = item.parentElement;

        const onPointerMove = (e) => {
            if (e.pointerType !== 'mouse') e.preventDefault();
            const deltaY = e.clientY - startClientY;
            if (!isDragging && Math.abs(deltaY) > 4) {
                isDragging = true;
                item.classList.add('moving', 'dragging');
                item.style.pointerEvents = 'none';
            }
            if (!isDragging) return;

            item.style.transform = `translateY(${deltaY + dragOffset}px)`;
            const targetEl = document.elementFromPoint(e.clientX, e.clientY);
            const sibling = targetEl ? targetEl.closest('.provider-item') : null;

            if (sibling && sibling !== item && sibling.parentElement === listContainer) {
                const list = this.manager.pendingSettings[key];
                const fromIdx = list.findIndex(p => p.id === id);
                const toIdx = list.findIndex(p => p.id === sibling.dataset.id);
                if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
                    const oldRect = item.getBoundingClientRect();
                    [list[fromIdx], list[toIdx]] = [list[toIdx], list[fromIdx]];
                    if (fromIdx < toIdx) sibling.after(item);
                    else sibling.before(item);
                    const newRect = item.getBoundingClientRect();
                    dragOffset += (oldRect.top - newRect.top);
                    item.style.transform = `translateY(${deltaY + dragOffset}px)`;
                }
            }
        };

        const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);

            if (!isDragging) return;
            isDragging = false;
            item.classList.remove('dragging');
            item.style.transform = '';
            item.style.pointerEvents = '';

            moveBtn._justDragged = true;
            setTimeout(() => { delete moveBtn._justDragged; }, 120);

            rerender();
            const newBtn = document.querySelector(`.provider-item[data-id="${id}"] .provider-move-btn`);
            if (newBtn) {
                newBtn.focus();
                if (window.SpatialNav) window.SpatialNav.setFocus(newBtn);
            }
        };

        const onPointerDown = (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            if (e.target.closest('input, .provider-delete-btn')) return;
            const isHandleTouch = Boolean(e.target.closest('.provider-move-btn')) || !item.querySelector('input');
            if (e.pointerType !== 'mouse' && !isHandleTouch) return;
            if (e.pointerType !== 'mouse') e.preventDefault();

            startClientY = e.clientY;
            dragOffset = 0;
            listContainer = item.parentElement;
            window.addEventListener('pointermove', onPointerMove, { passive: false });
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('pointercancel', onPointerUp);
        };

        moveBtn.addEventListener('pointerdown', onPointerDown);
        item.addEventListener('pointerdown', onPointerDown);
    }

    /**
     * Animates swapping two adjacent items in a priority list during D-pad reordering and commits pendingSettings changes.
     * Restores focus onto the moved row's handle after the transition completes.
     *
     * @param {string} key - Settings array property name on pendingSettings.
     * @param {string} id - Item identifier being shifted.
     * @param {number} direction - Index delta (-1 for up, +1 for down).
     * @param {Function} rerender - Callback that re-renders the list after swap completion.
     */
    moveItem(key, id, direction, rerender) {
        if (this._isAnimatingMove) return;

        const list = this.manager.pendingSettings[key];
        const index = list.findIndex(p => p.id === id);
        const targetIndex = index + direction;
        if (index === -1 || targetIndex < 0 || targetIndex >= list.length) return;

        const containerMap = {
            playerProviders: 'player-providers-list',
            playbackSourceOrderItems: 'source-order-list',
            m3uPlaylists: 'm3u-playlists-list'
        };
        const container = document.getElementById(containerMap[key] || 'm3u-playlists-list');
        if (!container) return;

        const items = Array.from(container.querySelectorAll('.provider-item'));
        const currentItem = items[index];
        const targetItem = items[targetIndex];
        if (!currentItem || !targetItem) return;

        this._isAnimatingMove = true;
        const currentRect = currentItem.getBoundingClientRect();
        const targetRect = targetItem.getBoundingClientRect();
        const deltaCurrent = targetRect.top - currentRect.top;
        const deltaTarget = currentRect.top - targetRect.top;

        currentItem.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)';
        targetItem.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)';
        currentItem.style.zIndex = '30';
        targetItem.style.zIndex = '10';
        currentItem.style.transform = `translateY(${deltaCurrent}px)`;
        targetItem.style.transform = `translateY(${deltaTarget}px)`;

        [list[index], list[targetIndex]] = [list[targetIndex], list[index]];

        setTimeout(() => {
            rerender();
            this._isAnimatingMove = false;
            const btn = document.querySelector(`.provider-item[data-id="${id}"] .provider-move-btn`);
            if (btn) {
                btn.focus();
                if (window.SpatialNav) window.SpatialNav.setFocus(btn);
            }
        }, 205);
    }
}
