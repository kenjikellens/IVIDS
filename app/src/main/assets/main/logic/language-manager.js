import en from './languages/en.js';
import nl from './languages/nl.js';
import fr from './languages/fr.js';
import de from './languages/de.js';
import es from './languages/es.js';

const languages = { en, nl, fr, de, es };

export class LanguageManager {
    static currentLang = 'en';

    static async setLanguage(lang) {
        if (!languages[lang]) return;
        this.currentLang = lang;
        this.applyLanguage();
        localStorage.setItem('preferredLanguage', lang);
    }

    static init() {
        const savedLang = localStorage.getItem('preferredLanguage');
        if (savedLang && languages[savedLang]) {
            this.currentLang = savedLang;
        }
        this.applyLanguage();
    }

    static applyLanguage() {
        const translations = languages[this.currentLang];
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.getNestedTranslation(translations, key);

            if (translation) {
                if (element.tagName === 'INPUT' && element.getAttribute('placeholder')) {
                    element.placeholder = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });
    }

    static getNestedTranslation(obj, key) {
        if (!key) return null;
        return key.split('.').reduce((o, i) => (o ? o[i] : null), obj);
    }

    static getText(key) {
        const translations = languages[this.currentLang];
        return this.getNestedTranslation(translations, key) || key;
    }
}
