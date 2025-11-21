<<<<<<< HEAD
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
            if (translations[key]) {
                if (element.tagName === 'INPUT' && element.getAttribute('placeholder')) {
                    element.placeholder = translations[key];
                } else {
                    element.textContent = translations[key];
                }
            }
        });
    }

    static getText(key) {
        return languages[this.currentLang][key] || key;
    }
}
=======
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
            if (translations[key]) {
                if (element.tagName === 'INPUT' && element.getAttribute('placeholder')) {
                    element.placeholder = translations[key];
                } else {
                    element.textContent = translations[key];
                }
            }
        });
    }

    static getText(key) {
        return languages[this.currentLang][key] || key;
    }
}
>>>>>>> 9cb739138d9b59ab65cad410bc39d6c60fb358f3
