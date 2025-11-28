// i18n (internationalization) system for IVIDS
class I18n {
    constructor() {
        this.currentLanguage = 'en';
        this.translations = {};
        this.availableLanguages = ['en', 'es', 'fr', 'de', 'nl'];
    }

    async init() {
        // Load saved language or use default
        const savedSettings = localStorage.getItem('ivids-settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            this.currentLanguage = settings.language || 'en';
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

    applyTranslations() {
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
    }

    getTranslation(key) {
        // Support nested keys like "app.name" or "nav.home"
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                console.warn(`Translation key not found: ${key}`);
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
