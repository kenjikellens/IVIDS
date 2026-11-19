/**
 * Default configuration constants for Toast notifications.
 */
const CONFIG = {
    DEFAULT_DURATION: 5000,       // Default display duration for the toast (ms)
    HIDE_TRANSITION_DELAY: 600    // Animation transition removal delay (ms)
};

const ALLOWED_TOAST_TAGS = new Set(['SPAN', 'DIV', 'BUTTON', 'P', 'B', 'I', 'STRONG', 'EM', 'BR', 'SMALL']);
const DROPPED_TOAST_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'SVG', 'OBJECT', 'EMBED', 'NOSCRIPT', 'TEMPLATE']);
const ALLOWED_TOAST_ATTRS = new Set(['class', 'id', 'type', 'data-i18n']);

/**
 * Toast Notification Utility
 * Provides non-intrusive queued feedback in the corner of the screen.
 */
export class Toast {
    static containers = {};
    static activeToasts = [];
    static queue = [];
    static MAX_ACTIVE = 3;

    /**
     * Initializes the toast container container elements in the DOM.
     * Appends a container div to the document body to group toast notifications.
     * @param {string} position - Position name for layout alignment.
     */
    static init(position = 'bottom-right') {
        if (this.containers[position]) return;

        const container = document.createElement('div');
        container.className = `toast-container ${position}`;
        document.body.appendChild(container);
        this.containers[position] = container;
    }

    /**
     * Sanitizes optional HTML toast markup using a strict tag and attribute allowlist.
     * Preserves safe action elements (e.g., update buttons) while stripping scripts, SVGs, and event handlers.
     * @param {string} rawHtml - Candidate HTML string for toast body rendering.
     * @returns {DocumentFragment} Sanitized DOM fragment ready for safe insertion.
     */
    static sanitizeToastHtml(rawHtml) {
        const fragment = document.createDocumentFragment();
        if (typeof document === 'undefined') {
            return fragment;
        }
        const template = document.createElement('template');
        template.innerHTML = rawHtml === null || rawHtml === undefined ? '' : String(rawHtml);

        const sanitizeNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                return document.createTextNode(node.textContent || '');
            }
            if (node.nodeType !== Node.ELEMENT_NODE) {
                return null;
            }
            const tagName = node.tagName.toUpperCase();
            if (DROPPED_TOAST_TAGS.has(tagName)) {
                return null;
            }
            if (!ALLOWED_TOAST_TAGS.has(tagName)) {
                return document.createTextNode(node.textContent || '');
            }
            const cleanEl = document.createElement(tagName.toLowerCase());
            for (const attr of Array.from(node.attributes)) {
                const attrName = attr.name.toLowerCase();
                if (ALLOWED_TOAST_ATTRS.has(attrName)) {
                    cleanEl.setAttribute(attrName, attr.value);
                }
            }
            for (const child of Array.from(node.childNodes)) {
                const cleanChild = sanitizeNode(child);
                if (cleanChild) {
                    cleanEl.appendChild(cleanChild);
                }
            }
            return cleanEl;
        };

        for (const child of Array.from(template.content.childNodes)) {
            const cleanChild = sanitizeNode(child);
            if (cleanChild) {
                fragment.appendChild(cleanChild);
            }
        }
        return fragment;
    }

    /**
     * Enqueues or displays a toast notification in the designated screen position.
     * Configures the DOM element synchronously to return it to callers, but defers display if max limit is reached.
     * @param {string} message - Content message string (or sanitized HTML if options.isHtml is true).
     * @param {object} options - Custom render settings including title and duration.
     * @returns {HTMLElement} The created toast element.
     */
    static show(message, options = {}) {
        const {
            title = '',
            type = 'success',
            duration = CONFIG.DEFAULT_DURATION,
            position = 'bottom-right'
        } = options;
        const safeType = String(type || 'success').replace(/[^a-zA-Z0-9_-]/g, '') || 'success';

        if (!this.containers[position]) this.init(position);

        const toast = document.createElement('div');
        toast.className = `toast toast-${safeType}`;
        toast.setAttribute('role', safeType === 'error' ? 'alert' : 'status');
        toast.setAttribute('aria-live', safeType === 'error' ? 'assertive' : 'polite');

        // Dynamic Icon generation via CSS-masked external SVG assets
        const iconHtml = '<div class="toast-icon-mask" aria-hidden="true"></div>';

        toast.innerHTML = `
            <div class="toast-icon">${iconHtml}</div>
            <div class="toast-content">
                ${title ? `<h4 class="toast-title"></h4>` : ''}
                <p class="toast-message"></p>
            </div>
        `;

        if (title) {
            const titleEl = toast.querySelector('.toast-title');
            if (titleEl) titleEl.textContent = String(title);
        }
        const messageEl = toast.querySelector('.toast-message');
        if (messageEl) {
            if (options.isHtml) {
                messageEl.replaceChildren(this.sanitizeToastHtml(message));
            } else {
                messageEl.textContent = message === null || message === undefined ? '' : String(message);
            }
        }

        // Attach touch swipe-up listener to allow touch dismissal by swiping up
        let startY = 0;
        toast.addEventListener('touchstart', (e) => {
            if (e.touches && e.touches.length === 1) {
                startY = e.touches[0].clientY;
            }
        }, { passive: true });

        toast.addEventListener('touchend', (e) => {
            if (e.changedTouches && e.changedTouches.length === 1) {
                const endY = e.changedTouches[0].clientY;
                if (startY - endY > 25) {
                    Toast.hide(toast);
                }
            }
        }, { passive: true });

        // Push to display queue
        this.queue.push({
            element: toast,
            position: position,
            duration: duration,
            timeoutId: null
        });

        // Trigger queue processor
        this.processQueue();

        return toast;
    }

    /**
     * Processes the pending toast queue.
     * Appends queued toast elements to their containers if the active count is below the maximum limit.
     */
    static processQueue() {
        while (this.activeToasts.length < this.MAX_ACTIVE && this.queue.length > 0) {
            const item = this.queue.shift();
            const container = this.containers[item.position];

            container.appendChild(item.element);
            this.activeToasts.push(item);

            // Trigger animation
            requestAnimationFrame(() => {
                item.element.classList.add('visible');
            });

            // Auto-hide
            if (item.duration > 0) {
                item.timeoutId = setTimeout(() => this.hide(item.element), item.duration);
            }
        }
    }

    /**
     * Hides the toast notification with a fade-out animation.
     * Removes the element from the DOM and active tracker, then processes the next queued item.
     * @param {HTMLElement} toast - The toast element to hide.
     */
    static hide(toast) {
        if (!toast) return;

        // Check if it's still in the queue (never got displayed yet)
        const queueIndex = this.queue.findIndex(item => item.element === toast);
        if (queueIndex !== -1) {
            this.queue.splice(queueIndex, 1);
            return;
        }

        // Remove from active toasts list
        const activeIndex = this.activeToasts.findIndex(item => item.element === toast);
        if (activeIndex !== -1) {
            const item = this.activeToasts[activeIndex];
            if (item.timeoutId) {
                clearTimeout(item.timeoutId);
            }
            this.activeToasts.splice(activeIndex, 1);
        }

        toast.classList.remove('visible');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            // Trigger processing of next toasts
            this.processQueue();
        }, CONFIG.HIDE_TRANSITION_DELAY);
    }
}

/**
 * Dedicated Floating Network Connectivity Status Overlay
 * Provides minimalist status icons on top of toasts for offline/slow connections.
 */
export class NetworkStatusOverlay {
    static element = null;
    static connectedTimeout = null;

    /**
     * Initializes the network status overlay element in the DOM.
     * Creates and appends the overlay div to the document body if it does not already exist.
     */
    static init() {
        if (this.element) return;
        this.element = document.createElement('div');
        this.element.id = 'network-status-overlay';
        this.element.className = 'network-status-overlay';
        document.body.appendChild(this.element);
    }

    /**
     * Renders the specified network state icon inside the floating overlay.
     * Toggles visibility instantly and sets up self-dismissing timeouts for restored states.
     * @param {string} state - The network status name ('connected', 'slow', 'lost').
     */
    static show(state) {
        this.init();

        if (this.connectedTimeout) {
            clearTimeout(this.connectedTimeout);
            this.connectedTimeout = null;
        }

        this.element.className = 'network-status-overlay'; // Reset styles

        if (state === 'lost') {
            this.element.innerHTML = '<div class="network-status-icon toast-blink-icon" aria-hidden="true"></div>';
            this.element.classList.add('lost', 'visible');
        } else if (state === 'slow') {
            this.element.innerHTML = '<div class="network-status-icon toast-blink-icon" aria-hidden="true"></div>';
            this.element.classList.add('slow', 'visible');
        } else if (state === 'connected') {
            this.element.innerHTML = '<div class="network-status-icon" aria-hidden="true"></div>';
            this.element.classList.add('connected', 'visible');

            this.connectedTimeout = setTimeout(() => {
                this.element.classList.remove('visible');
            }, 3000);
        }
    }
}
