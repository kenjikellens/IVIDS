/**
 * Default configuration constants for Toast notifications.
 */
const CONFIG = {
    DEFAULT_DURATION: 5000,       // Default display duration for the toast (ms)
    HIDE_TRANSITION_DELAY: 600    // Animation transition removal delay (ms)
};

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
     * Enqueues or displays a toast notification in the designated screen position.
     * Configures the DOM element synchronously to return it to callers, but defers display if max limit is reached.
     * @param {string} message - Content message string (or HTML if options.isHtml is true).
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

        if (!this.containers[position]) this.init(position);

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        // Dynamic Icon generation based on type
        let iconHtml = '';
        if (type === 'error' || type === 'warning') {
            iconHtml = '<div class="toast-icon-mask" style="--icon-url: url(\'images/disconnected.svg\')"></div>';
        } else if (type === 'info') {
            iconHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
        } else {
            iconHtml = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        }

        toast.innerHTML = `
            <div class="toast-icon">${iconHtml}</div>
            <div class="toast-content">
                ${title ? `<h4 class="toast-title"></h4>` : ''}
                <p class="toast-message"></p>
            </div>
        `;

        if (title) {
            const titleEl = toast.querySelector('.toast-title');
            if (titleEl) titleEl.textContent = title;
        }
        const messageEl = toast.querySelector('.toast-message');
        if (messageEl) {
            if (options.isHtml) {
                messageEl.innerHTML = message;
            } else {
                messageEl.textContent = message;
            }
        }

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

        const wifiArches = `
            <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
            <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
        `;

        if (state === 'lost') {
            this.element.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-blink-icon">
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    ${wifiArches}
                    <line x1="12" y1="20" x2="12.01" y2="20" stroke-width="4"></line>
                </svg>
            `;
            this.element.classList.add('lost', 'visible');
        } else if (state === 'slow') {
            this.element.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="toast-blink-icon">
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    ${wifiArches}
                    <line x1="12" y1="20" x2="12.01" y2="20" stroke-width="4"></line>
                </svg>
            `;
            this.element.classList.add('slow', 'visible');
        } else if (state === 'connected') {
            this.element.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    ${wifiArches}
                    <line x1="12" y1="20" x2="12.01" y2="20" stroke-width="4"></line>
                    <polyline points="17 19 19 21 23 17"></polyline>
                </svg>
            `;
            this.element.classList.add('connected', 'visible');

            this.connectedTimeout = setTimeout(() => {
                this.element.classList.remove('visible');
            }, 3000);
        }
    }
}
