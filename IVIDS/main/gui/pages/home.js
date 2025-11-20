import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';

export async function init() {
    const [trending, topRated, action, comedy, tv] = await Promise.all([
        Api.fetchTrending(),
        Api.fetchTopRated(),
        Api.fetchActionMovies(),
        Api.fetchComedyMovies(),
        Api.fetchPopularTV()
    ]);

    if (trending && trending.length > 0) {
        setupHero(trending[0]);
        setupRow('trending-row', trending.slice(1));
    }
    if (topRated) setupRow('top-rated-row', topRated);
    if (action) setupRow('action-row', action);
    if (comedy) setupRow('comedy-row', comedy);
    if (tv) setupRow('tv-row', tv);
}

function setupHero(item) {
    const hero = document.getElementById('hero');
    const title = document.getElementById('hero-title');
    const desc = document.getElementById('hero-desc');
    const playBtn = document.getElementById('hero-play');
    const detailsBtn = document.getElementById('hero-details');

    title.textContent = item.title || item.name;
    desc.textContent = truncate(item.overview, 150);

    if (item.backdrop_path) {
        hero.style.backgroundImage = `linear-gradient(to right, rgba(0,0,0,0.9), rgba(0,0,0,0.3)), url(${Api.getImageUrl(item.backdrop_path)})`;
    }

    playBtn.onclick = () => Router.loadPage('player', { id: item.id, type: item.media_type || 'movie' });
    detailsBtn.onclick = () => Router.loadPage('details', { id: item.id, type: item.media_type || 'movie' });
}

function setupRow(elementId, items) {
    const rowPosters = document.getElementById(elementId);
    if (!rowPosters) return;
    rowPosters.innerHTML = '';

    // Create container if not already wrapped (idempotency check)
    let container = rowPosters.parentElement;
    if (!container.classList.contains('row-container')) {
        container = document.createElement('div');
        container.className = 'row-container';
        rowPosters.parentNode.insertBefore(container, rowPosters);
        container.appendChild(rowPosters);

        // Add Buttons
        const leftBtn = document.createElement('button');
        leftBtn.className = 'handle handle-left focusable';
        leftBtn.innerHTML = '&#8249;';
        leftBtn.onclick = () => {
            rowPosters.scrollBy({ left: -500, behavior: 'smooth' });
        };

        const rightBtn = document.createElement('button');
        rightBtn.className = 'handle handle-right focusable';
        rightBtn.innerHTML = '&#8250;';
        rightBtn.onclick = () => {
            rowPosters.scrollBy({ left: 500, behavior: 'smooth' });
        };

        container.prepend(leftBtn);
        container.appendChild(rightBtn);
    }

    items.forEach(item => {
        if (!item.poster_path) return;

        const img = document.createElement('img');
        img.className = 'poster focusable';
        img.src = Api.getImageUrl(item.poster_path);
        img.alt = item.title || item.name;

        // Determine type if not present (e.g. from specific endpoints)
        let type = item.media_type;
        if (!type) {
            // Heuristic: if it has 'name' it's likely TV, if 'title' likely movie
            if (item.title) type = 'movie';
            else if (item.name) type = 'tv';
            else type = 'movie'; // Default
        }

        img.onclick = () => Router.loadPage('details', { id: item.id, type: type });

        rowPosters.appendChild(img);
    });
}

function truncate(str, n) {
    return (str && str.length > n) ? str.substr(0, n - 1) + '...' : str;
}
