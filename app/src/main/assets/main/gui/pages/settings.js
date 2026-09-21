console.log('Settings.js: Script loaded');
import { SpatialNav } from '../js/spatial-nav.js';
import { Toast } from '../js/toast.js';
import { manageModal } from '../js/utils/ui-helper.js';
import { parseMarkdown } from '../js/utils/markdown-parser.js';
import { createLoaderElement } from '../js/loader.js';
import { getActiveAccountId, getNamespacedKey } from '../../logic/account-helper.js';
import { Api } from '../../logic/api.js';
import { PersistentStorage } from '../../logic/persistent-storage.js';
import { VersionManager } from '../js/version-manager.js';


let settingsManagerInstance = null;

const LANGUAGE_OPTIONS = [
    { code: 'ar', name: '🇸🇦 Arabic' },
    { code: 'bg', name: '🇧🇬 Български' },
    { code: 'bn', name: '🇧🇩 বাংলা' },
    { code: 'ca', name: '🇪🇸 Català' },
    { code: 'cs', name: '🇨🇿 Čeština' },
    { code: 'da', name: '🇩🇰 Dansk' },
    { code: 'de', name: '🇩🇪 Deutsch' },
    { code: 'el', name: '🇬🇷 Eλληνικά' },
    { code: 'en', name: '🇺🇸 English' },
    { code: 'es', name: '🇪🇸 Español' },
    { code: 'fa', name: '🇮🇷 فارسی' },
    { code: 'fi', name: '🇫🇮 Suomi' },
    { code: 'fr', name: '🇫🇷 Français' },
    { code: 'he', name: '🇮🇱 עברית' },
    { code: 'hi', name: '🇮🇳 Hindi' },
    { code: 'hr', name: '🇭🇷 Hrvatski' },
    { code: 'hu', name: '🇭🇺 Magyar' },
    { code: 'id', name: '🇮🇩 Indonesia' },
    { code: 'it', name: '🇮🇹 Italiano' },
    { code: 'ja', name: '🇯🇵 Japanese' },
    { code: 'ko', name: '🇰🇷 Korean' },
    { code: 'ms', name: '🇲🇾 Bahasa Melayu' },
    { code: 'nl', name: '🇳🇱 Nederlands' },
    { code: 'no', name: '🇳🇴 Norsk' },
    { code: 'pl', name: '🇵🇱 Polski' },
    { code: 'pt', name: '🇵🇹 Português' },
    { code: 'ro', name: '🇷🇴 Română' },
    { code: 'ru', name: '🇷🇺 Russian' },
    { code: 'sk', name: '🇸🇰 Slovenčina' },
    { code: 'sr', name: '🇷🇸 Српски' },
    { code: 'sv', name: '🇸🇪 Svenska' },
    { code: 'th', name: '🇹🇭 ไทย' },
    { code: 'tl', name: '🇵🇭 Tagalog' },
    { code: 'tr', name: '🇹🇷 Türkçe' },
    { code: 'uk', name: '🇺🇦 Українська' },
    { code: 'vi', name: '🇻🇳 Vietnamese' },
    { code: 'zh', name: '🇨🇳 Chinese' }
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
        this.applySettingsGlobally();
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
            uiScale: '1.0',
            accentColor: '#46d369',
            updateMode: 'manual',
            m3uUrl: '',
            playerProvider: 'custom',
            playerBaseUrl: 'https://vidlink.pro',
            playerProviders: [
                { id: 'vidlink', name: 'VidLink (Primary)', url: 'https://vidlink.pro', isCustom: false },
                { id: 'vidsrc_to', name: 'VidSrc.to (Server 2)', url: 'https://vidsrc.to/embed', isCustom: false },
                { id: 'videasy', name: 'Videasy (Server 3)', url: 'https://player.videasy.net', isCustom: false },
                { id: 'vidsrc_me', name: 'VidSrc.me (Server 4)', url: 'https://vidsrc.me/embed', isCustom: false },
                { id: 'vidsrc_pm', name: 'VidSrc.pm (Server 5)', url: 'https://vidsrc.pm/embed', isCustom: false },
                { id: '2embed', name: '2Embed (Server 6)', url: 'https://www.2embed.cc/embed', isCustom: false },
                { id: 'vidjoy', name: 'VidJoy (Server 7)', url: 'https://vidjoy.pro/embed', isCustom: false }
            ],
            m3uPlaylists: [],
            includeAdult: false,
            dataSaver: false
        };
        try {
            const globalSaved = PersistentStorage.getItem('ivids-settings');
            let globalSettings = {};
            if (globalSaved && globalSaved !== 'null' && globalSaved !== 'undefined') {
                try {
                    globalSettings = JSON.parse(globalSaved) || {};
                } catch (jsonErr) {
                    console.error('Failed to parse global settings:', jsonErr);
                }
            }

            // Fallback to cookies for updateMode, language, and uiScale if not in localStorage
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
            if (!globalSettings.uiScale) {
                const match = document.cookie.match(/(?:^|; )uiScale=([^;]*)/);
                if (match) {
                    globalSettings.uiScale = decodeURIComponent(match[1]);
                }
            }

            const userKey = getNamespacedKey('settings');
            const userSaved = PersistentStorage.getItem(userKey);
            let userSettings = {};
            if (userSaved && userSaved !== 'null' && userSaved !== 'undefined') {
                try {
                    userSettings = JSON.parse(userSaved) || {};
                } catch (jsonErr) {
                    console.error('Failed to parse user settings:', jsonErr);
                }
            }

            const parsed = { ...globalSettings, ...userSettings };

            if (parsed.playerBaseUrl && (parsed.playerBaseUrl.includes('vidsrc.xyz') || parsed.playerBaseUrl.includes('vidsrc.me') || parsed.playerBaseUrl.includes('vidsrc.net'))) {
                parsed.playerBaseUrl = 'https://vidlink.pro';
            }

            // Sync playerProviders: ensure all new default providers are present, replace broken legacy defaults, and keep custom ones
            const defaultProviders = JSON.parse(JSON.stringify(defaultSettings.playerProviders));
            if (!parsed.playerProviders || !Array.isArray(parsed.playerProviders)) {
                parsed.playerProviders = defaultProviders;
            } else {
                // Filter out obsolete non-custom providers (e.g. broken vidsrc_cc or embed_su)
                parsed.playerProviders = parsed.playerProviders.filter(p => p.isCustom || !['vidsrc_cc', 'embed_su'].includes(p.id));
                
                // Add any missing default providers
                defaultProviders.forEach(def => {
                    const exists = parsed.playerProviders.some(p => p.id === def.id || p.url === def.url);
                    if (!exists) {
                        parsed.playerProviders.push(def);
                    }
                });
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
            updateMode: this.settings.updateMode,
            uiScale: this.settings.uiScale
        };
        const userSettings = {
            uiScale: this.settings.uiScale,
            accentColor: this.settings.accentColor,
            m3uUrl: this.settings.m3uUrl,
            playerProvider: this.settings.playerProvider,
            playerBaseUrl: this.settings.playerBaseUrl,
            playerProviders: this.settings.playerProviders,
            m3uPlaylists: this.settings.m3uPlaylists,
            includeAdult: this.settings.includeAdult,
            dataSaver: this.settings.dataSaver
        };

        const userKey = getNamespacedKey('settings');

        PersistentStorage.setItem('ivids-settings', JSON.stringify(globalSettings));
        PersistentStorage.setItem(userKey, JSON.stringify(userSettings));

        // Save updateMode, language, and uiScale to cookies for native integration
        try {
            document.cookie = `updateMode=${encodeURIComponent(this.settings.updateMode)}; path=/; max-age=31536000; SameSite=Lax`;
            document.cookie = `language=${encodeURIComponent(this.settings.language)}; path=/; max-age=31536000; SameSite=Lax`;
            document.cookie = `uiScale=${encodeURIComponent(this.settings.uiScale)}; path=/; max-age=31536000; SameSite=Lax`;
        } catch (cookieError) {
            console.warn('PersistentStorage: Failed to set cookies (ignored in this environment):', cookieError);
        }

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

        const toggleAdultBtn = document.getElementById('toggle-adult-btn');
        if (toggleAdultBtn) {
            toggleAdultBtn.onclick = (e) => {
                e.preventDefault();
                this.settings.includeAdult = !this.settings.includeAdult;
                this.saveSettings();
                this.updateDisplays();
                if (window.i18n) {
                    const status = this.settings.includeAdult 
                        ? (window.i18n.t('settings.adultContentOn') || 'On')
                        : (window.i18n.t('settings.adultContentOff') || 'Off');
                    Toast.show(`${window.i18n.t('settings.adultContent')}: ${status}`);
                }
            };
        }

        // JS Handler: Binds click action to toggle the data saver setting state
        const toggleDataSaverBtn = document.getElementById('toggle-datasaver-btn');
        if (toggleDataSaverBtn) {
            toggleDataSaverBtn.onclick = (e) => {
                e.preventDefault();
                this.settings.dataSaver = !this.settings.dataSaver;
                this.saveSettings();
                this.updateDisplays();
                if (window.i18n) {
                    const status = this.settings.dataSaver 
                        ? (window.i18n.t('settings.adultContentOn') || 'On')
                        : (window.i18n.t('settings.adultContentOff') || 'Off');
                    Toast.show(`${window.i18n.t('settings.dataSaver')}: ${status}`);
                }
                
                // Dispatch a global event so that dynamic images/network helpers reload/adjust instantly
                window.dispatchEvent(new CustomEvent('datasaverchanged', { detail: this.settings.dataSaver }));
            };
        }

        const decBtn = document.getElementById('dec-uiscale-btn');
        if (decBtn) {
            decBtn.onclick = () => {
                let currentScale = parseFloat(this.settings.uiScale || '1.0');
                currentScale = Math.max(0.5, Math.round((currentScale - 0.1) * 10) / 10);
                this.settings.uiScale = currentScale.toFixed(1);
                this.saveSettings();
                this.updateDisplays();
            };
        }

        const incBtn = document.getElementById('inc-uiscale-btn');
        if (incBtn) {
            incBtn.onclick = () => {
                let currentScale = parseFloat(this.settings.uiScale || '1.0');
                currentScale = Math.min(2.0, Math.round((currentScale + 0.1) * 10) / 10);
                this.settings.uiScale = currentScale.toFixed(1);
                this.saveSettings();
                this.updateDisplays();
            };
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
     * Executes the update check action, opening the developer version selector or checking for general updates.
     * It updates checking state and handles the visibility of trigger buttons and loaders.
     */
    handleMainUpdateAction() {
        if (this.settings.updateMode === 'advanced') {
            this.openVersionSelector();
            return;
        }

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

        import('../js/updater.js').then(({ Updater }) => {
            Updater.checkForUpdates(true);
        }).catch(err => {
            console.error('Settings: Failed to load updater', err);
            this.handleUpdateError();
        });
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
            const fullName = names[this.settings.language] || this.settings.language;
            // Parses the language name string (e.g. "🇺🇸 English") using regional indicator surrogate pairs
            // to extract and wrap the flag emoji in a custom span for polyfilled Windows rendering compatibility.
            const flagMatch = fullName.match(/^([\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF])\s+(.*)$/);
            if (flagMatch) {
                langDisplay.innerHTML = `<span class="display-flag-span">${flagMatch[1]}</span><span class="display-lang-name">${flagMatch[2]}</span>`;
            } else {
                langDisplay.textContent = fullName;
            }
        }

        const colorDisplay = document.getElementById('current-color-display');
        if (colorDisplay) {
            colorDisplay.style.backgroundColor = this.settings.accentColor || 'var(--primary-color)';
            colorDisplay.textContent = '';
        }

        const scaleDisplay = document.getElementById('current-uiscale-display');
        if (scaleDisplay) {
            const pct = Math.round(parseFloat(this.settings.uiScale || '1.0') * 100);
            scaleDisplay.textContent = `${pct}%`;
        }
        
        const toggleAdultInput = document.getElementById('adult-toggle-input');
        if (toggleAdultInput) {
            const isAdult = this.settings.includeAdult === true || this.settings.includeAdult === 'true';
            toggleAdultInput.checked = isAdult;
        }

        // JS Update: Synchronizes the data saver toggle switch element state
        const toggleDataSaverInput = document.getElementById('datasaver-toggle-input');
        if (toggleDataSaverInput) {
            const isDataSaver = this.settings.dataSaver === true || this.settings.dataSaver === 'true';
            toggleDataSaverInput.checked = isDataSaver;
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
                if (checkLabel) checkLabel.textContent = window.i18n?.t('settings.checkNow') || 'Check for Updates';
                if (checkDesc) checkDesc.textContent = 'Choose any branch or release build to install';
            } else {
                if (checkBtn) checkBtn.textContent = window.i18n?.t('settings.checkButton') || 'Check Now';
                if (checkLabel) checkLabel.textContent = window.i18n?.t('settings.checkNow') || 'Check for Updates';
                if (checkDesc) checkDesc.textContent = window.i18n?.t('settings.checkNowDesc') || 'Manually search for updates';
            }
        }

        VersionManager.getInstance().bindDisplayElement('app-version-display');
    }

    /**
     * Opens the version selector modal, fetches all available releases from the GitHub API,
     * and populates the modal grid with focusable version selection chips.
     */
    async openVersionSelector() {
        console.log('Settings: Opening version selector modal');
        this.triggeringButton = document.getElementById('check-updates-btn');
        this.openModal('version-selector-modal');

        const loader = document.getElementById('version-list-loader');
        const grid = document.getElementById('version-options');

        if (loader) {
            loader.style.display = 'flex';
        }
        if (grid) {
            grid.style.display = 'none';
            grid.innerHTML = '';
        }

        try {
            console.log('Settings: Fetching fresh releases list from GitHub');
            const res = await fetch(`https://api.github.com/repos/kenjikellens/IVIDS/releases?t=${Date.now()}`);
            if (!res.ok) throw new Error(`HTTP error ${res.status}`);
            
            const releases = await res.json();
            console.log(`Settings: Retreived ${releases.length} releases successfully`);

            // Fetch current app version dynamically via VersionManager
            const currentInstalledVersion = await VersionManager.getInstance().getVersion();

            if (loader) loader.style.display = 'none';
            if (grid) {
                grid.style.display = 'flex';
                
                // Add the top chip: Active Branch Build (Main Branch)
                const branchCard = document.createElement('div');
                branchCard.className = 'card card--panel chip chip--option focusable';
                branchCard.dataset.value = 'branch';
                branchCard.innerHTML = `
                    <div class="version-chip-content">
                        <span class="version-chip-title">${window.i18n?.t('settings.branchBuild') || 'Live Branch Build'}</span>
                        <div class="version-chip-desc">${window.i18n?.t('settings.branchBuildDesc') || 'Direct main branch IVIDS.apk build'}</div>
                    </div>
                `;
                
                branchCard.onclick = () => {
                    const anchor = this.triggeringButton || document.getElementById('check-updates-btn');
                    this.closeModal();
                    console.log('Settings: Selected branch build');
                    if (window.AndroidUpdate && typeof window.AndroidUpdate.clearCachedApk === 'function') {
                        window.AndroidUpdate.clearCachedApk();
                    }
                    window.latestUpdateDownloadUrl = 'https://github.com/kenjikellens/IVIDS/raw/main/IVIDS.apk';
                    window.latestUpdateVersion = 'Branch';
                    window.latestRelease = {
                        tag_name: 'Branch',
                        name: window.i18n?.t('settings.branchBuild') || 'Live Branch Build',
                        body: window.i18n?.t('settings.branchBuildDesc') || 'Direct main branch IVIDS.apk build.'
                    };
                    import('../js/update-prompt.js').then(({ UpdatePrompt }) => {
                        UpdatePrompt.show('Branch', anchor);
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
                releases.forEach((rel) => {
                    // Find the APK asset
                    const apkAsset = rel.assets.find(asset => asset.name.endsWith('.apk'));
                    const downloadUrl = apkAsset ? apkAsset.browser_download_url : null;
                    
                    if (downloadUrl) {
                        const date = new Date(rel.published_at).toLocaleDateString();
                        const isInstalled = currentInstalledVersion && currentInstalledVersion.includes(rel.tag_name);
                        const appliedIconHtml = isInstalled ? '<img src="svg/check-circle.svg" class="version-applied-icon" alt="Installed" />' : '';

                        const relCard = document.createElement('div');
                        relCard.className = 'card card--panel chip chip--option focusable';
                        relCard.dataset.value = rel.tag_name;
                        
                        relCard.innerHTML = `
                            <div class="version-chip-content">
                                <div class="version-chip-header">
                                    <span class="version-date-label">${rel.tag_name} • ${date}</span>
                                </div>
                                <span class="version-chip-title">${rel.name || rel.tag_name}</span>
                            </div>
                            ${appliedIconHtml}
                        `;

                        relCard.onclick = () => {
                            const anchor = this.triggeringButton || document.getElementById('check-updates-btn');
                            this.closeModal();
                            console.log(`Settings: Selected version ${rel.tag_name} via ${downloadUrl}`);
                            window.latestUpdateDownloadUrl = downloadUrl;
                            window.latestUpdateVersion = rel.tag_name;
                            window.latestRelease = rel;
                            import('../js/update-prompt.js').then(({ UpdatePrompt }) => {
                                UpdatePrompt.show(rel.tag_name, anchor);
                            }).catch(err => {
                                console.error('Settings: Failed to load update-prompt.js', err);
                                if (window.AndroidUpdate) {
                                    if (typeof window.AndroidUpdate.downloadAndInstallForUrlAndVersion === 'function') {
                                        window.AndroidUpdate.downloadAndInstallForUrlAndVersion(downloadUrl, rel.tag_name);
                                    } else {
                                        window.AndroidUpdate.downloadAndInstallForUrl(downloadUrl);
                                    }
                                } else {
                                    window.open(downloadUrl, '_blank');
                                }
                            });
                        };

                        grid.appendChild(relCard);
                    }
                });

                // Set initial spatial focus directly on the top version card (Active Branch Build)
                if (window.SpatialNav) {
                    window.SpatialNav.setFocusTrap(document.getElementById('version-selector-modal'));
                    if (branchCard) {
                        window.SpatialNav.setFocus(branchCard);
                    } else {
                        window.SpatialNav.refocus();
                    }
                }
            }
        } catch (err) {
            console.error('Settings: Failed to load versions', err);
            if (loader) loader.style.display = 'none';
            if (grid) {
                grid.style.display = 'flex';
                grid.innerHTML = `
                    <div class="version-fetch-error">
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
                if (window.SpatialNav) {
                    window.SpatialNav.setFocusTrap(prevModal);
                    window.SpatialNav.refocus();
                }
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
                    const input = document.querySelector(`.provider-item[data-id="${newItem.id}"] .form-input`);
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
                    const input = document.querySelector(`.provider-item[data-id="${newItem.id}"] .form-input`);
                    if (input) {
                        input.focus();
                        if (window.SpatialNav) window.SpatialNav.setFocus(input);
                    }
                };
            }
        } else if (modalId === 'language-modal') {
            const flagEl = document.getElementById('lang-stepper-flag');
            const nameEl = document.getElementById('lang-stepper-name');
            const updateLangStepper = () => {
                const currentCode = this.pendingSettings.language || 'en';
                const opt = LANGUAGE_OPTIONS.find(l => l.code === currentCode) || LANGUAGE_OPTIONS.find(l => l.code === 'en') || { code: 'en', name: '🇺🇸 English' };
                const flagMatch = opt.name.match(/^([\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF])\s+(.*)$/);
                if (flagMatch) {
                    if (flagEl) flagEl.textContent = flagMatch[1];
                    if (nameEl) nameEl.textContent = flagMatch[2];
                } else {
                    if (flagEl) flagEl.textContent = '';
                    if (nameEl) nameEl.textContent = opt.name;
                }
            };
            updateLangStepper();

            const prevBtn = document.getElementById('lang-prev-btn');
            if (prevBtn) {
                prevBtn.onclick = (e) => {
                    e.stopPropagation();
                    let idx = LANGUAGE_OPTIONS.findIndex(l => l.code === (this.pendingSettings.language || 'en'));
                    if (idx === -1) idx = 0;
                    idx = (idx - 1 + LANGUAGE_OPTIONS.length) % LANGUAGE_OPTIONS.length;
                    this.pendingSettings.language = LANGUAGE_OPTIONS[idx].code;
                    updateLangStepper();
                };
            }

            const nextBtn = document.getElementById('lang-next-btn');
            if (nextBtn) {
                nextBtn.onclick = (e) => {
                    e.stopPropagation();
                    let idx = LANGUAGE_OPTIONS.findIndex(l => l.code === (this.pendingSettings.language || 'en'));
                    if (idx === -1) idx = 0;
                    idx = (idx + 1) % LANGUAGE_OPTIONS.length;
                    this.pendingSettings.language = LANGUAGE_OPTIONS[idx].code;
                    updateLangStepper();
                };
            }
        } else {
            modal.querySelectorAll('.chip--option, .option-chip').forEach(chip => {
                const val = chip.getAttribute('data-value');
                chip.onclick = (e) => {
                    e.stopPropagation();
                    this.setPending(key, val, chip);
                };
            });
        }

        this.syncActiveChips(modalId);

        let focusTarget = null;
        if (modalId === 'language-modal') {
            focusTarget = document.getElementById('lang-next-btn') || document.getElementById('lang-prev-btn');
        } else if (modalId === 'color-modal' || modalId === 'update-mode-modal') {
            focusTarget = modal.querySelector('.chip--option.is-active, .chip--option.active, .option-chip.active');
        } else if (modalId === 'player-modal') {
            focusTarget = modal.querySelector('.form-input, .provider-url-input') || document.getElementById('add-provider-btn');
        } else if (modalId === 'm3u-modal') {
            focusTarget = modal.querySelector('.form-input, .provider-url-input') || document.getElementById('add-m3u-btn');
        } else if (modalId === 'app-info-modal') {
            focusTarget = modal.querySelector('.modal__footer .btn--secondary, .modal-footer .btn--secondary, .modal-footer .btn-secondary');
        } else if (modalId === 'changes-modal') {
            focusTarget = modal.querySelector('.modal__footer .btn--secondary, .modal-footer .btn--secondary, .modal-footer .btn-secondary') || modal.querySelector('.modal__close, .modal-close-x');
        }

        const innerClose = manageModal(modal, focusTarget, () => this.closeModal());

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

        const cancelBtn = modal.querySelector('.cancel-icon-btn') || modal.querySelector('.modal__footer .btn--secondary, .modal-footer .btn--secondary, .modal-footer .btn-secondary') || modal.querySelector('.modal__footer .modal-btn.secondary, .modal-footer .modal-btn.secondary') || modal.querySelector('.modal__footer .action-btn.secondary, .modal-footer .action-btn.secondary');
        if (cancelBtn) {
            cancelBtn.onclick = (e) => {
                e.stopPropagation();
                this.closeModal();
            };
        }

        const closeXBtn = modal.querySelector('.modal__close, .modal-close-x');
        if (closeXBtn) {
            closeXBtn.onclick = (e) => {
                e.stopPropagation();
                this.closeModal();
            };
        }
        const applyBtn = modal.querySelector('.apply-icon-btn') || modal.querySelector('.modal__footer .btn--primary, .modal-footer .btn--primary, .modal-footer .btn-primary') || modal.querySelector('.modal__footer .modal-btn.primary, .modal-footer .modal-btn.primary') || modal.querySelector('.modal__footer .action-btn.primary, .modal-footer .action-btn.primary');
        if (applyBtn) {
            applyBtn.onclick = (e) => {
                e.stopPropagation();
                this.applyPending(key);
            };
        }
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

        modal.querySelectorAll('.chip--option, .option-chip').forEach(chip => {
            const chipValue = chip.getAttribute('data-value');
            const matchValue = typeof value === 'boolean' ? String(value) : value;
            if (chipValue === matchValue) {
                chip.classList.add('is-active', 'active');
            } else {
                chip.classList.remove('is-active', 'active');
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
            el.parentElement.querySelectorAll('.chip--option, .option-chip').forEach(chip => chip.classList.remove('is-active', 'active'));
            el.classList.add('is-active', 'active');
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
        let newValue = this.pendingSettings[key];
        if (key === 'includeAdult') {
            newValue = newValue === 'true' || newValue === true;
        } else if (key === 'dataSaver') {
            newValue = newValue === 'true' || newValue === true;
        }
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
            item.className = 'provider-item';
            if (this.movingProviderId === provider.id) {
                item.classList.add('moving');
            }
            item.dataset.id = provider.id;

            const input = document.createElement('input');
            input.type = 'url';
            input.className = 'form-input focusable';
            input.value = provider.url || '';
            input.placeholder = 'https://example.com/embed';
            input.oninput = (e) => {
                provider.url = e.target.value;
            };

            const actions = document.createElement('div');
            actions.className = 'provider-actions';

            const moveBtn = document.createElement('button');
            moveBtn.className = 'btn btn--secondary btn--circle edit-trigger provider-move-btn focusable';
            moveBtn.innerHTML = '<img src="svg/move.svg" class="setting-edit-icon" alt="Move" />';
            moveBtn.title = 'Move';
            if (this.movingProviderId === provider.id) {
                moveBtn.classList.add('active-moving');
            }

            moveBtn.onclick = (e) => {
                e.stopPropagation();
                if (moveBtn._justDragged) return;
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
            this.attachDragHandlers(item, moveBtn, 'playerProviders', provider.id);

            if (provider.isCustom) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn--secondary btn--circle edit-trigger provider-delete-btn focusable';
                deleteBtn.innerHTML = '<img src="svg/trash.svg" class="setting-edit-icon" alt="Delete" />';
                deleteBtn.title = 'Delete';
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
            item.className = 'provider-item';
            if (this.movingM3uId === playlist.id) {
                item.classList.add('moving');
            }
            item.dataset.id = playlist.id;

            const input = document.createElement('input');
            input.type = 'url';
            input.className = 'form-input focusable';
            input.value = playlist.url || '';
            input.placeholder = 'https://example.com/playlist.m3u';
            input.oninput = (e) => {
                playlist.url = e.target.value;
            };

            const actions = document.createElement('div');
            actions.className = 'provider-actions';

            const moveBtn = document.createElement('button');
            moveBtn.className = 'btn btn--secondary btn--circle edit-trigger provider-move-btn focusable';
            moveBtn.innerHTML = '<img src="svg/move.svg" class="setting-edit-icon" alt="Move" />';
            moveBtn.title = 'Move';
            if (this.movingM3uId === playlist.id) {
                moveBtn.classList.add('active-moving');
            }

            moveBtn.onclick = (e) => {
                e.stopPropagation();
                if (moveBtn._justDragged) return;
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
            this.attachDragHandlers(item, moveBtn, 'm3uPlaylists', playlist.id);

            if (playlist.isCustom) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'btn btn--secondary btn--circle edit-trigger provider-delete-btn focusable';
                deleteBtn.innerHTML = '<img src="svg/trash.svg" class="setting-edit-icon" alt="Delete" />';
                deleteBtn.title = 'Delete';
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
     * Attaches mouse/touch pointer drag handlers to reorder provider or playlist items with the cursor.
     * Allows seamless click-and-drag reordering with mouse while preserving click/Enter for TV remote navigation.
     * @param {HTMLElement} item - The item container DOM element.
     * @param {HTMLElement} moveBtn - The move button handle.
     * @param {string} key - 'playerProviders' or 'm3uPlaylists'.
     * @param {string} id - The unique ID of the provider or playlist.
     */
    attachDragHandlers(item, moveBtn, key, id) {
        let isDragging = false;
        let startClientY = 0;
        let dragOffset = 0;
        let listContainer = item.parentElement;

        const onPointerMove = (e) => {
            const deltaY = e.clientY - startClientY;
            if (!isDragging) {
                if (Math.abs(deltaY) > 4) {
                    isDragging = true;
                    item.classList.add('moving', 'dragging');
                    item.style.pointerEvents = 'none';
                }
            }

            if (isDragging) {
                item.style.transform = `translateY(${deltaY + dragOffset}px)`;

                const targetEl = document.elementFromPoint(e.clientX, e.clientY);
                const sibling = targetEl ? targetEl.closest('.provider-item') : null;

                if (sibling && sibling !== item && sibling.parentElement === listContainer) {
                    const list = this.pendingSettings[key];
                    const fromIdx = list.findIndex(p => p.id === id);
                    const toIdx = list.findIndex(p => p.id === sibling.dataset.id);

                    if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
                        const oldRect = item.getBoundingClientRect();
                        const temp = list[fromIdx];
                        list[fromIdx] = list[toIdx];
                        list[toIdx] = temp;

                        if (fromIdx < toIdx) {
                            sibling.after(item);
                        } else {
                            sibling.before(item);
                        }

                        const newRect = item.getBoundingClientRect();
                        dragOffset += (oldRect.top - newRect.top);
                        item.style.transform = `translateY(${deltaY + dragOffset}px)`;
                    }
                }
            }
        };

        const onPointerUp = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);

            if (isDragging) {
                isDragging = false;
                item.classList.remove('dragging');
                item.style.transform = '';
                item.style.pointerEvents = '';

                moveBtn._justDragged = true;
                setTimeout(() => {
                    delete moveBtn._justDragged;
                }, 120);

                if (key === 'playerProviders') {
                    this.renderPlayerProviders();
                } else {
                    this.renderM3uPlaylists();
                }

                const newBtn = document.querySelector(`.provider-item[data-id="${id}"] .provider-move-btn`);
                if (newBtn) {
                    newBtn.focus();
                    if (window.SpatialNav) window.SpatialNav.setFocus(newBtn);
                }
            }
        };

        const onPointerDown = (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('input, .provider-delete-btn')) return;

            startClientY = e.clientY;
            dragOffset = 0;
            listContainer = item.parentElement;

            window.addEventListener('pointermove', onPointerMove);
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('pointercancel', onPointerUp);
        };

        moveBtn.addEventListener('pointerdown', onPointerDown);
        item.addEventListener('pointerdown', onPointerDown);
    }

    /**
     * Swaps the position of an item in the pending settings array with its neighbor to adjust its priority.
     * Smoothly animates the two swapping elements in the DOM before updating data and focus.
     * @param {string} key - The settings key (playerProviders or m3uPlaylists).
     * @param {string} id - The ID of the item to move.
     * @param {number} direction - The index delta (-1 for up, 1 for down).
     */
    moveItem(key, id, direction) {
        if (this._isAnimatingMove) return;

        const list = this.pendingSettings[key];
        const index = list.findIndex(p => p.id === id);
        if (index === -1) return;

        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= list.length) return;

        const containerId = key === 'playerProviders' ? 'player-providers-list' : 'm3u-playlists-list';
        const container = document.getElementById(containerId);
        if (!container) return;

        const items = Array.from(container.querySelectorAll('.provider-item'));
        const currentItem = items[index];
        const targetItem = items[targetIndex];

        if (!currentItem || !targetItem) return;

        this._isAnimatingMove = true;

        // Calculate exact distance to slide based on element heights and gaps
        const currentRect = currentItem.getBoundingClientRect();
        const targetRect = targetItem.getBoundingClientRect();
        const deltaCurrent = targetRect.top - currentRect.top;
        const deltaTarget = currentRect.top - targetRect.top;

        // Animate both elements simultaneously with smooth bezier transition
        currentItem.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)';
        targetItem.style.transition = 'transform 200ms cubic-bezier(0.2, 0, 0, 1)';
        currentItem.style.zIndex = '30';
        targetItem.style.zIndex = '10';

        currentItem.style.transform = `translateY(${deltaCurrent}px)`;
        targetItem.style.transform = `translateY(${deltaTarget}px)`;

        // Swap the data in pendingSettings
        const temp = list[index];
        list[index] = list[targetIndex];
        list[targetIndex] = temp;

        setTimeout(() => {
            if (key === 'playerProviders') {
                this.renderPlayerProviders();
            } else {
                this.renderM3uPlaylists();
            }

            this._isAnimatingMove = false;

            const btn = document.querySelector(`.provider-item[data-id="${id}"] .provider-move-btn`);
            if (btn) {
                btn.focus();
                if (window.SpatialNav) window.SpatialNav.setFocus(btn);
            }
        }, 205);
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
        document.documentElement.style.setProperty('--ui-scale', this.settings.uiScale || '1.0');
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
            mainDoc.documentElement.style.setProperty('--ui-scale', this.settings.uiScale || '1.0');
        } catch (e) {
            console.log('Cross-origin iframe parent access restricted, applying configurations to local document viewport only.');
            document.documentElement.style.setProperty('--primary-color', this.settings.accentColor);
            const hex = this.settings.accentColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
            document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
            document.documentElement.setAttribute('lang', this.settings.language);
            document.documentElement.style.setProperty('--ui-scale', this.settings.uiScale || '1.0');
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
