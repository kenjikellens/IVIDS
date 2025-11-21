<<<<<<< HEAD
// i18n (Internationalization) Manager
class I18nManager {
    constructor() {
        this.currentLang = 'en';
        this.translations = {};
        this.availableLanguages = ['en', 'es', 'fr', 'nl', 'de']; // Languages with files
        this.init();
    }

    async init() {
        // Load saved language or default to English
        const savedSettings = localStorage.getItem('ivids-settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.language && this.availableLanguages.includes(settings.language)) {
                this.currentLang = settings.language;
            }
        }

        await this.loadLanguage(this.currentLang);
    }

    async loadLanguage(lang) {
        if (!this.availableLanguages.includes(lang)) {
            console.warn(`Language ${lang} not available, falling back to English`);
            lang = 'en';
        }

        try {
            const response = await fetch(`lang/${lang}.json`);
            this.translations = await response.json();
            this.currentLang = lang;
            document.documentElement.setAttribute('lang', lang);

            // Apply translations to the DOM
            this.applyTranslations();

            // Trigger custom event for language change
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
        } catch (error) {
            console.error(`Failed to load language file for ${lang}:`, error);
            if (lang !== 'en') {
                // Fallback to English
                await this.loadLanguage('en');
            }
        }
    }

    applyTranslations() {
        // Find all elements with data-i18n attribute
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);

            // Update text content or placeholder
            if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        });

        // Also support translating element titles via data-i18n-title
        const titleElements = document.querySelectorAll('[data-i18n-title]');
        titleElements.forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            const translation = this.t(key);
            if (translation) el.title = translation;
        });
    }

    t(key) {
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                console.warn(`Translation key not found: ${key}`);
                return key;
            }
        }

        return value;
    }

    getAvailableLanguages() {
        return this.availableLanguages;
    }

    getCurrentLanguage() {
        return this.currentLang;
    }

    async setLanguage(lang) {
        await this.loadLanguage(lang);
    }
}

// Create global instance
window.i18n = new I18nManager();

// Export for use in modules
export { I18nManager };
=======
// i18n (Internationalization) Manager
class I18nManager {
    constructor() {
        this.currentLang = 'en';
        this.translations = {};
        this.availableLanguages = ['en', 'es', 'fr']; // Only languages with files
        this.init();
    }

    async init() {
        // Load saved language or default to English
        const savedSettings = localStorage.getItem('ivids-settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.language && this.availableLanguages.includes(settings.language)) {
                this.currentLang = settings.language;
            }
        }

        await this.loadLanguage(this.currentLang);
    }

    async loadLanguage(lang) {
        if (!this.availableLanguages.includes(lang)) {
            console.warn(`Language ${lang} not available, falling back to English`);
            lang = 'en';
        }

        try {
            const response = await fetch(`lang/${lang}.json`);
            this.translations = await response.json();
            this.currentLang = lang;
            document.documentElement.setAttribute('lang', lang);

            // Apply translations to the DOM
            this.applyTranslations();

            // Trigger custom event for language change
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
        } catch (error) {
            console.error(`Failed to load language file for ${lang}:`, error);
            if (lang !== 'en') {
                // Fallback to English
                await this.loadLanguage('en');
            }
        }
    }

    applyTranslations() {
        // Find all elements with data-i18n attribute
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);

            // Update text content or placeholder
            if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        });
    }

    t(key) {
        const keys = key.split('.');
        let value = this.translations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                console.warn(`Translation key not found: ${key}`);
                return key;
            }
        }

        return value;
    }

    getAvailableLanguages() {
        return this.availableLanguages;
    }

    getCurrentLanguage() {
        return this.currentLang;
    }

    async setLanguage(lang) {
        await this.loadLanguage(lang);
    }
}

// Create global instance
window.i18n = new I18nManager();

// Export for use in modules
export { I18nManager };
>>>>>>> 9cb739138d9b59ab65cad410bc39d6c60fb358f3
