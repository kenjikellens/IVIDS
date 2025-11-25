import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { Playlists } from '../../logic/playlists.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { getWatchedItem } from '../../logic/recentlyWatched.js';
import I18n from '../js/i18n.js';

let currentSeriesId = null;

export async function init(params) {
    try {
        if (!params || !params.id) {
            console.error('No ID provided for details page');
            Router.loadPage('home');
            return;
        }

        currentSeriesId = params.id;

        // If we have full details from API, fetch them.
        let details = null;
        try {
            details = await Api.getDetails(params.id, params.type);
        } catch (apiError) {
            console.error('Error fetching details from API:', apiError);
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

            // If it's a TV show, render seasons and fetch season 1 by default
            if (params.type === 'tv') {
                if (details.seasons) {
                    try {
                        renderSeasons(details.seasons, params.id);
                        // Default to first season (usually season 1, but sometimes season 0 is specials)
                        // We prefer Season 1 if available.
                        const defaultSeason = details.seasons.find(s => s.season_number === 1) || details.seasons[0];
                        if (defaultSeason) {
                            loadSeasonEpisodes(params.id, defaultSeason.season_number);
                        }
                    } catch (seasonError) {
                        console.error('Error loading seasons:', seasonError);
                    }
                }
            }

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

            // Fetch and render recommendations
            try {
                const recommendations = await Api.fetchRecommendations(params.id, params.type);
                renderRecommendations(recommendations);
            } catch (recError) {
                console.error('Error fetching recommendations:', recError);
            }

        } else {
            console.error('No details available for this item');
            alert('Failed to load details. Please try again.');
        }
    } catch (error) {
        console.error('Critical error in details.init:', error);
        alert('An error occurred while loading the page.');
        Router.loadPage('home');
    }
}

function render(item, type) {
    try {
        const bg = document.getElementById('details-bg');
        const title = document.getElementById('details-title');
        const date = document.getElementById('details-date');
        const overview = document.getElementById('details-overview');
        const playBtn = document.getElementById('details-play');
        const backBtn = document.getElementById('details-back');
        const playlistBtn = document.getElementById('details-playlist');
        const seasonsContainer = document.getElementById('seasons-container');

        // Check for critical DOM elements
        if (!title || !playBtn || !backBtn) {
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
                        const span = document.createElement('span');
                        span.className = 'genre-chip';
                        span.textContent = genre.name || '';
                        genresContainer.appendChild(span);
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
            try {
                bg.style.backgroundImage = `url(${Api.getImageUrl(item.backdrop_path)})`;
            } catch (bgError) {
                console.error('Error setting background image:', bgError);
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
                // Normal play button
                playBtn.textContent = I18n.t('details.play');
                playBtn.onclick = () => Router.loadPage('player', { id: item.id, type: type });
            }
        } catch (watchError) {
            console.error('Error checking watch history:', watchError);
            // Fallback to normal play button
            playBtn.textContent = I18n.t('details.play');
            playBtn.onclick = () => Router.loadPage('player', { id: item.id, type: type });
        }

        backBtn.onclick = () => Router.loadPage('home');

        // Playlist Button Logic
        if (playlistBtn) {
            playlistBtn.onclick = () => {
                try {
                    openPlaylistModal(item, type);
                } catch (modalError) {
                    console.error('Error opening playlist modal:', modalError);
                    alert('Failed to open playlist. Please try again.');
                }
            };
        }

        // Show/Hide Seasons Container
        if (seasonsContainer) {
            seasonsContainer.style.display = (type === 'tv') ? 'block' : 'none';
        }
    } catch (error) {
        console.error('Error in render function:', error);
        alert('Failed to render details. Some information may be missing.');
    }
}

function renderRecommendations(items) {
    try {
        const container = document.getElementById('recommendations-container');
        const row = document.getElementById('recommendations-row');

        if (!container || !row) return;

        if (!items || items.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        row.innerHTML = '';

        items.forEach(item => {
            if (!item.poster_path) return;

            const img = document.createElement('img');
            img.className = 'poster focusable';
            img.src = Api.getImageUrl(item.poster_path);
            img.alt = item.title || item.name;
            img.tabIndex = 0;

            img.onclick = () => {
                // Navigate to the new item details
                Router.loadPage('details', { id: item.id, type: item.media_type || (item.title ? 'movie' : 'tv') });
            };

            // Keyboard support
            img.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    img.click();
                }
            };

            row.appendChild(img);
        });

    } catch (error) {
        console.error('Error rendering recommendations:', error);
    }
}

function getRating(item, type) {
    try {
        if (type === 'movie' && item.release_dates && item.release_dates.results) {
            const usRelease = item.release_dates.results.find(r => r.iso_3166_1 === 'US');
            if (usRelease && usRelease.release_dates) {
                // Find the first certification that is not empty
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

function openPlaylistModal(item, type) {
    try {
        const modal = document.getElementById('add-to-playlist-modal');
        const listContainer = document.getElementById('playlist-selection-list');
        const cancelBtn = document.getElementById('add-to-playlist-cancel');

        if (!modal || !listContainer) {
            console.error('Playlist modal elements not found');
            alert('Playlist feature is not available.');
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
                    const div = document.createElement('div');
                    div.className = 'playlist-option focusable';
                    div.tabIndex = 0;
                    div.textContent = playlist.name || I18n.t('details.unnamedPlaylist');

                    // Check if already in playlist
                    const exists = playlist.items && playlist.items.some(i => i.id === item.id && i.media_type === type);
                    if (exists) {
                        div.textContent += ' (Added)';
                        div.style.color = '#aaa';
                    }

                    div.onclick = () => {
                        try {
                            if (!exists) {
                                // Ensure we have all necessary fields
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
                                alert(`${I18n.t('details.addedToPlaylist')} ${playlist.name}`);
                                modal.style.display = 'none';
                            } else {
                                alert(I18n.t('details.alreadyInPlaylist'));
                            }
                        } catch (addError) {
                            console.error('Error adding to playlist:', addError);
                            alert(I18n.t('details.failedToAdd'));
                        }
                    };

                    listContainer.appendChild(div);
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
        alert('Failed to open playlist modal.');
    }
}

function renderSeasons(seasons, seriesId) {
    try {
        const container = document.getElementById('seasons-list');
        if (!container) {
            console.error('Seasons list container not found');
            return;
        }

        container.innerHTML = '';

        if (!seasons || seasons.length === 0) {
            container.innerHTML = `<p style="color: #aaa;">${I18n.t('details.noSeasons')}</p>`;
            return;
        }

        // Filter out Season 0 (Specials) if desired, or keep them. Usually keep them.
        // Sort by season number
        try {
            seasons.sort((a, b) => (a.season_number || 0) - (b.season_number || 0));
        } catch (sortError) {
            console.error('Error sorting seasons:', sortError);
        }

        seasons.forEach(season => {
            try {
                // Skip if season_number is 0 and we want to hide specials, but let's keep it for now.
                const btn = document.createElement('button');
                btn.className = 'season-btn focusable';
                btn.textContent = season.name || `${I18n.t('details.season')} ${season.season_number || '?'}`; // e.g. "Season 1"
                btn.dataset.seasonNumber = season.season_number || 0;

                btn.onclick = () => {
                    try {
                        // Update active state
                        document.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');

                        loadSeasonEpisodes(seriesId, season.season_number);
                    } catch (clickError) {
                        console.error('Error handling season click:', clickError);
                    }
                };

                container.appendChild(btn);
            } catch (btnError) {
                console.error('Error creating season button:', btnError);
            }
        });

        // Set first one active initially if it exists
        try {
            const firstBtn = container.querySelector('.season-btn[data-season-number="1"]') || container.querySelector('.season-btn');
            if (firstBtn) firstBtn.classList.add('active');
        } catch (activateError) {
            console.error('Error activating first season:', activateError);
        }
    } catch (error) {
        console.error('Error in renderSeasons:', error);
    }
}

async function loadSeasonEpisodes(seriesId, seasonNumber) {
    try {
        const container = document.getElementById('details-episodes');
        if (!container) {
            console.error('Episodes container not found');
            return;
        }

        container.innerHTML = `<div style="text-align:center; color:#aaa;">${I18n.t('details.loadingEpisodes')}</div>`;

        let seasonDetails = null;
        try {
            seasonDetails = await Api.getSeasonDetails(seriesId, seasonNumber);
        } catch (apiError) {
            console.error('Error fetching season details:', apiError);
            container.innerHTML = '<div style="text-align:center; color:#f44;">Failed to load episodes. Please try again.</div>';
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

function renderEpisodes(episodes, seriesId, seasonNumber) {
    try {
        const container = document.getElementById('details-episodes');
        if (!container) {
            console.error('Episodes container not found');
            return;
        }

        container.innerHTML = `<h2 class="episodes-title">${I18n.t('details.episodes')} (${I18n.t('details.season')} ${seasonNumber})</h2>`;

        if (!episodes || episodes.length === 0) {
            container.innerHTML += `<div style="text-align:center; color:#aaa;">${I18n.t('details.noEpisodes')}</div>`;
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
                el.className = 'episode-item focusable';
                el.tabIndex = 0; // Make focusable

                // Check if this episode was watched
                if (watchedItem && watchedItem.season === seasonNumber && watchedItem.episode === episode.episode_number) {
                    el.classList.add('watched');
                }

                const episodeNumber = episode.episode_number || '?';
                const episodeName = episode.name || I18n.t('details.untitled');
                const episodeOverview = episode.overview || I18n.t('details.noDescription');
                const stillPath = episode.still_path ? Api.getImageUrl(episode.still_path) : '';

                el.innerHTML = `
                    <div class="episode-image" style="${stillPath ? `background-image: url('${stillPath}')` : ''}"></div>
                    <div class="episode-info">
                        <div class="episode-header">
                            <span class="episode-number">${episodeNumber}.</span>
                            <span class="episode-name">${episodeName}</span>
                        </div>
                        <p class="episode-overview">${episodeOverview}</p>
                    </div>
                `;

                el.onclick = () => {
                    try {
                        Router.loadPage('player', { id: seriesId, type: 'tv', season: seasonNumber, episode: episode.episode_number });
                    } catch (navError) {
                        console.error('Error navigating to player:', navError);
                        alert('Failed to load player.');
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