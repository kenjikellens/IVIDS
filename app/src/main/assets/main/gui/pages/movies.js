import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { HeroSlider } from '../js/hero-slider.js';
import { Splash } from '../js/splash.js';
import { renderSkeletonRow } from '../js/skeleton-renderer.js';
import { lazyLoader } from '../js/lazy-loader.js';
import { setupRow } from '../js/utils/ui-helper.js';

export async function init() {
    try {
        // 1. Fetch Popular (Trending) Movies for Hero
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
            Splash.signalContentLoaded();
        }

        // 2. Define Categories
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

        // 3. Render all skeletons immediately
        categories.forEach(cat => renderSkeletonRow(cat.id));

        // 4. Register Lazy Loaders
        categories.forEach(cat => {
            lazyLoader.register(cat.id, async () => {
                return await cat.fetcher();
            }, (id, data) => {
                if (data) setupRow(id, data, 'movie');
                else {
                    const el = document.getElementById(id);
                    if (el) el.innerHTML = '';
                }
            });
        });

    } catch (e) {
        console.error('Error initializing movies page:', e);
    }
}

// Removed setupHero
// setupRow and truncate removed - imported from ui-helper.js