console.log('Settings.js: Script loaded');
import { SpatialNav } from '../js/spatial-nav.js';

let settingsManagerInstance = null;

// Settings page initialization
export async function init() {
    console.log('Settings page init() called');
    if (window.i18n && window.i18n.translations) {
        window.i18n.applyTranslations();
    }
    settingsManagerInstance = new SettingsManager();
}

// Global functions for HTML onclick attributes
window.openSettingsModal = (id) => settingsManagerInstance?.openModal(id);
window.closeSettingsModal = () => settingsManagerInstance?.closeModal();
window.setPendingSetting = (key, value, el) => settingsManagerInstance?.setPending(key, value, el);
window.applyPendingSetting = (key) => settingsManagerInstance?.applyPending(key);

// Update Callbacks
window.onUpdateStatus = (statusKey) => settingsManagerInstance?.handleUpdateStatus(statusKey);
window.onUpdateFound = (version) => settingsManagerInstance?.handleUpdateFound(version);
window.onNoUpdateFound = () => settingsManagerInstance?.handleNoUpdateFound();
window.onUpdateCheckError = () => settingsManagerInstance?.handleUpdateError();

class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
        this.pendingSettings = {};
        this.currentModal = null;
        this.isCheckingUpdates = false;
        this.initializeUI();
        this.applySettings();
    }

    loadSettings() {
        const defaultSettings = { language: 'en', accentColor: '#46d369', updateMode: 'manual', m3uUrl: '' };
        try {
            const saved = localStorage.getItem('ivids-settings');
            return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
        } catch (e) { return defaultSettings; }
    }

    saveSettings() {
        localStorage.setItem('ivids-settings', JSON.stringify(this.settings));
        this.applySettingsGlobally();
    }

    initializeUI() {
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

        this.updateDisplays();
    }

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

        // Inject loader container
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

    updateDisplays() {
        const langDisplay = document.getElementById('current-language-display');
        if (langDisplay) {
            const names = {
                en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', nl: 'Nederlands',
                it: 'Italiano', ru: 'Русский', pt: 'Português', zh: '中文', ja: '日本語',
                hi: 'हिन्दी', ar: 'العربية', ko: '한국어', tr: 'Türkçe', vi: 'Tiếng Việt', id: 'Bahasa Indonesia',
                ro: 'Română', pl: 'Polski', da: 'Dansk', sv: 'Svenska', no: 'Norsk', cs: 'Čeština'
            };
            langDisplay.textContent = names[this.settings.language] || this.settings.language;
        }

        const colorDisplay = document.getElementById('current-color-display');
        if (colorDisplay) {
            colorDisplay.style.borderBottomColor = this.settings.accentColor;
            colorDisplay.setAttribute('data-i18n', 'settings.accent');
            if (window.i18n) window.i18n.applyTranslations(colorDisplay);
        }

        const modeDisplay = document.getElementById('current-update-mode-display');
        if (modeDisplay) {
            modeDisplay.textContent = window.i18n?.t(`settings.mode.${this.settings.updateMode}`) || this.settings.updateMode;
        }

        const manualContainer = document.getElementById('manual-check-container');
        if (manualContainer) {
            const isManualOrAdvanced = this.settings.updateMode === 'manual' || this.settings.updateMode === 'advanced';
            manualContainer.style.display = isManualOrAdvanced ? 'flex' : 'none';

            // Update button text and description if in advanced mode
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

    openModal(modalId) {
        console.log('Opening modal:', modalId);
        const modal = document.getElementById(modalId);
        if (!modal) return;

        this.currentModal = modal;
        modal.style.display = 'flex';

        // Reset pending with current values
        this.pendingSettings = { ...this.settings };

        // Highlight current active chip
        this.syncActiveChips(modalId);

        setTimeout(() => modal.classList.add('show'), 10);
        SpatialNav.setFocusTrap(modal);
        SpatialNav.focusFirst();
    }

    syncActiveChips(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        const key = modalId.replace('-modal', '').replace('accent', 'accentColor').replace('update-mode', 'updateMode');
        const value = this.settings[key];

        modal.querySelectorAll('.option-chip').forEach(chip => {
            const chipValue = chip.getAttribute('data-value');
            if (chipValue === value) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });

        // Show/hide advanced warning
        if (modalId === 'update-mode-modal') {
            const warning = document.getElementById('advanced-warning');
            if (warning) {
                warning.style.display = value === 'advanced' ? 'block' : 'none';
            }
        }
    }

    closeModal() {
        if (!this.currentModal) return;
        const modal = this.currentModal;
        modal.classList.remove('show');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
        SpatialNav.clearFocusTrap();
        SpatialNav.refocus();
        this.currentModal = null;
    }

    setPending(key, value, el) {
        console.log(`Setting pending ${key} to ${value}`);
        this.pendingSettings[key] = value;

        // Visual feedback inside the modal
        if (el && el.parentElement) {
            el.parentElement.querySelectorAll('.option-chip').forEach(chip => chip.classList.remove('active'));
            el.classList.add('active');
        }

        // Show/hide advanced warning
        if (key === 'updateMode') {
            const warning = document.getElementById('advanced-warning');
            if (warning) {
                warning.style.display = value === 'advanced' ? 'block' : 'none';
            }
        }
    }

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

    applySettings() {
        document.documentElement.style.setProperty('--primary-color', this.settings.accentColor);
        const hex = this.settings.accentColor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16), g = parseInt(hex.substring(2, 4), 16), b = parseInt(hex.substring(4, 6), 16);
        document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
        document.documentElement.setAttribute('lang', this.settings.language);
    }

    applySettingsGlobally() {
        const mainDoc = window.parent?.document || document;
        mainDoc.documentElement.style.setProperty('--primary-color', this.settings.accentColor);
        mainDoc.documentElement.setAttribute('lang', this.settings.language);
    }

    handleUpdateStatus(statusKey) {
        if (!this.isCheckingUpdates) return;
        console.log('Update Status:', statusKey);
        const statusText = document.getElementById('update-status-text');
        if (statusText) {
            statusText.textContent = window.i18n?.t(`settings.updateStatus.${statusKey}`) || statusKey;
        }
    }

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
                this.initializeUI(); // Re-bind original click
            }
            if (statusText) statusText.style.display = 'none';
        }, 3000);
    }

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
                this.initializeUI(); // Re-bind original click
            }
            if (statusText) statusText.style.display = 'none';
        }, 3000);
    }
}