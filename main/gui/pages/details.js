<<<<<<< HEAD
import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';

export async function init(params) {
    if (!params || !params.id) {
        console.error('No ID provided for details page');
        Router.loadPage('home');
        return;
    }

    // If we have full details from API, fetch them. Otherwise use what we might have passed (not implemented yet)
    // For now, we re-fetch or use mock if API key is missing.
    // Request details in the user's selected language
    const lang = Api.getLanguage();
    let details = await Api.getDetails(params.id, params.type, lang);

    // Fallback for mock data if API key is missing and getDetails returns null/mock
    if (!details && Api.getApiKey().includes('TODO')) {
        // Find in mock data
        const mock = Api.getMockData().find(m => m.id == params.id);
        if (mock) details = mock;
    }

    if (details) {
        await render(details, params.type);
    }
}
async function render(item, type) {
    const bg = document.getElementById('details-bg');
    const title = document.getElementById('details-title');
    const date = document.getElementById('details-date');
    const overview = document.getElementById('details-overview');
    const genresContainer = document.getElementById('details-genres');
    const playBtn = document.getElementById('details-play');
    const backBtn = document.getElementById('details-back');

    title.textContent = item.title || item.name;
    date.textContent = (item.release_date || item.first_air_date || '').substring(0, 4);
    overview.textContent = item.overview;

    // Render genre chips (if any)
    if (genresContainer) {
        genresContainer.innerHTML = '';
        try {
            const genreNames = await Api.getGenreNames(item, type, Api.getLanguage());
            // Build chip list; include an adult chip if item is marked adult.
            const chips = [];
            if (item.adult) {
                chips.push({ text: '18+', adult: true });
            }
            if (genreNames && genreNames.length > 0) {
                genreNames.forEach(name => chips.push({ text: name }));
            }

            if (chips.length > 0) {
                genresContainer.setAttribute('aria-hidden', 'false');
                chips.forEach(ch => {
                    const span = document.createElement('span');
                    span.className = 'genre-chip' + (ch.adult ? ' adult' : '');
                    span.textContent = ch.text;
                    genresContainer.appendChild(span);
                });
            } else {
                genresContainer.setAttribute('aria-hidden', 'true');
            }
        } catch (e) {
            console.error('Failed to render genres', e);
            genresContainer.setAttribute('aria-hidden', 'true');
        }
    }

    if (item.backdrop_path) {
        bg.style.backgroundImage = `url(${Api.getImageUrl(item.backdrop_path)})`;
    }

    playBtn.onclick = () => Router.loadPage('player', { id: item.id, type: type });
    backBtn.onclick = () => Router.loadPage('home');
}
=======
import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';

export async function init(params) {
    if (!params || !params.id) {
        console.error('No ID provided for details page');
        Router.loadPage('home');
        return;
    }

    // If we have full details from API, fetch them. Otherwise use what we might have passed (not implemented yet)
    // For now, we re-fetch or use mock if API key is missing.
    let details = await Api.getDetails(params.id, params.type);

    // Fallback for mock data if API key is missing and getDetails returns null/mock
    if (!details && Api.getApiKey().includes('TODO')) {
        // Find in mock data
        const mock = Api.getMockData().find(m => m.id == params.id);
        if (mock) details = mock;
    }

    if (details) {
        render(details, params.type);
    }
}

function render(item, type) {
    const bg = document.getElementById('details-bg');
    const title = document.getElementById('details-title');
    const date = document.getElementById('details-date');
    const overview = document.getElementById('details-overview');
    const playBtn = document.getElementById('details-play');
    const backBtn = document.getElementById('details-back');

    title.textContent = item.title || item.name;
    date.textContent = (item.release_date || item.first_air_date || '').substring(0, 4);
    overview.textContent = item.overview;

    if (item.backdrop_path) {
        bg.style.backgroundImage = `url(${Api.getImageUrl(item.backdrop_path)})`;
    }

    playBtn.onclick = () => Router.loadPage('player', { id: item.id, type: type });
    backBtn.onclick = () => Router.loadPage('home');
}
>>>>>>> 9cb739138d9b59ab65cad410bc39d6c60fb358f3
