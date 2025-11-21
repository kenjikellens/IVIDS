import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';

export function init() {
    const input = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    if (input) {
        // Handle Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                performSearch(input.value);
            }
        });

        // Live Search with Debounce
        let timeout = null;
        input.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                performSearch(input.value);
            }, 500); // Wait 500ms after typing stops
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
