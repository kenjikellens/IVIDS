import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { Playlists } from '../../logic/playlists.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { getWatchedItem } from '../../logic/recentlyWatched.js';
import I18n from '../js/i18n.js';
import { getLoaderHtml } from '../js/loader.js';
import { ErrorHandler } from '../js/error-handler.js';

let currentSeriesId = null;

/**
 * Initializes the details page by fetching content metadata.
 * Renders the UI and sets up season selection and remote control focus.
 */
export async function init(params) {
    try {
        if (!params || !params.id) {
            console.error('No ID provided for details page');
            Router.loadPage('home');
            return;
        }

        currentSeriesId = params.id;

        // Fetch details from the API.
        let details = null;
        try {
            details = await Api.getDetails(params.id, params.type);
        } catch (detailsError) {
            console.error('Error fetching details from API:', detailsError);
        }

        // Fallback for mock data if API key is missing and getDetails returns null/mock
        if (!details && Api.getApiKey().includes('TODO')) {
            try {
                const mock = Api.getMockData().find(m => m.id == params.id);
                if (mock) details = mock;
            } catch (mockError) {
                console.error('Error fetching mock data:', mockError);
            }
        }

        if (details) {
            render(details, params.type);

            // Focus on the Play button for remote control navigation
            try {
                setTimeout(() => {
                    const playBtn = document.getElementById('details-play');
                    if (playBtn) {
                        SpatialNav.setFocus(playBtn);
                    }
                }, 150);
            } catch (focusError) {
                console.error('Error setting focus:', focusError);
            }

        } else {
            console.error('No details available for this item');
            ErrorHandler.show('Failed to load details. Please try again.', () => init(params));
        }
    } catch (error) {
        console.error('Critical error in details.init:', error);
        ErrorHandler.show('An error occurred while loading the page.');
    }
}

/**
 * Renders the details page content, setting up metadata, backdrop image, buttons, and tabs.
 * Updates the details DOM elements and checks recently watched history.
 * @param {Object} item - The details metadata object of the content.
 * @param {string} type - The media type ('movie' or 'tv').
 */
function render(item, type) {
    try {
        const bg = document.getElementById('details-backdrop');
        const title = document.getElementById('details-title');
        const date = document.getElementById('details-date');
        const overview = document.getElementById('details-overview');
        const playBtn = document.getElementById('details-play');
        const trailerBtn = document.getElementById('details-trailer');
        const playlistBtn = document.getElementById('details-playlist');

        // Check for critical DOM elements
        if (!title || !playBtn) {
            console.error('Critical DOM elements missing');
            return;
        }

        title.textContent = item.title || item.name || I18n.t('details.unknownTitle');

        // Render Genres
        const genresContainer = document.getElementById('details-genres');
        if (genresContainer) {
            try {
                genresContainer.innerHTML = '';
                if (item.genres && item.genres.length > 0) {
                    item.genres.forEach(genre => {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'genre-chip focusable';
                        btn.textContent = genre.name || '';
                        btn.onclick = () => {
                            Router.loadPage('search', { genreId: genre.id, type: type });
                        };
                        genresContainer.appendChild(btn);
                    });
                }
            } catch (genreError) {
                console.error('Error rendering genres:', genreError);
            }
        }

        // Render Date in Box
        if (date) {
            try {
                const year = (item.release_date || item.first_air_date || '').substring(0, 4);
                date.innerHTML = year ? `<span class="date-box">${year}</span>` : '';
            } catch (dateError) {
                console.error('Error rendering date:', dateError);
            }
        }

        // Render Rating
        const ratingEl = document.getElementById('details-rating');
        if (ratingEl) {
            try {
                const rating = getRating(item, type);
                if (rating) {
                    const isAdult = rating === 'R' || rating === 'TV-MA' || rating === 'NC-17';
                    const ratingClass = isAdult ? 'rating-chip rating-R' : 'rating-chip';
                    ratingEl.innerHTML = `<span class="${ratingClass}">${rating}</span>`;
                } else {
                    ratingEl.innerHTML = '';
                }
            } catch (ratingError) {
                console.error('Error rendering rating:', ratingError);
            }
        }

        if (overview) {
            overview.textContent = item.overview || I18n.t('details.noDescription');
        }

        if (bg && item.backdrop_path) {
            const width = bg.clientWidth;
            const sizeKey = Api.getRecommendedSizeForContainer(width, true);
            const backdropUrl = Api.getImageUrl(item.backdrop_path, sizeKey);
            bg.style.backgroundImage = `url(${backdropUrl})`;
            bg.style.willChange = 'background-image';
        }

        const poster = document.getElementById('details-poster');
        if (poster && item.poster_path) {
            try {
                const width = poster.parentElement ? poster.parentElement.clientWidth : 0;
                const sizeKey = Api.getRecommendedSizeForContainer(width, false);
                poster.src = Api.getImageUrl(item.poster_path, sizeKey);
                poster.style.willChange = 'transform';
            } catch (pError) {
                console.error('Error setting poster image:', pError);
            }
        }

        // Check watch history for resume functionality
        try {
            const watchedItem = getWatchedItem(item.id, type);

            if (watchedItem && watchedItem.season !== undefined && watchedItem.episode !== undefined) {
                // Update button text to show Resume for series
                playBtn.textContent = `${I18n.t('details.resume')} S${watchedItem.season}:E${watchedItem.episode}`;
                playBtn.onclick = () => Router.loadPage('player', {
                    id: item.id,
                    type: type,
                    season: watchedItem.season,
                    episode: watchedItem.episode
                });
            } else {
                playBtn.textContent = I18n.t('details.play');
                playBtn.onclick = () => {
                    if (type === 'tv') {
                        Router.loadPage('player', { id: item.id, type: type, season: 1, episode: 1 });
                    } else {
                        Router.loadPage('player', { id: item.id, type: type });
                    }
                };
            }
        } catch (watchError) {
            console.error('Error checking watch history:', watchError);
            // Fallback to normal play button
            playBtn.textContent = I18n.t('details.play');
            playBtn.onclick = () => {
                if (type === 'tv') {
                    Router.loadPage('player', { id: item.id, type: type, season: 1, episode: 1 });
                } else {
                    Router.loadPage('player', { id: item.id, type: type });
                }
            };
        }

        // Watch Trailer Button Logic
        let mainTrailerKey = null;
        if (item.videos?.results) {
            const trailer = item.videos.results.find(v => v.site.toLowerCase() === 'youtube' && v.type.toLowerCase() === 'trailer');
            const fallback = item.videos.results.find(v => v.site.toLowerCase() === 'youtube' && (v.type.toLowerCase() === 'teaser' || v.type.toLowerCase() === 'clip'));
            mainTrailerKey = trailer ? trailer.key : (fallback ? fallback.key : null);
        }

        if (trailerBtn) {
            if (mainTrailerKey) {
                trailerBtn.style.display = 'inline-flex';
                const trailerObj = item.videos.results.find(v => v.key === mainTrailerKey);
                const trailerName = trailerObj ? ` (${trailerObj.name})` : '';
                trailerBtn.textContent = `${I18n.t('details.watchTrailer')}${trailerName}`;
                trailerBtn.onclick = () => Router.loadPage('player', { id: item.id, type: 'trailer', ytKey: mainTrailerKey, mediaType: type });
            } else {
                trailerBtn.style.display = 'none';
            }
        }

        // Playlist Button Logic
        if (playlistBtn) {
            playlistBtn.onclick = () => {
                try {
                    openPlaylistModal(item, type);
                } catch (modalError) {
                    console.error('Error opening playlist modal:', modalError);
                    ErrorHandler.show('Failed to open playlist. Please try again.');
                }
            };
        }

        // Render Tab Panels Data
        renderExtras(item.videos, item.id, type);
        renderAbout(item.overview, item.credits);

        // Bind tab buttons click events
        const tabSeasons = document.getElementById('tab-seasons');
        const tabExtra = document.getElementById('tab-extra');
        const tabAbout = document.getElementById('tab-about');
        if (tabSeasons) tabSeasons.onclick = () => switchTab('seasons');
        if (tabExtra) tabExtra.onclick = () => switchTab('extra');
        if (tabAbout) tabAbout.onclick = () => switchTab('about');

        // Toggle Seasons tab based on content type
        if (tabSeasons) {
            if (type === 'tv' && item.seasons) {
                tabSeasons.style.display = 'inline-block';
                renderSeasons(item.seasons, item.id);
                switchTab('seasons');
            } else {
                tabSeasons.style.display = 'none';
                switchTab('extra');
            }
        }

    } catch (error) {
        console.error('Error in render function:', error);
        ErrorHandler.show('Failed to render details. Some information may be missing.');
    }
}

/**
 * Gets the release rating certification (e.g. PG-13, TV-MA).
 * Returns rating key or empty string.
 * @param {Object} item - Media details metadata.
 * @param {string} type - Media type ('movie' or 'tv').
 * @returns {string} Rating string.
 */
function getRating(item, type) {
    try {
        if (type === 'movie' && item.release_dates && item.release_dates.results) {
            const usRelease = item.release_dates.results.find(r => r.iso_3166_1 === 'US');
            if (usRelease && usRelease.release_dates) {
                const cert = usRelease.release_dates.find(d => d.certification);
                return cert ? cert.certification : '';
            }
        } else if (type === 'tv' && item.content_ratings && item.content_ratings.results) {
            const usRating = item.content_ratings.results.find(r => r.iso_3166_1 === 'US');
            return usRating ? usRating.rating : '';
        }
    } catch (e) {
        console.error('Error extracting rating:', e);
    }
    return '';
}

/**
 * Handles opening and populating the Playlist selection modal list.
 * Updates the modal layout and binds item addition click events.
 * @param {Object} item - Media details metadata.
 * @param {string} type - Media type ('movie' or 'tv').
 */
function openPlaylistModal(item, type) {
    try {
        const modal = document.getElementById('add-to-playlist-modal');
        const listContainer = document.getElementById('playlist-selection-list');
        const cancelBtn = document.getElementById('add-to-playlist-cancel');

        if (!modal || !listContainer) {
            console.error('Playlist modal elements not found');
            ErrorHandler.show('Playlist feature is not available.');
            return;
        }

        modal.style.display = 'flex';
        listContainer.innerHTML = '';

        let playlists = [];
        try {
            playlists = Playlists.getPlaylists();
        } catch (playlistError) {
            console.error('Error fetching playlists:', playlistError);
            listContainer.innerHTML = '<p style="color: #f44; text-align: center;">Error loading playlists.</p>';
            return;
        }

        if (playlists.length === 0) {
            listContainer.innerHTML = '<p style="color: #aaa; text-align: center;">No playlists found. Create one in the Playlists page.</p>';
        } else {
            playlists.forEach(playlist => {
                try {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'btn btn-secondary focusable';
                    btn.textContent = playlist.name || I18n.t('details.unnamedPlaylist');

                    const exists = playlist.items && playlist.items.some(i => i.id === item.id && i.media_type === type);
                    if (exists) {
                        btn.textContent += ` (${I18n.t('details.added', 'Added')})`;
                        btn.classList.add('btn-added');
                    }

                    btn.onclick = () => {
                        try {
                            if (!exists) {
                                const itemToAdd = {
                                    id: item.id,
                                    title: item.title,
                                    name: item.name,
                                    poster_path: item.poster_path,
                                    backdrop_path: item.backdrop_path,
                                    media_type: type,
                                    overview: item.overview
                                };

                                Playlists.addToPlaylist(playlist.id, itemToAdd);
                                ErrorHandler.show(`${I18n.t('details.addedToPlaylist')} ${playlist.name}`, null, 'Success');
                                modal.style.display = 'none';
                            } else {
                                ErrorHandler.show(I18n.t('details.alreadyInPlaylist'));
                            }
                        } catch (addError) {
                            console.error('Error adding to playlist:', addError);
                            ErrorHandler.show(I18n.t('details.failedToAdd'));
                        }
                    };

                    listContainer.appendChild(btn);
                } catch (itemError) {
                    console.error('Error rendering playlist item:', itemError);
                }
            });
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => {
                modal.style.display = 'none';
            };
        }
    } catch (error) {
        console.error('Error in openPlaylistModal:', error);
        ErrorHandler.show('Failed to open playlist modal.');
    }
}

/**
 * Renders the seasons button list and dropdown select element for layout modes.
 * Populates desktop buttons and mobile select tags with seasonal episode lists.
 * @param {Array} seasons - List of season metadata objects.
 * @param {number|string} seriesId - TMDB Series ID.
 */
function renderSeasons(seasons, seriesId) {
    try {
        const container = document.getElementById('seasons-list');
        if (!container) {
            console.error('Seasons list container not found');
            return;
        }

        container.innerHTML = '';

        const dropdown = document.getElementById('seasons-dropdown');
        if (dropdown) {
            dropdown.innerHTML = '';
        }

        if (!seasons || seasons.length === 0) {
            container.innerHTML = `<p style="color: #aaa;">${I18n.t('details.noSeasons')}</p>`;
            return;
        }

        // Sort by season number
        try {
            seasons.sort((a, b) => (a.season_number || 0) - (b.season_number || 0));
        } catch (sortError) {
            console.error('Error sorting seasons:', sortError);
        }

        seasons.forEach(season => {
            try {
                const btn = document.createElement('button');
                btn.className = 'btn btn-secondary season-btn focusable';
                btn.textContent = season.name || `${I18n.t('details.season')} ${season.season_number || '?'}`; // e.g. "Season 1"
                btn.dataset.seasonNumber = season.season_number || 0;

                btn.onclick = () => {
                    try {
                        container.querySelectorAll('.season-btn').forEach(b => {
                            b.classList.remove('btn-primary');
                            b.classList.add('btn-secondary');
                        });
                        btn.classList.remove('btn-secondary');
                        btn.classList.add('btn-primary');

                        if (dropdown) {
                            dropdown.value = season.season_number || 0;
                        }

                        loadSeasonEpisodes(seriesId, season.season_number);
                    } catch (clickError) {
                        console.error('Error handling season click:', clickError);
                    }
                };

                container.appendChild(btn);

                if (dropdown) {
                    const opt = document.createElement('option');
                    opt.value = season.season_number || 0;
                    opt.textContent = season.name || `${I18n.t('details.season')} ${season.season_number || '?'}`;
                    dropdown.appendChild(opt);
                }
            } catch (btnError) {
                console.error('Error creating season button:', btnError);
            }
        });

        if (dropdown) {
            dropdown.onchange = (e) => {
                const selectedVal = parseInt(e.target.value);
                container.querySelectorAll('.season-btn').forEach(b => {
                    if (parseInt(b.dataset.seasonNumber) === selectedVal) {
                        b.classList.remove('btn-secondary');
                        b.classList.add('btn-primary');
                    } else {
                        b.classList.remove('btn-primary');
                        b.classList.add('btn-secondary');
                    }
                });
                loadSeasonEpisodes(seriesId, selectedVal);
            };
        }

        // Set first one active initially if it exists and load its episodes
        try {
            const firstBtn = container.querySelector('.season-btn[data-season-number="1"]') || container.querySelector('.season-btn');
            if (firstBtn) {
                firstBtn.classList.remove('btn-secondary');
                firstBtn.classList.add('btn-primary');

                const selectedVal = parseInt(firstBtn.dataset.seasonNumber);
                if (dropdown) {
                    dropdown.value = selectedVal;
                }
                loadSeasonEpisodes(seriesId, selectedVal);
            }
        } catch (activateError) {
            console.error('Error activating first season:', activateError);
        }
    } catch (error) {
        console.error('Error in renderSeasons:', error);
    }
}

/**
 * Fetches episodes metadata for a specific season from TMDb and triggers rendering.
 * Affects the display of episodes inside the seasons tab panel.
 * @param {number|string} seriesId - The TMDB Series ID.
 * @param {number} seasonNumber - The season number.
 */
async function loadSeasonEpisodes(seriesId, seasonNumber) {
    try {
        const container = document.getElementById('details-episodes');
        if (!container) {
            console.error('Episodes container not found');
            return;
        }

        container.innerHTML = `<div class="loader-center-container">${getLoaderHtml()}</div>`;

        let seasonDetails = null;
        try {
            seasonDetails = await Api.getSeasonDetails(seriesId, seasonNumber);
        } catch (apiError) {
            console.error('Error fetching season details:', apiError);
            container.innerHTML = `<div style="text-align:center; color:#f44;">Failed to load episodes. Please try again.</div>`;
            return;
        }

        if (seasonDetails && seasonDetails.episodes) {
            renderEpisodes(seasonDetails.episodes, seriesId, seasonNumber);
        } else {
            container.innerHTML = `<div style="text-align:center; color:#aaa;">${I18n.t('details.noEpisodes')}</div>`;
        }
    } catch (error) {
        console.error('Error in loadSeasonEpisodes:', error);
        const container = document.getElementById('details-episodes');
        if (container) {
            container.innerHTML = '<div style="text-align:center; color:#f44;">An error occurred while loading episodes.</div>';
        }
    }
}

/**
 * Renders the episodes vertical list for TV shows.
 * Updates the episodes container inside the seasons tab panel.
 * @param {Array} episodes - List of episode metadata objects.
 * @param {number|string} seriesId - TMDB Series ID.
 * @param {number} seasonNumber - Season number.
 */
function renderEpisodes(episodes, seriesId, seasonNumber) {
    try {
        const container = document.getElementById('details-episodes');
        if (!container) {
            console.error('Episodes container not found');
            return;
        }

        container.innerHTML = '';

        if (!episodes || episodes.length === 0) {
            container.innerHTML = `<div style="text-align:center; color:#aaa;">${I18n.t('details.noEpisodes')}</div>`;
            return;
        }

        // Get watch history to mark watched episode
        let watchedItem = null;
        try {
            watchedItem = getWatchedItem(seriesId, 'tv');
        } catch (watchError) {
            console.error('Error getting watch history:', watchError);
        }

        episodes.forEach(episode => {
            try {
                const el = document.createElement('div');
                el.className = 'disney-episode-item focusable';
                el.tabIndex = 0; // Make focusable

                // Check if this episode was watched
                if (watchedItem && watchedItem.season === seasonNumber && watchedItem.episode === episode.episode_number) {
                    el.classList.add('watched');
                }

                const episodeNumber = episode.episode_number || '?';
                const episodeName = episode.name || I18n.t('details.untitled');
                const episodeOverview = episode.overview || I18n.t('details.noDescription');
                const stillPath = episode.still_path ? Api.getImageUrl(episode.still_path, Api.STILL_SIZE) : '';
                const bgImage = stillPath ? `url('${stillPath}')` : 'none';

                el.innerHTML = `
                    <div class="disney-episode-thumb" style="background-image: ${bgImage};"></div>
                    <div class="disney-episode-info">
                        <div class="disney-episode-title">
                            ${episodeNumber}. ${episodeName}
                        </div>
                        <p class="disney-episode-overview">${episodeOverview}</p>
                    </div>
                `;

                el.onclick = () => {
                    try {
                        Router.loadPage('player', { id: seriesId, type: 'tv', season: seasonNumber, episode: episode.episode_number });
                    } catch (navError) {
                        console.error('Error navigating to player:', navError);
                        ErrorHandler.show('Failed to load player.');
                    }
                };

                container.appendChild(el);
            } catch (episodeError) {
                console.error('Error rendering episode:', episodeError);
            }
        });
    } catch (error) {
        console.error('Error in renderEpisodes:', error);
        const container = document.getElementById('details-episodes');
        if (container) {
            container.innerHTML = '<div style="text-align:center; color:#f44;">Failed to render episodes.</div>';
        }
    }
}

/**
 * Switches the active tab panel view and highlights the selected tab button.
 * Affects display states of tab buttons and content panels.
 * @param {string} tabName - The ID name of the tab to open.
 */
function switchTab(tabName) {
    try {
        document.querySelectorAll('.disney-tab-panel').forEach(panel => {
            panel.classList.add('hidden');
        });
        
        document.querySelectorAll('.disney-tab-btn').forEach(btn => {
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
        });
        
        const activePanel = document.getElementById(`panel-${tabName}`);
        if (activePanel) {
            activePanel.classList.remove('hidden');
        }
        
        const activeBtn = document.getElementById(`tab-${tabName}`);
        if (activeBtn) {
            activeBtn.classList.remove('btn-secondary');
            activeBtn.classList.add('btn-primary');
        }
    } catch (e) {
        console.error('Error switching tabs:', e);
    }
}

/**
 * Renders extra videos (trailers, clips, featurettes) inside a vertical list layout.
 * Affects the list of extra videos in the Extras panel.
 * @param {Object} videos - The TMDb videos response object.
 * @param {number|string} contentId - The TMDb content ID.
 * @param {string} mediaType - The media type ('movie' or 'tv').
 */
function renderExtras(videos, contentId, mediaType) {
    try {
        const container = document.getElementById('extras-list');
        if (!container) return;
        container.innerHTML = '';
        
        if (!videos || !videos.results || videos.results.length === 0) {
            container.innerHTML = `<p style="color: #aaa; padding: 20px 0;">${I18n.t('details.noExtras')}</p>`;
            return;
        }
        
        // Sort trailers and teasers to the top
        const sortedVideos = [...videos.results].sort((a, b) => {
            const typeA = (a.type || '').toLowerCase();
            const typeB = (b.type || '').toLowerCase();
            if (typeA === 'trailer' && typeB !== 'trailer') return -1;
            if (typeA !== 'trailer' && typeB === 'trailer') return 1;
            if (typeA === 'teaser' && typeB !== 'teaser') return -1;
            if (typeA !== 'teaser' && typeB === 'teaser') return 1;
            return 0;
        });
        
        sortedVideos.forEach(video => {
            if (video.site.toLowerCase() !== 'youtube') return;
            
            const card = document.createElement('div');
            card.className = 'disney-extra-item focusable';
            card.tabIndex = 0;
            card.onclick = () => Router.loadPage('player', { id: contentId, type: 'trailer', ytKey: video.key, mediaType: mediaType });
            
            const thumbUrl = `https://img.youtube.com/vi/${video.key}/mqdefault.jpg`;
            
            let pubDateStr = '';
            if (video.published_at) {
                try {
                    const date = new Date(video.published_at);
                    pubDateStr = ` • Published: ${date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`;
                } catch (e) {
                    pubDateStr = '';
                }
            }
            
            card.innerHTML = `
                <div class="disney-extra-thumb-left" style="background-image: url('${thumbUrl}');">
                    <div class="disney-extra-play-icon">▶</div>
                </div>
                <div class="disney-extra-info">
                    <div class="disney-extra-type">${video.type}</div>
                    <div class="disney-extra-title">${video.name}</div>
                    <p class="disney-extra-description">${video.type}${pubDateStr}</p>
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        console.error('Error rendering extras:', error);
    }
}

/**
 * Renders content details inside the About panel, including synopsis and top cast members.
 * Affects the display text and actor profile grids in the About panel.
 * @param {string} overview - The synopsis text.
 * @param {Object} credits - The credits TMDb object holding cast arrays.
 */
function renderAbout(overview, credits) {
    try {
        const descEl = document.getElementById('about-description');
        if (descEl) {
            descEl.textContent = overview || I18n.t('details.noDescription');
        }
        
        const castContainer = document.getElementById('about-cast');
        if (!castContainer) return;
        castContainer.innerHTML = '';
        
        if (!credits || !credits.cast || credits.cast.length === 0) {
            castContainer.innerHTML = `<p style="color: #aaa; padding: 20px 0;">${I18n.t('details.noCast')}</p>`;
            return;
        }
        
        const topCast = credits.cast.slice(0, 12);
        topCast.forEach(actor => {
            const card = document.createElement('div');
            card.className = 'disney-cast-card';
            
            const profileImgStyle = actor.profile_path 
                ? `style="background-image: url('https://image.tmdb.org/t/p/w185${actor.profile_path}');"` 
                : '';
            
            card.innerHTML = `
                <div class="disney-cast-img" ${profileImgStyle}></div>
                <div class="disney-cast-name">${actor.name}</div>
                <div class="disney-cast-character">${actor.character || ''}</div>
            `;
            castContainer.appendChild(card);
        });
    } catch (error) {
        console.error('Error rendering about info:', error);
    }
}