import { sourceManager } from '../../logic/livetv/core/source-manager.js';
import { StreamOptimizer } from '../../logic/livetv/core/stream-optimizer.js';
import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { EpgManager } from '../../logic/livetv/epg-manager.js';
import { proxyUrl } from '../js/utils/proxy.js';
import { getNamespacedKey } from '../../logic/account-helper.js';

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
let activeCategoryKey = 'all';
const statusCache = new Map();
let previewHls = null;
let previewTimeout = null;
let searchDebounceTimer = null;
let categoryFocusTimer = null;
let progressiveRenderTimer = null;
let loadSourcesPromise = null;
let liveTvPageBackHandler = null;
const LIVE_TV_STATUS_KEY = 'ivids-live-tv-status-cache';
const STATUS_TTL_MS = 24 * 60 * 60 * 1000;
const BROKEN_CHANNELS_API_URL = '/api/broken-channels';
const brokenChannelsSet = new Set();

let renderedCount = 0;
const CHUNK_SIZE = 35;

/**
 * Priority countries displayed near the top of the vertical Categories / Countries list.
 */
const PRIORITY_COUNTRIES = [
    { key: 'country:netherlands', label: 'Netherlands', match: ['netherlands', 'dutch', 'nl'] },
    { key: 'country:belgium', label: 'Belgium', match: ['belgium', 'belgian', 'be'] },
    { key: 'country:france', label: 'France', match: ['france', 'french', 'fr'] },
    { key: 'country:spain', label: 'Spain', match: ['spain', 'spanish', 'es'] },
    { key: 'country:germany', label: 'Germany', match: ['germany', 'german', 'de'] },
    { key: 'country:portugal', label: 'Portugal', match: ['portugal', 'portuguese', 'pt'] },
    { key: 'country:italy', label: 'Italy', match: ['italy', 'italian', 'it'] },
    { key: 'country:united kingdom', label: 'United Kingdom', match: ['united kingdom', 'uk', 'england', 'britain'] },
    { key: 'country:united states', label: 'United States', match: ['united states', 'usa', 'us'] }
];

/**
 * Extracts and formats the primary category label from a compound group string.
 * Splits semicolon-delimited or pipe-delimited category tags (e.g. 'Sports;Voetbal;Canal+')
 * and returns the first clean, human-readable segment (e.g. 'Sports').
 *
 * @param {string|null|undefined} groupStr - Raw compound group or category string.
 * @returns {string} Clean single primary category name, or 'Live TV' if unassigned.
 */
export function formatPrimaryCategory(groupStr) {
    if (!groupStr || typeof groupStr !== 'string') return 'Live TV';
    const segments = groupStr.split(/[;|]/).map(s => s.trim()).filter(Boolean);
    return segments.length > 0 ? segments[0] : 'Live TV';
}
window.formatPrimaryCategory = formatPrimaryCategory;

/**
 * Checks whether a channel belongs to the Sports category.
 *
 * @param {object} channel - Channel object to inspect.
 * @returns {boolean} True if the channel is a sports broadcast.
 */
function isSportsChannel(channel) {
    if (!channel) return false;
    if (channel.isSports) return true;
    const tags = Array.isArray(channel.groupTags) ? channel.groupTags.join(' ').toLowerCase() : '';
    const group = (channel.group || '').toLowerCase();
    const name = (channel.name || '').toLowerCase();
    const combined = `${tags} ${group} ${name}`;
    return /sport|voetbal|football|soccer|canal\+\s*(foot|sport|live)|bein|ziggo|dazn|eurosport|espn|sky\s*sport|tnt\s*sport|arena\s*sport|premier\s*league|fighting|motor|golf|tennis|nba|nfl|ufc|f1/i.test(combined);
}

/**
 * Checks whether a channel matches the given category/country key from #categories-list.
 *
 * @param {object} channel - Channel object to evaluate.
 * @param {string} categoryKey - Selected category key ('all', 'sports', 'country:...', 'genre:...').
 * @returns {boolean} True if the channel belongs to the category.
 */
function channelMatchesCategoryKey(channel, categoryKey) {
    if (!categoryKey || categoryKey === 'all') return true;
    if (categoryKey === 'sports') {
        return isSportsChannel(channel);
    }

    const tags = Array.isArray(channel.groupTags) ? channel.groupTags.map(t => t.toLowerCase()) : [];
    const groupParts = (channel.group || '').split(/[;|]/).map(s => s.trim().toLowerCase()).filter(Boolean);
    const sourceName = (channel.sourceName || '').toLowerCase();

    if (categoryKey.startsWith('country:')) {
        const target = categoryKey.slice('country:'.length).toLowerCase();
        const countryDef = PRIORITY_COUNTRIES.find(c => c.key === categoryKey);
        const matchTerms = countryDef ? countryDef.match : [target];
        return matchTerms.some(term =>
            tags.includes(term) ||
            groupParts.includes(term) ||
            sourceName === term ||
            (channel.group && channel.group.toLowerCase().includes(term))
        );
    }

    if (categoryKey.startsWith('genre:')) {
        const targetGenre = categoryKey.slice('genre:'.length).toLowerCase();
        return groupParts.includes(targetGenre) || tags.includes(targetGenre);
    }

    return true;
}

/**
 * Initializes the 3-column Live TV page, resetting state variables, clearing active preview,
 * setting up event listeners, and starting progressive IPTV playlist loading.
 * 
 * @param {object} params - Routing parameters.
 */
export async function init(params) {
    console.log('Live TV List UI initializing...');

    searchQuery = '';
    activeCategoryKey = 'all';
    selectedChannel = null;
    loadStatusCache();
    cleanupPreview();

    const originalLoadPage = Router.loadPage;
    const originalGoBack = Router.goBack;

    /**
     * Restores the original Router methods and cleans up page timers and handlers.
     */
    const restoreRouter = () => {
        Router.loadPage = originalLoadPage;
        Router.goBack = originalGoBack;
        if (categoryFocusTimer) {
            clearTimeout(categoryFocusTimer);
            categoryFocusTimer = null;
        }
        if (progressiveRenderTimer) {
            clearTimeout(progressiveRenderTimer);
            progressiveRenderTimer = null;
        }
        if (liveTvPageBackHandler) {
            SpatialNav.popBackHandler(liveTvPageBackHandler);
            liveTvPageBackHandler = null;
        }
    };

    /**
     * Wraps Router.loadPage to cleanup the preview player before navigating.
     */
    Router.loadPage = async function(pageName, paramsArg, addToHistory, targetFocus) {
        cleanupPreview();
        restoreRouter();
        return originalLoadPage.call(Router, pageName, paramsArg, addToHistory, targetFocus);
    };

    /**
     * Wraps Router.goBack to cleanup the preview player before navigating back.
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

    setupEventListeners();

    if (allChannels.length > 0) {
        renderCategoriesList();
        filterAndRenderChannels(true);
        SpatialNav.focusFirst();
        return;
    }

    renderLoadingSkeletons();

    if (!loadSourcesPromise) {
        loadSourcesPromise = loadAllSources().then(() => {
            loadSourcesPromise = null;
            if (Router.currentPage === 'livetv' && !document.querySelector('.focused')) {
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
 * Renders channel and category skeleton placeholders in the UI to indicate loading progress.
 */
function renderLoadingSkeletons() {
    const catList = document.getElementById('categories-list');
    if (catList && catList.children.length === 0) {
        catList.innerHTML = '';
        for (let i = 0; i < 8; i++) {
            const skel = document.createElement('div');
            skel.className = 'category-list-item card is-skeleton';
            skel.innerHTML = `<div class="skeleton-text skeleton-name"></div>`;
            catList.appendChild(skel);
        }
    }

    const list = document.getElementById('channels-list');
    if (list) {
        list.innerHTML = '';
        for (let i = 0; i < 8; i++) {
            const skeleton = document.createElement('div');
            skeleton.className = 'channel-list-item channel-card card is-skeleton';
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
 * Builds and renders the vertical Categories & Countries list (#categories-list) on the left column.
 * Includes "All Channels", "Sports", all countries (Netherlands, Belgium, France, Spain, Germany, Portugal, Italy, UK, USA),
 * and major channel genres with live channel counts.
 */
function renderCategoriesList() {
    const container = document.getElementById('categories-list');
    if (!container) return;

    const currentFocused = document.querySelector('#categories-list .focused');
    const focusedKey = currentFocused ? currentFocused.dataset.categoryKey : null;
    const prevScrollTop = container.scrollTop;

    const items = [];

    // 1. All Channels
    items.push({
        key: 'all',
        label: window.i18n?.t('livetv.allChannels') || 'All Channels',
        count: allChannels.length
    });

    // 2. Sports (All live sports & football across all providers)
    let sportsCount = 0;
    for (let i = 0; i < allChannels.length; i++) {
        if (isSportsChannel(allChannels[i])) sportsCount++;
    }
    items.push({
        key: 'sports',
        label: 'Sports',
        count: sportsCount
    });

    // 3. Countries (Netherlands, Belgium, France, Spain, Germany, Portugal, Italy, UK, USA)
    PRIORITY_COUNTRIES.forEach(country => {
        let count = 0;
        for (let i = 0; i < allChannels.length; i++) {
            if (channelMatchesCategoryKey(allChannels[i], country.key)) count++;
        }
        if (count > 0) {
            items.push({
                key: country.key,
                label: country.label,
                count
            });
        }
    });

    // 4. Dynamic Genres from playlists (excluding countries and raw compound tags)
    const knownCountryTerms = new Set(PRIORITY_COUNTRIES.flatMap(c => c.match));
    const genreCounts = new Map();
    const allowedGenres = [
        'News', 'Movies', 'Entertainment', 'Music', 'Kids', 'Documentary',
        'General', 'Series', 'Comedy', 'Lifestyle', 'Culture', 'Education', 'Science'
    ];

    allChannels.forEach(c => {
        const primary = formatPrimaryCategory(c.group);
        if (!primary || primary.toLowerCase() === 'sports' || knownCountryTerms.has(primary.toLowerCase())) return;
        const matchedAllowed = allowedGenres.find(g => g.toLowerCase() === primary.toLowerCase());
        if (matchedAllowed) {
            genreCounts.set(matchedAllowed, (genreCounts.get(matchedAllowed) || 0) + 1);
        }
    });

    allowedGenres.forEach(genreName => {
        const count = genreCounts.get(genreName) || 0;
        if (count > 0) {
            items.push({
                key: `genre:${genreName.toLowerCase()}`,
                label: genreName,
                count
            });
        }
    });

    const fragment = document.createDocumentFragment();
    let refocusEl = null;

    items.forEach(cat => {
        const isActive = cat.key === activeCategoryKey;
        const row = document.createElement('div');
        row.className = `category-list-item card card--interactive focusable ${isActive ? 'active is-selected' : ''}`;
        row.tabIndex = 0;
        row.dataset.categoryKey = cat.key;
        row.innerHTML = `
            <span class="category-list-name">${cat.label}</span>
            <span class="category-list-count">${cat.count}</span>
        `;

        const activateCategory = (moveFocusToChannels = false) => {
            if (activeCategoryKey !== cat.key) {
                activeCategoryKey = cat.key;
                container.querySelectorAll('.category-list-item').forEach(el => {
                    const match = el.dataset.categoryKey === activeCategoryKey;
                    el.classList.toggle('active', match);
                    el.classList.toggle('is-selected', match);
                });
                filterAndRenderChannels(false);
            }
            if (moveFocusToChannels) {
                const firstChan = document.querySelector('#channels-list .channel-list-item.focusable');
                if (firstChan) {
                    SpatialNav.setFocus(firstChan);
                }
            }
        };

        row.onfocus = () => {
            if (categoryFocusTimer) clearTimeout(categoryFocusTimer);
            categoryFocusTimer = setTimeout(() => {
                activateCategory(false);
            }, 120);
        };

        row.onclick = () => {
            if (categoryFocusTimer) clearTimeout(categoryFocusTimer);
            activateCategory(true);
        };

        fragment.appendChild(row);

        if (focusedKey && cat.key === focusedKey) {
            refocusEl = row;
        }
    });

    container.innerHTML = '';
    container.appendChild(fragment);
    container.scrollTop = prevScrollTop;

    if (refocusEl) {
        refocusEl.classList.add('focused');
        refocusEl.focus({ preventScroll: true });
    }
}

/**
 * Asynchronously loads M3U channel lists from all registered providers progressively.
 * Updates the vertical Categories/Countries list and Channels list as providers finish.
 */
async function loadAllSources() {
    const empty = document.getElementById('no-channels-message');

    try {
        if (empty) empty.classList.add('hidden');

        await loadBrokenChannelsDb();

        const settings = loadMergedSettings();
        sourceManager.registerDefaultProviders(settings);

        let initialRenderDone = false;
        allChannels = await sourceManager.loadAllChannels(brokenChannelsSet, false, (progressChannels) => {
            allChannels = progressChannels;
            if (!initialRenderDone && allChannels.length > 0) {
                initialRenderDone = true;
                renderCategoriesList();
                const currentFocused = document.querySelector('.focused');
                filterAndRenderChannels(!currentFocused);
            } else if (initialRenderDone) {
                if (progressiveRenderTimer) clearTimeout(progressiveRenderTimer);
                progressiveRenderTimer = setTimeout(() => {
                    renderCategoriesList();
                    // If currently rendered list has fewer than CHUNK_SIZE items or user is viewing a newly populated category, refresh list
                    const prevFilteredLen = filteredChannels.length;
                    updateFilteredChannelsArray();
                    if (renderedCount < CHUNK_SIZE && filteredChannels.length > prevFilteredLen) {
                        renderNextChunk();
                    }
                }, 600);
            }
        });

        if (progressiveRenderTimer) {
            clearTimeout(progressiveRenderTimer);
            progressiveRenderTimer = null;
        }

        renderCategoriesList();
        if (allChannels.length === 0) {
            if (empty) empty.classList.remove('hidden');
        } else {
            const currentFocused = document.querySelector('.focused');
            const hasRenderedChannels = document.querySelectorAll('#channels-list .channel-list-item:not(.is-skeleton)').length > 0;
            if (!hasRenderedChannels) {
                filterAndRenderChannels(!currentFocused);
            } else {
                updateFilteredChannelsArray();
                if (renderedCount < CHUNK_SIZE) {
                    renderNextChunk();
                }
            }
        }
    } catch (error) {
        console.error('Error loading sources:', error);
        if (empty) empty.classList.remove('hidden');
    }
}

/**
 * Updates the filteredChannels array based on activeCategoryKey and searchQuery without clearing DOM.
 */
function updateFilteredChannelsArray() {
    const q = searchQuery.toLowerCase().trim();
    filteredChannels = allChannels.filter(c => {
        if (statusCache.get(c.url)?.status === 'offline') return false;
        if (!channelMatchesCategoryKey(c, activeCategoryKey)) return false;
        if (q) {
            const matchesName = c.name && c.name.toLowerCase().includes(q);
            const matchesGroup = c.group && c.group.toLowerCase().includes(q);
            if (!matchesName && !matchesGroup) return false;
        }
        return true;
    });
}

/**
 * Filters `allChannels` by activeCategoryKey and searchQuery, then renders the first chunk of channels.
 * 
 * @param {boolean} [resetFocus=false] - Whether to reset SpatialNav focus after rendering.
 */
function filterAndRenderChannels(resetFocus = false) {
    updateFilteredChannelsArray();

    renderedCount = 0;
    const container = document.getElementById('channels-list');
    if (container) {
        container.innerHTML = '';
        container.scrollTop = 0;
    }

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
 * Updates the right-hand preview column with the selected channel's EPG details and triggers debounced HLS preview playback.
 * 
 * @param {object} channel - The selected channel object to preview.
 */
async function showChannelDetail(channel) {
    selectedChannel = channel;
    const placeholder = document.getElementById('hero-placeholder');
    const content = document.getElementById('hero-active-content');

    if (placeholder) placeholder.style.display = 'none';
    if (content) content.classList.remove('hidden');

    const previewCard = document.getElementById('livetv-preview-card');
    if (previewCard) {
        previewCard.onclick = () => playChannel(channel);
    }

    const epgContainer = document.getElementById('hero-epg-container');
    const epgTitleEl = document.getElementById('hero-epg-title');
    const epgStartEl = document.getElementById('hero-epg-start');
    const epgEndEl = document.getElementById('hero-epg-end');
    const epgProgressEl = document.getElementById('hero-epg-progress');
    const noEpgText = window.i18n?.t('livetv.noEpgInfo') || 'No program info available';

    if (epgContainer) {
        epgContainer.classList.remove('hidden');
        if (epgTitleEl) epgTitleEl.textContent = channel.name;
        if (epgStartEl) epgStartEl.textContent = '--:--';
        if (epgEndEl) epgEndEl.textContent = '--:--';
        if (epgProgressEl) epgProgressEl.style.width = '0%';
    }

    const upcomingListEl = document.getElementById('upcoming-programs-list');
    if (upcomingListEl) {
        upcomingListEl.innerHTML = `<div class="upcoming-program-row"><span class="upcoming-program-title">${noEpgText}</span></div>`;
    }

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
    }, 300);

    const [epg, upcomingShows] = await Promise.all([
        EpgManager.getCurrentProgram(channel.name, channel.group, channel.tvgId),
        EpgManager.getUpcomingPrograms(channel.name, channel.group, 3, channel.tvgId)
    ]);

    if (!selectedChannel || selectedChannel.url !== channel.url) return;

    if (epgContainer) {
        if (epgTitleEl) epgTitleEl.textContent = epg.title || channel.name;
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
        updateChannelStatus(url, 'offline');
    };

    const streamUrl = StreamOptimizer.getProxiedStreamUrl ? StreamOptimizer.getProxiedStreamUrl(url, headers) : proxyUrl(url);

    if (window.Hls && window.Hls.isSupported()) {
        previewHls = new window.Hls({
            maxMaxBufferLength: 8,
            maxBufferLength: 4,
            liveSyncDurationCount: 2,
            initialLiveManifestSize: 2,
            enableWorker: true,
            lowLatencyMode: true,
            startLevel: -1,
            capLevelToPlayerSize: false
        });
        previewHls.loadSource(streamUrl);
        previewHls.attachMedia(video);
        previewHls.on(window.Hls.Events.MANIFEST_PARSED, (event, data) => {
            // Lock to highest available HD/FHD bitrate level when multiple quality levels exist
            if (previewHls && Array.isArray(data?.levels) && data.levels.length > 1) {
                previewHls.nextLevel = data.levels.length - 1;
            }
            video.play().catch(e => {
                if (e.name !== 'AbortError') {
                    console.warn('Error starting HLS preview video:', e);
                }
            });
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
        video.play().catch(e => {
            if (e.name !== 'AbortError') {
                console.warn('Error starting native preview video:', e);
            }
        });
    } else {
        if (loader) loader.classList.add('hidden');
    }
}

/**
 * Releases playback resources, destroys the preview HLS instance, and clears the video element's source.
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
 * Records the channel zapping index state variables and routes the app to the fullscreen TV player.
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

    cleanupPreview();
    Router.loadPage('tv-player', {
        url: channel.url,
        title: channel.name,
        group: formatPrimaryCategory(channel.group),
        tvgId: channel.tvgId,
        headers: channel.headers
    });
}

/**
 * Hooks up event listeners for search input, clear button, scroll pagination, and spatial nav.
 */
function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear');

    if (!liveTvPageBackHandler) {
        liveTvPageBackHandler = () => {
            if (SpatialNav.currentPageLogic && typeof SpatialNav.currentPageLogic.handleBack === 'function') {
                return SpatialNav.currentPageLogic.handleBack();
            }
            return false;
        };
        SpatialNav.pushBackHandler(liveTvPageBackHandler);
    }

    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value;
            if (clearBtn) {
                clearBtn.classList.toggle('hidden', searchQuery.length === 0);
            }
            if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                filterAndRenderChannels(false);
            }, 250);
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            if (searchInput) searchInput.value = '';
            searchQuery = '';
            clearBtn.classList.add('hidden');
            filterAndRenderChannels(false);
            if (searchInput) SpatialNav.setFocus(searchInput);
        };
    }

    const listColumn = document.getElementById('channels-list') || document.querySelector('.livetv-list-column');
    if (listColumn) {
        listColumn.onscroll = () => {
            if (listColumn.scrollTop + listColumn.clientHeight >= listColumn.scrollHeight - 300) {
                renderNextChunk();
            }
        };
    }
}

/**
 * Loads cached channel health statuses from localStorage.
 */
function loadStatusCache() {
    statusCache.clear();
    try {
        const raw = localStorage.getItem(LIVE_TV_STATUS_KEY);
        if (!raw) return;
        const now = Date.now();
        const entries = JSON.parse(raw);
        if (Array.isArray(entries)) {
            entries.forEach(([url, val]) => {
                if (val && now - val.timestamp < STATUS_TTL_MS) {
                    statusCache.set(url, val);
                }
            });
        }
    } catch (e) {
        console.warn('Failed to read Live TV status cache:', e);
    }
}

let saveCacheTimeout = null;

/**
 * Debounces saving the statusCache to localStorage.
 */
function scheduleSaveStatusCache() {
    if (saveCacheTimeout) return;
    saveCacheTimeout = setTimeout(() => {
        saveCacheTimeout = null;
        try {
            const entries = Array.from(statusCache.entries());
            localStorage.setItem(LIVE_TV_STATUS_KEY, JSON.stringify(entries));
        } catch (e) {
            console.warn('Failed to save Live TV status cache:', e);
        }
    }, 2000);
}

/**
 * Updates the cached online/offline status for a channel URL and updates its status dot in the DOM.
 * 
 * @param {string} url - Channel stream URL.
 * @param {string} status - The current playback status ('online' | 'offline').
 */
function updateChannelStatus(url, status) {
    if (!url) return;
    statusCache.set(url, { status, timestamp: Date.now() });
    scheduleSaveStatusCache();

    const escapedUrl = url.replace(/"/g, '\\"');
    const row = document.querySelector(`.channel-list-item[data-url="${escapedUrl}"], .channel-card[data-url="${escapedUrl}"]`);
    if (row) {
        const dot = row.querySelector('.list-status-dot');
        if (dot) {
            dot.classList.remove('checking', 'online', 'offline');
            dot.classList.add(status);
        }
    }
}

/**
 * Renders the next batch of clean channel rows in #channels-list (status dot, logo, and channel name only).
 */
function renderNextChunk() {
    if (renderedCount >= filteredChannels.length) return;

    const container = document.getElementById('channels-list');
    if (!container) return;

    const currentFocused = document.querySelector('#channels-list .focused');
    const focusedUrl = currentFocused && currentFocused.dataset.url;

    const start = renderedCount;
    const end = Math.min(start + CHUNK_SIZE, filteredChannels.length);

    const fragment = document.createDocumentFragment();
    let refocusTarget = null;

    for (let i = start; i < end; i++) {
        const channel = filteredChannels[i];
        const item = document.createElement('div');
        item.className = 'channel-list-item channel-card card card--interactive focusable';
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
    } else if (start === 0 && filteredChannels.length > 0 && !selectedChannel) {
        showChannelDetail(filteredChannels[0]);
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
 */
async function loadBrokenChannelsDb() {
    try {
        const response = await fetch(`${BROKEN_CHANNELS_API_URL}?_=${Date.now()}`);
        if (!response.ok) {
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
