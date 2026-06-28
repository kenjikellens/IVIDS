import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { getWatchedItem } from '../../logic/recentlyWatched.js';
import { getLoaderHtml } from '../js/loader.js';
import { lazyLoader } from '../js/lazy-loader.js';
import { debounce } from '../js/utils/debounce.js';
import { manageModal } from '../js/utils/ui-helper.js';


let currentFilters = {
    types: ['movie', 'tv'],
    genres: [],
    certification: null,
    originCountry: '',
    sortBy: 'popularity.desc',
    year: null,
    watchRegion: 'US'
};

let pendingFilters = JSON.parse(JSON.stringify(currentFilters));

let currentPage = 1;
let isLoading = false;
let hasMoreResults = true;
let currentQuery = '';
let isSearchMode = false;
let cachedCountryItems = null;

/**
 * Initializes the search page inputs, buttons, filter modal handlers, infinite scrolling,
 * and renders the initial list of items.
 * @returns {Promise<void>}
 */
/**
 * Initializes the search page inputs, buttons, filter modal handlers, infinite scrolling,
 * and renders the initial list of items.
 * @param {Object} [params] - Navigation parameters (e.g. genreId and type).
 * @returns {Promise<void>}
 */
export async function init(params) {
    try {
        cachedCountryItems = null;
        if (params && params.genreId) {
            currentFilters.genres = [parseInt(params.genreId)];
            currentFilters.types = params.type ? [params.type] : ['movie', 'tv'];
            currentFilters.sortBy = 'popularity.desc';
            currentFilters.certification = null;
            currentFilters.originCountry = '';
            currentFilters.year = null;
            pendingFilters = JSON.parse(JSON.stringify(currentFilters));
        } else {
            resetFilters(currentFilters);
            pendingFilters = JSON.parse(JSON.stringify(currentFilters));
        }

        const input = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-btn');

        let closeFilterModalFn = null;
        let closeGenreModalFn = null;
        let closeSortModalFn = null;
        let closeCountryModalFn = null;

        const filterBtn = document.getElementById('filter-btn');
        const filterModal = document.getElementById('filter-modal');
        const closeFiltersBtn = document.getElementById('close-filters-btn');
        const cancelFiltersBtn = document.getElementById('cancel-filters-btn');
        const clearFiltersBtn = document.getElementById('clear-filters-btn');

        const sortByBtn = document.getElementById('sort-by-btn');
        const yearInput = document.getElementById('year-filter');
        const countrySelectBtn = document.getElementById('country-select-btn');
        const genreSelectBtn = document.getElementById('genre-select-btn');

        const genreModal = document.getElementById('genre-modal');
        const genreDoneBtn = document.getElementById('genre-done-btn');
        const sortModal = document.getElementById('sort-modal');
        const countryModal = document.getElementById('country-modal');
        const countrySearchInput = document.getElementById('country-search-input');
        const sortConfirmBtn = document.getElementById('sort-confirm-btn');
        const sortCancelBtn = document.getElementById('sort-cancel-btn');

        // Initialize UI with current filters
        await renderAllFilters(currentFilters);

        // Search only when Enter is pressed or searchBtn is clicked
        input.onkeydown = (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                performSearch(input.value, true);
            }
        };

        // Clear recents handler
        const clearRecentsBtn = document.getElementById('clear-recents-btn');
        if (clearRecentsBtn) {
            clearRecentsBtn.onclick = () => {
                localStorage.removeItem('ivids_recent_searches');
                renderRecentSearches();
                const searchInput = document.getElementById('search-input');
                if (searchInput) {
                    SpatialNav.setFocus(searchInput);
                }
            };
        }

        yearInput.onchange = () => {
            pendingFilters.year = yearInput.value ? parseInt(yearInput.value) : null;
        };

        if (countrySearchInput) {
            countrySearchInput.oninput = () => filterCountries(countrySearchInput.value);
        }

        // Filter Modal Handlers
        if (filterBtn && filterModal) {
            filterBtn.onclick = () => {
                pendingFilters = JSON.parse(JSON.stringify(currentFilters));
                renderAllFilters(pendingFilters);
                const first = filterModal.querySelector('.focusable');
                closeFilterModalFn = manageModal(filterModal, first);
            };

            const applyFilters = () => {
                currentFilters = JSON.parse(JSON.stringify(pendingFilters));
                if (closeFilterModalFn) {
                    closeFilterModalFn();
                    closeFilterModalFn = null;
                }
                SpatialNav.setFocus(filterBtn);
                performSearch(currentQuery, true);
            };

            const cancelFilters = () => {
                if (closeFilterModalFn) {
                    closeFilterModalFn();
                    closeFilterModalFn = null;
                }
                SpatialNav.setFocus(filterBtn);
            };

            if (closeFiltersBtn) closeFiltersBtn.onclick = applyFilters;
            if (cancelFiltersBtn) cancelFiltersBtn.onclick = cancelFilters;
            if (clearFiltersBtn) {
                clearFiltersBtn.onclick = () => {
                    resetFilters(pendingFilters);
                    renderAllFilters(pendingFilters);
                };
            }
        }

        // Genre Modal Handlers
        if (genreSelectBtn && genreModal) {
            genreSelectBtn.onclick = () => {
                const firstGenre = genreModal.querySelector('.focusable');
                closeGenreModalFn = manageModal(genreModal, firstGenre);
            };

            if (genreDoneBtn) {
                genreDoneBtn.onclick = () => {
                    if (closeGenreModalFn) {
                        closeGenreModalFn();
                        closeGenreModalFn = null;
                    }
                    if (filterModal.classList.contains('active')) {
                        SpatialNav.setFocusTrap(filterModal);
                        SpatialNav.setFocus(genreSelectBtn);
                    }
                    updateGenreBadge(pendingFilters);
                };
            }
        }

        // Initialize Sort Modal
        if (sortByBtn && sortModal && sortConfirmBtn && sortCancelBtn) {
            let pendingSortValue = pendingFilters.sortBy;

            sortByBtn.onclick = () => {
                pendingSortValue = pendingFilters.sortBy;
                const selected = sortModal.querySelector('.select-item.selected') || sortModal.querySelector('.focusable');
                closeSortModalFn = manageModal(sortModal, selected);
            };

            document.getElementById('sort-options-list').onclick = (e) => {
                const item = e.target.closest('.select-item');
                if (item) {
                    pendingSortValue = item.dataset.value;
                    document.querySelectorAll('#sort-modal .select-item').forEach(el => {
                        el.classList.toggle('selected', el.dataset.value === pendingSortValue);
                    });
                }
            };

            sortConfirmBtn.onclick = () => {
                pendingFilters.sortBy = pendingSortValue;
                const selectedItem = document.querySelector(`#sort-modal .select-item[data-value="${pendingSortValue}"]`);
                if (selectedItem) {
                    document.getElementById('sort-by-label').textContent = selectedItem.textContent;
                }
                if (closeSortModalFn) {
                    closeSortModalFn();
                    closeSortModalFn = null;
                }
                if (filterModal.classList.contains('active')) {
                    SpatialNav.setFocusTrap(filterModal);
                    SpatialNav.setFocus(sortByBtn);
                }
            };

            sortCancelBtn.onclick = () => {
                if (closeSortModalFn) {
                    closeSortModalFn();
                    closeSortModalFn = null;
                }
                if (filterModal.classList.contains('active')) {
                    SpatialNav.setFocusTrap(filterModal);
                    SpatialNav.setFocus(sortByBtn);
                }
            };
        }

        // Initialize Country Modal
        if (countrySelectBtn && countryModal) {
            countrySelectBtn.onclick = () => {
                const selected = countrySearchInput || countryModal.querySelector('.select-item.selected') || countryModal.querySelector('.focusable');
                closeCountryModalFn = manageModal(countryModal, selected);
            };

            const closeCountryModal = () => {
                if (closeCountryModalFn) {
                    closeCountryModalFn();
                    closeCountryModalFn = null;
                }
                if (filterModal.classList.contains('active')) {
                    SpatialNav.setFocusTrap(filterModal);
                    SpatialNav.setFocus(countrySelectBtn);
                }
            };

            countryModal.onclick = (e) => {
                const item = e.target.closest('.select-item');
                if (item) {
                    pendingFilters.originCountry = item.dataset.value;
                    document.getElementById('country-label').textContent = item.textContent;
                    document.querySelectorAll('#country-modal .select-item').forEach(el => {
                        el.classList.toggle('selected', el.dataset.value === pendingFilters.originCountry);
                    });
                    closeCountryModal();
                } else if (e.target === countryModal) {
                    closeCountryModal();
                }
            };
        }

        // Global Back Handler
        const originalOnBack = SpatialNav.onBack;
        SpatialNav.onBack = () => {
            const activeModal = document.querySelector('.modal-overlay.active:not(#filter-modal)');
            const filterModalActive = filterModal.classList.contains('active');

            if (activeModal) {
                if (activeModal === genreModal && closeGenreModalFn) {
                    closeGenreModalFn();
                    closeGenreModalFn = null;
                    SpatialNav.setFocusTrap(filterModal);
                    SpatialNav.setFocus(genreSelectBtn);
                } else if (activeModal === sortModal && closeSortModalFn) {
                    closeSortModalFn();
                    closeSortModalFn = null;
                    SpatialNav.setFocusTrap(filterModal);
                    SpatialNav.setFocus(sortByBtn);
                } else if (activeModal === countryModal && closeCountryModalFn) {
                    closeCountryModalFn();
                    closeCountryModalFn = null;
                    SpatialNav.setFocusTrap(filterModal);
                    SpatialNav.setFocus(countrySelectBtn);
                } else {
                    activeModal.classList.remove('active');
                }
            } else if (filterModalActive) {
                if (closeFilterModalFn) {
                    closeFilterModalFn();
                    closeFilterModalFn = null;
                }
                SpatialNav.setFocus(filterBtn);
            } else if (originalOnBack) {
                originalOnBack();
            }
        };


        if (searchBtn) {
            searchBtn.onclick = () => {
                performSearch(input ? input.value : '', true);
            };
        }

        initInfiniteScroll();
        performSearch('', true);

    } catch (error) {
        console.error('Error in search.init:', error);
    }
}

/**
 * Renders and updates all filter options in the search/discover filter modal.
 * This affects the visual state of the category checkboxes, genre chips, and select labels.
 * @param {Object} filtersObj - The filter object containing active states.
 * @returns {Promise<void>}
 */
async function renderAllFilters(filtersObj) {
    try {
        // 1. Media Type Checkboxes
        document.querySelectorAll('input[name="media-type"]').forEach(cb => {
            const isChecked = filtersObj.types.includes(cb.value);
            cb.checked = isChecked;
            const chip = cb.closest('.filter-chip');
            if (chip) chip.classList.toggle('selected', isChecked);

            cb.onchange = () => {
                const checkedTypes = Array.from(document.querySelectorAll('input[name="media-type"]:checked')).map(c => c.value);
                if (checkedTypes.length === 0) {
                    // Prevent unchecking the last active option
                    cb.checked = true;
                    return;
                }
                filtersObj.types = checkedTypes;
                renderAllFilters(filtersObj);
            };
        });

        // 2. Genres
        const genreContainer = document.getElementById('genre-filters');
        if (genreContainer) {
            const genres = Api.getGenres();
            genreContainer.innerHTML = genres.map(genre => {
                const isSelected = filtersObj.genres.includes(genre.id);
                return `
                    <label class="filter-chip focusable ${isSelected ? 'selected' : ''}" tabindex="0">
                        <input type="checkbox" value="${genre.id}" ${isSelected ? 'checked' : ''}>
                        <span>${genre.name}</span>
                    </label>
                `;
            }).join('');

            genreContainer.querySelectorAll('input').forEach(cb => {
                cb.onchange = () => {
                    const id = parseInt(cb.value);
                    if (cb.checked) {
                        filtersObj.genres.push(id);
                        cb.closest('.filter-chip').classList.add('selected');
                    } else {
                        filtersObj.genres = filtersObj.genres.filter(g => g !== id);
                        cb.closest('.filter-chip').classList.remove('selected');
                    }
                };
            });
        }

        // 3. Countries
        const countryList = document.getElementById('country-options-list');
        if (countryList && (countryList.children.length === 0 || countryList.querySelector('.select-item') === null)) {
            const countries = await Api.fetchCountries();
            countries.sort((a, b) => a.english_name.localeCompare(b.english_name));
            countryList.innerHTML = '';

            const allOpt = document.createElement('div');
            allOpt.className = 'select-item focusable ' + (!filtersObj.originCountry ? 'selected' : '');
            allOpt.dataset.value = '';
            allOpt.dataset.i18n = 'search.allCountries';
            allOpt.textContent = window.i18n.t('search.allCountries');
            countryList.appendChild(allOpt);

            countries.forEach(c => {
                const opt = document.createElement('div');
                opt.className = 'select-item focusable ' + (filtersObj.originCountry === c.iso_3166_1 ? 'selected' : '');
                opt.dataset.value = c.iso_3166_1;
                opt.textContent = c.english_name;
                countryList.appendChild(opt);
            });
            cachedCountryItems = null;
        }

        // 4. Age Ratings
        const certContainer = document.getElementById('cert-filters');
        if (certContainer) {
            const certs = Api.getCertifications();
            certContainer.innerHTML = certs.map(cert => {
                const isSelected = filtersObj.certification === cert;
                return `
                    <label class="filter-chip focusable ${isSelected ? 'selected' : ''}" tabindex="0">
                        <input type="radio" name="certification" value="${cert}" ${isSelected ? 'checked' : ''}>
                        <span>${cert}</span>
                    </label>
                `;
            }).join('');

            certContainer.querySelectorAll('input').forEach(radio => {
                radio.onchange = () => {
                    filtersObj.certification = radio.value;
                    document.querySelectorAll('#cert-filters .filter-chip').forEach(l => l.classList.remove('selected'));
                    radio.closest('.filter-chip').classList.add('selected');
                };
            });
        }

        // 5. Update Labels
        const sortLabel = document.getElementById('sort-by-label');
        if (sortLabel) {
            const selectedItem = document.querySelector(`#sort-modal .select-item[data-value="${filtersObj.sortBy}"]`);
            sortLabel.textContent = selectedItem ? selectedItem.textContent : filtersObj.sortBy;
        }

        const countryLabelValue = document.getElementById('country-label');
        if (countryLabelValue) {
            const selectedItem = document.querySelector(`#country-modal .select-item[data-value="${filtersObj.originCountry}"]`);
            countryLabelValue.textContent = selectedItem ? selectedItem.textContent : filtersObj.originCountry;
        }

        const yrInput = document.getElementById('year-filter');
        if (yrInput) yrInput.value = filtersObj.year || '';

        updateGenreBadge(filtersObj);

    } catch (error) {
        console.error('Error rendering filters:', error);
    }
}

function updateGenreBadge(filtersObj) {
    const badge = document.getElementById('genre-count');
    if (badge) {
        const count = filtersObj.genres.length;
        badge.textContent = count > 0 ? count : '';
        badge.style.display = count > 0 ? 'block' : 'none';
    }
}

/**
 * Resets all filter values to their default states.
 * This resets checked items in the DOM and filters object.
 * @param {Object} filtersObj - The filters object to reset.
 */
function resetFilters(filtersObj) {
    filtersObj.types = ['movie', 'tv'];
    filtersObj.genres = [];
    filtersObj.certification = null;
    filtersObj.originCountry = '';
    filtersObj.sortBy = 'popularity.desc';
    filtersObj.year = null;

    document.querySelectorAll('input[name="media-type"]').forEach(cb => cb.checked = true);
    document.querySelectorAll('#sort-modal .select-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.value === 'popularity.desc');
    });
    document.querySelectorAll('#country-modal .select-item').forEach(el => {
        el.classList.toggle('selected', el.dataset.value === '');
    });
}

async function performSearch(query, reset = false) {
    if (reset) {
        currentPage = 1;
        hasMoreResults = true;
        currentQuery = query;
        isSearchMode = (query && query.trim().length > 0);
        const grid = document.getElementById('search-results');
        if (grid) grid.innerHTML = `<div class="loading-center">${getLoaderHtml()}</div>`;

        if (isSearchMode) {
            saveRecentSearch(query);
            renderRecentSearches();
        }
    }
    await fetchResults(reset);
}

/**
 * Fetches content results from the API based on current query and active filters, supporting pagination.
 * It renders the returned list of items in the search grid or displays an empty state if nothing is found.
 * @param {boolean} reset - If true, resets the grid and re-fetches from page 1.
 * @returns {Promise<void>}
 */
async function fetchResults(reset) {
    isLoading = true;
    try {
        const grid = document.getElementById('search-results');
        let results = [];

        const fetchPage = async (pageToFetch) => {
            if (isSearchMode) {
                const allResults = await Api.searchContent(currentQuery, pageToFetch);
                return allResults.filter(item => {
                    // Filter out non-media types like people/actors
                    if (item.media_type && item.media_type !== 'movie' && item.media_type !== 'tv') return false;
                    // Filter based on the selected media types
                    if (item.media_type && !currentFilters.types.includes(item.media_type)) return false;
                    if (currentFilters.genres.length > 0) {
                        if (!item.genre_ids) return false;
                        const hasGenre = currentFilters.genres.every(id => item.genre_ids.includes(id));
                        if (!hasGenre) return false;
                    }
                    if (currentFilters.year) {
                        const date = item.release_date || item.first_air_date;
                        if (!date || !date.startsWith(currentFilters.year.toString())) return false;
                    }
                    if (currentFilters.originCountry) {
                        if (!item.origin_country || !item.origin_country.includes(currentFilters.originCountry)) return false;
                    }
                    return true;
                });
            } else {
                const promises = currentFilters.types.map(type => 
                    Api.discoverContent({ ...currentFilters, type, page: pageToFetch })
                );
                const responses = await Promise.all(promises);
                const combined = responses.flat();

                // If both types are queried, we need to sort the combined list by active sorting parameter
                if (currentFilters.types.length > 1) {
                    const sortBy = currentFilters.sortBy || 'popularity.desc';
                    if (sortBy.startsWith('popularity')) {
                        combined.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
                    } else if (sortBy.startsWith('vote_average')) {
                        combined.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
                    } else if (sortBy.startsWith('primary_release_date')) {
                        combined.sort((a, b) => {
                            const dateA = a.release_date || a.first_air_date || '';
                            const dateB = b.release_date || b.first_air_date || '';
                            return dateB.localeCompare(dateA);
                        });
                    } else if (sortBy.startsWith('vote_count')) {
                        combined.sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0));
                    }
                }
                return combined;
            }
        };

        if (reset) {
            // Load 2 pages (40 items) initially to ensure the screen is filled
            const [page1Res, page2Res] = await Promise.all([
                fetchPage(1),
                fetchPage(2)
            ]);
            results = page1Res.concat(page2Res);
            currentPage = 2; // Next infinite scroll fetch will be page 3
        } else {
            results = await fetchPage(currentPage);
        }

        if (reset) grid.innerHTML = '';

        if (results.length === 0) {
            if (currentPage === 1) {
                grid.innerHTML = `<div class="empty-state" data-i18n="search.noResults">${window.i18n.t('search.noResults')}</div>`;
            }
            hasMoreResults = false;
        } else {
            renderResultItems(results, grid);
        }
    } catch (error) {
        console.error('Error fetching results:', error);
    } finally {
        isLoading = false;
    }
}

/**
 * Renders the fetched search results as focusable buttons, configuring image load bindings and watched indicator tags.
 * @param {Array<Object>} items - The list of movie/TV show objects.
 * @param {HTMLElement} container - The DOM grid container element.
 */
function renderResultItems(items, container) {
    const fragment = document.createDocumentFragment();

    items.forEach(item => {
        if (!item.poster_path) return;
        // Determine the media type fallback if missing
        let mediaType = item.media_type;
        if (!mediaType || mediaType === 'all') {
            mediaType = item.title ? 'movie' : 'tv';
        }
        const isWatched = getWatchedItem(item.id, mediaType);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'poster-wrapper focusable focusable-card';
        const img = document.createElement('img');
        img.className = 'poster-img';
        img.decoding = 'async';
        img.dataset.src = Api.getImageUrl(item.poster_path);
        img.alt = item.name || item.title;
        img.style.opacity = '0';

        btn.appendChild(img);
        if (isWatched) {
            const watched = document.createElement('div');
            watched.className = 'watched-pill';
            watched.textContent = window.i18n.t('search.watched');
            btn.appendChild(watched);
        }

        fragment.appendChild(btn);

        // Observe for lazy loading
        lazyLoader.observeItem(btn);

        btn.onclick = () => {
            Router.loadPage('details', { id: item.id, type: mediaType });
        };
    });

    container.appendChild(fragment);
}

function initInfiniteScroll() {
    const container = document.getElementById('search-results-container');
    if (!container) return;
    container.onscroll = () => {
        if (isLoading || !hasMoreResults) return;
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 300) {
            currentPage++;
            fetchResults(false);
        }
    };
}

/**
 * Retrieves the array of saved search queries from local storage.
 * @returns {Array<string>} The list of recent search queries.
 */
function getRecentSearches() {
    try {
        return JSON.parse(localStorage.getItem('ivids_recent_searches') || '[]');
    } catch { return []; }
}

/**
 * Saves a new query to the list of recent searches in local storage, maintaining a maximum of 5 unique entries.
 * @param {string} q - The search query to save.
 */
function saveRecentSearch(q) {
    if (!q || q.trim().length < 2) return;
    let recent = getRecentSearches();
    recent = recent.filter(item => item.toLowerCase() !== q.toLowerCase());
    recent.unshift(q);
    localStorage.setItem('ivids_recent_searches', JSON.stringify(recent.slice(0, 5)));
}

/**
 * Renders the saved recent searches as focusable item chips and controls the visibility of the recents container.
 */
function renderRecentSearches() {
    const row = document.getElementById('recent-searches-row');
    const list = document.getElementById('recent-list');
    if (!row || !list) return;
    const recent = getRecentSearches();
    if (recent.length === 0) {
        row.classList.add('hidden');
        return;
    }
    row.classList.remove('hidden');
    list.innerHTML = recent.map(q => `
        <div class="recent-item focusable" tabindex="0" data-query="${q}">
            <span class="recent-item-text">${q}</span>
            <span class="recent-delete-btn" title="Delete search">&times;</span>
        </div>
    `).join('');

    list.querySelectorAll('.recent-item').forEach(item => {
        item.onclick = (e) => {
            const query = item.dataset.query;
            const isDelete = e.target.closest('.recent-delete-btn') !== null;
            if (isDelete) {
                e.stopPropagation();
                removeRecentSearch(query);
            } else {
                const input = document.getElementById('search-input');
                if (input) {
                    input.value = query;
                    performSearch(query, true);
                }
            }
        };
    });
}

/**
 * Removes a specific query from the list of recent searches in local storage and manages focus.
 * @param {string} q - The search query to remove from history.
 */
function removeRecentSearch(q) {
    let recent = getRecentSearches();
    recent = recent.filter(item => item.toLowerCase() !== q.toLowerCase());
    localStorage.setItem('ivids_recent_searches', JSON.stringify(recent));
    renderRecentSearches();

    const remaining = getRecentSearches();
    if (remaining.length === 0) {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            SpatialNav.setFocus(searchInput);
        }
    } else {
        const firstRecent = document.querySelector('.recent-item');
        if (firstRecent) {
            SpatialNav.setFocus(firstRecent);
        } else {
            const clearBtn = document.getElementById('clear-recents-btn');
            if (clearBtn) SpatialNav.setFocus(clearBtn);
        }
    }
}

/**
 * Filters the visible country items in the selector list based on the search query.
 * Caches country elements to optimize DOM lookups during character typing.
 */
function filterCountries(query) {
    if (!cachedCountryItems) {
        cachedCountryItems = document.querySelectorAll('#country-options-list .select-item');
    }
    const lowerQuery = query.toLowerCase();
    cachedCountryItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        const visible = text.includes(lowerQuery);
        item.style.display = visible ? 'flex' : 'none';
        if (visible) item.classList.add('focusable');
        else item.classList.remove('focusable');
    });
}
