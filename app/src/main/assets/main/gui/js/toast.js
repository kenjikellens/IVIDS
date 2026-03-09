/**
 * Toast Notification Utility
 * Provides non-intrusive feedback in the corner of the screen.
 */
export class Toast {
    static containers = {};

    static init(position = 'bottom-right') {
        if (this.containers[position]) return;

        const container = document.createElement('div');
        container.className = `toast-container ${position}`;
        document.body.appendChild(container);
        this.containers[position] = container;
    }

    /**
     * Show a toast message
     * @param {string} message - Message to display
     * @param {Object} options - title, type (info, error, warning, success), duration, position
     */
    static show(message, options = {}) {
        const {
            title = '',
            type = 'success',
            duration = 5000,
            position = 'bottom-right'
        } = options;

        if (!this.containers[position]) this.init(position);
        const container = this.containers[position];

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
                ${title ? `<h4 class="toast-title">${title}</h4>` : ''}
                <p class="toast-message">${message}</p>
            </div>
        `;

        container.appendChild(toast);

        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('visible');
        });

        // Auto-hide
        if (duration > 0) {
            setTimeout(() => this.hide(toast), duration);
        }

        return toast;
    }

    static hide(toast) {
        if (!toast) return;
        toast.classList.remove('visible');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 600);
    }
}
