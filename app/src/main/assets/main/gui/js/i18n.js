// i18n (internationalization) system for IVIDS
class I18n {
    constructor() {
        this.currentLanguage = 'en';
        this.translations = {};
        this.availableLanguages = ['en', 'es', 'fr', 'de', 'nl', 'it', 'ru', 'pt', 'zh', 'ja', 'hi', 'ar', 'ko', 'tr', 'vi', 'id', 'ro', 'pl', 'da', 'sv', 'no', 'cs'];
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
            }
        }
    }

    async setLanguage(lang) {
        await this.loadLanguage(lang);
    }

    applyTranslations(root = document) {
        try {
            // Find all elements with data-i18n attribute within the root
            const elements = root.querySelectorAll('[data-i18n]');

            // Also check if the root itself has a data-i18n attribute
            if (root !== document && root.hasAttribute('data-i18n')) {
                const key = root.getAttribute('data-i18n');
                const translation = this.getTranslation(key);
                if (translation) {
                    if (root.tagName === 'INPUT' && root.hasAttribute('placeholder')) {
                        root.placeholder = translation;
                    } else {
                        root.textContent = translation;
                    }
                }
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
