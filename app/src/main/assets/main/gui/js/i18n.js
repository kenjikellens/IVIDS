// i18n (internationalization) system for IVIDS
import { PersistentStorage } from '../../logic/persistent-storage.js';

class I18n {
    constructor() {
        this.currentLanguage = 'en';
        this.translations = {};
        this.translationCache = {}; // Cache for fast translation string lookups
        this.availableLanguages = [
            'ar', 'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'fi', 'fr', 'hi',
            'hr', 'hu', 'id', 'it', 'ja', 'ko', 'ms', 'nl', 'no', 'pl', 'pt',
            'ro', 'ru', 'sk', 'sv', 'th', 'tl', 'tr', 'uk', 'vi', 'zh'
        ];
        this.initialized = false;
        this.initializedPromise = null;
    }

    /**
     * Initializes the internationalization service.
     * Loads the saved language from local storage, falling back to document cookies and then English.
     * Uses caching to prevent parallel initialization fetches.
     */
    async init() {
        if (this.initialized) {
            return this.initializedPromise;
        }
        this.initialized = true;
        this.initializedPromise = (async () => {
            let language = 'en';
            try {
                const savedSettings = PersistentStorage.getItem('ivids-settings');
                if (savedSettings) {
                    const settings = JSON.parse(savedSettings);
                    language = settings.language;
                }
                if (!language) {
                    const match = document.cookie.match(/(?:^|; )language=([^;]*)/);
                    if (match) {
                        language = decodeURIComponent(match[1]);
                    }
                }
            } catch (e) {
                console.error('Error loading language settings:', e);
            }

            this.currentLanguage = language || 'en';
            await this.loadLanguage(this.currentLanguage);
        })();
        return this.initializedPromise;
    }

    /**
     * Loads translation strings for a language code, falling back to English or an emergency hardcoded set on error.
     * Updates the active translation cache and applies it to elements in the DOM.
     */
    async loadLanguage(lang) {
        if (!this.availableLanguages.includes(lang)) {
            console.warn(`Language ${lang} not available, falling back to English`);
            lang = 'en';
        }

        try {
            const response = await fetch(`lang/${lang}.json`);
            if (!response.ok) throw new Error(`Failed to load ${lang}.json`);

            this.translations = await response.json();
            this.translationCache = {}; // Reset cache on language change
            this.currentLanguage = lang;

            // Apply translations to the page
            this.applyTranslations();

            console.log(`Loaded language: ${lang}`);
        } catch (error) {
            console.error(`Error loading language ${lang}:`, error);

            // If not English, try falling back to English
            if (lang !== 'en') {
                console.log('Falling back to English...');
                await this.loadLanguage('en');
            } else {
                // If English itself fails to load, use a minimal hardcoded fallback
                console.warn('English language file failed to load, applying emergency fallback translations');
                this.translations = {
                    error: {
                        defaultTitle: "Application Error",
                        defaultMessage: "An unexpected error occurred.",
                        systemError: "An unexpected system error occurred"
                    },
                    toast: {
                        connectionLost: "No internet connection. Please check your network settings.",
                        connected: "You are back online. UI is syncing...",
                        connectionLostTitle: "Connection Lost",
                        connectedTitle: "Connected",
                        slowConnectionTitle: "Slow Connection",
                        storageFull: "Storage limit reached. Changes cannot be saved permanently.",
                        storageFullTitle: "Storage Full"
                    }
                };
                this.translationCache = {}; // Clear cache on emergency fallback
                this.applyTranslations();
            }
        }
    }

    async setLanguage(lang) {
        await this.loadLanguage(lang);
    }

    /**
     * Scans and applies translations to all elements with data-i18n attribute inside a root element.
     * This avoids scanning the entire document DOM when translating scoped page transitions.
     * @param {HTMLElement|Document} [rootElement=document] - The parent element to translate.
     */
    applyTranslations(rootElement = document) {
        try {
            // Find all matching descendant elements
            const elements = Array.from(rootElement.querySelectorAll('[data-i18n]'));
            
            // Check if rootElement itself needs to be translated
            if (rootElement.hasAttribute && rootElement.hasAttribute('data-i18n')) {
                elements.push(rootElement);
            }

            elements.forEach(element => {
                const key = element.getAttribute('data-i18n');
                const translation = this.getTranslation(key);

                if (translation) {
                    // Handle input placeholders
                    if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
                        element.placeholder = translation;
                    } else {
                        element.textContent = translation;
                    }
                }
            });
        } catch (e) {
            console.error('Error applying translations:', e);
        }
    }

    /**
     * Resolves a dot-notated translation key to its corresponding localized string.
     * Leverages an in-memory cache to optimize nested lookups.
     */
    getTranslation(key) {
        if (!key) return null;
        if (this.translationCache[key] !== undefined) {
            return this.translationCache[key];
        }

        // Support nested keys like "app.name" or "nav.home"
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                this.translationCache[key] = null;
                return null;
            }
        }

        this.translationCache[key] = value;
        return value;
    }

    t(key) {
        return this.getTranslation(key) || key;
    }
}

// Create global i18n instance
window.i18n = new I18n();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.i18n.init());
} else {
    window.i18n.init();
}

export default window.i18n;
