import { SpatialNav } from '../spatial-nav.js';
import { escapeHtml } from './sanitize.js';

/**
 * Reusable 2-level Stream Options drawer controller shared between VOD Player and Live TV Player.
 * Manages category drill-down, option selection, escaped DOM rendering, and SpatialNav focus restoration.
 */
export class StreamOptionsDrawer {
    /**
     * Initializes a StreamOptionsDrawer bound to panel DOM elements and category/lifecycle callbacks.
     *
     * @param {Object} config - Drawer DOM elements and callback hooks.
     */
    constructor({
        panelEl,
        titleEl,
        optionsEl,
        backBtnEl,
        anchorBtnEl,
        getCategories,
        getRootTitle = () => 'Stream Options',
        useModalClass = true,
        itemBaseClass = 'setting-item',
        onOpen = null,
        onClose = null,
        onRender = null
    }) {
        this.panelEl = panelEl;
        this.titleEl = titleEl;
        this.optionsEl = optionsEl;
        this.backBtnEl = backBtnEl;
        this.anchorBtnEl = anchorBtnEl;
        this.getCategories = getCategories;
        this.getRootTitle = getRootTitle;
        this.useModalClass = useModalClass;
        this.itemBaseClass = itemBaseClass;
        this.onOpen = onOpen;
        this.onClose = onClose;
        this.onRender = onRender;
        this.activeSubmenu = null;
        this.lastCategoryKey = null;
    }

    /**
     * Checks whether the Stream Options drawer is currently open.
     *
     * @returns {boolean} True when open.
     */
    isOpen() {
        if (!this.panelEl) return false;
        return this.useModalClass
            ? this.panelEl.classList.contains('is-open')
            : !this.panelEl.classList.contains('hidden');
    }

    /**
     * Opens the Stream Options drawer at root level and focuses the last or first focusable option.
     */
    open() {
        if (!this.panelEl) return;
        this.activeSubmenu = null;
        if (typeof this.onOpen === 'function') this.onOpen();
        this.render();
        if (this.useModalClass) {
            this.panelEl.classList.add('is-open', 'active');
        } else {
            this.panelEl.classList.remove('hidden');
        }
        const selector = this.lastCategoryKey
            ? `.${this.itemBaseClass}[data-submenu="${this.lastCategoryKey}"]`
            : `.${this.itemBaseClass}.focusable`;
        const firstOpt = this.panelEl.querySelector(selector) || this.panelEl.querySelector(`.${this.itemBaseClass}.focusable`);
        if (firstOpt) SpatialNav.setFocus(firstOpt);
    }

    /**
     * Closes the Stream Options drawer, resets submenu state, and optionally returns focus to anchor button.
     *
     * @param {boolean} [restoreFocus=false] - Whether to focus the settings trigger button.
     */
    close(restoreFocus = false) {
        if (!this.panelEl) return;
        this.activeSubmenu = null;
        if (this.useModalClass) {
            this.panelEl.classList.remove('is-open', 'active');
        } else {
            this.panelEl.classList.add('hidden');
        }
        if (restoreFocus && this.anchorBtnEl) {
            SpatialNav.setFocus(this.anchorBtnEl);
        }
        if (typeof this.onClose === 'function') this.onClose();
    }

    /**
     * Toggles the drawer open or closed.
     */
    toggle() {
        if (this.isOpen()) {
            this.close(true);
        } else {
            this.open();
        }
    }

    /**
     * Steps back from an active submenu to the root list, or closes the drawer when at root.
     *
     * @returns {boolean} True if consumed.
     */
    navigateBack() {
        if (!this.isOpen()) return false;
        if (this.activeSubmenu) {
            const prevCat = this.activeSubmenu;
            this.activeSubmenu = null;
            this.render();
            const catBtn = this.optionsEl?.querySelector(`.${this.itemBaseClass}[data-submenu="${prevCat}"]`)
                || this.optionsEl?.querySelector(`.${this.itemBaseClass}.focusable`);
            if (catBtn) SpatialNav.setFocus(catBtn);
            return true;
        }
        this.close(true);
        return true;
    }

    /**
     * Renders either the root category list or the selected submenu options into optionsEl.
     */
    render() {
        if (!this.optionsEl) return;
        const categories = typeof this.getCategories === 'function' ? this.getCategories() : [];
        if (this.activeSubmenu && !categories.some(c => c.key === this.activeSubmenu && !c.isDirectAction)) {
            this.activeSubmenu = null;
        }
        const activeCategory = this.activeSubmenu ? categories.find(c => c.key === this.activeSubmenu) : null;

        if (this.titleEl) {
            this.titleEl.textContent = activeCategory ? activeCategory.label : this.getRootTitle();
        }
        if (typeof this.onRender === 'function') {
            this.onRender(activeCategory);
        }

        if (!activeCategory) {
            this.optionsEl.innerHTML = categories.map(cat => this._buildCategoryHtml(cat)).join('');
            if (this.panelEl) SpatialNav.ensureTabindex(this.panelEl);
            this.optionsEl.querySelectorAll(`.${this.itemBaseClass}[data-submenu]`).forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const key = btn.dataset.submenu;
                    const match = categories.find(c => c.key === key);
                    if (match?.isDirectAction && typeof match.onPick === 'function') {
                        match.onPick();
                        return;
                    }
                    this.activeSubmenu = key;
                    this.lastCategoryKey = key;
                    this.render();
                    const target = this.optionsEl.querySelector(`.${this.itemBaseClass}.is-active`)
                        || this.optionsEl.querySelector(`.${this.itemBaseClass}.focusable`);
                    if (target) SpatialNav.setFocus(target);
                };
            });
            return;
        }

        this.optionsEl.innerHTML = activeCategory.options.map((opt, idx) => this._buildOptionHtml(activeCategory, opt, idx)).join('');
        if (this.panelEl) SpatialNav.ensureTabindex(this.panelEl);
        this.optionsEl.querySelectorAll(`.${this.itemBaseClass}[data-opt-idx]`).forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const idx = Number(btn.dataset.optIdx);
                const picked = activeCategory.options[idx];
                if (picked && typeof picked.onPick === 'function') {
                    picked.onPick();
                }
                this.render();
                const refBtn = this.optionsEl.querySelector(`.${this.itemBaseClass}[data-opt-idx="${idx}"]`);
                if (refBtn) SpatialNav.setFocus(refBtn);
            };
        });
    }

    _buildCategoryHtml(cat) {
        if (this.itemBaseClass === 'tv-opt-btn') {
            return `<button type="button" class="tv-opt-btn tv-opt-btn--category focusable universal-onclick" data-submenu="${escapeHtml(cat.key)}">` +
                `<span class="tv-opt-label">${escapeHtml(cat.label)}</span>` +
                `<span class="tv-opt-value">${escapeHtml(cat.currentValue || '')}</span>` +
                `<span class="tv-opt-chevron" aria-hidden="true">&#8250;</span>` +
                `</button>`;
        }
        return `<button type="button" class="setting-item focusable universal-onclick" data-submenu="${escapeHtml(cat.key)}">` +
            `<span class="setting-info"><span class="setting-label">${escapeHtml(cat.label)}</span></span>` +
            `<span class="setting-control">` +
            `<span class="current-value-display">${escapeHtml(cat.currentValue || '')}</span>` +
            `<span class="edit-trigger" aria-hidden="true"></span>` +
            `</span></button>`;
    }

    _buildOptionHtml(activeCategory, opt, idx) {
        if (this.itemBaseClass === 'tv-opt-btn') {
            return `<button type="button" class="tv-opt-btn focusable universal-onclick ${opt.isActive ? 'is-active' : ''}" data-opt-idx="${idx}" data-kind="${escapeHtml(activeCategory.key)}" data-value="${escapeHtml(String(opt.value ?? idx))}">` +
                `<span class="tv-opt-label">${escapeHtml(opt.label)}</span>` +
                (opt.isActive ? `<span class="tv-opt-checkmark" aria-hidden="true">&#10003;</span>` : '') +
                `</button>`;
        }
        return `<button type="button" class="setting-item focusable universal-onclick ${opt.isActive ? 'is-active' : ''}" data-opt-idx="${idx}">` +
            `<span class="setting-info"><span class="setting-label">${escapeHtml(opt.label)}</span></span>` +
            `<span class="setting-control">${opt.isActive ? '<span class="tv-opt-checkmark" aria-hidden="true">&#10003;</span>' : ''}</span>` +
            `</button>`;
    }
}
