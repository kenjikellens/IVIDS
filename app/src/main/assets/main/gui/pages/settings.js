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

class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
        this.pendingSettings = {};
        this.currentModal = null;
        this.initializeUI();
        this.applySettings();
    }

    loadSettings() {
        const defaultSettings = { language: 'en', accentColor: '#46d369', updateMode: 'manual' };
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
            checkBtn.onclick = () => {
                if (window.AndroidUpdate) {
                    checkBtn.disabled = true;
                    // Inject loader container if not exists
                    let loaderContainer = document.getElementById('update-loader-container');
                    if (loaderContainer) {
                        loaderContainer.innerHTML = '<div class="ivids-loader"></div>';
                        // Trigger loader.js logic if available globaly
                        if (window.LoaderManager && window.LoaderManager.createLoader) {
                            const loaderEl = loaderContainer.querySelector('.ivids-loader');
                            window.LoaderManager.createLoader(loaderEl);
                        }
                    }
                    window.AndroidUpdate.checkForUpdates();
                }
            };
        }

        this.updateDisplays();
    }

    updateDisplays() {
        const langDisplay = document.getElementById('current-language-display');
        if (langDisplay) {
            const names = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', nl: 'Nederlands' };
            langDisplay.textContent = names[this.settings.language] || this.settings.language;
        }

        const colorDisplay = document.getElementById('current-color-display');
        if (colorDisplay) {
            colorDisplay.style.borderBottomColor = this.settings.accentColor;
            colorDisplay.textContent = 'Accent'; // Keep it generic
        }

        const modeDisplay = document.getElementById('current-update-mode-display');
        if (modeDisplay) {
            modeDisplay.textContent = window.i18n?.t(`settings.mode.${this.settings.updateMode}`) || this.settings.updateMode;
        }

        const manualContainer = document.getElementById('manual-check-container');
        if (manualContainer) manualContainer.style.display = this.settings.updateMode === 'manual' ? 'flex' : 'none';
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


}