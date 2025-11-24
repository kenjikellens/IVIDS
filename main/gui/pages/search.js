import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { getWatchedItem } from '../../logic/recentlyWatched.js';

let currentFilters = {
    type: 'movie',
    genres: [],
    certification: null,
    sortBy: 'popularity.desc',
    year: null
};

let currentPage = 1;
let isLoading = false;
let hasMoreResults = true;
let currentQuery = '';
let isSearchMode = false;
let viewMode = 'grid'; // 'grid' or 'list'

export function init() {
    try {
        const input = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-btn');
        const viewToggleBtn = document.getElementById('view-toggle-btn');
        const sortBySelect = document.getElementById('sort-by');
        const yearInput = document.getElementById('year-filter');

        // Initialize Filters
        try {
            renderFilters();
        } catch (filterError) {
            console.error('Error rendering filters:', filterError);
        }

        if (input) {
            try {
                // Handle Enter key
                input.addEventListener('keydown', (e) => {
                    try {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            performSearch(input.value, true);
                            input.blur();
                            hideRecentSearches();
                        }
                    } catch (keyError) {
                        console.error('Error handling key event:', keyError);
                    }
                });

                // Live Search with Debounce
                let timeout = null;
                input.addEventListener('input', (e) => {
                    try {
                        clearTimeout(timeout);
                        timeout = setTimeout(() => {
                            performSearch(input.value, true);
                        }, 500); // Wait 500ms after typing stops
                    } catch (inputError) {
                        console.error('Error handling input event:', inputError);
                    }
                });

                // Recent Searches
                input.addEventListener('focus', () => {
                    renderRecentSearches();
                });

                // Hide recent searches when clicking outside
                document.addEventListener('click', (e) => {
                    if (!e.target.closest('.search-box-container')) {
                        hideRecentSearches();
                    }
                });

            } catch (eventError) {
                console.error('Error setting up input event listeners:', eventError);
            }
        }

        // Handle Search Button Click
        if (searchBtn) {
            try {
                searchBtn.addEventListener('click', () => {
                    try {
                        if (input) {
                            performSearch(input.value, true);
                            hideRecentSearches();
                        }
                    } catch (clickError) {
                        console.error('Error performing search on click:', clickError);
                    }
                });
            } catch (btnError) {
                console.error('Error setting up search button:', btnError);
            }
        }

        // Handle View Toggle
        if (viewToggleBtn) {
            viewToggleBtn.addEventListener('click', toggleViewMode);
        }

        // Handle Sort By
        if (sortBySelect) {
            sortBySelect.addEventListener('change', (e) => {
                currentFilters.sortBy = e.target.value;
                performSearch(currentQuery, true);
            });
        }

        // Handle Year Filter
        if (yearInput) {
            yearInput.addEventListener('change', (e) => {
                currentFilters.year = e.target.value ? parseInt(e.target.value) : null;
                performSearch(currentQuery, true);
            });
        }

        // Initialize Infinite Scroll
        try {
            initInfiniteScroll();
        } catch (scrollError) {
            console.error('Error initializing infinite scroll:', scrollError);
        }

        // Initial load (Browse Mode)
        performSearch('', true);
    } catch (error) {
        console.error('Critical error in search.init:', error);
        alert('Failed to initialize search page.');
    }
}

function initInfiniteScroll() {
    try {
        const scrollContainer = document.getElementById('main-view'); // Assuming main-view is the scrollable area
        if (!scrollContainer) {
            // Fallback to window or document body if main-view is not the scroller
            // But usually in single page apps there is a main container
            return;
        }

        scrollContainer.addEventListener('scroll', () => {
            try {
                if (isLoading || !hasMoreResults) return;

                const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
                // Trigger load when within 300px of bottom
                if (scrollTop + clientHeight >= scrollHeight - 300) {
                    loadMore();
                }
            } catch (scrollError) {
                console.error('Error handling scroll event:', scrollError);
            }
        });
    } catch (error) {
        console.error('Error in initInfiniteScroll:', error);
    }
}

async function loadMore() {
    try {
        if (isLoading || !hasMoreResults) return;
        currentPage++;
        await fetchResults(false);
    } catch (error) {
        console.error('Error loading more results:', error);
    }
}

function renderFilters() {
    try {
        // Render Genres
        const genreContainer = document.getElementById('genre-filters');
        if (genreContainer) {
            try {
                const genres = Api.getGenres();
                genreContainer.innerHTML = genres.map(genre => `
                    <label class="filter-checkbox focusable" tabindex="0">
                        <input type="checkbox" value="${genre.id}" data-type="genre"> ${genre.name}
                    </label>
                `).join('');
            } catch (genreError) {
                console.error('Error rendering genre filters:', genreError);
            }
        }

        // Render Certifications
        const certContainer = document.getElementById('cert-filters');
        if (certContainer) {
            try {
                const certs = Api.getCertifications();
                certContainer.innerHTML = certs.map(cert => `
                    <label class="filter-checkbox focusable" tabindex="0">
                        <input type="radio" name="certification" value="${cert}" data-type="cert"> ${cert}
                    </label>
                `).join('');
            } catch (certError) {
                console.error('Error rendering certification filters:', certError);
            }
        }

        // Attach Event Listeners to Filters
        try {
            document.querySelectorAll('.filter-checkbox input').forEach(input => {
                input.addEventListener('change', handleFilterChange);
            });
        } catch (listenerError) {
            console.error('Error attaching filter event listeners:', listenerError);
        }
    } catch (error) {
        console.error('Error in renderFilters:', error);
    }
}

function handleFilterChange(e) {
    try {
        const target = e.target;
        const value = target.value;
        const type = target.dataset.type; // 'genre' or 'cert'
        const name = target.name; // 'media-type' or 'certification'

        if (name === 'media-type') {
            currentFilters.type = value;
        } else if (type === 'genre') {
            const id = parseInt(value);
            if (target.checked) {
                currentFilters.genres.push(id);
            } else {
                currentFilters.genres = currentFilters.genres.filter(g => g !== id);
            }
        } else if (type === 'cert') {
            currentFilters.certification = target.checked ? value : null;
        }

        // Trigger search/browse update
        const input = document.getElementById('search-input');
        performSearch(input ? input.value : '', true);
    } catch (error) {
        console.error('Error handling filter change:', error);
    }
}

async function performSearch(query, reset = false) {
    try {
        if (reset) {
            currentPage = 1;
            hasMoreResults = true;
            currentQuery = query;
            isSearchMode = (query && query.trim().length > 0);
            const grid = document.getElementById('search-results');
            if (grid) grid.innerHTML = ''; // Clear previous results

            if (isSearchMode) {
                saveRecentSearch(query);
            }
        }

        await fetchResults(reset);
    } catch (error) {
        console.error('Error in performSearch:', error);
        const grid = document.getElementById('search-results');
        if (grid) {
            grid.innerHTML = '<p style="color: #f44;">An error occurred during search.</p>';
        }
    }
}

async function fetchResults(reset) {
    try {
        const grid = document.getElementById('search-results');
        if (!grid) {
            console.error('Search results grid not found');
            return;
        }

        isLoading = true;

        // Show loading indicator if it's a new search or first load
        if (reset) {
            grid.innerHTML = '<div class="loading"><img src="../images/loader.gif" alt="Loading..."></div>';
        }

        let results = [];

        try {
            if (isSearchMode) {
                // Search Mode
                const searchResults = await Api.searchContent(currentQuery, currentPage);

                // Client-side filtering for search results (API search doesn't support all filters)
                results = searchResults.filter(item => {
                    try {
                        if (currentFilters.type && item.media_type && item.media_type !== currentFilters.type) {
                            return false;
                        }
                        if (currentFilters.genres.length > 0) {
                            if (!item.genre_ids) return false;
                            const hasAllGenres = currentFilters.genres.every(id => item.genre_ids.includes(id));
                            if (!hasAllGenres) return false;
                        }
                        if (currentFilters.year) {
                            const date = item.release_date || item.first_air_date;
                            if (!date || !date.startsWith(currentFilters.year.toString())) return false;
                        }
                        return true;
                    } catch (filterError) {
                        console.error('Error filtering item:', filterError);
                        return false;
                    }
                });

                // Client-side sorting for search results (API search doesn't support sort_by)
                if (currentFilters.sortBy) {
                    results.sort((a, b) => {
                        if (currentFilters.sortBy === 'vote_average.desc') {
                            return (b.vote_average || 0) - (a.vote_average || 0);
                        } else if (currentFilters.sortBy === 'primary_release_date.desc') {
                            const dateA = new Date(a.release_date || a.first_air_date || 0);
                            const dateB = new Date(b.release_date || b.first_air_date || 0);
                            return dateB - dateA;
                        } else if (currentFilters.sortBy === 'vote_count.desc') {
                            return (b.vote_count || 0) - (a.vote_count || 0);
                        }
                        return (b.popularity || 0) - (a.popularity || 0);
                    });
                }

            } else {
                // Browse Mode (Discover)
                const filters = { ...currentFilters, page: currentPage };
                results = await Api.discoverContent(filters);
            }
        } catch (apiError) {
            console.error('Error fetching results from API:', apiError);
            if (reset) {
                grid.innerHTML = '<p style="color: #f44;">Failed to load results. Please check your connection.</p>';
            }
            isLoading = false;
            return;
        }

        if (reset) {
            grid.innerHTML = '';
        }

        if (results.length === 0) {
            hasMoreResults = false;
            if (currentPage === 1) {
                grid.innerHTML = '<p>No results found.</p>';
            }
        }

        results.forEach(item => {
            try {
                if (!item.poster_path) return; // Skip items without images

                const itemEl = document.createElement('div');

                const isWatched = getWatchedItem(item.id, item.media_type || currentFilters.type || 'movie');
                const watchedHtml = isWatched ? '<div class="watched-indicator">WATCHED</div>' : '';

                if (viewMode === 'list') {
                    itemEl.className = 'list-item focusable';
                    itemEl.tabIndex = 0;
                    itemEl.innerHTML = `
                        <img class="poster" src="${Api.getImageUrl(item.poster_path)}" alt="${item.title || item.name}">
                        <div class="list-item-details">
                            <div class="list-item-title">${item.title || item.name}</div>
                            <div class="list-item-meta">
                                ${new Date(item.release_date || item.first_air_date).getFullYear() || 'N/A'} • 
                                ⭐ ${item.vote_average ? item.vote_average.toFixed(1) : 'N/A'}
                            </div>
                            <div class="list-item-overview">${item.overview || 'No description available.'}</div>
                        </div>
                        ${watchedHtml}
                    `;
                } else {
                    itemEl.className = 'poster-container'; // Wrapper for positioning
                    itemEl.style.position = 'relative';
                    itemEl.innerHTML = `
                        <img class="poster focusable" tabindex="0" src="${Api.getImageUrl(item.poster_path)}" alt="${item.title || item.name}">
                        ${watchedHtml}
                    `;
                }

                // Click handler
                const clickTarget = viewMode === 'list' ? itemEl : itemEl.querySelector('.poster');

                clickTarget.onclick = () => {
                    try {
                        Router.loadPage('details', { id: item.id, type: item.media_type || currentFilters.type || 'movie' });
                    } catch (navError) {
                        console.error('Error navigating to details:', navError);
                    }
                };

                clickTarget.onkeydown = (e) => {
                    try {
                        if (e.key === 'Enter') {
                            Router.loadPage('details', { id: item.id, type: item.media_type || currentFilters.type || 'movie' });
                        }
                    } catch (keyError) {
                        console.error('Error handling key event:', keyError);
                    }
                };

                grid.appendChild(itemEl);
            } catch (itemError) {
                console.error('Error rendering result item:', itemError);
            }
        });

        isLoading = false;
    } catch (error) {
        console.error('Error in fetchResults:', error);
        isLoading = false;
        const grid = document.getElementById('search-results');
        if (grid && grid.innerHTML === '') {
            grid.innerHTML = '<p style="color: #f44;">An error occurred while loading results.</p>';
        }
    }
}

// Recent Searches Logic
function getRecentSearches() {
    try {
        const stored = localStorage.getItem('ivids_recent_searches');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

function saveRecentSearch(query) {
    if (!query || query.trim().length < 2) return;
    try {
        let recent = getRecentSearches();
        recent = recent.filter(q => q.toLowerCase() !== query.toLowerCase());
        recent.unshift(query);
        recent = recent.slice(0, 10); // Keep last 10
        localStorage.setItem('ivids_recent_searches', JSON.stringify(recent));
    } catch (e) {
        console.error('Error saving recent search:', e);
    }
}

function renderRecentSearches() {
    const container = document.getElementById('recent-searches');
    if (!container) return;

    const recent = getRecentSearches();
    if (recent.length === 0) {
        container.classList.add('hidden');
        return;
    }

    container.innerHTML = recent.map(q => `
        <div class="recent-search-item" tabindex="0">
            <span class="icon">🕒</span> ${q}
        </div>
    `).join('');

    container.classList.remove('hidden');

    // Add click listeners
    container.querySelectorAll('.recent-search-item').forEach(item => {
        item.addEventListener('click', () => {
            const query = item.textContent.trim().substring(2).trim(); // Remove icon
            const input = document.getElementById('search-input');
            if (input) {
                input.value = query;
                performSearch(query, true);
                hideRecentSearches();
            }
        });
    });
}

function hideRecentSearches() {
    const container = document.getElementById('recent-searches');
    if (container) {
        setTimeout(() => { // Delay to allow click to register
            container.classList.add('hidden');
        }, 200);
    }
}

function toggleViewMode() {
    viewMode = viewMode === 'grid' ? 'list' : 'grid';
    const grid = document.getElementById('search-results');
    const btn = document.getElementById('view-toggle-btn');

    if (grid) {
        if (viewMode === 'list') {
            grid.classList.add('list-view');
            if (btn) btn.innerHTML = '<span class="icon">▦</span>'; // Grid icon
        } else {
            grid.classList.remove('list-view');
            if (btn) btn.innerHTML = '<span class="icon">⊞</span>'; // List icon
        }

        // Re-render to apply correct HTML structure for list/grid items
        performSearch(currentQuery, true); // Or just re-render current results without fetch if we cached them
    }
}
