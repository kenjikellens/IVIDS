import { SpatialNav } from '../js/spatial-nav.js';

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

        try {
            const savedSettings = localStorage.getItem('ivids-settings');
            console.log('SettingsManager: Loaded settings', savedSettings);
            return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
        } catch (e) {
            console.error('SettingsManager: Error parsing settings', e);
            return defaultSettings;
        }
    }

    // Save settings to localStorage
    saveSettings() {
        console.log('SettingsManager: Saving settings', this.settings);
        localStorage.setItem('ivids-settings', JSON.stringify(this.settings));
        this.showSaveNotification();

        // Apply settings globally (to parent window/app)
        this.applySettingsGlobally();
    }

    // Initialize UI with saved settings
    initializeUI() {
        console.log('SettingsManager: Initializing UI', this.settings);

        // Set language button text
        const languageBtn = document.getElementById('language-btn');
        const languageModal = document.getElementById('language-modal');

        // Language Names Map (Robust fallback)
        const languageNames = {
            'en': 'English',
            'es': 'Español',
            'fr': 'Français',
            'de': 'Deutsch',
            'nl': 'Nederlands'
        };

        if (languageBtn) {
            // Get name from map or fallback to code
            const currentLangName = languageNames[this.settings.language] || this.settings.language;
            console.log(`SettingsManager: DEBUG - Language: ${this.settings.language}, Display: ${currentLangName}`);
            console.log(`SettingsManager: DEBUG - Button Element:`, languageBtn);
            languageBtn.textContent = currentLangName;

            // Update selected state in modal if it exists
            if (languageModal) {
                const options = languageModal.querySelectorAll('.language-option');
                options.forEach(option => {
                    const langValue = option.getAttribute('data-value');
                    if (langValue === this.settings.language) {
                        option.classList.add('selected');
                    } else {
                        option.classList.remove('selected');
                    }
                });
            }
        } else {
            console.error('SettingsManager: Language button not found');
        }

        // Update preset color active state
        this.updatePresetActive(this.settings.accentColor);
    }

    // Attach event listeners
    attachEventListeners() {
        console.log('SettingsManager: Attaching event listeners');

        const languageBtn = document.getElementById('language-btn');
        const languageModal = document.getElementById('language-modal');
        const closeModalBtn = languageModal ? languageModal.querySelector('.close-modal') : null;
        const languageOptions = languageModal ? languageModal.querySelectorAll('.language-option') : [];

        // Open Modal
        const openModal = () => {
            if (languageModal) {
                languageModal.classList.add('active');

                // Set focus trap
                if (window.SpatialNav && window.SpatialNav.setFocusTrap) {
                    window.SpatialNav.setFocusTrap(languageModal.querySelector('.modal-content'));
                }

                // Focus the selected option or the first one
                const selectedOption = Array.from(languageOptions).find(opt => opt.classList.contains('selected')) || languageOptions[0];
                if (selectedOption) {
                    setTimeout(() => {
                        if (window.SpatialNav && window.SpatialNav.setFocus) {
                            window.SpatialNav.setFocus(selectedOption);
                        } else {
                            selectedOption.focus();
                        }
                    }, 50);
                }
            }
        };

        // Close Modal
        const closeModal = () => {
            if (languageModal) {
                languageModal.classList.remove('active');

                // Clear focus trap
                if (window.SpatialNav && window.SpatialNav.clearFocusTrap) {
                    window.SpatialNav.clearFocusTrap();
                }

                // Return focus to button
                if (languageBtn) {
                    if (window.SpatialNav && window.SpatialNav.setFocus) {
                        window.SpatialNav.setFocus(languageBtn);
                    } else {
                        languageBtn.focus();
                    }
                }
            }
        };

        // Language Button Click
        if (languageBtn) {
            languageBtn.addEventListener('click', openModal);
            languageBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    openModal();
                }
            });
        }

        // Close Button Click
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', closeModal);
            closeModalBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    closeModal();
                }
            });
        }

        // Language Options Selection
        languageOptions.forEach(option => {
            const selectLanguage = async () => {
                const lang = option.getAttribute('data-value');
                const langName = option.textContent;

                // Update UI
                if (languageBtn) languageBtn.textContent = langName;

                // Update selected class
                languageOptions.forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');

                // Save and Apply
                if (this.settings.language !== lang) {
                    this.settings.language = lang;
                    this.saveSettings();

                    // Load and apply new language
                    if (window.i18n) {
                        try {
                            await window.i18n.setLanguage(lang);
                        } catch (langError) {
                            console.error('Failed to set language:', langError);
                        }
                    }
                }

                closeModal();
            };

            option.addEventListener('click', selectLanguage);
            option.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    selectLanguage();
                }
            });
        });

        // Preset color clicks
        const presetColors = document.querySelectorAll('.preset-color');
        presetColors.forEach(preset => {
            preset.addEventListener('click', () => {
                const color = preset.getAttribute('data-color');
                this.updateAccentColor(color);
            });
        });
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

    // Apply settings to the current page
    applySettings() {
        // Apply accent color to CSS variables
        document.documentElement.style.setProperty('--primary-color', this.settings.accentColor);

        // Calculate RGB values for alpha variants
        const rgb = this.hexToRgb(this.settings.accentColor);
        if (rgb) {
            document.documentElement.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
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
                mainDoc.documentElement.style.setProperty('--primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
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