import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { getWatchedItem } from '../../logic/recentlyWatched.js';
import { getLoaderHtml } from '../js/loader.js';

let currentFilters = {
    type: 'movie',
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

export async function init() {
    try {
        const input = document.getElementById('search-input');
        const searchBtn = document.getElementById('search-btn');
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

        input.onchange = () => performSearch(input.value, true);
        yearInput.onchange = () => {
            pendingFilters.year = yearInput.value ? parseInt(yearInput.value) : null;
        };
        countrySearchInput.onchange = () => filterCountries(countrySearchInput.value);

        // Filter Modal Handlers
        if (filterBtn && filterModal) {
            filterBtn.onclick = () => {
                pendingFilters = JSON.parse(JSON.stringify(currentFilters));
                renderAllFilters(pendingFilters);
                filterModal.classList.add('active');
                SpatialNav.setFocusTrap(filterModal);
                const first = filterModal.querySelector('.focusable');
                if (first) SpatialNav.setFocus(first);
            };

            const applyFilters = () => {
                currentFilters = JSON.parse(JSON.stringify(pendingFilters));
                filterModal.classList.remove('active');
                SpatialNav.clearFocusTrap();
                SpatialNav.setFocus(filterBtn);
                performSearch(currentQuery, true);
            };

            const cancelFilters = () => {
                filterModal.classList.remove('active');
                SpatialNav.clearFocusTrap();
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
                genreModal.classList.add('active');
                SpatialNav.setFocusTrap(genreModal);
                const firstGenre = genreModal.querySelector('.focusable');
                if (firstGenre) SpatialNav.setFocus(firstGenre);
            };

            if (genreDoneBtn) {
                genreDoneBtn.onclick = () => {
                    genreModal.classList.remove('active');
                    if (filterModal.classList.contains('active')) {
                        SpatialNav.setFocusTrap(filterModal);
                    } else {
                        SpatialNav.clearFocusTrap();
                    }
                    SpatialNav.setFocus(genreSelectBtn);
                    updateGenreBadge(pendingFilters);
                };
            }
        }

        // Initialize Sort Modal
        if (sortByBtn && sortModal && sortConfirmBtn && sortCancelBtn) {
            let pendingSortValue = pendingFilters.sortBy;

            sortByBtn.onclick = () => {
                pendingSortValue = pendingFilters.sortBy;
                sortModal.classList.add('active');
                SpatialNav.setFocusTrap(sortModal);
                const selected = sortModal.querySelector('.select-item.selected') || sortModal.querySelector('.focusable');
                if (selected) SpatialNav.setFocus(selected);
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
                sortModal.classList.remove('active');
                if (filterModal.classList.contains('active')) {
                    SpatialNav.setFocusTrap(filterModal);
                } else {
                    SpatialNav.clearFocusTrap();
                }
                SpatialNav.setFocus(sortByBtn);
            };

            sortCancelBtn.onclick = () => {
                sortModal.classList.remove('active');
                if (filterModal.classList.contains('active')) {
                    SpatialNav.setFocusTrap(filterModal);
                } else {
                    SpatialNav.clearFocusTrap();
                }
                SpatialNav.setFocus(sortByBtn);
            };
        }

        // Initialize Country Modal
        if (countrySelectBtn && countryModal) {
            countrySelectBtn.onclick = () => {
                countryModal.classList.add('active');
                SpatialNav.setFocusTrap(countryModal);
                if (countrySearchInput) {
                    SpatialNav.setFocus(countrySearchInput);
                } else {
                    const selected = countryModal.querySelector('.select-item.selected') || countryModal.querySelector('.focusable');
                    if (selected) SpatialNav.setFocus(selected);
                }
            };

            const closeCountryModal = () => {
                countryModal.classList.remove('active');
                if (filterModal.classList.contains('active')) {
                    SpatialNav.setFocusTrap(filterModal);
                } else {
                    SpatialNav.clearFocusTrap();
                }
                SpatialNav.setFocus(countrySelectBtn);
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

        const filterCountries = (query) => {
            const items = document.querySelectorAll('#country-options-list .select-item');
            items.forEach(item => {
                const text = item.textContent.toLowerCase();
                const visible = text.includes(query.toLowerCase());
                item.style.display = visible ? 'flex' : 'none';
                if (visible) item.classList.add('focusable');
                else item.classList.remove('focusable');
            });
        };

        if (countrySearchInput) {
            countrySearchInput.oninput = () => filterCountries(countrySearchInput.value);
        }

        // Global Back Handler
        const originalOnBack = SpatialNav.onBack;
        SpatialNav.onBack = () => {
            const activeModal = document.querySelector('.modal-overlay.active:not(#filter-modal)');
            const filterModalActive = filterModal.classList.contains('active');

            if (activeModal) {
                activeModal.classList.remove('active');
                if (filterModalActive) {
                    SpatialNav.setFocusTrap(filterModal);
                    if (activeModal === genreModal) SpatialNav.setFocus(genreSelectBtn);
                    else if (activeModal === sortModal) SpatialNav.setFocus(sortByBtn);
                    else if (activeModal === countryModal) SpatialNav.setFocus(countrySelectBtn);
                } else {
                    SpatialNav.clearFocusTrap();
                }
            } else if (filterModalActive) {
                filterModal.classList.remove('active');
                SpatialNav.clearFocusTrap();
                SpatialNav.setFocus(filterBtn);
            } else if (originalOnBack) {
                originalOnBack();
            }
        };

        if (searchBtn) {
            searchBtn.onclick = () => performSearch(input ? input.value : '', true);
        }

        initInfiniteScroll();
        performSearch('', true);

    } catch (error) {
        console.error('Error in search.init:', error);
    }
}

async function renderAllFilters(filtersObj) {
    try {
        // 1. Media Type
        document.querySelectorAll('input[name="media-type"]').forEach(radio => {
            radio.checked = filtersObj.type === radio.value;
            radio.onchange = (e) => {
                filtersObj.type = e.target.value;
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

function resetFilters(filtersObj) {
    filtersObj.type = 'movie';
    filtersObj.genres = [];
    filtersObj.certification = null;
    filtersObj.originCountry = '';
    filtersObj.sortBy = 'popularity.desc';
    filtersObj.year = null;

    document.querySelectorAll('input[name="media-type"][value="movie"]').forEach(r => r.checked = true);
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

async function fetchResults(reset) {
    isLoading = true;
    try {
        const grid = document.getElementById('search-results');
        let results = [];

        if (isSearchMode) {
            const allResults = await Api.searchContent(currentQuery, currentPage);
            results = allResults.filter(item => {
                if (currentFilters.type && item.media_type && item.media_type !== currentFilters.type) return false;
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
            results = await Api.discoverContent({
                ...currentFilters,
                page: currentPage
            });
        }

        if (reset) grid.innerHTML = '';

        if (results.length === 0) {
            if (currentPage === 1) {
                grid.innerHTML = `<div class="no-results-msg" data-i18n="search.noResults">${window.i18n.t('search.noResults')}</div>`;
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

function renderResultItems(items, container) {
    items.forEach(item => {
        if (!item.poster_path) return;
        const isWatched = getWatchedItem(item.id, item.media_type || currentFilters.type);
        const watchedHtml = isWatched ? `<div class="watched-pill">${window.i18n.t('search.watched')}</div>` : '';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'poster-wrapper focusable';
        btn.innerHTML = `
            <img class="poster-img" src="${Api.getImageUrl(item.poster_path)}" alt="${item.name || item.title}">
            ${watchedHtml}
        `;

        btn.onclick = () => {
            Router.loadPage('details', { id: item.id, type: item.media_type || currentFilters.type });
        };
        container.appendChild(btn);
    });
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

function getRecentSearches() {
    try {
        return JSON.parse(localStorage.getItem('ivids_recent_searches') || '[]');
    } catch { return []; }
}

function saveRecentSearch(q) {
    if (!q || q.trim().length < 2) return;
    let recent = getRecentSearches();
    recent = recent.filter(item => item.toLowerCase() !== q.toLowerCase());
    recent.unshift(q);
    localStorage.setItem('ivids_recent_searches', JSON.stringify(recent.slice(0, 5)));
}

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
    list.innerHTML = recent.map(q => `<div class="recent-item focusable" tabindex="0">${q}</div>`).join('');
    list.querySelectorAll('.recent-item').forEach(item => {
        item.onclick = () => {
            const input = document.getElementById('search-input');
            if (input) {
                input.value = item.textContent;
                performSearch(item.textContent, true);
            }
        };
    });
}
