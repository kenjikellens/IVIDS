import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { getRecentlyWatched } from '../../logic/recentlyWatched.js';
import { HeroSlider } from '../js/hero-slider.js';
import { ErrorHandler } from '../js/error-handler.js';
import { setupRow, setupLazyLoadedRows } from '../js/utils/ui-helper.js';
import { Splash } from '../js/splash.js';
import { CategoryRenderer } from '../js/category-renderer.js';
import { CATEGORY_CONFIG } from '../../logic/constants.js';
import { regionalCategoryService } from '../../logic/regional-categories.js';

/**
 * Resolves the async data fetcher function for a given category item configuration.
 * Handles static genres, themes, tropes, universes, and dynamic regional (country/language) fetchers.
 * @param {Object} cat - Category item definition from CATEGORY_CONFIG or RegionalCategoryService.
 * @param {string} view - The active browse view ('home', 'movies', or 'series').
 * @returns {Function} Parameterless async fetcher function returning an array of media objects.
 */
function resolveCategoryFetcher(cat, view) {
    if (cat.fetchConfig) {
        const { type, code, mediaType } = cat.fetchConfig;
        if (type === 'country') {
            return () => Api.fetchByCountry(code, mediaType || (view === 'series' ? 'tv' : 'movie'));
        }
        if (type === 'lang') {
            return () => Api.fetchByLanguage(code, mediaType || (view === 'series' ? 'tv' : 'movie'));
        }
    }

    const staticFetchers = {
        // Universal / Home & Shared
        'trending-today-row': () => Api.fetchTrendingToday(),
        'top-rated-row': () => Api.fetchTopRated(),
        'new-this-year-row': () => Api.fetchNewThisYear(),
        'popular-movies-row': () => Api.fetchTrending(),
        'popular-series-row': () => Api.fetchPopularTV(),
        'blockbuster-movies-row': () => Api.fetchTrending(),
        'award-winners-row': () => Api.fetchAwardWinners(),
        'true-story-row': () => Api.fetchTrueStoryMovies(),
        'heist-movies-row': () => Api.fetchHeistMovies(),
        'zombie-apocalypse-row': () => Api.fetchZombieMovies(),
        'sports-movies-row': () => Api.fetchSportsMovies(),
        'marvel-row': () => Api.fetchMarvelMovies(),
        'dc-universe-row': () => Api.fetchDcMovies(),
        'anime-row': () => (view === 'series' ? Api.fetchAnimeSeries() : Api.fetchAnimeMovies()),
        'eighties-movies-row': () => Api.fetch80sMovies(),
        'nineties-movies-row': () => Api.fetch90sMovies(),
        'classics-row': () => Api.fetchClassicMovies(),
        'action-movies-row': () => Api.fetchActionMovies(),
        'comedy-movies-row': () => Api.fetchComedyMovies(),
        'romcom-movies-row': () => Api.fetchRomComMovies(),
        'thriller-movies-row': () => Api.fetchThrillerMovies(),
        'horror-movies-row': () => Api.fetchHorrorMovies(),
        'scifi-movies-row': () => Api.fetchSciFiMovies(),
        'family-movies-row': () => (view === 'series' ? Api.fetchFamilySeries() : Api.fetchFamilyMovies()),
        'documentary-movies-row': () => (view === 'series' ? Api.fetchDocumentarySeries() : Api.fetchDocumentaryMovies()),
        'fantasy-movies-row': () => Api.fetchFantasyMovies(),

        // Movies Page Specific
        'trending-movies-today-row': () => Api.fetchTrendingToday(),
        'top-rated-movies-row': () => Api.fetchTopRated(),
        'award-winners-movies-row': () => Api.fetchAwardWinners(),
        'true-story-movies-row': () => Api.fetchTrueStoryMovies(),
        'zombie-movies-row': () => Api.fetchZombieMovies(),
        'psychological-thriller-movies-row': () => Api.fetchPsychologicalThrillers(),
        'cyberpunk-movies-row': () => Api.fetchCyberpunkMovies(),
        'adventure-movies-row': () => Api.fetchAdventureMovies(),
        'animation-movies-row': () => Api.fetchAnimationMovies(),
        'crime-movies-row': () => (view === 'series' ? Api.fetchCrimeSeries() : Api.fetchCrimeMovies()),
        'mystery-movies-row': () => (view === 'series' ? Api.fetchMysterySeries() : Api.fetchMysteryMovies()),
        'romance-movies-row': () => Api.fetchRomanceMovies(),
        'western-movies-row': () => (view === 'series' ? Api.fetchWesternSeries() : Api.fetchWesternMovies()),
        'cult-classics-movies-row': () => Api.fetchCultClassics(),
        'standup-comedy-movies-row': () => Api.fetchStandupComedy(),
        'music-movies-row': () => Api.fetchMusicMovies(),

        // Series Page Specific
        'trending-series-today-row': () => Api.fetchTrendingToday(),
        'top-rated-series-row': () => Api.fetchTopRatedTV(),
        'mini-series-row': () => Api.fetchMiniSeries(),
        'docuseries-series-row': () => Api.fetchDocuseries(),
        'sitcoms-series-row': () => Api.fetchSitcoms(),
        'marvel-series-row': () => Api.fetchMarvelSeries(),
        'dc-series-row': () => Api.fetchDcSeries(),
        'action-adventure-series-row': () => Api.fetchActionAdventureSeries(),
        'scifi-fantasy-series-row': () => Api.fetchSciFiFantasySeries(),
        'drama-series-row': () => Api.fetchDramaSeries(),
        'kids-series-row': () => Api.fetchKidsSeries(),
        'reality-series-row': () => Api.fetchRealitySeries()
    };

    if (staticFetchers[cat.id]) {
        return staticFetchers[cat.id];
    }

    // Fallback: popularity discover by type
    return () => (view === 'series' ? Api.fetchPopularTV() : Api.fetchTrending());
}

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
 * Instantiates the main hero carousel slider, generates shuffled categories, and registers lazy rows.
 * @returns {Promise<void>} Resolves when the home components are loaded.
 */
async function initHome() {
    // 1. Generate dynamic shuffled category configurations (including 4 regional rows)
    const categoryConfigs = regionalCategoryService.generateShuffledPageCategories('home', CATEGORY_CONFIG.home);
    CategoryRenderer.renderRows(document.getElementById('home-rows-container'), categoryConfigs);

    // 2. Load Hero and Recently Watched concurrently for faster initial render
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
        try {
            Splash.signalContentLoaded();
        } catch (splashErr) {
            console.error('Home: Failed to signal splash dismissal:', splashErr);
        }
    }

    // Setup Recently Watched (Verder kijken)
    const rwContainer = document.getElementById('recently-watched-container');
    const rwRow = document.getElementById('recently-watched-row');
    if (recentlyWatched && recentlyWatched.length > 0 && rwRow) {
        if (rwContainer) rwContainer.classList.remove('hidden');
        setupRow('recently-watched-row', recentlyWatched);
    } else {
        if (rwContainer) rwContainer.classList.add('hidden');
    }

    // Build categories for lazy loading
    const categories = categoryConfigs.map(cat => ({
        id: cat.id,
        fetcher: resolveCategoryFetcher(cat, 'home')
    }));

    // Register lazy loaders
    setupLazyLoadedRows(categories);
}

/**
 * Loads popular movies to initialize the movies page.
 * Instantiates the movie hero slider carousel, generates shuffled categories, and registers lazy rows.
 * @returns {Promise<void>} Resolves when the movies components are loaded.
 */
async function initMovies() {
    // 1. Generate dynamic shuffled category configurations (including 4 regional rows)
    const categoryConfigs = regionalCategoryService.generateShuffledPageCategories('movies', CATEGORY_CONFIG.movies);
    CategoryRenderer.renderRows(document.getElementById('movies-rows-container'), categoryConfigs);

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

    // Build categories for lazy loading
    const categories = categoryConfigs.map(cat => ({
        id: cat.id,
        fetcher: resolveCategoryFetcher(cat, 'movies')
    }));

    // Register lazy loaders
    setupLazyLoadedRows(categories, 'movie');
}

/**
 * Loads popular TV series to initialize the series page.
 * Instantiates the TV show hero slider carousel, generates shuffled categories, and registers lazy rows.
 * @returns {Promise<void>} Resolves when the series components are loaded.
 */
async function initSeries() {
    // 1. Generate dynamic shuffled category configurations (including 4 regional rows)
    const categoryConfigs = regionalCategoryService.generateShuffledPageCategories('series', CATEGORY_CONFIG.series);
    CategoryRenderer.renderRows(document.getElementById('series-rows-container'), categoryConfigs);

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

    // Build categories for lazy loading
    const categories = categoryConfigs.map(cat => ({
        id: cat.id,
        fetcher: resolveCategoryFetcher(cat, 'series')
    }));

    // Register lazy loaders
    setupLazyLoadedRows(categories, 'tv');
}
