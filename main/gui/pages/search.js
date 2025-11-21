<<<<<<< HEAD
import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';

export function init() {
    const input = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    if (input) {
        // Handle Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submission if inside a form
                e.stopPropagation(); // Prevent spatial nav from handling this
                performSearch(input.value);
            }
        });
    }

    // Handle Search Button Click
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            if (input) performSearch(input.value);
        });
    }
}

async function performSearch(query) {
    if (!query) return;

    const results = await Api.searchContent(query);
    const grid = document.getElementById('search-results');
    grid.innerHTML = '';

    if (results.length === 0) {
        grid.innerHTML = '<p>No results found.</p>';
        return;
    }

    results.forEach(item => {
        if (!item.poster_path) return; // Skip items without images

        const img = document.createElement('img');
        img.className = 'poster focusable';
        img.src = Api.getImageUrl(item.poster_path);
        img.alt = item.title || item.name;

        img.onclick = () => Router.loadPage('details', { id: item.id, type: item.media_type || 'movie' });

        grid.appendChild(img);
    });
}
=======
import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';

export function init() {
    const input = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    if (input) {
        // Handle Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault(); // Prevent form submission if inside a form
                e.stopPropagation(); // Prevent spatial nav from handling this
                performSearch(input.value);
            }
        });
    }

    // Handle Search Button Click
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            if (input) performSearch(input.value);
        });
    }
}

async function performSearch(query) {
    if (!query) return;

    const results = await Api.searchContent(query);
    const grid = document.getElementById('search-results');
    grid.innerHTML = '';

    if (results.length === 0) {
        grid.innerHTML = '<p>No results found.</p>';
        return;
    }

    results.forEach(item => {
        if (!item.poster_path) return; // Skip items without images

        const img = document.createElement('img');
        img.className = 'poster focusable';
        img.src = Api.getImageUrl(item.poster_path);
        img.alt = item.title || item.name;

        img.onclick = () => Router.loadPage('details', { id: item.id, type: item.media_type || 'movie' });

        grid.appendChild(img);
    });
}
>>>>>>> 9cb739138d9b59ab65cad410bc39d6c60fb358f3
