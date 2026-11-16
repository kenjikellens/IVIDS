import { sourceManager } from '../../logic/livetv/core/source-manager.js';
import { LiveStreamEngine } from '../../logic/livetv/core/live-stream-engine.js';
import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { EpgManager } from '../../logic/livetv/epg-manager.js';
import { getNamespacedKey } from '../../logic/account-helper.js';
import { escapeHtml, isSafeMediaUrl } from '../js/utils/sanitize.js';
import I18n from '../js/i18n.js';

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
let previewEngine = null;
let previewTimeout = null;
let searchDebounceTimer = null;
let categoryFocusTimer = null;
let progressiveRenderTimer = null;
let detailUiDebounceTimer = null;
let loadSourcesPromise = null;
let liveTvPageBackHandler = null;
let detailRequestId = 0;

/**
 * Detects Android TV / mobile or low-memory devices where auto-starting HLS preview streams on hover causes decoder crashes.
 * @returns {boolean} True when running on Android or a low-memory device.
 */
function isLowRamAndroidDevice() {
    try {
        if (window.AndroidSettings && typeof window.AndroidSettings.isTV === 'function') {
            return true;
        }
        if (typeof navigator !== 'undefined') {
            if (/Android/i.test(navigator.userAgent || '')) return true;
            if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2) return true;
        }
    } catch (e) {
        // Ignore detection errors
    }
    return false;
}
let renderedCount = 0;
let windowStartIndex = 0;
let isAdjustingChannelWindow = false;
const CHUNK_SIZE = 35;
const MAX_RENDERED_NODES = 120;

/**
 * Priority countries displayed near the top of the vertical Categories / Countries list.
 * Uses strict exact country keys ('country:belgium', etc.) backed by SourceManager's O(1) categoryIndex.
 */
const PRIORITY_COUNTRIES = [
    { key: 'country:netherlands', i18nKey: 'livetv.countryNetherlands' },
    { key: 'country:belgium', i18nKey: 'livetv.countryBelgium' },
    { key: 'country:france', i18nKey: 'livetv.countryFrance' },
    { key: 'country:spain', i18nKey: 'livetv.countrySpain' },
    { key: 'country:germany', i18nKey: 'livetv.countryGermany' },
    { key: 'country:portugal', i18nKey: 'livetv.countryPortugal' },
    { key: 'country:italy', i18nKey: 'livetv.countryItaly' },
    { key: 'country:united kingdom', i18nKey: 'livetv.countryUk' },
    { key: 'country:united states', i18nKey: 'livetv.countryUs' }
];

const ALLOWED_GENRES = [
    { key: 'genre:news', i18nKey: 'livetv.catNews' },
    { key: 'genre:movies', i18nKey: 'livetv.catMovies' },
    { key: 'genre:entertainment', i18nKey: 'livetv.catEntertainment' },
    { key: 'genre:music', i18nKey: 'livetv.catMusic' },
    { key: 'genre:kids', i18nKey: 'livetv.catKids' },
    { key: 'genre:documentary', i18nKey: 'livetv.catDocumentary' },
    { key: 'genre:general', i18nKey: 'livetv.catGeneral' },
    { key: 'genre:series', i18nKey: 'livetv.catSeries' },
    { key: 'genre:comedy', i18nKey: 'livetv.catComedy' },
    { key: 'genre:lifestyle', i18nKey: 'livetv.catLifestyle' },
    { key: 'genre:culture', i18nKey: 'livetv.catCulture' },
    { key: 'genre:education', i18nKey: 'livetv.catEducation' },
    { key: 'genre:science', i18nKey: 'livetv.catScience' }
];

/**
 * Extracts and formats the primary category label from a compound group string.
 * Splits semicolon-delimited or pipe-delimited category tags (e.g. 'Sports;Voetbal;Canal+')
 * and returns the first clean, human-readable segment (e.g. 'Sports').
 *
 * @param {string|null|undefined} groupStr - Raw compound group or category string.
 * @returns {string} Clean single primary category name, or localized Live TV label if unassigned.
 */
export function formatPrimaryCategory(groupStr) {
    const fallbackLabel = I18n.t('livetv.title');
    if (!groupStr || typeof groupStr !== 'string') return fallbackLabel;
    const segments = groupStr.split(/[;|]/).map(s => s.trim()).filter(Boolean);
    return segments.length > 0 ? segments[0] : fallbackLabel;
}
window.formatPrimaryCategory = formatPrimaryCategory;

/**
 * Initializes the 3-column Live TV page, resetting state variables, initializing the unified
 * LiveStreamEngine for the 16:9 preview, setting up event listeners, and starting progressive IPTV playlist loading.
 * 
 * @param {object} params - Routing parameters.
 */
export async function init(params) {
    await I18n.init();
    I18n.applyTranslations();
    console.log('Live TV List UI initializing...');

    searchQuery = '';
    activeCategoryKey = 'all';
    selectedChannel = null;
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
        if (detailUiDebounceTimer) {
            clearTimeout(detailUiDebounceTimer);
            detailUiDebounceTimer = null;
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
        if (sourceManager.isCacheComplete) {
            return;
        }
    } else {
        renderLoadingSkeletons();
    }

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
 * Instantiates the unified LiveStreamEngine bound to #livetv-preview-video and toggles
 * loading spinner or unavailable error text without middle overlay buttons.
 */
function initPreviewEngine() {
    const video = document.getElementById('livetv-preview-video');
    const loader = document.getElementById('preview-video-loading');
    const previewCard = document.getElementById('livetv-preview-card');
    const offlineMsg = document.getElementById('preview-offline-message');
    if (!video) return;

    if (previewEngine) {
        previewEngine.destroy();
    }

    previewEngine = new LiveStreamEngine(video, {
        isPreview: true,
        onLoading: () => {
            if (previewCard) previewCard.classList.remove('is-playing');
            if (offlineMsg) offlineMsg.classList.add('hidden');
            if (loader) loader.classList.remove('hidden');
        },
        onPlaying: () => {
            if (loader) loader.classList.add('hidden');
            if (offlineMsg) offlineMsg.classList.add('hidden');
            if (previewCard) previewCard.classList.add('is-playing');
        },
        onOffline: () => {
            if (loader) loader.classList.add('hidden');
            if (previewCard) previewCard.classList.remove('is-playing');
            if (offlineMsg) {
                offlineMsg.textContent = I18n.t('livetv.previewUnavailable');
                offlineMsg.classList.remove('hidden');
            }
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
        label: I18n.t('livetv.allChannels'),
        count: allChannels.length
    });

    // 2. Sports
    const sportsChannels = sourceManager.getChannelsByCategory('sports');
    items.push({
        key: 'sports',
        label: I18n.t('livetv.catSports'),
        count: sportsChannels.length
    });

    // 3. Priority Countries (Strict exact country buckets — no substring matching!)
    PRIORITY_COUNTRIES.forEach(country => {
        const count = sourceManager.getChannelsByCategory(country.key).length;
        if (count > 0) {
            items.push({
                key: country.key,
                label: I18n.t(country.i18nKey),
                count
            });
        }
    });

    // 4. Allowed Genres
    ALLOWED_GENRES.forEach(genre => {
        const count = sourceManager.getChannelsByCategory(genre.key).length;
        if (count > 0) {
            items.push({
                key: genre.key,
                label: I18n.t(genre.i18nKey),
                count
            });
        }
    });

    const fragment = document.createDocumentFragment();
    let refocusEl = null;

    items.forEach(cat => {
        const isActive = cat.key === activeCategoryKey;
        const row = document.createElement('div');
        row.className = `category-list-item card card--interactive focusable universal-onclick ${isActive ? 'active is-selected' : ''}`;
        row.tabIndex = 0;
        row.dataset.categoryKey = cat.key;
        row.innerHTML = `
            <span class="category-list-name">${escapeHtml(cat.label)}</span>
            <span class="category-list-count">${Number(cat.count) || 0}</span>
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
        if (!sourceManager._inFlightPromise) {
            sourceManager.registerDefaultProviders(settings);
        }

        let initialRenderDone = sourceManager.cachedChannels.length > 0;
        allChannels = await sourceManager.loadAllChannels(null, false, (progressChannels) => {
            allChannels = progressChannels;
            if (!initialRenderDone && allChannels.length > 0) {
                initialRenderDone = true;
                renderCategoriesList();
                const currentFocused = document.querySelector('.focused');
                filterAndRenderChannels(!currentFocused);
            } else if (initialRenderDone && !progressiveRenderTimer) {
                progressiveRenderTimer = setTimeout(() => {
                    progressiveRenderTimer = null;
                    renderCategoriesList();
                    updateFilteredChannelsArray();
                    if (renderedCount < CHUNK_SIZE && filteredChannels.length > renderedCount) {
                        const container = document.getElementById('channels-list');
                        if (container && container.querySelector('.is-skeleton')) {
                            filterAndRenderChannels(false);
                        } else {
                            renderNextChunk();
                        }
                    }
                }, 350);
            }
        });

        if (progressiveRenderTimer) {
            clearTimeout(progressiveRenderTimer);
            progressiveRenderTimer = null;
        }
        if (detailUiDebounceTimer) {
            clearTimeout(detailUiDebounceTimer);
            detailUiDebounceTimer = null;
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

    windowStartIndex = 0;
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
 * Updates the right-hand preview column with the selected channel's minimal prompt and EPG details,
 * and triggers debounced Multi-Stage Smart HLS preview playback via LiveStreamEngine.
 * 
 * @param {object} channel - The selected channel object to preview.
 */
async function showChannelDetail(channel) {
    const isInitialSelection = !selectedChannel;
    selectedChannel = channel;
    const reqId = ++detailRequestId;

    if (detailUiDebounceTimer) {
        clearTimeout(detailUiDebounceTimer);
        detailUiDebounceTimer = null;
    }
    if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
    }

    const applyPreviewMeta = () => {
        if (reqId !== detailRequestId || !selectedChannel || selectedChannel.url !== channel.url) return;

        const content = document.getElementById('hero-active-content');
        if (content) content.classList.remove('hidden');

        const previewCard = document.getElementById('livetv-preview-card');
        if (previewCard) {
            previewCard.classList.remove('is-playing');
            previewCard.onclick = () => playChannel(channel);
        }

        const previewChannelName = document.getElementById('preview-channel-name');
        if (previewChannelName) {
            previewChannelName.textContent = channel.name || '';
        }

        const offlineMsg = document.getElementById('preview-offline-message');
        if (offlineMsg) {
            offlineMsg.classList.add('hidden');
        }

        const epgContainer = document.getElementById('hero-epg-container');
        const epgTitleEl = document.getElementById('hero-epg-title');
        const epgTimeEl = document.getElementById('hero-epg-time');
        const epgProgressWrap = document.getElementById('hero-epg-progress-wrap');
        const epgProgressEl = document.getElementById('hero-epg-progress');
        const upcomingSection = document.getElementById('details-upcoming-section');
        const upcomingListEl = document.getElementById('upcoming-programs-list');
        const noEpgText = I18n.t('livetv.noEpgInfo');

        if (epgContainer) {
            epgContainer.classList.remove('hidden');
            if (epgTitleEl) epgTitleEl.textContent = noEpgText;
            if (epgTimeEl) {
                epgTimeEl.textContent = '';
                epgTimeEl.classList.add('hidden');
            }
            if (epgProgressWrap) epgProgressWrap.classList.add('hidden');
            if (epgProgressEl) epgProgressEl.style.width = '0%';
        }
        if (upcomingSection) upcomingSection.classList.add('hidden');
        if (upcomingListEl) upcomingListEl.innerHTML = '';

        const lowRamDevice = isLowRamAndroidDevice();
        if (!lowRamDevice && previewEngine) {
            previewEngine.stop();
        }
    };

    if (isInitialSelection) {
        applyPreviewMeta();
    } else {
        detailUiDebounceTimer = setTimeout(() => {
            detailUiDebounceTimer = null;
            applyPreviewMeta();
        }, 70);
    }

    const lowRamDevice = isLowRamAndroidDevice();

    previewTimeout = setTimeout(async () => {
        if (reqId !== detailRequestId || !selectedChannel || selectedChannel.url !== channel.url) return;

        if (!lowRamDevice) {
            if (!previewEngine) {
                initPreviewEngine();
            }
            if (previewEngine) {
                previewEngine.loadChannel(channel);
            }
        }

        const [epg, upcomingShows] = await Promise.all([
            EpgManager.getCurrentProgram(channel.name, channel.group, channel.tvgId),
            EpgManager.getUpcomingPrograms(channel.name, channel.group, 3, channel.tvgId)
        ]);

        if (reqId !== detailRequestId || !selectedChannel || selectedChannel.url !== channel.url) return;

        if (epgContainer) {
            if (epg && epg.hasData) {
                if (epgTitleEl) epgTitleEl.textContent = epg.title || noEpgText;
                if (epgTimeEl) {
                    epgTimeEl.textContent = `${epg.start} – ${epg.end}`;
                    epgTimeEl.classList.remove('hidden');
                }
                if (epgProgressWrap) epgProgressWrap.classList.remove('hidden');
                if (epgProgressEl) epgProgressEl.style.width = `${epg.progress}%`;
            } else {
                if (epgTitleEl) epgTitleEl.textContent = noEpgText;
                if (epgTimeEl) {
                    epgTimeEl.textContent = '';
                    epgTimeEl.classList.add('hidden');
                }
                if (epgProgressWrap) epgProgressWrap.classList.add('hidden');
                if (epgProgressEl) epgProgressEl.style.width = '0%';
            }
        }

        if (upcomingListEl && upcomingSection) {
            upcomingListEl.innerHTML = '';
            if (upcomingShows.length === 0) {
                upcomingSection.classList.add('hidden');
            } else {
                upcomingSection.classList.remove('hidden');
                upcomingShows.forEach(show => {
                    const row = document.createElement('div');
                    row.className = 'upcoming-program-row';
                    row.innerHTML = `
                        <span class="upcoming-program-time">${escapeHtml(show.start)} – ${escapeHtml(show.end)}</span>
                        <span class="upcoming-program-title">${escapeHtml(show.title)}</span>
                    `;
                    upcomingListEl.appendChild(row);
                });
            }
        }
    }, 900);
}

/**
 * Stops active preview playback, resets the preview card playing state, and hides the loading spinner.
 */
function cleanupPreview() {
    if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
    }
    if (previewEngine) {
        previewEngine.stop();
    }
    const previewCard = document.getElementById('livetv-preview-card');
    if (previewCard) {
        previewCard.classList.remove('is-playing');
    }
    const loader = document.getElementById('preview-video-loading');
    if (loader) {
        loader.classList.add('hidden');
    }
    const offlineMsg = document.getElementById('preview-offline-message');
    if (offlineMsg) {
        offlineMsg.classList.add('hidden');
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
        logo: channel.logo || '',
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
            if (isAdjustingChannelWindow) return;
            if (listColumn.scrollTop + listColumn.clientHeight >= listColumn.scrollHeight - 300) {
                renderNextChunk();
            } else if (windowStartIndex > 0 && listColumn.scrollTop <= 250) {
                renderPrevChunk();
            }
        };
    }
}

/**
 * Builds an interactive channel row element bound to the bounded virtual window index.
 *
 * @param {object} channel - Channel object to render.
 * @param {number} index - Zero-based index within filteredChannels.
 * @param {string|null} focusedUrl - URL to match for focus restoration.
 * @returns {{ item: HTMLElement, isFocusedTarget: boolean }} Constructed row element and focus match flag.
 */
function createChannelRow(channel, index, focusedUrl) {
    const item = document.createElement('div');
    item.className = 'channel-list-item channel-card card card--interactive focusable universal-onclick';
    item.tabIndex = 0;
    item.dataset.url = channel.url;

    const iconUrl = isSafeMediaUrl(channel.logo) ? channel.logo : 'images/livetv.svg';

    item.innerHTML = `
        <div class="channel-card__logo-wrap channel-list-logo-container">
            <img src="${escapeHtml(iconUrl)}" class="channel-card__logo channel-list-logo" loading="lazy" decoding="async">
        </div>
        <div class="channel-card__meta channel-list-meta-container">
            <span class="channel-card__title channel-list-name">${escapeHtml(channel.name)}</span>
        </div>
    `;
    const logoImg = item.querySelector('.channel-list-logo');
    if (logoImg) {
        logoImg.onerror = () => {
            logoImg.onerror = null;
            logoImg.src = 'images/livetv.svg';
        };
    }

    item.onfocus = () => {
        showChannelDetail(channel);
        if (index >= renderedCount - 5) {
            renderNextChunk();
        } else if (index <= windowStartIndex + 3 && windowStartIndex > 0) {
            renderPrevChunk();
        }
    };

    item.onclick = () => {
        playChannel(channel);
    };

    return { item, isFocusedTarget: focusedUrl === channel.url };
}

/**
 * Prepends the previous batch of channel rows when scrolling or navigating upward while
 * enforcing MAX_RENDERED_NODES by trimming off-screen bottom rows.
 */
function renderPrevChunk() {
    if (windowStartIndex <= 0) return;

    const container = document.getElementById('channels-list');
    if (!container) return;

    const newStart = Math.max(0, windowStartIndex - CHUNK_SIZE);
    const fragment = document.createDocumentFragment();
    for (let i = newStart; i < windowStartIndex; i++) {
        const { item } = createChannelRow(filteredChannels[i], i, null);
        fragment.appendChild(item);
    }

    isAdjustingChannelWindow = true;
    const prevScrollHeight = container.scrollHeight;
    container.prepend(fragment);
    const addedHeight = container.scrollHeight - prevScrollHeight;
    if (addedHeight > 0) {
        container.scrollTop += addedHeight;
    }
    windowStartIndex = newStart;

    while (container.children.length > MAX_RENDERED_NODES && container.lastElementChild && !container.lastElementChild.classList.contains('focused')) {
        container.lastElementChild.remove();
        renderedCount = Math.max(windowStartIndex, renderedCount - 1);
    }
    isAdjustingChannelWindow = false;
}

/**
 * Renders the next batch of clean channel rows in #channels-list while keeping total
 * rendered DOM nodes bounded to MAX_RENDERED_NODES.
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
        const { item, isFocusedTarget } = createChannelRow(filteredChannels[i], i, focusedUrl);
        fragment.appendChild(item);
        if (isFocusedTarget) {
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

    if (container.children.length > MAX_RENDERED_NODES) {
        isAdjustingChannelWindow = true;
        let removedHeight = 0;
        while (container.children.length > MAX_RENDERED_NODES && container.firstElementChild && !container.firstElementChild.classList.contains('focused')) {
            const first = container.firstElementChild;
            removedHeight += first.offsetHeight;
            first.remove();
            windowStartIndex++;
        }
        if (removedHeight > 0) {
            container.scrollTop = Math.max(0, container.scrollTop - removedHeight);
        }
        isAdjustingChannelWindow = false;
    }
}
