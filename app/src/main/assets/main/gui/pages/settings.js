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
        this.languages = [
            { id: 'en', name: 'English' },
            { id: 'es', name: 'Español' },
            { id: 'fr', name: 'Français' },
            { id: 'de', name: 'Deutsch' },
            { id: 'nl', name: 'Nederlands' }
        ];
        this.colors = [
            { hex: '#46d369', name: 'Green' },
            { hex: '#e50914', name: 'Red' },
            { hex: '#00d4ff', name: 'Cyan' },
            { hex: '#9146ff', name: 'Purple' },
            { hex: '#ff6b35', name: 'Orange' },
            { hex: '#ffd700', name: 'Gold' }
        ];
        this.isSelectingLanguage = false;
        this.tempLanguageIndex = -1;

        this.updateModes = [
            { id: 'auto', name: 'Auto' },
            { id: 'manual', name: 'Manual' },
            { id: 'none', name: 'Off' }
        ];

        this.activeSelector = null;
        this.originalValue = null;

        // Global callback with session persistence
        window.onUpdateFound = (version) => {
            window.latestFoundVersion = version;
            this.handleUpdateFound(version);
        };

        // If update was already found before settings page opened
        if (window.latestFoundVersion) {
            setTimeout(() => this.handleUpdateFound(window.latestFoundVersion), 100);
        }

        this.initializeUI();
        this.attachEventListeners();
        this.applySettings();
    }

    // Load settings from localStorage
    loadSettings() {
        const defaultSettings = {
            language: 'en',
            accentColor: '#46d369',
            updateMode: 'manual'
        };

        try {
            const savedSettings = localStorage.getItem('ivids-settings');
            return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : defaultSettings;
        } catch (e) {
            console.error('SettingsManager: Error parsing settings', e);
            return defaultSettings;
        }
    }

    // Save settings to localStorage
    saveSettings() {
        localStorage.setItem('ivids-settings', JSON.stringify(this.settings));
        this.showSaveNotification();
        this.applySettingsGlobally();
    }

    // Initialize UI with saved settings
    initializeUI() {
        // Platform check: Hide updates section if not on Android APK
        const updatesSection = document.getElementById('app-updates-section');
        if (updatesSection && !window.AndroidUpdate) {
            console.log('Settings: Hiding App Updates section (Web version)');
            updatesSection.style.display = 'none';
        }

        const languageText = document.getElementById('current-language-text');
        if (languageText) {
            const currentLang = this.languages.find(l => l.id === this.settings.language) || this.languages[0];
            languageText.textContent = currentLang.name;
        }

        this.renderColors();
        this.updateAccentColor(this.settings.accentColor);
        this.updateUpdateUI();
    }

    updateUpdateUI() {
        const modeText = document.getElementById('current-update-mode-text');
        if (modeText) {
            const currentMode = this.updateModes.find(m => m.id === this.settings.updateMode) || this.updateModes[1];
            modeText.textContent = window.i18n?.t(`settings.mode.${currentMode.id}`) || currentMode.name;
        }

        const manualContainer = document.getElementById('manual-check-container');
        if (manualContainer) {
            manualContainer.style.display = this.settings.updateMode === 'manual' ? 'flex' : 'none';

            // Re-apply translations specifically for the button to be sure
            const checkBtn = document.getElementById('check-updates-btn');
            if (checkBtn && window.i18n) {
                checkBtn.textContent = window.i18n.t('settings.checkButton');
                checkBtn.style.display = 'inline-flex'; // Force visibility
            }
        }
    }

    renderColors() {
        const containers = [
            'landscape-color-container',
            'modal-color-container'
        ];

        containers.forEach(id => {
            const container = document.getElementById(id);
            if (!container) return;

            container.innerHTML = '';
            this.colors.forEach(color => {
                const div = document.createElement('div');
                div.className = 'preset-color focusable';
                div.tabIndex = 0;
                div.setAttribute('data-color', color.hex);
                div.style.backgroundColor = color.hex;
                div.title = color.name;

                // Add keyboard support
                div.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        this.updateAccentColor(color.hex);
                        this.closeModal();
                    }
                });

                div.addEventListener('click', () => {
                    this.updateAccentColor(color.hex);
                    this.closeModal();
                });

                container.appendChild(div);
            });
        });
    }

    // Attach event listeners
    attachEventListeners() {
        // Language Selector
        const langSelector = document.getElementById('language-selector');
        if (langSelector) {
            langSelector.addEventListener('keydown', (e) => {
                const isActive = langSelector.classList.contains('active');

                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!isActive) {
                        // Activate
                        this.activeSelector = 'language';
                        this.originalValue = this.settings.language;
                        langSelector.classList.add('active');
                        if (window.navigator.vibrate) window.navigator.vibrate(20);
                    } else {
                        // Confirm
                        this.activeSelector = null;
                        langSelector.classList.remove('active');
                        // Trigger full application with current ID
                        this.cycleLanguage(0, true);
                        if (window.navigator.vibrate) window.navigator.vibrate(20);
                    }
                } else if (isActive) {
                    // Prevent default for ALL nav keys when active
                    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                        e.preventDefault();
                    }

                    if (e.key === 'ArrowLeft') this.cycleLanguage(-1, false);
                    if (e.key === 'ArrowRight') this.cycleLanguage(1, false);

                    if (e.key === 'Backspace' || e.key === 'Escape') {
                        e.preventDefault();
                        // Cancel
                        this.settings.language = this.originalValue;
                        this.activeSelector = null;
                        langSelector.classList.remove('active');
                        this.initializeUI();
                    }
                }
            });

            // Mouse/Touch activation only, Enter is handled by keydown
            langSelector.addEventListener('click', (e) => {
                // If it was a keyboard-triggered click, ignore it (we handle Enter in keydown)
                if (e.detail === 0) return;

                // Check if specific arrow was clicked
                if (e.target.classList.contains('left-arrow')) {
                    this.cycleLanguage(-1, true); // Direct save on arrow click
                    return;
                }
                if (e.target.classList.contains('right-arrow')) {
                    this.cycleLanguage(1, true); // Direct save on arrow click
                    return;
                }

                if (!langSelector.classList.contains('active')) {
                    this.activeSelector = 'language';
                    this.originalValue = this.settings.language;
                    langSelector.classList.add('active');
                } else {
                    this.cycleLanguage(1, false);
                }
            });
        }

        // Portrait triggers
        const trigger = document.getElementById('portrait-color-trigger');
        if (trigger) {
            trigger.addEventListener('click', () => this.openModal());
            trigger.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.openModal();
            });
        }

        const closeBtn = document.getElementById('modal-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal());
        }

        const modal = document.getElementById('color-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal();
            });
        }

        // Update mode selector
        const updateModeSelector = document.getElementById('update-mode-selector');
        if (updateModeSelector) {
            updateModeSelector.addEventListener('keydown', (e) => {
                const isActive = updateModeSelector.classList.contains('active');

                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (!isActive) {
                        // Activate
                        this.activeSelector = 'updateMode';
                        this.originalValue = this.settings.updateMode;
                        updateModeSelector.classList.add('active');
                        if (window.navigator.vibrate) window.navigator.vibrate(20);
                    } else {
                        // Confirm
                        this.activeSelector = null;
                        updateModeSelector.classList.remove('active');
                        this.saveSettings();
                        if (window.navigator.vibrate) window.navigator.vibrate(20);
                    }
                } else if (isActive) {
                    // Prevent default for ALL nav keys when active
                    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                        e.preventDefault();
                    }

                    if (e.key === 'ArrowLeft') this.cycleUpdateMode(-1, false);
                    if (e.key === 'ArrowRight') this.cycleUpdateMode(1, false);

                    if (e.key === 'Backspace' || e.key === 'Escape') {
                        e.preventDefault();
                        // Cancel
                        this.settings.updateMode = this.originalValue;
                        this.activeSelector = null;
                        updateModeSelector.classList.remove('active');
                        this.updateUpdateUI();
                    }
                }
            });
            updateModeSelector.addEventListener('click', (e) => {
                // If it was a keyboard-triggered click, ignore it
                if (e.detail === 0) return;

                // Check if specific arrow was clicked
                if (e.target.classList.contains('left-arrow')) {
                    this.cycleUpdateMode(-1, true); // Direct save on arrow click
                    return;
                }
                if (e.target.classList.contains('right-arrow')) {
                    this.cycleUpdateMode(1, true); // Direct save on arrow click
                    return;
                }

                if (!updateModeSelector.classList.contains('active')) {
                    this.activeSelector = 'updateMode';
                    this.originalValue = this.settings.updateMode;
                    updateModeSelector.classList.add('active');
                } else {
                    this.cycleUpdateMode(1, false);
                }
            });
        }

        // Manual check listener
        const checkBtn = document.getElementById('check-updates-btn');
        if (checkBtn) {
            checkBtn.addEventListener('click', () => {
                if (window.AndroidUpdate) {
                    checkBtn.disabled = true;
                    checkBtn.textContent = '...';
                    window.AndroidUpdate.checkForUpdates();

                    // Reset button after 10s if no response
                    setTimeout(() => {
                        if (checkBtn.disabled) {
                            checkBtn.disabled = false;
                            checkBtn.textContent = window.i18n?.t('settings.checkButton');
                        }
                    }, 10000);
                } else {
                    // Feedback for web version
                    console.warn('Settings: AndroidUpdate bridge not found (Web version)');
                    const originalText = checkBtn.textContent;
                    checkBtn.textContent = 'Web Mode ›';
                    setTimeout(() => {
                        checkBtn.textContent = originalText;
                    }, 2000);
                }
            });
        }

        // Install update listener
        const installBtn = document.getElementById('install-update-btn');
        if (installBtn) {
            installBtn.addEventListener('click', () => {
                if (window.AndroidUpdate) {
                    window.AndroidUpdate.downloadAndInstall();
                }
            });
        }
    }

    cycleUpdateMode(direction, shouldSave = true) {
        let currentIndex = this.updateModes.findIndex(m => m.id === this.settings.updateMode);
        if (currentIndex === -1) currentIndex = 1;

        const nextIndex = (currentIndex + direction + this.updateModes.length) % this.updateModes.length;
        this.settings.updateMode = this.updateModes[nextIndex].id;
        if (shouldSave) this.saveSettings();
        this.updateUpdateUI();
    }

    handleUpdateFound(version) {
        const updateContainer = document.getElementById('update-available-container');
        const versionText = document.getElementById('update-version-text');
        const checkBtn = document.getElementById('check-updates-btn');

        if (checkBtn) {
            checkBtn.disabled = false;
            checkBtn.textContent = window.i18n?.t('settings.checkButton');
        }

        if (updateContainer && versionText) {
            versionText.textContent = version;
            updateContainer.style.display = 'flex';

            // If auto-update is on, trigger download immediately
            if (this.settings.updateMode === 'auto' && window.AndroidUpdate) {
                window.AndroidUpdate.downloadAndInstall();
            }
        }
    }

    openModal() {
        const modal = document.getElementById('color-modal');
        if (modal) {
            modal.classList.add('show');
            // Try to focus the currently active color inside the modal
            const activeColor = modal.querySelector('.preset-color.active');
            if (activeColor) activeColor.focus();
        }
    }

    closeModal() {
        const modal = document.getElementById('color-modal');
        if (modal) {
            modal.classList.remove('show');
            const trigger = document.getElementById('portrait-color-trigger');
            if (trigger && getComputedStyle(trigger).display !== 'none') {
                trigger.focus();
            }
        }
    }

    async cycleLanguage(direction, shouldSave = true) {
        let currentIndex = this.languages.findIndex(l => l.id === this.settings.language);
        if (currentIndex === -1) currentIndex = 0;

        const nextIndex = (currentIndex + direction + this.languages.length) % this.languages.length;
        const selectedLang = this.languages[nextIndex];

        this.settings.language = selectedLang.id;
        if (shouldSave) {
            this.saveSettings();
            if (window.i18n) {
                try {
                    await window.i18n.setLanguage(selectedLang.id);
                } catch (e) {
                    console.error('Failed to set language:', e);
                }
            }
        }
        this.initializeUI();
    }

    updateInlineText() {
        const languageText = document.getElementById('current-language-text');
        if (languageText) {
            languageText.textContent = this.languages[this.tempLanguageIndex].name;
        }
    }

    // Update accent color
    updateAccentColor(color) {
        this.settings.accentColor = color;
        this.saveSettings();
        this.applySettings();

        // Update preset active state
        this.updatePresetActive(color);

        // Update trigger preview
        const preview = document.getElementById('trigger-color-preview');
        if (preview) {
            preview.style.backgroundColor = color;
        }
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