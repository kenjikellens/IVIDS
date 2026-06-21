import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { getRecentlyWatched } from '../../logic/recentlyWatched.js';
import { HeroSlider } from '../js/hero-slider.js';
import { ErrorHandler } from '../js/error-handler.js';
import { setupRow, setupLazyLoadedRows } from '../js/utils/ui-helper.js';
import { Splash } from '../js/splash.js';

/**
 * Initializes the unified browse page based on the current active route (home, movies, or series).
 * Loads appropriate hero sliders, populates watch history (for home), and sets up lazy loaded rows.
 * @param {Object} params - The initialization parameters containing the active route identifier.
 * @param {string} params.route - The name of the current route ('home', 'movies', or 'series').
 * @returns {Promise<void>} Resolves when initialization is complete.
 */
export async function init(params) {
    const route = params?.route || 'home';
    try {
        if (route === 'home') {
            await initHome();
        } else if (route === 'movies') {
            await initMovies();
        } else if (route === 'series') {
            await initSeries();
        } else {
            console.warn(`Unknown browse route: ${route}, defaulting to Home.`);
            await initHome();
        }
    } catch (error) {
        console.error(`Critical error initializing browse page for route ${route}:`, error);
        ErrorHandler.show(`Failed to initialize ${route} page.`, () => init(params));
    }
}

/**
 * Loads trending media and recently watched history to initialize the home page.
 * Instantiates the main hero carousel slider and registers home categories for lazy loading.
 * @returns {Promise<void>} Resolves when the home components are loaded.
 */
async function initHome() {
    // 1. Load Hero and Recently Watched concurrently for faster initial render
    const trendingPromise = Api.fetchTrending()
        .then(val => ({ status: 'fulfilled', value: val }))
        .catch(err => ({ status: 'rejected', reason: err }));
    const recentPromise = Promise.resolve().then(() => { try { return getRecentlyWatched(); } catch (e) { return []; } })
        .then(val => ({ status: 'fulfilled', value: val }))
        .catch(err => ({ status: 'rejected', reason: err }));

    const [trendingResult, recentResult] = await Promise.all([trendingPromise, recentPromise]);

    const trending = trendingResult.status === 'fulfilled' ? trendingResult.value : [];
    const recentlyWatched = recentResult.status === 'fulfilled' ? recentResult.value : [];

    // Setup Hero
    if (trending && trending.length > 0) {
        new HeroSlider(trending, {
            containerId: 'hero',
            titleId: 'hero-title',
            descId: 'hero-desc',
            playBtnId: 'play-btn'
        });
    } else {
        console.warn('Home: No trending data available for Hero.');
        // Signal splash to dismiss even if we have no hero content
        try {
            Splash.signalContentLoaded();
        } catch (splashErr) {
            console.error('Home: Failed to signal splash dismissal:', splashErr);
        }
    }

    // Setup Recently Watched
    if (recentlyWatched && recentlyWatched.length > 0) {
        const el = document.getElementById('recently-watched-row');
        if (el && el.parentElement) el.parentElement.style.display = '';
        setupRow('recently-watched-row', recentlyWatched);
    } else {
        const el = document.getElementById('recently-watched-row');
        if (el && el.parentElement) el.parentElement.style.display = 'none';
    }

    // Define Lazy Load Configuration for Home
    const categories = [
        { id: 'highly-rated-row', fetcher: () => Api.fetchHighlyRated() },
        { id: 'new-this-year-row', fetcher: () => Api.fetchNewThisYear() },
        { id: 'award-winners-row', fetcher: () => Api.fetchAwardWinners() },
        { id: 'top-rated-row', fetcher: () => Api.fetchTopRated() },
        { id: 'action-row', fetcher: () => Api.fetchActionMovies() },
        { id: 'comedy-row', fetcher: () => Api.fetchComedyMovies() },
        { id: 'tv-row', fetcher: () => Api.fetchPopularTV() },
        { id: 'comedy-series-row', fetcher: () => Api.fetchComedySeries() },
        { id: 'anime-row', fetcher: () => Api.fetchAnimeMovies() },
        { id: 'disney-row', fetcher: () => Api.fetchDisneyMovies() },
        { id: 'marvel-row', fetcher: () => Api.fetchMarvelMovies() },
        { id: 'pixar-row', fetcher: () => Api.fetchPixarMovies() },
        { id: 'ghibli-row', fetcher: () => Api.fetchStudioGhibli() },
        { id: 'netflix-row', fetcher: () => Api.fetchNetflixOriginals() },
        { id: 'korean-row', fetcher: () => Api.fetchKoreanContent() },
        { id: 'bollywood-row', fetcher: () => Api.fetchBollywood() },
        { id: 'classics-row', fetcher: () => Api.fetchClassicMovies() },
        { id: 'horror-row', fetcher: () => Api.fetchHorrorMovies() },
        { id: 'scifi-row', fetcher: () => Api.fetchSciFiMovies() },
        { id: 'thriller-row', fetcher: () => Api.fetchThrillerMovies() },
        { id: 'romance-row', fetcher: () => Api.fetchRomanceMovies() },
        { id: 'family-row', fetcher: () => Api.fetchFamilyMovies() },
        { id: 'documentary-row', fetcher: () => Api.fetchDocumentaryMovies() },
        { id: 'crime-row', fetcher: () => Api.fetchCrimeMovies() },
        { id: 'fantasy-row', fetcher: () => Api.fetchFantasyMovies() }
    ];

    // Register lazy loaders
    setupLazyLoadedRows(categories);
}

/**
 * Loads popular movies to initialize the movies page.
 * Instantiates the movie hero slider carousel and registers movie categories for lazy loading.
 * @returns {Promise<void>} Resolves when the movies components are loaded.
 */
async function initMovies() {
    let popular = [];
    try { popular = await Api.fetchTrending(); } catch (e) { console.error(e); }

    // Filter for movies
    const movies = popular.filter(m => m.media_type === 'movie' || !m.media_type);

    if (movies && movies.length > 0) {
        new HeroSlider(movies, {
            containerId: 'hero',
            titleId: 'hero-title',
            descId: 'hero-desc',
            playBtnId: 'play-btn'
        });
    } else {
        try {
            Splash.signalContentLoaded();
        } catch (splashErr) {
            console.error('Movies: Failed to signal splash dismissal:', splashErr);
        }
    }

    // Define Categories for Movies
    const categories = [
        { id: 'top-rated-movies-row', fetcher: () => Api.fetchTopRated() },
        { id: 'action-movies-row', fetcher: () => Api.fetchActionMovies() },
        { id: 'comedy-movies-row', fetcher: () => Api.fetchComedyMovies() },
        { id: 'adventure-movies-row', fetcher: () => Api.fetchAdventureMovies() },
        { id: 'animation-movies-row', fetcher: () => Api.fetchAnimationMovies() },
        { id: 'crime-movies-row', fetcher: () => Api.fetchCrimeMovies() },
        { id: 'documentary-movies-row', fetcher: () => Api.fetchDocumentaryMovies() },
        { id: 'drama-movies-row', fetcher: () => Api.fetchDramaMovies() },
        { id: 'family-movies-row', fetcher: () => Api.fetchFamilyMovies() },
        { id: 'fantasy-movies-row', fetcher: () => Api.fetchFantasyMovies() },
        { id: 'history-movies-row', fetcher: () => Api.fetchHistoryMovies() },
        { id: 'horror-movies-row', fetcher: () => Api.fetchHorrorMovies() },
        { id: 'music-movies-row', fetcher: () => Api.fetchMusicMovies() },
        { id: 'mystery-movies-row', fetcher: () => Api.fetchMysteryMovies() },
        { id: 'romance-movies-row', fetcher: () => Api.fetchRomanceMovies() },
        { id: 'scifi-movies-row', fetcher: () => Api.fetchSciFiMovies() },
        { id: 'thriller-movies-row', fetcher: () => Api.fetchThrillerMovies() },
        { id: 'war-movies-row', fetcher: () => Api.fetchWarMovies() },
        { id: 'western-movies-row', fetcher: () => Api.fetchWesternMovies() },
        { id: 'anime-movies-row', fetcher: () => Api.fetchAnimeMovies() },
    ];

    // Register lazy loaders
    setupLazyLoadedRows(categories, 'movie');
}

/**
 * Loads popular TV series to initialize the series page.
 * Instantiates the TV show hero slider carousel and registers series categories for lazy loading.
 * @returns {Promise<void>} Resolves when the series components are loaded.
 */
async function initSeries() {
    let popular = [];
    try { popular = await Api.fetchPopularTV(); } catch (e) { console.error(e); }

    if (popular && popular.length > 0) {
        new HeroSlider(popular, {
            containerId: 'hero',
            titleId: 'hero-title',
            descId: 'hero-desc',
            playBtnId: 'play-btn'
        });
    } else {
        try {
            Splash.signalContentLoaded();
        } catch (splashErr) {
            console.error('Series: Failed to signal splash dismissal:', splashErr);
        }
    }

    // Define Categories for Series
    const categories = [
        { id: 'top-rated-series-row', fetcher: () => Api.fetchTopRatedTV() },
        { id: 'action-adventure-series-row', fetcher: () => Api.fetchActionAdventureSeries() },
        { id: 'animation-series-row', fetcher: () => Api.fetchAnimationSeries() },
        { id: 'crime-series-row', fetcher: () => Api.fetchCrimeSeries() },
        { id: 'documentary-series-row', fetcher: () => Api.fetchDocumentarySeries() },
        { id: 'drama-series-row', fetcher: () => Api.fetchDramaSeries() },
        { id: 'family-series-row', fetcher: () => Api.fetchFamilySeries() },
        { id: 'kids-series-row', fetcher: () => Api.fetchKidsSeries() },
        { id: 'mystery-series-row', fetcher: () => Api.fetchMysterySeries() },
        { id: 'reality-series-row', fetcher: () => Api.fetchRealitySeries() },
        { id: 'scifi-fantasy-series-row', fetcher: () => Api.fetchSciFiFantasySeries() },
        { id: 'soap-series-row', fetcher: () => Api.fetchSoapSeries() },
        { id: 'war-politics-series-row', fetcher: () => Api.fetchWarPoliticsSeries() },
        { id: 'western-series-row', fetcher: () => Api.fetchWesternSeries() },
        { id: 'anime-series-row', fetcher: () => Api.fetchAnimeSeries() },
    ];

    // Register lazy loaders
    setupLazyLoadedRows(categories, 'tv');
}
