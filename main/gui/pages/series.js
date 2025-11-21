import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';

export async function init() {
    const [popular] = await Promise.all([
        Api.fetchPopularTV()
    ]);

    if (popular && popular.length > 0) {
        setupHero(popular[0]);
        setupRow('popular-series-row', popular.slice(1));
        setupRow('top-rated-series-row', popular.slice(5).reverse()); // Mocking a second row for now
    }
}

function setupHero(item) {
    const hero = document.getElementById('hero-series');
    const title = document.getElementById('hero-title-series');
    const desc = document.getElementById('hero-desc-series');
    const playBtn = document.getElementById('hero-play-series');
    const detailsBtn = document.getElementById('hero-details-series');

    title.textContent = item.title || item.name;
    desc.textContent = truncate(item.overview, 150);

    if (item.backdrop_path) {
        hero.style.backgroundImage = `linear-gradient(to right, rgba(0,0,0,0.9), rgba(0,0,0,0.3)), url(${Api.getImageUrl(item.backdrop_path)})`;
    }

    playBtn.onclick = () => Router.loadPage('player', { id: item.id, type: 'tv' });
    detailsBtn.onclick = () => Router.loadPage('details', { id: item.id, type: 'tv' });
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

        img.onclick = () => Router.loadPage('details', { id: item.id, type: 'tv' });

        rowPosters.appendChild(img);
    });
}

function truncate(str, n) {
    return (str && str.length > n) ? str.substr(0, n - 1) + '...' : str;
}