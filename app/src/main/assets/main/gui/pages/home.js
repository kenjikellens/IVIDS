import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { getRecentlyWatched } from '../../logic/recentlyWatched.js';
import { HeroSlider } from '../js/hero-slider.js';
import { ErrorHandler } from '../js/error-handler.js';
import { renderSkeletonRow } from '../js/skeleton-renderer.js';
import { lazyLoader } from '../js/lazy-loader.js';
import { setupRow } from '../js/utils/ui-helper.js';

/**
 * Initializes the Home page by loading trending items and recently watched history,
 * setting up the Hero Slider with all trending items, and lazy loading other movie/TV rows.
 */
export async function init() {
    try {
        // 1. Load Hero and Recently Watched concurrently for faster initial render
        const [trendingResult, recentResult] = await Promise.allSettled([
            Api.fetchTrending(),
            Promise.resolve().then(() => { try { return getRecentlyWatched(); } catch (e) { return []; } })
        ]);

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
            // Signal splash to dismiss even if we have no hero content, 
            // otherwise the app gets stuck on the splash screen.
            try {
                Splash.signalContentLoaded();
            } catch (splashErr) {
                console.error('Home: Failed to signal splash dismissal:', splashErr);
            }
        }

        // Setup Recently Watched
        if (recentlyWatched && recentlyWatched.length > 0) {
            setupRow('recently-watched-row', recentlyWatched);
        } else {
            const el = document.getElementById('recently-watched-row');
            if (el && el.parentElement) el.parentElement.style.display = 'none';
        }

        // 2. Define Lazy Load Configuration
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

        // 3. Render all skeletons immediately so they are focusable
        categories.forEach(cat => renderSkeletonRow(cat.id));

        // 4. Initialize Skeletons and Register Lazy Loaders
        categories.forEach(cat => {
            // Register lazy loader with a wrapper fetcher
            lazyLoader.register(cat.id, async () => {
                // Fetch data
                return await cat.fetcher();
            }, (id, data) => {
                // Render actual content
                if (data && data.length > 0) {
                    setupRow(id, data);
                } else {
                    // Handle empty data: clear skeleton
                    const el = document.getElementById(id);
                    if (el) el.innerHTML = '';
                }
            });
        });

    } catch (error) {
        console.error('Critical error in home.init:', error);
        ErrorHandler.show('Failed to initialize home page.', () => init());
    }
}

// Removed setupHero as it is replaced by HeroSlider
// setupRow and truncate removed - imported from ui-helper.js