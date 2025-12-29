import { cacheManager } from './cache-manager.js';

const API_KEY = 'a341dc9a3c2dffa62668b614a98c1188'; // TODO: Replace with your TMDb API Key
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_PATH = 'https://image.tmdb.org/t/p';
const VIDSRC_BASE_URL = 'https://vidsrc.net/embed';

// Image Size Constants
const POSTER_SIZE = 'w342';       // Standard poster size for grids
const BACKDROP_SIZE = 'w1280';    // High res for backgrounds
const STILL_SIZE = 'w300';        // Small stills for episode lists
const DETAIL_POSTER_SIZE = 'w500'; // Medium size for details page

// Helper for network timeouts and retries
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

// Helper function to get today's date in YYYY-MM-DD format
function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

function shuffleArray(array) {
    // Fisher-Yates shuffle
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

    getRecommendedPosterSize: () => {
        const width = window.innerWidth;
        const dpr = window.devicePixelRatio || 1;
        const effectiveWidth = width * dpr;

        // On TV, we prioritize performance over pixel-perfection
        if (Api.isTV()) {
            if (width > 1400) return 'w342';
            return 'w185';
        }

        // Standard grid posters are small (~150px-200px)
        if (effectiveWidth > 1000) return 'w342';
        if (effectiveWidth > 600) return 'w185';
        return 'w154';
    },

    getRecommendedDetailPosterSize: () => {
        const width = window.innerWidth;
        const dpr = window.devicePixelRatio || 1;
        const effectiveWidth = width * dpr;

        // Detail posters are larger (~300px-500px)
        if (effectiveWidth > 1400) return 'w500';
        if (effectiveWidth > 800) return 'w342';
        return 'w185';
    },

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

    async fetchTrending() {
        const cacheKey = 'trending_all_week';
        const cached = cacheManager.get(cacheKey);
        if (cached) return shuffleArray([...cached]);

        try {
            const response = await fetchWithRetry(`${BASE_URL}/trending/all/week?api_key=${API_KEY}&include_adult=false`);
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
            return [];
        }
    },

    async fetchTopRated() {
        const cacheKey = 'movie_top_rated';
        const cached = cacheManager.get(cacheKey);
        if (cached) return shuffleArray([...cached]);

        try {
            const today = getTodayDate();
            const response = await fetchWithRetry(`${BASE_URL}/movie/top_rated?api_key=${API_KEY}&include_adult=false&primary_release_date.lte=${today}`);
            const data = await response.json();

            if (data && data.results) {
                cacheManager.set(cacheKey, data.results, 60); // Top rated changes slowly, cache for 1 hour
                return shuffleArray(data.results);
            }
            return [];
        } catch (error) {
            console.error('Error fetching top rated:', error);
            return [];
        }
    },

    async _fetchDiscover(type, params) {
        const cacheKey = `discover_${type}_${params}`;
        const cached = cacheManager.get(cacheKey);
        if (cached) return shuffleArray([...cached]); // Return a shuffled clone

        try {
            const today = getTodayDate();
            // Add release date filter based on type to ensure only released/aired content
            const dateFilter = type === 'movie'
                ? `primary_release_date.lte=${today}`
                : `first_air_date.lte=${today}`;

            // Always exclude adult content from browse/discovery pages
            const response = await fetchWithRetry(`${BASE_URL}/discover/${type}?api_key=${API_KEY}&include_adult=false&${dateFilter}&${params}`);
            const data = await response.json();

            if (data && data.results) {
                cacheManager.set(cacheKey, data.results, 15); // Cache for 15 minutes
                return shuffleArray(data.results);
            }
            return [];
        } catch (error) {
            console.error(`Error fetching ${type} with params ${params}:`, error);
            return [];
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
    fetchNetflixOriginals() { return this._fetchDiscover('movie', 'with_companies=213'); },

    // Quality & Time-based
    fetchHighlyRated() { return this._fetchDiscover('movie', 'vote_average.gte=8&vote_count.gte=1000&sort_by=vote_average.desc'); },
    fetchNewThisYear() { return this._fetchDiscover('movie', 'primary_release_date.gte=2025-01-01&sort_by=popularity.desc'); },
    fetchClassicMovies() { return this._fetchDiscover('movie', 'primary_release_date.gte=1970-01-01&primary_release_date.lte=1999-12-31&vote_count.gte=500&sort_by=vote_average.desc'); },
    fetchAwardWinners() { return this._fetchDiscover('movie', 'vote_average.gte=7.5&vote_count.gte=5000&sort_by=vote_count.desc'); },

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

    async fetchPopularTV() {
        const cacheKey = 'tv_popular';
        const cached = cacheManager.get(cacheKey);
        if (cached) return shuffleArray([...cached]);

        try {
            const today = getTodayDate();
            const response = await fetchWithRetry(`${BASE_URL}/tv/popular?api_key=${API_KEY}&include_adult=false&first_air_date.lte=${today}`);
            const data = await response.json();

            if (data && data.results) {
                cacheManager.set(cacheKey, data.results, 15);
                return shuffleArray(data.results);
            }
            return [];
        } catch (error) {
            console.error('Error fetching popular TV:', error);
            return [];
        }
    },

    async fetchTopRatedTV() {
        const cacheKey = 'tv_top_rated';
        const cached = cacheManager.get(cacheKey);
        if (cached) return shuffleArray([...cached]);

        try {
            const today = getTodayDate();
            const response = await fetchWithRetry(`${BASE_URL}/tv/top_rated?api_key=${API_KEY}&include_adult=false&first_air_date.lte=${today}`);
            const data = await response.json();

            if (data && data.results) {
                cacheManager.set(cacheKey, data.results, 60);
                return shuffleArray(data.results);
            }
            return [];
        } catch (error) {
            console.error('Error fetching top rated TV:', error);
            return [];
        }
    },

    async searchContent(query, page = 1) {
        if (API_KEY.includes('TODO')) return [];
        try {
            // Note: include_adult is NOT set to false here intentionally
            // Adult content can be found via explicit search only
            const response = await fetchWithRetry(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=${page}`);
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

    async fetchRecommendations(id, type) {
        if (API_KEY.includes('TODO')) return [];
        try {
            const response = await fetchWithRetry(`${BASE_URL}/${type}/${id}/recommendations?api_key=${API_KEY}&include_adult=false`);
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

    async getDetails(id, type) {
        if (API_KEY.includes('TODO')) return null;
        try {
            const append = type === 'movie' ? 'release_dates' : 'content_ratings';
            const response = await fetchWithRetry(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=${append}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching details:', error);
            return null;
        }
    },

    async getSeasonDetails(seriesId, seasonNumber) {
        if (API_KEY.includes('TODO')) return null;
        try {
            const response = await fetchWithRetry(`${BASE_URL}/tv/${seriesId}/season/${seasonNumber}?api_key=${API_KEY}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching season details:', error);
            return null;
        }
    },

    getVideoUrl(id, type, season = null, episode = null) {
        // Use path-based structure for vidsrc.net/to mirrors
        const params = 'autoplay=true&autoPlay=true&ds_lang=en';
        if (type === 'tv') {
            const s = season || 1;
            const e = episode || 1;
            return `${VIDSRC_BASE_URL}/tv/${id}/${s}/${e}?${params}`;
        }
        return `${VIDSRC_BASE_URL}/movie/${id}?${params}`;
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
        return ["G", "PG", "PG-13", "R", "NC-17", "TV-Y", "TV-Y7", "TV-G", "TV-PG", "TV-14", "TV-MA"];
    },

    async fetchCountries() {
        try {
            const response = await fetchWithRetry(`${BASE_URL}/configuration/countries?api_key=${API_KEY}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching countries:', error);
            return [];
        }
    },

    async fetchWatchProviders(type = 'movie', region = 'US') {
        try {
            const response = await fetchWithRetry(`${BASE_URL}/watch/providers/${type}?api_key=${API_KEY}&watch_region=${region}`);
            const data = await response.json();
            return data.results || [];
        } catch (error) {
            console.error('Error fetching watch providers:', error);
            return [];
        }
    },

    async discoverContent(filters) {
        if (API_KEY.includes('TODO')) return [];
        try {
            let params = new URLSearchParams({
                api_key: API_KEY,
                sort_by: filters.sortBy || 'popularity.desc',
                include_adult: false,
                include_video: false,
                page: filters.page || 1
            });

            if (filters.genres && filters.genres.length > 0) {
                params.append('with_genres', filters.genres.join(','));
            }

            if (filters.certification) {
                params.append('certification_country', 'US');
                params.append('certification', filters.certification);
            }

            if (filters.year) {
                params.append('primary_release_year', filters.year);
                params.append('first_air_date_year', filters.year);
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

            const type = filters.type || 'movie';

            const response = await fetchWithRetry(`${BASE_URL}/discover/${type}?${params.toString()}`);
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
    }
};
