import { SpatialNav } from '../../js/spatial-nav.js';

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
        const languageSelectContainer = document.getElementById('language-select-container');
        if (languageSelectContainer) {
            const selectedText = languageSelectContainer.querySelector('.select-selected');
            const items = languageSelectContainer.querySelectorAll('.select-item');

            // Find the item matching the current language
            let currentLangName = 'English'; // Default
            items.forEach(item => {
                if (item.getAttribute('data-value') === this.settings.language) {
                    currentLangName = item.textContent;
                    item.classList.add('same-as-selected');
                } else {
                    item.classList.remove('same-as-selected');
                }
            });

            if (selectedText) {
                selectedText.textContent = currentLangName;
            }
        }

        // Update preset color active state
        this.updatePresetActive(this.settings.accentColor);
    }

    // Attach event listeners
    attachEventListeners() {
        // Custom Language Dropdown
        const languageSelectContainer = document.getElementById('language-select-container');
        if (languageSelectContainer) {
            const selectedText = languageSelectContainer.querySelector('.select-selected');
            const itemsContainer = languageSelectContainer.querySelector('.select-items');
            const items = languageSelectContainer.querySelectorAll('.select-item');

            // Toggle dropdown function
            const toggleDropdown = () => {
                this.closeAllSelect(selectedText);
                itemsContainer.classList.toggle('select-hide');
                selectedText.classList.toggle('select-arrow-active');
                languageSelectContainer.classList.toggle('active');

                // If opening, set focus to the selected item or first item
                if (!itemsContainer.classList.contains('select-hide')) {
                    const selectedItem = Array.from(items).find(i => i.classList.contains('same-as-selected')) || items[0];
                    if (selectedItem) {
                        // Small timeout to ensure visibility before focus
                        setTimeout(() => {
                            // Use SpatialNav.setFocus if available, otherwise native focus
                            if (window.SpatialNav && window.SpatialNav.setFocus) {
                                window.SpatialNav.setFocus(selectedItem);
                            } else {
                                selectedItem.focus();
                            }
                        }, 50);
                    }
                }
            };

            // Toggle dropdown on click
            selectedText.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleDropdown();
            });

            // Handle keyboard navigation for the container
            languageSelectContainer.addEventListener('keydown', (e) => {
                const key = e.key;
                const keyCode = e.keyCode;
                console.log('Dropdown keydown:', key, keyCode);

                if (key === 'Enter' || keyCode === 13) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleDropdown();
                    return;
                }

                // Custom navigation when dropdown is closed
                if (itemsContainer.classList.contains('select-hide')) {
                    if (key === 'ArrowUp' || key === 'ArrowRight' || keyCode === 38 || keyCode === 39) {
                        // Block navigation
                        console.log('Blocking Up/Right navigation');
                        e.preventDefault();
                        e.stopPropagation();
                    } else if (key === 'ArrowLeft' || keyCode === 37) {
                        // Go to Sidebar (Settings link)
                        console.log('Navigating Left to Sidebar');
                        e.preventDefault();
                        e.stopPropagation();
                        const sidebarSettings = document.querySelector('.nav-item[data-route="settings"]');
                        if (sidebarSettings) {
                            if (window.SpatialNav && window.SpatialNav.setFocus) {
                                window.SpatialNav.setFocus(sidebarSettings);
                            } else {
                                sidebarSettings.focus();
                            }
                        }
                    } else if (key === 'ArrowDown' || keyCode === 40) {
                        // Go to Accent Color (First preset)
                        console.log('Navigating Down to Accent Color');
                        e.preventDefault();
                        e.stopPropagation();
                        const firstColor = document.querySelector('.preset-color');
                        if (firstColor) {
                            if (window.SpatialNav && window.SpatialNav.setFocus) {
                                window.SpatialNav.setFocus(firstColor);
                            } else {
                                firstColor.focus();
                            }
                        } else {
                            console.warn('No preset color found');
                        }
                    }
                }
            });

            // Handle item selection
            items.forEach(item => {
                const selectItem = async () => {
                    const lang = item.getAttribute('data-value');
                    const langName = item.textContent;

                    // Update UI
                    selectedText.textContent = langName;
                    itemsContainer.classList.add('select-hide');
                    selectedText.classList.remove('select-arrow-active');
                    languageSelectContainer.classList.remove('active');

                    // Update active class on items
                    items.forEach(i => i.classList.remove('same-as-selected'));
                    item.classList.add('same-as-selected');

                    // Return focus to container
                    if (window.SpatialNav && window.SpatialNav.setFocus) {
                        window.SpatialNav.setFocus(languageSelectContainer);
                    } else {
                        languageSelectContainer.focus();
                    }

                    // Save and Apply
                    if (this.settings.language !== lang) {
                        this.settings.language = lang;
                        this.saveSettings();

                        // Load and apply new language
                        if (window.i18n) {
                            await window.i18n.setLanguage(lang);
                        }
                    }
                };

                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectItem();
                });

                // Handle Enter on item
                item.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        selectItem();
                    }
                });
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!languageSelectContainer.contains(e.target)) {
                    itemsContainer.classList.add('select-hide');
                    selectedText.classList.remove('select-arrow-active');
                    languageSelectContainer.classList.remove('active');
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
    }

    closeAllSelect(elmnt) {
        /* A function that will close all select boxes in the document,
        except the current select box: */
        const x = document.getElementsByClassName("select-items");
        const y = document.getElementsByClassName("select-selected");
        const xl = x.length;
        const yl = y.length;
        const arrNo = [];
        for (let i = 0; i < yl; i++) {
            if (elmnt == y[i]) {
                arrNo.push(i)
            } else {
                y[i].classList.remove("select-arrow-active");
            }
        }
        for (let i = 0; i < xl; i++) {
            if (arrNo.indexOf(i)) {
                x[i].classList.add("select-hide");
            }
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