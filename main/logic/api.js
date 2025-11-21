<<<<<<< HEAD
const API_KEY = 'a341dc9a3c2dffa62668b614a98c1188'; // TODO: Replace with your TMDb API Key
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w1280';
const VIDSRC_BASE_URL = 'https://vidsrc.to/embed';

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
    getImageUrl: (path) => path ? `${IMAGE_BASE_URL}${path}` : 'assets/placeholder.png',
    // Internal cache for genre mappings: { movie: {id:name}, tv: {id:name} }
    _genreCache: {},
    _lang: null,

    // Map short code to TMDb language format (fallback to en-US)
    _formatLang(code) {
        if (!code) return 'en-US';
        if (code.includes('-')) return code;
        const map = {
            en: 'en-US',
            es: 'es-ES',
            fr: 'fr-FR'
        };
        return map[code] || 'en-US';
    },

    // Set content language (short code like 'en', 'es', or full like 'en-US')
    setLanguage(code) {
        this._lang = this._formatLang(code);
        // Clear cached genre lists so they can be refetched for new language
        this._genreCache = {};
    },

    // Get currently selected content language (TMDb format like 'en-US')
    getLanguage() {
        if (this._lang) return this._lang;
        try {
            // Try reading from saved app settings
            if (window && typeof window.getIVIDSSettings === 'function') {
                const s = window.getIVIDSSettings();
                if (s && s.language) {
                    this._lang = this._formatLang(s.language);
                    return this._lang;
                }
            }
        } catch (e) {
            // ignore
        }
        // Fallback to browser language
        const nav = (navigator && navigator.language) ? navigator.language : 'en-US';
        this._lang = this._formatLang(nav);
        return this._lang;
    },

    // Fetch and cache genres for a given type ('movie' or 'tv')
    async fetchGenres(type = 'movie', lang) {
        const langParam = lang || this.getLanguage();
        const key = `${type}_${langParam}`;
        if (this._genreCache[key]) return this._genreCache[key];
        try {
            const response = await fetch(`${BASE_URL}/genre/${type}/list?api_key=${API_KEY}&language=${encodeURIComponent(langParam)}`);
            const data = await response.json();
            const map = {};
            if (data && data.genres) {
                data.genres.forEach(g => { map[g.id] = g.name; });
            }
            this._genreCache[key] = map;
            return map;
        } catch (error) {
            console.error('Error fetching genres:', error);
            return {};
        }
    },

    // Given an item (which may contain `genres` array or `genre_ids`), return an array of genre names.
    // `type` should be 'movie' or 'tv' to look up proper genre mapping when only ids are present.
    async getGenreNames(item = {}, type = 'movie', lang) {
        if (!item) return [];
        // If details already include full genres array with names
        if (Array.isArray(item.genres) && item.genres.length > 0) {
            return item.genres.map(g => g.name).filter(Boolean);
        }

        // Otherwise use genre_ids and the cached genre list
        const ids = item.genre_ids || [];
        if (!ids || ids.length === 0) return [];

        const langParam = lang || this.getLanguage();
        const map = await this.fetchGenres(type === 'tv' ? 'tv' : 'movie', langParam);
        return ids.map(id => map[id]).filter(Boolean);
    },

    async fetchTrending() {
        try {
            const langParam = this.getLanguage();
            const response = await fetch(`${BASE_URL}/trending/all/week?api_key=${API_KEY}&language=${encodeURIComponent(langParam)}`);
            const data = await response.json();
            return shuffleArray(data.results);
        } catch (error) {
            console.error('Error fetching trending:', error);
            return [];
        }
    },

    async fetchTopRated() {
        try {
            const langParam = this.getLanguage();
            const response = await fetch(`${BASE_URL}/movie/top_rated?api_key=${API_KEY}&language=${encodeURIComponent(langParam)}`);
            const data = await response.json();
            return shuffleArray(data.results);
        } catch (error) {
            console.error('Error fetching top rated:', error);
            return [];
        }
    },

    async fetchActionMovies() {
        try {
            const langParam = this.getLanguage();
            const response = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=28&language=${encodeURIComponent(langParam)}`);
            const data = await response.json();
            return shuffleArray(data.results);
        } catch (error) {
            console.error('Error fetching action movies:', error);
            return [];
        }
    },

    async fetchComedyMovies() {
        try {
            const langParam = this.getLanguage();
            const response = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=35&language=${encodeURIComponent(langParam)}`);
            const data = await response.json();
            return shuffleArray(data.results);
        } catch (error) {
            console.error('Error fetching comedy movies:', error);
            return [];
        }
    },

    async fetchPopularTV() {
        try {
            const langParam = this.getLanguage();
            const response = await fetch(`${BASE_URL}/tv/popular?api_key=${API_KEY}&language=${encodeURIComponent(langParam)}`);
            const data = await response.json();
            return shuffleArray(data.results);
        } catch (error) {
            console.error('Error fetching popular TV:', error);
            return [];
        }
    },

    async searchContent(query) {
        if (API_KEY.includes('TODO')) return [];
        try {
            const langParam = this.getLanguage();
            const response = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=${encodeURIComponent(langParam)}`);
            const data = await response.json();
            return data.results;
        } catch (error) {
            console.error('Error searching:', error);
            return [];
        }
    },

    async getDetails(id, type, lang) {
        if (API_KEY.includes('TODO')) return null;
        try {
            const langParam = lang || this.getLanguage();
            const response = await fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&language=${encodeURIComponent(langParam)}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching details:', error);
            return null;
        }
    },

    getVideoUrl(id, type) {
        // type should be 'movie' or 'tv'
        return `${VIDSRC_BASE_URL}/${type}/${id}`;
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
=======
const API_KEY = 'a341dc9a3c2dffa62668b614a98c1188'; // TODO: Replace with your TMDb API Key
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w1280';
const VIDSRC_BASE_URL = 'https://vidsrc.to/embed';

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
    getImageUrl: (path) => path ? `${IMAGE_BASE_URL}${path}` : 'assets/placeholder.png',

    async fetchTrending() {
        try {
            const response = await fetch(`${BASE_URL}/trending/all/week?api_key=${API_KEY}`);
            const data = await response.json();
            return shuffleArray(data.results);
        } catch (error) {
            console.error('Error fetching trending:', error);
            return [];
        }
    },

    async fetchTopRated() {
        try {
            const response = await fetch(`${BASE_URL}/movie/top_rated?api_key=${API_KEY}`);
            const data = await response.json();
            return shuffleArray(data.results);
        } catch (error) {
            console.error('Error fetching top rated:', error);
            return [];
        }
    },

    async fetchActionMovies() {
        try {
            const response = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=28`);
            const data = await response.json();
            return shuffleArray(data.results);
        } catch (error) {
            console.error('Error fetching action movies:', error);
            return [];
        }
    },

    async fetchComedyMovies() {
        try {
            const response = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=35`);
            const data = await response.json();
            return shuffleArray(data.results);
        } catch (error) {
            console.error('Error fetching comedy movies:', error);
            return [];
        }
    },

    async fetchPopularTV() {
        try {
            const response = await fetch(`${BASE_URL}/tv/popular?api_key=${API_KEY}`);
            const data = await response.json();
            return shuffleArray(data.results);
        } catch (error) {
            console.error('Error fetching popular TV:', error);
            return [];
        }
    },

    async searchContent(query) {
        if (API_KEY.includes('TODO')) return [];
        try {
            const response = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
            const data = await response.json();
            return data.results;
        } catch (error) {
            console.error('Error searching:', error);
            return [];
        }
    },

    async getDetails(id, type) {
        if (API_KEY.includes('TODO')) return null;
        try {
            const response = await fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching details:', error);
            return null;
        }
    },

    getVideoUrl(id, type) {
        // type should be 'movie' or 'tv'
        return `${VIDSRC_BASE_URL}/${type}/${id}`;
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
>>>>>>> 9cb739138d9b59ab65cad410bc39d6c60fb358f3
