import { M3UParser } from '../../logic/m3u-parser.js';
import { PRESET_SOURCES } from '../../logic/livetv/sources.js';
import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { EpgManager } from '../../logic/livetv/epg-manager.js';
import { proxyUrl } from '../js/utils/proxy.js';

let allChannels = [];
let filteredChannels = [];
let searchQuery = '';
let selectedChannel = null;
let hideBroken = true;
let activeGenre = '';
let activeCountry = '';
let genres = [];
let countries = [];
const statusCache = new Map(); // Store channel status results: url -> {status, timestamp}
let previewHls = null;
let previewTimeout = null;
const LIVE_TV_SETTINGS_KEY = 'ivids-live-tv-settings';
const LIVE_TV_STATUS_KEY = 'ivids-live-tv-status-cache';
const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

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
 * init function
 * =============
 * Explains: Initializes the Live TV grid page, loads translation mappings,
 * loads M3U playlists, sets up action listeners, and initiates focus.
 * 
 * @param {object} params - Routing parameters.
 */
export async function init(params) {
    console.log('Live TV Grid UI initializing...');

    // Reset state variables to prevent carry-over from cached ES modules when returning from player
    searchQuery = '';
    activeGenre = '';
    activeCountry = '';
    selectedChannel = null;
    hideBroken = loadLiveTvSettings().hideBroken;
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
     * Wraps Router.loadPage to cleanup the preview player before navigating.
     * Ensures all HLS streams are terminated before loading the new page.
     */
    Router.loadPage = async function(pageName, params, addToHistory, targetFocus) {
        cleanupPreview();
        restoreRouter();
        return originalLoadPage.call(Router, pageName, params, addToHistory, targetFocus);
    };

    /**
     * Wraps Router.goBack to cleanup the preview player before navigating back.
     * Ensures all HLS streams are terminated before returning to the previous page.
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
    await loadAllSources();
    setupEventListeners();
    SpatialNav.focusFirst();
}

/**
 * Asynchronously loads M3U channel lists from preset and custom playlist URLs, rendering a skeleton UI during load.
 * Affects the global channel state and initializes search category parameters.
 */
async function loadAllSources() {
    const empty = document.getElementById('no-channels-message');
    const list = document.getElementById('channels-list');
    const countEl = document.getElementById('hero-total-channels');

    try {
        if (empty) empty.style.display = 'none';
        if (list) {
            list.innerHTML = '';
            for (let i = 0; i < 6; i++) {
                const skeleton = document.createElement('div');
                skeleton.className = 'channel-list-item skeleton-item';
                skeleton.innerHTML = `
                    <div class="channel-list-logo-container skeleton-logo-placeholder">
                        <div class="skeleton-mini-spinner"></div>
                    </div>
                    <div class="channel-list-meta-container">
                        <div class="skeleton-text skeleton-name"></div>
                    </div>
                `;
                list.appendChild(skeleton);
            }
        }

        const sourceEntries = Object.entries(PRESET_SOURCES);
        const settings = JSON.parse(localStorage.getItem('ivids-settings') || '{}');
        if (settings.m3uUrl) {
            sourceEntries.push(['custom', { name: 'Custom Playlist', url: settings.m3uUrl }]);
        }

        allChannels = [];
        const seenUrls = new Set();
        let loadedCount = 0;

        for (const [id, source] of sourceEntries) {
            try {
                const playlistChannels = await M3UParser.fetchPlaylist(source.url);

                if (playlistChannels && playlistChannels.length > 0) {
                    playlistChannels.forEach(c => {
                        if (!c.group) c.group = source.name;
                        c.sourceName = source.name;
                        c.sourcePriority = source.priority || 50;

                        if (!seenUrls.has(c.url)) {
                            seenUrls.add(c.url);
                            allChannels.push(c);
                            loadedCount++;
                        }
                    });

                    if (allChannels.length > 0 && (loadedCount % 50 === 0 || id === sourceEntries[sourceEntries.length - 1][0])) {
                        filterAndRenderChannels(false);
                    }
                }
            } catch (err) {
                console.warn(`Failed to load source ${source.name}:`, err);
            }
        }

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
 * Filters the list of channels based on active filters and queries, then renders them.
 * Dynamically inserts channel items containing only the logo and name into the channel list container.
 * Updates the shared window state and toggles clear button visibility accordingly.
 * 
 * @param {boolean} resetFocus - Resets navigation focus to the first card if true.
 */
function filterAndRenderChannels(resetFocus = false) {
    const container = document.getElementById('channels-list');
    if (!container) return;

    const currentFocused = document.querySelector('.focused');
    const focusedUrl = currentFocused && currentFocused.dataset.url;

    container.innerHTML = '';

    filteredChannels = allChannels.filter(c => {
        const matchesSearch = !searchQuery || (c.name || "").toLowerCase().includes(searchQuery.toLowerCase());
        
        const tags = c.group ? c.group.split(';').map(t => t.trim().toLowerCase()) : [];
        const matchesGenre = !activeGenre || tags.includes(activeGenre.toLowerCase());
        const matchesCountry = !activeCountry || tags.includes(activeCountry.toLowerCase());
        
        const isNotBroken = !hideBroken || (statusCache.get(c.url)?.status !== 'offline');
        return matchesSearch && matchesGenre && matchesCountry && isNotBroken;
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

    filteredChannels.forEach((channel) => {
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
                <img src="${iconUrl}" class="channel-list-logo" onerror="this.src='images/livetv.svg'">
            </div>
            <div class="channel-list-meta-container">
                <span class="channel-list-name">${channel.name}</span>
            </div>
        `;

        item.onfocus = () => showChannelDetail(channel);
        item.onclick = () => playChannel(channel);

        container.appendChild(item);

        if (focusedUrl === channel.url) {
            SpatialNav.setFocus(item);
        }
    });

    const empty = document.getElementById('no-channels-message');
    if (filteredChannels.length === 0) {
        if (empty) empty.style.display = 'flex';
    } else {
        if (empty) empty.style.display = 'none';

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
            liveSyncDuration: 2
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
 * setupEventListeners function
 * ============================
 * Explains: Hooks UI element events including search box typing, clearing input,
 * category selection, and custom back handling.
 */
function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const settingsBtn = document.getElementById('hero-settings-btn');
    const settingsModal = document.getElementById('livetv-settings-modal');
    const settingsClose = document.getElementById('livetv-settings-close');
    const hideBrokenToggle = document.getElementById('hide-broken-toggle');
    const clearBtn = document.getElementById('search-clear');

    const originalBack = SpatialNav.onBack;
    SpatialNav.onBack = () => {
        const current = document.querySelector('.focused');
        const list = document.getElementById('channels-list');

        if (settingsModal && settingsModal.classList.contains('active')) {
            settingsModal.classList.remove('active');
            SpatialNav.clearFocusTrap();
            if (settingsBtn) SpatialNav.setFocus(settingsBtn);
        } else if (current && list && list.contains(current) && searchInput) {
            SpatialNav.setFocus(searchInput);
        } else if (originalBack) {
            originalBack();
        }
    };

    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value;
            filterAndRenderChannels(false);
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

    if (hideBrokenToggle) {
        hideBrokenToggle.checked = hideBroken;
        hideBrokenToggle.onchange = () => {
            hideBroken = hideBrokenToggle.checked;
            saveLiveTvSettings();
            filterAndRenderChannels(true);
        };
    }

    const openSettings = () => {
        if (!settingsModal) return;
        if (hideBrokenToggle) hideBrokenToggle.checked = hideBroken;
        settingsModal.classList.add('active');
        SpatialNav.setFocusTrap(settingsModal);
    };

    const closeSettings = () => {
        if (!settingsModal) return;
        settingsModal.classList.remove('active');
        SpatialNav.clearFocusTrap();
        if (settingsBtn) SpatialNav.setFocus(settingsBtn);
    };

    if (settingsBtn) {
        settingsBtn.onclick = openSettings;
    }

    if (settingsClose) {
        settingsClose.onclick = closeSettings;
    }

    if (settingsModal) {
        settingsModal.onclick = (event) => {
            if (event.target === settingsModal) closeSettings();
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
}

/**
 * Loads Live TV page settings, defaulting broken-channel hiding to enabled.
 *
 * @returns {object}
 */
function loadLiveTvSettings() {
    try {
        const settings = JSON.parse(localStorage.getItem(LIVE_TV_SETTINGS_KEY) || '{}');
        return {
            hideBroken: settings.hideBroken !== false
        };
    } catch (error) {
        console.warn('Failed to load Live TV settings:', error);
        return { hideBroken: true };
    }
}

/**
 * Persists Live TV page settings.
 */
function saveLiveTvSettings() {
    localStorage.setItem(LIVE_TV_SETTINGS_KEY, JSON.stringify({ hideBroken }));
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
 * Stores a channel playback health result and refreshes the visible list.
 *
 * @param {string} url - Channel stream URL.
 * @param {string} status - online/offline.
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
    const dot = row?.querySelector('.list-status-dot');
    if (dot) {
        dot.classList.remove('checking', 'online', 'offline');
        dot.classList.add(status);
    }

    if (hideBroken && status === 'offline') {
        filterAndRenderChannels(false);
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
