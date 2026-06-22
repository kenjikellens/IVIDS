import { SpatialNav } from './spatial-nav.js';
import { parseMarkdown } from './utils/markdown-parser.js';

/**
 * UpdatePrompt Class
 * =================
 * Coordinates the display and lifecycle of the update notification dialog modal.
 * Leverages the premium glassmorphic visual style of IVIDS Music and manages
 * SpatialNav focus transitions for Smart TV compatibility.
 */
export class UpdatePrompt {
    static modalElement = null;
    static previousFocus = null;
    static activeStatus = 'downloading';

    /**
     * Programmatically initializes the update notification overlay markup.
     * Appends the container to the document body to avoid layout clippings.
     */
    static init() {
        if (this.modalElement) return;

        this.modalElement = document.createElement('div');
        this.modalElement.id = 'update-overlay';
        this.modalElement.className = 'update-modal-overlay';
        
        this.modalElement.innerHTML = `
            <div class="update-modal">
                <div class="update-header">
                    <div class="update-icon-container">
                        <div class="update-icon-mask"></div>
                    </div>
                    <h2 class="update-title"></h2>
                </div>
                <div class="update-info-block">
                    <div class="version-badge-container">
                        <span class="version-badge current"></span>
                        <span class="version-arrow">→</span>
                        <span class="version-badge remote"></span>
                    </div>
                    <div class="update-release-name"></div>
                    <div class="update-changelog-title"></div>
                    <div class="update-changelog-body"></div>
                </div>
                <div class="update-progress-container" id="update-progress-container">
                    <div class="update-progress-bar-bg">
                        <div class="update-progress-bar" id="update-progress-bar"></div>
                    </div>
                    <span class="update-progress-text" id="update-progress-text"></span>
                </div>
                <div class="update-footer-actions" id="update-actions">
                    <button class="btn btn-secondary focusable" id="update-dismiss-btn"></button>
                    <button class="btn btn-primary focusable" id="update-download-btn"></button>
                </div>
            </div>
        `;

        document.body.appendChild(this.modalElement);
    }

    /**
     * Retrieves the localized string for a given key or returns the fallback value.
     * Uses the global i18n instance.
     * 
     * @param {string} key - Translation key.
     * @param {string} fallback - Fallback string if key is not defined.
     * @returns {string} The localized string.
     */
    static translate(key, fallback) {
        const val = window.i18n ? window.i18n.t(key) : fallback;
        return val === key ? fallback : val;
    }

    /**
     * Retrieves the current installed version of the application.
     * Checks native Android, Electron, and fallback endpoints.
     * 
     * @returns {Promise<string>} The version string (e.g. 'v0.4.1').
     */
    static async getLocalVersion() {
        if (window.AndroidUpdate && typeof window.AndroidUpdate.getCurrentVersion === 'function') {
            return window.AndroidUpdate.getCurrentVersion();
        }
        if (window.ElectronAPI && typeof window.ElectronAPI.getAppVersion === 'function') {
            try {
                const version = await window.ElectronAPI.getAppVersion();
                return version ? `v${version}` : 'v0.4.1';
            } catch (err) {
                console.error('UpdatePrompt: Failed to fetch Electron app version', err);
            }
        }
        try {
            const response = await fetch('/api/version');
            if (response.ok) {
                const data = await response.json();
                if (data && data.version) {
                    return `v${data.version}`;
                }
            }
        } catch (err) {}
        return 'v0.4.1';
    }

    /**
     * Shows the premium glassmorphic update modal dialog.
     * Restores/focuses the SpatialNav controls and loads the release changelog body.
     * 
     * @param {string} version - The version tag found on the remote server.
     * @returns {Promise<void>}
     */
    static async show(version) {
        // Initialize HTML if not already mounted
        this.init();

        // Remember what was previously focused to allow seamless recovery upon dismissal
        this.previousFocus = document.querySelector('.focused');

        // Fetch release changelog
        let release = window.latestRelease;
        if (!release || release.tag_name !== version) {
            try {
                const response = await fetch('https://api.github.com/repos/kenjikellens/IVIDS/releases/latest');
                if (response.ok) {
                    release = await response.json();
                }
            } catch (e) {
                console.error('UpdatePrompt: Failed to fetch release details', e);
            }
        }

        if (!release || release.tag_name !== version) {
            release = {
                tag_name: version,
                name: `Release ${version}`,
                body: 'Performance and stability improvements.'
            };
        }

        const currentVer = await this.getLocalVersion();

        const titleEl = this.modalElement.querySelector('.update-title');
        const releaseNameEl = this.modalElement.querySelector('.update-release-name');
        const currentBadgeEl = this.modalElement.querySelector('.version-badge.current');
        const remoteBadgeEl = this.modalElement.querySelector('.version-badge.remote');
        const changelogTitleEl = this.modalElement.querySelector('.update-changelog-title');
        const changelogBodyEl = this.modalElement.querySelector('.update-changelog-body');
        const confirmBtn = document.getElementById('update-download-btn');
        const dismissBtn = document.getElementById('update-dismiss-btn');
        const progressContainer = document.getElementById('update-progress-container');
        const actionsContainer = document.getElementById('update-actions');

        if (!titleEl || !confirmBtn || !dismissBtn) {
            console.error('UpdatePrompt: Required UI sub-elements not found.');
            return;
        }

        // Format raw markdown bodies using the markdown parser
        const parsedBody = release.body 
            ? parseMarkdown(release.body) 
            : '<p>Performance and core interface enhancements.</p>';

        titleEl.textContent = this.translate('settings.updateNotification', 'New Version Available!');
        changelogTitleEl.textContent = this.translate('settings.whatsNew', "What's New:");
        dismissBtn.textContent = this.translate('settings.later', 'Later');
        confirmBtn.textContent = this.translate('settings.updateNow', 'Install Now');
        
        currentBadgeEl.textContent = currentVer;
        remoteBadgeEl.textContent = release.tag_name;
        releaseNameEl.textContent = release.name || 'Prerelease Update';
        changelogBodyEl.innerHTML = parsedBody;

        // Reset progress bar visibility and reset visual states
        progressContainer.style.display = 'none';
        actionsContainer.style.display = 'flex';
        confirmBtn.style.display = 'inline-flex';
        dismissBtn.style.display = 'inline-flex';

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

        dismissBtn.onclick = () => {
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
                progressText.textContent = `${this.translate('update_status_downloading', 'Downloading Update...')} (0%)`;
            }
            try {
                if (window.latestUpdateDownloadUrl) {
                    window.AndroidUpdate.downloadAndInstallForUrl(window.latestUpdateDownloadUrl);
                } else {
                    window.AndroidUpdate.downloadAndInstall();
                }
            } catch (err) {
                console.error('UpdatePrompt: Failed to trigger native download', err);
                this.handleError();
            }
        } else if (window.ElectronAPI) {
            if (progressText) {
                progressText.textContent = `${this.translate('update_status_downloading', 'Downloading Update...')} (0%)`;
            }
            try {
                // Register progress listener from preload bridge
                const unsubscribe = window.ElectronAPI.onUpdateProgress((percent) => {
                    this.handleProgress(percent);
                });

                const downloadUrl = window.latestUpdateDownloadUrl;
                const version = window.latestUpdateVersion;

                window.ElectronAPI.downloadPcUpdate(downloadUrl, version)
                    .then((result) => {
                        unsubscribe();
                        if (result && result.status === 'downloaded') {
                            this.handleStatus('installing');
                            if (progressText) {
                                progressText.textContent = this.translate('update_status_installing', 'Installing Update...');
                            }
                            // Trigger installer execution on main process
                            window.ElectronAPI.installPcUpdate(result.filePath).catch(err => {
                                console.error('UpdatePrompt: Failed to install PC update', err);
                                this.handleError();
                            });
                        } else {
                            throw new Error(result ? result.message : 'Download failed');
                        }
                    })
                    .catch((err) => {
                        unsubscribe();
                        console.error('UpdatePrompt: Failed to download PC update', err);
                        this.handleError();
                    });
            } catch (err) {
                console.error('UpdatePrompt: Failed to initialize Electron download', err);
                this.handleError();
            }
        } else if (window.latestUpdateDownloadUrl) {
            if (progressText) {
                progressText.textContent = this.translate('update_status_downloading', 'Downloading Update...');
            }
            window.open(window.latestUpdateDownloadUrl, '_blank');
            this.dismiss();
        } else {
            console.warn('UpdatePrompt: No native bridge or update download link found.');
            this.handleError();
        }
    }

    /**
     * Translates status updates from the native update controller.
     * Affects the progress text element.
     * 
     * @param {string} statusKey - The status key representing the active download/installation phase.
     */
    static handleStatus(statusKey) {
        this.activeStatus = statusKey;
        const progressText = document.getElementById('update-progress-text');
        if (!progressText) return;

        if (statusKey === 'downloading') {
            progressText.textContent = this.translate('update_status_downloading', 'Downloading Update...');
        } else if (statusKey === 'installing') {
            progressText.textContent = this.translate('update_status_installing', 'Installing Update...');
        } else if (statusKey === 'connecting-api') {
            progressText.textContent = this.translate('update_status_connecting', 'Connecting to Server...');
        } else {
            progressText.textContent = statusKey;
        }
    }

    /**
     * Updates the progress bar and status text percentage display.
     * Affects the width of the progress bar fill and text content.
     * 
     * @param {number} percent - The percentage completed (0 to 100).
     */
    static handleProgress(percent) {
        const progressBar = document.getElementById('update-progress-bar');
        const progressText = document.getElementById('update-progress-text');

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }

        if (progressText) {
            let statusStr = this.translate('update_status_downloading', 'Downloading Update...');
            if (this.activeStatus === 'installing') {
                statusStr = this.translate('update_status_installing', 'Installing Update...');
            } else if (this.activeStatus === 'connecting-api') {
                statusStr = this.translate('update_status_connecting', 'Connecting to Server...');
            }
            progressText.textContent = `${statusStr} (${percent}%)`;
        }
    }

    /**
     * Updates the progress area with error warnings and restores close controls.
     * Affects progress text style and action button visibility.
     */
    static handleError() {
        const progressText = document.getElementById('update-progress-text');
        const actionsContainer = document.getElementById('update-actions');
        const confirmBtn = document.getElementById('update-download-btn');
        const dismissBtn = document.getElementById('update-dismiss-btn');

        if (progressText) {
            progressText.textContent = this.translate('settings.updateError', 'Update failed. Please check connection and try again.');
            progressText.style.color = '#ef4444'; // Red error warning color tint
        }

        // Restore action buttons so the user can retry or dismiss
        if (actionsContainer) actionsContainer.style.display = 'flex';
        if (confirmBtn) confirmBtn.style.display = 'none'; // Hide download/install button on error
        if (dismissBtn) {
            dismissBtn.style.display = 'inline-flex';
            SpatialNav.setFocus(dismissBtn);
        }
    }

    /**
     * Closes the update modal dialog and restores navigation focus trap.
     * Affects overlay element visibility and focus state of SpatialNav.
     */
    static dismiss() {
        if (!this.modalElement) return;

        this.modalElement.classList.remove('visible');

        // Allow smooth fade-out CSS transition before hiding the element
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
