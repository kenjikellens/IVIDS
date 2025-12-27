import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { HeroSlider } from '../js/hero-slider.js';
import { createLoaderElement } from '../js/loader.js';
import { renderSkeletonRow } from '../js/skeleton-renderer.js';
import { lazyLoader } from '../js/lazy-loader.js';
import { domRecycler } from '../js/dom-recycler.js';

export async function init() {
    try {
        // 1. Fetch Popular (Trending) Movies for Hero
        let popular = [];
        try { popular = await Api.fetchTrending(); } catch (e) { console.error(e); }

        // Filter for movies
        const movies = popular.filter(m => m.media_type === 'movie' || !m.media_type);

        if (movies && movies.length > 0) {
            new HeroSlider(movies.slice(0, 5), {
                containerId: 'hero',
                titleId: 'hero-title',
                descId: 'hero-desc',
                playBtnId: 'play-btn'
            });
            setupRow('popular-movies-row', movies.slice(5));
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
                if (data) setupRow(id, data);
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

function setupRow(elementId, items) {
    const rowPosters = document.getElementById(elementId);
    if (!rowPosters) return;

    // Create container if not already wrapped
    let container = rowPosters.parentElement;
    if (!container.classList.contains('row-container')) {
        container = document.createElement('div');
        container.className = 'row-container';
        rowPosters.parentNode.insertBefore(container, rowPosters);
        container.appendChild(rowPosters);

        // Observe row container for DOM recycling
        domRecycler.observe(container);
    }

    // Get existing skeleton or poster buttons
    const existingButtons = Array.from(rowPosters.querySelectorAll('.poster-wrapper, .skeleton-poster'));

    items.forEach((item, index) => {
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

        // Create loader
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
        img.alt = item.title || item.name;

        btn.appendChild(img);

        // Observe for lazy loading
        lazyLoader.observeItem(btn);
    });

    // Remove any remaining skeletons
    for (let i = items.length; i < existingButtons.length; i++) {
        existingButtons[i].remove();
    }
}

function truncate(str, n) {
    return (str && str.length > n) ? str.substr(0, n - 1) + '...' : str;
}