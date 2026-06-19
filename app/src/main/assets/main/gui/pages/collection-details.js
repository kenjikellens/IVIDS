import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { Playlists } from '../../logic/playlists.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { Toast } from '../js/toast.js';

let currentCollection = null;

/**
 * Initializes the collection details page with TMDB api fetched results.
 * @param {Object} params - Route parameters containing the collection ID.
 * @returns {Promise<void>}
 */
export async function init(params) {
    console.log('Initializing Collection Details page', params);

    if (params && params.id) {
        // Register page logic for SpatialNav
        SpatialNav.setPageLogic({
            id: 'collection-details',
            findNext: (current, direction) => {
                if (current.id === 'save-collection-btn' && direction === 'down') {
                    const firstPoster = document.querySelector('#collection-items-container .poster-wrapper.focusable');
                    if (firstPoster) return firstPoster;
                }
                return null;
            }
        });

        await loadCollectionDetails(params.id);
    } else {
        console.error('No collection ID provided to collection-details page');
        Router.loadPage('collections');
    }
}

/**
 * Fetches collection details from TMDB and updates the DOM.
 * @param {string|number} id - Collection ID.
 * @returns {Promise<void>}
 */
async function loadCollectionDetails(id) {
    const titleEl = document.getElementById('collection-title');
    const overviewEl = document.getElementById('collection-overview');
    const countEl = document.getElementById('collection-count');
    const backdropEl = document.getElementById('collection-backdrop');
    const posterEl = document.getElementById('collection-poster');
    const container = document.getElementById('collection-items-container');

    if (!container) return;

    try {
        const data = await Api.getCollectionDetails(id);
        if (!data) {
            throw new Error('No data received for collection details');
        }

        currentCollection = data;

        // Render main texts
        if (titleEl) titleEl.textContent = data.name;
        if (overviewEl) overviewEl.textContent = data.overview || 'No description available for this collection.';
        
        const count = data.parts ? data.parts.length : 0;
        if (countEl) {
            if (window.i18n && window.i18n.translate) {
                countEl.textContent = window.i18n.translate('collections.films', { count }).replace('{count}', count);
            } else {
                countEl.textContent = count === 1 ? '1 film' : `${count} films`;
            }
        }

        // Render backdrop image
        if (backdropEl) {
            if (data.backdrop_path) {
                const backdropUrl = Api.getImageUrl(data.backdrop_path, Api.getRecommendedBackdropSize());
                backdropEl.innerHTML = `
                    <img src="${backdropUrl}" alt="${data.name} Backdrop">
                    <div class="backdrop-overlay"></div>
                `;
            } else {
                backdropEl.innerHTML = `<div class="backdrop-overlay" style="background-color:#111;"></div>`;
            }
        }

        // Render poster image
        if (posterEl) {
            if (data.poster_path) {
                posterEl.src = Api.getImageUrl(data.poster_path, 'w500');
                posterEl.style.display = 'block';
            } else {
                posterEl.style.display = 'none';
            }
        }

        // Render movie parts
        container.innerHTML = '';
        if (data.parts && data.parts.length > 0) {
            // Sort by release date to present in chronological franchise order
            const sortedParts = [...data.parts].sort((a, b) => {
                const dateA = a.release_date || '';
                const dateB = b.release_date || '';
                return dateA.localeCompare(dateB);
            });

            sortedParts.forEach(item => {
                const wrapper = document.createElement('div');
                wrapper.className = 'poster-wrapper focusable';
                wrapper.dataset.id = item.id;
                wrapper.dataset.type = 'movie';

                const imageUrl = Api.getImageUrl(item.poster_path || item.backdrop_path, 'w342');

                wrapper.innerHTML = `
                    <img class="poster" src="${imageUrl}" loading="lazy" decoding="async" alt="${item.title || item.name}">
                `;

                wrapper.onclick = (e) => {
                    e.stopPropagation();
                    Router.loadPage('details', { id: item.id, type: 'movie' });
                };

                container.appendChild(wrapper);
            });
        } else {
            container.innerHTML = `<div class="empty-state">No movies found in this collection.</div>`;
        }

        setupButtonListeners();

        // Apply translations
        if (window.i18n) window.i18n.applyTranslations();

        // Focus first element
        setTimeout(() => {
            SpatialNav.focusFirst();
        }, 100);

    } catch (error) {
        console.error('Error loading collection details:', error);
        Router.loadPage('collections');
    }
}

/**
 * Binds click events to Save and Back actions.
 */
function setupButtonListeners() {
    const saveBtn = document.getElementById('save-collection-btn');
    const backBtn = document.getElementById('collection-back-btn');

    const handleLeftNav = (e) => {
        if (e.key === 'ArrowLeft' || e.keyCode === 37) {
            e.preventDefault();
            e.stopPropagation();
            const sidebarLink = document.querySelector('#sidebar-container .nav-item.active') ||
                document.querySelector('#sidebar-container .nav-item');
            if (sidebarLink) {
                SpatialNav.setFocus(sidebarLink);
            }
        }
    };

    if (saveBtn) {
        saveBtn.onclick = () => {
            if (!currentCollection) return;

            // Check if playlist already exists
            const existingPlaylists = Playlists.getPlaylists();
            const exists = existingPlaylists.some(p => p.name === currentCollection.name);

            if (exists) {
                const msg = window.i18n && window.i18n.translate ? window.i18n.translate('collections.alreadySaved') : 'This collection is already saved';
                Toast.show(msg, { type: 'warning' });
                return;
            }

            // Create new playlist with collection name
            const playlist = Playlists.createPlaylist(currentCollection.name);
            if (playlist) {
                // Add all movies of the collection to the playlist
                if (currentCollection.parts) {
                    currentCollection.parts.forEach(movie => {
                        // Inject media_type so the playlist service understands it
                        Playlists.addToPlaylist(playlist.id, {
                            ...movie,
                            media_type: 'movie'
                        });
                    });
                }

                const msg = window.i18n && window.i18n.translate ? window.i18n.translate('collections.savedSuccess') : 'Collection saved as playlist!';
                Toast.show(msg, { type: 'success' });
            }
        };

        saveBtn.addEventListener('keydown', handleLeftNav);
    }

    if (backBtn) {
        backBtn.onclick = () => {
            Router.goBack('collections');
        };
        backBtn.addEventListener('keydown', handleLeftNav);
    }
}
