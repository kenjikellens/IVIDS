import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { getRecentlyWatched } from '../../logic/recentlyWatched.js';
import { HeroSlider } from '../js/hero-slider.js';

export async function init() {
    try {
        // Load recently watched from localStorage
        let recentlyWatched = [];
        try {
            recentlyWatched = getRecentlyWatched();
        } catch (watchedError) {
            console.error('Error loading recently watched:', watchedError);
        }

        // Initialize all content arrays
        let trending = [], topRated = [], action = [], comedy = [], tv = [];
        let anime = [], disney = [], marvel = [], pixar = [], ghibli = [], netflix = [];
        let highlyRated = [], newThisYear = [], classics = [], bollywood = [], korean = [];
        let awardWinners = [], comedySeries = [];
        let horror = [], scifi = [], thriller = [], romance = [];
        let family = [], documentary = [], crime = [], fantasy = [];

        try {
            [
                trending, topRated, action, comedy, tv,
                anime, disney, marvel, pixar, ghibli, netflix,
                highlyRated, newThisYear, classics, bollywood, korean, awardWinners, comedySeries,
                horror, scifi, thriller, romance, family, documentary, crime, fantasy
            ] = await Promise.all([
                Api.fetchTrending().catch(err => { console.error('Error fetching trending:', err); return []; }),
                Api.fetchTopRated().catch(err => { console.error('Error fetching top rated:', err); return []; }),
                Api.fetchActionMovies().catch(err => { console.error('Error fetching action:', err); return []; }),
                Api.fetchComedyMovies().catch(err => { console.error('Error fetching comedy:', err); return []; }),
                Api.fetchPopularTV().catch(err => { console.error('Error fetching TV:', err); return []; }),
                Api.fetchAnimeMovies().catch(err => { console.error('Error fetching anime:', err); return []; }),
                Api.fetchDisneyMovies().catch(err => { console.error('Error fetching Disney:', err); return []; }),
                Api.fetchMarvelMovies().catch(err => { console.error('Error fetching Marvel:', err); return []; }),
                Api.fetchPixarMovies().catch(err => { console.error('Error fetching Pixar:', err); return []; }),
                Api.fetchStudioGhibli().catch(err => { console.error('Error fetching Ghibli:', err); return []; }),
                Api.fetchNetflixOriginals().catch(err => { console.error('Error fetching Netflix:', err); return []; }),
                Api.fetchHighlyRated().catch(err => { console.error('Error fetching highly rated:', err); return []; }),
                Api.fetchNewThisYear().catch(err => { console.error('Error fetching new this year:', err); return []; }),
                Api.fetchClassicMovies().catch(err => { console.error('Error fetching classics:', err); return []; }),
                Api.fetchBollywood().catch(err => { console.error('Error fetching Bollywood:', err); return []; }),
                Api.fetchKoreanContent().catch(err => { console.error('Error fetching Korean:', err); return []; }),
                Api.fetchAwardWinners().catch(err => { console.error('Error fetching award winners:', err); return []; }),
                Api.fetchComedySeries().catch(err => { console.error('Error fetching comedy series:', err); return []; }),
                Api.fetchHorrorMovies().catch(err => { console.error('Error fetching horror:', err); return []; }),
                Api.fetchSciFiMovies().catch(err => { console.error('Error fetching sci-fi:', err); return []; }),
                Api.fetchThrillerMovies().catch(err => { console.error('Error fetching thriller:', err); return []; }),
                Api.fetchRomanceMovies().catch(err => { console.error('Error fetching romance:', err); return []; }),
                Api.fetchFamilyMovies().catch(err => { console.error('Error fetching family:', err); return []; }),
                Api.fetchDocumentaryMovies().catch(err => { console.error('Error fetching documentary:', err); return []; }),
                Api.fetchCrimeMovies().catch(err => { console.error('Error fetching crime:', err); return []; }),
                Api.fetchFantasyMovies().catch(err => { console.error('Error fetching fantasy:', err); return []; })
            ]);
        } catch (apiError) {
            console.error('Critical error fetching content:', apiError);
            alert('Failed to load some content. API may be unavailable.');
        }

        // Setup hero slider with trending content
        if (trending && trending.length > 0) {
            try {
                new HeroSlider(trending.slice(0, 5), {
                    containerId: 'hero',
                    titleId: 'hero-title',
                    descId: 'hero-desc',
                    playBtnId: 'hero-play',
                    detailsBtnId: 'hero-details'
                });
                setupRow('trending-row', trending.slice(5));
            } catch (heroError) {
                console.error('Error setting up hero:', heroError);
            }
        }

        // Setup recently watched row if there are items
        if (recentlyWatched && recentlyWatched.length > 0) {
            try {
                setupRow('recently-watched-row', recentlyWatched);
            } catch (watchedRowError) {
                console.error('Error setting up recently watched row:', watchedRowError);
            }
        } else {
            // Hide the row if no recently watched items
            try {
                const recentlyWatchedRow = document.getElementById('recently-watched-row');
                if (recentlyWatchedRow && recentlyWatchedRow.parentElement) {
                    recentlyWatchedRow.parentElement.style.display = 'none';
                }
            } catch (hideError) {
                console.error('Error hiding recently watched row:', hideError);
            }
        }

        // Setup all category rows with error handling
        try { if (highlyRated) setupRow('highly-rated-row', highlyRated); } catch (e) { console.error('Error rendering highly rated:', e); }
        try { if (newThisYear) setupRow('new-this-year-row', newThisYear); } catch (e) { console.error('Error rendering new this year:', e); }
        try { if (awardWinners) setupRow('award-winners-row', awardWinners); } catch (e) { console.error('Error rendering award winners:', e); }
        try { if (topRated) setupRow('top-rated-row', topRated); } catch (e) { console.error('Error rendering top rated:', e); }
        try { if (action) setupRow('action-row', action); } catch (e) { console.error('Error rendering action:', e); }
        try { if (comedy) setupRow('comedy-row', comedy); } catch (e) { console.error('Error rendering comedy:', e); }
        try { if (tv) setupRow('tv-row', tv); } catch (e) { console.error('Error rendering TV:', e); }
        try { if (comedySeries) setupRow('comedy-series-row', comedySeries); } catch (e) { console.error('Error rendering comedy series:', e); }
        try { if (anime) setupRow('anime-row', anime); } catch (e) { console.error('Error rendering anime:', e); }
        try { if (disney) setupRow('disney-row', disney); } catch (e) { console.error('Error rendering Disney:', e); }
        try { if (marvel) setupRow('marvel-row', marvel); } catch (e) { console.error('Error rendering Marvel:', e); }
        try { if (pixar) setupRow('pixar-row', pixar); } catch (e) { console.error('Error rendering Pixar:', e); }
        try { if (ghibli) setupRow('ghibli-row', ghibli); } catch (e) { console.error('Error rendering Ghibli:', e); }
        try { if (netflix) setupRow('netflix-row', netflix); } catch (e) { console.error('Error rendering Netflix:', e); }
        try { if (korean) setupRow('korean-row', korean); } catch (e) { console.error('Error rendering Korean:', e); }
        try { if (bollywood) setupRow('bollywood-row', bollywood); } catch (e) { console.error('Error rendering Bollywood:', e); }
        try { if (classics) setupRow('classics-row', classics); } catch (e) { console.error('Error rendering classics:', e); }
        try { if (horror) setupRow('horror-row', horror); } catch (e) { console.error('Error rendering horror:', e); }
        try { if (scifi) setupRow('scifi-row', scifi); } catch (e) { console.error('Error rendering sci-fi:', e); }
        try { if (thriller) setupRow('thriller-row', thriller); } catch (e) { console.error('Error rendering thriller:', e); }
        try { if (romance) setupRow('romance-row', romance); } catch (e) { console.error('Error rendering romance:', e); }
        try { if (family) setupRow('family-row', family); } catch (e) { console.error('Error rendering family:', e); }
        try { if (documentary) setupRow('documentary-row', documentary); } catch (e) { console.error('Error rendering documentary:', e); }
        try { if (crime) setupRow('crime-row', crime); } catch (e) { console.error('Error rendering crime:', e); }
        try { if (fantasy) setupRow('fantasy-row', fantasy); } catch (e) { console.error('Error rendering fantasy:', e); }
    } catch (error) {
        console.error('Critical error in home.init:', error);
        alert('Failed to initialize home page. Some content may not be available.');
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

        rowPosters.innerHTML = '';

        if (!items || items.length === 0) {
            console.log(`No items for row ${elementId}`);
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
            }
        } catch (containerError) {
            console.error('Error creating row container:', containerError);
        }

        items.forEach(item => {
            try {
                if (!item.poster_path) return;

                // Create wrapper for poster to support overlay
                const wrapper = document.createElement('div');
                wrapper.className = 'poster-wrapper';

                const img = document.createElement('img');
                img.className = 'poster focusable';
                img.src = Api.getImageUrl(item.poster_path);
                img.alt = item.title || item.name || 'Unknown';

                // Determine type if not present
                let type = item.media_type;
                if (!type) {
                    if (item.title) type = 'movie';
                    else if (item.name) type = 'tv';
                    else type = 'movie'; // Default
                }

                img.onclick = () => {
                    try {
                        Router.loadPage('details', { id: item.id, type: type });
                    } catch (navError) {
                        console.error('Error navigating to details:', navError);
                    }
                };

                wrapper.appendChild(img);

                // Add overlay if series with episode info
                if (item.season !== undefined && item.episode !== undefined) {
                    try {
                        const overlay = document.createElement('div');
                        overlay.className = 'poster-overlay';
                        overlay.textContent = `S${item.season} E${item.episode}`;
                        wrapper.appendChild(overlay);
                    } catch (overlayError) {
                        console.error('Error creating overlay:', overlayError);
                    }
                }

                rowPosters.appendChild(wrapper);
            } catch (itemError) {
                console.error('Error rendering poster item:', itemError);
            }
        });
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