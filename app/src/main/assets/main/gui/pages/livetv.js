import { M3UParser } from '../../logic/m3u-parser.js';
import { PRESET_SOURCES } from '../../logic/livetv/sources.js';
import { sourceManager } from '../../logic/livetv/core/source-manager.js';
import { StreamOptimizer } from '../../logic/livetv/core/stream-optimizer.js';
import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { EpgManager } from '../../logic/livetv/epg-manager.js';
import { proxyUrl } from '../js/utils/proxy.js';
import { getNamespacedKey } from '../../logic/account-helper.js';
import { XtreamApi } from '../../logic/livetv/xtream-api.js';

/**
 * Loads merged global and user-specific application settings from localStorage.
 * 
 * @returns {object} Combined settings object.
 */
function loadMergedSettings() {
    try {
        const globalSaved = localStorage.getItem('ivids-settings');
        const globalSettings = globalSaved ? JSON.parse(globalSaved) : {};

        const userKey = getNamespacedKey('settings');
        const userSaved = localStorage.getItem(userKey);
        const userSettings = userSaved ? JSON.parse(userSaved) : {};

        return { ...globalSettings, ...userSettings };
    } catch (e) {
        console.error('LiveTV: Error loading settings:', e);
        return {};
    }
}

let allChannels = [];
let filteredChannels = [];
let searchQuery = '';
let selectedChannel = null;
let activeGenre = '';
let activeCountry = '';
let activeQuickFilter = 'all'; // 'all', 'sports', 'favorites'
let genres = [];
let countries = [];
const statusCache = new Map(); // Store channel status results: url -> {status, timestamp}
const favoritesSet = new Set(); // Store favorite channel identifiers
let previewHls = null;
let previewTimeout = null;
let searchDebounceTimer = null;
let loadSourcesPromise = null;
let filterModalBackHandler = null;
let liveTvPageBackHandler = null;
const LIVE_TV_STATUS_KEY = 'ivids-live-tv-status-cache';
const LIVE_TV_FAVORITES_KEY = 'ivids-live-tv-favorites';
const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Extracts and formats the primary category label from a compound group string.
 * Splits semicolon-delimited or pipe-delimited category tags (e.g. 'Sports;Voetbal;Canal+')
 * and returns the first clean, human-readable segment (e.g. 'Sports').
 * @param {string|null|undefined} groupStr - Raw compound group or category string.
 * @returns {string} Clean single primary category name, or 'Live TV' if unassigned.
 */
export function formatPrimaryCategory(groupStr) {
    if (!groupStr || typeof groupStr !== 'string') return 'Live TV';
    const segments = groupStr.split(/[;|]/).map(s => s.trim()).filter(Boolean);
    return segments.length > 0 ? segments[0] : 'Live TV';
}
window.formatPrimaryCategory = formatPrimaryCategory;
const BROKEN_CHANNELS_API_URL = '/api/broken-channels';
const brokenChannelsSet = new Set(); // Persistent broken channel URLs loaded from project file

/**
 * Loads saved channel favorites from localStorage into favoritesSet.
 */
function loadFavorites() {
    favoritesSet.clear();
    try {
        const userFavKey = getNamespacedKey(LIVE_TV_FAVORITES_KEY);
        const saved = localStorage.getItem(userFavKey) || localStorage.getItem(LIVE_TV_FAVORITES_KEY);
        if (saved) {
            const list = JSON.parse(saved);
            if (Array.isArray(list)) {
                list.forEach(id => favoritesSet.add(id));
            }
        }
    } catch (e) {
        console.warn('LiveTV: Error loading favorites:', e);
    }
}

/**
 * Persists the current favoritesSet to localStorage.
 */
function saveFavorites() {
    try {
        const userFavKey = getNamespacedKey(LIVE_TV_FAVORITES_KEY);
        const data = JSON.stringify(Array.from(favoritesSet));
        localStorage.setItem(userFavKey, data);
        localStorage.setItem(LIVE_TV_FAVORITES_KEY, data);
    } catch (e) {
        console.warn('LiveTV: Error saving favorites:', e);
    }
}

/**
 * Checks whether a channel is currently marked as favorite.
 * 
 * @param {object} channel - The channel object to test.
 * @returns {boolean} True if the channel is favorited.
 */
function isChannelFavorite(channel) {
    if (!channel) return false;
    const id = channel.id || channel.url;
    return favoritesSet.has(id) || (channel.id && favoritesSet.has(channel.id)) || (channel.url && favoritesSet.has(channel.url));
}

/**
 * Toggles favorite status for a channel and updates UI state.
 * 
 * @param {object} channel - The channel object to toggle.
 */
function toggleFavorite(channel) {
    if (!channel) return;
    const id = channel.id || channel.url;
    if (!id) return;

    if (isChannelFavorite(channel)) {
        if (channel.id) favoritesSet.delete(channel.id);
        if (channel.url) favoritesSet.delete(channel.url);
    } else {
        favoritesSet.add(id);
    }
    saveFavorites();

    // Update active channel favorite icon in preview if matching
    if (selectedChannel && (selectedChannel.id === channel.id || selectedChannel.url === channel.url)) {
        updatePreviewFavoriteButton(channel);
    }

    // If currently filtering by favorites, re-filter list
    if (activeQuickFilter === 'favorites') {
        filterAndRenderChannels(false);
    } else {
        // Update favorite button inside existing card in DOM
        const escapedUrl = channel.url ? channel.url.replace(/"/g, '\\"') : '';
        const card = document.querySelector(`.channel-card[data-url="${escapedUrl}"]`);
        if (card) {
            const favImg = card.querySelector('.channel-card__fav-btn img');
            const isFav = isChannelFavorite(channel);
            if (favImg) {
                favImg.src = isFav ? 'images/star-filled.svg' : 'images/star.svg';
            }
            card.classList.toggle('is-favorite', isFav);
        }
    }
}

let renderedCount = 0;
const CHUNK_SIZE = 30;

// Explains: Curated set of lowercase country tags commonly found in international IPTV lists.
const countriesList = new Set([
    'albania', 'andorra', 'slovakia', 'slovak', 'czech', 'czechia', 'poland', 'polish', 
    'hungary', 'hungarian', 'romania', 'romanian', 'bulgaria', 'bulgarian', 'greece', 'greek', 
    'turkey', 'turkish', 'russia', 'russian', 'ukraine', 'ukr', 'ukrainian', 'germany', 'german', 
    'austria', 'austrian', 'switzerland', 'swiss', 'france', 'french', 'belgium', 'belgian', 
    'netherlands', 'dutch', 'united kingdom', 'uk', 'england', 'ireland', 'irish', 'spain', 
    'spanish', 'portugal', 'portuguese', 'italy', 'italian', 'sweden', 'swedish', 'norway', 
    'norwegian', 'denmark', 'danish', 'finland', 'finnish', 'iceland', 'estonia', 'latvia', 
    'lithuania', 'united states', 'usa', 'us', 'canada', 'canadian', 'australia', 'new zealand', 
    'japan', 'japanese', 'china', 'chinese', 'korea', 'korean', 'india', 'indian', 'brazil', 
    'brazilian', 'argentina', 'mexico', 'chile', 'colombia', 'peru', 'venezuela', 'arab', 
    'arabic', 'egypt', 'saudi', 'uae', 'israel', 'hebrew', 'iran', 'persian', 'pakistan', 
    'vietnam', 'thailand', 'indonesia', 'philippines', 'africa', 'south africa'
]);

/**
 * Initializes the Live TV list page, resetting state variables, clearing active preview,
 * setting up event listeners, and starting IPTV playlist loading in the background.
 * Affects the global page states, SpatialNav focus, EpgManager, and starts loading all playlist sources.
 * 
 * @param {object} params - Routing parameters.
 */
export async function init(params) {
    console.log('Live TV List UI initializing...');

    // Reset state variables to prevent carry-over from cached ES modules when returning from player
    searchQuery = '';
    activeGenre = '';
    activeCountry = '';
    activeQuickFilter = 'all';
    selectedChannel = null;
    loadFavorites();
    loadStatusCache();

    // Reset any active preview player resource from a previous page session
    cleanupPreview();

    // Wrap Router.loadPage and Router.goBack to cleanup before navigation
    const originalLoadPage = Router.loadPage;
    const originalGoBack = Router.goBack;

    /**
     * Restores the original Router methods in place of the page-specific wrappers.
     * Prevents navigation memory leaks and cleans up the modified global Router state.
     */
    const restoreRouter = () => {
        Router.loadPage = originalLoadPage;
        Router.goBack = originalGoBack;
        if (filterModalBackHandler) {
            SpatialNav.popBackHandler(filterModalBackHandler);
            filterModalBackHandler = null;
        }
        if (liveTvPageBackHandler) {
            SpatialNav.popBackHandler(liveTvPageBackHandler);
            liveTvPageBackHandler = null;
        }

    };

    /**
     * Wraps Router.loadPage to cleanup the preview player and verifier before navigating.
     * Ensures all HLS streams and background fetches are terminated before loading the new page.
     */
    Router.loadPage = async function(pageName, params, addToHistory, targetFocus) {
        cleanupPreview();
        restoreRouter();
        return originalLoadPage.call(Router, pageName, params, addToHistory, targetFocus);
    };

    /**
     * Wraps Router.goBack to cleanup the preview player before navigating back.
     * Ensures all HLS streams are terminated before returning.
     */
    Router.goBack = function(fallbackPage, fallbackParams) {
        cleanupPreview();
        restoreRouter();
        return originalGoBack.call(Router, fallbackPage, fallbackParams);
    };

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.value = '';
    }
    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) {
        clearBtn.classList.add('hidden');
    }

    if (window.i18n) window.i18n.applyTranslations();

    EpgManager.init();

    if (allChannels.length > 0) {
        const statsInfo = document.getElementById('hero-stats-info');
        const countEl = document.getElementById('hero-total-channels');
        let settings;

        const totalSrcEl = document.getElementById('hero-total-sources');
        if (statsInfo && countEl && totalSrcEl) {
            countEl.textContent = `${allChannels.length} channels`;
            settings = loadMergedSettings();
            sourceManager.registerDefaultProviders(settings);
            let initialRenderDone = false;
        allChannels = await sourceManager.loadAllChannels(brokenChannelsSet, false, (progressChannels) => {
            allChannels = progressChannels;
            if (!initialRenderDone && allChannels.length > 0) {
                initialRenderDone = true;
                const currentFocused = document.querySelector('.focused');
                filterAndRenderChannels(!currentFocused);
            }
        });
            settings = loadMergedSettings();
            const totalSources = sourceManager.getProviderCount();
            totalSrcEl.textContent = `${totalSources} sources`;
            statsInfo.style.display = 'flex';
        }
        populateFilterModal();
        filterAndRenderChannels(true);
        setupEventListeners();
        SpatialNav.focusFirst();
        return;
    }

    // Set up interactive elements and render skeleton loader immediately
    renderLoadingSkeletons();
    setupEventListeners();

    // Start background source loading without blocking the router transition
    if (!loadSourcesPromise) {
        loadSourcesPromise = loadAllSources().then(() => {
            loadSourcesPromise = null;
            if (Router.currentPage === 'livetv') {
                SpatialNav.focusFirst();
            }
        }).catch(err => {
            loadSourcesPromise = null;
            console.error('Error in background source loading:', err);
        });
    }

    SpatialNav.focusFirst();
}

/**
 * Renders channel skeleton placeholders in the UI to indicate loading progress.
 * Affects the `#channels-list` DOM element.
 */
function renderLoadingSkeletons() {
    const list = document.getElementById('channels-list');
    if (list) {
        list.innerHTML = '';
        for (let i = 0; i < 8; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'channel-card card is-skeleton';
            skeleton.innerHTML = `
                <span class="list-status-dot checking"></span>
                <div class="channel-card__logo-wrap channel-list-logo-container">
                    <div class="skeleton-logo-placeholder"></div>
                </div>
                <div class="channel-card__meta channel-list-meta-container">
                    <div class="skeleton-text skeleton-name"></div>
                </div>
            `;
            list.appendChild(skeleton);
        }
    }
}

/**
 * Asynchronously loads M3U channel lists from preset and custom playlist URLs, skipping known broken channels.
 * Affects the global allChannels array, seenUrls set, and triggers filtered channel rendering.
 */
async function loadAllSources() {
    const empty = document.getElementById('no-channels-message');
    const countEl = document.getElementById('hero-total-channels');
    let settings;

    try {
        if (empty) empty.classList.add('hidden');

        // Load the broken channels database first
        await loadBrokenChannelsDb();

        settings = loadMergedSettings();
        sourceManager.registerDefaultProviders(settings);
        let initialRenderDone = false;
        allChannels = await sourceManager.loadAllChannels(brokenChannelsSet, false, (progressChannels) => {
            allChannels = progressChannels;
            if (!initialRenderDone && allChannels.length > 0) {
                initialRenderDone = true;
                const currentFocused = document.querySelector('.focused');
                filterAndRenderChannels(!currentFocused);
            }
        });

        // Extract unique genres and countries
        const genresSet = new Set();
        const countriesSet = new Set();
        allChannels.forEach(c => {
            if (c.group) {
                const tags = c.group.split(';').map(t => t.trim()).filter(Boolean);
                tags.forEach(tag => {
                    if (countriesList.has(tag.toLowerCase())) {
                        countriesSet.add(tag);
                    } else {
                        genresSet.add(tag);
                    }
                });
            }
        });
        genres = Array.from(genresSet).sort();
        countries = Array.from(countriesSet).sort();

        // Populate modern filter dialog chips
        populateFilterModal();

        // Show stats banner if present
        const statsInfo = document.getElementById('hero-stats-info');
        const totalSrcEl = document.getElementById('hero-total-sources');
        if (statsInfo && countEl && totalSrcEl) {
            countEl.textContent = `${allChannels.length} channels`;
            totalSrcEl.textContent = `${sourceManager.getProviderCount()} sources`;
            statsInfo.style.display = 'flex';
        }

        if (allChannels.length === 0) {
            if (empty) empty.classList.remove('hidden');
        } else {
            const currentFocused = document.querySelector('.focused');
            filterAndRenderChannels(!currentFocused);
        }
    } catch (error) {
        console.error('Error loading sources:', error);
        if (empty) empty.classList.remove('hidden');
    }
}

/**
 * Populates modern filter modal chips for genres and countries.
 */
function populateFilterModal() {
    const genreContainer = document.getElementById('filter-genre-chips');
    const countryContainer = document.getElementById('filter-country-chips');
    const genreCountEl = document.getElementById('genre-filter-count');
    const countryCountEl = document.getElementById('country-filter-count');

    if (genreCountEl) {
        genreCountEl.textContent = genres.length ? `${genres.length}` : '';
    }
    if (countryCountEl) {
        countryCountEl.textContent = countries.length ? `${countries.length}` : '';
    }

    if (genreContainer) {
        genreContainer.innerHTML = '';
        genres.forEach(g => {
            const chip = document.createElement('button');
            chip.className = `chip chip--filter focusable ${g.toLowerCase() === activeGenre.toLowerCase() ? 'active' : ''}`;
            chip.tabIndex = 0;
            chip.dataset.genre = g;
            chip.textContent = g;
            chip.onclick = () => {
                if (chip.classList.contains('active')) {
                    chip.classList.remove('active');
                } else {
                    genreContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
                    chip.classList.add('active');
                }
            };
            genreContainer.appendChild(chip);
        });
    }

    if (countryContainer) {
        countryContainer.innerHTML = '';
        countries.forEach(c => {
            const chip = document.createElement('button');
            chip.className = `chip chip--filter focusable ${c.toLowerCase() === activeCountry.toLowerCase() ? 'active' : ''}`;
            chip.tabIndex = 0;
            chip.dataset.country = c;
            chip.textContent = c;
            chip.onclick = () => {
                if (chip.classList.contains('active')) {
                    chip.classList.remove('active');
                } else {
                    countryContainer.querySelectorAll('.chip').forEach(ch => ch.classList.remove('active'));
                    chip.classList.add('active');
                }
            };
            countryContainer.appendChild(chip);
        });
    }

    updateActiveFilterBadge();
}

/**
 * Updates the filter button badge count indicating applied filters.
 */
function updateActiveFilterBadge() {
    const badge = document.getElementById('active-filter-badge');
    if (!badge) return;

    let count = 0;
    if (activeGenre) count++;
    if (activeCountry) count++;

    if (count > 0) {
        badge.textContent = count.toString();
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
}

/**
 * Opens the modern Live TV filter modal, pushes modal back handler to SpatialNav, and focuses on apply button.
 */
function openFilterModal() {
    const modal = document.getElementById('livetv-filter-modal');
    if (!modal) return;

    populateFilterModal();
    modal.classList.add('active');

    if (!filterModalBackHandler) {
        filterModalBackHandler = () => {
            closeFilterModal();
            return true;
        };
        SpatialNav.pushBackHandler(filterModalBackHandler);
    }

    const firstTarget = modal.querySelector('.chip.active') || document.getElementById('filter-apply-btn');
    if (firstTarget) {
        SpatialNav.setFocus(firstTarget);
    }
}

/**
 * Closes the Live TV filter modal, pops the modal back handler, and restores focus to filter button.
 */
function closeFilterModal() {
    const modal = document.getElementById('livetv-filter-modal');
    if (!modal) return;

    modal.classList.remove('active');
    if (filterModalBackHandler) {
        SpatialNav.popBackHandler(filterModalBackHandler);
        filterModalBackHandler = null;
    }
    const filterBtn = document.getElementById('livetv-filter-btn');
    if (filterBtn) {
        SpatialNav.setFocus(filterBtn);
    }
}
window.livetvCloseFilterModal = closeFilterModal;

/**
 * Applies selected filter chips from the modal and refreshes channel list.
 */
function applyFilters() {
    const genreActive = document.querySelector('#filter-genre-chips .chip.active');
    const countryActive = document.querySelector('#filter-country-chips .chip.active');

    activeGenre = genreActive ? genreActive.dataset.genre : '';
    activeCountry = countryActive ? countryActive.dataset.country : '';

    updateActiveFilterBadge();
    closeFilterModal();
    filterAndRenderChannels(true);
}

/**
 * Clears all active filters in the modal and resets channel list.
 */
function clearFilters() {
    const modal = document.getElementById('livetv-filter-modal');
    if (modal) {
        modal.querySelectorAll('.chip.active').forEach(c => c.classList.remove('active'));
    }
    activeGenre = '';
    activeCountry = '';
    updateActiveFilterBadge();
    closeFilterModal();
    filterAndRenderChannels(true);
}

/**
 * Sets the active quick filter pill and refreshes the channel list.
 * 
 * @param {'all' | 'sports' | 'favorites'} filterType - Active quick filter category.
 */
function setQuickFilter(filterType) {
    activeQuickFilter = filterType;

    const pills = document.querySelectorAll('.livetv-quick-filters .chip');
    pills.forEach(pill => {
        if (pill.dataset.filter === filterType) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });

    filterAndRenderChannels(true);
}

/**
 * Filters the list of channels based on search query, quick filter, and genre/country tags, then renders.
 * Affects the global filteredChannels array and the active channels list DOM container.
 * 
 * @param {boolean} resetFocus - Resets navigation focus to the first card if true.
 */
function filterAndRenderChannels(resetFocus = false) {
    const container = document.getElementById('channels-list');
    if (!container) return;

    const searchLower = searchQuery.toLowerCase();
    const activeGenreLower = activeGenre.toLowerCase();
    const activeCountryLower = activeCountry.toLowerCase();

    filteredChannels = allChannels.filter(c => {
        // Channels in the persistent broken DB are always excluded
        if (brokenChannelsSet.has(c.normalizedUrl)) return false;

        // Quick filter conditions
        if (activeQuickFilter === 'favorites') {
            if (!isChannelFavorite(c)) return false;
        } else if (activeQuickFilter === 'sports') {
            const isSportsChannel = Boolean(
                c.isSports || 
                (c.groupTags && (c.groupTags.includes('sports') || c.groupTags.includes('football') || c.groupTags.includes('voetbal') || c.groupTags.includes('canal+'))) ||
                (c.name && /sport|canal\+|voetbal|football|live match/i.test(c.name))
            );
            if (!isSportsChannel) return false;
        }

        const matchesSearch = !searchQuery || (c.searchNameLower && c.searchNameLower.includes(searchLower)) || (c.name && c.name.toLowerCase().includes(searchLower));
        const matchesGenre = !activeGenre || (c.groupTags && c.groupTags.includes(activeGenreLower)) || (c.group && c.group.toLowerCase().includes(activeGenreLower));
        const matchesCountry = !activeCountry || (c.groupTags && c.groupTags.includes(activeCountryLower)) || (c.group && c.group.toLowerCase().includes(activeCountryLower));
        
        return matchesSearch && matchesGenre && matchesCountry;
    });

    // Update shared window state for Zapping features in tv-player page
    window.liveTvState = {
        channels: filteredChannels,
        currentIndex: 0
    };

    // Toggle search clear button visibility
    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) {
        clearBtn.classList.toggle('hidden', !searchQuery);
    }

    container.innerHTML = '';
    renderedCount = 0;

    const empty = document.getElementById('no-channels-message');
    if (filteredChannels.length === 0) {
        if (empty) empty.classList.remove('hidden');
    } else {
        if (empty) empty.classList.add('hidden');

        renderNextChunk();

        if (resetFocus && !document.querySelector('.focused')) {
            SpatialNav.focusFirst();
        }
    }
}

/**
 * Updates the preview column layout with the selected channel's EPG details and triggers debounced livestream playback.
 * Affects the EPG and upcoming show list elements, as well as the active video preview player.
 * 
 * @param {object} channel - The selected channel object to view.
 */
async function showChannelDetail(channel) {
    selectedChannel = channel;
    const placeholder = document.getElementById('hero-placeholder');
    const content = document.getElementById('hero-active-content');

    if (placeholder) placeholder.style.display = 'none';
    if (content) content.classList.remove('hidden');

    // Update Preview Card Header metadata
    const nameEl = document.getElementById('preview-channel-name');
    const groupEl = document.getElementById('preview-channel-group');
    if (nameEl) nameEl.textContent = channel.name;
    if (groupEl) groupEl.textContent = formatPrimaryCategory(channel.group);

    // Update Favorite Button in Preview Card
    updatePreviewFavoriteButton(channel);

    // Bind Watch Fullscreen CTA
    const watchBtn = document.getElementById('preview-watch-btn');
    if (watchBtn) {
        watchBtn.onclick = () => playChannel(channel);
    }

    // Bind Preview Favorite Button
    const favBtn = document.getElementById('preview-fav-btn');
    if (favBtn) {
        favBtn.onclick = () => toggleFavorite(channel);
    }

    const epgContainer = document.getElementById('hero-epg-container');
    const epgTitleEl = document.getElementById('hero-epg-title');
    const epgStartEl = document.getElementById('hero-epg-start');
    const epgEndEl = document.getElementById('hero-epg-end');
    const epgProgressEl = document.getElementById('hero-epg-progress');
    const noEpgText = window.i18n?.t('livetv.noEpgInfo') || 'No program info available';

    if (epgContainer) {
        epgContainer.classList.remove('hidden');
        if (epgTitleEl) epgTitleEl.textContent = window.i18n?.t('livetv.loading') || 'Loading channels...';
        if (epgStartEl) epgStartEl.textContent = '--:--';
        if (epgEndEl) epgEndEl.textContent = '--:--';
        if (epgProgressEl) epgProgressEl.style.width = '0%';
    }

    // Populate Upcoming Programs list
    const upcomingListEl = document.getElementById('upcoming-programs-list');
    if (upcomingListEl) {
        upcomingListEl.innerHTML = `<div class="upcoming-program-row"><span class="upcoming-program-title">${noEpgText}</span></div>`;
    }

    // Debounce stream playback to prevent network overload when zapping/scrolling quickly.
    if (previewTimeout) {
        clearTimeout(previewTimeout);
    }
    const video = document.getElementById('livetv-preview-video');
    if (video) {
        video.pause();
        video.src = '';
    }
    previewTimeout = setTimeout(() => {
        if (selectedChannel && selectedChannel.url === channel.url) {
            loadPreviewStream(channel);
        }
    }, 450);

    const [epg, upcomingShows] = await Promise.all([
        EpgManager.getCurrentProgram(channel.name, channel.group, channel.tvgId),
        EpgManager.getUpcomingPrograms(channel.name, channel.group, 3, channel.tvgId)
    ]);

    if (!selectedChannel || selectedChannel.url !== channel.url) return;

    if (epgContainer) {
        if (epgTitleEl) epgTitleEl.textContent = epg.title;
        if (epgStartEl) epgStartEl.textContent = epg.start;
        if (epgEndEl) epgEndEl.textContent = epg.end;
        if (epgProgressEl) epgProgressEl.style.width = `${epg.progress}%`;
    }

    if (upcomingListEl) {
        upcomingListEl.innerHTML = '';
        if (upcomingShows.length === 0) {
            const row = document.createElement('div');
            row.className = 'upcoming-program-row';
            row.innerHTML = `<span class="upcoming-program-title">${noEpgText}</span>`;
            upcomingListEl.appendChild(row);
        } else {
            upcomingShows.forEach(show => {
                const row = document.createElement('div');
                row.className = 'upcoming-program-row';
                row.innerHTML = `
                    <span class="upcoming-program-time">${show.start} - ${show.end}</span>
                    <span class="upcoming-program-title">${show.title}</span>
                `;
                upcomingListEl.appendChild(row);
            });
        }
    }
}

/**
 * Updates the favorite icon inside the preview card.
 * 
 * @param {object} channel - The channel object to reflect.
 */
function updatePreviewFavoriteButton(channel) {
    const favIcon = document.getElementById('preview-fav-icon');
    if (favIcon) {
        const isFav = isChannelFavorite(channel);
        favIcon.src = isFav ? 'images/star-filled.svg' : 'images/star.svg';
    }
}

/**
 * Asynchronously loads the selected IPTV channel stream into the 16:9 preview video element.
 * Utilizes StreamOptimizer for URL normalization, header spoofing, and HLS.js for playback.
 * 
 * @param {object|string} channel - Channel object or stream URL.
 */
function loadPreviewStream(channel) {
    const url = typeof channel === 'string' ? channel : channel?.url;
    const headers = typeof channel === 'object' ? channel?.headers : {};
    const video = document.getElementById('livetv-preview-video');
    const loader = document.getElementById('preview-video-loading');
    if (!video || !url) return;

    if (previewHls) {
        previewHls.destroy();
        previewHls = null;
    }

    if (loader) loader.classList.remove('hidden');

    video.onloadstart = () => {
        if (loader) loader.classList.remove('hidden');
    };
    video.onplaying = () => {
        if (loader) loader.classList.add('hidden');
        updateChannelStatus(url, 'online');
    };
    video.onerror = () => {
        if (loader) loader.classList.add('hidden');
        console.warn('Preview video playback failed for URL:', url);
        updateChannelStatus(url, 'offline');
    };

    const streamUrl = StreamOptimizer.getProxiedStreamUrl ? StreamOptimizer.getProxiedStreamUrl(url, headers) : proxyUrl(url);

    if (window.Hls && window.Hls.isSupported()) {
        previewHls = new window.Hls({
            maxMaxBufferLength: 5,
            maxBufferLength: 3,
            liveSyncDurationCount: 2,
            initialLiveManifestSize: 2,
            enableWorker: true,
            lowLatencyMode: true
        });
        previewHls.loadSource(streamUrl);
        previewHls.attachMedia(video);
        previewHls.on(window.Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(e => console.warn('Error starting HLS preview video:', e));
        });
        previewHls.on(window.Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                if (loader) loader.classList.add('hidden');
                updateChannelStatus(url, 'offline');
                if (previewHls) {
                    previewHls.destroy();
                    previewHls = null;
                }
            }
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.play().catch(e => console.warn('Error starting native preview video:', e));
    } else {
        if (loader) loader.classList.add('hidden');
        console.error('HLS playback is not supported in this browser environment.');
    }
}

/**
 * Releases playback resources, destroys the preview HLS instance, and clears the video element's source.
 * Affects the global HLS and timeout state variables, and terminates active background video streaming.
 */
function cleanupPreview() {
    if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
    }
    if (previewHls) {
        previewHls.destroy();
        previewHls = null;
    }
    const video = document.getElementById('livetv-preview-video');
    if (video) {
        video.pause();
        video.src = '';
        try {
            video.load();
        } catch (e) {
            console.error('Error clearing preview video:', e);
        }
    }
    const loader = document.getElementById('preview-video-loading');
    if (loader) {
        loader.classList.add('hidden');
    }
}

/**
 * Records the channel zapping index state variables and routes the app to the TV player.
 * 
 * @param {object} channel - Target channel item.
 */
function playChannel(channel) {
    if (!channel || !channel.url) return;
    const index = filteredChannels.findIndex(c => c.url === channel.url);
    window.liveTvState = {
        channels: filteredChannels,
        currentIndex: index >= 0 ? index : 0
    };

    Router.loadPage('tv-player', {
        url: channel.url,
        title: channel.name,
        group: channel.group,
        tvgId: channel.tvgId
    });
}

/**
 * Hooks up event listeners for search input, clear button, quick filters, modal triggers, and spatial nav.
 * Affects search queries, category filters, and active keyboard navigation states.
 */
function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');
    const filterBtn = document.getElementById('livetv-filter-btn');
    const applyBtn = document.getElementById('filter-apply-btn');
    const clearFiltersBtn = document.getElementById('filter-clear-btn');
    const cancelBtn = document.getElementById('filter-cancel-btn');

    if (!liveTvPageBackHandler) {
        liveTvPageBackHandler = () => {
            const modal = document.getElementById('livetv-filter-modal');
            if (modal && modal.classList.contains('active')) {
                closeFilterModal();
                return true;
            }

            const current = document.querySelector('.focused');
            const list = document.getElementById('channels-list');

            if (current && list && list.contains(current) && searchInput) {
                SpatialNav.setFocus(searchInput);
                return true;
            }
            return false;
        };
        SpatialNav.pushBackHandler(liveTvPageBackHandler);
    }



    if (filterBtn) {
        filterBtn.onclick = () => openFilterModal();
    }
    if (applyBtn) {
        applyBtn.onclick = () => applyFilters();
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.onclick = () => clearFilters();
    }
    if (cancelBtn) {
        cancelBtn.onclick = () => closeFilterModal();
    }

    // Quick filter pills setup
    const pillAll = document.getElementById('pill-all');
    const pillSports = document.getElementById('pill-sports');
    const pillFavs = document.getElementById('pill-favorites');
    if (pillAll) pillAll.onclick = () => setQuickFilter('all');
    if (pillSports) pillSports.onclick = () => setQuickFilter('sports');
    if (pillFavs) pillFavs.onclick = () => setQuickFilter('favorites');

    if (searchInput) {
        /**
         * Debounces search input to avoid re-filtering and re-rendering the channel list on every keystroke.
         * Waits 300ms after the user stops typing before triggering the filter.
         */
        searchInput.oninput = (e) => {
            searchQuery = e.target.value;
            if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                filterAndRenderChannels(false);
            }, 300);
        };

        searchInput.onclick = () => {
            searchInput.readOnly = false;
            searchInput.focus();
        };

        searchInput.onblur = () => {
            searchInput.readOnly = true;
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            searchQuery = '';
            if (searchInput) {
                searchInput.value = '';
            }
            filterAndRenderChannels(true);
            if (searchInput) {
                SpatialNav.setFocus(searchInput);
            }
        };
    }

    const scrollContainer = document.querySelector('.livetv-list-column');
    if (scrollContainer) {
        /**
         * Detects when the user scrolls near the bottom of the list.
         * Triggers rendering of the next pagination chunk of channels.
         */
        scrollContainer.onscroll = () => {
            if (scrollContainer.scrollTop + scrollContainer.clientHeight >= scrollContainer.scrollHeight - 150) {
                renderNextChunk();
            }
        };
    }
}

/**
 * Loads cached channel health, dropping stale entries.
 */
function loadStatusCache() {
    statusCache.clear();
    try {
        const entries = JSON.parse(localStorage.getItem(LIVE_TV_STATUS_KEY) || '[]');
        entries.forEach(([url, value]) => {
            if (value && Date.now() - value.timestamp < STATUS_TTL_MS) {
                statusCache.set(url, value);
            }
        });
    } catch (error) {
        console.warn('Failed to load Live TV status cache:', error);
    }
}

let _saveStatusCacheTimer = null;

/**
 * Debounces writing the statusCache Map to localStorage to avoid synchronous disk I/O during rapid status checks.
 */
function scheduleSaveStatusCache() {
    if (_saveStatusCacheTimer) return;
    _saveStatusCacheTimer = setTimeout(() => {
        _saveStatusCacheTimer = null;
        try {
            localStorage.setItem(LIVE_TV_STATUS_KEY, JSON.stringify(Array.from(statusCache.entries())));
        } catch (error) {
            console.warn('Failed to save Live TV status cache:', error);
        }
    }, 1500);
}

/**
 * Stores a channel playback health result and updates the status dot for that channel in the DOM.
 * Affects the statusCache map, debounces localStorage writes, and updates active DOM list elements.
 * 
 * @param {string} url - Channel stream URL.
 * @param {string} status - The current playback status (online/offline).
 */
function updateChannelStatus(url, status) {
    if (!url) return;
    statusCache.set(url, { status, timestamp: Date.now() });
    scheduleSaveStatusCache();

    const escapedUrl = url.replace(/"/g, '\\"');
    const row = document.querySelector(`.channel-card[data-url="${escapedUrl}"], .channel-list-item[data-url="${escapedUrl}"]`);
    
    if (row) {
        const dot = row.querySelector('.list-status-dot');
        if (dot) {
            dot.classList.remove('checking', 'online', 'offline');
            dot.classList.add(status);
        }
    }
}

/**
 * Scores streams so HLS/HTTPS candidates appear before weaker UDP or opaque URLs.
 *
 * @param {string} url - Stream URL.
 * @returns {number} Stream score weight.
 */
function getStreamScore(url) {
    const value = (url || '').toLowerCase();
    let score = 0;
    if (value.startsWith('https://')) score += 2;
    if (value.includes('.m3u8')) score += 4;
    if (value.includes('/udp/') || value.startsWith('rtmp://')) score -= 6;
    return score;
}

/**
 * Renders the next batch of channels and updates the list pagination state.
 * Uses OOCSS .channel-card markup and binds spatial navigation and favorite triggers.
 */
function renderNextChunk() {
    if (renderedCount >= filteredChannels.length) return;

    const container = document.getElementById('channels-list');
    if (!container) return;

    const currentFocused = document.querySelector('.focused');
    const focusedUrl = currentFocused && currentFocused.dataset.url;

    const start = renderedCount;
    const end = Math.min(start + CHUNK_SIZE, filteredChannels.length);

    /** @type {DocumentFragment} Batch fragment to avoid per-item reflows when appending to live DOM. */
    const fragment = document.createDocumentFragment();
    let refocusTarget = null;

    for (let i = start; i < end; i++) {
        const channel = filteredChannels[i];
        const isFav = isChannelFavorite(channel);
        const item = document.createElement('div');
        item.className = `channel-card card card--interactive focusable ${isFav ? 'is-favorite' : ''}`;
        item.tabIndex = 0;
        item.dataset.url = channel.url;

        const iconUrl = channel.logo || 'images/livetv.svg';
        const status = statusCache.get(channel.url)?.status || 'unknown';
        const statusClass = status === 'online' || status === 'offline' ? status : 'checking';

        item.innerHTML = `
            <span class="list-status-dot ${statusClass}"></span>
            <div class="channel-card__logo-wrap channel-list-logo-container">
                <img src="${iconUrl}" class="channel-card__logo channel-list-logo" loading="lazy" onerror="this.src='images/livetv.svg'">
            </div>
            <div class="channel-card__meta channel-list-meta-container">
                <span class="channel-card__title channel-list-name">${channel.name}</span>
            </div>
        `;

        item.onkeydown = (e) => {
            if (e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                e.stopPropagation();
                toggleFavorite(channel);
            }
        };

        /**
         * Triggers loading channel EPG details on focus.
         * Renders the next pagination chunk early when D-pad focus gets close to the end of the current chunk.
         */
        item.onfocus = () => {
            showChannelDetail(channel);
            if (i >= renderedCount - 5) {
                renderNextChunk();
            }
        };

        item.onclick = () => {
            playChannel(channel);
        };

        fragment.appendChild(item);

        if (focusedUrl === channel.url) {
            refocusTarget = item;
        }
    }

    container.appendChild(fragment);

    if (refocusTarget) {
        SpatialNav.setFocus(refocusTarget);
    }

    renderedCount = end;
}

/**
 * Normalizes a URL by stripping its scheme (http/https), trailing slashes, and leading/trailing whitespace.
 * 
 * @param {string} url - The URL to normalize.
 * @returns {string} The normalized URL.
 */
function normalizeUrl(url) {
    if (!url) return '';
    return url.trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/+$/, '');
}

/**
 * Fetches the persistent broken channels database from the project file.
 * Populates brokenChannelsSet so known-broken URLs are instantly filtered out.
 */
async function loadBrokenChannelsDb() {
    try {
        const response = await fetch(`${BROKEN_CHANNELS_API_URL}?_=${Date.now()}`);
        if (!response.ok) {
            // Fallback: try loading the static JSON file directly (for Android / non-PC builds)
            const fallback = await fetch(`../../logic/livetv/broken-channels.json?_=${Date.now()}`);
            if (fallback.ok) {
                const urls = await fallback.json();
                urls.forEach(url => brokenChannelsSet.add(normalizeUrl(url)));
            }
            return;
        }
        const urls = await response.json();
        urls.forEach(url => brokenChannelsSet.add(normalizeUrl(url)));
        console.log(`[LiveTV] Loaded ${brokenChannelsSet.size} known broken channels from database.`);
    } catch (error) {
        console.warn('Failed to load broken channels database:', error);
    }
}
