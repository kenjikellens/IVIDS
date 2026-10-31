import { SpatialNav } from './spatial-nav.js';
import { parseMarkdown } from './utils/markdown-parser.js';
import { VersionManager } from './version-manager.js';

/**
 * UpdatePrompt Class
 * =================
 * Coordinates the display and lifecycle of the update notification dialog modal.
 * Leverages the premium glassmorphic visual style of IVIDS Music and manages
 * SpatialNav focus transitions for Smart TV compatibility.
 */
export class UpdatePrompt {
    static modalElement = null;
    static changelogModalElement = null;
    static previousFocus = null;
    static activeStatus = 'downloading';

    /**
     * Programmatically initializes the update notification overlay and dedicated changelog modal markup.
     * Appends containers to document body to avoid layout clippings.
     */
    static init() {
        if (!this.modalElement) {
            this.modalElement = document.createElement('div');
            this.modalElement.id = 'update-overlay';
            this.modalElement.className = 'modal update-modal-overlay';
            this.modalElement.style.zIndex = '100000';
            
            this.modalElement.innerHTML = `
                <div class="modal__dialog modal__dialog--lg update-modal">
                    <div class="modal__header update-header">
                        <div class="update-icon-container">
                            <div class="update-icon-mask"></div>
                        </div>
                        <h2 class="modal__title update-title"></h2>
                    </div>
                    <div class="modal__body modal__body--scroll update-info-block">
                        <div class="version-badge-container">
                            <span class="badge badge--outline version-badge current"></span>
                            <span class="version-arrow">→</span>
                            <span class="badge badge--outline version-badge remote"></span>
                        </div>
                        <div class="update-branch-section">
                            <div class="update-branch-title"></div>
                            <div class="update-release-name"></div>
                        </div>
                        <div id="update-experimental-warning" class="update-experimental-warning" style="display: none;">
                            <span class="warning-icon">⚠️</span>
                            <div class="warning-content">
                                <span class="warning-title"></span>
                                <p class="warning-text"></p>
                            </div>
                        </div>
                        <div class="update-more-info-container" id="update-more-info-container">
                            <button id="update-more-info-btn" class="btn btn--secondary btn--block focusable universal-onclick" type="button">
                                <span>Meer informatie</span>
                            </button>
                        </div>
                    </div>
                    <div class="update-progress-container" id="update-progress-container">
                        <div class="update-progress-bar-bg">
                            <div class="update-progress-bar" id="update-progress-bar"></div>
                        </div>
                        <span class="update-progress-text" id="update-progress-text"></span>
                    </div>
                    <div class="modal__footer update-footer-actions btn-group btn-group--fill" id="update-actions">
                        <button class="btn btn--secondary focusable" id="update-dismiss-btn"></button>
                        <button class="btn btn--primary focusable" id="update-download-btn"></button>
                    </div>
                </div>
            `;
            document.body.appendChild(this.modalElement);
        }

        if (!this.changelogModalElement) {
            this.changelogModalElement = document.createElement('div');
            this.changelogModalElement.id = 'update-changelog-modal';
            this.changelogModalElement.className = 'modal update-changelog-modal-overlay';
            this.changelogModalElement.style.cssText = 'display: none; z-index: 100005;';
            this.changelogModalElement.innerHTML = `
                <div class="modal__dialog modal__dialog--lg">
                    <button id="update-changelog-back-btn" class="modal__back-btn btn btn--ghost btn--circle focusable universal-onclick" aria-label="Back" type="button">
                        <img src="images/back.svg" class="modal-back-icon" alt="Back">
                    </button>
                    <h2 id="update-changelog-modal-title" class="modal__title"></h2>
                    <div class="modal__body modal__body--scroll update-changelog-scroll">
                        <div id="update-changelog-modal-content" class="markdown-body"></div>
                    </div>
                    <div class="modal__footer modal__footer--center">
                        <button id="update-changelog-close-btn" class="btn btn--secondary focusable universal-onclick" type="button"></button>
                    </div>
                </div>
            `;
            document.body.appendChild(this.changelogModalElement);
        }
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
     * Delegates to centralized VersionManager service.
     * 
     * @returns {Promise<string>} The version string (e.g. 'v0.6.2').
     */
    static async getLocalVersion() {
        return VersionManager.getInstance().getVersion();
    }

    /**
     * Shows the premium update modal dialog and populates the release info.
     * Restores/focuses the SpatialNav controls and sets up the release changelog modal.
     * 
     * @param {string} version - The version tag found on the remote server.
     * @param {HTMLElement} [returnFocusElement] - Explicit element to receive focus when update prompt is dismissed.
     * @param {Object} [options={}] - Optional parameters such as isManualSelection and isBranch flags.
     * @returns {Promise<void>}
     */
    static async show(version, returnFocusElement = null, options = {}) {
        this.init();

        // Ensure version selector or any open modal overlay is completely hidden so modals are never stacked
        const openModals = document.querySelectorAll('.modal.is-open, .modal.show, #version-selector-modal');
        openModals.forEach(m => {
            if (m.id !== 'update-overlay' && m.id !== 'update-changelog-modal') {
                m.classList.remove('show', 'is-open', 'active');
                m.style.setProperty('display', 'none', 'important');
                m.style.setProperty('visibility', 'hidden', 'important');
            }
        });

        // Remember what was previously focused to allow seamless recovery upon dismissal
        const currentFocused = document.querySelector('.focused');
        const fallbackBtn = document.getElementById('check-updates-btn');
        this.previousFocus = returnFocusElement || (currentFocused && SpatialNav.isVisible(currentFocused) ? currentFocused : fallbackBtn);

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
        const branchTitleEl = this.modalElement.querySelector('.update-branch-title');
        const releaseNameEl = this.modalElement.querySelector('.update-release-name');
        const currentBadgeEl = this.modalElement.querySelector('.version-badge.current');
        const remoteBadgeEl = this.modalElement.querySelector('.version-badge.remote');
        const confirmBtn = document.getElementById('update-download-btn');
        const dismissBtn = document.getElementById('update-dismiss-btn');
        const progressContainer = document.getElementById('update-progress-container');
        const progressText = document.getElementById('update-progress-text');
        const actionsContainer = document.getElementById('update-actions');

        if (!titleEl || !confirmBtn || !dismissBtn) {
            console.error('UpdatePrompt: Required UI sub-elements not found.');
            return;
        }

        // Format raw markdown bodies using the markdown parser
        const parsedBody = release.body 
            ? parseMarkdown(release.body) 
            : '<p>Performance and core interface enhancements.</p>';

        const isBranch = version === 'Branch' || (release && release.tag_name === 'Branch') || (options && options.isBranch);
        const isManual = (options && options.isManualSelection) || isBranch;

        const warningBox = this.modalElement.querySelector('#update-experimental-warning');
        if (warningBox) {
            if (isBranch) {
                const wTitle = warningBox.querySelector('.warning-title');
                const wText = warningBox.querySelector('.warning-text');
                if (wTitle) wTitle.textContent = this.translate('settings.branchWarningTitle', 'Experimentele Ontwikkelingsversie');
                if (wText) wText.textContent = this.translate('settings.branchWarningDesc', "Let op: Dit is een live ontwikkelingsversie rechtstreeks vanaf de 'main' branch. Deze build kan onstabiel zijn of onvoltooide functies bevatten.");
                warningBox.style.display = 'flex';
            } else {
                warningBox.style.display = 'none';
            }
        }

        if (isBranch) {
            titleEl.textContent = this.translate('settings.branchBuild', 'Live Branch Build');
        } else if (isManual) {
            titleEl.textContent = `${this.translate('settings.installVersionTitle', 'Versie')} ${version} ${this.translate('common.install', 'installeren')}`;
        } else {
            titleEl.textContent = this.translate('settings.updateNotification', 'New Version Available!');
        }
        if (branchTitleEl) {
            branchTitleEl.textContent = this.translate('settings.branch', 'Branch');
        }
        dismissBtn.textContent = isManual ? this.translate('common.cancel', 'Annuleren') : this.translate('settings.later', 'Later');
        confirmBtn.textContent = isManual ? this.translate('settings.installNow', 'Nu installeren') : this.translate('settings.updateNow', 'Install Now');

        currentBadgeEl.textContent = currentVer;
        remoteBadgeEl.textContent = release.tag_name;
        releaseNameEl.textContent = release.name || 'Prerelease Update';

        // Bind 'Meer informatie' button to open dedicated Markdown changelog modal
        const moreInfoBtn = document.getElementById('update-more-info-btn');
        if (moreInfoBtn) {
            const moreInfoSpan = moreInfoBtn.querySelector('span');
            if (moreInfoSpan) moreInfoSpan.textContent = this.translate('settings.moreInfo', 'Meer informatie');
            moreInfoBtn.onclick = () => {
                this.openChangelog(release, parsedBody);
            };
        }

        // Reset progress bar visibility and reset visual states
        progressContainer.style.display = 'none';
        actionsContainer.style.display = 'flex';
        confirmBtn.style.display = 'inline-flex';
        dismissBtn.style.display = 'inline-flex';
        if (progressText) progressText.style.color = '';

        // Render modal with display and active transition trigger immediately
        this.modalElement.style.display = 'flex';
        this.modalElement.classList.add('visible', 'is-open');
        
        // Trap spatial controls and center directly on first action button
        SpatialNav.setFocusTrap(this.modalElement);
        SpatialNav.setFocus(confirmBtn);
        if (typeof confirmBtn.focus === 'function') {
            confirmBtn.focus();
        }

        // Bind interactive event loops programmatically
        confirmBtn.onclick = () => {
            this.startDownload();
        };

        dismissBtn.onclick = () => {
            this.dismiss();
        };
    }

    /**
     * Opens dedicated full Markdown modal for release notes.
     * @param {Object} release - GitHub release object.
     * @param {string} parsedBody - Parsed Markdown HTML.
     */
    static openChangelog(release, parsedBody) {
        if (!this.changelogModalElement) return;

        this.modalElement.style.display = 'none';
        this.changelogModalElement.style.display = 'flex';
        this.changelogModalElement.classList.add('visible', 'is-open');

        const titleEl = document.getElementById('update-changelog-modal-title');
        const contentEl = document.getElementById('update-changelog-modal-content');
        const closeBtn = document.getElementById('update-changelog-close-btn');
        const backBtn = document.getElementById('update-changelog-back-btn');

        if (titleEl) {
            titleEl.textContent = release.name || `${this.translate('settings.changes', 'Changes')} (${release.tag_name})`;
        }
        if (contentEl) {
            contentEl.innerHTML = parsedBody;
        }
        if (closeBtn) {
            closeBtn.textContent = this.translate('common.close', 'Sluiten');
            closeBtn.onclick = () => this.closeChangelog();
        }
        if (backBtn) {
            backBtn.onclick = () => this.closeChangelog();
        }

        SpatialNav.setFocusTrap(this.changelogModalElement);
        const focusTarget = backBtn || closeBtn;
        if (focusTarget) SpatialNav.setFocus(focusTarget);
    }

    /**
     * Closes dedicated Markdown modal and restores the main update prompt.
     */
    static closeChangelog() {
        if (!this.changelogModalElement) return;

        this.changelogModalElement.classList.remove('visible', 'is-open');
        this.changelogModalElement.style.display = 'none';

        this.modalElement.style.display = 'flex';
        this.modalElement.classList.add('visible', 'is-open');

        SpatialNav.setFocusTrap(this.modalElement);
        const moreInfoBtn = document.getElementById('update-more-info-btn');
        if (moreInfoBtn) SpatialNav.setFocus(moreInfoBtn);
    }

    /**
     * Smart retry handler.
     * Re-triggers native installation if the APK file is already present on disk (e.g. after permission prompt), avoiding re-downloading.
     */
    static retryOrInstall() {
        if (window.AndroidUpdate && typeof window.AndroidUpdate.installExistingApkForVersion === 'function') {
            try {
                const targetVersion = window.latestUpdateVersion || '';
                const launched = window.AndroidUpdate.installExistingApkForVersion(targetVersion);
                if (launched) {
                    this.handleStatus('installing');
                    return;
                }
            } catch (err) {
                console.warn('UpdatePrompt: Failed to install existing APK, re-downloading...', err);
            }
        }
        this.startDownload();
    }

    /**
     * Programmatically initiates the update download process.
     * Delegates download to native or PC bridge.
     */
    static startDownload() {
        const actionsContainer = document.getElementById('update-actions');
        const progressContainer = document.getElementById('update-progress-container');
        const progressBar = document.getElementById('update-progress-bar');
        const progressText = document.getElementById('update-progress-text');
        const titleEl = this.modalElement.querySelector('.update-title');
        const moreInfoContainer = document.getElementById('update-more-info-container');
        if (moreInfoContainer) moreInfoContainer.style.display = 'none';

        const isBranch = window.latestUpdateVersion === 'Branch';
        if (isBranch && window.AndroidUpdate && typeof window.AndroidUpdate.clearCachedApk === 'function') {
            window.AndroidUpdate.clearCachedApk();
        }

        // Check if downloaded APK already exists on disk before initiating network fetch (skip for Branch builds)
        if (!isBranch && window.AndroidUpdate && typeof window.AndroidUpdate.installExistingApkForVersion === 'function') {
            try {
                const targetVersion = window.latestUpdateVersion || '';
                if (window.AndroidUpdate.installExistingApkForVersion(targetVersion)) {
                    this.handleStatus('installing');
                    return;
                }
            } catch (e) {
                console.warn('UpdatePrompt: Failed to check existing APK', e);
            }
        }

        if (actionsContainer) actionsContainer.style.display = 'none';
        if (progressContainer) progressContainer.style.display = 'flex';
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.style.color = '';
        
        this.activeStatus = 'downloading';
        const initialStatus = this.translate('update_status_downloading', 'Downloading Update...');
        if (titleEl) titleEl.textContent = initialStatus;
        
        if (window.AndroidUpdate) {
            if (progressText) {
                progressText.textContent = `${initialStatus} (0%)`;
            }
            try {
                const targetVersion = window.latestUpdateVersion || '';
                if (window.latestUpdateDownloadUrl) {
                    if (typeof window.AndroidUpdate.downloadAndInstallForUrlAndVersion === 'function') {
                        window.AndroidUpdate.downloadAndInstallForUrlAndVersion(window.latestUpdateDownloadUrl, targetVersion);
                    } else {
                        window.AndroidUpdate.downloadAndInstallForUrl(window.latestUpdateDownloadUrl);
                    }
                } else {
                    window.AndroidUpdate.downloadAndInstall();
                }
            } catch (err) {
                console.error('UpdatePrompt: Failed to trigger native download', err);
                this.handleError();
            }
        } else if (window.ElectronAPI) {
            if (progressText) {
                progressText.textContent = `${initialStatus} (0%)`;
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
                progressText.textContent = initialStatus;
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
     * Dynamically updates the modal title content and progress label text.
     * 
     * @param {string} statusKey - The status key representing the active download/installation phase.
     */
    static handleStatus(statusKey) {
        this.activeStatus = statusKey;
        const progressText = document.getElementById('update-progress-text');
        const confirmBtn = document.getElementById('update-download-btn');
        const actionsContainer = document.getElementById('update-actions');
        const titleEl = this.modalElement ? this.modalElement.querySelector('.update-title') : null;
        
        if (progressText) {
            progressText.style.color = '';
        }

        let statusStr = statusKey;
        if (statusKey === 'downloading') {
            statusStr = this.translate('update_status_downloading', 'Downloading Update...');
        } else if (statusKey === 'installing') {
            statusStr = this.translate('update_status_installing', 'Installing Update...');
        } else if (statusKey === 'connecting-api') {
            statusStr = this.translate('update_status_connecting', 'Connecting to Server...');
        } else if (statusKey === 'permission_required') {
            statusStr = this.translate('update_status_permission_required', 'Permission required to install updates. Enable in settings and tap Retry.');
            if (actionsContainer) actionsContainer.style.display = 'flex';
            if (confirmBtn) {
                confirmBtn.textContent = this.translate('update_retry', 'Retry');
                confirmBtn.style.display = 'inline-flex';
                confirmBtn.onclick = () => this.retryOrInstall();
                SpatialNav.setFocus(confirmBtn);
            }
        }

        if (progressText) {
            progressText.textContent = statusStr;
        }
        if (titleEl) {
            titleEl.textContent = statusKey === 'permission_required' 
                ? this.translate('settings.updateFound', 'Update Available') 
                : statusStr;
        }
    }

    /**
     * Updates the progress bar and status text percentage display.
     * Adjusts progress bar width, progress text label, and updates active status title.
     * 
     * @param {number} percent - The percentage completed (0 to 100).
     */
    static handleProgress(percent) {
        const progressBar = document.getElementById('update-progress-bar');
        const progressText = document.getElementById('update-progress-text');
        const titleEl = this.modalElement ? this.modalElement.querySelector('.update-title') : null;

        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }
        if (progressText) {
            progressText.style.color = '';
        }

        let statusStr = this.translate('update_status_downloading', 'Downloading Update...');
        if (this.activeStatus === 'installing') {
            statusStr = this.translate('update_status_installing', 'Installing Update...');
        } else if (this.activeStatus === 'connecting-api') {
            statusStr = this.translate('update_status_connecting', 'Connecting to Server...');
        }

        const fullProgressStr = `${statusStr} (${percent}%)`;
        if (progressText) {
            progressText.textContent = fullProgressStr;
        }
        if (titleEl) {
            titleEl.textContent = statusStr;
        }
    }

    /**
     * Updates the progress area with error warnings and restores close controls.
     * Sets the error text message and restores the close button to allow retry/dismissal.
     */
    static handleError() {
        this.activeStatus = 'error';
        const progressText = document.getElementById('update-progress-text');
        const actionsContainer = document.getElementById('update-actions');
        const confirmBtn = document.getElementById('update-download-btn');
        const dismissBtn = document.getElementById('update-dismiss-btn');
        const titleEl = this.modalElement ? this.modalElement.querySelector('.update-title') : null;

        const errMsg = this.translate('settings.updateError', 'Update failed. Please check connection and try again.');

        if (titleEl) {
            titleEl.textContent = this.translate('error.title', 'Error');
        }

        if (progressText) {
            progressText.textContent = errMsg;
            progressText.style.color = '#ef4444'; // Red error warning color tint
        }

        // Restore action buttons so the user can retry or dismiss
        if (actionsContainer) actionsContainer.style.display = 'flex';
        if (confirmBtn) {
            confirmBtn.textContent = this.translate('update_retry', 'Retry');
            confirmBtn.style.display = 'inline-flex';
            confirmBtn.onclick = () => this.retryOrInstall();
            SpatialNav.setFocus(confirmBtn);
        }
        if (dismissBtn) {
            dismissBtn.style.display = 'inline-flex';
        }
    }

    /**
     * Called when the native host resumes to refresh state if permission was granted.
     */
    static checkAppResume() {
        if (!this.modalElement || this.modalElement.style.display !== 'flex') return;
        const progressText = document.getElementById('update-progress-text');
        const confirmBtn = document.getElementById('update-download-btn');
        const actionsContainer = document.getElementById('update-actions');

        if (this.activeStatus === 'permission_required' || this.activeStatus === 'error') {
            if (progressText) progressText.style.color = '';
            if (actionsContainer) actionsContainer.style.display = 'flex';
            if (confirmBtn) {
                confirmBtn.textContent = this.translate('update_retry', 'Retry');
                confirmBtn.style.display = 'inline-flex';
                confirmBtn.onclick = () => this.retryOrInstall();
                SpatialNav.setFocus(confirmBtn);
            }
        }
    }

    /**
     * Closes the update modal dialog and dedicated changelog modal, restoring navigation focus trap.
     * Affects overlay element visibility and focus state of SpatialNav.
     */
    static dismiss() {
        if (this.changelogModalElement) {
            this.changelogModalElement.classList.remove('visible', 'is-open');
            this.changelogModalElement.style.display = 'none';
        }

        if (!this.modalElement) return;

        this.modalElement.classList.remove('visible', 'is-open');

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
        const fallbackTarget = document.getElementById('check-updates-btn');
        const targetFocus = (this.previousFocus && SpatialNav.isVisible(this.previousFocus)) 
            ? this.previousFocus 
            : (fallbackTarget && SpatialNav.isVisible(fallbackTarget) ? fallbackTarget : null);

        if (targetFocus) {
            SpatialNav.setFocus(targetFocus);
        } else {
            SpatialNav.refocus();
        }
    }
}
