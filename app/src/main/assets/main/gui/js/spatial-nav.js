
/** Key code mapping for D-pad, Enter, Back, and numeric keys. Hoisted to module scope to avoid re-creation on every keypress. */
const KEY_MAP = {
    ArrowLeft: 37, Left: 37,
    ArrowUp: 38, Up: 38,
    ArrowRight: 39, Right: 39,
    ArrowDown: 40, Down: 40,
    Enter: 13,
    DpadCenter: 23,
    AndroidEnter: 66,
    Escape: 27,
    Backspace: 8,
    Back: 10009,
    AndroidBack: 4
};

export const SpatialNav = {
    focusableSelector: '.focusable',
    focusTrapContainer: null,
    currentPageLogic: null,
    lastFocusedElement: null,
    _initialized: false,
    isMouseInteraction: false,
    backHandlers: [],

    /**
     * Checks if the viewport is in portrait mode based on viewport width (less than or equal to 600px).
     * Affects the input focus behavior and navigation layout decisions.
     * @returns {boolean} True if the viewport width is within the portrait mobile range.
     */
    isPortrait() {
        return window.matchMedia('(max-width: 600px)').matches;
    },

    /**
     * Initializes the spatial navigation system, binds D-pad keyboard handlers, and registers mouse/touch listeners.
     * This coordinates focus management and sets up mutation observers to dynamically track focusable elements.
     */
    init(onBack) {
        if (onBack) this.onBack = onBack;
        if (this._initialized) {
            this.focusFirst();
            return;
        }
        this._initialized = true;

        window.addEventListener('keydown', (e) => {
            this.isMouseInteraction = false;
            this.handleKey(e);
        });

        // Add mouse support for focus and input activation
        window.addEventListener('mousedown', (e) => {
            this.isMouseInteraction = true;
            const target = e.target.closest(this.focusableSelector);
            if (target) {
                this.setFocus(target);

                // If it's an input, we also want to activate it for mouse users
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                    if (target.readOnly) {
                        this.activateInput(target);
                    }
                }
            } else {
                // If clicked on non-focusable, check if we should deactivate current input
                const current = document.querySelector('.focused');
                if (current && (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA')) {
                    if (!current.readOnly) {
                        this.deactivateInput(current);
                        current.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }
        });

        // Track touch interactions to avoid centering layout scroll shift jumps
        window.addEventListener('touchstart', (e) => {
            this.isMouseInteraction = true;
        }, { passive: true });

        // Ensure all currently focusable elements have a tabindex
        this.ensureTabindex();

        // Monitor DOM changes to apply tabindex to new elements (like those in modals)
        // Throttled to prevent excessive scans during bulk DOM updates (e.g. rendering 200+ posters)
        let _tabindexTimer = null;
        const observer = new MutationObserver(() => {
            if (_tabindexTimer) return;
            _tabindexTimer = setTimeout(() => {
                this.ensureTabindex();
                _tabindexTimer = null;
            }, 100);
        });
        observer.observe(document.body, { childList: true, subtree: true });

        this.focusFirst();
    },

    ensureTabindex() {
        document.querySelectorAll(this.focusableSelector).forEach(el => {
            if (!el.hasAttribute('tabindex')) {
                el.setAttribute('tabindex', '-1');
            }
        });
    },

    /**
     * Pushes a callback to the top of the back handler stack.
     * The callback should return true if it handles the back key event, or false otherwise.
     * @param {Function} handler - The back action handler function.
     */
    pushBackHandler(handler) {
        this.backHandlers.push(handler);
    },

    /**
     * Removes a specific callback from the back handler stack.
     * @param {Function} handler - The back action handler function to remove.
     */
    popBackHandler(handler) {
        this.backHandlers = this.backHandlers.filter(h => h !== handler);
    },

    /**
     * Clears all registered back handlers from the stack.
     * Prevents orphan handlers from persisting across page route transitions.
     */
    clearBackHandlers() {
        this.backHandlers = [];
    },

    /**
     * Executes the back action by running registered back stack handlers in LIFO order.
     * Also handles sidebar focus navigation when sidebar has active focus.
     * Falls back to invoking onBack when the back action is not fully consumed.
     * @returns {boolean} True if the back action was handled, false otherwise.
     */
    back() {
        // Run stack handlers in LIFO order
        for (let i = this.backHandlers.length - 1; i >= 0; i--) {
            try {
                if (this.backHandlers[i]()) {
                    return true;
                }
            } catch (err) {
                console.error('Error in spatial-nav back handler:', err);
            }
        }

        const current = document.querySelector('.focused');

        // If focused on sidebar, return focus to main content and prevent page navigation
        const sidebar = document.getElementById('sidebar-container');
        if (sidebar && current && sidebar.contains(current)) {
            const mainView = document.getElementById('main-view');
            if (mainView) {
                const firstFocusable = mainView.querySelector(this.focusableSelector);
                if (firstFocusable && this.isVisible(firstFocusable)) {
                    this.setFocus(firstFocusable);
                    return true;
                }
            }
            this.focusFirst();
            return true;
        }

        if (this.onBack) {
            this.onBack();
            return true;
        }
        return false;
    },

    /**
     * Activates the active-typing mode on a text input or textarea, making it editable.
     * Also pushes a back handler to exit this mode on Escape/Back press.
     * @param {HTMLInputElement|HTMLTextAreaElement} input - The input element to activate.
     */
    activateInput(input) {
        if (!input || !input.readOnly) return;
        input.readOnly = false;
        input.removeAttribute('inputmode');
        input.classList.add('active-typing');
        input.focus();

        const inputBackHandler = () => {
            if (!input.readOnly) {
                input.readOnly = true;
                input.classList.remove('active-typing');
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.blur();
                this.popBackHandler(inputBackHandler);
                return true;
            }
            return false;
        };
        this.pushBackHandler(inputBackHandler);
        input._backHandler = inputBackHandler;
    },

    /**
     * Deactivates the active-typing mode on a text input or textarea.
     * Removes the associated back handler if present.
     * @param {HTMLInputElement|HTMLTextAreaElement} input - The input element to deactivate.
     */
    deactivateInput(input) {
        if (!input) return;
        input.readOnly = true;
        input.classList.remove('active-typing');
        input.blur();
        if (input._backHandler) {
            this.popBackHandler(input._backHandler);
            delete input._backHandler;
        }
    },

    setPageLogic(logic) {
        this.currentPageLogic = logic;
    },

    setFocusTrap(container) {
        this.focusTrapContainer = container;
        if (container) {
            // Force tabindex update for new container elements immediately
            this.ensureTabindex();
            const first = Array.from(container.querySelectorAll(this.focusableSelector))
                .find(el => this.isVisible(el));
            if (first) this.setFocus(first);
        }
    },

    clearFocusTrap() {
        this.focusTrapContainer = null;
    },

    /**
     * Determines if a DOM element is visible and eligible for receiving focus.
     * Evaluates display, visibility, opacity, dimensions, and performs ancestor visibility walks (especially for fixed elements).
     * @param {HTMLElement} el - The target element to evaluate for visibility status.
     * @returns {boolean} True if the element is visible and focusable, false otherwise.
     */
    isVisible(el) {
        if (!el) return false;

        // Check if element is inside a modal-overlay that is not currently active or shown
        const modal = el.closest('.modal-overlay');
        if (modal && !modal.classList.contains('active') && !modal.classList.contains('show')) {
            return false;
        }

        // FASTEST CHECK: offsetParent is null if display:none or parent is display:none.
        // However, position: fixed elements or their descendants also have offsetParent === null in many browsers.
        // To resolve this, we do a deeper computed style walk only when offsetParent is null.
        if (el.offsetParent === null) {
            let curr = el;
            let depth = 0;
            let hasFixedAncestor = false;
            while (curr && curr !== document.body && depth < 12) {
                if (curr.style.display === 'none') {
                    return false;
                }
                const style = window.getComputedStyle(curr);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || style.pointerEvents === 'none') {
                    return false;
                }
                if (style.position === 'fixed') {
                    hasFixedAncestor = true;
                }
                curr = curr.parentElement;
                depth++;
            }
            // If it has no fixed ancestor and offsetParent is null, it is hidden or detached.
            if (!hasFixedAncestor) {
                return false;
            }
        }

        // Size check
        if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;

        // Skip expensive computed style checks for common elements if checking visibility heavily
        // We only do the deep check if strictly necessary or for specific edge cases
        if (el.style.opacity === '0' || el.style.visibility === 'hidden') return false;

        if (window.getComputedStyle(el).pointerEvents === 'none') return false;

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

        // Prioritize #main-view over sidebar/others if no trap is active
        if (!this.focusTrapContainer) {
            const mainView = document.getElementById('main-view');
            if (mainView) {
                const elements = mainView.querySelectorAll(this.focusableSelector);
                for (const el of elements) {
                    if (this.isVisible(el)) {
                        this.setFocus(el);
                        return;
                    }
                }
            }
        }

        const elements = Array.from(scope.querySelectorAll(this.focusableSelector));
        for (const el of elements) {
            if (this.isVisible(el)) {
                this.setFocus(el);
                return;
            }
        }
    },

    setFocus(element) {
        if (!element || !this.isVisible(element)) return;

        // Pre-fetch details if element contains dataset id and type
        if (element.dataset.id && element.dataset.type) {
            const id = element.dataset.id;
            const type = element.dataset.type;
            import('../../logic/api.js').then(({ Api }) => {
                Api.getDetails(id, type).catch(err => console.warn('Pre-fetch failed:', err));
            }).catch(err => console.error('Failed to import Api for pre-fetching:', err));
        }

        // Track last focus BEFORE updating
        const current = document.querySelector('.focused');
        if (current && current !== element) {
            this.lastFocusedElement = current;
        }

        if (current && (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA')) {
            // Always cleanup input state when moving focus, regardless of orientation
            this.deactivateInput(current);
        }

        // Optimization: Use classList directly on the known current instead of querySelectorAll
        if (current) current.classList.remove('focused');

        // Clean up focused-within classes from any previous parent chain
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
            this.activateInput(element);
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

    /**
     * Centers the focused element in the scroll viewport, bypassing modal overlays to prevent layout shifts.
     * For elements in horizontal movie/series poster rows (.row-posters), this executes a custom Netflix-style
     * horizontal scrolling behavior where focus stays locked at Column 2 and posters scroll underneath.
     * For all other layouts, standard scrollIntoView rules apply.
     * @param {HTMLElement} el - The DOM node to center in the viewport.
     */
    centerElement(el) {
        if (!el) return;

        // Check if the focused element is located inside a modal overlay window.
        const modal = el.closest('.modal-overlay, .modal-content, .modal');

        // Skip centering for mouse/touch interactions to prevent page scroll shifts on clicks
        if (this.isMouseInteraction) {
            return;
        }

        // Check if the element belongs to a Netflix-style horizontal row container (.row-posters)
        const rowPosters = el.closest('.row-posters');

        const isCarouselPage = this.currentPageLogic?.isCarouselPage === true;

        if (rowPosters && isCarouselPage) {
            // Calculate and apply custom horizontal carousel scrolling (Netflix-style Column 2 lock)
            const style = window.getComputedStyle(rowPosters);
            const paddingLeft = parseFloat(style.paddingLeft) || 0;
            const posterWidth = el.offsetWidth;
            const gap = 14; // Standard gap defined in CSS between poster wrappers
            
            // Align focused item to Column 2 (one poster width + gap offset from the left padding)
            const targetOffset = paddingLeft + posterWidth + gap;
            
            // Offset position of the poster relative to the scroll container's left border
            let targetScrollLeft = el.offsetLeft - targetOffset;
            
            // Clamp scroll position to row bounds [0, maxScrollLeft]
            const maxScrollLeft = rowPosters.scrollWidth - rowPosters.clientWidth;
            targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));
            
            // Perform smooth horizontal scrolling to the calculated index target
            rowPosters.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });

            // Next, handle smooth vertical centering of the active row container within #main-view
            const mainView = document.getElementById('main-view');
            if (mainView && mainView.contains(rowPosters)) {
                const rowRect = rowPosters.getBoundingClientRect();
                const viewRect = mainView.getBoundingClientRect();
                
                // Keep the row centered vertically in the viewport
                const rowCenter = rowRect.top + rowRect.height / 2;
                const viewCenter = viewRect.top + viewRect.height / 2;
                const verticalDiff = rowCenter - viewCenter;
                
                // Scroll vertically only if the row is shifted beyond a minor tolerance threshold (e.g. 5px)
                if (Math.abs(verticalDiff) > 5) {
                    mainView.scrollBy({ top: verticalDiff, behavior: 'smooth' });
                }
            }
            return;
        }

        // Standard centering logic for non-carousel elements (e.g. settings, buttons, profile selectors, search grid)
        // Find the nearest vertical scrollable parent element (constrained inside the modal boundary if present) to perform vertical centering.
        let parent = el.parentElement;
        let scrollParent = null;
        const boundary = modal || document.body;
        while (parent && parent !== boundary) {
            const overflowY = window.getComputedStyle(parent).overflowY;
            if ((overflowY === 'auto' || overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
                scrollParent = parent;
                break;
            }
            parent = parent.parentElement;
        }

        // If the element is inside a modal but has no inner scroll container, skip scrolling to avoid shifting the main background page layout.
        if (modal && !scrollParent) {
            return;
        }

        const mainView = document.getElementById('main-view');
        const viewContainer = scrollParent || mainView;

        if (viewContainer && viewContainer.contains(el)) {
            const elementRect = el.getBoundingClientRect();
            const viewRect = viewContainer.getBoundingClientRect();

            // Scroll vertically to center the element and prevent horizontal layout shifting.
            // Always centering the focused element provides a more consistent, premium TV-first D-pad experience.
            const elCenter = elementRect.top + elementRect.height / 2;
            const viewCenter = viewRect.top + viewRect.height / 2;
            const verticalDiff = elCenter - viewCenter;

            try {
                viewContainer.scrollBy({ top: verticalDiff, behavior: 'smooth' });
            } catch (e) {
                viewContainer.scrollTop += verticalDiff;
            }
        } else {
            try {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            } catch (e) {
                el.scrollIntoView(false);
            }
        }
    },

    /**
     * Handles keydown events to coordinate spatial navigation, input field edits, and back button behaviors.
     * It manages keyboard/remote control state and dispatches simulated navigation or text edits.
     * @param {KeyboardEvent} e - The keydown event to handle.
     */
    handleKey(e) {
        const keyCode = e.keyCode || KEY_MAP[e.key];

        // Performance: Don't querySelector if we don't handle the key
        const isNav = (keyCode >= 37 && keyCode <= 40);
        const isAction = (keyCode === 13 || keyCode === 23 || keyCode === 66);
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
                    this.activateInput(current);
                } else {
                    if (!this.isPortrait()) {
                        this.deactivateInput(current);
                        // Trigger a change event so listeners know editing is done
                        current.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            } else if (current.tagName === 'SELECT') {
                // Let browser handle select natively
            } else {
                e.preventDefault();
                current.click();
            }
            return;
        }

        // Back keys
        if (isBack) {
            // If focused on an active input, and keyCode is 8 (Backspace), do NOT run back handlers,
            // let the browser handle character deletion natively.
            const isEditingInput = current && (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA') && !current.readOnly;
            if (isEditingInput && keyCode === 8) {
                return;
            }

            e.preventDefault();
            this.back();
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

    /**
     * Calculates the next focus candidate element in a given direction from the current element.
     * Respects page-specific spatial overrides, manual data navigation paths, and visibility constraints.
     * Uses a distance-based scoring heuristic to find the closest element in the navigation direction.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - The navigation direction ('up', 'down', 'left', 'right').
     * @returns {HTMLElement|null} The next focus target element, or null if no valid target.
     */
    findNext(current, direction) {
        // 0. Check for page-specific spatial logic override
        if (this.currentPageLogic && typeof this.currentPageLogic.findNext === 'function') {
            const overrideNode = this.currentPageLogic.findNext(current, direction);
            if (overrideNode && this.isVisible(overrideNode)) {
                return overrideNode;
            }
        }

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

            elRect = el.getBoundingClientRect();

            // Optimization: Direction pre-check using rects before expensive logic
            // This filters out 50%+ of candidates instantly without math
            if (direction === 'left' && elRect.left >= rect.left) continue;
            if (direction === 'right' && elRect.right <= rect.right) continue;
            if (direction === 'up' && elRect.top >= rect.top) continue;
            if (direction === 'down' && elRect.bottom <= rect.bottom) continue;

            // Validate that the element is active, laid out, and visible (expensive walk)
            if (!this.isVisible(el)) continue;

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
