import { M3UParser } from '../../logic/m3u-parser.js';
import { PRESET_SOURCES } from '../../logic/livetv/sources.js';
import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { EpgManager } from '../../logic/livetv/epg-manager.js';
import { proxyUrl } from '../js/utils/proxy.js';
import { getNamespacedKey } from '../../logic/account-helper.js';

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
let genres = [];
let countries = [];
const statusCache = new Map(); // Store channel status results: url -> {status, timestamp}
let previewHls = null;
let previewTimeout = null;
let searchDebounceTimer = null;
let loadSourcesPromise = null;
const LIVE_TV_STATUS_KEY = 'ivids-live-tv-status-cache';
const STATUS_TTL_MS = 24 * 60 * 60 * 1000;
const BROKEN_CHANNELS_API_URL = '/api/broken-channels';
const brokenChannelsSet = new Set(); // Persistent broken channel URLs loaded from project file

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
    selectedChannel = null;
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
        clearBtn.style.display = 'none';
    }

    if (window.i18n) window.i18n.applyTranslations();

    EpgManager.init();

    if (allChannels.length > 0) {
        const statsInfo = document.getElementById('hero-stats-info');
        const countEl = document.getElementById('hero-total-channels');
        const totalSrcEl = document.getElementById('hero-total-sources');
        if (statsInfo && countEl && totalSrcEl) {
            countEl.textContent = `${allChannels.length} channels`;
            const sourceEntries = Object.entries(PRESET_SOURCES);
            const settings = loadMergedSettings();
            const totalSources = sourceEntries.length + (settings.m3uUrl ? 1 : 0);
            totalSrcEl.textContent = `${totalSources} sources`;
            statsInfo.style.display = 'flex';
        }
        populateFilters();
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
        for (let i = 0; i < 6; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'channel-list-item focusable is-skeleton';
            skeleton.tabIndex = 0;
            skeleton.innerHTML = `
                <span class="list-status-dot checking"></span>
                <div class="channel-list-logo-container">
                    <div class="skeleton-logo-placeholder"></div>
                </div>
                <div class="channel-list-meta-container">
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
    const list = document.getElementById('channels-list');
    const countEl = document.getElementById('hero-total-channels');

    try {
        if (empty) empty.style.display = 'none';

        // Load the broken channels database first
        await loadBrokenChannelsDb();

        const sourceEntries = Object.entries(PRESET_SOURCES);
        const settings = loadMergedSettings();
        const customPlaylists = settings.m3uPlaylists || [];
        if (customPlaylists.length > 0) {
            customPlaylists.forEach((playlist, idx) => {
                let name = 'Custom Playlist';
                try {
                    const host = new URL(playlist.url).hostname;
                    name = host ? `${host} (M3U)` : `Custom Playlist ${idx + 1}`;
                } catch (e) {
                    name = `Custom Playlist ${idx + 1}`;
                }
                sourceEntries.push([`custom_${playlist.id || idx}`, { name: name, url: playlist.url }]);
            });
        } else if (settings.m3uUrl) {
            sourceEntries.push(['custom', { name: 'Custom Playlist', url: settings.m3uUrl }]);
        }

        allChannels = [];
        const seenUrls = new Set();

        // Fetch all playlist sources in parallel to prevent sequential network blocking
        const fetchPromises = sourceEntries.map(async ([id, source]) => {
            try {
                const playlistChannels = await M3UParser.fetchPlaylist(proxyUrl(source.url));
                return { source, playlistChannels };
            } catch (err) {
                console.warn(`Failed to load source ${source.name}:`, err);
                return { source, playlistChannels: [] };
            }
        });

        const results = await Promise.all(fetchPromises);

        // Process and merge all parsed channels
        results.forEach(({ source, playlistChannels }) => {
            if (playlistChannels && playlistChannels.length > 0) {
                playlistChannels.forEach(c => {
                    if (!c.group) c.group = source.name;
                    c.sourceName = source.name;
                    c.sourcePriority = source.priority || 50;

                    const normalized = normalizeUrl(c.url);
                    if (!seenUrls.has(normalized) && !brokenChannelsSet.has(normalized)) {
                        seenUrls.add(normalized);
                        c.normalizedUrl = normalized;
                        c.searchNameLower = (c.name || '').toLowerCase();
                        c.groupTags = c.group ? c.group.split(';').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
                        allChannels.push(c);
                    }
                });
            }
        });

        allChannels.sort((a, b) => {
            const streamScoreDiff = getStreamScore(b.url) - getStreamScore(a.url);
            if (streamScoreDiff !== 0) return streamScoreDiff;
            const priorityDiff = (a.sourcePriority || 50) - (b.sourcePriority || 50);
            if (priorityDiff !== 0) return priorityDiff;
            return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: 'base' });
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

        // Populate select filters in UI
        populateFilters();

        // Show stats banner
        const statsInfo = document.getElementById('hero-stats-info');
        const totalSrcEl = document.getElementById('hero-total-sources');
        if (statsInfo && countEl && totalSrcEl) {
            countEl.textContent = `${allChannels.length} channels`;
            totalSrcEl.textContent = `${sourceEntries.length} sources`;
            statsInfo.style.display = 'flex';
        }

        if (allChannels.length === 0) {
            if (empty) empty.style.display = 'flex';
        } else {
            const currentFocused = document.querySelector('.focused');
            filterAndRenderChannels(!currentFocused);
        }
    } catch (error) {
        console.error('Error loading sources:', error);
        if (empty) empty.style.display = 'flex';
    }
}

/**
 * populateFilters function
 * ========================
 * Explains: Fills the dropdown selectors for Genre and Country with unique options 
 * parsed from IPTV channels, preserving previous selection states.
 */
function populateFilters() {
    const genreSelect = document.getElementById('filter-genre');
    const countrySelect = document.getElementById('filter-country');
    if (!genreSelect || !countrySelect) return;

    const prevGenre = genreSelect.value;
    const prevCountry = countrySelect.value;

    genreSelect.innerHTML = `<option value="">${window.i18n?.t('livetv.allGenres') || 'All Genres'}</option>`;
    countrySelect.innerHTML = `<option value="">${window.i18n?.t('livetv.allCountries') || 'All Countries'}</option>`;

    genres.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g;
        opt.textContent = g;
        if (g === prevGenre) opt.selected = true;
        genreSelect.appendChild(opt);
    });

    countries.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        if (c === prevCountry) opt.selected = true;
        countrySelect.appendChild(opt);
    });
}

/**
 * Filters the list of channels based on search query and category/country tags, then starts rendering.
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

        const matchesSearch = !searchQuery || c.searchNameLower.includes(searchLower);
        const matchesGenre = !activeGenre || c.groupTags.includes(activeGenreLower);
        const matchesCountry = !activeCountry || c.groupTags.includes(activeCountryLower);
        
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
        clearBtn.style.display = searchQuery ? 'block' : 'none';
    }

    container.innerHTML = '';
    renderedCount = 0;

    const empty = document.getElementById('no-channels-message');
    if (filteredChannels.length === 0) {
        if (empty) empty.style.display = 'flex';
    } else {
        if (empty) empty.style.display = 'none';

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
    if (content) content.style.display = 'flex';

    const epgContainer = document.getElementById('hero-epg-container');
    const epgTitleEl = document.getElementById('hero-epg-title');
    const epgStartEl = document.getElementById('hero-epg-start');
    const epgEndEl = document.getElementById('hero-epg-end');
    const epgProgressEl = document.getElementById('hero-epg-progress');
    const noEpgText = window.i18n?.t('livetv.noEpgInfo') || 'No program info available';

    if (epgContainer) {
        epgContainer.style.display = 'block';
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
            loadPreviewStream(channel.url);
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
 * Asynchronously loads the selected IPTV channel stream into the 16:9 preview video element.
 * Utilizes HLS.js for HLS (.m3u8) playback support, falling back to native HTML5 playback.
 * 
 * @param {string} url - The live stream URL of the selected channel.
 */
function loadPreviewStream(url) {
    const video = document.getElementById('livetv-preview-video');
    const loader = document.getElementById('preview-video-loading');
    if (!video) return;

    if (previewHls) {
        previewHls.destroy();
        previewHls = null;
    }

    if (loader) loader.style.display = 'flex';

    video.onloadstart = () => {
        if (loader) loader.style.display = 'flex';
    };
    video.onplaying = () => {
        if (loader) loader.style.display = 'none';
        updateChannelStatus(url, 'online');
    };
    video.onerror = () => {
        if (loader) loader.style.display = 'none';
        console.warn('Preview video playback failed for URL:', url);
        updateChannelStatus(url, 'offline');
    };
    const streamUrl = proxyUrl(url);

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
                if (loader) loader.style.display = 'none';
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
        if (loader) loader.style.display = 'none';
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
        loader.style.display = 'none';
    }
}

/**
 * playChannel function
 * ====================
 * Explains: Records the channel zapping index state variables and routes the app to the TV player.
 * 
 * @param {object} channel - Target channel item.
 */
function playChannel(channel) {
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
 * Hooks up event listeners for search input, clear button, genre/country selectors, and handles SpatialNav back actions.
 * Affects search queries, category filters, and active keyboard navigation states.
 */
function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');

    const originalBack = SpatialNav.onBack;
    SpatialNav.onBack = () => {
        const current = document.querySelector('.focused');
        const list = document.getElementById('channels-list');

        if (current && list && list.contains(current) && searchInput) {
            SpatialNav.setFocus(searchInput);
        } else if (originalBack) {
            originalBack();
        }
    };

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

    const genreSelect = document.getElementById('filter-genre');
    const countrySelect = document.getElementById('filter-country');

    if (genreSelect) {
        genreSelect.onchange = (e) => {
            activeGenre = e.target.value;
            filterAndRenderChannels(true);
        };
    }

    if (countrySelect) {
        countrySelect.onchange = (e) => {
            activeCountry = e.target.value;
            filterAndRenderChannels(true);
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

/**
 * Stores a channel playback health result and updates the status dot for that channel in the DOM.
 * Affects the statusCache map, localStorage, and active DOM list elements.
 * 
 * @param {string} url - Channel stream URL.
 * @param {string} status - The current playback status (online/offline).
 */
function updateChannelStatus(url, status) {
    if (!url) return;
    statusCache.set(url, { status, timestamp: Date.now() });
    try {
        localStorage.setItem(LIVE_TV_STATUS_KEY, JSON.stringify(Array.from(statusCache.entries())));
    } catch (error) {
        console.warn('Failed to save Live TV status cache:', error);
    }

    const row = Array.from(document.querySelectorAll('.channel-list-item'))
        .find(item => item.dataset.url === url);
    
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
 * @returns {number}
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
 * Affects the channels list container DOM and spatial navigation.
 */
function renderNextChunk() {
    if (renderedCount >= filteredChannels.length) return;

    const container = document.getElementById('channels-list');
    if (!container) return;

    const existingSentinel = document.getElementById('channels-sentinel');
    if (existingSentinel) {
        existingSentinel.remove();
    }

    const currentFocused = document.querySelector('.focused');
    const focusedUrl = currentFocused && currentFocused.dataset.url;

    const start = renderedCount;
    const end = Math.min(start + CHUNK_SIZE, filteredChannels.length);

    /** @type {DocumentFragment} Batch fragment to avoid per-item reflows when appending to live DOM. */
    const fragment = document.createDocumentFragment();
    let refocusTarget = null;

    for (let i = start; i < end; i++) {
        const channel = filteredChannels[i];
        const item = document.createElement('div');
        item.className = 'channel-list-item focusable';
        item.tabIndex = 0;
        item.dataset.url = channel.url;

        const iconUrl = channel.logo || 'images/livetv.svg';
        const status = statusCache.get(channel.url)?.status || 'unknown';
        const statusClass = status === 'online' || status === 'offline' ? status : 'checking';

        item.innerHTML = `
            <span class="list-status-dot ${statusClass}"></span>
            <div class="channel-list-logo-container">
                <img src="${iconUrl}" class="channel-list-logo" loading="lazy" onerror="this.src='images/livetv.svg'">
            </div>
            <div class="channel-list-meta-container">
                <span class="channel-list-name">${channel.name}</span>
            </div>
        `;

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
        item.onclick = () => playChannel(channel);

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
 * This ensures uniform channel matching regardless of minor URL formatting differences.
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
