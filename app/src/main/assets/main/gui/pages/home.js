import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { getRecentlyWatched } from '../../logic/recentlyWatched.js';
import { HeroSlider } from '../js/hero-slider.js';
import { ErrorHandler } from '../js/error-handler.js';
import { createLoaderElement } from '../js/loader.js';
import { renderSkeletonRow } from '../js/skeleton-renderer.js';
import { lazyLoader } from '../js/lazy-loader.js';
import { domRecycler } from '../js/dom-recycler.js';

export async function init() {
    try {
        // 1. Load Hero and Recently Watched immediately
        let recentlyWatched = [];
        try { recentlyWatched = getRecentlyWatched(); } catch (e) { console.error(e); }

        let trending = [];
        try { trending = await Api.fetchTrending(); } catch (e) { console.error('Error fetching trending:', e); }

        // Setup Hero
        if (trending && trending.length > 0) {
            new HeroSlider(trending.slice(0, 5), {
                containerId: 'hero',
                titleId: 'hero-title',
                descId: 'hero-desc',
                playBtnId: 'play-btn'
            });
            // Setup first row immediately without lazy load if we have data
            setupRow('trending-row', trending.slice(5));
        } else {
            console.warn('Home: No trending data available for Hero.');
            // Signal splash to dismiss even if we have no hero content, 
            // otherwise the app gets stuck on the splash screen.
            try {
                // Dynamic import to avoid circular dependency issues if any, 
                // though direct import is at top. Using the imported class.
                const { Splash } = await import('../js/splash.js');
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

function setupRow(elementId, items) {
    try {
        const rowPosters = document.getElementById(elementId);
        if (!rowPosters) {
            console.warn(`Row element ${elementId} not found`);
            return;
        }

        // Get existing skeleton or poster buttons
        const existingButtons = Array.from(rowPosters.querySelectorAll('.poster-wrapper, .skeleton-poster'));

        if (!items || items.length === 0) {
            console.log(`No items for row ${elementId}`);
            // Remove all existing buttons if no items
            existingButtons.forEach(btn => btn.remove());
            return;
        }

        // Create container if not already wrapped (idempotency check)
        try {
            let container = rowPosters.parentElement;
            if (container && !container.classList.contains('row-container')) {
                container = document.createElement('div');
                container.className = 'row-container';
                rowPosters.parentNode.insertBefore(container, rowPosters);
                container.appendChild(rowPosters);

                // Observe container for DOM recycling (pruning off-screen rows)
                domRecycler.observe(container);
            }
        } catch (containerError) {
            console.error('Error creating row container:', containerError);
        }

        items.forEach((item, index) => {
            try {
                if (!item.poster_path) return;

                let btn;
                if (existingButtons[index]) {
                    btn = existingButtons[index];
                    btn.innerHTML = ''; // Clear skeleton loader
                    btn.className = 'poster-wrapper focusable';
                    btn.removeAttribute('aria-hidden');
                } else {
                    btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'poster-wrapper focusable';
                    rowPosters.appendChild(btn);
                }

                // Create loader for the image session
                const loader = createLoaderElement();
                loader.classList.add('poster-loader');
                btn.appendChild(loader);

                const img = document.createElement('img');
                img.className = 'poster';
                img.style.opacity = '0'; // Hide initially
                img.onload = () => {
                    img.style.opacity = '1';
                    if (loader.parentNode) loader.parentNode.removeChild(loader);
                };
                img.onerror = () => {
                    if (loader.parentNode) loader.parentNode.removeChild(loader);
                    img.style.opacity = '1';
                };
                img.dataset.src = Api.getImageUrl(item.poster_path);
                img.alt = item.title || item.name || 'Unknown';

                btn.appendChild(img);

                // Determine type
                let type = item.media_type;
                if (!type) {
                    if (item.title) type = 'movie';
                    else if (item.name) type = 'tv';
                    else type = 'movie';
                }

                btn.onclick = () => {
                    try {
                        Router.loadPage('details', { id: item.id, type: type });
                    } catch (navError) {
                        console.error('Error navigating to details:', navError);
                    }
                };

                // Observe the container for lazy loading the image
                lazyLoader.observeItem(btn);
            } catch (itemError) {
                console.error('Error rendering poster item:', itemError);
            }
        });

        // Remove any remaining skeletons if data count is smaller
        for (let i = items.length; i < existingButtons.length; i++) {
            existingButtons[i].remove();
        }
    } catch (error) {
        console.error(`Error in setupRow for ${elementId}:`, error);
    }
}

function truncate(str, n) {
    try {
        return (str && str.length > n) ? str.substr(0, n - 1) + '...' : str;
    } catch (error) {
        console.error('Error in truncate:', error);
        return str || '';
    }
}