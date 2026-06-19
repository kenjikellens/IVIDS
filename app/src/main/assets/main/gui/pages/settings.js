console.log('Settings.js: Script loaded');
import { SpatialNav } from '../js/spatial-nav.js';
import { Toast } from '../js/toast.js';
import { manageModal } from '../js/utils/ui-helper.js';
import { parseMarkdown } from '../js/utils/markdown-parser.js';
import { getActiveAccountId, getNamespacedKey } from '../../logic/account-helper.js';
import { Api } from '../../logic/api.js';


let settingsManagerInstance = null;

const LANGUAGE_OPTIONS = [
    { code: 'ar', name: 'Arabic' },
    { code: 'cs', name: 'Cestina' },
    { code: 'da', name: 'Dansk' },
    { code: 'de', name: 'Deutsch' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Espanol' },
    { code: 'fr', name: 'Francais' },
    { code: 'hi', name: 'Hindi' },
    { code: 'id', name: 'Indonesia' },
    { code: 'it', name: 'Italiano' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'nl', name: 'Nederlands' },
    { code: 'no', name: 'Norsk' },
    { code: 'pl', name: 'Polski' },
    { code: 'pt', name: 'Portugues' },
    { code: 'ro', name: 'Romana' },
    { code: 'ru', name: 'Russian' },
    { code: 'sv', name: 'Svenska' },
    { code: 'tr', name: 'Turkce' },
    { code: 'vi', name: 'Vietnamese' },
    { code: 'zh', name: 'Chinese' }
];

/**
 * Initializes the settings page.
 * Applies translations and instantiates the settings manager logic class.
 */
export async function init() {
    console.log('Settings page init() called');
    if (window.i18n && window.i18n.translations) {
        window.i18n.applyTranslations();
    }
    settingsManagerInstance = new SettingsManager();
    window.settingsInstance = settingsManagerInstance;
}

// Register specific handlers on global window to be called by app.js when settings page is active.
// Explanations:
// - window.settingsUpdateStatusHandler: Maps status message events from native side into the settings text element.
// - window.settingsUpdateFoundHandler: Maps found versions to settings buttons, changing "Check Now" to "Install Now".
// - window.settingsNoUpdateHandler: Maps normal exit/up-to-date events.
// - window.settingsUpdateErrorHandler: Maps error states and restores check controls.
window.settingsUpdateStatusHandler = (statusKey) => settingsManagerInstance?.handleUpdateStatus(statusKey);
window.settingsUpdateFoundHandler = (version) => settingsManagerInstance?.handleUpdateFound(version);
window.settingsNoUpdateHandler = () => settingsManagerInstance?.handleNoUpdateFound();
window.settingsUpdateErrorHandler = () => settingsManagerInstance?.handleUpdateError();

/**
 * SettingsManager Class
 * Handles settings state loading, UI rendering, programmatic button click mapping,
 * modal triggers, and theme variables injection.
 */
class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
        this.pendingSettings = {};
        this.currentModal = null;
        this.isCheckingUpdates = false;
        this.movingProviderId = null;
        this.movingM3uId = null;
        this.movingOriginalList = null;
        this.initializeUI();
        this.applySettings();
    }

    /**
     * Loads the saved application settings from local storage, applying defaults and migration rules.
     * This affects the global application state including theme, language, and player URL.
     * @returns {Object} Application settings object.
     */
    loadSettings() {
        const defaultSettings = {
            language: 'en',
            accentColor: '#46d369',
            updateMode: 'manual',
            m3uUrl: '',
            playerProvider: 'custom',
            playerBaseUrl: 'https://vidlink.pro',
            playerProviders: [
                { id: 'vidlink', name: 'VidLink (Primary)', url: 'https://vidlink.pro', isCustom: false },
                { id: 'vidsrc_to', name: 'VidSrc.to (Server 2)', url: 'https://vidsrc.to/embed', isCustom: false },
                { id: 'videasy', name: 'Videasy (Server 3)', url: 'https://player.videasy.net', isCustom: false },
                { id: 'vidsrc_cc', name: 'VidSrc.cc (Server 4)', url: 'https://vidsrc.cc/v2/embed', isCustom: false }
            ],
            m3uPlaylists: []
        };
        try {
            const globalSaved = localStorage.getItem('ivids-settings');
            const globalSettings = globalSaved ? JSON.parse(globalSaved) : {};

            // Fallback to cookies for updateMode and language if not in localStorage
            if (!globalSettings.updateMode) {
                const match = document.cookie.match(/(?:^|; )updateMode=([^;]*)/);
                if (match) {
                    globalSettings.updateMode = decodeURIComponent(match[1]);
                }
            }
            if (!globalSettings.language) {
                const match = document.cookie.match(/(?:^|; )language=([^;]*)/);
                if (match) {
                    globalSettings.language = decodeURIComponent(match[1]);
                }
            }

            const userKey = getNamespacedKey('settings');
            const userSaved = localStorage.getItem(userKey);
            const userSettings = userSaved ? JSON.parse(userSaved) : {};

            const parsed = { ...globalSettings, ...userSettings };

            if (parsed.playerBaseUrl && (parsed.playerBaseUrl.includes('vidsrc.xyz') || parsed.playerBaseUrl.includes('vidsrc.me') || parsed.playerBaseUrl.includes('vidsrc.net'))) {
                parsed.playerBaseUrl = 'https://vidlink.pro';
            }

            // Migrate playerProviders if missing
            if (!parsed.playerProviders) {
                const defaultProviders = JSON.parse(JSON.stringify(defaultSettings.playerProviders));
                if (parsed.playerBaseUrl) {
                    const matched = defaultProviders.find(p => p.url === parsed.playerBaseUrl);
                    if (!matched) {
                        defaultProviders.unshift({
                            id: 'custom_migrated',
                            name: 'Custom Server',
                            url: parsed.playerBaseUrl,
                            isCustom: true
                        });
                    } else {
                        const idx = defaultProviders.indexOf(matched);
                        if (idx > -1) {
                            defaultProviders.splice(idx, 1);
                            defaultProviders.unshift(matched);
                        }
                    }
                }
                parsed.playerProviders = defaultProviders;
            }

            // Migrate m3uPlaylists if missing
            if (parsed.m3uUrl && (!parsed.m3uPlaylists || parsed.m3uPlaylists.length === 0)) {
                parsed.m3uPlaylists = [{
                    id: 'custom_m3u',
                    name: 'Custom Playlist',
                    url: parsed.m3uUrl,
                    isCustom: true
                }];
            }

            return { ...defaultSettings, ...parsed };
        } catch (e) { return defaultSettings; }
    }

    /**
     * Saves active settings configurations to disk and broadcasts changes.
     */
    saveSettings() {
        const globalSettings = {
            language: this.settings.language,
            updateMode: this.settings.updateMode
        };
        const userSettings = {
            accentColor: this.settings.accentColor,
            m3uUrl: this.settings.m3uUrl,
            playerProvider: this.settings.playerProvider,
            playerBaseUrl: this.settings.playerBaseUrl,
            playerProviders: this.settings.playerProviders,
            m3uPlaylists: this.settings.m3uPlaylists
        };

        const userKey = getNamespacedKey('settings');

        localStorage.setItem('ivids-settings', JSON.stringify(globalSettings));
        localStorage.setItem(userKey, JSON.stringify(userSettings));

        // Save updateMode and language to cookies for native integration
        document.cookie = `updateMode=${encodeURIComponent(this.settings.updateMode)}; path=/; max-age=31536000; SameSite=Lax`;
        document.cookie = `language=${encodeURIComponent(this.settings.language)}; path=/; max-age=31536000; SameSite=Lax`;

        Api.invalidatePlayerConfig();

        this.applySettingsGlobally();
    }

    /**
     * Binds click event handlers programmatically to settings trigger buttons and modal actions.
     * This coordinates opening modals, triggering updates, and setting up remote capture loops.
     */
    initializeUI() {

        // Appearance Modals Triggers
        const editLangBtn = document.getElementById('edit-language-btn');
        if (editLangBtn) {
            editLangBtn.onclick = () => this.openModal('language-modal');
        }

        const editColorBtn = document.getElementById('edit-color-btn');
        if (editColorBtn) {
            editColorBtn.onclick = () => this.openModal('color-modal');
        }

        const editPlayerBtn = document.getElementById('edit-player-btn');
        if (editPlayerBtn) {
            editPlayerBtn.onclick = () => this.openModal('player-modal');
        }

        const editM3uBtn = document.getElementById('edit-m3u-btn');
        if (editM3uBtn) {
            editM3uBtn.onclick = () => this.openModal('m3u-modal');
        }

        const editUpdateModeBtn = document.getElementById('edit-update-mode-btn');
        if (editUpdateModeBtn) {
            editUpdateModeBtn.onclick = () => this.openModal('update-mode-modal');
        }

        const appInfoBtn = document.getElementById('app-info-btn');
        if (appInfoBtn) {
            appInfoBtn.onclick = () => this.openModal('app-info-modal');
        }

        const checkBtn = document.getElementById('check-updates-btn');
        if (checkBtn) {
            checkBtn.onclick = () => this.handleMainUpdateAction();
        }

        const cancelBtn = document.getElementById('cancel-update-btn');
        if (cancelBtn) {
            cancelBtn.onclick = () => this.handleCancelUpdate();
        }

        // Intercept ArrowUp and ArrowDown globally in capturing phase when actively reordering items on TV
        window.addEventListener('keydown', (e) => {
            if (this.movingProviderId) {
                const keyCode = e.keyCode || e.which;
                const key = e.key;
                if (key === 'ArrowUp' || keyCode === 38) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.moveItem('playerProviders', this.movingProviderId, -1);
                } else if (key === 'ArrowDown' || keyCode === 40) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.moveItem('playerProviders', this.movingProviderId, 1);
                } else if (key === 'Enter' || keyCode === 13) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const finishedId = this.movingProviderId;
                    this.movingProviderId = null;
                    this.movingOriginalList = null;
                    this.renderPlayerProviders();
                    const btn = document.querySelector(`.provider-item[data-id="${finishedId}"] .provider-move-btn`);
                    if (btn) {
                        btn.focus();
                        if (window.SpatialNav) window.SpatialNav.setFocus(btn);
                    }
                } else if (key === 'Escape' || keyCode === 27 || keyCode === 8 || keyCode === 10009 || keyCode === 4) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const finishedId = this.movingProviderId;
                    this.pendingSettings.playerProviders = [...this.movingOriginalList];
                    this.movingProviderId = null;
                    this.movingOriginalList = null;
                    this.renderPlayerProviders();
                    const btn = document.querySelector(`.provider-item[data-id="${finishedId}"] .provider-move-btn`);
                    if (btn) {
                        btn.focus();
                        if (window.SpatialNav) window.SpatialNav.setFocus(btn);
                    }
                }
            } else if (this.movingM3uId) {
                const keyCode = e.keyCode || e.which;
                const key = e.key;
                if (key === 'ArrowUp' || keyCode === 38) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.moveItem('m3uPlaylists', this.movingM3uId, -1);
                } else if (key === 'ArrowDown' || keyCode === 40) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.moveItem('m3uPlaylists', this.movingM3uId, 1);
                } else if (key === 'Enter' || keyCode === 13) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const finishedId = this.movingM3uId;
                    this.movingM3uId = null;
                    this.movingOriginalList = null;
                    this.renderM3uPlaylists();
                    const btn = document.querySelector(`.provider-item[data-id="${finishedId}"] .provider-move-btn`);
                    if (btn) {
                        btn.focus();
                        if (window.SpatialNav) window.SpatialNav.setFocus(btn);
                    }
                } else if (key === 'Escape' || keyCode === 27 || keyCode === 8 || keyCode === 10009 || keyCode === 4) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    const finishedId = this.movingM3uId;
                    this.pendingSettings.m3uPlaylists = [...this.movingOriginalList];
                    this.movingM3uId = null;
                    this.movingOriginalList = null;
                    this.renderM3uPlaylists();
                    const btn = document.querySelector(`.provider-item[data-id="${finishedId}"] .provider-move-btn`);
                    if (btn) {
                        btn.focus();
                        if (window.SpatialNav) window.SpatialNav.setFocus(btn);
                    }
                }
            }
        }, true);

        this.updateDisplays();
    }


    /**
     * Executes the update check action.
     * Delegates to the unified JavaScript updater which handles Android, Electron, and Web environments.
     */
    handleMainUpdateAction() {


        this.isCheckingUpdates = true;

        const checkBtn = document.getElementById('check-updates-btn');
        if (checkBtn) checkBtn.style.display = 'none';

        const cancelBtn = document.getElementById('cancel-update-btn');
        if (cancelBtn) cancelBtn.style.display = 'inline-block';

        const statusText = document.getElementById('update-status-text');
        if (statusText) {
            statusText.style.display = 'inline-block';
            statusText.textContent = window.i18n?.t('settings.updateStatus.connecting-api') || 'Connecting...';
        }

        let loaderContainer = document.getElementById('update-loader-container');
        if (loaderContainer) {
            loaderContainer.style.display = 'flex';
            loaderContainer.innerHTML = '<div class="ivids-loader"></div>';
            if (window.LoaderManager && window.LoaderManager.createLoader) {
                const loaderEl = loaderContainer.querySelector('.ivids-loader');
                window.LoaderManager.createLoader(loaderEl);
            }
        }

        if (this.settings.updateMode === 'advanced') {
            this.openVersionSelector();
        } else {
            import('../js/updater.js').then(({ Updater }) => {
                Updater.checkForUpdates(true);
            }).catch(err => {
                console.error('Settings: Failed to load updater', err);
                this.handleUpdateError();
            });
        }
    }

    /**
     * Cancels active checker connection.
     */
    handleCancelUpdate() {
        console.log('Cancelling update check');
        this.isCheckingUpdates = false;

        const checkBtn = document.getElementById('check-updates-btn');
        if (checkBtn) checkBtn.style.display = 'inline-block';

        const cancelBtn = document.getElementById('cancel-update-btn');
        if (cancelBtn) cancelBtn.style.display = 'none';

        const statusText = document.getElementById('update-status-text');
        if (statusText) statusText.style.display = 'none';

        const loaderContainer = document.getElementById('update-loader-container');
        if (loaderContainer) loaderContainer.style.display = 'none';

        SpatialNav.refocus();
    }

    /**
     * Synchronizes main settings UI elements showing saved counts and values.
     * This updates the displayed counts for player providers, M3U playlists, selected language, accent color, and update modes.
     */
    updateDisplays() {
        const langDisplay = document.getElementById('current-language-display');
        if (langDisplay) {
            const names = Object.fromEntries(LANGUAGE_OPTIONS.map(({ code, name }) => [code, name]));
            langDisplay.textContent = names[this.settings.language] || this.settings.language;
        }

        const colorDisplay = document.getElementById('current-color-display');
        if (colorDisplay) {
            colorDisplay.style.borderBottomColor = this.settings.accentColor;
            colorDisplay.textContent = 'Accent';
        }

        const playerDisplay = document.getElementById('current-player-display');
        if (playerDisplay) {
            const providers = this.settings.playerProviders || [];
            playerDisplay.textContent = (window.i18n?.t('settings.serversCount') || '{count} Servers').replace('{count}', providers.length);
        }

        const m3uDisplay = document.getElementById('current-m3u-display');
        if (m3uDisplay) {
            const playlists = this.settings.m3uPlaylists || [];
            m3uDisplay.textContent = (window.i18n?.t('settings.playlistsCount') || '{count} Playlists').replace('{count}', playlists.length);
        }

        const modeDisplay = document.getElementById('current-update-mode-display');
        if (modeDisplay) {
            modeDisplay.textContent = window.i18n?.t(`settings.mode.${this.settings.updateMode}`) || this.settings.updateMode;
        }

        const manualContainer = document.getElementById('manual-check-container');
        if (manualContainer) {
            const isManualOrAdvanced = this.settings.updateMode === 'manual' || this.settings.updateMode === 'advanced';
            manualContainer.style.display = isManualOrAdvanced ? 'flex' : 'none';

            const checkBtn = document.getElementById('check-updates-btn');
            const checkLabel = manualContainer.querySelector('.setting-label');
            const checkDesc = manualContainer.querySelector('.setting-description');

            if (this.settings.updateMode === 'advanced') {
                if (checkBtn) checkBtn.textContent = window.i18n?.t('settings.toast.select') || 'Select Version';
                if (checkLabel) checkLabel.textContent = 'Developer Console';
                if (checkDesc) checkDesc.textContent = 'Choose any branch or release build to install';
            } else {
                if (checkBtn) checkBtn.textContent = window.i18n?.t('settings.checkButton') || 'Check Now';
                if (checkLabel) checkLabel.textContent = window.i18n?.t('settings.checkNow') || 'Check for Updates';
                if (checkDesc) checkDesc.textContent = window.i18n?.t('settings.checkNowDesc') || 'Manually search for updates';
            }
        }

        const versionDisplay = document.getElementById('app-version-display');
        if (versionDisplay) {
            if (window.AndroidUpdate && typeof window.AndroidUpdate.getCurrentVersion === 'function') {
                versionDisplay.textContent = window.AndroidUpdate.getCurrentVersion();
            } else if (window.ElectronAPI && typeof window.ElectronAPI.getAppVersion === 'function') {
                window.ElectronAPI.getAppVersion().then(version => {
                    versionDisplay.textContent = version ? `v${version}` : 'v0.4.1';
                }).catch(() => {
                    versionDisplay.textContent = 'v0.4.1';
                });
            } else {
                fetch('/api/version')
                    .then(response => response.json())
                    .then(data => {
                        versionDisplay.textContent = data.version ? `v${data.version}` : 'v0.4.1';
                    })
                    .catch(() => {
                        versionDisplay.textContent = 'v0.4.1';
                    });
            }
        }
    }

    /**
     * Opens the version selector modal, fetches all available releases from the GitHub API,
     * and populates the modal grid with focusable version selection chips.
     */
    async openVersionSelector() {
        console.log('Settings: Opening version selector modal');
        this.openModal('version-selector-modal');

        const loader = document.getElementById('version-list-loader');
        const grid = document.getElementById('version-options');

        if (loader) loader.style.display = 'flex';
        if (grid) {
            grid.style.display = 'none';
            grid.innerHTML = '';
        }

        try {
            console.log('Settings: Fetching releases list from GitHub');
            const res = await fetch('https://api.github.com/repos/kenjikellens/IVIDS/releases');
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            
            const releases = await res.json();
            console.log(`Settings: Retreived ${releases.length} releases successfully`);

            if (loader) loader.style.display = 'none';
            if (grid) {
                grid.style.display = 'grid';
                
                // Add the top chip: Active Branch Build
                const branchCard = document.createElement('div');
                branchCard.className = 'option-chip focusable';
                branchCard.setAttribute('data-value', 'branch');
                branchCard.innerHTML = `
                    <div class="version-chip-content">
                        <div class="version-chip-header">
                            <span class="version-tag-badge" style="background: var(--primary-color)">Branch</span>
                            <span class="version-date-label">Latest</span>
                        </div>
                        <span class="version-chip-title">${window.i18n?.t('settings.branchBuild') || 'Active Branch Build'}</span>
                        <div class="version-chip-desc">${window.i18n?.t('settings.branchBuildDesc') || 'Direct main branch build (raw APK)'}</div>
                    </div>
                `;
                
                branchCard.onclick = () => {
                    this.closeModal();
                    console.log('Settings: Selected branch build');
                    window.latestUpdateDownloadUrl = 'https://github.com/kenjikellens/IVIDS/raw/main/IVIDS.apk';
                    window.latestUpdateVersion = 'Branch';
                    window.latestRelease = {
                        tag_name: 'Branch',
                        name: window.i18n?.t('settings.branchBuild') || 'Active Branch Build',
                        body: window.i18n?.t('settings.branchBuildDesc') || 'Direct main branch build (raw APK).'
                    };
                    import('../js/update-prompt.js').then(({ UpdatePrompt }) => {
                        UpdatePrompt.show('Branch');
                    }).catch(err => {
                        console.error('Settings: Failed to load update-prompt.js', err);
                        if (window.AndroidUpdate) {
                            window.AndroidUpdate.downloadFromRepo();
                        } else {
                            window.open('https://github.com/kenjikellens/IVIDS/releases', '_blank');
                        }
                    });
                };
                
                grid.appendChild(branchCard);
 
                // Add each release as a focusable option chip
                releases.forEach(rel => {
                    // Find the APK asset
                    const apkAsset = rel.assets.find(asset => asset.name.endsWith('.apk'));
                    const downloadUrl = apkAsset ? apkAsset.browser_download_url : null;
                    
                    if (downloadUrl) {
                        const date = new Date(rel.published_at).toLocaleDateString();
                        const relCard = document.createElement('div');
                        relCard.className = 'option-chip focusable';
                        relCard.setAttribute('data-value', rel.tag_name);
                        
                        relCard.innerHTML = `
                            <div class="version-chip-content">
                                <div class="version-chip-header">
                                    <span class="version-tag-badge">${rel.tag_name}</span>
                                    <span class="version-date-label">${date}</span>
                                </div>
                                <span class="version-chip-title">${rel.name || 'Release Build'}</span>
                            </div>
                            <button class="version-info-btn focusable" title="View changes">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="16" x2="12" y2="12"></line>
                                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                </svg>
                            </button>
                        `;

                        const infoBtn = relCard.querySelector('.version-info-btn');
                        if (infoBtn) {
                            infoBtn.onclick = (e) => {
                                e.stopPropagation();
                                this.openChangesPopup(rel.name || rel.tag_name, rel.body || 'No release notes available.');
                            };
                        }

                        relCard.onclick = () => {
                            this.closeModal();
                            console.log(`Settings: Selected version ${rel.tag_name} via ${downloadUrl}`);
                            window.latestUpdateDownloadUrl = downloadUrl;
                            window.latestUpdateVersion = rel.tag_name;
                            window.latestRelease = rel;
                            import('../js/update-prompt.js').then(({ UpdatePrompt }) => {
                                UpdatePrompt.show(rel.tag_name);
                            }).catch(err => {
                                console.error('Settings: Failed to load update-prompt.js', err);
                                if (window.AndroidUpdate) {
                                    window.AndroidUpdate.downloadAndInstallForUrl(downloadUrl);
                                } else {
                                    window.open(downloadUrl, '_blank');
                                }
                            });
                        };

                        grid.appendChild(relCard);
                    }
                });

                // Trapping focus using SpatialNav refocus
                if (typeof SpatialNav !== 'undefined' && SpatialNav.refocus) {
                    SpatialNav.refocus();
                }
            }
        } catch (err) {
            console.error('Settings: Failed to load versions', err);
            if (loader) loader.style.display = 'none';
            if (grid) {
                grid.style.display = 'grid';
                grid.innerHTML = `
                    <div style="color: #ff3b30; text-align: center; padding: 20px; font-weight: 700; width: 100%;">
                        Failed to fetch releases. Please check your internet connection.
                    </div>
                `;
            }
        }
    }

    /**
     * Opens the release changes popup modal and renders the specified markdown changelog text.
     * Updates the changes modal content area and sets focus to the close button.
     * @param {string} title - The title of the release version.
     * @param {string} body - The raw markdown text containing release changes.
     */
    openChangesPopup(title, body) {
        console.log(`Settings: Opening changes popup for ${title}`);
        const modal = document.getElementById('changes-modal');
        if (!modal) return;

        const titleEl = document.getElementById('changes-modal-title');
        if (titleEl) {
            titleEl.textContent = title;
        }

        const contentEl = document.getElementById('changes-modal-content');
        if (contentEl) {
            contentEl.innerHTML = parseMarkdown(body);
        }

        const prevModal = this.currentModal;
        const prevCloseFn = this.closeModalFn;

        this.openModal('changes-modal');

        const originalCloseFn = this.closeModalFn;
        this.closeModalFn = (revert = true) => {
            if (originalCloseFn) originalCloseFn(revert);
            this.currentModal = prevModal;
            this.closeModalFn = prevCloseFn;
            if (prevModal) {
                prevModal.classList.add('show');
                if (window.SpatialNav) window.SpatialNav.refocus();
            }
        };
    }

    /**
     * Opens a focused dialog modal programmatically and attaches programmatic click routes.
     * This sets up dynamic list content for player and Live TV providers if needed.
     * @param {string} modalId - The unique DOM selector ID of the target dialog modal.
     */
    openModal(modalId) {
        console.log('--- OPENING MODAL:', modalId, '---');
        const modal = document.getElementById(modalId);
        if (!modal) return;

        this.currentModal = modal;
        this.pendingSettings = { ...this.settings };
        if (this.settings.playerProviders) {
            this.pendingSettings.playerProviders = this.settings.playerProviders.map(p => ({ ...p }));
        }
        if (this.settings.m3uPlaylists) {
            this.pendingSettings.m3uPlaylists = this.settings.m3uPlaylists.map(p => ({ ...p }));
        }

        const keyMap = {
            'language-modal': 'language',
            'color-modal': 'accentColor',
            'update-mode-modal': 'updateMode',
            'player-modal': 'playerProviders',
            'm3u-modal': 'm3uPlaylists'
        };
        const key = keyMap[modalId] || modalId.replace('-modal', '');

        if (modalId === 'player-modal') {
            this.movingProviderId = null;
            this.movingOriginalList = null;
            this.renderPlayerProviders();
            const addBtn = document.getElementById('add-provider-btn');
            if (addBtn) {
                addBtn.onclick = () => {
                    const newItem = { id: 'custom_' + Date.now(), name: 'Custom Server', url: '', isCustom: true };
                    this.pendingSettings.playerProviders.push(newItem);
                    this.renderPlayerProviders();
                    const input = document.querySelector(`.provider-item[data-id="${newItem.id}"] .provider-url-input`);
                    if (input) {
                        input.focus();
                        if (window.SpatialNav) window.SpatialNav.setFocus(input);
                    }
                };
            }
        } else if (modalId === 'm3u-modal') {
            this.movingM3uId = null;
            this.movingOriginalList = null;
            this.renderM3uPlaylists();
            const addBtn = document.getElementById('add-m3u-btn');
            if (addBtn) {
                addBtn.onclick = () => {
                    const newItem = { id: 'custom_' + Date.now(), name: 'Custom Playlist', url: '', isCustom: true };
                    this.pendingSettings.m3uPlaylists.push(newItem);
                    this.renderM3uPlaylists();
                    const input = document.querySelector(`.provider-item[data-id="${newItem.id}"] .provider-url-input`);
                    if (input) {
                        input.focus();
                        if (window.SpatialNav) window.SpatialNav.setFocus(input);
                    }
                };
            }
        } else {
            modal.querySelectorAll('.option-chip').forEach(chip => {
                const val = chip.getAttribute('data-value');
                chip.onclick = (e) => {
                    e.stopPropagation();
                    this.setPending(key, val, chip);
                };
            });
        }

        const innerClose = manageModal(modal);

        this.closeModalFn = (revert = true) => {
            if (revert) {
                if (this.pendingSettings.language !== this.settings.language) {
                    if (window.i18n) window.i18n.setLanguage(this.settings.language);
                }
                if (this.pendingSettings.accentColor !== this.settings.accentColor) {
                    this.applySettings();
                    this.applySettingsGlobally();
                }
            }
            if (modalId === 'version-selector-modal') {
                this.handleCancelUpdate();
            }
            this.movingProviderId = null;
            this.movingM3uId = null;
            this.movingOriginalList = null;
            innerClose();
            this.currentModal = null;
            this.closeModalFn = null;
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        };

        const cancelBtn = modal.querySelector('.btn-secondary') || modal.querySelector('.modal-btn.secondary') || modal.querySelector('.action-btn.secondary');
        if (cancelBtn) {
            cancelBtn.onclick = (e) => {
                e.stopPropagation();
                this.closeModal();
            };
        }

        const closeXBtn = modal.querySelector('.modal-close-x');
        if (closeXBtn) {
            closeXBtn.onclick = (e) => {
                e.stopPropagation();
                this.closeModal();
            };
        }

        const applyBtn = modal.querySelector('.btn-primary') || modal.querySelector('.modal-btn.primary') || modal.querySelector('.action-btn.primary');
        if (applyBtn) {
            applyBtn.onclick = (e) => {
                e.stopPropagation();
                this.applyPending(key);
            };
        }

        this.syncActiveChips(modalId);
    }

    /**
     * Highlights the active settings chip options.
     * This matches options in Language, Color and Update Mode modals.
     * @param {string} modalId - Selected Modal element ID.
     */
    syncActiveChips(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        const keyMap = {
            'language-modal': 'language',
            'color-modal': 'accentColor',
            'update-mode-modal': 'updateMode'
        };
        const key = keyMap[modalId] || modalId.replace('-modal', '');
        const value = this.pendingSettings[key];

        modal.querySelectorAll('.option-chip').forEach(chip => {
            const chipValue = chip.getAttribute('data-value');
            if (chipValue === value) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });

        if (modalId === 'update-mode-modal') {
            const warning = document.getElementById('advanced-warning');
            if (warning) {
                warning.style.display = value === 'advanced' ? 'block' : 'none';
            }
        }
    }

    /**
     * Closes the active settings modal and restores spatial outlines.
     * Restores original options if revert is true.
     * @param {boolean} [revert=true] - Reverts pending settings if true.
     */
    closeModal(revert = true) {
        if (this.closeModalFn) {
            this.closeModalFn(revert);
        }
    }


    /**
     * Updates modal temporary state options.
     * This provides live theme accent and language translations previews.
     * @param {string} key - Parameter field target.
     * @param {string} value - Selection option.
     * @param {HTMLElement} el - Selected HTML Chip element.
     */
    setPending(key, value, el) {
        console.log(`Setting pending ${key} to ${value}`);
        this.pendingSettings[key] = value;

        if (el && el.parentElement) {
            el.parentElement.querySelectorAll('.option-chip').forEach(chip => chip.classList.remove('active'));
            el.classList.add('active');
        }

        if (key === 'updateMode') {
            const warning = document.getElementById('advanced-warning');
            if (warning) {
                warning.style.display = value === 'advanced' ? 'block' : 'none';
            }
        }

        if (key === 'language' && window.i18n) {
            window.i18n.setLanguage(value);
        } else if (key === 'accentColor') {
            document.documentElement.style.setProperty('--primary-color', value);
            const hex = value.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
            document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
            try {
                const mainDoc = window.parent?.document || document;
                mainDoc.documentElement.style.setProperty('--primary-color', value);
                mainDoc.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
            } catch (e) {}
        }
    }

    /**
     * Saves pending changes to disk, applies translations, and injects styling rules.
     * This handles confirmation settings and player/IPTV migrations.
     * @param {string} key - Active configuration key.
     */
    async applyPending(key) {
        console.log(`Applying pending settings for ${key}`);
        const newValue = this.pendingSettings[key];
        this.settings[key] = newValue;

        if (key === 'playerProviders') {
            const firstProvider = this.settings.playerProviders?.[0];
            if (firstProvider) {
                this.settings.playerBaseUrl = firstProvider.url;
            }
        } else if (key === 'm3uPlaylists') {
            const firstPlaylist = this.settings.m3uPlaylists?.[0];
            if (firstPlaylist) {
                this.settings.m3uUrl = firstPlaylist.url;
            } else {
                this.settings.m3uUrl = '';
            }
        }

        this.saveSettings();

        if (key === 'language' && window.i18n) {
            await window.i18n.setLanguage(newValue);
        } else if (key === 'accentColor') {
            this.applySettings();
        }

        this.updateDisplays();
        this.closeModal(false);
    }

    /**
     * Renders the prioritized list of player providers in the modal body.
     * Attaches oninput/change value listeners and click event routes for moves and deletions.
     */
    renderPlayerProviders() {
        const listContainer = document.getElementById('player-providers-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const providers = this.pendingSettings.playerProviders || [];

        providers.forEach((provider, idx) => {
            const item = document.createElement('div');
            item.className = 'provider-item focusable';
            if (this.movingProviderId === provider.id) {
                item.classList.add('moving');
            }
            item.dataset.id = provider.id;

            const input = document.createElement('input');
            input.type = 'url';
            input.className = 'provider-url-input focusable';
            input.value = provider.url || '';
            input.placeholder = 'https://example.com/embed';
            input.oninput = (e) => {
                provider.url = e.target.value;
            };

            const actions = document.createElement('div');
            actions.className = 'provider-actions';

            const moveBtn = document.createElement('button');
            moveBtn.className = 'provider-move-btn focusable';
            if (this.movingProviderId === provider.id) {
                moveBtn.classList.add('active-moving');
                moveBtn.textContent = 'OK';
            } else {
                moveBtn.textContent = 'Move';
            }

            moveBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.movingProviderId === null) {
                    this.movingProviderId = provider.id;
                    this.movingOriginalList = this.pendingSettings.playerProviders.map(p => ({ ...p }));
                    this.renderPlayerProviders();
                    const activeBtn = document.querySelector(`.provider-item[data-id="${provider.id}"] .provider-move-btn`);
                    if (activeBtn) activeBtn.focus();
                } else if (this.movingProviderId === provider.id) {
                    this.movingProviderId = null;
                    this.movingOriginalList = null;
                    this.renderPlayerProviders();
                    const activeBtn = document.querySelector(`.provider-item[data-id="${provider.id}"] .provider-move-btn`);
                    if (activeBtn) activeBtn.focus();
                }
            };

            actions.appendChild(moveBtn);

            if (provider.isCustom) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'provider-delete-btn focusable';
                deleteBtn.textContent = '🗑';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.pendingSettings.playerProviders.splice(idx, 1);
                    this.renderPlayerProviders();
                    const addBtn = document.getElementById('add-provider-btn');
                    if (addBtn) {
                        addBtn.focus();
                        if (window.SpatialNav) window.SpatialNav.setFocus(addBtn);
                    }
                };
                actions.appendChild(deleteBtn);
            }

            item.appendChild(input);
            item.appendChild(actions);
            listContainer.appendChild(item);
        });

        if (window.SpatialNav && typeof window.SpatialNav.ensureTabindex === 'function') {
            window.SpatialNav.ensureTabindex();
        }
    }

    /**
     * Renders the prioritized list of Live TV M3U playlists in the modal body.
     * Attaches oninput/change value listeners and click event routes for moves and deletions.
     */
    renderM3uPlaylists() {
        const listContainer = document.getElementById('m3u-playlists-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';
        const playlists = this.pendingSettings.m3uPlaylists || [];

        playlists.forEach((playlist, idx) => {
            const item = document.createElement('div');
            item.className = 'provider-item focusable';
            if (this.movingM3uId === playlist.id) {
                item.classList.add('moving');
            }
            item.dataset.id = playlist.id;

            const input = document.createElement('input');
            input.type = 'url';
            input.className = 'provider-url-input focusable';
            input.value = playlist.url || '';
            input.placeholder = 'https://example.com/playlist.m3u';
            input.oninput = (e) => {
                playlist.url = e.target.value;
            };

            const actions = document.createElement('div');
            actions.className = 'provider-actions';

            const moveBtn = document.createElement('button');
            moveBtn.className = 'provider-move-btn focusable';
            if (this.movingM3uId === playlist.id) {
                moveBtn.classList.add('active-moving');
                moveBtn.textContent = 'OK';
            } else {
                moveBtn.textContent = 'Move';
            }

            moveBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.movingM3uId === null) {
                    this.movingM3uId = playlist.id;
                    this.movingOriginalList = this.pendingSettings.m3uPlaylists.map(p => ({ ...p }));
                    this.renderM3uPlaylists();
                    const activeBtn = document.querySelector(`.provider-item[data-id="${playlist.id}"] .provider-move-btn`);
                    if (activeBtn) activeBtn.focus();
                } else if (this.movingM3uId === playlist.id) {
                    this.movingM3uId = null;
                    this.movingOriginalList = null;
                    this.renderM3uPlaylists();
                    const activeBtn = document.querySelector(`.provider-item[data-id="${playlist.id}"] .provider-move-btn`);
                    if (activeBtn) activeBtn.focus();
                }
            };

            actions.appendChild(moveBtn);

            if (playlist.isCustom) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'provider-delete-btn focusable';
                deleteBtn.textContent = '🗑';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.pendingSettings.m3uPlaylists.splice(idx, 1);
                    this.renderM3uPlaylists();
                    const addBtn = document.getElementById('add-m3u-btn');
                    if (addBtn) {
                        addBtn.focus();
                        if (window.SpatialNav) window.SpatialNav.setFocus(addBtn);
                    }
                };
                actions.appendChild(deleteBtn);
            }

            item.appendChild(input);
            item.appendChild(actions);
            listContainer.appendChild(item);
        });

        if (window.SpatialNav && typeof window.SpatialNav.ensureTabindex === 'function') {
            window.SpatialNav.ensureTabindex();
        }
    }

    /**
     * Swaps the position of an item in the pending settings array with its neighbor to adjust its priority.
     * This triggers list re-rendering and preserves navigation focus.
     * @param {string} key - The settings key (playerProviders or m3uPlaylists).
     * @param {string} id - The ID of the item to move.
     * @param {number} direction - The index delta (-1 for up, 1 for down).
     */
    moveItem(key, id, direction) {
        const list = this.pendingSettings[key];
        const index = list.findIndex(p => p.id === id);
        if (index === -1) return;

        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= list.length) return;

        const temp = list[index];
        list[index] = list[targetIndex];
        list[targetIndex] = temp;

        if (key === 'playerProviders') {
            this.renderPlayerProviders();
        } else {
            this.renderM3uPlaylists();
        }

        const btn = document.querySelector(`.provider-item[data-id="${id}"] .provider-move-btn`);
        if (btn) {
            btn.focus();
            if (window.SpatialNav) window.SpatialNav.setFocus(btn);
        }
    }

    /**
     * Applies styling rules locally to document viewport variables.
     */
    applySettings() {
        document.documentElement.style.setProperty('--primary-color', this.settings.accentColor);
        const hex = this.settings.accentColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
        document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
        document.documentElement.setAttribute('lang', this.settings.language);
    }

    /**
     * Secure parent style overrides protected inside try-catch scopes to prevent Live Server crashes.
     */
    applySettingsGlobally() {
        try {
            const mainDoc = window.parent?.document || document;
            mainDoc.documentElement.style.setProperty('--primary-color', this.settings.accentColor);
            const hex = this.settings.accentColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
            mainDoc.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
            mainDoc.documentElement.setAttribute('lang', this.settings.language);
        } catch (e) {
            console.log('Cross-origin iframe parent access restricted, applying configurations to local document viewport only.');
            document.documentElement.style.setProperty('--primary-color', this.settings.accentColor);
            const hex = this.settings.accentColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
            document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
            document.documentElement.setAttribute('lang', this.settings.language);
        }
    }

    /**
     * WebView update notifications receiver.
     */
    handleUpdateStatus(statusKey) {
        if (!this.isCheckingUpdates) return;
        console.log('Update Status:', statusKey);
        const statusText = document.getElementById('update-status-text');
        if (statusText) {
            statusText.textContent = window.i18n?.t(`settings.updateStatus.${statusKey}`) || statusKey;
        }
    }

    /**
     * Handles the event when an update is found.
     * Updates the UI states and binds the click action to trigger downloading and installing.
     * @param {string} version - The version string of the found update.
     */
    handleUpdateFound(version) {
        if (!this.isCheckingUpdates) return;
        console.log('Update Found:', version);
        const statusText = document.getElementById('update-status-text');
        const loaderContainer = document.getElementById('update-loader-container');
        const checkBtn = document.getElementById('check-updates-btn');
        const cancelBtn = document.getElementById('cancel-update-btn');

        if (statusText) statusText.textContent = (window.i18n?.t('settings.updateFound') || 'Update Found') + ': ' + version;
        if (loaderContainer) loaderContainer.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'inline-block';

        if (checkBtn) {
            checkBtn.style.display = 'inline-block';
            checkBtn.textContent = window.i18n?.t('settings.updateNow') || 'Install Now';
            checkBtn.onclick = () => {
                import('../js/update-prompt.js').then(({ UpdatePrompt }) => {
                    this.handleCancelUpdate();
                    UpdatePrompt.show(version);
                }).catch(err => {
                    console.error('Settings: Failed to load update-prompt.js', err);
                    if (window.AndroidUpdate) {
                        window.AndroidUpdate.downloadAndInstall();
                    } else if (window.latestUpdateDownloadUrl) {
                        window.open(window.latestUpdateDownloadUrl, '_blank');
                    }
                });
            };
        }
    }

    /**
     * WebView update notifications receiver.
     */
    handleNoUpdateFound() {
        if (!this.isCheckingUpdates) return;
        this.isCheckingUpdates = false;

        console.log('No update found');
        const statusText = document.getElementById('update-status-text');
        const loaderContainer = document.getElementById('update-loader-container');
        const checkBtn = document.getElementById('check-updates-btn');
        const cancelBtn = document.getElementById('cancel-update-btn');

        if (statusText) statusText.textContent = window.i18n?.t('settings.noUpdate') || 'Up to date';
        if (loaderContainer) loaderContainer.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';

        setTimeout(() => {
            if (checkBtn) {
                checkBtn.style.display = 'inline-block';
                checkBtn.textContent = window.i18n?.t('settings.checkButton') || 'Check Now';
                this.initializeUI();
            }
            if (statusText) statusText.style.display = 'none';
        }, 3000);
    }

    /**
     * WebView update notifications receiver.
     */
    handleUpdateError() {
        if (!this.isCheckingUpdates) return;
        this.isCheckingUpdates = false;

        console.error('Update check error');
        const statusText = document.getElementById('update-status-text');
        const loaderContainer = document.getElementById('update-loader-container');
        const checkBtn = document.getElementById('check-updates-btn');
        const cancelBtn = document.getElementById('cancel-update-btn');

        if (statusText) statusText.textContent = window.i18n?.t('settings.updateError') || 'Error checking';
        if (loaderContainer) loaderContainer.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';

        setTimeout(() => {
            if (checkBtn) {
                checkBtn.style.display = 'inline-block';
                this.initializeUI();
            }
            if (statusText) statusText.style.display = 'none';
        }, 3000);
    }
}
