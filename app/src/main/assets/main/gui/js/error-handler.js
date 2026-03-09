import { SpatialNav } from './spatial-nav.js';
import I18n from './i18n.js';

export class ErrorHandler {
    static init() {
        try {
            // Global error handlers
            window.onerror = (message, source, lineno, colno, error) => {
                console.error('Global Error caught:', message, error);
                ErrorHandler.show(message || 'Uncaught Error');
            };

            window.onunhandledrejection = (event) => {
                console.error('Unhandled Promise Rejection:', event.reason);
                ErrorHandler.show(event.reason?.message || event.reason || 'Async Error');
            };

            // Create the modal container if it doesn't exist
            if (!document.getElementById('error-modal')) {
                const modal = document.createElement('div');
                modal.id = 'error-modal';
                modal.className = 'error-modal';
                modal.innerHTML = `
                    <div class="error-content">
                        <div class="error-icon-container">
                            <div class="error-icon-mask"></div>
                        </div>
                        <h2 id="error-title" class="error-title">Error</h2>
                        <div class="error-message-container">
                            <p id="error-message" class="error-message"></p>
                        </div>
                        <div class="error-actions">
                            <button id="error-retry-btn" class="error-btn error-btn-primary focusable">Retry</button>
                            <button id="error-close-btn" class="error-btn error-btn-secondary focusable">Close</button>
                        </div>
                    </div>
                `;
                if (document.body) {
                    document.body.appendChild(modal);
                } else {
                    console.error('document.body not ready for ErrorHandler');
                    return;
                }

                // Bind generic close event
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

            // Force Splash Dismissal if active
            const splash = document.getElementById('splash-screen');
            if (splash && !splash.classList.contains('hidden')) {
                splash.classList.add('hidden');
                setTimeout(() => splash.style.display = 'none', 500);
            }

            // Safe I18n access
            const defaultTitle = (I18n && typeof I18n.t === 'function') ? I18n.t('error.defaultTitle') : 'Ooops!';
            const defaultMessage = (I18n && typeof I18n.t === 'function') ? I18n.t('error.defaultMessage') : 'Something went wrong. Please try again.';

            if (titleEl) titleEl.textContent = title || defaultTitle;
            if (messageEl) messageEl.textContent = message || defaultMessage;

            // Configure Buttons
            if (retryCallback) {
                if (retryBtn) {
                    retryBtn.style.display = 'inline-block';
                    // Remove old listeners to avoid stacking
                    const newRetryBtn = retryBtn.cloneNode(true);
                    retryBtn.parentNode.replaceChild(newRetryBtn, retryBtn);

                    newRetryBtn.onclick = () => {
                        ErrorHandler.hide();
                        try {
                            retryCallback();
                        } catch (cbError) {
                            console.error('Error in retry callback:', cbError);
                        }
                    };

                    // Handle focus based on device/available tools
                    setTimeout(() => {
                        if (SpatialNav && typeof SpatialNav.setFocus === 'function') {
                            SpatialNav.setFocus(newRetryBtn);
                        } else {
                            newRetryBtn.focus();
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

            // Show with animation class
            modal.style.display = 'flex';
            requestAnimationFrame(() => {
                modal.classList.add('visible');
            });

        } catch (e) {
            console.error('Error showing ErrorHandler:', e);
            alert(message); // Ultimate fallback
        }
    }

    static hide() {
        try {
            const modal = document.getElementById('error-modal');
            if (modal) {
                modal.classList.remove('visible');

                // Wait for transition to finish
                setTimeout(() => {
                    modal.style.display = 'none';
                    // Refocus on the previous element or default
                    if (SpatialNav && typeof SpatialNav.refocus === 'function') {
                        SpatialNav.refocus();
                    }
                }, 400); // Matches CSS transition duration
            }
        } catch (e) {
            console.error('Error hiding ErrorHandler:', e);
        }
    }
}
