
import { Api } from '../../logic/api.js';
import { lazyLoader } from './lazy-loader.js';

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
    _prefetchTimer: null,
    _cachedMainView: null,
    _activeCenteredRow: null,
    _lastNavTimestamp: 0,

    /**
     * Determines whether the current navigation step should use smooth or instant (auto) scrolling.
     * If key repeats or rapid navigation happens in quick succession (< 180ms), returns 'auto'
     * to eliminate animation frame queue buildup and prevent D-pad stutter on Android TV.
     * @returns {'smooth'|'auto'} The preferred scroll behavior.
     */
    getScrollBehavior() {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const interval = now - (this._lastNavTimestamp || 0);
        this._lastNavTimestamp = now;
        return interval < 180 ? 'auto' : 'smooth';
    },

    /**
     * Checks if the viewport is in portrait mode based on viewport width (less than or equal to 600px).
     * Affects the input focus behavior and navigation layout decisions.
     * @returns {boolean} True if the viewport width is within the portrait mobile range.
     */
    isPortrait() {
        return window.matchMedia('(max-width: 600px)').matches;
    },

    /**
     * Retrieves the cached #main-view container element or queries it from DOM if not yet cached.
     * @returns {HTMLElement|null} The main view container element.
     */
    getMainView() {
        if (!this._cachedMainView || !this._cachedMainView.isConnected) {
            this._cachedMainView = document.getElementById('main-view');
        }
        return this._cachedMainView;
    },

    /**
     * Schedules details prefetching with a 250ms debounce to prevent network request spam during rapid navigation.
     * @param {string} id - The media item ID.
     * @param {string} type - The media item type ('movie' or 'tv').
     */
    scheduleDetailsPrefetch(id, type) {
        if (this._prefetchTimer) {
            clearTimeout(this._prefetchTimer);
            this._prefetchTimer = null;
        }
        this._prefetchTimer = setTimeout(() => {
            this._prefetchTimer = null;
            Api.getDetails(id, type).catch(err => console.warn('Pre-fetch failed:', err));
        }, 250);
    },

    /**
     * Performs a lightweight check to determine if an element has non-zero layout dimensions and is not explicitly hidden.
     * Avoids layout thrashing by checking layout properties without computed style calls.
     * @param {HTMLElement} el - The element to check.
     * @returns {boolean} True if the element appears visible.
     */
    fastIsVisible(el) {
        if (!el) return false;
        if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;
        if (el.style.display === 'none' || el.style.visibility === 'hidden') return false;
        return true;
    },

    /**
     * Resolves the scroll parent for a focused element, utilizing known container classes to eliminate ancestor style walks.
     * @param {HTMLElement} el - The focused element.
     * @param {HTMLElement|null} modal - Optional active modal boundary.
     * @returns {HTMLElement|null} The scrollable container element.
     */
    findScrollParent(el, modal) {
        if (modal) {
            const knownScrollArea = el.closest('.modal-scroll-area, .scrollable-modal-body, .select-options-list, .select-options-grid, .playlist-selection-list');
            if (knownScrollArea) return knownScrollArea;

            let parent = el.parentElement;
            while (parent && parent !== modal) {
                if (parent.scrollHeight > parent.clientHeight) {
                    const overflowY = window.getComputedStyle(parent).overflowY;
                    if (overflowY === 'auto' || overflowY === 'scroll') {
                        return parent;
                    }
                }
                parent = parent.parentElement;
            }
            return null;
        }

        const knownPageScrollArea = el.closest('.playlists-container, .livetv-list-column, .livetv-preview-column, .epg-card');
        if (knownPageScrollArea) return knownPageScrollArea;

        return this.getMainView();
    },

    /**
     * Finds the next or previous focusable sibling within the same horizontal row container.
     * Provides an O(1) fast-path for left/right navigation without scanning candidate arrays.
     * @param {HTMLElement} current - The currently focused element.
     * @param {string} direction - 'left' or 'right'.
     * @returns {HTMLElement|null} Adjacent focusable sibling, or null if at row boundary.
     */
    findRowSibling(current, direction) {
        let sibling = direction === 'right' ? current.nextElementSibling : current.previousElementSibling;
        while (sibling) {
            if (sibling.matches(this.focusableSelector) && !sibling.classList.contains('has-error') && this.fastIsVisible(sibling)) {
                return sibling;
            }
            sibling = direction === 'right' ? sibling.nextElementSibling : sibling.previousElementSibling;
        }
        return null;
    },

    /**
     * Finds the closest focusable item in an adjacent horizontal row (above or below).
     * Scopes candidate searching to the adjacent row (~20 items) rather than the entire page (600+ items).
     * @param {HTMLElement} current - The currently focused element in a row.
     * @param {string} direction - 'up' or 'down'.
     * @returns {HTMLElement|null} The closest element in the adjacent row, or null.
     */
    findAdjacentRowItem(current, direction) {
        const currentRow = current.closest('.row') || current.closest('.row-container');
        if (!currentRow) return null;

        let adjacentRow = direction === 'down' ? currentRow.nextElementSibling : currentRow.previousElementSibling;
        while (adjacentRow) {
            const hasFocusable = adjacentRow.querySelector && adjacentRow.querySelector(this.focusableSelector);
            if (hasFocusable) break;
            adjacentRow = direction === 'down' ? adjacentRow.nextElementSibling : adjacentRow.previousElementSibling;
        }

        if (adjacentRow) {
            const candidates = adjacentRow.querySelectorAll(this.focusableSelector);
            if (candidates.length === 0) return null;

            const currentRect = current.getBoundingClientRect();
            const currentCenterX = currentRect.left + currentRect.width / 2;

            let closest = null;
            let minDiff = Infinity;

            for (let i = 0; i < candidates.length; i++) {
                const cand = candidates[i];
                if (cand.classList.contains('has-error')) continue;
                if (!this.fastIsVisible(cand)) continue;

                const candRect = cand.getBoundingClientRect();
                const candCenterX = candRect.left + candRect.width / 2;
                const diff = Math.abs(candCenterX - currentCenterX);

                if (diff < minDiff) {
                    minDiff = diff;
                    closest = cand;
                }
            }

            if (closest && this.isVisible(closest)) {
                return closest;
            }
        } else if (direction === 'up') {
            const heroPlayBtn = document.getElementById('play-btn');
            if (heroPlayBtn && this.isVisible(heroPlayBtn)) {
                return heroPlayBtn;
            }
        }

        return null;
    },

    /**
     * Initializes the spatial navigation system, binds D-pad keyboard handlers, and registers mouse/touch listeners.
     * This coordinates focus management and establishes entry focus.
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

        this.focusFirst();
    },

    /**
     * Ensures all focusable elements within the container scope have a tabindex attribute.
     * @param {HTMLElement|Document} [container=document] - Optional container to scope the query.
     */
    ensureTabindex(container = document) {
        const root = container || document;
        root.querySelectorAll(this.focusableSelector).forEach(el => {
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
            const mainView = this.getMainView();
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
            this.ensureTabindex(container);
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
     * Evaluates display, visibility, dimensions, and performs lightweight fixed-container checks without computed style walks.
     * @param {HTMLElement} el - The target element to evaluate for visibility status.
     * @returns {boolean} True if the element is visible and focusable, false otherwise.
     */
    isVisible(el) {
        if (!el) return false;

        // Size check first: non-rendered elements fail immediately without expensive computed style walks
        if (el.offsetWidth === 0 || el.offsetHeight === 0) return false;

        // Skip checking if explicit inline display, visibility, or pointerEvents is disabled
        if (el.style.display === 'none' || el.style.visibility === 'hidden' || el.style.pointerEvents === 'none') return false;

        // Check if element is inside a modal-overlay that is not currently active or shown
        const modal = el.closest('.modal-overlay');
        if (modal && !modal.classList.contains('active') && !modal.classList.contains('show')) {
            return false;
        }

        const updateModal = el.closest('.update-modal-overlay');
        if (updateModal && updateModal.style.display === 'none') {
            return false;
        }

        // FASTEST CHECK: offsetParent is null if display:none or parent is display:none.
        // For fixed elements (sidebar or modals), check container directly instead of walking 12 DOM levels
        if (el.offsetParent === null) {
            const fixedContainer = el.closest('#sidebar-container, .modal-overlay, .update-modal-overlay');
            if (!fixedContainer) {
                return false;
            }
            if (fixedContainer.style.display === 'none' || fixedContainer.style.visibility === 'hidden') {
                return false;
            }
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

        // Prioritize #main-view over sidebar/others if no trap is active
        if (!this.focusTrapContainer) {
            const mainView = this.getMainView();
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

        // Debounced pre-fetch for media items (250ms delay to prevent network storms during rapid arrow navigation)
        if (element.dataset.id && element.dataset.type) {
            this.scheduleDetailsPrefetch(element.dataset.id, element.dataset.type);
        } else if (this._prefetchTimer) {
            clearTimeout(this._prefetchTimer);
            this._prefetchTimer = null;
        }

        // Preload next 2 adjacent horizontal posters within the row to ensure seamless scrolling
        if (lazyLoader && typeof lazyLoader.preloadAdjacentRowPosters === 'function') {
            lazyLoader.preloadAdjacentRowPosters(element);
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

        element.classList.add('focused');

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
     * Prevents dual smooth-scrolling jitter and layout thrashing by caching row metrics.
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

        // Dynamically choose smooth vs instant (auto) scroll based on D-pad navigation speed
        const behavior = this.getScrollBehavior();

        // Check if the element belongs to a Netflix-style horizontal row container (.row-posters)
        const rowPosters = el.closest('.row-posters');

        const isCarouselPage = this.currentPageLogic?.isCarouselPage === true;

        if (rowPosters && isCarouselPage) {
            // Calculate and apply custom horizontal carousel scrolling (Netflix-style Column 2 lock)
            // Cache paddingLeft on rowPosters element to eliminate getComputedStyle reflows on each keypress
            if (rowPosters._cachedPaddingLeft === undefined) {
                const style = window.getComputedStyle(rowPosters);
                rowPosters._cachedPaddingLeft = parseFloat(style.paddingLeft) || 0;
            }
            const paddingLeft = rowPosters._cachedPaddingLeft;
            const posterWidth = el.offsetWidth || 154;
            const gap = 14; // Standard gap defined in CSS between poster wrappers
            
            // Align focused item to Column 2 (one poster width + gap offset from the left padding)
            const targetOffset = paddingLeft + posterWidth + gap;
            
            // Offset position of the poster relative to the scroll container's left border
            let targetScrollLeft = el.offsetLeft - targetOffset;
            
            // Clamp scroll position to row bounds [0, maxScrollLeft]
            const maxScrollLeft = rowPosters.scrollWidth - rowPosters.clientWidth;
            targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));
            
            // Perform horizontal scrolling to the calculated index target (instant if rapid burst, smooth otherwise)
            rowPosters.scrollTo({ left: targetScrollLeft, behavior });

            // Next, handle smooth vertical centering of the active row container within #main-view
            // ONLY execute when moving to a DIFFERENT row to avoid concurrent dual smooth-scroll jitter
            if (this._activeCenteredRow !== rowPosters) {
                this._activeCenteredRow = rowPosters;
                const mainView = this.getMainView();
                if (mainView && mainView.contains(rowPosters)) {
                    const rowRect = rowPosters.getBoundingClientRect();
                    const viewRect = mainView.getBoundingClientRect();
                    
                    // Keep the row centered vertically in the viewport
                    const rowCenter = rowRect.top + rowRect.height / 2;
                    const viewCenter = viewRect.top + viewRect.height / 2;
                    const verticalDiff = rowCenter - viewCenter;
                    
                    // Scroll vertically only if the row is shifted beyond a minor tolerance threshold (e.g. 5px)
                    if (Math.abs(verticalDiff) > 5) {
                        mainView.scrollBy({ top: verticalDiff, behavior });
                    }
                }
            }
            return;
        }

        // Standard centering logic for non-carousel elements (e.g. settings, buttons, profile selectors, search grid)
        // Find the nearest vertical scrollable parent element via fast selector matches
        const scrollParent = this.findScrollParent(el, modal);

        // If the element is inside a modal but has no inner scroll container, skip scrolling to avoid shifting the main background page layout.
        if (modal && !scrollParent) {
            return;
        }

        const mainView = this.getMainView();
        const viewContainer = scrollParent || mainView;

        if (viewContainer && viewContainer.contains(el)) {
            const elementRect = el.getBoundingClientRect();
            const viewRect = viewContainer.getBoundingClientRect();

            // Scroll vertically to center the element and prevent horizontal layout shifting.
            const elCenter = elementRect.top + elementRect.height / 2;
            const viewCenter = viewRect.top + viewRect.height / 2;
            const verticalDiff = elCenter - viewCenter;

            try {
                viewContainer.scrollBy({ top: verticalDiff, behavior });
            } catch (e) {
                viewContainer.scrollTop += verticalDiff;
            }
        } else {
            try {
                el.scrollIntoView({ behavior, block: 'nearest', inline: 'nearest' });
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

        // 2. Fast-path: Horizontal and vertical navigation within horizontal rows (.row-posters)
        const rowPosters = current.closest('.row-posters');
        if (rowPosters) {
            if (direction === 'left' || direction === 'right') {
                const sibling = this.findRowSibling(current, direction);
                if (sibling) return sibling;

                // If at left boundary of row, navigate to active/first sidebar item
                if (direction === 'left' && !this.focusTrapContainer) {
                    const sidebar = document.getElementById('sidebar-container');
                    if (sidebar) {
                        const activeNav = sidebar.querySelector('.nav-item.active.focusable') || sidebar.querySelector(this.focusableSelector);
                        if (activeNav && this.isVisible(activeNav)) {
                            return activeNav;
                        }
                    }
                }
                // At right boundary: nothing further right in this row
                if (direction === 'right') return null;
            } else if (direction === 'up' || direction === 'down') {
                const adjacentItem = this.findAdjacentRowItem(current, direction);
                if (adjacentItem) return adjacentItem;
            }
        }

        // 2b. Fast-path: Hero section navigation (Home/Movies/Series hero slider and buttons)
        const heroContainer = current.closest('#hero-slider, .hero-container, .hero-content');
        if (heroContainer && !this.focusTrapContainer) {
            if (direction === 'down') {
                const mainView = this.getMainView();
                const firstRowPoster = mainView?.querySelector('.row-posters .poster-wrapper.focusable') || document.querySelector('.row-posters .poster-wrapper.focusable');
                if (firstRowPoster && this.isVisible(firstRowPoster)) {
                    return firstRowPoster;
                }
            } else if (direction === 'left' && current.id === 'play-btn') {
                const sidebar = document.getElementById('sidebar-container');
                if (sidebar) {
                    const activeNav = sidebar.querySelector('.nav-item.active.focusable') || sidebar.querySelector(this.focusableSelector);
                    if (activeNav && this.isVisible(activeNav)) return activeNav;
                }
            } else if (direction === 'right') {
                const nextHeroBtn = current.id === 'play-btn' ? document.getElementById('details-btn') : null;
                if (nextHeroBtn && this.isVisible(nextHeroBtn)) return nextHeroBtn;
            }
        }

        // 2c. Fast-path: Returning from sidebar to main content
        const sidebarContainer = document.getElementById('sidebar-container');
        if (sidebarContainer && sidebarContainer.contains(current) && !this.focusTrapContainer) {
            if (direction === 'right') {
                if (this.lastFocusedElement && this.getMainView()?.contains(this.lastFocusedElement) && this.isVisible(this.lastFocusedElement)) {
                    return this.lastFocusedElement;
                }
                const heroPlayBtn = document.getElementById('play-btn');
                if (heroPlayBtn && this.isVisible(heroPlayBtn)) return heroPlayBtn;
                const firstPoster = document.querySelector('.row-posters .poster-wrapper.focusable');
                if (firstPoster && this.isVisible(firstPoster)) return firstPoster;
            }
        }

        // 3. Candidate search for non-row layouts or vertical fallback
        let searchScope = scope;

        if (!this.focusTrapContainer && (direction === 'up' || direction === 'down')) {
            const mainView = this.getMainView();
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

            // Skip zero-dimension or detached elements immediately without layout thrashing
            if (elRect.width === 0 || elRect.height === 0) continue;

            // Direction pre-check using rects before math
            if (direction === 'left' && elRect.left >= rect.left) continue;
            if (direction === 'right' && elRect.right <= rect.right) continue;
            if (direction === 'up' && elRect.top >= rect.top) continue;
            if (direction === 'down' && elRect.bottom <= rect.bottom) continue;

            const elCenter = {
                x: elRect.left + elRect.width / 2,
                y: elRect.top + elRect.height / 2
            };

            dx = elCenter.x - center.x;
            dy = elCenter.y - center.y;

            let isPossible = false;
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

                // Only check expensive isVisible when candidate beats current best score
                if (score < minScore) {
                    if (this.isVisible(el)) {
                        minScore = score;
                        best = el;
                    }
                }
            }
        }

        return best;
    }
};
