import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { HeroSlider } from '../js/hero-slider.js';
import { renderSkeletonRow } from '../js/skeleton-renderer.js';
import { lazyLoader } from '../js/lazy-loader.js';
import { setupRow } from '../js/utils/ui-helper.js';

export async function init() {
    try {
        // 1. Fetch Popular Series for Hero
        let popular = [];
        try { popular = await Api.fetchPopularTV(); } catch (e) { console.error(e); }

        if (popular && popular.length > 0) {
            new HeroSlider(popular, {
                containerId: 'hero',
                titleId: 'hero-title',
                descId: 'hero-desc',
                playBtnId: 'play-btn'
            });
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
                if (data) setupRow(id, data, 'tv');
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
// setupRow and truncate removed - imported from ui-helper.js