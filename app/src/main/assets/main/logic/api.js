import { cacheManager } from './cache-manager.js';
import { getActiveAccountId, getNamespacedKey } from './account-helper.js';
import { PersistentStorage } from './persistent-storage.js';
import { API_CONFIG, PLAYER_CONFIG, NETWORK_CONFIG } from './constants.js';

const API_KEY = 'a341dc9a3c2dffa62668b614a98c1188';
const { BASE_URL, IMAGE_BASE_PATH, DEFAULT_PLAYER_BASE_URL } = API_CONFIG;

/** Mapping of streaming network IDs to TMDb production company IDs. */
const NETWORK_COMPANIES = Object.freeze({
    213: '213|178464|171251',
    49: '3287|3268',
    2739: '2',
    1024: '20580',
    2552: '131018'
});

const DEFAULT_PLAYER_PROVIDERS = [...PLAYER_CONFIG.DEFAULT_PROVIDERS];
export const DEFAULT_PLAYBACK_SOURCE_ORDER = ['direct_http', 'embed_servers', 'debrid_primary'];
export const DEFAULT_DEBRID_CONFIG = Object.freeze({
    apiKey: '',
    primaryAddonUrl: 'https://torrentio.strem.fun',
    httpAddonUrl: 'https://addon.notorrent2.workers.dev'
});

/**
 * Computes the logical playback tier priority order based on whether a Real-Debrid API key is set.
 * Keeps Free Direct HTTP first, ordering Real-Debrid ahead of Embed Servers when configured.
 *
 * @param {Object} [debridConfig] - Active Debrid configuration object.
 * @returns {Array<string>} Ordered playback tier identifiers.
 */
export function getDefaultPlaybackSourceOrder(debridConfig) {
    const hasKey = Boolean((debridConfig?.apiKey || '').trim());
    return hasKey
        ? ['direct_http', 'debrid_primary', 'embed_servers']
        : ['direct_http', 'embed_servers', 'debrid_primary'];
}

/**
 * Monitors network throughput heuristics, device TV classification, and optimal TMDb image tier selection.
 * Maintains slow-connection backoff flags on window and invalidates cached size tables on connection transitions.
 */
class NetworkQualityMonitor {
    constructor() {
        this._slowConnectionResult = null;
        this._slowConnectionTimestamp = 0;
        this._slowConnectionTtlMs = 5000;
        this._measuredSlowUntil = 0;
        this._recommendedSizes = {};
        this._isDispatchingSlowEvent = false;
        this.bindEnvironmentListeners();
    }

    /**
     * Registers window and Network Information API listeners to flush cached quality tiers on changes.
     * Mutates internal slow-connection cache state whenever data saver or connectivity changes.
     */
    bindEnvironmentListeners() {
        if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
        window.addEventListener('datasaverchanged', () => {
            this.invalidateImageQualityCache();
        });
        if (typeof navigator !== 'undefined' && navigator.connection && typeof navigator.connection.addEventListener === 'function') {
            try {
                navigator.connection.addEventListener('change', () => {
                    this.invalidateSlowConnectionCache();
                });
            } catch {
                // Ignore unsupported Network Information listeners
            }
        }
    }

    /**
     * Marks the connection as slow for a specified duration based on live latency or timeout measurements.
     * Updates window.__ividsSlowConnection and dispatches 'networkslowdetected' on state entry.
     *
     * @param {number} [durationMs=60000] - Duration in milliseconds to retain slow mode.
     */
    markMeasuredSlowConnection(durationMs = 60000) {
        const now = Date.now();
        const wasSlow = this._slowConnectionResult === true
            || now < this._measuredSlowUntil
            || (typeof window !== 'undefined' && now < (window.__ividsSlowUntil || 0));
        this._measuredSlowUntil = now + durationMs;
        this._slowConnectionResult = true;
        this._slowConnectionTimestamp = now;
        this._recommendedSizes = {};
        if (typeof window !== 'undefined') {
            window.__ividsSlowUntil = this._measuredSlowUntil;
            window.__ividsSlowConnection = true;
            if (!wasSlow && !this._isDispatchingSlowEvent) {
                this._isDispatchingSlowEvent = true;
                try {
                    window.dispatchEvent(new CustomEvent('networkslowdetected'));
                } finally {
                    this._isDispatchingSlowEvent = false;
                }
            }
        }
    }

    /**
     * Resets cached slow-connection evaluation timestamps and window slow-mode flags.
     * Forces the next image or API call to re-evaluate Navigator connection metrics.
     */
    invalidateSlowConnectionCache() {
        this._slowConnectionResult = null;
        this._slowConnectionTimestamp = 0;
        this._measuredSlowUntil = 0;
        if (typeof window !== 'undefined') {
            window.__ividsSlowUntil = 0;
            window.__ividsSlowConnection = false;
        }
    }

    /**
     * Clears both recommended image tier cache entries and slow-connection evaluation state.
     * Called when screen metrics or data saver settings change.
     */
    invalidateImageQualityCache() {
        this._recommendedSizes = {};
        this.invalidateSlowConnectionCache();
    }

    /**
     * Marks the active connection as slow for durationMs and resets cached image size lookups.
     *
     * @param {number} [durationMs=60000] - Backoff duration in milliseconds.
     */
    markSlowConnection(durationMs = 60000) {
        this.markMeasuredSlowConnection(durationMs);
        this._recommendedSizes = {};
    }

    /**
     * Determines whether the app runs on a television platform via native bridge or user-agent hints.
     *
     * @returns {boolean} True on Android TV, Google TV, Tizen, or webOS devices.
     */
    isTV() {
        if (typeof window !== 'undefined' && window.AndroidSettings && typeof window.AndroidSettings.isTV === 'function') {
            try { if (window.AndroidSettings.isTV()) return true; } catch (e) { console.warn('Error reading isTV:', e); }
        }
        const ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent.toLowerCase() : '';
        return ua.includes('tizen') || ua.includes('webos') || ua.includes('android tv')
            || ua.includes('smarttv') || ua.includes('googletv') || ua.includes('aft')
            || Boolean(typeof window !== 'undefined' && window.tizen);
    }

    /**
     * Evaluates whether data saver or degraded network conditions require smaller artwork downloads.
     * Persists auto-enabled saveData preference to namespaced PersistentStorage when signaled by the OS.
     *
     * @returns {boolean} True when slow connection or Data Saver mode is active.
     */
    isSlowConnection() {
        const now = Date.now();
        const isExpiringSlow = now < this._measuredSlowUntil
            || (typeof window !== 'undefined' && now < (window.__ividsSlowUntil || 0));
        if (isExpiringSlow) {
            if (typeof window !== 'undefined') window.__ividsSlowConnection = true;
            return true;
        }
        if (typeof window !== 'undefined' && window.__ividsSlowUntil && now >= window.__ividsSlowUntil) {
            window.__ividsSlowConnection = false;
            window.__ividsSlowUntil = 0;
        }
        if (this._slowConnectionResult !== null && (now - this._slowConnectionTimestamp) < this._slowConnectionTtlMs) {
            return this._slowConnectionResult;
        }

        const commitSlow = (ms) => {
            if (ms) this.markMeasuredSlowConnection(ms);
            this._slowConnectionResult = true;
            this._slowConnectionTimestamp = now;
            return true;
        };

        let isSavedDataSaver = false;
        let settings = {};
        let userKey = '';
        try {
            userKey = getNamespacedKey('settings');
            const saved = PersistentStorage.getItem(userKey);
            if (saved) {
                settings = JSON.parse(saved);
                if (settings.dataSaver === true || settings.dataSaver === 'true') isSavedDataSaver = true;
            }
        } catch (e) {
            console.error('Api: Failed to read dataSaver setting:', e);
        }

        if (isSavedDataSaver) return commitSlow();

        if (typeof navigator !== 'undefined' && navigator.connection) {
            const conn = navigator.connection;
            if (conn.saveData) {
                try {
                    if (userKey && settings.dataSaver !== true && settings.dataSaver !== 'true') {
                        settings.dataSaver = true;
                        PersistentStorage.setItem(userKey, JSON.stringify(settings));
                        window.dispatchEvent(new CustomEvent('datasaverchanged', { detail: true }));
                    }
                } catch (e) {
                    console.error('Api: Failed to auto-enable dataSaver setting:', e);
                }
                return commitSlow();
            }
            const isSlowType = ['slow-2g', '2g', '3g'].includes(conn.effectiveType);
            const isHighRtt = typeof conn.rtt === 'number' && conn.rtt > 500;
            const isLowDownlink = typeof conn.downlink === 'number' && conn.downlink > 0 && conn.downlink < NETWORK_CONFIG.SLOW_THRESHOLD_MBPS;
            if (isSlowType || isHighRtt || isLowDownlink) return commitSlow(15000);
        }

        this._slowConnectionResult = false;
        this._slowConnectionTimestamp = now;
        return false;
    }

    /**
     * Computes optimal TMDb poster width tier for browse carousels and grids.
     *
     * @returns {string} TMDb poster size path segment.
     */
    getRecommendedPosterSize() {
        if (this.isSlowConnection()) return 'w92';
        const vw = window.innerWidth;
        const isPortrait = window.matchMedia('(max-aspect-ratio: 3/4)').matches;
        if (isPortrait) return vw <= 360 ? 'w92' : (vw <= 480 ? 'w154' : 'w185');
        if (vw <= 600) return 'w154';
        if (vw <= 900) return 'w185';
        return (vw <= 1440 || this.isTV()) ? 'w342' : 'w500';
    }

    /**
     * Computes optimal TMDb poster width tier for media detail pages.
     *
     * @returns {string} TMDb poster size path segment.
     */
    getRecommendedDetailPosterSize() {
        if (this.isSlowConnection()) return 'w92';
        const vw = window.innerWidth;
        return vw <= 480 ? 'w185' : (vw <= 1440 ? 'w342' : 'w500');
    }

    /**
     * Computes optimal TMDb backdrop width tier for hero banners.
     *
     * @returns {string} TMDb backdrop size path segment.
     */
    getRecommendedBackdropSize() {
        if (this.isSlowConnection()) return 'w300';
        const vw = window.innerWidth;
        if (window.matchMedia('(max-aspect-ratio: 3/4)').matches) return vw <= 480 ? 'w300' : 'w780';
        return (vw <= 900 || this.isTV()) ? 'w780' : API_CONFIG.BACKDROP_SIZES.STANDARD;
    }

    /**
     * Matches physical pixel width of a container to the closest TMDb artwork size tier.
     *
     * @param {number} containerWidth - Element width in CSS pixels.
     * @param {boolean} [isBackdrop=false] - True for landscape backdrops, false for posters.
     * @returns {string} TMDb size path segment.
     */
    getRecommendedSizeForContainer(containerWidth, isBackdrop = false) {
        if (this.isSlowConnection()) return isBackdrop ? 'w300' : 'w92';
        const physicalWidth = containerWidth * (window.devicePixelRatio || 1);
        if (isBackdrop) {
            if (physicalWidth <= 0) return this.getRecommendedSizeForContainer(window.innerWidth * (window.devicePixelRatio || 1), true);
            if (physicalWidth <= 300) return 'w300';
            if (physicalWidth <= 780) return 'w780';
            return physicalWidth <= 1280 ? 'w1280' : 'original';
        }
        if (physicalWidth <= 0) return this.getRecommendedPosterSize();
        if (physicalWidth <= 92) return 'w92';
        if (physicalWidth <= 154) return 'w154';
        if (physicalWidth <= 185) return 'w185';
        if (physicalWidth <= 342) return 'w342';
        return physicalWidth <= 500 ? 'w500' : (physicalWidth <= 780 ? 'w780' : 'original');
    }

    /**
     * Builds a complete TMDb CDN image URL using a memoized size tier matching screen and connection speed.
     *
     * @param {string} path - Relative TMDb image path.
     * @param {string|null} [size=null] - Explicit size tier override.
     * @returns {string} Full image URL or local placeholder path.
     */
    getImageUrl(path, size = null) {
        if (!path) return 'assets/placeholder.png';
        let finalSize = size;
        if (!finalSize) {
            const screenKey = `${window.innerWidth}x${window.devicePixelRatio || 1}_${this.isSlowConnection() ? 'slow' : 'fast'}`;
            if (!this._recommendedSizes[screenKey]) this._recommendedSizes[screenKey] = this.getRecommendedPosterSize();
            finalSize = this._recommendedSizes[screenKey];
        }
        return `${IMAGE_BASE_PATH}/${finalSize}${path.startsWith('/') ? path : `/${path}`}`;
    }

    /**
     * Injects a link preload tag into document.head to warm upcoming hero or detail artwork.
     *
     * @param {string} path - Relative TMDb image path.
     * @param {string|null} [size=null] - Explicit size tier override.
     */
    prefetchImage(path, size = null) {
        if (!path) return;
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = this.getImageUrl(path, size);
        document.head.appendChild(link);
    }
}

/**
 * Manages persisted user playback settings, Debrid configuration, source priority ordering,
 * and automatic legacy provider URL migrations in PersistentStorage.
 */
class PlayerConfigStore {
    constructor() {
        this._cachedConfig = null;
        this._ownerId = null;
    }

    /**
     * Clears the memoized player configuration so the next read loads fresh PersistentStorage values.
     */
    invalidate() {
        this._cachedConfig = null;
    }

    /**
     * Reads active UI language formatted for TMDb API requests.
     *
     * @returns {string} ISO language tag (mapping 'zh' to 'zh-CN').
     */
    getLanguageCode() {
        const lang = (typeof window !== 'undefined' && window.i18n && window.i18n.currentLanguage) || 'en';
        return lang === 'zh' ? 'zh-CN' : lang;
    }

    /**
     * Reads the active user's adult content filter preference from namespaced PersistentStorage.
     *
     * @returns {boolean} True when adult titles are enabled.
     */
    getIncludeAdult() {
        try {
            const userKey = getNamespacedKey('settings');
            const saved = PersistentStorage.getItem(userKey);
            if (saved) {
                const settings = JSON.parse(saved);
                return settings.includeAdult === true || settings.includeAdult === 'true';
            }
        } catch (e) {
            console.error('Error reading includeAdult setting:', e);
        }
        return false;
    }

    /**
     * Loads and normalizes player providers, Debrid credentials, and source priority order per account.
     * Migrates legacy vidsrc/M3U settings automatically back to PersistentStorage when detected.
     *
     * @returns {Object} Normalized player configuration object.
     */
    getPlayerConfig() {
        const currentId = getActiveAccountId();
        if (this._cachedConfig && this._ownerId === currentId) return this._cachedConfig;

        const defaults = {
            playerProvider: 'custom',
            playerBaseUrl: DEFAULT_PLAYER_BASE_URL,
            playerProviders: DEFAULT_PLAYER_PROVIDERS,
            playbackSourceOrder: [...DEFAULT_PLAYBACK_SOURCE_ORDER],
            debridConfig: { ...DEFAULT_DEBRID_CONFIG },
            m3uPlaylists: []
        };

        try {
            const parseJson = str => { try { return str ? (JSON.parse(str) || {}) : {}; } catch { return {}; } };
            const readCookie = k => {
                const m = typeof document !== 'undefined' && document.cookie && document.cookie.match(new RegExp(`(?:^|; )${k}=([^;]*)`));
                return m ? decodeURIComponent(m[1]) : null;
            };

            const globalSettings = parseJson(PersistentStorage.getItem('ivids-settings'));
            globalSettings.updateMode = globalSettings.updateMode || readCookie('updateMode');
            globalSettings.language = globalSettings.language || readCookie('language');

            const userKey = getNamespacedKey('settings');
            const saved = { ...globalSettings, ...parseJson(PersistentStorage.getItem(userKey)) };

            let needsWriteBack = false;
            if (saved.playerBaseUrl && /vidsrc\.(xyz|me|net)/.test(saved.playerBaseUrl)) {
                saved.playerBaseUrl = DEFAULT_PLAYER_BASE_URL;
                needsWriteBack = true;
            }

            if (!Array.isArray(saved.playerProviders)) {
                saved.playerProviders = [...DEFAULT_PLAYER_PROVIDERS];
                needsWriteBack = true;
            } else {
                const initialLen = saved.playerProviders.length;
                saved.playerProviders = saved.playerProviders.filter(p => p.isCustom || !['vidsrc_cc', 'embed_su'].includes(p.id));
                DEFAULT_PLAYER_PROVIDERS.forEach(def => {
                    if (!saved.playerProviders.some(p => p.id === def.id || p.url === def.url)) saved.playerProviders.push(def);
                });
                if (saved.playerProviders.length !== initialLen) needsWriteBack = true;
            }

            if (saved.m3uUrl && (!saved.m3uPlaylists || saved.m3uPlaylists.length === 0)) {
                saved.m3uPlaylists = [{ id: 'custom_m3u', name: 'Custom Playlist', url: saved.m3uUrl, isCustom: true }];
                needsWriteBack = true;
            }

            if (needsWriteBack) {
                PersistentStorage.setItem('ivids-settings', JSON.stringify({ language: saved.language || 'en', updateMode: saved.updateMode || 'manual' }));
                PersistentStorage.setItem(userKey, JSON.stringify({
                    accentColor: saved.accentColor, m3uUrl: saved.m3uUrl, playerProvider: saved.playerProvider,
                    playerBaseUrl: saved.playerBaseUrl, playerProviders: saved.playerProviders, m3uPlaylists: saved.m3uPlaylists
                }));
            }

            const rawDebrid = (saved.debridConfig && typeof saved.debridConfig === 'object') ? saved.debridConfig : {};
            const normalizedDebrid = {
                ...DEFAULT_DEBRID_CONFIG,
                ...rawDebrid,
                httpAddonUrl: (rawDebrid.httpAddonUrl || DEFAULT_DEBRID_CONFIG.httpAddonUrl).trim()
            };
            const useCustomOrder = Boolean(saved.hasCustomSourceOrder) && Array.isArray(saved.playbackSourceOrder);
            const rawOrder = useCustomOrder ? saved.playbackSourceOrder : getDefaultPlaybackSourceOrder(normalizedDebrid);
            const mappedOrder = rawOrder.map(id => (id === 'debrid_backup' ? 'direct_http' : id));
            const normalizedOrder = [];
            mappedOrder.forEach(id => {
                if (DEFAULT_PLAYBACK_SOURCE_ORDER.includes(id) && !normalizedOrder.includes(id)) normalizedOrder.push(id);
            });
            DEFAULT_PLAYBACK_SOURCE_ORDER.forEach(id => {
                if (!normalizedOrder.includes(id)) normalizedOrder.push(id);
            });

            this._cachedConfig = {
                ...defaults,
                ...saved,
                playbackSourceOrder: normalizedOrder,
                debridConfig: normalizedDebrid,
                playerBaseUrl: (saved.playerBaseUrl || defaults.playerBaseUrl).replace(/\/+$/, '')
            };
        } catch (error) {
            console.error('Error reading player config:', error);
            this._cachedConfig = defaults;
        }

        this._ownerId = currentId;
        return this._cachedConfig;
    }

    /**
     * Resolves display metadata for the priority-ordered list of embed player servers.
     *
     * @returns {Array<Object>} Server provider objects with id, display name, url, and custom flag.
     */
    getServers() {
        const config = this.getPlayerConfig();
        return (config.playerProviders || DEFAULT_PLAYER_PROVIDERS).map(p => {
            let displayName = p.name;
            if (p.isCustom || !displayName) {
                try { const host = new URL(p.url).hostname; displayName = host ? `${host} (Custom)` : 'Custom Server'; } catch { displayName = 'Custom Server'; }
            }
            return { id: p.id, name: displayName, url: p.url, isCustom: Boolean(p.isCustom) };
        });
    }

    /**
     * Builds an embed streaming URL for a movie or episode using the selected or primary server.
     *
     * @param {string|number} id - TMDb content identifier.
     * @param {string} type - 'movie' or 'tv'.
     * @param {number|null} [season=null] - Episode season number for TV shows.
     * @param {number|null} [episode=null] - Episode number for TV shows.
     * @param {string|null} [serverId=null] - Optional explicit server identifier.
     * @returns {string} Fully formed embed player URL.
     */
    getVideoUrl(id, type, season = null, episode = null, serverId = null) {
        const config = this.getPlayerConfig();
        const servers = this.getServers();
        const server = serverId ? servers.find(s => s.id === serverId) : servers[0];
        const baseUrl = server ? server.url : config.playerBaseUrl;
        const params = 'autoplay=true&autoPlay=true&ds_lang=en';
        return type === 'tv' ? `${baseUrl}/tv/${id}/${season || 1}/${episode || 1}?${params}` : `${baseUrl}/movie/${id}?${params}`;
    }
}

/**
 * Encapsulates TMDb HTTP transport, exponential backoff retries, in-flight request deduplication,
 * release-date filtering, and original unlocalized artwork merging.
 */
class TmdbHttpClient {
    /**
     * Initializes HTTP client bound to shared network quality and config dependencies.
     *
     * @param {NetworkQualityMonitor} networkMonitor - Monitor notified on slow responses or timeouts.
     * @param {PlayerConfigStore} configStore - Store providing active TMDb language code.
     */
    constructor(networkMonitor, configStore) {
        this._networkMonitor = networkMonitor;
        this._configStore = configStore;
        this._inflightRequests = new Map();
        this._cachedTodayDate = null;
    }

    /**
     * Returns today's ISO date prefix (YYYY-MM-DD), cached for repeated list filtering.
     *
     * @returns {string} Today's UTC date string.
     */
    getTodayDate() {
        if (!this._cachedTodayDate) this._cachedTodayDate = new Date().toISOString().split('T')[0];
        return this._cachedTodayDate;
    }

    /**
     * Normalizes cache lifetimes to integer minutes for CacheManager.
     *
     * @param {number} [ttl=15] - Lifetime in minutes or fractional hours.
     * @returns {number} Duration in minutes.
     */
    normalizeTtlMinutes(ttl = 15) {
        if (!ttl) return 15;
        return ttl < 1 ? Math.round(ttl * 60) : ttl;
    }

    /**
     * Shuffles an array in place with Fisher-Yates so repeated carousel renders stay varied.
     *
     * @param {Array} array - Array to permute.
     * @returns {Array} Shuffled array reference.
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Filters out unreleased items whose release_date or first_air_date is in the future.
     *
     * @param {Array<Object>} results - Raw TMDb media items.
     * @returns {Array<Object>} Released media items.
     */
    filterReleased(results) {
        if (!Array.isArray(results)) return [];
        const today = this.getTodayDate();
        return results.filter(item => {
            const d = item.release_date || item.first_air_date;
            return d && d <= today;
        });
    }

    /**
     * Copies unlocalized poster and backdrop artwork onto localized items by matching item IDs.
     * Keeps translated metadata intact while preserving original-language key art.
     *
     * @param {Array<Object>} localizedItems - Items with localized title and overview.
     * @param {Array<Object>} unlocalizedItems - Items fetched without language parameter.
     * @returns {Array<Object>} Merged item list.
     */
    mergeOriginalArtwork(localizedItems, unlocalizedItems) {
        if (!Array.isArray(localizedItems) || !Array.isArray(unlocalizedItems) || unlocalizedItems.length === 0) return localizedItems;
        const artworkMap = new Map();
        for (const item of unlocalizedItems) {
            if (item?.id != null) artworkMap.set(item.id, { poster_path: item.poster_path, backdrop_path: item.backdrop_path });
        }
        for (const item of localizedItems) {
            const orig = item?.id != null && artworkMap.get(item.id);
            if (orig) {
                if (orig.poster_path) item.poster_path = orig.poster_path;
                if (orig.backdrop_path) item.backdrop_path = orig.backdrop_path;
            }
        }
        return localizedItems;
    }

    /**
     * Executes fetch with AbortController timeouts and exponential backoff retries.
     * Notifies NetworkQualityMonitor if latency exceeds 1200ms or requests abort/retry.
     *
     * @param {string|Request} resource - Target request URL.
     * @param {Object} [options={}] - Optional timeout and retry overrides.
     * @returns {Promise<Response>} Successful HTTP response.
     */
    async fetchWithRetry(resource, options = {}) {
        const { timeout = API_CONFIG.FETCH_TIMEOUT_MS, retries = API_CONFIG.FETCH_RETRIES } = options;
        let lastError;
        for (let i = 0; i <= retries; i++) {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), timeout);
            const reqStart = Date.now();
            try {
                const response = await fetch(resource, { ...options, signal: controller.signal });
                clearTimeout(id);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                if ((Date.now() - reqStart) > 1200 || i > 0) this._networkMonitor.markMeasuredSlowConnection(60000);
                return response;
            } catch (error) {
                clearTimeout(id);
                lastError = error;
                if ((Date.now() - reqStart) > 1200 || error?.name === 'AbortError') {
                    this._networkMonitor.markMeasuredSlowConnection(60000);
                }
                if (i < retries) await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i)));
            }
        }
        throw lastError;
    }

    /**
     * Deduplicates simultaneous GET requests for identical URLs and clones the Response per waiter.
     *
     * @param {string} url - Request URL key.
     * @param {Object} [options={}] - Fetch configuration options.
     * @returns {Promise<Response>} Cloned HTTP Response object.
     */
    async deduplicatedFetch(url, options = {}) {
        if (this._inflightRequests.has(url)) {
            try {
                const res = await this._inflightRequests.get(url);
                try { return res.clone(); } catch { return res; }
            } catch {
                this._inflightRequests.delete(url);
            }
        }
        const promise = this.fetchWithRetry(url, options).finally(() => this._inflightRequests.delete(url));
        this._inflightRequests.set(url, promise);
        const res = await promise;
        try { return res.clone(); } catch { return res; }
    }

    /**
     * Fetches JSON from TMDb and optionally pairs an unlocalized request to restore original posters.
     *
     * @param {string} url - Localized TMDb request URL.
     * @param {Object} [options={}] - Controls preserveOriginalArtwork and unlocalizedUrl overrides.
     * @returns {Promise<any>} Parsed TMDb JSON payload.
     */
    async fetchTmdb(url, options = {}) {
        const lang = this._configStore.getLanguageCode();
        const needArtwork = options.preserveOriginalArtwork !== false && lang !== 'en' && url.includes('language=');
        if (!needArtwork) {
            const res = await this.deduplicatedFetch(url);
            return await res.json();
        }
        const unlocUrl = options.unlocalizedUrl || url.replace(/([?&])language=[^&]*(&|$)/, '$1').replace(/[?&]$/, '');
        const [resLoc, resUnloc] = await Promise.all([
            this.deduplicatedFetch(url),
            this.deduplicatedFetch(unlocUrl).catch(() => null)
        ]);
        const dataLoc = await resLoc.json();
        const dataUnloc = resUnloc ? await resUnloc.json().catch(() => null) : null;
        const locItems = dataLoc?.results || (Array.isArray(dataLoc) ? dataLoc : null);
        const unlocItems = dataUnloc?.results || (Array.isArray(dataUnloc) ? dataUnloc : null);
        if (locItems && unlocItems) this.mergeOriginalArtwork(locItems, unlocItems);
        return dataLoc;
    }
}

const networkMonitor = new NetworkQualityMonitor();
const configStore = new PlayerConfigStore();
const httpClient = new TmdbHttpClient(networkMonitor, configStore);

/** Declarative catalog table generating typed Api.fetch*() discover helpers without repetition. */
const DISCOVER_RECIPES = {
    fetchActionMovies: ['movie', 'with_genres=28'],
    fetchAdventureMovies: ['movie', 'with_genres=12'],
    fetchAnimationMovies: ['movie', 'with_genres=16'],
    fetchComedyMovies: ['movie', 'with_genres=35'],
    fetchCrimeMovies: ['movie', 'with_genres=80'],
    fetchDocumentaryMovies: ['movie', 'with_genres=99'],
    fetchDramaMovies: ['movie', 'with_genres=18'],
    fetchFamilyMovies: ['movie', 'with_genres=10751'],
    fetchFantasyMovies: ['movie', 'with_genres=14'],
    fetchHistoryMovies: ['movie', 'with_genres=36'],
    fetchHorrorMovies: ['movie', 'with_genres=27'],
    fetchMusicMovies: ['movie', 'with_genres=10402'],
    fetchMysteryMovies: ['movie', 'with_genres=9648'],
    fetchRomanceMovies: ['movie', 'with_genres=10749'],
    fetchSciFiMovies: ['movie', 'with_genres=878'],
    fetchThrillerMovies: ['movie', 'with_genres=53'],
    fetchWarMovies: ['movie', 'with_genres=10752'],
    fetchWesternMovies: ['movie', 'with_genres=37'],
    fetchAnimeMovies: ['movie', 'with_genres=16&with_original_language=ja'],
    fetchDisneyMovies: ['movie', 'with_companies=2'],
    fetchMarvelMovies: ['movie', 'with_companies=420'],
    fetchPixarMovies: ['movie', 'with_companies=3'],
    fetchStudioGhibli: ['movie', 'with_companies=10342'],
    fetchHighlyRated: ['movie', 'vote_average.gte=8&vote_count.gte=1000&sort_by=vote_average.desc'],
    fetchNewThisYear: ['movie', () => `primary_release_date.gte=${new Date().getFullYear()}-01-01&sort_by=popularity.desc`],
    fetchClassicMovies: ['movie', 'primary_release_date.gte=1970-01-01&primary_release_date.lte=1999-12-31&vote_count.gte=500&sort_by=vote_average.desc'],
    fetchAwardWinners: ['movie', 'vote_average.gte=7.5&vote_count.gte=5000&sort_by=vote_count.desc'],
    fetchOscarWinners: ['movie', 'vote_average.gte=7.8&vote_count.gte=3000&sort_by=vote_average.desc'],
    fetchMindBending: ['movie', 'with_genres=9648&sort_by=vote_average.desc'],
    fetchNostalgia80s90s: ['movie', 'primary_release_date.gte=1980-01-01&primary_release_date.lte=1999-12-31&sort_by=popularity.desc'],
    fetchIndieGems: ['movie', 'with_companies=41077|7467|10256'],
    fetchDcMovies: ['movie', 'with_companies=9993|429&sort_by=popularity.desc'],
    fetchDcSeries: ['tv', 'with_companies=9993|429&sort_by=popularity.desc'],
    fetchTrueStoryMovies: ['movie', 'with_keywords=9672&sort_by=popularity.desc'],
    fetchHeistMovies: ['movie', 'with_keywords=10051&sort_by=popularity.desc'],
    fetchZombieMovies: ['movie', 'with_keywords=12377&sort_by=popularity.desc'],
    fetchSportsMovies: ['movie', 'with_keywords=6075&sort_by=popularity.desc'],
    fetchRomComMovies: ['movie', 'with_genres=35,10749&sort_by=popularity.desc'],
    fetchPsychologicalThrillers: ['movie', 'with_genres=53&with_keywords=9715&sort_by=popularity.desc'],
    fetchCyberpunkMovies: ['movie', 'with_keywords=4565|12190&sort_by=popularity.desc'],
    fetchStandupComedy: ['movie', 'with_genres=35,99&sort_by=popularity.desc'],
    fetchMiniSeries: ['tv', 'with_type=2&sort_by=popularity.desc'],
    fetchDocuseries: ['tv', 'with_genres=99,80&sort_by=popularity.desc'],
    fetchSitcoms: ['tv', 'with_genres=35&sort_by=vote_count.desc'],
    fetchBollywood: ['movie', 'with_original_language=hi&sort_by=popularity.desc'],
    fetchKoreanContent: ['movie', 'with_original_language=ko&sort_by=popularity.desc'],
    fetchActionAdventureSeries: ['tv', 'with_genres=10759'],
    fetchAnimationSeries: ['tv', 'with_genres=16'],
    fetchComedySeries: ['tv', 'with_genres=35'],
    fetchCrimeSeries: ['tv', 'with_genres=80'],
    fetchDocumentarySeries: ['tv', 'with_genres=99'],
    fetchDramaSeries: ['tv', 'with_genres=18'],
    fetchFamilySeries: ['tv', 'with_genres=10751'],
    fetchKidsSeries: ['tv', 'with_genres=10762'],
    fetchMysterySeries: ['tv', 'with_genres=9648'],
    fetchRealitySeries: ['tv', 'with_genres=10764'],
    fetchSciFiFantasySeries: ['tv', 'with_genres=10765'],
    fetchSoapSeries: ['tv', 'with_genres=10766'],
    fetchWarPoliticsSeries: ['tv', 'with_genres=10768'],
    fetchWesternSeries: ['tv', 'with_genres=37'],
    fetchAnimeSeries: ['tv', 'with_genres=16&with_original_language=ja'],
    fetchDisneySeries: ['tv', 'with_companies=2'],
    fetchMarvelSeries: ['tv', 'with_companies=420'],
    fetchNetflixSeries: ['tv', 'with_companies=213&sort_by=popularity.desc'],
    fetchKoreanSeries: ['tv', 'with_original_language=ko&sort_by=popularity.desc'],
    fetchTvMovies: ['movie', 'with_genres=10770'],
    fetchTalkNewsSeries: ['tv', 'with_genres=10767|10763']
};

export const Api = {
    /** Returns the active TMDb API key string. @returns {string} */
    getApiKey: () => API_KEY,

    POSTER_SIZE: API_CONFIG.POSTER_SIZES.STANDARD,
    BACKDROP_SIZE: API_CONFIG.BACKDROP_SIZES.STANDARD,
    STILL_SIZE: API_CONFIG.BACKDROP_SIZES.LOW,
    DETAIL_POSTER_SIZE: API_CONFIG.POSTER_SIZES.LARGE,

    /** Checks whether the client is a TV device. @returns {boolean} */
    isTV: () => networkMonitor.isTV(),

    /** Marks the active connection as slow for durationMs and flushes cached sizes. @param {number} [durationMs=60000] */
    markSlowConnection: (durationMs = 60000) => networkMonitor.markSlowConnection(durationMs),

    /** Checks if Data Saver or degraded network conditions are active. @returns {boolean} */
    isSlowConnection: () => networkMonitor.isSlowConnection(),

    /** Computes optimal TMDb poster tier for current viewport and connection speed. @returns {string} */
    getRecommendedPosterSize: () => networkMonitor.getRecommendedPosterSize(),

    /** Computes optimal TMDb detail poster tier. @returns {string} */
    getRecommendedDetailPosterSize: () => networkMonitor.getRecommendedDetailPosterSize(),

    /** Computes optimal TMDb backdrop tier. @returns {string} */
    getRecommendedBackdropSize: () => networkMonitor.getRecommendedBackdropSize(),

    /** Returns optimal TMDb episode still tier. @returns {string} */
    getRecommendedStillSize: () => 'w300',

    /** Returns optimal TMDb actor profile tier. @returns {string} */
    getRecommendedProfileSize: () => 'w185',

    /** Matches container width to closest TMDb artwork tier. @returns {string} */
    getRecommendedSizeForContainer: (containerWidth, isBackdrop = false) => networkMonitor.getRecommendedSizeForContainer(containerWidth, isBackdrop),

    /** Flushes memoized image tiers and connection caches. */
    invalidateImageQualityCache: () => networkMonitor.invalidateImageQualityCache(),

    /** Generates a sized TMDb image CDN URL. @returns {string} */
    getImageUrl: (path, size = null) => networkMonitor.getImageUrl(path, size),

    /** Preloads an image asset in document.head. */
    prefetchImage: (path, size = null) => networkMonitor.prefetchImage(path, size),

    /** Returns active UI language mapped for TMDb queries. @returns {string} */
    getLanguageCode: () => configStore.getLanguageCode(),

    /** Returns whether adult titles are allowed for the active user. @returns {boolean} */
    getIncludeAdult: () => configStore.getIncludeAdult(),

    /** Loads normalized player configuration from PersistentStorage. @returns {Object} */
    getPlayerConfig: () => configStore.getPlayerConfig(),

    /** Invalidates cached player configuration. */
    invalidatePlayerConfig: () => configStore.invalidate(),

    /** Returns priority-ordered embed server descriptors. @returns {Array<Object>} */
    get SERVERS() { return configStore.getServers(); },

    /** Builds the streaming embed URL for a movie or episode. @returns {string} */
    getVideoUrl: (id, type, season = null, episode = null, serverId = null) => configStore.getVideoUrl(id, type, season, episode, serverId),

    /**
     * Fetches a TMDb endpoint with cacheManager read-through and optional Fisher-Yates shuffle.
     *
     * @param {string} cacheKey - Unique cache entry identifier.
     * @param {string} url - Full TMDb endpoint URL.
     * @param {number} [ttl=15] - Cache TTL in minutes or fractional hours.
     * @param {Function|null} [transformFn=null] - Optional transform applied prior to caching.
     * @param {Object} [options={}] - Shuffle and artwork fetch flags.
     * @returns {Promise<any>} Cached or freshly parsed payload.
     */
    async _fetchWithCache(cacheKey, url, ttl = 15, transformFn = null, options = {}) {
        if (cacheKey) {
            const cached = cacheManager.get(cacheKey);
            if (cached) return (options.shuffle && Array.isArray(cached)) ? httpClient.shuffleArray([...cached]) : cached;
        }
        try {
            let data = await httpClient.fetchTmdb(url, options);
            if (transformFn) data = transformFn(data) || data;
            if (cacheKey && data) cacheManager.set(cacheKey, data, httpClient.normalizeTtlMinutes(ttl));
            return (options.shuffle && Array.isArray(data)) ? httpClient.shuffleArray([...data]) : data;
        } catch (error) {
            console.error(`_fetchWithCache error for ${url}:`, error);
            throw error;
        }
    },

    /**
     * Fetches pages 1 and 2 in parallel (up to 30 items) with release-date filtering and caching.
     *
     * @param {string} endpoint - Relative TMDb endpoint path.
     * @param {string} [queryParams=''] - Serialized query string filters.
     * @param {string} cacheKey - Cache entry identifier.
     * @param {number} [ttl=15] - Cache TTL duration.
     * @param {string} [type='movie'] - Media type ('movie' or 'tv').
     * @returns {Promise<Array>} Shuffled list of up to 30 media items.
     */
    async _fetchPagedList(endpoint, queryParams = '', cacheKey, ttl = 15, type = 'movie') {
        if (cacheKey) {
            const cached = cacheManager.get(cacheKey);
            if (cached) return httpClient.shuffleArray([...cached]);
        }
        const lang = this.getLanguageCode();
        const today = httpClient.getTodayDate();
        const hasDate = queryParams.includes('primary_release_date') || queryParams.includes('first_air_date');
        const dateFilter = hasDate ? '' : (type === 'movie' ? `&primary_release_date.lte=${today}` : `&first_air_date.lte=${today}`);
        const cleanParams = queryParams ? `&${queryParams}` : '';
        const baseQuery = `api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}${dateFilter}${cleanParams}&language=${lang}`;

        try {
            const [p1, p2] = await Promise.all([
                httpClient.fetchTmdb(`${BASE_URL}/${endpoint}?${baseQuery}&page=1`),
                httpClient.fetchTmdb(`${BASE_URL}/${endpoint}?${baseQuery}&page=2`)
            ]);
            const combined = [...(p1?.results || []), ...(p2?.results || [])].slice(0, 30);
            if (combined.length > 0 && cacheKey) cacheManager.set(cacheKey, combined, httpClient.normalizeTtlMinutes(ttl));
            return httpClient.shuffleArray(combined);
        } catch (error) {
            console.error(`_fetchPagedList error for ${endpoint}:`, error);
            throw error;
        }
    },

    /**
     * Fetches trending movies and shows for the requested time window with artwork preservation.
     *
     * @param {string} [timeWindow='week'] - Trending window ('day' or 'week').
     * @returns {Promise<Array>} Filtered trending media items.
     */
    async _fetchTrendingList(timeWindow = 'week') {
        const lang = this.getLanguageCode();
        return this._fetchWithCache(
            `trending_all_${timeWindow}_${lang}`,
            `${BASE_URL}/trending/all/${timeWindow}?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&language=${lang}`,
            15,
            (data) => httpClient.filterReleased(data?.results),
            { shuffle: true, preserveOriginalArtwork: true }
        );
    },

    /** Fetches weekly trending movies and TV shows from TMDb. @returns {Promise<Array>} */
    fetchTrending() { return this._fetchTrendingList('week'); },

    /** Fetches daily trending movies and TV shows from TMDb. @returns {Promise<Array>} */
    fetchTrendingToday() { return this._fetchTrendingList('day'); },

    /** Fetches top-rated movies from TMDb. @returns {Promise<Array>} */
    fetchTopRated() { return this._fetchPagedList('movie/top_rated', '', `movie_top_rated_${this.getLanguageCode()}`, 60, 'movie'); },

    /** Fetches popular TV series from TMDb. @returns {Promise<Array>} */
    fetchPopularTV() { return this._fetchPagedList('tv/popular', '', `tv_popular_${this.getLanguageCode()}`, 15, 'tv'); },

    /** Fetches top-rated TV series from TMDb. @returns {Promise<Array>} */
    fetchTopRatedTV() { return this._fetchPagedList('tv/top_rated', '', `tv_top_rated_${this.getLanguageCode()}`, 60, 'tv'); },

    /**
     * Executes a cached discover query on TMDb for a media type and filter query string.
     *
     * @param {string} type - 'movie' or 'tv'.
     * @param {string} params - Query string appended to discover endpoint.
     * @returns {Promise<Array>} List of matching media items.
     */
    _fetchDiscover(type, params) {
        const lang = this.getLanguageCode();
        return this._fetchPagedList(`discover/${type}`, params, `discover_${type}_${params}_${lang}`, 15, type);
    },

    /**
     * Fetches a combined carousel of popular Netflix original movies and TV series.
     *
     * @returns {Promise<Array>} Mixed array of up to 30 Netflix originals with media_type tagged.
     */
    async fetchNetflixOriginals() {
        const lang = this.getLanguageCode();
        const cacheKey = `netflix_originals_combined_${lang}`;
        const cached = cacheManager.get(cacheKey);
        if (cached) return httpClient.shuffleArray([...cached]);

        try {
            const [movies, tv] = await Promise.all([
                this._fetchDiscover('movie', 'with_companies=213|178464|171251'),
                this._fetchDiscover('tv', 'with_networks=213')
            ]);
            const finalResults = [
                ...(movies || []).map(m => ({ ...m, media_type: 'movie' })),
                ...(tv || []).map(t => ({ ...t, media_type: 'tv' }))
            ].slice(0, 30);
            if (finalResults.length > 0) cacheManager.set(cacheKey, finalResults, 15);
            return httpClient.shuffleArray(finalResults);
        } catch (error) {
            console.error('Error fetching netflix originals:', error);
            throw error;
        }
    },

    /** Fetches content filtered by ISO origin country code. @returns {Promise<Array>} */
    fetchByCountry(countryCode, type = 'movie') {
        return this._fetchDiscover(type, `with_origin_country=${countryCode}&sort_by=popularity.desc`);
    },

    /** Fetches content filtered by ISO original language code. @returns {Promise<Array>} */
    fetchByLanguage(langCode, type = 'movie') {
        return this._fetchDiscover(type, `with_original_language=${langCode}&sort_by=popularity.desc`);
    },

    /** Fetches content released within a startYear..endYear window. @returns {Promise<Array>} */
    fetchDecadeContent(type, startYear, endYear) {
        const prefix = type === 'movie' ? 'primary_release_date' : 'first_air_date';
        return this._fetchDiscover(type, `${prefix}.gte=${startYear}-01-01&${prefix}.lte=${endYear}-12-31&sort_by=popularity.desc`);
    },

    /** Fetches content belonging to a streaming network or mapped studio company. @returns {Promise<Array>} */
    fetchNetworkContent(type, networkId) {
        if (type === 'tv') return this._fetchDiscover('tv', `with_networks=${networkId}`);
        return this._fetchDiscover('movie', `with_companies=${NETWORK_COMPANIES[networkId] || ''}`);
    },

    /**
     * Searches TMDb multi-search for released movies and TV series matching query.
     *
     * @param {string} query - User search string.
     * @param {number} [page=1] - Result page index.
     * @returns {Promise<Array>} Released matching results.
     */
    async searchContent(query, page = 1) {
        if (API_KEY.includes('TODO') || !query) return [];
        try {
            const lang = this.getLanguageCode();
            const url = `${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=${page}&include_adult=${this.getIncludeAdult()}&language=${lang}`;
            const data = await httpClient.fetchTmdb(url);
            return httpClient.filterReleased(data?.results);
        } catch (error) {
            console.error('Error searching:', error);
            return [];
        }
    },

    /** Alias for searchContent matching TMDb multi-search naming. @returns {Promise<Array>} */
    searchMulti(query, page = 1) {
        return this.searchContent(query, page);
    },

    /**
     * Fetches recommended titles related to a given TMDb item ID.
     *
     * @param {number|string} id - Reference TMDb content ID.
     * @param {string} type - 'movie' or 'tv'.
     * @returns {Promise<Array>} Released recommendation items.
     */
    async fetchRecommendations(id, type) {
        if (API_KEY.includes('TODO')) return [];
        try {
            const lang = this.getLanguageCode();
            const url = `${BASE_URL}/${type}/${id}/recommendations?api_key=${API_KEY}&include_adult=${this.getIncludeAdult()}&language=${lang}`;
            const data = await httpClient.fetchTmdb(url);
            return httpClient.filterReleased(data?.results);
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            return [];
        }
    },

    /**
     * Fetches full metadata, credits, videos, external IDs, and original-language key art for a title.
     *
     * @param {number|string} id - TMDb item identifier.
     * @param {string} type - 'movie' or 'tv'.
     * @returns {Promise<Object|null>} Enriched details object or null on failure.
     */
    async getDetails(id, type) {
        if (API_KEY.includes('TODO')) return null;
        const lang = this.getLanguageCode();
        const cacheKey = `details_${type}_${id}_${lang}`;
        const cached = cacheManager.get(cacheKey);
        if (cached) return cached;

        try {
            const baseAppend = type === 'movie' ? 'release_dates' : 'content_ratings';
            const url = `${BASE_URL}/${type}/${id}?api_key=${API_KEY}&append_to_response=${baseAppend},videos,credits,external_ids&language=${lang}`;
            const imagesUrl = `${BASE_URL}/${type}/${id}/images?api_key=${API_KEY}`;
            const [response, imagesRes] = await Promise.all([
                httpClient.deduplicatedFetch(url),
                httpClient.deduplicatedFetch(imagesUrl).catch(() => null)
            ]);
            const data = await response.json();
            const imagesData = imagesRes ? await imagesRes.json().catch(() => null) : null;

            if (data && !data.status_code) {
                if (imagesData) data.images = imagesData;
                const pickOriginal = (list, origLang) => list.find(i => i.iso_639_1 === origLang)
                    || list.find(i => i.iso_639_1 === null)
                    || list.find(i => i.iso_639_1 === 'en')
                    || list[0];
                const allPosters = data.images?.posters || [];
                if (allPosters.length > 0) {
                    const p = pickOriginal(allPosters, data.original_language);
                    if (p?.file_path) data.poster_path = p.file_path;
                }
                const allBackdrops = data.images?.backdrops || [];
                if (allBackdrops.length > 0) {
                    const b = pickOriginal(allBackdrops, data.original_language);
                    if (b?.file_path) data.backdrop_path = b.file_path;
                }
                cacheManager.set(cacheKey, data, 10);
            }
            return data;
        } catch (error) {
            console.error('Error fetching details:', error);
            return null;
        }
    },

    /** Alias for getDetails. @returns {Promise<Object|null>} */
    fetchDetails(id, type) { return this.getDetails(id, type); },

    /**
     * Fetches episode metadata for a specific TV series season.
     *
     * @param {number|string} seriesId - TMDb TV show ID.
     * @param {number|string} seasonNumber - Target season number.
     * @returns {Promise<Object|null>} Season details payload.
     */
    async getSeasonDetails(seriesId, seasonNumber) {
        if (API_KEY.includes('TODO')) return null;
        try {
            const lang = this.getLanguageCode();
            const response = await httpClient.deduplicatedFetch(`${BASE_URL}/tv/${seriesId}/season/${seasonNumber}?api_key=${API_KEY}&language=${lang}`);
            return await response.json();
        } catch (error) {
            console.error('Error fetching season details:', error);
            return null;
        }
    },

    /** Fetches seasons array for a TV series. @returns {Promise<Array>} */
    async getSeasons(id) { return (await this.getDetails(id, 'tv'))?.seasons || []; },

    /** Fetches episodes array for a TV series season. @returns {Promise<Array>} */
    async getEpisodes(id, season) { return (await this.getSeasonDetails(id, season))?.episodes || []; },

    /**
     * Returns the registry of TMDb movie and TV genre IDs.
     *
     * @returns {Array<Object>} Genre descriptors with id and English label.
     */
    getGenres() {
        return [
            { id: 28, name: 'Action' }, { id: 12, name: 'Adventure' }, { id: 16, name: 'Animation' }, { id: 35, name: 'Comedy' },
            { id: 80, name: 'Crime' }, { id: 99, name: 'Documentary' }, { id: 18, name: 'Drama' }, { id: 10751, name: 'Family' },
            { id: 14, name: 'Fantasy' }, { id: 36, name: 'History' }, { id: 27, name: 'Horror' }, { id: 10402, name: 'Music' },
            { id: 9648, name: 'Mystery' }, { id: 10749, name: 'Romance' }, { id: 878, name: 'Sci-Fi' }, { id: 10770, name: 'TV Movie' },
            { id: 53, name: 'Thriller' }, { id: 10752, name: 'War' }, { id: 37, name: 'Western' }, { id: 10759, name: 'Action & Adventure (TV)' },
            { id: 10762, name: 'Kids (TV)' }, { id: 10763, name: 'News (TV)' }, { id: 10764, name: 'Reality (TV)' },
            { id: 10765, name: 'Sci-Fi & Fantasy (TV)' }, { id: 10766, name: 'Soap (TV)' }, { id: 10767, name: 'Talk (TV)' },
            { id: 10768, name: 'War & Politics (TV)' }
        ];
    },

    /**
     * Returns supported MPAA and TV parental rating certifications.
     *
     * @returns {Array<string>} Certification strings including XXX if permitted.
     */
    getCertifications() {
        const certs = ['G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'];
        if (this.getIncludeAdult()) certs.push('XXX');
        return certs;
    },

    /**
     * Fetches ISO country configuration list from TMDb, cached 24 hours.
     *
     * @returns {Promise<Array>} Country objects.
     */
    async fetchCountries() {
        try {
            const lang = this.getLanguageCode();
            const data = await this._fetchWithCache(
                `tmdb_countries_${lang}`,
                `${BASE_URL}/configuration/countries?api_key=${API_KEY}&language=${lang}`,
                1440,
                null,
                { preserveOriginalArtwork: false }
            );
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error('Error fetching countries:', error);
            return [];
        }
    },

    /**
     * Fetches regional streaming watch providers from TMDb, cached 24 hours.
     *
     * @param {string} [type='movie'] - 'movie' or 'tv'.
     * @param {string} [region='US'] - ISO country code.
     * @returns {Promise<Array>} Provider objects.
     */
    async fetchWatchProviders(type = 'movie', region = 'US') {
        try {
            const lang = this.getLanguageCode();
            const data = await this._fetchWithCache(
                `watch_providers_${type}_${region}_${lang}`,
                `${BASE_URL}/watch/providers/${type}?api_key=${API_KEY}&watch_region=${region}&language=${lang}`,
                1440,
                d => d?.results || [],
                { preserveOriginalArtwork: false }
            );
            return Array.isArray(data) ? data : (data?.results || []);
        } catch (error) {
            console.error('Error fetching watch providers:', error);
            return [];
        }
    },

    /**
     * Queries TMDb discover endpoint using multi-criteria search filters.
     *
     * @param {Object} filters - Genre, year, decade, certification, runtime, network, and region criteria.
     * @returns {Promise<Array>} Matching titles tagged with media_type.
     */
    async discoverContent(filters) {
        if (API_KEY.includes('TODO')) return [];
        try {
            const lang = this.getLanguageCode();
            const type = filters.type || 'movie';
            const isMovie = type === 'movie';

            const params = new URLSearchParams({
                api_key: API_KEY,
                sort_by: filters.sortBy || 'popularity.desc',
                include_adult: this.getIncludeAdult(),
                include_video: 'false',
                page: String(filters.page || 1),
                language: lang
            });

            if (filters.genres?.length) params.append('with_genres', filters.genres.join(','));
            if (filters.certification) { params.append('certification_country', 'US'); params.append('certification', filters.certification); }
            if (filters.year) { params.append('primary_release_year', filters.year); params.append('first_air_date_year', filters.year); }
            else if (filters.decade) {
                const start = parseInt(filters.decade, 10);
                const prefix = isMovie ? 'primary_release_date' : 'first_air_date';
                if (start === 1970) params.append(`${prefix}.lte`, '1979-12-31');
                else { params.append(`${prefix}.gte`, `${start}-01-01`); params.append(`${prefix}.lte`, `${start + 9}-12-31`); }
            }
            if (filters.runtime === 'short') params.append('with_runtime.lte', '90');
            else if (filters.runtime === 'medium') { params.append('with_runtime.gte', '90'); params.append('with_runtime.lte', '120'); }
            else if (filters.runtime === 'long') params.append('with_runtime.gte', '120');

            if (filters.network) {
                if (!isMovie) params.append('with_networks', filters.network);
                else if (NETWORK_COMPANIES[filters.network]) params.append('with_companies', NETWORK_COMPANIES[filters.network]);
            }
            if (filters.originCountry) params.append('with_origin_country', filters.originCountry);
            if (filters.watchProviders?.length) {
                params.append('watch_region', filters.watchRegion || 'US');
                params.append('with_watch_providers', filters.watchProviders.join('|'));
            }
            if (filters.voteCount) params.append('vote_count.gte', filters.voteCount);

            const data = await httpClient.fetchTmdb(`${BASE_URL}/discover/${type}?${params.toString()}`);
            if (!data?.results) return [];
            return data.results.map(item => ({ ...item, media_type: type }));
        } catch (error) {
            console.error('Error discovering content:', error);
            return [];
        }
    },

    /** Returns fallback placeholder items when TMDb API key is absent. @returns {Array<Object>} */
    getMockData() {
        return [
            { id: 1, title: 'Mock Movie 1', backdrop_path: null, poster_path: null, overview: 'This is a mock movie description because the API key is missing.', media_type: 'movie' },
            { id: 2, name: 'Mock Series 1', backdrop_path: null, poster_path: null, overview: 'This is a mock series description.', media_type: 'tv' }
        ];
    }
};

for (const [methodName, [mediaType, paramsOrBuilder]] of Object.entries(DISCOVER_RECIPES)) {
    /** Dispatches recipe-configured TMDb discover call for browse category rows. */
    Api[methodName] = function discoverRecipe() {
        const query = typeof paramsOrBuilder === 'function' ? paramsOrBuilder() : paramsOrBuilder;
        return this._fetchDiscover(mediaType, query);
    };
}
