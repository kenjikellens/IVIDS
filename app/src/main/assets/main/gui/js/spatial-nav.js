
export const SpatialNav = {
    focusableSelector: '.focusable',
    focusTrapContainer: null,
    currentPageLogic: null,
    lastFocusedElement: null,
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

        // FASTEST CHECK: offsetParent is null if display:none or parent is display:none
        if (el.offsetParent === null && el.style.position !== 'fixed') return false;

        // Size check
        if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;

        // Skip expensive computed style checks for common elements if checking visibility heavily
        // We only do the deep check if strictly necessary or for specific edge cases
        if (el.style.opacity === '0' || el.style.visibility === 'hidden') return false;

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

        const elements = Array.from(scope.querySelectorAll(this.focusableSelector));
        // Find first visible without filtering all (performance optimization)
        for (const el of elements) {
            if (this.isVisible(el)) {
                this.setFocus(el);
                return;
            }
        }
    },

    setFocus(element) {
        if (!element || !this.isVisible(element)) return;

        // Track last focus BEFORE updating
        const current = document.querySelector('.focused');
        if (current && current !== element) {
            this.lastFocusedElement = current;
        }

        if (current && (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA')) {
            if (!this.isPortrait()) {
                current.readOnly = true;
                current.classList.remove('active-typing');
                if (current.parentElement) current.parentElement.classList.remove('active-typing');
            }
        }

        // Optimization: Use classList directly on the known current instead of querySelectorAll
        if (current) current.classList.remove('focused');

        // Fail-safe cleanup
        document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
        document.querySelectorAll('.focused-within').forEach(el => el.classList.remove('focused-within'));

        element.classList.add('focused');

        // We rely on CSS :focus-within for most things, 
        // but keep a minimal class for legacy or complex container styling if absolutely needed.
        // However, let's try to remove this manual loop for better performance.
        /*
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
            parent.classList.add('focused-within');
            parent = parent.parentElement;
        }
        */

        if (this.isPortrait() && (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA')) {
            element.readOnly = false;
            element.removeAttribute('inputmode');
            element.classList.add('active-typing');
            if (element.parentElement) element.parentElement.classList.add('active-typing');
        }

        this.centerElement(element);
        element.focus({ preventScroll: true }); // Prevent browser auto-scroll, we handle it
    },

    refocus() {
        if (this.lastFocusedElement && this.isVisible(this.lastFocusedElement)) {
            this.setFocus(this.lastFocusedElement);
        } else {
            this.focusFirst();
        }
    },

    centerElement(el) {
        if (!el) return;

        // 1. Vertical centering in #main-view
        const mainView = document.getElementById('main-view');
        if (mainView && mainView.contains(el)) {
            // Optimization: Minimal rect calculation
            const elTop = el.offsetTop;
            const elHeight = el.offsetHeight;
            const viewHeight = mainView.clientHeight;

            // Simple centering logic without getBoundingClientRect if possible
            // But mainView might be scrolled, so we need relative position
            // Using scrollIntoView is usually GPU accelerated and smoother on TV
            try {
                el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            } catch (e) {
                el.scrollIntoView(false);
            }
        } else {
            try {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            } catch (e) {
                el.scrollIntoView(false);
            }
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

        // Performance: Don't querySelector if we don't handle the key
        const isNav = (keyCode >= 37 && keyCode <= 40);
        const isAction = (keyCode === 13);
        const isBack = (keyCode === 8 || keyCode === 27 || keyCode === 10009 || keyCode === 4);
        const isNum = ((keyCode >= 48 && keyCode <= 57) || (keyCode >= 96 && keyCode <= 105));

        if (!isNav && !isAction && !isBack && !isNum) return;

        const current = document.querySelector('.focused');

        if (!current || !this.isVisible(current)) {
            this.focusFirst();
            return;
        }

        // Navigation keys
        if (isNav) {
            e.preventDefault();
            // Throttle massive fast scrolling
            if (this.loadingNav) return;

            const directions = { 37: 'left', 38: 'up', 39: 'right', 40: 'down' };
            const next = this.findNext(current, directions[keyCode]);

            if (next) {
                this.setFocus(next);
            }
            return;
        }

        // Action keys
        if (isAction) {
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
        if (isBack) {
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
        if (isNum && (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA')) {
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
        let isScoped = false;

        if (!this.focusTrapContainer && (direction === 'up' || direction === 'down')) {
            const mainView = document.getElementById('main-view');
            const sidebar = document.getElementById('sidebar-container');

            if (mainView && mainView.contains(current)) {
                searchScope = mainView;
                isScoped = true;
            } else if (sidebar && sidebar.contains(current)) {
                searchScope = sidebar;
                isScoped = true;
            }
        }

        const rect = current.getBoundingClientRect();
        const center = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };

        // Get Candidates - Optimization: Don't use Array.from(...).filter() which is slow
        // Instead, loop manually and fail fast
        const allElements = searchScope.querySelectorAll(this.focusableSelector);

        let best = null;
        let minScore = Infinity;

        // Pre-calculate loop variables
        let el, elRect, dx, dy, mainDist, crossDist, score;
        const weight = (direction === 'up' || direction === 'down') ? 2.5 : 4;

        for (let i = 0; i < allElements.length; i++) {
            el = allElements[i];
            if (el === current) continue;

            // Fast visibility check first
            if (el.offsetParent === null) continue;

            elRect = el.getBoundingClientRect();

            // Optimization: Direction pre-check using rects before expensive logic
            // This filters out 50%+ of candidates instantly without math
            if (direction === 'left' && elRect.left >= rect.left) continue;
            if (direction === 'right' && elRect.right <= rect.right) continue;
            if (direction === 'up' && elRect.top >= rect.top) continue;
            if (direction === 'down' && elRect.bottom <= rect.bottom) continue;

            // Only now do we check strict visibility (costly) if needed, but we used offsetParent above
            // so we can likely skip full isVisible() if we trust the loop

            const elCenter = {
                x: elRect.left + elRect.width / 2,
                y: elRect.top + elRect.height / 2
            };

            dx = elCenter.x - center.x;
            dy = elCenter.y - center.y;

            let isPossible = false;
            // Strict direction check
            if (direction === 'left' && dx < -1) isPossible = true;
            else if (direction === 'right' && dx > 1) isPossible = true;
            else if (direction === 'up' && dy < -1) isPossible = true;
            else if (direction === 'down' && dy > 1) isPossible = true;

            if (isPossible) {
                if (direction === 'left' || direction === 'right') {
                    mainDist = Math.abs(dx);
                    crossDist = Math.abs(dy);
                } else {
                    mainDist = Math.abs(dy);
                    crossDist = Math.abs(dx);
                }

                score = (mainDist * mainDist) + (crossDist * crossDist * weight);

                if (score < minScore) {
                    minScore = score;
                    best = el;
                }
            }
        }

        return best;
    }
};
