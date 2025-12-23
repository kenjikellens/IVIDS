
export const SpatialNav = {
    focusableSelector: '.focusable',
    focusTrapContainer: null,
    currentPageLogic: null,
    _initialized: false,

    isPortrait() {
        return window.matchMedia('(orientation: portrait)').matches;
    },

    init(onBack) {
        if (onBack) this.onBack = onBack;
        if (this._initialized) {
            this.focusFirst();
            return;
        }
        this._initialized = true;

        window.addEventListener('keydown', (e) => this.handleKey(e));
        this.focusFirst();
    },

    setPageLogic(logic) {
        this.currentPageLogic = logic;
    },

    setFocusTrap(container) {
        this.focusTrapContainer = container;
        if (container) {
            const first = Array.from(container.querySelectorAll(this.focusableSelector))
                .find(el => this.isVisible(el));
            if (first) this.setFocus(first);
        }
    },

    clearFocusTrap() {
        this.focusTrapContainer = null;
    },

    isVisible(el) {
        if (!el) return false;

        // Use standard check if available
        if (typeof el.checkVisibility === 'function') {
            try {
                if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) {
                    // Double check with offset dimensions just in case checkVisibility is flaky
                    if (el.offsetWidth > 0 && el.offsetHeight > 0) {
                        // If it has size but checkVisibility says no, trust checkVisibility unless it's a known false negative case
                        // However, let's be safe and check parents manually if we suspect issues
                    } else {
                        return false;
                    }
                }
            } catch (e) { }
        }

        if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;

        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;

        // Quick check for hidden parents (very common for modals)
        let p = el.parentElement;
        while (p && p !== document.body) {
            const ps = window.getComputedStyle(p);
            if (ps.display === 'none' || ps.visibility === 'hidden') return false;
            p = p.parentElement;
        }

        return true;
    },

    focusFirst() {
        const scope = this.focusTrapContainer || document;

        if (this.currentPageLogic && this.currentPageLogic.getDefaultFocus) {
            const el = this.currentPageLogic.getDefaultFocus();
            if (this.isVisible(el)) {
                this.setFocus(el);
                return;
            }
        }

        const elements = Array.from(scope.querySelectorAll(this.focusableSelector))
            .filter(el => this.isVisible(el));

        if (elements.length === 0) return;

        // Priorities
        const priorities = ['#search-input', '#search-btn', '.hero-play', '.play-btn'];
        for (const sel of priorities) {
            const el = scope.querySelector(sel);
            if (this.isVisible(el)) {
                this.setFocus(el);
                return;
            }
        }

        this.setFocus(elements[0]);
    },

    setFocus(element) {
        if (!element || !this.isVisible(element)) return;

        const current = document.querySelector('.focused');
        if (current && (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA')) {
            if (!this.isPortrait()) {
                current.readOnly = true;
                current.classList.remove('active-typing');
                if (current.parentElement) current.parentElement.classList.remove('active-typing');
            }
        }

        document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
        element.classList.add('focused');

        if (this.isPortrait() && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
            element.readOnly = false;
            element.removeAttribute('inputmode');
            element.classList.add('active-typing');
            if (element.parentElement) element.parentElement.classList.add('active-typing');
        }

        this.centerElement(element);
        element.focus();
    },

    centerElement(el) {
        if (!el) return;

        // 1. Vertical centering in #main-view
        const mainView = document.getElementById('main-view');
        if (mainView && mainView.contains(el)) {
            const elRect = el.getBoundingClientRect();
            const viewRect = mainView.getBoundingClientRect();

            // Calculate target scroll position:
            // Current Scroll + (Element Viewport Center - Viewport Center)
            const elCenterY = elRect.top + elRect.height / 2;
            const viewCenterY = viewRect.top + viewRect.height / 2;
            const deltaY = elCenterY - viewCenterY;
            const targetScrollTop = mainView.scrollTop + deltaY;

            mainView.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        }

        // Horizontal centering removed as per user request ("not as width")
        // Just ensure it's in view horizontally if it's off-screen
        try {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        } catch (e) {
            el.scrollIntoView(false);
        }
    },

    handleKey(e) {
        const KEY_MAP = {
            ArrowLeft: 37, Left: 37,
            ArrowUp: 38, Up: 38,
            ArrowRight: 39, Right: 39,
            ArrowDown: 40, Down: 40,
            Enter: 13,
            Escape: 27,
            Backspace: 8,
            Back: 10009,
            AndroidBack: 4
        };

        const keyCode = e.keyCode || KEY_MAP[e.key];
        const current = document.querySelector('.focused');

        if (!current || !this.isVisible(current)) {
            this.focusFirst();
            return;
        }

        // Navigation keys
        if (keyCode >= 37 && keyCode <= 40) {
            e.preventDefault();
            const directions = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };
            const next = this.findNext(current, directions[keyCode]);
            if (next) this.setFocus(next);
            return;
        }

        // Action keys
        if (keyCode === 13) {
            if (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA') {
                if (current.readOnly) {
                    current.readOnly = false;
                    current.removeAttribute('inputmode');
                    current.classList.add('active-typing');
                    if (current.parentElement) current.parentElement.classList.add('active-typing');
                    // On some TVs, we need to explicitly call focus() again after making it editable
                    current.focus();
                } else {
                    if (!this.isPortrait()) {
                        current.readOnly = true;
                        current.classList.remove('active-typing');
                        if (current.parentElement) current.parentElement.classList.remove('active-typing');
                        // Trigger a change event so listeners know editing is done
                        current.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            } else {
                e.preventDefault();
                current.click();
            }
            return;
        }

        // Back keys
        if (keyCode === 8 || keyCode === 27 || keyCode === 10009 || keyCode === 4) {
            if (keyCode === 8 && (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA')) {
                if (!current.readOnly) {
                    // Manual backspace handling for some TVs if needed
                    const val = current.value;
                    if (val.length > 0) {
                        current.value = val.slice(0, -1);
                        current.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    return;
                }
                return;
            }
            e.preventDefault();
            if (this.onBack) this.onBack();
            return;
        }

        // Numeric keys (0-9)
        const isNumeric = (keyCode >= 48 && keyCode <= 57) || (keyCode >= 96 && keyCode <= 105);
        if (isNumeric && (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA')) {
            if (!current.readOnly) {
                const char = (keyCode >= 96) ? String(keyCode - 96) : String(keyCode - 48);

                // For number-only inputs like PIN digits
                if (current.type === 'number' || current.classList.contains('pin-digit')) {
                    current.value = char; // PIN digits are usually 1 char max
                } else if (current.maxLength === -1 || current.value.length < current.maxLength) {
                    current.value += char;
                }

                current.dispatchEvent(new Event('input', { bubbles: true }));
                e.preventDefault();
            }
        }
    },

    findNext(current, direction) {
        let scope = this.focusTrapContainer || document;

        // 1. Check for manual override (data-nav-up, data-nav-down, etc.)
        const override = current.getAttribute(`data-nav-${direction}`);
        if (override) {
            const target = scope.querySelector(override) || document.querySelector(override);
            if (this.isVisible(target)) return target;
        }

        // Logic to prevent jumping between Sidebar and Main Content on Up/Down
        let searchScope = scope;
        if (!this.focusTrapContainer && (direction === 'up' || direction === 'down')) {
            const mainView = document.getElementById('main-view');
            const sidebar = document.getElementById('sidebar-container');

            if (mainView && mainView.contains(current)) {
                searchScope = mainView;
            } else if (sidebar && sidebar.contains(current)) {
                searchScope = sidebar;
            }
        }

        const rect = current.getBoundingClientRect();
        const center = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };

        const candidates = Array.from(searchScope.querySelectorAll(this.focusableSelector))
            .filter(el => el !== current && this.isVisible(el));

        let best = null;
        let minScore = Infinity;

        candidates.forEach(el => {
            const elRect = el.getBoundingClientRect();
            const elCenter = {
                x: elRect.left + elRect.width / 2,
                y: elRect.top + elRect.height / 2
            };

            const dx = elCenter.x - center.x;
            const dy = elCenter.y - center.y;

            let isPossible = false;
            switch (direction) {
                case 'left': if (dx < -1) isPossible = true; break;
                case 'right': if (dx > 1) isPossible = true; break;
                case 'up': if (dy < -1) isPossible = true; break;
                case 'down': if (dy > 1) isPossible = true; break;
            }

            if (isPossible) {
                // Scoring function: balance distance and alignment
                const mainDist = direction === 'left' || direction === 'right' ? Math.abs(dx) : Math.abs(dy);
                const crossDist = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);

                // Use distance-squared for more aggressive proximity preference
                // But keep cross-axis penalty higher to favor alignment on the main axis
                const crossPenalty = (direction === 'up' || direction === 'down') ? 2.5 : 4;
                const score = (mainDist * mainDist) + (crossDist * crossDist * crossPenalty);

                if (score < minScore) {
                    minScore = score;
                    best = el;
                }
            }
        });

        return best;
    }
};
