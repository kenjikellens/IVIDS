/**
 * RegionalCategoryService - Manages dynamic user-region and world cinema category rows.
 * Provides 0.0ms synchronous country/language resolution with non-blocking background validation.
 * Injects 2 local rows (User Country + User Language) and 2 randomized international rows into the category pool,
 * and shuffles the non-trending categories so regional rows are naturally dispersed throughout the page.
 */

/**
 * Static mapping of timezones to ISO 3166-1 alpha-2 country codes.
 * Enables instant 0.0ms offline resolution without network blocking.
 */
const TIMEZONE_COUNTRY_MAP = {
    'Europe/Brussels': 'BE',
    'Europe/Amsterdam': 'NL',
    'Europe/Paris': 'FR',
    'Europe/London': 'GB',
    'Europe/Berlin': 'DE',
    'Europe/Madrid': 'ES',
    'Europe/Rome': 'IT',
    'Europe/Copenhagen': 'DK',
    'Europe/Stockholm': 'SE',
    'Europe/Oslo': 'NO',
    'Europe/Helsinki': 'FI',
    'Europe/Warsaw': 'PL',
    'Europe/Dublin': 'IE',
    'Europe/Lisbon': 'PT',
    'Europe/Athens': 'GR',
    'Europe/Vienna': 'AT',
    'Europe/Zurich': 'CH',
    'Europe/Prague': 'CZ',
    'Europe/Budapest': 'HU',
    'Europe/Bucharest': 'RO',
    'Europe/Kyiv': 'UA',
    'Europe/Istanbul': 'TR',
    'Asia/Tokyo': 'JP',
    'Asia/Seoul': 'KR',
    'Asia/Kolkata': 'IN',
    'Asia/Hong_Kong': 'HK',
    'Asia/Taipei': 'TW',
    'Asia/Shanghai': 'CN',
    'Asia/Bangkok': 'TH',
    'Asia/Jakarta': 'ID',
    'Asia/Manila': 'PH',
    'Asia/Tehran': 'IR',
    'Asia/Jerusalem': 'IL',
    'America/New_York': 'US',
    'America/Los_Angeles': 'US',
    'America/Chicago': 'US',
    'America/Toronto': 'CA',
    'America/Vancouver': 'CA',
    'America/Mexico_City': 'MX',
    'America/Sao_Paulo': 'BR',
    'America/Buenos_Aires': 'AR',
    'America/Bogota': 'CO',
    'America/Santiago': 'CL',
    'Australia/Sydney': 'AU',
    'Australia/Melbourne': 'AU',
    'Pacific/Auckland': 'NZ',
    'Africa/Johannesburg': 'ZA',
    'Africa/Lagos': 'NG',
    'Africa/Cairo': 'EG'
};

/**
 * Global pool of international countries and languages for movies.
 * Excludes corporate studios; represents authentic world cinema cultures.
 */
const WORLD_MOVIE_POOL = [
    { id: 'french-movies-row', country: 'FR', lang: 'fr', i18nKey: 'row.french_cinema', defaultTitle: 'Franstalige Cinema', type: 'lang', code: 'fr' },
    { id: 'british-movies-row', country: 'GB', lang: 'en', i18nKey: 'row.british_cinema', defaultTitle: 'Britse Cinema', type: 'country', code: 'GB' },
    { id: 'spanish-movies-row', country: 'ES', lang: 'es', i18nKey: 'row.spanish_cinema', defaultTitle: 'Spaanstalige Films', type: 'lang', code: 'es' },
    { id: 'italian-movies-row', country: 'IT', lang: 'it', i18nKey: 'row.italian_cinema', defaultTitle: 'Italiaanse Cinema', type: 'lang', code: 'it' },
    { id: 'german-movies-row', country: 'DE', lang: 'de', i18nKey: 'row.german_cinema', defaultTitle: 'Duitse Cinema', type: 'lang', code: 'de' },
    { id: 'nordic-movies-row', country: 'SE', lang: 'sv', i18nKey: 'row.nordic_cinema', defaultTitle: 'Scandinavische Cinema', type: 'lang', code: 'da|sv|no|fi' },
    { id: 'korean-movies-row', country: 'KR', lang: 'ko', i18nKey: 'row.korean_cinema', defaultTitle: 'Koreaanse Cinema', type: 'lang', code: 'ko' },
    { id: 'japanese-movies-row', country: 'JP', lang: 'ja', i18nKey: 'row.japanese_cinema', defaultTitle: 'Japanse Cinema', type: 'lang', code: 'ja' },
    { id: 'bollywood-movies-row', country: 'IN', lang: 'hi', i18nKey: 'row.bollywood_cinema', defaultTitle: 'Bollywood & Indiaas', type: 'lang', code: 'hi' },
    { id: 'latin-america-movies-row', country: 'MX', lang: 'es', i18nKey: 'row.latin_cinema', defaultTitle: 'Latijns-Amerikaanse Cinema', type: 'country', code: 'MX|AR|CO|BR' },
    { id: 'australian-movies-row', country: 'AU', lang: 'en', i18nKey: 'row.australian_cinema', defaultTitle: 'Australische Cinema', type: 'country', code: 'AU' },
    { id: 'polish-movies-row', country: 'PL', lang: 'pl', i18nKey: 'row.polish_cinema', defaultTitle: 'Poolse Cinema', type: 'lang', code: 'pl' },
    { id: 'irish-movies-row', country: 'IE', lang: 'en', i18nKey: 'row.irish_cinema', defaultTitle: 'Ierse Cinema', type: 'country', code: 'IE' },
    { id: 'danish-movies-row', country: 'DK', lang: 'da', i18nKey: 'row.danish_cinema', defaultTitle: 'Deense Cinema', type: 'lang', code: 'da' },
    { id: 'norwegian-movies-row', country: 'NO', lang: 'no', i18nKey: 'row.norwegian_cinema', defaultTitle: 'Noorse Cinema', type: 'lang', code: 'no' },
    { id: 'turkish-movies-row', country: 'TR', lang: 'tr', i18nKey: 'row.turkish_cinema', defaultTitle: 'Turkse Films', type: 'lang', code: 'tr' },
    { id: 'canadian-movies-row', country: 'CA', lang: 'en', i18nKey: 'row.canadian_cinema', defaultTitle: 'Canadese Cinema', type: 'country', code: 'CA' },
    { id: 'brazilian-movies-row', country: 'BR', lang: 'pt', i18nKey: 'row.brazilian_cinema', defaultTitle: 'Braziliaanse Cinema', type: 'country', code: 'BR' },
    { id: 'greek-movies-row', country: 'GR', lang: 'el', i18nKey: 'row.greek_cinema', defaultTitle: 'Griekse Cinema', type: 'lang', code: 'el' }
];

/**
 * Global pool of international series.
 */
const WORLD_SERIES_POOL = [
    { id: 'british-series-row', country: 'GB', lang: 'en', i18nKey: 'row.british_series', defaultTitle: 'Britse Series', type: 'country', code: 'GB' },
    { id: 'turkish-series-row', country: 'TR', lang: 'tr', i18nKey: 'row.turkish_series', defaultTitle: 'Turkse Series (Dizi)', type: 'lang', code: 'tr' },
    { id: 'nordic-noir-series-row', country: 'SE', lang: 'sv', i18nKey: 'row.nordic_series', defaultTitle: 'Nordic Noir & Scandinavisch', type: 'lang', code: 'da|sv|no|fi' },
    { id: 'french-series-row', country: 'FR', lang: 'fr', i18nKey: 'row.french_series', defaultTitle: 'Franstalige Series', type: 'lang', code: 'fr' },
    { id: 'spanish-series-row', country: 'ES', lang: 'es', i18nKey: 'row.spanish_series', defaultTitle: 'Spaanstalige Series', type: 'lang', code: 'es' },
    { id: 'korean-dramas-series-row', country: 'KR', lang: 'ko', i18nKey: 'row.korean_series', defaultTitle: 'Koreaanse Series (K-Dramas)', type: 'lang', code: 'ko' },
    { id: 'german-series-row', country: 'DE', lang: 'de', i18nKey: 'row.german_series', defaultTitle: 'Duitse Series', type: 'lang', code: 'de' },
    { id: 'italian-series-row', country: 'IT', lang: 'it', i18nKey: 'row.italian_series', defaultTitle: 'Italiaanse Series', type: 'lang', code: 'it' },
    { id: 'japanese-series-row', country: 'JP', lang: 'ja', i18nKey: 'row.japanese_series', defaultTitle: 'Japanse Drama Series', type: 'lang', code: 'ja' },
    { id: 'australian-series-row', country: 'AU', lang: 'en', i18nKey: 'row.australian_series', defaultTitle: 'Australische Series', type: 'country', code: 'AU' },
    { id: 'canadian-series-row', country: 'CA', lang: 'en', i18nKey: 'row.canadian_series', defaultTitle: 'Canadese Series', type: 'country', code: 'CA' }
];

export class RegionalCategoryService {
    constructor() {
        this.cachedContext = null;
        this._initBackgroundValidation();
    }

    /**
     * Resolves the user's location and language synchronously with zero delay.
     * Evaluates cached session data, device timezone, and browser navigator language.
     * @returns {{ country: string, language: string }} Detected ISO country and language codes.
     */
    resolveUserContext() {
        if (this.cachedContext) return this.cachedContext;

        let country = null;
        try {
            country = sessionStorage.getItem('ivids_user_country');
        } catch (e) { /* ignore */ }

        if (!country) {
            try {
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (tz && TIMEZONE_COUNTRY_MAP[tz]) {
                    country = TIMEZONE_COUNTRY_MAP[tz];
                }
            } catch (e) { /* ignore */ }
        }

        if (!country) {
            const navLang = (navigator.language || '').toUpperCase();
            if (navLang.includes('-')) {
                country = navLang.split('-')[1];
            } else if (navLang === 'NL') {
                country = 'NL';
            } else if (navLang === 'FR') {
                country = 'FR';
            } else if (navLang === 'DE') {
                country = 'DE';
            }
        }

        if (!country) {
            country = 'BE'; // Default European baseline
        }

        const rawLang = (navigator.language || 'nl').split('-')[0].toLowerCase();

        this.cachedContext = {
            country: country.toUpperCase(),
            language: rawLang
        };

        return this.cachedContext;
    }

    /**
     * Asynchronously queries an IP geo-lookup endpoint in the background without blocking UI rendering.
     * Caches the result in sessionStorage for future app runs.
     */
    _initBackgroundValidation() {
        const runProbe = () => {
            try {
                if (sessionStorage.getItem('ivids_user_country')) return;
                fetch('https://api.country.is')
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.country) {
                            sessionStorage.setItem('ivids_user_country', data.country);
                            if (this.cachedContext) {
                                this.cachedContext.country = data.country.toUpperCase();
                            }
                        }
                    })
                    .catch(() => { /* Silent fallback to timezone */ });
            } catch (e) { /* ignore */ }
        };

        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(runProbe, { timeout: 3000 });
        } else {
            setTimeout(runProbe, 1500);
        }
    }

    /**
     * Constructs the local country category row definition for a specific view.
     * @param {string} view - 'home', 'movies', or 'series'.
     * @param {string} countryCode - ISO country code.
     * @returns {Object} Category configuration object.
     */
    getLocalCountryRow(view, countryCode) {
        const isSeries = view === 'series';
        if (countryCode === 'BE') {
            return {
                id: isSeries ? 'belgian-series-row' : 'belgian-movies-row',
                i18nKey: isSeries ? 'row.belgian_series' : 'row.belgian_cinema',
                defaultTitle: isSeries ? 'Belgische Series' : 'Belgische Cinema',
                fetchConfig: { type: 'country', code: 'BE', mediaType: isSeries ? 'tv' : 'movie' }
            };
        } else if (countryCode === 'NL') {
            return {
                id: isSeries ? 'dutch-series-row' : 'dutch-movies-row',
                i18nKey: isSeries ? 'row.dutch_series' : 'row.dutch_cinema',
                defaultTitle: isSeries ? 'Nederlandse Series' : 'Nederlandse Cinema',
                fetchConfig: { type: 'country', code: 'NL', mediaType: isSeries ? 'tv' : 'movie' }
            };
        } else if (countryCode === 'FR') {
            return {
                id: isSeries ? 'french-series-row' : 'french-movies-row',
                i18nKey: isSeries ? 'row.french_series' : 'row.french_cinema',
                defaultTitle: isSeries ? 'Franstalige Series' : 'Franstalige Cinema',
                fetchConfig: { type: 'country', code: 'FR', mediaType: isSeries ? 'tv' : 'movie' }
            };
        } else if (countryCode === 'GB') {
            return {
                id: isSeries ? 'british-series-row' : 'british-movies-row',
                i18nKey: isSeries ? 'row.british_series' : 'row.british_cinema',
                defaultTitle: isSeries ? 'Britse Series' : 'Britse Cinema',
                fetchConfig: { type: 'country', code: 'GB', mediaType: isSeries ? 'tv' : 'movie' }
            };
        } else {
            return {
                id: isSeries ? `country-${countryCode.toLowerCase()}-series-row` : `country-${countryCode.toLowerCase()}-movies-row`,
                i18nKey: `row.country_${countryCode.toLowerCase()}`,
                defaultTitle: `${countryCode} ${isSeries ? 'Series' : 'Films'}`,
                fetchConfig: { type: 'country', code: countryCode, mediaType: isSeries ? 'tv' : 'movie' }
            };
        }
    }

    /**
     * Constructs the local language category row definition for a specific view.
     * @param {string} view - 'home', 'movies', or 'series'.
     * @param {string} langCode - ISO language code.
     * @returns {Object} Category configuration object.
     */
    getLocalLanguageRow(view, langCode) {
        const isSeries = view === 'series';
        if (langCode === 'nl') {
            return {
                id: isSeries ? 'dutch-lang-series-row' : 'dutch-lang-movies-row',
                i18nKey: isSeries ? 'row.dutch_lang_series' : 'row.dutch_lang_cinema',
                defaultTitle: isSeries ? 'Nederlandstalige Series' : 'Nederlandstalige Films',
                fetchConfig: { type: 'lang', code: 'nl', mediaType: isSeries ? 'tv' : 'movie' }
            };
        } else if (langCode === 'fr') {
            return {
                id: isSeries ? 'french-lang-series-row' : 'french-lang-movies-row',
                i18nKey: isSeries ? 'row.french_lang_series' : 'row.french_lang_cinema',
                defaultTitle: isSeries ? 'Franstalige Series' : 'Franstalige Cinema',
                fetchConfig: { type: 'lang', code: 'fr', mediaType: isSeries ? 'tv' : 'movie' }
            };
        } else if (langCode === 'de') {
            return {
                id: isSeries ? 'german-lang-series-row' : 'german-lang-movies-row',
                i18nKey: isSeries ? 'row.german_lang_series' : 'row.german_lang_cinema',
                defaultTitle: isSeries ? 'Duitstalige Series' : 'Duitstalige Cinema',
                fetchConfig: { type: 'lang', code: 'de', mediaType: isSeries ? 'tv' : 'movie' }
            };
        } else {
            return {
                id: isSeries ? 'world-showcase-series-row' : 'world-showcase-movies-row',
                i18nKey: 'row.world_showcase',
                defaultTitle: isSeries ? 'Internationale Series' : 'Internationale Cinema',
                fetchConfig: { type: 'lang', code: langCode, mediaType: isSeries ? 'tv' : 'movie' }
            };
        }
    }

    /**
     * Samples 2 distinct random categories from the world pool, excluding the user's country and language.
     * @param {string} view - 'home', 'movies', or 'series'.
     * @param {string} userCountry - User's ISO country code.
     * @param {string} userLang - User's ISO language code.
     * @returns {Array<Object>} Array of 2 random category configurations.
     */
    getRandomWorldRows(view, userCountry, userLang) {
        const isSeries = view === 'series';
        const sourcePool = isSeries ? WORLD_SERIES_POOL : WORLD_MOVIE_POOL;

        // Filter: never include user country or user language
        const candidates = sourcePool.filter(item => {
            if (item.country && item.country.toUpperCase() === userCountry.toUpperCase()) return false;
            if (item.lang && item.lang.toLowerCase() === userLang.toLowerCase()) return false;
            return true;
        });

        if (candidates.length < 2) return candidates;

        // Fisher-Yates sample of 2 items
        const shuffled = [...candidates];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled.slice(0, 2).map(item => ({
            id: item.id,
            i18nKey: item.i18nKey,
            defaultTitle: item.defaultTitle,
            fetchConfig: {
                type: item.type,
                code: item.code,
                mediaType: isSeries ? 'tv' : 'movie'
            }
        }));
    }

    /**
     * Generates the complete, ordered category configuration for a page view:
     * 1. Fixed top anchors (e.g. Trending).
     * 2. Shuffled category pool (genres, themes, tropes, universes) with the 4 regional rows
     *    (1 local country, 1 local language, 2 random world countries) randomly dispersed throughout.
     * @param {string} view - 'home', 'movies', or 'series'.
     * @param {Array<Object>} baseCategories - Static base categories defined in constants.js.
     * @returns {Array<Object>} Final categories list ready for rendering.
     */
    generateShuffledPageCategories(view, baseCategories) {
        const { country, language } = this.resolveUserContext();

        // 1. Resolve the 4 regional rows
        const localCountryRow = this.getLocalCountryRow(view, country);
        const localLanguageRow = this.getLocalLanguageRow(view, language);
        const randomWorldRows = this.getRandomWorldRows(view, country, language);
        const regionalRows = [localCountryRow, localLanguageRow, ...randomWorldRows];

        // 2. Identify fixed anchor row (Trending)
        const trendingId = view === 'movies'
            ? 'trending-movies-today-row'
            : view === 'series'
                ? 'trending-series-today-row'
                : 'trending-today-row';

        let fixedAnchor = null;
        const nonAnchorBaseCategories = [];

        for (const cat of baseCategories) {
            if (cat.id === trendingId) {
                fixedAnchor = cat;
            } else {
                nonAnchorBaseCategories.push(cat);
            }
        }

        // 3. Combine non-anchor base categories with the 4 regional rows
        const poolToShuffle = [...nonAnchorBaseCategories, ...regionalRows];

        // 4. Fisher-Yates shuffle over the entire pool to disperse regional rows among genres/themes
        for (let i = poolToShuffle.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [poolToShuffle[i], poolToShuffle[j]] = [poolToShuffle[j], poolToShuffle[i]];
        }

        // 5. Re-attach fixed anchor at the top
        return fixedAnchor ? [fixedAnchor, ...poolToShuffle] : poolToShuffle;
    }
}

export const regionalCategoryService = new RegionalCategoryService();
