import { SpatialNav } from './spatial-nav.js';
import I18n from './i18n.js';

export class ErrorHandler {
    static init() {
        try {
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
                if (document.body) {
                    document.body.appendChild(modal);
                } else {
                    console.error('document.body not ready for ErrorHandler');
                    return;
                }

                // Bind events
                const closeBtn = document.getElementById('error-close-btn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => ErrorHandler.hide());
                }
            }
        } catch (e) {
            console.error('Failed to initialize ErrorHandler:', e);
        }
    }

    static show(message, retryCallback = null, title = null) {
        try {
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

            // Safe I18n access
            const defaultTitle = (I18n && typeof I18n.t === 'function') ? I18n.t('error.defaultTitle') : 'Error';
            const defaultMessage = (I18n && typeof I18n.t === 'function') ? I18n.t('error.defaultMessage') : 'An unexpected error occurred.';

            if (titleEl) titleEl.textContent = title || defaultTitle;
            if (messageEl) messageEl.textContent = message || defaultMessage;

            if (retryCallback) {
                if (retryBtn) {
                    retryBtn.style.display = 'inline-block';
                    retryBtn.onclick = () => {
                        ErrorHandler.hide();
                        try {
                            retryCallback();
                        } catch (cbError) {
                            console.error('Error in retry callback:', cbError);
                        }
                    };
                    // Focus retry button by default
                    setTimeout(() => {
                        if (SpatialNav && typeof SpatialNav.setFocus === 'function') {
                            SpatialNav.setFocus(retryBtn);
                        } else {
                            retryBtn.focus();
                        }
                    }, 100);
                }
            } else {
                if (retryBtn) retryBtn.style.display = 'none';
                // Focus close button
                setTimeout(() => {
                    if (closeBtn) {
                        if (SpatialNav && typeof SpatialNav.setFocus === 'function') {
                            SpatialNav.setFocus(closeBtn);
                        } else {
                            closeBtn.focus();
                        }
                    }
                }, 100);
            }

            modal.style.display = 'flex';
        } catch (e) {
            console.error('Error showing ErrorHandler:', e);
            alert(message); // Ultimate fallback
        }
    }

    static hide() {
        try {
            const modal = document.getElementById('error-modal');
            if (modal) {
                modal.style.display = 'none';
                // Refocus on the previous element or default
                if (SpatialNav && typeof SpatialNav.refocus === 'function') {
                    SpatialNav.refocus();
                }
            }
        } catch (e) {
            console.error('Error hiding ErrorHandler:', e);
        }
    }
}
