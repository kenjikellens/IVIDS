import { SpatialNav } from './spatial-nav.js';

/**
 * UpdatePrompt Class
 * =================
 * Explanation:
 * This class coordinates the dynamic lifecycle of the premium, single-page application
 * update notification system in IVIDS. It builds a high-fidelity modal dialog programmatically,
 * injects it into the DOM body, and integrates natively with the SpatialNav navigation engine
 * to trap Smart TV remote (D-pad) inputs until the user actively decides to proceed or cancel.
 * It also processes background downloading and preparation events to animate a glassmorphic
 * green progress bar indicating active update status.
 */
export class UpdatePrompt {
    static modalElement = null;
    static previousFocus = null;
    static activeStatus = 'downloading';

    /**
     * init Method
     * -----------
     * Explanation:
     * Programmatically checks for and generates the HTML structure of the update notification dialog.
     * Appends it directly to the document body to bypass flex parent boundaries and flex z-index clipping.
     * Prevents double-initialization.
     */
    static init() {
        if (this.modalElement) return;

        this.modalElement = document.createElement('div');
        this.modalElement.id = 'update-modal';
        this.modalElement.className = 'update-modal';
        
        // Premium high-fidelity layout conforming to unified tokens
        this.modalElement.innerHTML = `
            <div class="update-content">
                <div class="update-icon-container">
                    <div class="update-icon-mask"></div>
                </div>
                <h1 class="update-title" id="update-title"></h1>
                <p class="update-message" id="update-message"></p>
                
                <!-- Live progress track container, hidden by default -->
                <div class="update-progress-container" id="update-progress-container">
                    <div class="update-progress-bar-bg">
                        <div class="update-progress-bar" id="update-progress-bar"></div>
                    </div>
                    <span class="update-progress-text" id="update-progress-text"></span>
                </div>
                
                <!-- Dialog focus action buttons -->
                <div class="update-actions" id="update-actions">
                    <button id="update-confirm-btn" class="update-btn update-btn-primary focusable"></button>
                    <button id="update-cancel-btn" class="update-btn update-btn-secondary focusable"></button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modalElement);
    }

    /**
     * show Method
     * -----------
     * Explanation:
     * Fades in the update dialog, maps all localized assets, blocks standard workspace interactions,
     * and redirects spatial keyboard/remote focus inside the dialog buttons.
     *
     * @param {string} version The release version string identified on the remote server.
     */
    static show(version) {
        // Initialize HTML if not already mounted
        this.init();

        // Remember what was previously focused to allow seamless recovery upon dismissal
        this.previousFocus = document.querySelector('.focused');

        const titleEl = document.getElementById('update-title');
        const messageEl = document.getElementById('update-message');
        const confirmBtn = document.getElementById('update-confirm-btn');
        const cancelBtn = document.getElementById('update-cancel-btn');
        const progressContainer = document.getElementById('update-progress-container');
        const actionsContainer = document.getElementById('update-actions');

        if (!titleEl || !messageEl || !confirmBtn || !cancelBtn) {
            console.error('UpdatePrompt: Required UI sub-elements not found.');
            return;
        }

        // Standardized translation keys map cleanly to prevent text rendering failures
        titleEl.textContent = window.i18n.t('settings.updateFound');
        messageEl.textContent = `${window.i18n.t('settings.updateFound')}: v${version}`;
        confirmBtn.textContent = window.i18n.t('settings.updateNow');
        cancelBtn.textContent = window.i18n.t('common.cancel');

        // Reset progress bar visibility and reset visual states
        progressContainer.style.display = 'none';
        actionsContainer.style.display = 'flex';
        confirmBtn.style.display = 'inline-flex';
        cancelBtn.style.display = 'inline-flex';

        // Render modal with display and active transition trigger
        this.modalElement.style.display = 'flex';
        setTimeout(() => {
            this.modalElement.classList.add('visible');
            
            // Trap spatial controls and center on first action button
            SpatialNav.setFocusTrap(this.modalElement);
            SpatialNav.setFocus(confirmBtn);
        }, 50);

        // Bind interactive event loops programmatically
        confirmBtn.onclick = () => {
            this.startDownload();
        };

        cancelBtn.onclick = () => {
            this.dismiss();
        };
    }

    /**
     * Programmatically initiates the update download process.
     * Delegates download actions to Native Android, Electron, or opens the fallback download URL in Web.
     */
    static startDownload() {
        const actionsContainer = document.getElementById('update-actions');
        const progressContainer = document.getElementById('update-progress-container');
        const progressBar = document.getElementById('update-progress-bar');
        const progressText = document.getElementById('update-progress-text');

        if (actionsContainer) actionsContainer.style.display = 'none';
        if (progressContainer) progressContainer.style.display = 'flex';
        if (progressBar) progressBar.style.width = '0%';
        
        this.activeStatus = 'downloading';
        
        if (window.AndroidUpdate) {
            if (progressText) {
                progressText.textContent = `${window.i18n.t('update_status_downloading')} (0%)`;
            }
            try {
                window.AndroidUpdate.downloadAndInstall();
            } catch (err) {
                console.error('UpdatePrompt: Failed to trigger native download', err);
                this.handleError();
            }
        } else if (window.ElectronAPI) {
            if (progressText) {
                progressText.textContent = `${window.i18n.t('update_status_downloading')} (0%)`;
            }
            // Electron handle download IPC
        } else if (window.latestUpdateDownloadUrl) {
            if (progressText) {
                progressText.textContent = window.i18n.t('update_status_downloading');
            }
            window.open(window.latestUpdateDownloadUrl, '_blank');
            this.dismiss();
        } else {
            console.warn('UpdatePrompt: No native bridge or update download link found.');
            this.handleError();
        }
    }

    /**
     * Captures status updates from the native update controller and translates the stage description.
     * @param {string} statusKey The native key representing the active compilation/download phase.
     */
    static handleStatus(statusKey) {
        this.activeStatus = statusKey;
        const progressText = document.getElementById('update-progress-text');
        if (!progressText) return;

        if (statusKey === 'downloading') {
            progressText.textContent = window.i18n.t('update_status_downloading');
        } else if (statusKey === 'installing') {
            progressText.textContent = window.i18n.t('update_status_installing');
        } else if (statusKey === 'connecting-api') {
            progressText.textContent = window.i18n.t('update_status_connecting');
        } else {
            progressText.textContent = statusKey;
        }
    }

    /**
     * Fills the primary progress track bar with glow adjustments based on native percentage events.
     * @param {number} percent Numerical percentage of completion (0 to 100).
     */
    static handleProgress(percent) {
        const progressBar = document.getElementById('update-progress-bar');
        const progressText = document.getElementById('update-progress-text');

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }

        if (progressText) {
            let statusStr = window.i18n.t('update_status_downloading');
            if (this.activeStatus === 'installing') {
                statusStr = window.i18n.t('update_status_installing');
            } else if (this.activeStatus === 'connecting-api') {
                statusStr = window.i18n.t('update_status_connecting');
            }
            progressText.textContent = `${statusStr} (${percent}%)`;
        }
    }

    /**
     * handleError Method
     * ------------------
     * Explanation:
     * Updates the status area to announce errors, stops progress listening, and displays the Cancel button
     * so that the user is not locked inside an unresolvable modal loop.
     */
    static handleError() {
        const progressText = document.getElementById('update-progress-text');
        const actionsContainer = document.getElementById('update-actions');
        const confirmBtn = document.getElementById('update-confirm-btn');
        const cancelBtn = document.getElementById('update-cancel-btn');

        if (progressText) {
            progressText.textContent = window.i18n.t('settings.updateError');
            progressText.style.color = '#ef4444'; // Red error warning tint
        }

        // Restore action containers so the user can easily dismiss or retry
        if (actionsContainer) actionsContainer.style.display = 'flex';
        if (confirmBtn) confirmBtn.style.display = 'none'; // Hide install button on error
        if (cancelBtn) {
            cancelBtn.style.display = 'inline-flex';
            SpatialNav.setFocus(cancelBtn);
        }
    }

    /**
     * dismiss Method
     * --------------
     * Explanation:
     * Closes the update prompt dialog, disables overlay visibility, clears keyboard focus trapping,
     * and shifts active navigation highlighting back to the underlying screen element.
     */
    static dismiss() {
        if (!this.modalElement) return;

        this.modalElement.classList.remove('visible');

        // Allow smooth CSS fade animation to complete before removing element layout visibility
        const cleanup = () => {
            this.modalElement.style.display = 'none';
            this.modalElement.removeEventListener('transitionend', cleanup);
        };
        this.modalElement.addEventListener('transitionend', cleanup);

        // Fallback cleanup timer
        setTimeout(() => {
            this.modalElement.style.display = 'none';
        }, 400);

        // Restore active focus back to the page
        SpatialNav.clearFocusTrap();
        if (this.previousFocus && document.body.contains(this.previousFocus)) {
            SpatialNav.setFocus(this.previousFocus);
        } else {
            SpatialNav.refocus();
        }
    }
}
