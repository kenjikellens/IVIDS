import { sourceManager } from '../../logic/livetv/core/source-manager.js';
import { LiveStreamEngine } from '../../logic/livetv/core/live-stream-engine.js';
import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { EpgManager } from '../../logic/livetv/epg-manager.js';
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
let previewEngine = null;
let previewTimeout = null;
let searchDebounceTimer = null;
let categoryFocusTimer = null;
let progressiveRenderTimer = null;
let loadSourcesPromise = null;
let liveTvPageBackHandler = null;
const LIVE_TV_STATUS_KEY = 'ivids-live-tv-status-cache';
const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

let renderedCount = 0;
const CHUNK_SIZE = 35;

/**
 * Priority countries displayed near the top of the vertical Categories / Countries list.
 * Uses strict exact country keys ('country:belgium', etc.) backed by SourceManager's O(1) categoryIndex.
 */
const PRIORITY_COUNTRIES = [
    { key: 'country:netherlands', label: 'Netherlands' },
    { key: 'country:belgium', label: 'Belgium' },
    { key: 'country:france', label: 'France' },
    { key: 'country:spain', label: 'Spain' },
    { key: 'country:germany', label: 'Germany' },
    { key: 'country:portugal', label: 'Portugal' },
    { key: 'country:italy', label: 'Italy' },
    { key: 'country:united kingdom', label: 'United Kingdom' },
    { key: 'country:united states', label: 'United States' }
];

const ALLOWED_GENRES = [
    'News', 'Movies', 'Entertainment', 'Music', 'Kids', 'Documentary',
    'General', 'Series', 'Comedy', 'Lifestyle', 'Culture', 'Education', 'Science'
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
 * Initializes the 3-column Live TV page, resetting state variables, initializing the unified
 * LiveStreamEngine for the 16:9 preview, setting up event listeners, and starting progressive IPTV playlist loading.
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
    initPreviewEngine();

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
        destroyPreviewEngine();
        restoreRouter();
        return originalLoadPage.call(Router, pageName, paramsArg, addToHistory, targetFocus);
    };

    /**
     * Wraps Router.goBack to cleanup the preview player before navigating back.
     */
    Router.goBack = function(fallbackPage, fallbackParams) {
        destroyPreviewEngine();
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

    if (sourceManager.cachedChannels.length > 0) {
        allChannels = sourceManager.cachedChannels;
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
 * Instantiates the unified LiveStreamEngine bound to #livetv-preview-video.
 */
function initPreviewEngine() {
    const video = document.getElementById('livetv-preview-video');
    const loader = document.getElementById('preview-video-loading');
    if (!video) return;

    if (previewEngine) {
        previewEngine.destroy();
    }

    previewEngine = new LiveStreamEngine(video, {
        isPreview: true,
        onLoading: (channel) => {
            if (loader) loader.classList.remove('hidden');
            if (channel?.url) updateChannelStatus(channel.url, 'checking');
        },
        onPlaying: (channel) => {
            if (loader) loader.classList.add('hidden');
            if (channel?.url) updateChannelStatus(channel.url, 'online');
        },
        onOffline: (channel) => {
            if (loader) loader.classList.add('hidden');
            if (channel?.url) updateChannelStatus(channel.url, 'offline');
        }
    });
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
 * Builds and renders the vertical Categories & Countries list (#categories-list) on the left column
 * using O(1) pre-indexed category buckets from SourceManager.
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

    // 2. Sports
    const sportsChannels = sourceManager.getChannelsByCategory('sports');
    items.push({
        key: 'sports',
        label: 'Sports',
        count: sportsChannels.length
    });

    // 3. Priority Countries (Strict exact country buckets — no substring matching!)
    PRIORITY_COUNTRIES.forEach(country => {
        const count = sourceManager.getChannelsByCategory(country.key).length;
        if (count > 0) {
            items.push({
                key: country.key,
                label: country.label,
                count
            });
        }
    });

    // 4. Allowed Genres
    ALLOWED_GENRES.forEach(genreName => {
        const key = `genre:${genreName.toLowerCase()}`;
        const count = sourceManager.getChannelsByCategory(key).length;
        if (count > 0) {
            items.push({
                key,
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
 * Never discards channels via broken-channels.json so every channel remains available.
 */
async function loadAllSources() {
    const empty = document.getElementById('no-channels-message');

    try {
        if (empty) empty.classList.add('hidden');

        const settings = loadMergedSettings();
        sourceManager.registerDefaultProviders(settings);

        let initialRenderDone = false;
        allChannels = await sourceManager.loadAllChannels(null, false, (progressChannels) => {
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
                    filterAndRenderChannels(false);
                }, 350);
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
            filterAndRenderChannels(!currentFocused);
        }
    } catch (error) {
        console.error('Error loading sources:', error);
        if (empty) empty.classList.remove('hidden');
    }
}

/**
 * Updates the filteredChannels array in O(1) using SourceManager's categoryIndex when no search query is active,
 * or filters the selected bucket by searchQuery. Never hides channels based on offline statusCache.
 */
function updateFilteredChannelsArray() {
    const baseBucket = sourceManager.getChannelsByCategory(activeCategoryKey);
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
        filteredChannels = baseBucket;
        return;
    }

    filteredChannels = baseBucket.filter(c => {
        const matchesName = (c.searchNameLower || (c.name ? c.name.toLowerCase() : '')).includes(q);
        const matchesGroup = c.group && c.group.toLowerCase().includes(q);
        return matchesName || matchesGroup;
    });
}

/**
 * Filters `allChannels` by activeCategoryKey and searchQuery, then renders the first chunk of channels.
 * Preserves the scroll position and focus if a channel row is already focused.
 * 
 * @param {boolean} [resetFocus=false] - Whether to reset SpatialNav focus after rendering.
 */
function filterAndRenderChannels(resetFocus = false) {
    updateFilteredChannelsArray();

    const container = document.getElementById('channels-list');
    const prevScrollTop = container ? container.scrollTop : 0;
    const focusedChanEl = document.querySelector('#channels-list .focused');
    const focusedChanUrl = focusedChanEl ? focusedChanEl.dataset.url : null;

    renderedCount = 0;
    if (container) {
        container.innerHTML = '';
        container.scrollTop = 0;
    }

    const empty = document.getElementById('no-channels-message');
    if (filteredChannels.length === 0) {
        if (empty) empty.classList.remove('hidden');
    } else {
        if (empty) empty.classList.add('hidden');
        renderNextChunk(focusedChanUrl);

        if (container && focusedChanUrl) {
            container.scrollTop = prevScrollTop;
        }

        if (resetFocus && !document.querySelector('.focused')) {
            SpatialNav.focusFirst();
        }
    }
}

/**
 * Updates the right-hand preview column with the selected channel's EPG details and triggers
 * debounced Multi-Stage Smart HLS preview playback via LiveStreamEngine.
 * 
 * @param {object} channel - The selected channel object to preview.
 */
async function showChannelDetail(channel) {
    selectedChannel = channel;
    const content = document.getElementById('hero-active-content');
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
    if (previewEngine) {
        previewEngine.stop();
    }

    previewTimeout = setTimeout(async () => {
        if (!selectedChannel || selectedChannel.url !== channel.url) return;

        if (!previewEngine) {
            initPreviewEngine();
        }
        if (previewEngine) {
            previewEngine.loadChannel(channel);
        }

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
    }, 300);
}

/**
 * Stops active preview playback and hides the loading spinner.
 */
function cleanupPreview() {
    if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
    }
    if (previewEngine) {
        previewEngine.stop();
    }
    const loader = document.getElementById('preview-video-loading');
    if (loader) {
        loader.classList.add('hidden');
    }
}

/**
 * Completely destroys the preview LiveStreamEngine instance when navigating away from the page.
 */
function destroyPreviewEngine() {
    cleanupPreview();
    if (previewEngine) {
        previewEngine.destroy();
        previewEngine = null;
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

    destroyPreviewEngine();
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
 * Loads cached channel health statuses from localStorage (used strictly for status dot color, never to hide channels).
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
 * Updates the visual status dot ('online' = green, 'offline' = red, 'checking' = yellow) for a channel URL.
 * NEVER removes or hides the channel from the DOM or playlist so the user can always retry it.
 * 
 * @param {string} url - Channel stream URL.
 * @param {string} status - The current playback status ('online' | 'offline' | 'checking').
 */
function updateChannelStatus(url, status) {
    if (!url) return;
    if (status === 'online' || status === 'offline') {
        statusCache.set(url, { status, timestamp: Date.now() });
        scheduleSaveStatusCache();
    }

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
 * 
 * @param {string|null} [preserveFocusedUrl=null] - Optional URL of the channel that should retain focus after re-render.
 */
function renderNextChunk(preserveFocusedUrl = null) {
    if (renderedCount >= filteredChannels.length) return;

    const container = document.getElementById('channels-list');
    if (!container) return;

    const currentFocused = document.querySelector('#channels-list .focused');
    const focusedUrl = preserveFocusedUrl || (currentFocused && currentFocused.dataset.url);

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

        const iconUrl = (channel.logo && (/^https?:\/\//i.test(channel.logo) || channel.logo.startsWith('data:image/')))
            ? channel.logo
            : 'images/livetv.svg';
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
        refocusTarget.classList.add('focused');
        refocusTarget.focus({ preventScroll: true });
    } else if (start === 0 && filteredChannels.length > 0 && !selectedChannel) {
        showChannelDetail(filteredChannels[0]);
    }

    renderedCount = end;
}
