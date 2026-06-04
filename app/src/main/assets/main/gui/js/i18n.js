// i18n (internationalization) system for IVIDS
class I18n {
    constructor() {
        this.currentLanguage = 'en';
        this.translations = {};
        this.availableLanguages = [
            'ar', 'cs', 'da', 'de', 'en', 'es', 'fr', 'hi', 'id', 'it', 'ja',
            'ko', 'nl', 'no', 'pl', 'pt', 'ro', 'ru', 'sv', 'tr', 'vi', 'zh'
        ];
    }

    async init() {
        // Load saved language or use default
        try {
            const savedSettings = localStorage.getItem('ivids-settings');
            if (savedSettings) {
                const settings = JSON.parse(savedSettings);
                this.currentLanguage = settings.language || 'en';
            }
        } catch (e) {
            console.error('Error loading language settings:', e);
        }

        // Load the current language
        await this.loadLanguage(this.currentLanguage);
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
                this.applyTranslations();
            }
        }
    }

    async setLanguage(lang) {
        await this.loadLanguage(lang);
    }

    applyTranslations() {
        try {
            // Find all elements with data-i18n attribute
            const elements = document.querySelectorAll('[data-i18n]');

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

    getTranslation(key) {
        if (!key) return null;

        // Support nested keys like "app.name" or "nav.home"
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                // console.warn(`Translation key not found: ${key}`);
                return null;
            }
        }

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
