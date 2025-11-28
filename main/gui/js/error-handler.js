import { SpatialNav } from './spatial-nav.js';
import I18n from './i18n.js';

export class ErrorHandler {
    static init() {
        // Create the modal container if it doesn't exist
        if (!document.getElementById('error-modal')) {
            const modal = document.createElement('div');
            modal.id = 'error-modal';
            modal.className = 'error-modal';
            modal.style.display = 'none';
            modal.innerHTML = `
                <div class="error-content">
                    <h2 id="error-title" class="error-title">Error</h2>
                    <p id="error-message" class="error-message"></p>
                    <div class="error-actions">
                        <button id="error-retry-btn" class="btn btn-primary focusable">Retry</button>
                        <button id="error-close-btn" class="btn btn-secondary focusable">Close</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            // Bind events
            document.getElementById('error-close-btn').addEventListener('click', () => ErrorHandler.hide());
        }
    }

    static show(message, retryCallback = null, title = null) {
        const modal = document.getElementById('error-modal');
        const titleEl = document.getElementById('error-title');
        const messageEl = document.getElementById('error-message');
        const retryBtn = document.getElementById('error-retry-btn');
        const closeBtn = document.getElementById('error-close-btn');

        if (!modal) {
            console.error('Error modal not initialized');
            alert(message); // Fallback
            return;
        }

        titleEl.textContent = title || I18n.t('error.defaultTitle') || 'Error';
        messageEl.textContent = message || I18n.t('error.defaultMessage') || 'An unexpected error occurred.';

        if (retryCallback) {
            retryBtn.style.display = 'inline-block';
            retryBtn.onclick = () => {
                ErrorHandler.hide();
                retryCallback();
            };
            // Focus retry button by default
            setTimeout(() => SpatialNav.setFocus(retryBtn), 100);
        } else {
            retryBtn.style.display = 'none';
            // Focus close button
            setTimeout(() => SpatialNav.setFocus(closeBtn), 100);
        }

        modal.style.display = 'flex';
    }

    static hide() {
        const modal = document.getElementById('error-modal');
        if (modal) {
            modal.style.display = 'none';
            // Refocus on the previous element or default
            SpatialNav.refocus();
        }
    }
}
