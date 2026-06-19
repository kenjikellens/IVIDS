import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { HeroSlider } from '../js/hero-slider.js';
import { setupLazyLoadedRows } from '../js/utils/ui-helper.js';

/**
 * Initializes the Series page by loading popular series for the Hero Slider
 * and setting up lazy loaded TV show rows for each category.
 */
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
            { id: 'popular-collections-series-row', fetcher: () => Api.fetchPopularCollections(), type: 'collection' },
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

        // 3. Render all skeletons immediately and register lazy loaders
        setupLazyLoadedRows(categories, 'tv');

    } catch (e) {
        console.error('Error initializing series page:', e);
    }
}

// Removed setupHero
// setupRow and truncate removed - imported from ui-helper.js