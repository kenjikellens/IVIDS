// Settings page initialization
export async function init() {
    console.log('Settings page initialized');

    // Wait for i18n to be ready
    if (window.i18n && window.i18n.translations) {
        window.i18n.applyTranslations();
    }

    // Initialize settings manager
    const settingsManager = new SettingsManager();
}

// Settings Manager Class
class SettingsManager {
    constructor() {
        this.settings = this.loadSettings();
        this.initializeUI();
        this.attachEventListeners();
        this.applySettings();
    }

    // Load settings from localStorage
    loadSettings() {
        const defaultSettings = {
            language: 'en',
            accentColor: '#46d369'
        };

        const savedSettings = localStorage.getItem('ivids-settings');
        return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
    }

    // Save settings to localStorage
    saveSettings() {
        localStorage.setItem('ivids-settings', JSON.stringify(this.settings));
        this.showSaveNotification();

        // Apply settings globally (to parent window/app)
        this.applySettingsGlobally();
    }

    // Initialize UI with saved settings
    initializeUI() {
        // Set language dropdown
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.value = this.settings.language;
        }

        // Update preset color active state
        this.updatePresetActive(this.settings.accentColor);
    }

    // Attach event listeners
    attachEventListeners() {
        // Language change
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.addEventListener('change', async (e) => {
                this.settings.language = e.target.value;
                this.saveSettings();

                // Load and apply new language
                if (window.i18n) {
                    await window.i18n.setLanguage(e.target.value);
                    // Translations are automatically applied by i18n.loadLanguage()
                }
            });
        }

        // Preset color clicks
        const presetColors = document.querySelectorAll('.preset-color');
        presetColors.forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.getAttribute('data-color');
                this.updateAccentColor(color);
            });
        });

        // Reset button
        const resetBtn = document.getElementById('reset-theme-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetToDefault();
            });
        }
    }

    // Update accent color
    updateAccentColor(color) {
        this.settings.accentColor = color;
        this.saveSettings();
        this.applySettings();

        // Update preset active state
        this.updatePresetActive(color);
    }

    // Update active preset color
    updatePresetActive(color) {
        const presetColors = document.querySelectorAll('.preset-color');
        presetColors.forEach(preset => {
            if (preset.getAttribute('data-color').toLowerCase() === color.toLowerCase()) {
                preset.classList.add('active');
            } else {
                preset.classList.remove('active');
            }
        });
    }

    // Reset to default settings
    resetToDefault() {
        const defaultColor = '#46d369';
        const defaultLanguage = 'en';

        this.settings.accentColor = defaultColor;
        this.settings.language = defaultLanguage;

        // Update UI
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            languageSelect.value = defaultLanguage;
        }

        this.saveSettings();
        this.applySettings();
        this.updatePresetActive(defaultColor);

        // Reload English language
        if (window.i18n) {
            window.i18n.setLanguage('en');
        }

        // Show notification
        const notification = document.getElementById('save-notification');
        if (notification) {
            notification.textContent = '✓ Reset to defaults!';
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
                notification.textContent = '✓ Settings saved!';
            }, 2000);
        }
    }

    // Apply settings to the current page
    applySettings() {
        // Apply accent color to CSS variables
        document.documentElement.style.setProperty('--primary-color', this.settings.accentColor);

        // Calculate RGB values for alpha variants
        const rgb = this.hexToRgb(this.settings.accentColor);
        if (rgb) {
            document.documentElement.style.setProperty('--primary-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
        }

        // Apply language
        document.documentElement.setAttribute('lang', this.settings.language);
    }

    // Apply settings globally (to the main app)
    applySettingsGlobally() {
        // Since settings page is loaded via router into main-view,
        // we need to update the parent document's CSS variables
        const mainDoc = window.parent?.document || document;

        if (mainDoc) {
            mainDoc.documentElement.style.setProperty('--primary-color', this.settings.accentColor);

            const rgb = this.hexToRgb(this.settings.accentColor);
            if (rgb) {
                mainDoc.documentElement.style.setProperty('--primary-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
            }

            mainDoc.documentElement.setAttribute('lang', this.settings.language);
        }
    }

    // Convert hex to RGB
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    // Show save notification
    showSaveNotification() {
        const notification = document.getElementById('save-notification');
        if (notification) {
            notification.classList.add('show');
            setTimeout(() => {
                notification.classList.remove('show');
            }, 2000);
        }
    }

    // Get current settings (for use by other parts of the app)
    getSettings() {
        return { ...this.settings };
    }
}

// Export settings getter for use in other scripts
window.getIVIDSSettings = () => {
    const savedSettings = localStorage.getItem('ivids-settings');
    return savedSettings ? JSON.parse(savedSettings) : { language: 'en', accentColor: '#46d369' };
};