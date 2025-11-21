<<<<<<< HEAD
import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';

export async function init() {
    const [popular, topRated, action, comedy] = await Promise.all([
        Api.fetchTrending(), // Reusing trending for now, ideally filter by movie
        Api.fetchTopRated(),
        Api.fetchActionMovies(),
        Api.fetchComedyMovies()
    ]);

    // Filter for movies only just in case
    const movies = popular.filter(m => m.media_type === 'movie' || !m.media_type);

    if (movies && movies.length > 0) {
        setupHero(movies[0]);
        setupRow('popular-movies-row', movies.slice(1));
    }
    if (topRated) setupRow('top-rated-movies-row', topRated);
    if (action) setupRow('action-movies-row', action);
    if (comedy) setupRow('comedy-movies-row', comedy);
}

function setupHero(item) {
    const hero = document.getElementById('hero-movies');
    const title = document.getElementById('hero-title-movies');
    const desc = document.getElementById('hero-desc-movies');
    const playBtn = document.getElementById('hero-play-movies');
    const detailsBtn = document.getElementById('hero-details-movies');

    title.textContent = item.title || item.name;
    desc.textContent = truncate(item.overview, 150);

    if (item.backdrop_path) {
        hero.style.backgroundImage = `linear-gradient(to right, rgba(0,0,0,0.9), rgba(0,0,0,0.3)), url(${Api.getImageUrl(item.backdrop_path)})`;
    }

    // Make the title clickable and navigate to the details page
    title.classList.add('focusable');
    title.style.cursor = 'pointer';
    title.onclick = () => Router.loadPage('details', { id: item.id, type: 'movie' });

    // Play should open the details page first (Option A)
    playBtn.onclick = () => Router.loadPage('details', { id: item.id, type: 'movie' });
    detailsBtn.onclick = () => Router.loadPage('details', { id: item.id, type: 'movie' });
}

function setupRow(elementId, items) {
    const rowPosters = document.getElementById(elementId);
    if (!rowPosters) return;
    rowPosters.innerHTML = '';

    // Create container if not already wrapped
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

        img.onclick = () => Router.loadPage('details', { id: item.id, type: 'movie' });

        rowPosters.appendChild(img);
    });
}

function truncate(str, n) {
    return (str && str.length > n) ? str.substr(0, n - 1) + '...' : str;
}
=======
import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';

export async function init() {
    const [popular, topRated, action, comedy] = await Promise.all([
        Api.fetchTrending(), // Reusing trending for now, ideally filter by movie
        Api.fetchTopRated(),
        Api.fetchActionMovies(),
        Api.fetchComedyMovies()
    ]);

    // Filter for movies only just in case
    const movies = popular.filter(m => m.media_type === 'movie' || !m.media_type);

    if (movies && movies.length > 0) {
        setupHero(movies[0]);
        setupRow('popular-movies-row', movies.slice(1));
    }
    if (topRated) setupRow('top-rated-movies-row', topRated);
    if (action) setupRow('action-movies-row', action);
    if (comedy) setupRow('comedy-movies-row', comedy);
}

function setupHero(item) {
    const hero = document.getElementById('hero-movies');
    const title = document.getElementById('hero-title-movies');
    const desc = document.getElementById('hero-desc-movies');
    const playBtn = document.getElementById('hero-play-movies');
    const detailsBtn = document.getElementById('hero-details-movies');

    title.textContent = item.title || item.name;
    desc.textContent = truncate(item.overview, 150);

    if (item.backdrop_path) {
        hero.style.backgroundImage = `linear-gradient(to right, rgba(0,0,0,0.9), rgba(0,0,0,0.3)), url(${Api.getImageUrl(item.backdrop_path)})`;
    }

    playBtn.onclick = () => Router.loadPage('player', { id: item.id, type: 'movie' });
    detailsBtn.onclick = () => Router.loadPage('details', { id: item.id, type: 'movie' });
}

function setupRow(elementId, items) {
    const rowPosters = document.getElementById(elementId);
    if (!rowPosters) return;
    rowPosters.innerHTML = '';

    // Create container if not already wrapped
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

        img.onclick = () => Router.loadPage('details', { id: item.id, type: 'movie' });

        rowPosters.appendChild(img);
    });
}

function truncate(str, n) {
    return (str && str.length > n) ? str.substr(0, n - 1) + '...' : str;
}
>>>>>>> 9cb739138d9b59ab65cad410bc39d6c60fb358f3
