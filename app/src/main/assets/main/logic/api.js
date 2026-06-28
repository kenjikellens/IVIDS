import { cacheManager } from './cache-manager.js';
import { getActiveAccountId, getNamespacedKey } from './account-helper.js';
import { PersistentStorage } from './persistent-storage.js';

const API_KEY = 'a341dc9a3c2dffa62668b614a98c1188'; // TODO: Replace with your TMDb API Key
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_PATH = 'https://image.tmdb.org/t/p';
const DEFAULT_PLAYER_BASE_URL = 'https://vidlink.pro';

/** Map of in-flight fetch promises keyed by URL, used to deduplicate concurrent identical requests. */
const _inflightRequests = new Map();

/** Cached today's date string (YYYY-MM-DD) to avoid re-creating Date objects in every fetch call. */
let _cachedTodayDate = null;

/** Cached player config object, invalidated when settings change. */
let _cachedPlayerConfig = null;
let _configOwnerId = null;
const DEFAULT_PLAYER_PROVIDERS = [
    { id: 'vidlink', name: 'VidLink (Primary)', url: 'https://vidlink.pro', isCustom: false },
    { id: 'vidsrc_to', name: 'VidSrc.to (Server 2)', url: 'https://vidsrc.to/embed', isCustom: false },
    { id: 'videasy', name: 'Videasy (Server 3)', url: 'https://player.videasy.net', isCustom: false },
    { id: 'vidsrc_cc', name: 'VidSrc.cc (Server 4)', url: 'https://vidsrc.cc/v2/embed', isCustom: false }
];

// Image Size Constants
const POSTER_SIZE = 'w342';       // Standard poster size for grids
const BACKDROP_SIZE = 'w1280';    // High res for backgrounds
const STILL_SIZE = 'w300';        // Small stills for episode lists
const DETAIL_POSTER_SIZE = 'w500'; // Medium size for details page

/**
 * Performs a fetch with timeout and exponential backoff retries.
 * Handles network failures gracefully for unreliable Smart TV connections.
 */
async function fetchWithRetry(resource, options = {}) {
    const { timeout = 8000, retries = 2 } = options;
    let lastError;

    for (let i = 0; i <= retries; i++) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(resource, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(id);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response;
        } catch (error) {
            clearTimeout(id);
            lastError = error;
            if (i < retries) {
                // Wait slightly before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i)));
            }
        }
    }
    throw lastError;
}

/**
 * Wraps fetchWithRetry with in-flight deduplication.
 * Caches and returns existing promises for identical URLs, resolving them via standard Promise chain handlers to avoid compatibility issues.
 * @param {string} url - The URL endpoint to fetch.
 * @param {Object} [options] - Configuration options for fetch.
 * @returns {Promise<Response>} The fetch response promise.
 */
async function deduplicatedFetch(url, options = {}) {
    if (_inflightRequests.has(url)) {
        return _inflightRequests.get(url);
    }
    const cleanUp = () => _inflightRequests.delete(url);
    const promise = fetchWithRetry(url, options).then(
        val => { cleanUp(); return val; },
        err => { cleanUp(); throw err; }
    );
    _inflightRequests.set(url, promise);
    return promise;
}

/**
 * Returns today's date in YYYY-MM-DD format, cached for the session lifetime.
 * Avoids creating new Date objects on every API call.
 */
function getTodayDate() {
    if (!_cachedTodayDate) {
        _cachedTodayDate = new Date().toISOString().split('T')[0];
    }
    return _cachedTodayDate;
}

/**
 * Shuffles an array in-place using the Fisher-Yates algorithm.
 * Used to randomize content row order for a fresh discovery experience on each visit.
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export const Api = {
    getApiKey: () => API_KEY,
    // Size constants
    POSTER_SIZE,
    BACKDROP_SIZE,
    STILL_SIZE,
    DETAIL_POSTER_SIZE,

    isTV: () => {
        const ua = navigator.userAgent.toLowerCase();
        return ua.includes('tizen') || ua.includes('webos') || ua.includes('android tv') || ua.includes('smarttv') || !!window.tizen;
    },

    /**
     * Determines the optimal TMDb poster size based on responsive layout breakpoints and the device pixel ratio.
     * Estimates the exact CSS poster width based on screen width/height and resolves it to a TMDb size key.
     * @returns {string} The TMDb poster size path key.
     */
    getRecommendedPosterSize: () => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        const isPortrait = window.matchMedia('(max-aspect-ratio: 3/4)').matches;

        let estWidth;
        if (isPortrait) {
            // General portrait mobile size: clamp(96px, 24vw, 112px)
            estWidth = Math.min(Math.max(96, vw * 0.24), 112);
        } else {
            // Check landscape breakpoints in order of screen sizes
            if (vw <= 900 || vh <= 520) {
                // 480p landscape
                estWidth = 85;
            } else if (vw <= 1280 || vh <= 720) {
                // 720p landscape
                estWidth = 110;
            } else if (vw <= 1440 || vh <= 900) {
                // 1080p landscape
                estWidth = 124;
            } else {
                // Default large screen landscape: clamp(120px, 11vw, 156px)
                estWidth = Math.min(Math.max(120, vw * 0.11), 156);
            }
        }

        const physicalWidth = estWidth * dpr;

        // On TV, prioritize performance by capping poster size to w342 maximum
        if (Api.isTV()) {
            if (physicalWidth <= 185) return 'w185';
            return 'w342';
        }

        // Available TMDB poster sizes: w92, w154, w185, w342, w500, w780, original
        if (physicalWidth <= 92) return 'w92';
        if (physicalWidth <= 154) return 'w154';
        if (physicalWidth <= 185) return 'w185';
        if (physicalWidth <= 342) return 'w342';
        if (physicalWidth <= 500) return 'w500';
        if (physicalWidth <= 780) return 'w780';
        return 'original';
    },

    /**
     * Determines the optimal TMDb detail poster size based on screen width.
     * Estimates larger detail image keys to prevent blurry assets on high-res detail pages.
     * @returns {string} The TMDb poster size key.
     */
    getRecommendedDetailPosterSize: () => {
        const width = window.innerWidth;
        const dpr = window.devicePixelRatio || 1;
        const effectiveWidth = width * dpr;

        // Detail posters are larger (~300px-500px)
        if (effectiveWidth > 1400) return 'w500';
        if (effectiveWidth > 800) return 'w342';
        return 'w185';
    },

    /**
     * Determines the optimal TMDb backdrop size for hero carousel sections.
     * Selects w780 on TVs for performance, and maps screen size to w1280 or original.
     * @returns {string} The TMDb backdrop size key.
     */
    getRecommendedBackdropSize: () => {
        const width = window.innerWidth;
        const dpr = window.devicePixelRatio || 1;
        const effectiveWidth = width * dpr;

        // On TV, we strongly prefer w780 over w1280 for memory/performance
        if (Api.isTV()) {
            return 'w780';
        }

        // Hero backdrops fill the screen
        if (effectiveWidth > 1600) return BACKDROP_SIZE; // w1280
        if (effectiveWidth > 600) return 'w780';
        return 'w300';
    },

    /**
     * Determines the optimal TMDb image size key that is closest and larger than (or equal to) the container width.
     * Uses a CSS-clamp and window width estimation fallback if the container is hidden or not yet measured.
     * @param {number} containerWidth - The width of the container in CSS pixels.
     * @param {boolean} isBackdrop - True if selecting a horizontal backdrop size, false for vertical posters.
     * @returns {string} The TMDb size path segment key (e.g. 'w342', 'w780', or 'original').
     */
    getRecommendedSizeForContainer: (containerWidth, isBackdrop = false) => {
        const dpr = window.devicePixelRatio || 1;
        const physicalWidth = containerWidth * dpr;

        if (isBackdrop) {
            // Available sizes: w300, w780, w1280, original
            if (physicalWidth <= 0) {
                const estWidth = window.innerWidth * dpr;
                return Api.getRecommendedSizeForContainer(estWidth, true);
            }
            if (physicalWidth <= 300) return 'w300';
            if (physicalWidth <= 780) return 'w780';
            if (physicalWidth <= 1280) return 'w1280';
            return 'original';
        } else {
            // Available sizes: w92, w154, w185, w342, w500, w780, original
            if (physicalWidth <= 0) {
                return Api.getRecommendedPosterSize();
            }
            if (physicalWidth <= 92) return 'w92';
            if (physicalWidth <= 154) return 'w154';
            if (physicalWidth <= 185) return 'w185';
            if (physicalWidth <= 342) return 'w342';
            if (physicalWidth <= 500) return 'w500';
            if (physicalWidth <= 780) return 'w780';
            return 'original';
        }
    },

    /**
     * Optimized image URL generation.
     * TMDB CDN automatically serves WebP if the browser sends the correct Accept header.
     * Here we focus on ensuring size mapping is precise for the current screen.
     */
    // Cached recommended sizes to avoid recalculation
    _recommendedSizes: {},

    getImageUrl: (path, size = null) => {
        if (!path) return 'assets/placeholder.png';

        // Prefer dynamic recommended size if none provided
        let finalSize = size;
        if (!finalSize) {
            const screenKey = `${window.innerWidth}x${window.devicePixelRatio || 1}`;
            if (!Api._recommendedSizes[screenKey]) {
                Api._recommendedSizes[screenKey] = Api.getRecommendedPosterSize();
            }
            finalSize = Api._recommendedSizes[screenKey];
        }

        // Security: Ensure path doesn't already contain base (idempotency)
        const cleanPath = path.startsWith('/') ? path : `/${path}`;

        // Return path - Browser headers (Accept: image/webp) handle the format switch
        return `${IMAGE_BASE_PATH}/${finalSize}${cleanPath}`;
    },

    /**
     * Network pre-warm / pre-fetch for images.
     * Can be used to warm the CDN connection for high-priority images (e.g. Hero).
     */
    prefetchImage: (path, size = null) => {
        if (!path) return;
        const url = Api.getImageUrl(path, size);
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = url;
        document.head.appendChild(link);
    },

    /**
     * Retrieves the current user language code, mapping general codes to TMDB supported formats.
     * This affects TMDB queries by ensuring content is fetched in the appropriate language.
     * @returns {string} The ISO 639-1 language code.
     */
    getLanguageCode() {
        const lang = (typeof window !== 'undefined' && window.i18n && window.i18n.currentLanguage) || 'en';
        if (lang === 'zh') return 'zh-CN';
        return lang;
    },

    /**
     * Retrieves the include_adult user setting from localStorage.
     * This determines whether explicit adult content is queried from the TMDb API.
     * @returns {boolean} True if adult content is allowed.
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
     * Fetches trending movies and TV shows from TMDB for the week.
     * This updates the trending category carousel on the home screen.
     * @returns {Promise<Array>} List of trending content.
     */
    async fetchTrending() {
        const lang = this.getLanguageCode();
        const cacheKey = `trending_all_week_${lang}`;
        const cached = cacheManager.get(cacheKey);
        if (cached) return shuffleArray([...cached]);

        try {
            const response = await deduplicatedFetch(`${BASE_URL}/trending/all/week?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&language=${lang}`);
            const data = await response.json();
            const today = getTodayDate();

            if (!data || !data.results) return [];

            // Filter by release dates - only show released/aired content
            const filtered = data.results.filter(item => {
                const releaseDate = item.release_date || item.first_air_date;
                return releaseDate && releaseDate <= today;
            });

            if (filtered.length > 0) {
                cacheManager.set(cacheKey, filtered, 15);
            }

            return shuffleArray(filtered);
        } catch (error) {
            console.error('Error fetching trending:', error);
            throw error;
        }
    },

    /**
     * Fetches daily trending movies and TV shows from TMDB.
     * This updates the trending today category row on the home and browse pages.
     * @returns {Promise<Array>} List of today's trending content.
     */
    async fetchTrendingToday() {
        const lang = this.getLanguageCode();
        const cacheKey = `trending_all_day_${lang}`;
        const cached = cacheManager.get(cacheKey);
        if (cached) return shuffleArray([...cached]);

        try {
            const response = await deduplicatedFetch(`${BASE_URL}/trending/all/day?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&language=${lang}`);
            const data = await response.json();
            const today = getTodayDate();

            if (!data || !data.results) return [];

            // Filter by release dates - only show released/aired content
            const filtered = data.results.filter(item => {
                const releaseDate = item.release_date || item.first_air_date;
                return releaseDate && releaseDate <= today;
            });

            if (filtered.length > 0) {
                cacheManager.set(cacheKey, filtered, 15);
            }

            return shuffleArray(filtered);
        } catch (error) {
            console.error('Error fetching trending today:', error);
            throw error;
        }
    },

    /**
     * Fetches the top-rated movies from TMDB.
     * This updates the top-rated movies row or carousel on the home screen.
     * @returns {Promise<Array>} List of top-rated movies.
     */
    async fetchTopRated() {
        const lang = this.getLanguageCode();
        const cacheKey = `movie_top_rated_${lang}`;
        const cached = cacheManager.get(cacheKey);
        if (cached) return shuffleArray([...cached]);

        try {
            const today = getTodayDate();
            const urls = [
                `${BASE_URL}/movie/top_rated?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&primary_release_date.lte=${today}&language=${lang}&page=1`,
                `${BASE_URL}/movie/top_rated?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&primary_release_date.lte=${today}&language=${lang}&page=2`
            ];
            const responses = await Promise.all(urls.map(url => deduplicatedFetch(url)));
            const dataResults = await Promise.all(responses.map(res => res.json()));

            let combined = [];
            dataResults.forEach(data => {
                if (data && data.results) {
                    combined = combined.concat(data.results);
                }
            });

            const finalResults = combined.slice(0, 30);
            if (finalResults.length > 0) {
                cacheManager.set(cacheKey, finalResults, 60); // Top rated changes slowly, cache for 1 hour
            }
            return shuffleArray(finalResults);
        } catch (error) {
            console.error('Error fetching top rated:', error);
            throw error;
        }
    },

    /**
     * Fetches content list from TMDB using the discover endpoint for a specific type and parameters.
     * This affects discover lists and category rails across the browse pages.
     * @param {string} type - 'movie' or 'tv'.
     * @param {string} params - Query parameters for TMDB discover endpoint.
     * @returns {Promise<Array>} List of discovered content.
     */
    async _fetchDiscover(type, params) {
        const lang = this.getLanguageCode();
        const cacheKey = `discover_${type}_${params}_${lang}`;
        const cached = cacheManager.get(cacheKey);
        if (cached) return shuffleArray([...cached]); // Return a shuffled clone

        try {
            const today = getTodayDate();
            // Add release date filter based on type to ensure only released/aired content
            const dateFilter = type === 'movie'
                ? `primary_release_date.lte=${today}`
                : `first_air_date.lte=${today}`;

            // Fetch page 1 and page 2 concurrently for 30 items
            const urls = [
                `${BASE_URL}/discover/${type}?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&${dateFilter}&${params}&language=${lang}&page=1`,
                `${BASE_URL}/discover/${type}?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&${dateFilter}&${params}&language=${lang}&page=2`
            ];
            
            const responses = await Promise.all(urls.map(url => deduplicatedFetch(url)));
            const dataResults = await Promise.all(responses.map(res => res.json()));

            let combined = [];
            dataResults.forEach(data => {
                if (data && data.results) {
                    combined = combined.concat(data.results);
                }
            });

            // Limit to exactly 30 items
            const finalResults = combined.slice(0, 30);

            if (finalResults.length > 0) {
                cacheManager.set(cacheKey, finalResults, 15); // Cache for 15 minutes
            }
            return shuffleArray(finalResults);
        } catch (error) {
            console.error(`Error fetching ${type} with params ${params}:`, error);
            throw error;
        }
    },

    // Movies
    fetchActionMovies() { return this._fetchDiscover('movie', 'with_genres=28'); },
    fetchAdventureMovies() { return this._fetchDiscover('movie', 'with_genres=12'); },
    fetchAnimationMovies() { return this._fetchDiscover('movie', 'with_genres=16'); },
    fetchComedyMovies() { return this._fetchDiscover('movie', 'with_genres=35'); },
    fetchCrimeMovies() { return this._fetchDiscover('movie', 'with_genres=80'); },
    fetchDocumentaryMovies() { return this._fetchDiscover('movie', 'with_genres=99'); },
    fetchDramaMovies() { return this._fetchDiscover('movie', 'with_genres=18'); },
    fetchFamilyMovies() { return this._fetchDiscover('movie', 'with_genres=10751'); },
    fetchFantasyMovies() { return this._fetchDiscover('movie', 'with_genres=14'); },
    fetchHistoryMovies() { return this._fetchDiscover('movie', 'with_genres=36'); },
    fetchHorrorMovies() { return this._fetchDiscover('movie', 'with_genres=27'); },
    fetchMusicMovies() { return this._fetchDiscover('movie', 'with_genres=10402'); },
    fetchMysteryMovies() { return this._fetchDiscover('movie', 'with_genres=9648'); },
    fetchRomanceMovies() { return this._fetchDiscover('movie', 'with_genres=10749'); },
    fetchSciFiMovies() { return this._fetchDiscover('movie', 'with_genres=878'); },
    fetchThrillerMovies() { return this._fetchDiscover('movie', 'with_genres=53'); },
    fetchWarMovies() { return this._fetchDiscover('movie', 'with_genres=10752'); },
    fetchWesternMovies() { return this._fetchDiscover('movie', 'with_genres=37'); },
    fetchAnimeMovies() { return this._fetchDiscover('movie', 'with_genres=16&with_original_language=ja'); },

    // Disney & Marvel (by production company)
    fetchDisneyMovies() { return this._fetchDiscover('movie', 'with_companies=2'); },
    fetchMarvelMovies() { return this._fetchDiscover('movie', 'with_companies=420'); },

    // Special Studios & Production Companies
    fetchPixarMovies() { return this._fetchDiscover('movie', 'with_companies=3'); },
    fetchStudioGhibli() { return this._fetchDiscover('movie', 'with_companies=10342'); },
    /**
     * Fetches a combined list of popular Netflix original movies and TV series.
     * This affects the Netflix originals carousel on the home screen.
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
            
            const movieItems = (movies || []).map(item => ({ ...item, media_type: 'movie' }));
            const tvItems = (tv || []).map(item => ({ ...item, media_type: 'tv' }));
            
            const combined = [...movieItems, ...tvItems];
            const finalResults = combined.slice(0, 30);
            if (finalResults.length > 0) {
                cacheManager.set(cacheKey, finalResults, 15);
            }
            return shuffleArray(finalResults);
        } catch (error) {
            console.error('Error fetching netflix originals:', error);
            throw error;
        }
    },

    // Quality & Time-based
    fetchHighlyRated() { return this._fetchDiscover('movie', 'vote_average.gte=8&vote_count.gte=1000&sort_by=vote_average.desc'); },
    fetchNewThisYear() { return this._fetchDiscover('movie', 'primary_release_date.gte=2025-01-01&sort_by=popularity.desc'); },
    fetchClassicMovies() { return this._fetchDiscover('movie', 'primary_release_date.gte=1970-01-01&primary_release_date.lte=1999-12-31&vote_count.gte=500&sort_by=vote_average.desc'); },
    fetchAwardWinners() { return this._fetchDiscover('movie', 'vote_average.gte=7.5&vote_count.gte=5000&sort_by=vote_count.desc'); },
    /**
     * Fetches movies released within a specific decade range.
     * @param {string} type - 'movie' or 'tv'.
     * @param {number} startYear - Start year of the decade (e.g. 1980).
     * @param {number} endYear - End year of the decade (e.g. 1989).
     * @returns {Promise<Array>} List of discovered content.
     */
    fetchDecadeContent(type, startYear, endYear) {
        const dateParam = type === 'movie'
            ? `primary_release_date.gte=${startYear}-01-01&primary_release_date.lte=${endYear}-12-31`
            : `first_air_date.gte=${startYear}-01-01&first_air_date.lte=${endYear}-12-31`;
        return this._fetchDiscover(type, `${dateParam}&sort_by=popularity.desc`);
    },

    // Regional Content
    fetchBollywood() { return this._fetchDiscover('movie', 'with_original_language=hi&sort_by=popularity.desc'); },
    fetchKoreanContent() { return this._fetchDiscover('movie', 'with_original_language=ko&sort_by=popularity.desc'); },

    // Series
    fetchActionAdventureSeries() { return this._fetchDiscover('tv', 'with_genres=10759'); },
    fetchAnimationSeries() { return this._fetchDiscover('tv', 'with_genres=16'); },
    fetchComedySeries() { return this._fetchDiscover('tv', 'with_genres=35'); },
    fetchCrimeSeries() { return this._fetchDiscover('tv', 'with_genres=80'); },
    fetchDocumentarySeries() { return this._fetchDiscover('tv', 'with_genres=99'); },
    fetchDramaSeries() { return this._fetchDiscover('tv', 'with_genres=18'); },
    fetchFamilySeries() { return this._fetchDiscover('tv', 'with_genres=10751'); },
    fetchKidsSeries() { return this._fetchDiscover('tv', 'with_genres=10762'); },
    fetchMysterySeries() { return this._fetchDiscover('tv', 'with_genres=9648'); },
    fetchRealitySeries() { return this._fetchDiscover('tv', 'with_genres=10764'); },
    fetchSciFiFantasySeries() { return this._fetchDiscover('tv', 'with_genres=10765'); },
    fetchSoapSeries() { return this._fetchDiscover('tv', 'with_genres=10766'); },
    fetchWarPoliticsSeries() { return this._fetchDiscover('tv', 'with_genres=10768'); },
    fetchWesternSeries() { return this._fetchDiscover('tv', 'with_genres=37'); },
    fetchAnimeSeries() { return this._fetchDiscover('tv', 'with_genres=16&with_original_language=ja'); },
    fetchDisneySeries() { return this._fetchDiscover('tv', 'with_companies=2'); },
    fetchMarvelSeries() { return this._fetchDiscover('tv', 'with_companies=420'); },
    fetchNetflixSeries() { return this._fetchDiscover('tv', 'with_companies=213&sort_by=popularity.desc'); },
    fetchKoreanSeries() { return this._fetchDiscover('tv', 'with_original_language=ko&sort_by=popularity.desc'); },
    /**
     * Fetches TV movies from TMDB.
     * @returns {Promise<Array>} List of TV movies.
     */
    fetchTvMovies() { return this._fetchDiscover('movie', 'with_genres=10770'); },
    /**
     * Fetches series/movies belonging to a specific network or company mapping.
     * @param {string} type - 'movie' or 'tv'.
     * @param {number} networkId - The network/provider ID.
     * @returns {Promise<Array>} List of network content.
     */
    fetchNetworkContent(type, networkId) {
        if (type === 'tv') {
            return this._fetchDiscover('tv', `with_networks=${networkId}`);
        } else {
            let companyId = '';
            if (networkId === 213) companyId = '213|178464|171251'; // Netflix
            else if (networkId === 49) companyId = '3287|3268'; // HBO
            else if (networkId === 2739) companyId = '2'; // Disney
            else if (networkId === 1024) companyId = '20580'; // Amazon Prime
            else if (networkId === 2552) companyId = '131018'; // Apple TV+
            return this._fetchDiscover('movie', `with_companies=${companyId}`);
        }
    },
    /**
     * Fetches TV series categorized in News or Talk genres.
     * @returns {Promise<Array>} List of talk and news shows.
     */
    fetchTalkNewsSeries() { return this._fetchDiscover('tv', 'with_genres=10767|10763'); },

    /**
     * Fetches popular TV shows from TMDB.
     * This updates the popular TV shows category row on the home screen.
     * @returns {Promise<Array>} List of popular TV shows.
     */
    async fetchPopularTV() {
        const lang = this.getLanguageCode();
        const cacheKey = `tv_popular_${lang}`;
        const cached = cacheManager.get(cacheKey);
        if (cached) return shuffleArray([...cached]);

        try {
            const today = getTodayDate();
            const urls = [
                `${BASE_URL}/tv/popular?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&first_air_date.lte=${today}&language=${lang}&page=1`,
                `${BASE_URL}/tv/popular?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&first_air_date.lte=${today}&language=${lang}&page=2`
            ];
            const responses = await Promise.all(urls.map(url => deduplicatedFetch(url)));
            const dataResults = await Promise.all(responses.map(res => res.json()));

            let combined = [];
            dataResults.forEach(data => {
                if (data && data.results) {
                    combined = combined.concat(data.results);
                }
            });

            const finalResults = combined.slice(0, 30);
            if (finalResults.length > 0) {
                cacheManager.set(cacheKey, finalResults, 15);
            }
            return shuffleArray(finalResults);
        } catch (error) {
            console.error('Error fetching popular TV:', error);
            throw error;
        }
    },

    /**
     * Fetches top-rated TV shows from TMDB.
     * This updates the top-rated TV shows category row on the home screen.
     * @returns {Promise<Array>} List of top-rated TV shows.
     */
    async fetchTopRatedTV() {
        const lang = this.getLanguageCode();
        const cacheKey = `tv_top_rated_${lang}`;
        const cached = cacheManager.get(cacheKey);
        if (cached) return shuffleArray([...cached]);

        try {
            const today = getTodayDate();
            const urls = [
                `${BASE_URL}/tv/top_rated?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&first_air_date.lte=${today}&language=${lang}&page=1`,
                `${BASE_URL}/tv/top_rated?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&first_air_date.lte=${today}&language=${lang}&page=2`
            ];
            const responses = await Promise.all(urls.map(url => deduplicatedFetch(url)));
            const dataResults = await Promise.all(responses.map(res => res.json()));

            let combined = [];
            dataResults.forEach(data => {
                if (data && data.results) {
                    combined = combined.concat(data.results);
                }
            });

            const finalResults = combined.slice(0, 30);
            if (finalResults.length > 0) {
                cacheManager.set(cacheKey, finalResults, 60);
            }
            return shuffleArray(finalResults);
        } catch (error) {
            console.error('Error fetching top rated TV:', error);
            throw error;
        }
    },

    /**
     * Searches TMDB for movies and TV shows matching a query.
     * This affects the results list displayed on the search page.
     * @param {string} query - The search query.
     * @param {number} [page=1] - The page number of search results.
     * @returns {Promise<Array>} List of search results.
     */
    async searchContent(query, page = 1) {
        if (API_KEY.includes('TODO')) return [];
        try {
            const lang = this.getLanguageCode();
            // Note: include_adult is NOT set to false here intentionally
            // Adult content can be found via explicit search only
            const response = await deduplicatedFetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=${page}&language=${lang}&include_adult=${this.getIncludeAdult()}`);
            const data = await response.json();
            const today = getTodayDate();

            if (!data || !data.results) return [];

            // Filter by release dates - only show released/aired content
            const filtered = data.results.filter(item => {
                const releaseDate = item.release_date || item.first_air_date;
                return releaseDate && releaseDate <= today;
            });

            return filtered;
        } catch (error) {
            console.error('Error searching:', error);
            return [];
        }
    },

    /**
     * Fetches recommended movies or TV shows based on a specific content ID.
     * This updates the recommendations grid on the details page.
     * @param {number|string} id - The TMDB content ID.
     * @param {string} type - 'movie' or 'tv'.
     * @returns {Promise<Array>} List of recommended content.
     */
    async fetchRecommendations(id, type) {
        if (API_KEY.includes('TODO')) return [];
        try {
            const lang = this.getLanguageCode();
            const response = await deduplicatedFetch(`${BASE_URL}/${type}/${id}/recommendations?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&language=${lang}`);
            const data = await response.json();
            const today = getTodayDate();

            if (!data || !data.results) return [];

            // Filter by release dates - only show released/aired content
            const filtered = (data.results || []).filter(item => {
                const releaseDate = item.release_date || item.first_air_date;
                return releaseDate && releaseDate <= today;
            });

            return filtered;
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            return [];
        }
    },

    /**
     * Fetches detailed information for a movie or TV show, appending videos and credits.
     * This affects the media details state by making additional TMDB metadata available.
     * @param {number|string} id - The TMDB content ID.
     * @param {string} type - 'movie' or 'tv'.
     * @returns {Promise<Object>} Detailed content metadata.
     */
    async getDetails(id, type) {
        if (API_KEY.includes('TODO')) return null;
        try {
            const lang = this.getLanguageCode();
            const baseAppend = type === 'movie' ? 'release_dates' : 'content_ratings';
            const append = `${baseAppend},videos,credits`;
            const response = await deduplicatedFetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=${append}&language=${lang}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching details:', error);
            return null;
        }
    },

    /**
     * Fetches details for a specific season of a TV show, including episode lists.
     * This affects the episodes section in the series detail page.
     * @param {number|string} seriesId - The TMDB TV show ID.
     * @param {number|string} seasonNumber - The season number.
     * @returns {Promise<Object>} Detailed season metadata.
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
     * Retrieves the player provider configuration from localStorage and performs migrations.
     * Uses an in-memory cache to avoid repeated localStorage parsing and migration logic.
     * Call `invalidatePlayerConfig()` after settings changes to refresh the cache.
     * @returns {Object} Config object containing provider settings and the custom list of providers.
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
            const globalSaved = PersistentStorage.getItem('ivids-settings');
            let globalSettings = {};
            if (globalSaved && globalSaved !== 'null' && globalSaved !== 'undefined') {
                try {
                    globalSettings = JSON.parse(globalSaved) || {};
                } catch (jsonErr) {
                    console.error('Failed to parse global settings:', jsonErr);
                }
            }

            // Fallback to cookies for updateMode and language if not in localStorage
            if (!globalSettings.updateMode) {
                const match = document.cookie.match(/(?:^|; )updateMode=([^;]*)/);
                if (match) {
                    globalSettings.updateMode = decodeURIComponent(match[1]);
                }
            }
            if (!globalSettings.language) {
                const match = document.cookie.match(/(?:^|; )language=([^;]*)/);
                if (match) {
                    globalSettings.language = decodeURIComponent(match[1]);
                }
            }

            const userKey = getNamespacedKey('settings');
            const userSaved = PersistentStorage.getItem(userKey);
            let userSettings = {};
            if (userSaved && userSaved !== 'null' && userSaved !== 'undefined') {
                try {
                    userSettings = JSON.parse(userSaved) || {};
                } catch (jsonErr) {
                    console.error('Failed to parse user settings:', jsonErr);
                }
            }

            const saved = { ...globalSettings, ...userSettings };

            if (Object.keys(saved).length > 0) {
                let needsWriteBack = false;
                // Auto-migrate from blocked legacy vidsrc domains persistently
                if (saved.playerBaseUrl && (saved.playerBaseUrl.includes('vidsrc.xyz') || saved.playerBaseUrl.includes('vidsrc.me') || saved.playerBaseUrl.includes('vidsrc.net'))) {
                    saved.playerBaseUrl = DEFAULT_PLAYER_BASE_URL;
                    needsWriteBack = true;
                }

                // If saved has no playerProviders, migrate playerBaseUrl to playerProviders
                if (!saved.playerProviders) {
                    const defaultProviders = JSON.parse(JSON.stringify(DEFAULT_PLAYER_PROVIDERS));
                    if (saved.playerBaseUrl) {
                        const matched = defaultProviders.find(p => p.url === saved.playerBaseUrl);
                        if (!matched) {
                            defaultProviders.unshift({
                                id: 'custom_migrated',
                                name: 'Custom Server',
                                url: saved.playerBaseUrl,
                                isCustom: true
                            });
                        } else {
                            const idx = defaultProviders.indexOf(matched);
                            if (idx > -1) {
                                defaultProviders.splice(idx, 1);
                                defaultProviders.unshift(matched);
                            }
                        }
                    }
                    saved.playerProviders = defaultProviders;
                    needsWriteBack = true;
                }

                // If saved has legacy single m3uUrl and no m3uPlaylists, migrate it
                if (saved.m3uUrl && (!saved.m3uPlaylists || saved.m3uPlaylists.length === 0)) {
                    saved.m3uPlaylists = [{
                        id: 'custom_m3u',
                        name: 'Custom Playlist',
                        url: saved.m3uUrl,
                        isCustom: true
                    }];
                    needsWriteBack = true;
                }

                if (needsWriteBack) {
                    const globalSettingsToSave = {
                        language: saved.language || 'en',
                        updateMode: saved.updateMode || 'manual'
                    };
                    const userSettingsToSave = {
                        accentColor: saved.accentColor,
                        m3uUrl: saved.m3uUrl,
                        playerProvider: saved.playerProvider,
                        playerBaseUrl: saved.playerBaseUrl,
                        playerProviders: saved.playerProviders,
                        m3uPlaylists: saved.m3uPlaylists
                    };
                    PersistentStorage.setItem('ivids-settings', JSON.stringify(globalSettingsToSave));
                    PersistentStorage.setItem(userKey, JSON.stringify(userSettingsToSave));
                }

                _cachedPlayerConfig = {
                    ...defaults,
                    ...saved,
                    playerBaseUrl: (saved.playerBaseUrl || defaults.playerBaseUrl).replace(/\/+$/, '')
                };
                _configOwnerId = currentId;
                return _cachedPlayerConfig;
            }
            _cachedPlayerConfig = defaults;
            _configOwnerId = currentId;
            return defaults;
        } catch (error) {
            console.error('Error reading player config:', error);
            _cachedPlayerConfig = defaults;
            _configOwnerId = currentId;
            return defaults;
        }
    },

    /**
     * Clears the cached player config so the next getPlayerConfig() call re-reads from localStorage.
     * Must be called after any settings change that affects player providers.
     */
    invalidatePlayerConfig() {
        _cachedPlayerConfig = null;
    },

    /**
     * Dynamic getter that retrieves the active priority-ordered list of player provider servers.
     * This formats names for custom servers dynamically using their hostnames and returns the list.
     * @returns {Array<Object>} List of active server provider objects.
     */
    get SERVERS() {
        const config = Api.getPlayerConfig();
        const providers = config.playerProviders || DEFAULT_PLAYER_PROVIDERS;
        return providers.map(p => {
            let displayName = p.name;
            if (p.isCustom || !displayName) {
                try {
                    const host = new URL(p.url).hostname;
                    displayName = host ? `${host} (Custom)` : 'Custom Server';
                } catch (e) {
                    displayName = 'Custom Server';
                }
            }
            return {
                id: p.id,
                name: displayName,
                url: p.url,
                isCustom: !!p.isCustom
            };
        });
    },

    /**
     * Generates the streaming embed URL for the player iframe.
     * This affects the video source URL loaded inside the player page.
     * @param {string} id - TMDB content ID.
     * @param {string} type - 'movie' or 'tv'.
     * @param {number} [season] - TV show season number.
     * @param {number} [episode] - TV show episode number.
     * @param {string} [serverId] - Explicit server provider ID.
     * @returns {string} Fully formed embed URL.
     */
    getVideoUrl(id, type, season = null, episode = null, serverId = null) {
        const config = Api.getPlayerConfig();
        
        let baseUrl;
        if (serverId) {
            const server = Api.SERVERS.find(s => s.id === serverId);
            baseUrl = server ? server.url : config.playerBaseUrl;
        } else {
            const servers = Api.SERVERS;
            baseUrl = (servers && servers.length > 0) ? servers[0].url : config.playerBaseUrl;
        }
        const params = 'autoplay=true&autoPlay=true&ds_lang=en';

        if (type === 'tv') {
            const s = season || 1;
            const e = episode || 1;
            return `${baseUrl}/tv/${id}/${s}/${e}?${params}`;
        }
        return `${baseUrl}/movie/${id}?${params}`;
    },

    getGenres() {
        return [
            { id: 28, name: "Action" },
            { id: 12, name: "Adventure" },
            { id: 16, name: "Animation" },
            { id: 35, name: "Comedy" },
            { id: 80, name: "Crime" },
            { id: 99, name: "Documentary" },
            { id: 18, name: "Drama" },
            { id: 10751, name: "Family" },
            { id: 14, name: "Fantasy" },
            { id: 36, name: "History" },
            { id: 27, name: "Horror" },
            { id: 10402, name: "Music" },
            { id: 9648, name: "Mystery" },
            { id: 10749, name: "Romance" },
            { id: 878, name: "Sci-Fi" },
            { id: 10770, name: "TV Movie" },
            { id: 53, name: "Thriller" },
            { id: 10752, name: "War" },
            { id: 37, name: "Western" },
            { id: 10759, name: "Action & Adventure (TV)" },
            { id: 10762, name: "Kids (TV)" },
            { id: 10763, name: "News (TV)" },
            { id: 10764, name: "Reality (TV)" },
            { id: 10765, name: "Sci-Fi & Fantasy (TV)" },
            { id: 10766, name: "Soap (TV)" },
            { id: 10767, name: "Talk (TV)" },
            { id: 10768, name: "War & Politics (TV)" }
        ];
    },

    getCertifications() {
        const certs = ["G", "PG", "PG-13", "R", "NC-17", "TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14", "TV-MA"];
        if (this.getIncludeAdult()) {
            certs.push("XXX");
        }
        return certs;
    },

    /**
     * Fetches a list of countries supported by TMDB.
     * This affects the country selection options in settings.
     * @returns {Promise<Array>} List of country configuration objects.
     */
    async fetchCountries() {
        try {
            const lang = this.getLanguageCode();
            const response = await deduplicatedFetch(`${BASE_URL}/configuration/countries?api_key=${API_KEY}&language=${lang}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching countries:', error);
            return [];
        }
    },

    /**
     * Fetches watch providers for a given content type and region from TMDB.
     * This affects the provider filter options on the discover screen.
     * @param {string} [type='movie'] - Content type ('movie' or 'tv').
     * @param {string} [region='US'] - Watch region ISO code.
     * @returns {Promise<Array>} List of watch providers.
     */
    async fetchWatchProviders(type = 'movie', region = 'US') {
        try {
            const lang = this.getLanguageCode();
            const response = await deduplicatedFetch(`${BASE_URL}/watch/providers/${type}?api_key=${API_KEY}&watch_region=${region}&language=${lang}`);
            const data = await response.json();
            return data.results || [];
        } catch (error) {
            console.error('Error fetching watch providers:', error);
            return [];
        }
    },

    /**
     * Discovers content on TMDB using dynamic filters like genres, year, and watch providers.
     * This updates the content list on the main filter/discover page.
     * @param {Object} filters - Search filters like genres, year, and watch providers.
     * @returns {Promise<Array>} List of discovered content.
     */
    async discoverContent(filters) {
        if (API_KEY.includes('TODO')) return [];
        try {
            const lang = this.getLanguageCode();
            let params = new URLSearchParams({
                api_key: API_KEY,
                sort_by: filters.sortBy || 'popularity.desc',
                include_adult: this.getIncludeAdult(),
                include_video: false,
                page: filters.page || 1,
                language: lang
            });

            if (filters.genres && filters.genres.length > 0) {
                params.append('with_genres', filters.genres.join(','));
            }

            if (filters.certification) {
                params.append('certification_country', 'US');
                params.append('certification', filters.certification);
            }

            const type = filters.type || 'movie';

            if (filters.year) {
                params.append('primary_release_year', filters.year);
                params.append('first_air_date_year', filters.year);
            } else if (filters.decade) {
                const start = parseInt(filters.decade);
                if (start === 1970) {
                    // 70s & older
                    if (type === 'movie') {
                        params.append('primary_release_date.lte', '1979-12-31');
                    } else {
                        params.append('first_air_date.lte', '1979-12-31');
                    }
                } else {
                    const end = start + 9;
                    if (type === 'movie') {
                        params.append('primary_release_date.gte', `${start}-01-01`);
                        params.append('primary_release_date.lte', `${end}-12-31`);
                    } else {
                        params.append('first_air_date.gte', `${start}-01-01`);
                        params.append('first_air_date.lte', `${end}-12-31`);
                    }
                }
            }

            if (filters.runtime) {
                if (filters.runtime === 'short') {
                    params.append('with_runtime.lte', 90);
                } else if (filters.runtime === 'medium') {
                    params.append('with_runtime.gte', 90);
                    params.append('with_runtime.lte', 120);
                } else if (filters.runtime === 'long') {
                    params.append('with_runtime.gte', 120);
                }
            }

            if (filters.network) {
                if (type === 'tv') {
                    params.append('with_networks', filters.network);
                } else {
                    // movie company mapping
                    let companyId = '';
                    const netId = parseInt(filters.network);
                    if (netId === 213) companyId = '213|178464|171251'; // Netflix
                    else if (netId === 49) companyId = '3287|3268'; // HBO
                    else if (netId === 2739) companyId = '2'; // Disney
                    else if (netId === 1024) companyId = '20580'; // Amazon Prime
                    else if (netId === 2552) companyId = '131018'; // Apple TV+
                    if (companyId) {
                        params.append('with_companies', companyId);
                    }
                }
            }

            if (filters.originCountry) {
                params.append('with_origin_country', filters.originCountry);
            }

            if (filters.watchProviders && filters.watchProviders.length > 0) {
                params.append('watch_region', filters.watchRegion || 'US');
                params.append('with_watch_providers', filters.watchProviders.join('|')); // OR condition
            }

            if (filters.voteCount) {
                params.append('vote_count.gte', filters.voteCount);
            }

            const response = await deduplicatedFetch(`${BASE_URL}/discover/${type}?${params.toString()}`);
            const data = await response.json();
            if (!data || !data.results) return [];
            return data.results.map(item => ({ ...item, media_type: type }));
        } catch (error) {
            console.error('Error discovering content:', error);
            return [];
        }
    },

    getMockData() {
        return [
            {
                id: 1,
                title: "Mock Movie 1",
                backdrop_path: null,
                poster_path: null,
                overview: "This is a mock movie description because the API key is missing.",
                media_type: "movie"
            },
            {
                id: 2,
                name: "Mock Series 1",
                backdrop_path: null,
                poster_path: null,
                overview: "This is a mock series description.",
                media_type: "tv"
            }
        ];
    },
};

