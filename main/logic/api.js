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
