console.log('Settings.js: Script loaded');
import { SpatialNav } from '../js/spatial-nav.js';

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
        this.initializeUI();
        this.applySettings();
    }

    /**
     * Loads settings from localStorage with default fallbacks.
     * @returns {object} Loaded configuration settings.
     */
    loadSettings() {
        const defaultSettings = {
            language: 'en',
            accentColor: '#46d369',
            updateMode: 'manual',
            m3uUrl: '',
            playerProvider: 'custom',
            playerBaseUrl: 'https://vidlink.pro'
        };
        try {
            const saved = localStorage.getItem('ivids-settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Auto-migrate from blocked vidsrc domains
                if (parsed.playerBaseUrl && parsed.playerBaseUrl.includes('vidsrc')) {
                    parsed.playerBaseUrl = 'https://vidlink.pro';
                }
                return { ...defaultSettings, ...parsed };
            }
            return defaultSettings;
        } catch (e) { return defaultSettings; }
    }

    /**
     * Saves active settings configurations to disk and broadcasts changes.
     */
    saveSettings() {
        localStorage.setItem('ivids-settings', JSON.stringify(this.settings));
        this.applySettingsGlobally();
    }

    /**
     * Sets up DOM click handlers programmatically to bypass fragile inline HTML triggers.
     */
    initializeUI() {
        this.renderLanguageOptions();

        // Appearance Modals Triggers
        const editLangBtn = document.getElementById('edit-language-btn');
        if (editLangBtn) {
            editLangBtn.onclick = () => this.openModal('language-modal');
        }

        const editColorBtn = document.getElementById('edit-color-btn');
        if (editColorBtn) {
            editColorBtn.onclick = () => this.openModal('color-modal');
        }

        const editUpdateModeBtn = document.getElementById('edit-update-mode-btn');
        if (editUpdateModeBtn) {
            editUpdateModeBtn.onclick = () => this.openModal('update-mode-modal');
        }

        const updatesSection = document.getElementById('app-updates-section');
        if (updatesSection && !window.AndroidUpdate) {
            updatesSection.style.display = 'none';
        }

        const checkBtn = document.getElementById('check-updates-btn');
        if (checkBtn) {
            checkBtn.onclick = () => this.handleMainUpdateAction();
        }

        const cancelBtn = document.getElementById('cancel-update-btn');
        if (cancelBtn) {
            cancelBtn.onclick = () => this.handleCancelUpdate();
        }

        const m3uInput = document.getElementById('m3u-url-input');
        if (m3uInput) {
            m3uInput.value = this.settings.m3uUrl || '';
            m3uInput.onchange = (e) => this.settings.m3uUrl = e.target.value;
        }

        const saveM3uBtn = document.getElementById('save-m3u-btn');
        if (saveM3uBtn) {
            saveM3uBtn.onclick = () => {
                const val = document.getElementById('m3u-url-input')?.value;
                this.settings.m3uUrl = val;
                this.saveSettings();
                alert(window.i18n?.t('settings.saved') || 'Settings saved!');
            };
        }

        const clearM3uBtn = document.getElementById('clear-m3u-btn');
        if (clearM3uBtn) {
            clearM3uBtn.onclick = () => {
                this.settings.m3uUrl = '';
                if (m3uInput) m3uInput.value = '';
                this.saveSettings();
            };
        }

        const playerBaseInput = document.getElementById('player-base-url-input');
        if (playerBaseInput) {
            playerBaseInput.value = this.settings.playerBaseUrl || '';
            playerBaseInput.onchange = (e) => this.settings.playerBaseUrl = e.target.value.trim().replace(/\/+$/, '');
        }

        const savePlayerBtn = document.getElementById('save-player-btn');
        if (savePlayerBtn) {
            savePlayerBtn.onclick = () => {
                const val = document.getElementById('player-base-url-input')?.value?.trim().replace(/\/+$/, '');
                this.settings.playerProvider = 'custom';
                this.settings.playerBaseUrl = val || 'https://vidlink.pro';
                this.saveSettings();
                alert(window.i18n?.t('settings.saved') || 'Settings saved!');
            };
        }

        const resetPlayerBtn = document.getElementById('reset-player-btn');
        if (resetPlayerBtn) {
            resetPlayerBtn.onclick = () => {
                this.settings.playerProvider = 'custom';
                this.settings.playerBaseUrl = 'https://vidlink.pro';
                if (playerBaseInput) playerBaseInput.value = this.settings.playerBaseUrl;
                this.saveSettings();
            };
        }

        this.updateDisplays();
    }

    /**
     * Populates the HTML dynamic grid chips list for Language.
     */
    renderLanguageOptions() {
        const languageOptions = document.getElementById('language-options');
        if (!languageOptions) return;

        languageOptions.innerHTML = LANGUAGE_OPTIONS.map(({ code, name }) => (
            `<div class="option-chip focusable" data-value="${code}">${name}</div>`
        )).join('');
    }

    /**
     * Executes checking or fetching APK update files.
     */
    handleMainUpdateAction() {
        if (!window.AndroidUpdate) return;

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
            window.AndroidUpdate.downloadFromRepo();
        } else {
            window.AndroidUpdate.checkForUpdates();
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
     * Synchronizes display UI elements with cached configuration variables.
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
                if (checkBtn) checkBtn.textContent = window.i18n?.t('settings.downloadButton') || 'Download';
                if (checkLabel) checkLabel.textContent = window.i18n?.t('settings.downloadRepo') || 'Download from Repo';
                if (checkDesc) checkDesc.textContent = window.i18n?.t('settings.downloadRepoDesc') || 'Download latest APK directly';
            } else {
                if (checkBtn) checkBtn.textContent = window.i18n?.t('settings.checkButton') || 'Check Now';
                if (checkLabel) checkLabel.textContent = window.i18n?.t('settings.checkNow') || 'Check for Updates';
                if (checkDesc) checkDesc.textContent = window.i18n?.t('settings.checkNowDesc') || 'Manually search for updates';
            }
        }
    }

    /**
     * Opens a focused dialog modal programmatically and attaches programmatic click routes.
     * 
     * @param {string} modalId - The unique DOM selector ID of the target dialog modal.
     */
    openModal(modalId) {
        console.log('--- OPENING MODAL:', modalId, '---');
        const modal = document.getElementById(modalId);
        console.log('1. Modal Element Resolution:', modal);
        if (!modal) {
            console.error('CRITICAL: Element with ID "' + modalId + '" not found in DOM! Checking settings.html injection.');
            return;
        }

        this.currentModal = modal;
        this.modalOriginalParent = modal.parentElement;
        console.log('2. Original Parent before Portal:', this.modalOriginalParent ? (this.modalOriginalParent.id || this.modalOriginalParent.className || this.modalOriginalParent.tagName) : 'none');

        // Port modal to document.body to escape any parent container stacking context or overflow clipping!
        document.body.appendChild(modal);
        console.log('3. Portaled to body successfully. Current parent is:', modal.parentElement ? modal.parentElement.tagName : 'none');

        // Force direct inline visibility styles to override any stylesheet conflicts!
        modal.style.setProperty('display', 'flex', 'important');
        modal.style.setProperty('visibility', 'visible', 'important');
        modal.style.setProperty('z-index', '99999', 'important');

        this.pendingSettings = { ...this.settings };

        const keyMap = {
            'language-modal': 'language',
            'color-modal': 'accentColor',
            'update-mode-modal': 'updateMode'
        };
        const key = keyMap[modalId] || modalId.replace('-modal', '');

        // 1. Programmatic Chip Click Bindings
        modal.querySelectorAll('.option-chip').forEach(chip => {
            const val = chip.getAttribute('data-value');
            chip.onclick = (e) => {
                e.stopPropagation();
                this.setPending(key, val, chip);
            };
        });

        // 2. Programmatic Overlay Click Binding (Click outside to close)
        modal.onclick = (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        };

        // 3. Programmatic Footer Action Bindings
        const cancelBtn = modal.querySelector('.modal-btn.secondary') || modal.querySelector('.action-btn.secondary');
        if (cancelBtn) {
            cancelBtn.onclick = (e) => {
                e.stopPropagation();
                this.closeModal();
            };
        }

        const applyBtn = modal.querySelector('.modal-btn.primary') || modal.querySelector('.action-btn.primary');
        if (applyBtn) {
            applyBtn.onclick = (e) => {
                e.stopPropagation();
                this.applyPending(key);
            };
        }

        this.syncActiveChips(modalId);

        // Coordinate smooth opacity fade-in transition
        setTimeout(() => {
            modal.style.setProperty('opacity', '1', 'important');
            modal.classList.add('active', 'show');

            // Collect exact computed dimensions and rendering rules
            const rect = modal.getBoundingClientRect();
            const comp = window.getComputedStyle(modal);
            console.log('--- 📊 MODAL LAYOUT & RENDER DIAGNOSTICS ---');
            console.log('A. POSITION & COORDINATES:', {
                width: rect.width + 'px',
                height: rect.height + 'px',
                top: rect.top + 'px',
                left: rect.left + 'px',
                bottom: rect.bottom + 'px',
                right: rect.right + 'px'
            });
            console.log('B. COMPUTED RENDERING RULES:', {
                display: comp.display,
                visibility: comp.visibility,
                opacity: comp.opacity,
                zIndex: comp.zIndex,
                position: comp.position,
                pointerEvents: comp.pointerEvents,
                backgroundColor: comp.backgroundColor
            });
            console.log('C. PARENT TREE DOM:', modal.parentElement ? modal.parentElement.outerHTML.substring(0, 150) + '...' : 'null');
            console.log('--------------------------------------------');
        }, 50);
        SpatialNav.setFocusTrap(modal);
        SpatialNav.focusFirst();
    }

    /**
     * Highlights the chip matches.
     * 
     * @param {string} modalId - Selected Modal element.
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
     */
    closeModal() {
        if (!this.currentModal) return;
        const modal = this.currentModal;
        modal.classList.remove('show');
        modal.style.setProperty('opacity', '0', 'important');
        setTimeout(() => {
            modal.classList.remove('active');
            modal.style.setProperty('display', 'none', 'important');
            modal.style.setProperty('visibility', 'hidden', 'important');
            
            // Safely move modal back to its original parent so it is cleared during page changes
            if (this.modalOriginalParent && this.modalOriginalParent.appendChild) {
                this.modalOriginalParent.appendChild(modal);
            }
        }, 300);
        SpatialNav.clearFocusTrap();
        SpatialNav.refocus();
        this.currentModal = null;
    }



    /**
     * Updates modal temporary state options.
     * 
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
    }

    /**
     * Saves pending changes to disk, applies translations, and injects styling rules.
     * 
     * @param {string} key - Active configuration key.
     */
    async applyPending(key) {
        console.log(`Applying pending settings for ${key}`);
        const newValue = this.pendingSettings[key];
        this.settings[key] = newValue;

        this.saveSettings();

        if (key === 'language' && window.i18n) {
            await window.i18n.setLanguage(newValue);
        } else if (key === 'accentColor') {
            this.applySettings();
        }

        this.updateDisplays();
        this.closeModal();
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
     * WebView update notifications receiver.
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
                if (window.AndroidUpdate) {
                    window.AndroidUpdate.downloadAndInstall();
                }
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
