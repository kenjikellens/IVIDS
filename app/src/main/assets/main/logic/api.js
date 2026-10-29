import { cacheManager } from './cache-manager.js';
import { getActiveAccountId, getNamespacedKey } from './account-helper.js';
import { PersistentStorage } from './persistent-storage.js';
import { API_CONFIG, PLAYER_CONFIG, NETWORK_CONFIG } from './constants.js';

const API_KEY = 'a341dc9a3c2dffa62668b614a98c1188'; // TODO: Replace with your TMDb API Key
const { BASE_URL, IMAGE_BASE_PATH, DEFAULT_PLAYER_BASE_URL } = API_CONFIG;

/** Mapping of streaming network IDs to TMDb production company IDs. */
const NETWORK_COMPANIES = Object.freeze({
    213: '213|178464|171251', // Netflix
    49: '3287|3268',           // HBO
    2739: '2',                // Disney
    1024: '20580',            // Amazon Prime
    2552: '131018'            // Apple TV+
});

/** Map of in-flight fetch promises keyed by URL, used to deduplicate concurrent identical requests. */
const _inflightRequests = new Map();

/** Cached today's date string (YYYY-MM-DD) to avoid re-creating Date objects in every fetch call. */
let _cachedTodayDate = null;

/** Cached player config object, invalidated when settings change. */
let _cachedPlayerConfig = null;
let _configOwnerId = null;
const DEFAULT_PLAYER_PROVIDERS = [...PLAYER_CONFIG.DEFAULT_PROVIDERS];

/** Cached slow connection evaluation state. */
let _slowConnectionResult = null;
let _slowConnectionTimestamp = 0;
const SLOW_CONNECTION_TTL = 5000;
let _measuredSlowUntil = 0;

/**
 * Marks the connection as slow for a specified duration based on live latency or throughput measurements.
 * @param {number} [durationMs=60000] - Duration in milliseconds to keep slow mode active.
 */
function markMeasuredSlowConnection(durationMs = 60000) {
    const now = Date.now();
    const wasSlow = _slowConnectionResult === true || now < _measuredSlowUntil || (typeof window !== 'undefined' && now < (window.__ividsSlowUntil || 0));
    _measuredSlowUntil = now + durationMs;
    _slowConnectionResult = true;
    _slowConnectionTimestamp = now;
    if (typeof window !== 'undefined') {
        window.__ividsSlowUntil = _measuredSlowUntil;
        window.__ividsSlowConnection = true;
        if (!wasSlow) window.dispatchEvent(new CustomEvent('networkslowdetected'));
    }
}

/**
 * Invalidates the cached slow-connection state.
 */
function invalidateSlowConnectionCache() {
    _slowConnectionResult = null;
    _slowConnectionTimestamp = 0;
    _measuredSlowUntil = 0;
    if (typeof window !== 'undefined') {
        window.__ividsSlowUntil = 0;
        window.__ividsSlowConnection = false;
    }
}

// Image Size Constants
const POSTER_SIZE = API_CONFIG.POSTER_SIZES.STANDARD;
const BACKDROP_SIZE = API_CONFIG.BACKDROP_SIZES.STANDARD;
const STILL_SIZE = API_CONFIG.BACKDROP_SIZES.LOW;
const DETAIL_POSTER_SIZE = API_CONFIG.POSTER_SIZES.LARGE;

/**
 * Performs a fetch with timeout and exponential backoff retries.
 * @param {string|Request} resource - Target URL or request object.
 * @param {Object} [options={}] - Fetch configuration options.
 * @returns {Promise<Response>} The network response.
 */
async function fetchWithRetry(resource, options = {}) {
    const { timeout = API_CONFIG.FETCH_TIMEOUT_MS, retries = API_CONFIG.FETCH_RETRIES } = options;
    let lastError;

    for (let i = 0; i <= retries; i++) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        const reqStart = Date.now();
        try {
            const response = await fetch(resource, { ...options, signal: controller.signal });
            clearTimeout(id);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            if ((Date.now() - reqStart) > 1200 || i > 0) markMeasuredSlowConnection(60000);
            return response;
        } catch (error) {
            clearTimeout(id);
            lastError = error;
            if ((Date.now() - reqStart) > 1200 || error?.name === 'AbortError') markMeasuredSlowConnection(60000);
            if (i < retries) await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i)));
        }
    }
    throw lastError;
}

/**
 * Wraps fetchWithRetry with in-flight deduplication.
 * @param {string} url - The URL endpoint to fetch.
 * @param {Object} [options={}] - Configuration options for fetch.
 * @returns {Promise<Response>} The fetch response promise.
 */
async function deduplicatedFetch(url, options = {}) {
    if (_inflightRequests.has(url)) {
        try {
            const res = await _inflightRequests.get(url);
            try { return res.clone(); } catch { return res; }
        } catch {
            _inflightRequests.delete(url);
        }
    }
    const cleanUp = () => _inflightRequests.delete(url);
    const promise = fetchWithRetry(url, options).finally(cleanUp);
    _inflightRequests.set(url, promise);
    const res = await promise;
    try { return res.clone(); } catch { return res; }
}

/**
 * Returns today's date in YYYY-MM-DD format, cached for the session lifetime.
 * @returns {string} Today's date ISO substring.
 */
function getTodayDate() {
    if (!_cachedTodayDate) _cachedTodayDate = new Date().toISOString().split('T')[0];
    return _cachedTodayDate;
}

/**
 * Shuffles an array in-place using the Fisher-Yates algorithm.
 * @param {Array} array - Target array to shuffle.
 * @returns {Array} Shuffled array reference.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/**
 * Normalizes TTL values to minutes for CacheManager.
 * @param {number} [ttl=15] - Cache lifetime in minutes or fractional hours.
 * @returns {number} Normalized duration in minutes.
 */
function normalizeTtlMinutes(ttl = 15) {
    if (!ttl) return 15;
    return ttl < 1 ? Math.round(ttl * 60) : ttl;
}

/**
 * Merges unlocalized original artwork (poster_path, backdrop_path) from unlocalized items
 * into localized items so that titles and overviews remain translated while artwork stays original.
 * @param {Array<Object>} localizedItems - Media items with translated title and overview.
 * @param {Array<Object>} unlocalizedItems - Media items with original unlocalized artwork.
 * @returns {Array<Object>} The localized items with original artwork mapped.
 */
function _mergeOriginalArtwork(localizedItems, unlocalizedItems) {
    if (!Array.isArray(localizedItems) || !Array.isArray(unlocalizedItems) || unlocalizedItems.length === 0) return localizedItems;
    const artworkMap = new Map();
    for (const item of unlocalizedItems) {
        if (item?.id != null) artworkMap.set(item.id, { poster_path: item.poster_path, backdrop_path: item.backdrop_path });
    }
    for (const item of localizedItems) {
        const orig = item?.id != null && artworkMap.get(item.id);
        if (orig) {
            if (orig.poster_path) item.poster_path = orig.poster_path;
            if (orig.backdrop_path) item.backdrop_path = orig.backdrop_path;
        }
    }
    return localizedItems;
}

/**
 * Filters out media items whose release or air date is in the future.
 * @param {Array<Object>} results - Media items from TMDb.
 * @returns {Array<Object>} Media items released on or before today.
 */
function _filterReleased(results) {
    if (!Array.isArray(results)) return [];
    const today = getTodayDate();
    return results.filter(item => {
        const d = item.release_date || item.first_air_date;
        return d && d <= today;
    });
}

/**
 * Core TMDb network fetcher with retry, deduplication, and automatic original artwork merge.
 * @param {string} url - TMDb API request URL.
 * @param {Object} [options={}] - Fetch configuration options.
 * @returns {Promise<any>} The parsed TMDb JSON data.
 */
async function _fetchTmdb(url, options = {}) {
    const lang = Api.getLanguageCode();
    const needArtwork = options.preserveOriginalArtwork !== false && lang !== 'en' && url.includes('language=');
    if (!needArtwork) {
        const res = await deduplicatedFetch(url);
        return await res.json();
    }
    const unlocUrl = options.unlocalizedUrl || url.replace(/([?&])language=[^&]*(&|$)/, '$1').replace(/[?&]$/, '');
    const [resLoc, resUnloc] = await Promise.all([
        deduplicatedFetch(url),
        deduplicatedFetch(unlocUrl).catch(() => null)
    ]);
    const dataLoc = await resLoc.json();
    const dataUnloc = resUnloc ? await resUnloc.json().catch(() => null) : null;
    const locItems = dataLoc?.results || (Array.isArray(dataLoc) ? dataLoc : null);
    const unlocItems = dataUnloc?.results || (Array.isArray(dataUnloc) ? dataUnloc : null);
    if (locItems && unlocItems) _mergeOriginalArtwork(locItems, unlocItems);
    return dataLoc;
}

export const Api = {
    getApiKey: () => API_KEY,

    // Size constants
    POSTER_SIZE,
    BACKDROP_SIZE,
    STILL_SIZE,
    DETAIL_POSTER_SIZE,

    /** Cached recommended sizes to avoid recalculation on rapid DOM updates. */
    _recommendedSizes: {},

    /**
     * Determines whether the active client is a TV device (Android TV, Tizen, webOS, Google TV).
     * @returns {boolean} True if running on a TV platform.
     */
    isTV: () => {
        if (typeof window !== 'undefined' && window.AndroidSettings && typeof window.AndroidSettings.isTV === 'function') {
            try { if (window.AndroidSettings.isTV()) return true; } catch (e) { console.warn('Error reading isTV:', e); }
        }
        const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent.toLowerCase() : '';
        return ua.includes('tizen') || ua.includes('webos') || ua.includes('android tv') || ua.includes('smarttv') || ua.includes('googletv') || ua.includes('aft') || !!(typeof window !== 'undefined' && window.tizen);
    },

    /**
     * Marks the active connection as slow for a specified duration and clears cached size tiers.
     * @param {number} [durationMs=60000] - Duration in milliseconds to keep slow mode active.
     */
    markSlowConnection: (durationMs = 60000) => {
        markMeasuredSlowConnection(durationMs);
        Api._recommendedSizes = {};
    },

    /**
     * Checks if the app is running in slow connection or data saver mode.
     * @returns {boolean} True if slow connection or data saver mode is active.
     */
    isSlowConnection: () => {
        const now = Date.now();
        const isExpiringSlow = now < _measuredSlowUntil || (typeof window !== 'undefined' && now < (window.__ividsSlowUntil || 0));
        if (isExpiringSlow) {
            if (typeof window !== 'undefined') window.__ividsSlowConnection = true;
            return true;
        } else if (typeof window !== 'undefined' && window.__ividsSlowUntil && now >= window.__ividsSlowUntil) {
            window.__ividsSlowConnection = false;
            window.__ividsSlowUntil = 0;
        }
        if (_slowConnectionResult !== null && (now - _slowConnectionTimestamp) < SLOW_CONNECTION_TTL) {
            return _slowConnectionResult;
        }

        const markSlow = (ms) => {
            if (ms) markMeasuredSlowConnection(ms);
            _slowConnectionResult = true;
            _slowConnectionTimestamp = now;
            return true;
        };

        let isSavedDataSaver = false;
        let settings = {};
        let userKey = '';
        try {
            userKey = getNamespacedKey('settings');
            const saved = PersistentStorage.getItem(userKey);
            if (saved) {
                settings = JSON.parse(saved);
                if (settings.dataSaver === true || settings.dataSaver === 'true') isSavedDataSaver = true;
            }
        } catch (e) {
            console.error('Api: Failed to read dataSaver setting:', e);
        }

        if (isSavedDataSaver) return markSlow();

        if (typeof navigator !== 'undefined' && navigator.connection) {
            const conn = navigator.connection;
            if (conn.saveData) {
                try {
                    if (userKey && settings.dataSaver !== true && settings.dataSaver !== 'true') {
                        settings.dataSaver = true;
                        PersistentStorage.setItem(userKey, JSON.stringify(settings));
                        window.dispatchEvent(new CustomEvent('datasaverchanged', { detail: true }));
                    }
                } catch (e) {
                    console.error('Api: Failed to auto-enable dataSaver setting:', e);
                }
                return markSlow();
            }
            const isSlowType = ['slow-2g', '2g', '3g'].includes(conn.effectiveType);
            const isHighRtt = typeof conn.rtt === 'number' && conn.rtt > 500;
            const isLowDownlink = typeof conn.downlink === 'number' && conn.downlink > 0 && conn.downlink < NETWORK_CONFIG.SLOW_THRESHOLD_MBPS;
            if (isSlowType || isHighRtt || isLowDownlink) return markSlow(15000);
        }

        _slowConnectionResult = false;
        _slowConnectionTimestamp = now;
        return false;
    },

    /**
     * Determines the optimal TMDb poster size based on connection quality and screen breakpoints.
     * @returns {string} The TMDb poster size path key.
     */
    getRecommendedPosterSize: () => {
        if (Api.isSlowConnection()) return 'w92';
        const vw = window.innerWidth;
        const isPortrait = window.matchMedia('(max-aspect-ratio: 3/4)').matches;
        if (isPortrait) return vw <= 360 ? 'w92' : (vw <= 480 ? 'w154' : 'w185');
        if (vw <= 600) return 'w154';
        if (vw <= 900) return 'w185';
        return (vw <= 1440 || Api.isTV()) ? 'w342' : 'w500';
    },

    /**
     * Determines the optimal TMDb detail poster size based on connection quality and screen breakpoints.
     * @returns {string} The TMDb poster size key.
     */
    getRecommendedDetailPosterSize: () => {
        if (Api.isSlowConnection()) return 'w92';
        const vw = window.innerWidth;
        return vw <= 480 ? 'w185' : (vw <= 1440 ? 'w342' : 'w500');
    },

    /**
     * Determines the optimal TMDb backdrop size based on connection quality and screen width.
     * @returns {string} The TMDb backdrop size key.
     */
    getRecommendedBackdropSize: () => {
        if (Api.isSlowConnection()) return 'w300';
        const vw = window.innerWidth;
        if (window.matchMedia('(max-aspect-ratio: 3/4)').matches) return vw <= 480 ? 'w300' : 'w780';
        return (vw <= 900 || Api.isTV()) ? 'w780' : BACKDROP_SIZE;
    },

    /**
     * Determines the optimal TMDb still image size for episode cards.
     * @returns {string} The TMDb still size key.
     */
    getRecommendedStillSize: () => 'w300',

    /**
     * Determines the optimal TMDb profile image size for actor avatars.
     * @returns {string} The TMDb profile size key.
     */
    getRecommendedProfileSize: () => 'w185',

    /**
     * Determines the optimal TMDb image size key matching container width.
     * @param {number} containerWidth - Container width in CSS pixels.
     * @param {boolean} [isBackdrop=false] - True for backdrops, false for posters.
     * @returns {string} TMDb size path segment.
     */
    getRecommendedSizeForContainer: (containerWidth, isBackdrop = false) => {
        if (Api.isSlowConnection()) return isBackdrop ? 'w300' : 'w92';
        const physicalWidth = containerWidth * (window.devicePixelRatio || 1);
        if (isBackdrop) {
            if (physicalWidth <= 0) return Api.getRecommendedSizeForContainer(window.innerWidth * (window.devicePixelRatio || 1), true);
            if (physicalWidth <= 300) return 'w300';
            if (physicalWidth <= 780) return 'w780';
            return physicalWidth <= 1280 ? 'w1280' : 'original';
        }
        if (physicalWidth <= 0) return Api.getRecommendedPosterSize();
        if (physicalWidth <= 92) return 'w92';
        if (physicalWidth <= 154) return 'w154';
        if (physicalWidth <= 185) return 'w185';
        if (physicalWidth <= 342) return 'w342';
        return physicalWidth <= 500 ? 'w500' : (physicalWidth <= 780 ? 'w780' : 'original');
    },

    /**
     * Resets cached recommended image sizes and slow-connection evaluation state.
     */
    invalidateImageQualityCache: () => {
        Api._recommendedSizes = {};
        invalidateSlowConnectionCache();
    },

    /**
     * Generates a fully qualified TMDb image URL with responsive sizing.
     * @param {string} path - TMDb image file path.
     * @param {string} [size=null] - Explicit size tier key.
     * @returns {string} Complete image URL or placeholder path.
     */
    getImageUrl: (path, size = null) => {
        if (!path) return 'assets/placeholder.png';
        let finalSize = size;
        if (!finalSize) {
            const screenKey = `${window.innerWidth}x${window.devicePixelRatio || 1}_${Api.isSlowConnection() ? 'slow' : 'fast'}`;
            if (!Api._recommendedSizes[screenKey]) Api._recommendedSizes[screenKey] = Api.getRecommendedPosterSize();
            finalSize = Api._recommendedSizes[screenKey];
        }
        return `${IMAGE_BASE_PATH}/${finalSize}${path.startsWith('/') ? path : `/${path}`}`;
    },

    /**
     * Preloads an image into browser cache using a link preload tag.
     * @param {string} path - TMDb image file path.
     * @param {string} [size=null] - Target size tier key.
     */
    prefetchImage: (path, size = null) => {
        if (!path) return;
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = Api.getImageUrl(path, size);
        document.head.appendChild(link);
    },

    /**
     * Retrieves the current user language code mapped to TMDb supported formats.
     * @returns {string} The ISO 639-1 language code.
     */
    getLanguageCode() {
        const lang = (typeof window !== 'undefined' && window.i18n && window.i18n.currentLanguage) || 'en';
        return lang === 'zh' ? 'zh-CN' : lang;
    },

    /**
     * Retrieves the include_adult user setting from persistent storage.
     * @returns {boolean} True if adult content is permitted.
     */
    getIncludeAdult() {
        try {
            const userKey = getNamespacedKey('settings');
            const saved = PersistentStorage.getItem(userKey);
            if (saved) {
                const settings = JSON.parse(saved);
                return settings.includeAdult === true || settings.includeAdult === 'true';
            }
        } catch (e) {
            console.error('Error reading includeAdult setting:', e);
        }
        return false;
    },

    /**
     * Centralized cached fetch helper with automatic retry, deduplication, and original artwork preservation.
     * @param {string} cacheKey - Unique cache key identifier.
     * @param {string} url - Target TMDb endpoint URL.
     * @param {number} [ttl=15] - Cache TTL duration in minutes or decimal hours.
     * @param {Function} [transformFn=null] - Optional transformation function applied to response.
     * @param {Object} [options={}] - Options for shuffling, caching, and artwork merging.
     * @returns {Promise<any>} The parsed and processed response data.
     */
    async _fetchWithCache(cacheKey, url, ttl = 15, transformFn = null, options = {}) {
        if (cacheKey) {
            const cached = cacheManager.get(cacheKey);
            if (cached) return (options.shuffle && Array.isArray(cached)) ? shuffleArray([...cached]) : cached;
        }
        try {
            let data = await _fetchTmdb(url, options);
            if (transformFn) data = transformFn(data) || data;
            if (cacheKey && data) cacheManager.set(cacheKey, data, normalizeTtlMinutes(ttl));
            return (options.shuffle && Array.isArray(data)) ? shuffleArray([...data]) : data;
        } catch (error) {
            console.error(`_fetchWithCache error for ${url}:`, error);
            throw error;
        }
    },

    /**
     * Fetches a 2-page list (30 items) with parallel requests, date filtering, caching, and original artwork.
     * @param {string} endpoint - TMDb relative endpoint (e.g. 'discover/movie').
     * @param {string} [queryParams=''] - Query parameters string.
     * @param {string} cacheKey - Unique cache key identifier.
     * @param {number} [ttl=15] - Cache TTL duration in minutes.
     * @param {string} [type='movie'] - Media type ('movie' or 'tv').
     * @returns {Promise<Array>} List of up to 30 media items.
     */
    async _fetchPagedList(endpoint, queryParams = '', cacheKey, ttl = 15, type = 'movie') {
        if (cacheKey) {
            const cached = cacheManager.get(cacheKey);
            if (cached) return shuffleArray([...cached]);
        }
        const lang = this.getLanguageCode();
        const today = getTodayDate();
        const hasDate = queryParams.includes('primary_release_date') || queryParams.includes('first_air_date');
        const dateFilter = hasDate ? '' : (type === 'movie' ? `&primary_release_date.lte=${today}` : `&first_air_date.lte=${today}`);
        const cleanParams = queryParams ? `&${queryParams}` : '';
        const baseQuery = `api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}${dateFilter}${cleanParams}&language=${lang}`;

        try {
            const [p1, p2] = await Promise.all([
                _fetchTmdb(`${BASE_URL}/${endpoint}?${baseQuery}&page=1`),
                _fetchTmdb(`${BASE_URL}/${endpoint}?${baseQuery}&page=2`)
            ]);
            const combined = [...(p1?.results || []), ...(p2?.results || [])].slice(0, 30);
            if (combined.length > 0 && cacheKey) cacheManager.set(cacheKey, combined, normalizeTtlMinutes(ttl));
            return shuffleArray(combined);
        } catch (error) {
            console.error(`_fetchPagedList error for ${endpoint}:`, error);
            throw error;
        }
    },

    /**
     * Fetches trending items for a specified time window with release date filtering and original artwork.
     * @param {string} [timeWindow='week'] - Timeframe ('day' or 'week').
     * @returns {Promise<Array>} List of trending content.
     */
    async _fetchTrendingList(timeWindow = 'week') {
        const lang = this.getLanguageCode();
        const cacheKey = `trending_all_${timeWindow}_${lang}`;
        const url = `${BASE_URL}/trending/all/${timeWindow}?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&language=${lang}`;

        return this._fetchWithCache(
            cacheKey,
            url,
            15,
            (data) => _filterReleased(data?.results),
            { shuffle: true, preserveOriginalArtwork: true }
        );
    },

    /** Fetches weekly trending movies and TV shows from TMDb. @returns {Promise<Array>} */
    fetchTrending() { return this._fetchTrendingList('week'); },

    /** Fetches daily trending movies and TV shows from TMDb. @returns {Promise<Array>} */
    fetchTrendingToday() { return this._fetchTrendingList('day'); },

    /** Fetches top-rated movies from TMDb. @returns {Promise<Array>} */
    fetchTopRated() {
        const lang = this.getLanguageCode();
        return this._fetchPagedList('movie/top_rated', '', `movie_top_rated_${lang}`, 60, 'movie');
    },

    /** Fetches popular TV shows from TMDb. @returns {Promise<Array>} */
    fetchPopularTV() {
        const lang = this.getLanguageCode();
        return this._fetchPagedList('tv/popular', '', `tv_popular_${lang}`, 15, 'tv');
    },

    /** Fetches top-rated TV shows from TMDb. @returns {Promise<Array>} */
    fetchTopRatedTV() {
        const lang = this.getLanguageCode();
        return this._fetchPagedList('tv/top_rated', '', `tv_top_rated_${lang}`, 60, 'tv');
    },

    /**
     * Fetches content from TMDb discover endpoint for a specific type and query parameters.
     * Powers category rails and filter lists across browse pages.
     * @param {string} type - 'movie' or 'tv'.
     * @param {string} params - Query parameters for TMDb discover endpoint.
     * @returns {Promise<Array>} List of discovered content.
     */
    _fetchDiscover(type, params) {
        const lang = this.getLanguageCode();
        return this._fetchPagedList(`discover/${type}`, params, `discover_${type}_${params}_${lang}`, 15, type);
    },

    // Movies by Genre
    /** Fetches action movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchActionMovies() { return this._fetchDiscover('movie', 'with_genres=28'); },
    /** Fetches adventure movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchAdventureMovies() { return this._fetchDiscover('movie', 'with_genres=12'); },
    /** Fetches animation movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchAnimationMovies() { return this._fetchDiscover('movie', 'with_genres=16'); },
    /** Fetches comedy movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchComedyMovies() { return this._fetchDiscover('movie', 'with_genres=35'); },
    /** Fetches crime movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchCrimeMovies() { return this._fetchDiscover('movie', 'with_genres=80'); },
    /** Fetches documentary movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchDocumentaryMovies() { return this._fetchDiscover('movie', 'with_genres=99'); },
    /** Fetches drama movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchDramaMovies() { return this._fetchDiscover('movie', 'with_genres=18'); },
    /** Fetches family movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchFamilyMovies() { return this._fetchDiscover('movie', 'with_genres=10751'); },
    /** Fetches fantasy movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchFantasyMovies() { return this._fetchDiscover('movie', 'with_genres=14'); },
    /** Fetches history movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchHistoryMovies() { return this._fetchDiscover('movie', 'with_genres=36'); },
    /** Fetches horror movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchHorrorMovies() { return this._fetchDiscover('movie', 'with_genres=27'); },
    /** Fetches music movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchMusicMovies() { return this._fetchDiscover('movie', 'with_genres=10402'); },
    /** Fetches mystery movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchMysteryMovies() { return this._fetchDiscover('movie', 'with_genres=9648'); },
    /** Fetches romance movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchRomanceMovies() { return this._fetchDiscover('movie', 'with_genres=10749'); },
    /** Fetches sci-fi movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchSciFiMovies() { return this._fetchDiscover('movie', 'with_genres=878'); },
    /** Fetches thriller movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchThrillerMovies() { return this._fetchDiscover('movie', 'with_genres=53'); },
    /** Fetches war movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchWarMovies() { return this._fetchDiscover('movie', 'with_genres=10752'); },
    /** Fetches western movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchWesternMovies() { return this._fetchDiscover('movie', 'with_genres=37'); },
    /** Fetches anime movies from TMDb for browse rails. @returns {Promise<Array>} */
    fetchAnimeMovies() { return this._fetchDiscover('movie', 'with_genres=16&with_original_language=ja'); },

    // Studios & Franchises
    /** Fetches Disney movies from TMDb by production company. @returns {Promise<Array>} */
    fetchDisneyMovies() { return this._fetchDiscover('movie', 'with_companies=2'); },
    /** Fetches Marvel movies from TMDb by production company. @returns {Promise<Array>} */
    fetchMarvelMovies() { return this._fetchDiscover('movie', 'with_companies=420'); },
    /** Fetches Pixar movies from TMDb by production company. @returns {Promise<Array>} */
    fetchPixarMovies() { return this._fetchDiscover('movie', 'with_companies=3'); },
    /** Fetches Studio Ghibli movies from TMDb by production company. @returns {Promise<Array>} */
    fetchStudioGhibli() { return this._fetchDiscover('movie', 'with_companies=10342'); },

    /**
     * Fetches a combined list of popular Netflix original movies and TV series.
     * Updates the Netflix originals carousel on the home screen.
     * @returns {Promise<Array>} List of combined Netflix originals.
     */
    async fetchNetflixOriginals() {
        const lang = this.getLanguageCode();
        const cacheKey = `netflix_originals_combined_${lang}`;
        const cached = cacheManager.get(cacheKey);
        if (cached) return shuffleArray([...cached]);

        try {
            const [movies, tv] = await Promise.all([
                this._fetchDiscover('movie', 'with_companies=213|178464|171251'),
                this._fetchDiscover('tv', 'with_networks=213')
            ]);
            const finalResults = [...(movies || []).map(m => ({ ...m, media_type: 'movie' })), ...(tv || []).map(t => ({ ...t, media_type: 'tv' }))].slice(0, 30);
            if (finalResults.length > 0) cacheManager.set(cacheKey, finalResults, 15);
            return shuffleArray(finalResults);
        } catch (error) {
            console.error('Error fetching netflix originals:', error);
            throw error;
        }
    },

    // Quality & Time-based Collections
    /** Fetches highly rated movies (vote >= 8, count >= 1000). @returns {Promise<Array>} */
    fetchHighlyRated() { return this._fetchDiscover('movie', 'vote_average.gte=8&vote_count.gte=1000&sort_by=vote_average.desc'); },
    /** Fetches newly released movies this calendar year. @returns {Promise<Array>} */
    fetchNewThisYear() { return this._fetchDiscover('movie', `primary_release_date.gte=${new Date().getFullYear()}-01-01&sort_by=popularity.desc`); },
    /** Fetches classic movies from 1970 to 1999. @returns {Promise<Array>} */
    fetchClassicMovies() { return this._fetchDiscover('movie', 'primary_release_date.gte=1970-01-01&primary_release_date.lte=1999-12-31&vote_count.gte=500&sort_by=vote_average.desc'); },
    /** Fetches popular critically acclaimed award winners. @returns {Promise<Array>} */
    fetchAwardWinners() { return this._fetchDiscover('movie', 'vote_average.gte=7.5&vote_count.gte=5000&sort_by=vote_count.desc'); },
    /** Fetches Oscar contenders and acclaimed winners. @returns {Promise<Array>} */
    fetchOscarWinners() { return this._fetchDiscover('movie', 'vote_average.gte=7.8&vote_count.gte=3000&sort_by=vote_average.desc'); },
    /** Fetches mystery and mind-bending thrillers. @returns {Promise<Array>} */
    fetchMindBending() { return this._fetchDiscover('movie', 'with_genres=9648&sort_by=vote_average.desc'); },
    /** Fetches nostalgic 80s and 90s hits. @returns {Promise<Array>} */
    fetchNostalgia80s90s() { return this._fetchDiscover('movie', 'primary_release_date.gte=1980-01-01&primary_release_date.lte=1999-12-31&sort_by=popularity.desc'); },
    /** Fetches indie movies from boutique studios. @returns {Promise<Array>} */
    fetchIndieGems() { return this._fetchDiscover('movie', 'with_companies=41077|7467|10256'); },

    /**
     * Fetches movies or series filtered by country of origin.
     * @param {string} countryCode - ISO 3166-1 alpha-2 country code.
     * @param {string} [type='movie'] - 'movie' or 'tv'.
     * @returns {Promise<Array>} List of discovered content.
     */
    fetchByCountry(countryCode, type = 'movie') {
        return this._fetchDiscover(type, `with_origin_country=${countryCode}&sort_by=popularity.desc`);
    },

    /**
     * Fetches movies or series filtered by original language.
     * @param {string} langCode - ISO 639-1 language code.
     * @param {string} [type='movie'] - 'movie' or 'tv'.
     * @returns {Promise<Array>} List of discovered content.
     */
    fetchByLanguage(langCode, type = 'movie') {
        return this._fetchDiscover(type, `with_original_language=${langCode}&sort_by=popularity.desc`);
    },

    // Universes & Franchises
    /** Fetches DC Extended Universe movies. @returns {Promise<Array>} */
    fetchDcMovies() { return this._fetchDiscover('movie', 'with_companies=9993|429&sort_by=popularity.desc'); },
    /** Fetches DC Universe television series. @returns {Promise<Array>} */
    fetchDcSeries() { return this._fetchDiscover('tv', 'with_companies=9993|429&sort_by=popularity.desc'); },

    // Themes & Tropes
    /** Fetches movies based on true stories and historical events. @returns {Promise<Array>} */
    fetchTrueStoryMovies() { return this._fetchDiscover('movie', 'with_keywords=9672&sort_by=popularity.desc'); },
    /** Fetches heist and robbery movies. @returns {Promise<Array>} */
    fetchHeistMovies() { return this._fetchDiscover('movie', 'with_keywords=10051&sort_by=popularity.desc'); },
    /** Fetches zombie and post-apocalyptic movies. @returns {Promise<Array>} */
    fetchZombieMovies() { return this._fetchDiscover('movie', 'with_keywords=12377&sort_by=popularity.desc'); },
    /** Fetches sports movies and athletic dramas. @returns {Promise<Array>} */
    fetchSportsMovies() { return this._fetchDiscover('movie', 'with_keywords=6075&sort_by=popularity.desc'); },
    /** Fetches romantic comedy movies. @returns {Promise<Array>} */
    fetchRomComMovies() { return this._fetchDiscover('movie', 'with_genres=35,10749&sort_by=popularity.desc'); },
    /** Fetches psychological thrillers and suspense films. @returns {Promise<Array>} */
    fetchPsychologicalThrillers() { return this._fetchDiscover('movie', 'with_genres=53&with_keywords=9715&sort_by=popularity.desc'); },
    /** Fetches cyberpunk and dystopian sci-fi movies. @returns {Promise<Array>} */
    fetchCyberpunkMovies() { return this._fetchDiscover('movie', 'with_keywords=4565|12190&sort_by=popularity.desc'); },

    // Formats & TV Specials
    /** Fetches standup comedy specials. @returns {Promise<Array>} */
    fetchStandupComedy() { return this._fetchDiscover('movie', 'with_genres=35,99&sort_by=popularity.desc'); },
    /** Fetches limited event mini-series. @returns {Promise<Array>} */
    fetchMiniSeries() { return this._fetchDiscover('tv', 'with_type=2&sort_by=popularity.desc'); },
    /** Fetches true crime and documentary series. @returns {Promise<Array>} */
    fetchDocuseries() { return this._fetchDiscover('tv', 'with_genres=99,80&sort_by=popularity.desc'); },
    /** Fetches popular comedy sitcoms. @returns {Promise<Array>} */
    fetchSitcoms() { return this._fetchDiscover('tv', 'with_genres=35&sort_by=vote_count.desc'); },

    /**
     * Fetches content released within a specific decade range.
     * @param {string} type - 'movie' or 'tv'.
     * @param {number} startYear - Start year of the decade.
     * @param {number} endYear - End year of the decade.
     * @returns {Promise<Array>} List of discovered content.
     */
    fetchDecadeContent(type, startYear, endYear) {
        const prefix = type === 'movie' ? 'primary_release_date' : 'first_air_date';
        return this._fetchDiscover(type, `${prefix}.gte=${startYear}-01-01&${prefix}.lte=${endYear}-12-31&sort_by=popularity.desc`);
    },

    // Regional Cinema
    /** Fetches Bollywood Hindi movies. @returns {Promise<Array>} */
    fetchBollywood() { return this._fetchDiscover('movie', 'with_original_language=hi&sort_by=popularity.desc'); },
    /** Fetches Korean movies and cinema. @returns {Promise<Array>} */
    fetchKoreanContent() { return this._fetchDiscover('movie', 'with_original_language=ko&sort_by=popularity.desc'); },

    // TV Series by Genre
    /** Fetches action and adventure television series. @returns {Promise<Array>} */
    fetchActionAdventureSeries() { return this._fetchDiscover('tv', 'with_genres=10759'); },
    /** Fetches animated television series. @returns {Promise<Array>} */
    fetchAnimationSeries() { return this._fetchDiscover('tv', 'with_genres=16'); },
    /** Fetches comedy television series. @returns {Promise<Array>} */
    fetchComedySeries() { return this._fetchDiscover('tv', 'with_genres=35'); },
    /** Fetches crime television series. @returns {Promise<Array>} */
    fetchCrimeSeries() { return this._fetchDiscover('tv', 'with_genres=80'); },
    /** Fetches documentary television series. @returns {Promise<Array>} */
    fetchDocumentarySeries() { return this._fetchDiscover('tv', 'with_genres=99'); },
    /** Fetches drama television series. @returns {Promise<Array>} */
    fetchDramaSeries() { return this._fetchDiscover('tv', 'with_genres=18'); },
    /** Fetches family television series. @returns {Promise<Array>} */
    fetchFamilySeries() { return this._fetchDiscover('tv', 'with_genres=10751'); },
    /** Fetches kids television series. @returns {Promise<Array>} */
    fetchKidsSeries() { return this._fetchDiscover('tv', 'with_genres=10762'); },
    /** Fetches mystery television series. @returns {Promise<Array>} */
    fetchMysterySeries() { return this._fetchDiscover('tv', 'with_genres=9648'); },
    /** Fetches reality television series. @returns {Promise<Array>} */
    fetchRealitySeries() { return this._fetchDiscover('tv', 'with_genres=10764'); },
    /** Fetches sci-fi and fantasy television series. @returns {Promise<Array>} */
    fetchSciFiFantasySeries() { return this._fetchDiscover('tv', 'with_genres=10765'); },
    /** Fetches soap opera series. @returns {Promise<Array>} */
    fetchSoapSeries() { return this._fetchDiscover('tv', 'with_genres=10766'); },
    /** Fetches war and politics series. @returns {Promise<Array>} */
    fetchWarPoliticsSeries() { return this._fetchDiscover('tv', 'with_genres=10768'); },
    /** Fetches western television series. @returns {Promise<Array>} */
    fetchWesternSeries() { return this._fetchDiscover('tv', 'with_genres=37'); },
    /** Fetches anime series from TMDb. @returns {Promise<Array>} */
    fetchAnimeSeries() { return this._fetchDiscover('tv', 'with_genres=16&with_original_language=ja'); },
    /** Fetches Disney television series. @returns {Promise<Array>} */
    fetchDisneySeries() { return this._fetchDiscover('tv', 'with_companies=2'); },
    /** Fetches Marvel television series. @returns {Promise<Array>} */
    fetchMarvelSeries() { return this._fetchDiscover('tv', 'with_companies=420'); },
    /** Fetches popular Netflix original series. @returns {Promise<Array>} */
    fetchNetflixSeries() { return this._fetchDiscover('tv', 'with_companies=213&sort_by=popularity.desc'); },
    /** Fetches popular Korean dramas and series. @returns {Promise<Array>} */
    fetchKoreanSeries() { return this._fetchDiscover('tv', 'with_original_language=ko&sort_by=popularity.desc'); },
    /** Fetches TV movies from TMDb. @returns {Promise<Array>} */
    fetchTvMovies() { return this._fetchDiscover('movie', 'with_genres=10770'); },

    /**
     * Fetches series or movies belonging to a specific network or company mapping.
     * @param {string} type - 'movie' or 'tv'.
     * @param {number} networkId - The streaming network/provider ID.
     * @returns {Promise<Array>} List of network content.
     */
    fetchNetworkContent(type, networkId) {
        if (type === 'tv') return this._fetchDiscover('tv', `with_networks=${networkId}`);
        const companyId = NETWORK_COMPANIES[networkId] || '';
        return this._fetchDiscover('movie', `with_companies=${companyId}`);
    },

    /** Fetches TV series categorized in News or Talk genres. @returns {Promise<Array>} */
    fetchTalkNewsSeries() { return this._fetchDiscover('tv', 'with_genres=10767|10763'); },

    /**
     * Searches TMDb for movies and TV shows matching a query with original artwork preservation.
     * @param {string} query - The search query.
     * @param {number} [page=1] - The page number of search results.
     * @returns {Promise<Array>} List of search results with release dates <= today.
     */
    async searchContent(query, page = 1) {
        if (API_KEY.includes('TODO') || !query) return [];
        try {
            const lang = this.getLanguageCode();
            const url = `${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=${page}&include_adult=${this.getIncludeAdult()}&language=${lang}`;
            const data = await _fetchTmdb(url);
            return _filterReleased(data?.results);
        } catch (error) {
            console.error('Error searching:', error);
            return [];
        }
    },

    /**
     * Alias for searchContent matching standard TMDb multi-search endpoint naming.
     * @param {string} query - The search query.
     * @param {number} [page=1] - Page number.
     * @returns {Promise<Array>} List of search results.
     */
    searchMulti(query, page = 1) {
        return this.searchContent(query, page);
    },

    /**
     * Fetches recommended movies or TV shows based on a specific content ID with original artwork.
     * @param {number|string} id - The TMDb content ID.
     * @param {string} type - 'movie' or 'tv'.
     * @returns {Promise<Array>} List of recommended content.
     */
    async fetchRecommendations(id, type) {
        if (API_KEY.includes('TODO')) return [];
        try {
            const lang = this.getLanguageCode();
            const url = `${BASE_URL}/${type}/${id}/recommendations?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&language=${lang}`;
            const data = await _fetchTmdb(url);
            return _filterReleased(data?.results);
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            return [];
        }
    },

    /**
     * Fetches detailed metadata for a movie or TV show, selecting original artwork while preserving translated text.
     * @param {number|string} id - TMDb content ID.
     * @param {string} type - 'movie' or 'tv'.
     * @returns {Promise<Object|null>} Detailed content metadata object.
     */
    async getDetails(id, type) {
        if (API_KEY.includes('TODO')) return null;
        const lang = this.getLanguageCode();
        const cacheKey = `details_${type}_${id}_${lang}`;
        const cached = cacheManager.get(cacheKey);
        if (cached) return cached;

        try {
            const baseAppend = type === 'movie' ? 'release_dates' : 'content_ratings';
            const url = `${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=${baseAppend},videos,credits&language=${lang}`;
            const imagesUrl = `${BASE_URL}/${type}/${id}/images?api_key=${API_KEY}`;
            const [response, imagesRes] = await Promise.all([deduplicatedFetch(url), deduplicatedFetch(imagesUrl).catch(() => null)]);
            const data = await response.json();
            const imagesData = imagesRes ? await imagesRes.json().catch(() => null) : null;

            if (data && !data.status_code) {
                if (imagesData) data.images = imagesData;
                const allPosters = data.images?.posters || [];
                if (allPosters.length > 0) {
                    const origPoster = allPosters.find(p => p.iso_639_1 === data.original_language)
                        || allPosters.find(p => p.iso_639_1 === null)
                        || allPosters.find(p => p.iso_639_1 === 'en')
                        || allPosters[0];
                    if (origPoster?.file_path) data.poster_path = origPoster.file_path;
                }
                const allBackdrops = data.images?.backdrops || [];
                if (allBackdrops.length > 0) {
                    const origBackdrop = allBackdrops.find(b => b.iso_639_1 === data.original_language)
                        || allBackdrops.find(b => b.iso_639_1 === null)
                        || allBackdrops.find(b => b.iso_639_1 === 'en')
                        || allBackdrops[0];
                    if (origBackdrop?.file_path) data.backdrop_path = origBackdrop.file_path;
                }
                cacheManager.set(cacheKey, data, 10);
            }
            return data;
        } catch (error) {
            console.error('Error fetching details:', error);
            return null;
        }
    },

    /**
     * Alias for getDetails matching standard fetch method conventions.
     * @param {number|string} id - TMDb content ID.
     * @param {string} type - 'movie' or 'tv'.
     * @returns {Promise<Object|null>} Detailed content metadata object.
     */
    fetchDetails(id, type) {
        return this.getDetails(id, type);
    },

    /**
     * Fetches details for a specific season of a TV show, including episode lists.
     * @param {number|string} seriesId - TMDb TV show ID.
     * @param {number|string} seasonNumber - The season number.
     * @returns {Promise<Object|null>} Season metadata object.
     */
    async getSeasonDetails(seriesId, seasonNumber) {
        if (API_KEY.includes('TODO')) return null;
        try {
            const lang = this.getLanguageCode();
            const response = await deduplicatedFetch(`${BASE_URL}/tv/${seriesId}/season/${seasonNumber}?api_key=${API_KEY}&language=${lang}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching season details:', error);
            return null;
        }
    },

    /**
     * Fetches TV show seasons list from media details.
     * @param {number|string} id - TMDb TV series ID.
     * @returns {Promise<Array>} List of season summary objects.
     */
    async getSeasons(id) {
        return (await this.getDetails(id, 'tv'))?.seasons || [];
    },

    /**
     * Fetches TV show episodes list for a specific season.
     * @param {number|string} id - TMDb TV series ID.
     * @param {number|string} season - Season number.
     * @returns {Promise<Array>} List of episode objects.
     */
    async getEpisodes(id, season) {
        return (await this.getSeasonDetails(id, season))?.episodes || [];
    },

    /**
     * Retrieves the player provider configuration from persistent storage and migrates legacy endpoints.
     * @returns {Object} Player configuration object with active providers.
     */
    getPlayerConfig() {
        const currentId = getActiveAccountId();
        if (_cachedPlayerConfig && _configOwnerId === currentId) return _cachedPlayerConfig;

        const defaults = {
            playerProvider: 'custom',
            playerBaseUrl: DEFAULT_PLAYER_BASE_URL,
            playerProviders: DEFAULT_PLAYER_PROVIDERS,
            m3uPlaylists: []
        };

        try {
            const parseJson = str => { try { return str ? (JSON.parse(str) || {}) : {}; } catch { return {}; } };
            const readCookie = k => {
                const m = typeof document !== 'undefined' && document.cookie && document.cookie.match(new RegExp(`(?:^|; )${k}=([^;]*)`));
                return m ? decodeURIComponent(m[1]) : null;
            };

            const globalSettings = parseJson(PersistentStorage.getItem('ivids-settings'));
            globalSettings.updateMode = globalSettings.updateMode || readCookie('updateMode');
            globalSettings.language = globalSettings.language || readCookie('language');

            const userKey = getNamespacedKey('settings');
            const saved = { ...globalSettings, ...parseJson(PersistentStorage.getItem(userKey)) };

            let needsWriteBack = false;
            if (saved.playerBaseUrl && /vidsrc\.(xyz|me|net)/.test(saved.playerBaseUrl)) {
                saved.playerBaseUrl = DEFAULT_PLAYER_BASE_URL;
                needsWriteBack = true;
            }

            if (!Array.isArray(saved.playerProviders)) {
                saved.playerProviders = [...DEFAULT_PLAYER_PROVIDERS];
                needsWriteBack = true;
            } else {
                const initialLen = saved.playerProviders.length;
                saved.playerProviders = saved.playerProviders.filter(p => p.isCustom || !['vidsrc_cc', 'embed_su'].includes(p.id));
                DEFAULT_PLAYER_PROVIDERS.forEach(def => {
                    if (!saved.playerProviders.some(p => p.id === def.id || p.url === def.url)) saved.playerProviders.push(def);
                });
                if (saved.playerProviders.length !== initialLen) needsWriteBack = true;
            }

            if (saved.m3uUrl && (!saved.m3uPlaylists || saved.m3uPlaylists.length === 0)) {
                saved.m3uPlaylists = [{ id: 'custom_m3u', name: 'Custom Playlist', url: saved.m3uUrl, isCustom: true }];
                needsWriteBack = true;
            }

            if (needsWriteBack) {
                PersistentStorage.setItem('ivids-settings', JSON.stringify({ language: saved.language || 'en', updateMode: saved.updateMode || 'manual' }));
                PersistentStorage.setItem(userKey, JSON.stringify({
                    accentColor: saved.accentColor, m3uUrl: saved.m3uUrl, playerProvider: saved.playerProvider,
                    playerBaseUrl: saved.playerBaseUrl, playerProviders: saved.playerProviders, m3uPlaylists: saved.m3uPlaylists
                }));
            }

            _cachedPlayerConfig = {
                ...defaults,
                ...saved,
                playerBaseUrl: (saved.playerBaseUrl || defaults.playerBaseUrl).replace(/\/+$/, '')
            };
        } catch (error) {
            console.error('Error reading player config:', error);
            _cachedPlayerConfig = defaults;
        }

        _configOwnerId = currentId;
        return _cachedPlayerConfig;
    },

    /**
     * Clears the cached player config to force re-reading from storage on next access.
     */
    invalidatePlayerConfig() {
        _cachedPlayerConfig = null;
    },

    /**
     * Dynamic getter that retrieves the active priority-ordered list of player provider servers.
     * @returns {Array<Object>} List of server provider objects with display names and URLs.
     */
    get SERVERS() {
        const config = Api.getPlayerConfig();
        return (config.playerProviders || DEFAULT_PLAYER_PROVIDERS).map(p => {
            let displayName = p.name;
            if (p.isCustom || !displayName) {
                try { const host = new URL(p.url).hostname; displayName = host ? `${host} (Custom)` : 'Custom Server'; } catch { displayName = 'Custom Server'; }
            }
            return { id: p.id, name: displayName, url: p.url, isCustom: !!p.isCustom };
        });
    },

    /**
     * Generates the streaming embed URL for the player iframe.
     * @param {string|number} id - TMDb content ID.
     * @param {string} type - 'movie' or 'tv'.
     * @param {number} [season=null] - TV show season number.
     * @param {number} [episode=null] - TV show episode number.
     * @param {string} [serverId=null] - Explicit server provider ID.
     * @returns {string} Fully formed streaming embed URL.
     */
    getVideoUrl(id, type, season = null, episode = null, serverId = null) {
        const config = Api.getPlayerConfig();
        const server = serverId ? Api.SERVERS.find(s => s.id === serverId) : Api.SERVERS[0];
        const baseUrl = server ? server.url : config.playerBaseUrl;
        const params = 'autoplay=true&autoPlay=true&ds_lang=en';
        return type === 'tv' ? `${baseUrl}/tv/${id}/${season || 1}/${episode || 1}?${params}` : `${baseUrl}/movie/${id}?${params}`;
    },

    /**
     * Retrieves the predefined registry of TMDb genres for movies and television.
     * @returns {Array<Object>} Array of genre objects with id and name.
     */
    getGenres() {
        return [
            { id: 28, name: "Action" }, { id: 12, name: "Adventure" }, { id: 16, name: "Animation" }, { id: 35, name: "Comedy" },
            { id: 80, name: "Crime" }, { id: 99, name: "Documentary" }, { id: 18, name: "Drama" }, { id: 10751, name: "Family" },
            { id: 14, name: "Fantasy" }, { id: 36, name: "History" }, { id: 27, name: "Horror" }, { id: 10402, name: "Music" },
            { id: 9648, name: "Mystery" }, { id: 10749, name: "Romance" }, { id: 878, name: "Sci-Fi" }, { id: 10770, name: "TV Movie" },
            { id: 53, name: "Thriller" }, { id: 10752, name: "War" }, { id: 37, name: "Western" }, { id: 10759, name: "Action & Adventure (TV)" },
            { id: 10762, name: "Kids (TV)" }, { id: 10763, name: "News (TV)" }, { id: 10764, name: "Reality (TV)" },
            { id: 10765, name: "Sci-Fi & Fantasy (TV)" }, { id: 10766, name: "Soap (TV)" }, { id: 10767, name: "Talk (TV)" },
            { id: 10768, name: "War & Politics (TV)" }
        ];
    },

    /**
     * Retrieves the list of standard content rating certifications.
     * @returns {Array<string>} Array of rating certification codes.
     */
    getCertifications() {
        const certs = ["G", "PG", "PG-13", "R", "NC-17", "TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14", "TV-MA"];
        if (this.getIncludeAdult()) certs.push("XXX");
        return certs;
    },

    /**
     * Fetches the list of countries supported by TMDb, cached for 24 hours.
     * @returns {Promise<Array>} List of country configuration objects.
     */
    async fetchCountries() {
        try {
            const lang = this.getLanguageCode();
            const data = await this._fetchWithCache(
                `tmdb_countries_${lang}`,
                `${BASE_URL}/configuration/countries?api_key=${API_KEY}&language=${lang}`,
                1440,
                null,
                { preserveOriginalArtwork: false }
            );
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('Error fetching countries:', error);
            return [];
        }
    },

    /**
     * Fetches watch providers for a given content type and region from TMDb.
     * @param {string} [type='movie'] - Content type ('movie' or 'tv').
     * @param {string} [region='US'] - Watch region ISO country code.
     * @returns {Promise<Array>} List of watch providers.
     */
    async fetchWatchProviders(type = 'movie', region = 'US') {
        try {
            const lang = this.getLanguageCode();
            const data = await this._fetchWithCache(
                `watch_providers_${type}_${region}_${lang}`,
                `${BASE_URL}/watch/providers/${type}?api_key=${API_KEY}&watch_region=${region}&language=${lang}`,
                1440,
                d => d?.results || [],
                { preserveOriginalArtwork: false }
            );
            return Array.isArray(data) ? data : (data?.results || []);
        } catch (error) {
            console.error('Error fetching watch providers:', error);
            return [];
        }
    },

    /**
     * Discovers content on TMDb using dynamic filters with original artwork preservation.
     * @param {Object} filters - Search filters (genres, year, certification, providers, runtime).
     * @returns {Promise<Array>} List of discovered content items.
     */
    async discoverContent(filters) {
        if (API_KEY.includes('TODO')) return [];
        try {
            const lang = this.getLanguageCode();
            const type = filters.type || 'movie';
            const isMovie = type === 'movie';

            const params = new URLSearchParams({
                api_key: API_KEY,
                sort_by: filters.sortBy || 'popularity.desc',
                include_adult: this.getIncludeAdult(),
                include_video: 'false',
                page: String(filters.page || 1),
                language: lang
            });

            if (filters.genres?.length) params.append('with_genres', filters.genres.join(','));
            if (filters.certification) { params.append('certification_country', 'US'); params.append('certification', filters.certification); }
            if (filters.year) { params.append('primary_release_year', filters.year); params.append('first_air_date_year', filters.year); }
            else if (filters.decade) {
                const start = parseInt(filters.decade);
                const prefix = isMovie ? 'primary_release_date' : 'first_air_date';
                if (start === 1970) params.append(`${prefix}.lte`, '1979-12-31');
                else { params.append(`${prefix}.gte`, `${start}-01-01`); params.append(`${prefix}.lte`, `${start + 9}-12-31`); }
            }
            if (filters.runtime === 'short') params.append('with_runtime.lte', '90');
            else if (filters.runtime === 'medium') { params.append('with_runtime.gte', '90'); params.append('with_runtime.lte', '120'); }
            else if (filters.runtime === 'long') params.append('with_runtime.gte', '120');

            if (filters.network) {
                if (!isMovie) params.append('with_networks', filters.network);
                else if (NETWORK_COMPANIES[filters.network]) params.append('with_companies', NETWORK_COMPANIES[filters.network]);
            }
            if (filters.originCountry) params.append('with_origin_country', filters.originCountry);
            if (filters.watchProviders?.length) {
                params.append('watch_region', filters.watchRegion || 'US');
                params.append('with_watch_providers', filters.watchProviders.join('|'));
            }
            if (filters.voteCount) params.append('vote_count.gte', filters.voteCount);

            const data = await _fetchTmdb(`${BASE_URL}/discover/${type}?${params.toString()}`);
            if (!data?.results) return [];
            return data.results.map(item => ({ ...item, media_type: type }));
        } catch (error) {
            console.error('Error discovering content:', error);
            return [];
        }
    },

    /**
     * Fallback mock data returned when TMDb API key is not configured.
     * @returns {Array<Object>} Sample mock movie and television items.
     */
    getMockData() {
        return [
            { id: 1, title: "Mock Movie 1", backdrop_path: null, poster_path: null, overview: "This is a mock movie description because the API key is missing.", media_type: "movie" },
            { id: 2, name: "Mock Series 1", backdrop_path: null, poster_path: null, overview: "This is a mock series description.", media_type: "tv" }
        ];
    }
};

// Event Listeners: Invalidate image quality and connection caches when connection or data saver changes
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('datasaverchanged', () => {
        Api._recommendedSizes = {};
        invalidateSlowConnectionCache();
    });

    if (typeof navigator !== 'undefined' && navigator.connection && typeof navigator.connection.addEventListener === 'function') {
        try {
            navigator.connection.addEventListener('change', () => {
                invalidateSlowConnectionCache();
            });
        } catch {
            // Ignore if connection event listener is unsupported
        }
    }
}
