import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { HeroSlider } from '../js/hero-slider.js';
import { createLoaderElement } from '../js/loader.js';
import { renderSkeletonRow } from '../js/skeleton-renderer.js';
import { LazyLoader } from '../js/lazy-loader.js';

export async function init() {
    try {
        const lazyLoader = new LazyLoader();

        // 1. Fetch Popular Series for Hero
        let popular = [];
        try { popular = await Api.fetchPopularTV(); } catch (e) { console.error(e); }

        if (popular && popular.length > 0) {
            new HeroSlider(popular.slice(0, 5), {
                containerId: 'hero-series',
                titleId: 'hero-title-series',
                descId: 'hero-desc-series',
                playBtnId: 'play-btn-series'
            });
            setupRow('popular-series-row', popular.slice(5));
        }

        // 2. Define Categories
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
        console.error('Error initializing series page:', e);
    }
}

// Removed setupHero

function setupRow(elementId, items) {
    const rowPosters = document.getElementById(elementId);
    if (!rowPosters) return;
    // rowPosters.innerHTML = ''; // Removed to allow reuse of elements

    // Create container if not already wrapped
    let container = rowPosters.parentElement;
    if (!container.classList.contains('row-container')) {
        container = document.createElement('div');
        container.className = 'row-container';
        rowPosters.parentNode.insertBefore(container, rowPosters);
        container.appendChild(rowPosters);
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
        img.src = Api.getImageUrl(item.poster_path);
        img.alt = item.title || item.name;

        btn.onclick = () => Router.loadPage('details', { id: item.id, type: 'tv' });

        btn.appendChild(img);
    });

    // Remove any remaining skeletons
    for (let i = items.length; i < existingButtons.length; i++) {
        existingButtons[i].remove();
    }
}

function truncate(str, n) {
    return (str && str.length > n) ? str.substr(0, n - 1) + '...' : str;
}