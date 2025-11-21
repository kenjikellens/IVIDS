import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';

let currentSeriesId = null;

export async function init(params) {
    if (!params || !params.id) {
        console.error('No ID provided for details page');
        Router.loadPage('home');
        return;
    }

    currentSeriesId = params.id;

    // If we have full details from API, fetch them.
    let details = await Api.getDetails(params.id, params.type);

    // Fallback for mock data if API key is missing and getDetails returns null/mock
    if (!details && Api.getApiKey().includes('TODO')) {
        const mock = Api.getMockData().find(m => m.id == params.id);
        if (mock) details = mock;
    }

    if (details) {
        render(details, params.type);

        // If it's a TV show, render seasons and fetch season 1 by default
        if (params.type === 'tv') {
            if (details.seasons) {
                renderSeasons(details.seasons, params.id);
                // Default to first season (usually season 1, but sometimes season 0 is specials)
                // We prefer Season 1 if available.
                const defaultSeason = details.seasons.find(s => s.season_number === 1) || details.seasons[0];
                if (defaultSeason) {
                    loadSeasonEpisodes(params.id, defaultSeason.season_number);
                }
            }
        }
    }
}

function render(item, type) {
    const bg = document.getElementById('details-bg');
    const title = document.getElementById('details-title');
    const date = document.getElementById('details-date');
    const overview = document.getElementById('details-overview');
    const playBtn = document.getElementById('details-play');
    const backBtn = document.getElementById('details-back');
    const seasonsContainer = document.getElementById('seasons-container');

    title.textContent = item.title || item.name;

    // Render Genres
    const genresContainer = document.getElementById('details-genres');
    genresContainer.innerHTML = '';
    if (item.genres && item.genres.length > 0) {
        item.genres.forEach(genre => {
            const span = document.createElement('span');
            span.className = 'genre-chip';
            span.textContent = genre.name;
            genresContainer.appendChild(span);
        });
    }

    // Render Date in Box
    const year = (item.release_date || item.first_air_date || '').substring(0, 4);
    date.innerHTML = year ? `<span class="date-box">${year}</span>` : '';

    overview.textContent = item.overview;

    if (item.backdrop_path) {
        bg.style.backgroundImage = `url(${Api.getImageUrl(item.backdrop_path)})`;
    }

    playBtn.onclick = () => Router.loadPage('player', { id: item.id, type: type });
    backBtn.onclick = () => Router.loadPage('home');

    // Show/Hide Seasons Container
    if (type === 'tv') {
        seasonsContainer.style.display = 'block';
    } else {
        seasonsContainer.style.display = 'none';
    }
}

function renderSeasons(seasons, seriesId) {
    const container = document.getElementById('seasons-list');
    container.innerHTML = '';

    // Filter out Season 0 (Specials) if desired, or keep them. Usually keep them.
    // Sort by season number
    seasons.sort((a, b) => a.season_number - b.season_number);

    seasons.forEach(season => {
        // Skip if season_number is 0 and we want to hide specials, but let's keep it for now.
        const btn = document.createElement('button');
        btn.className = 'season-btn focusable';
        btn.textContent = season.name; // e.g. "Season 1"
        btn.dataset.seasonNumber = season.season_number;

        btn.onclick = () => {
            // Update active state
            document.querySelectorAll('.season-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            loadSeasonEpisodes(seriesId, season.season_number);
        };

        container.appendChild(btn);
    });

    // Set first one active initially if it exists
    const firstBtn = container.querySelector('.season-btn[data-season-number="1"]') || container.querySelector('.season-btn');
    if (firstBtn) firstBtn.classList.add('active');
}

async function loadSeasonEpisodes(seriesId, seasonNumber) {
    const container = document.getElementById('details-episodes');
    container.innerHTML = '<div style="text-align:center; color:#aaa;">Loading episodes...</div>';

    const seasonDetails = await Api.getSeasonDetails(seriesId, seasonNumber);

    if (seasonDetails && seasonDetails.episodes) {
        renderEpisodes(seasonDetails.episodes, seriesId, seasonNumber);
    } else {
        container.innerHTML = '<div style="text-align:center; color:#aaa;">No episodes found.</div>';
    }
}

function renderEpisodes(episodes, seriesId, seasonNumber) {
    const container = document.getElementById('details-episodes');
    container.innerHTML = `<h2 class="episodes-title">Episodes (Season ${seasonNumber})</h2>`;

    episodes.forEach(episode => {
        const el = document.createElement('div');
        el.className = 'episode-item focusable';
        el.tabIndex = 0; // Make focusable

        el.innerHTML = `
            <div class="episode-image" style="${episode.still_path ? `background-image: url('${Api.getImageUrl(episode.still_path)}')` : ''}"></div>
            <div class="episode-info">
                <div class="episode-header">
                    <span class="episode-number">${episode.episode_number}.</span>
                    <span class="episode-name">${episode.name}</span>
                </div>
                <p class="episode-overview">${episode.overview || 'No description available.'}</p>
            </div>
        `;

        el.onclick = () => {
            Router.loadPage('player', { id: seriesId, type: 'tv', season: seasonNumber, episode: episode.episode_number });
        };

        container.appendChild(el);
    });
}