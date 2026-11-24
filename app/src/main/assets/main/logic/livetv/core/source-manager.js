/**
 * SourceManager Facade / Orchestrator
 * ===================================
 * Central registry and orchestrator for all Live TV stream providers.
 * Manages parallel execution, progressive delivery, error isolation, stream scoring,
 * URL deduplication (promoting explicit country tags when a regional provider also lists a channel),
 * and O(1) pre-indexed category/country buckets.
 */

import { Channel } from './channel.js';
import { SportsProvider } from '../providers/sports-provider.js';
import { M3uProvider } from '../providers/m3u-provider.js';
import { XtreamProvider } from '../providers/xtream-provider.js';
import { REGIONAL_CATALOG } from '../catalogs/regional-sources.js';
import { StreamOptimizer } from './stream-optimizer.js';

const ALLOWED_GENRES = [
    'News', 'Movies', 'Entertainment', 'Music', 'Kids', 'Documentary',
    'General', 'Series', 'Comedy', 'Lifestyle', 'Culture', 'Education', 'Science'
];
const ALLOWED_GENRE_MAP = new Map(ALLOWED_GENRES.map(g => [g.toLowerCase(), g]));
const CHANNEL_NAME_COLLATOR = typeof Intl !== 'undefined' ? new Intl.Collator(undefined, { sensitivity: 'base' }) : null;
const LIVETV_IDB_NAME = 'ivids-livetv-cache';
const LIVETV_IDB_STORE = 'snapshots';
const LIVETV_IDB_KEY = 'channels_v1';
const DISK_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export class SourceManager {
    /**
     * Initializes the SourceManager singleton instance with an O(1) category index map.
     */
    constructor() {
        this.providers = new Map();
        this.cachedChannels = [];
        this.categoryIndex = new Map();
        this.lastFetchTimestamp = 0;
        this.isCacheComplete = false;
        this._inFlightPromise = null;
        this._deferredPromise = null;
        this._deferredProviders = [];
        this._progressSubscribers = new Set();
        this._brokenUrlsSet = null;
        this.cacheTtlMs = 15 * 60 * 1000; // 15 minutes
    }

    /**
     * Detects Android TV, Android WebView, or low-memory devices to bound concurrent fetches and defer heavy lists.
     *
     * @returns {boolean} True when running on Android or a low-memory device.
     */
    static isLowRamDevice() {
        try {
            if (typeof window !== 'undefined' && window.AndroidSettings && typeof window.AndroidSettings.isTV === 'function') {
                return true;
            }
            if (typeof navigator !== 'undefined') {
                if (/Android/i.test(navigator.userAgent || '')) return true;
                if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2) return true;
            }
        } catch (_) {}
        return false;
    }

    /**
     * Removes a previously registered progress callback so unmounted UI views stop receiving updates.
     *
     * @param {Function} callback - Registered subscriber function.
     */
    unsubscribeProgress(callback) {
        if (callback) {
            this._progressSubscribers.delete(callback);
        }
    }

    /**
     * Reports whether deferred global/language playlists remain unloaded on this low-RAM session.
     *
     * @returns {boolean} True when deferred providers are waiting to be fetched on demand.
     */
    hasDeferredProviders() {
        return Array.isArray(this._deferredProviders) && this._deferredProviders.length > 0;
    }

    /**
     * Opens the lightweight IndexedDB snapshot store, returning null if unsupported or blocked.
     *
     * @returns {Promise<IDBDatabase|null>} Opened database handle or null.
     */
    _openCacheDb() {
        return new Promise((resolve) => {
            try {
                if (typeof indexedDB === 'undefined') {
                    resolve(null);
                    return;
                }
                const req = indexedDB.open(LIVETV_IDB_NAME, 1);
                req.onupgradeneeded = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains(LIVETV_IDB_STORE)) {
                        db.createObjectStore(LIVETV_IDB_STORE);
                    }
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => resolve(null);
                req.onblocked = () => resolve(null);
            } catch (_) {
                resolve(null);
            }
        });
    }

    /**
     * Reads the persisted channel snapshot from IndexedDB for instant cold-start rendering.
     *
     * @returns {Promise<{timestamp: number, channels: Array<Object>}|null>} Cached payload or null.
     */
    async _readCachedSnapshot() {
        const db = await this._openCacheDb();
        if (!db) return null;
        return new Promise((resolve) => {
            try {
                const tx = db.transaction(LIVETV_IDB_STORE, 'readonly');
                const req = tx.objectStore(LIVETV_IDB_STORE).get(LIVETV_IDB_KEY);
                req.onsuccess = () => {
                    const data = req.result;
                    try { db.close(); } catch (_) {}
                    if (data && Array.isArray(data.channels) && (Date.now() - (data.timestamp || 0)) < DISK_CACHE_TTL_MS) {
                        resolve(data);
                    } else {
                        resolve(null);
                    }
                };
                req.onerror = () => {
                    try { db.close(); } catch (_) {}
                    resolve(null);
                };
            } catch (_) {
                try { db.close(); } catch (_) {}
                resolve(null);
            }
        });
    }

    /**
     * Persists compact channel metadata to IndexedDB so subsequent sessions start without 41+ network fetches.
     *
     * @param {Array<Channel>} channels - Sorted deduplicated Channel instances.
     */
    async _writeCachedSnapshot(channels) {
        if (!Array.isArray(channels) || channels.length === 0) return;
        const db = await this._openCacheDb();
        if (!db) return;
        try {
            const compact = channels.map(c => ({
                id: c.id,
                name: c.rawName || c.name,
                url: c.url,
                fallbackUrls: c.fallbackUrls,
                logo: c.logo,
                group: c.group,
                groupTags: c.groupTags,
                country: c.country,
                countries: c.countries ? Array.from(c.countries) : undefined,
                tvgId: c.tvgId,
                sourceName: c.sourceName,
                sourcePriority: c.sourcePriority,
                headers: c.headers,
                isSports: c.isSports,
                isLiveMatch: c.isLiveMatch
            }));
            const tx = db.transaction(LIVETV_IDB_STORE, 'readwrite');
            tx.objectStore(LIVETV_IDB_STORE).put({ timestamp: Date.now(), channels: compact }, LIVETV_IDB_KEY);
            tx.oncomplete = () => { try { db.close(); } catch (_) {} };
            tx.onerror = () => { try { db.close(); } catch (_) {} };
        } catch (_) {
            try { db.close(); } catch (_) {}
        }
    }

    /**
     * Loads and caches normalized URLs from broken-channels.json so dead streams are filtered out.
     * Skips regex normalization when entries are already pre-normalized during build/preprocessing.
     * @returns {Promise<Set<string>>} Set of normalized broken channel URLs.
     */
    async _loadBrokenUrlsSet() {
        if (this._brokenUrlsSet) return this._brokenUrlsSet;
        const brokenSet = new Set();
        try {
            const url = new URL('../broken-channels.json', import.meta.url).href;
            const res = await fetch(url);
            if (res && res.ok) {
                const list = await res.json();
                if (Array.isArray(list)) {
                    for (let i = 0; i < list.length; i++) {
                        const raw = list[i];
                        if (!raw) continue;
                        if (!raw.startsWith('http://') && !raw.startsWith('https://') && !raw.endsWith('/')) {
                            brokenSet.add(raw);
                        } else {
                            const norm = Channel.normalizeUrl(raw);
                            if (norm) brokenSet.add(norm);
                        }
                    }
                }
            }
        } catch (err) {
            console.warn('[SourceManager] Could not load broken-channels.json:', err?.message || err);
        }
        this._brokenUrlsSet = brokenSet;
        return brokenSet;
    }

    /**
     * Registers a stream provider strategy.
     * 
     * @param {BaseStreamProvider} provider - Concrete provider instance.
     */
    registerProvider(provider) {
        if (!provider || !provider.id) return;
        this.providers.set(provider.id, provider);
    }

    /**
     * Unregisters a provider by its ID.
     * 
     * @param {string} id - Provider identifier.
     */
    unregisterProvider(id) {
        this.providers.delete(id);
    }

    /**
     * Registers the full suite of default providers (Regional Catalogs, Sports, Custom M3Us, Xtream).
     * 
     * @param {Object} [settings] - Merged user settings.
     */
    registerDefaultProviders(settings = {}) {
        this.providers.clear();

        // 1. Curated Regional and Global M3U catalogs (Free-TV Global, NL, BE, ES, FR, DE, PT, IT, UK, USA)
        REGIONAL_CATALOG.forEach(entry => {
            const m3u = new M3uProvider(entry.id, entry.name, entry.url, {
                category: entry.category,
                country: entry.country,
                priority: entry.priority
            });
            m3u.deferOnLowRam = Boolean(entry.deferOnLowRam);
            this.registerProvider(m3u);
        });

        // 2. Live Sports provider
        const sports = new SportsProvider();
        this.registerProvider(sports);

        // 3. User Custom M3U Playlists
        const customPlaylists = settings.m3uPlaylists || [];
        if (customPlaylists.length > 0) {
            customPlaylists.forEach((item, idx) => {
                if (!item || !item.url) return;
                let name = item.name;
                if (!name) {
                    try {
                        const host = new URL(item.url).hostname;
                        name = host ? `${host} (M3U)` : `Custom Playlist ${idx + 1}`;
                    } catch (e) {
                        name = `Custom Playlist ${idx + 1}`;
                    }
                }
                const customProvider = new M3uProvider(`custom_${item.id || idx}`, name, item.url, {
                    category: 'Custom',
                    priority: 1
                });
                this.registerProvider(customProvider);
            });
        } else if (settings.m3uUrl) {
            const singleCustom = new M3uProvider('custom_single', 'Custom Playlist', settings.m3uUrl, {
                category: 'Custom',
                priority: 1
            });
            this.registerProvider(singleCustom);
        }

        // 4. Xtream Codes provider if credentials present
        if (settings.xtreamServer && settings.xtreamUser && settings.xtreamPassword) {
            const xtream = new XtreamProvider(settings.xtreamServer, settings.xtreamUser, settings.xtreamPassword);
            this.registerProvider(xtream);
        }
    }

    /**
     * Sorts a channel array strictly alphabetically from A to Z using a pre-allocated Intl.Collator.
     *
     * @param {Array<Channel>} list - Channels to sort in place.
     * @returns {Array<Channel>} Alphabetically sorted channels.
     */
    _sortChannels(list) {
        if (CHANNEL_NAME_COLLATOR) {
            return list.sort((a, b) => CHANNEL_NAME_COLLATOR.compare(a.name, b.name));
        }
        return list.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    }

    /**
     * Cross-links alternate stream URLs across channels sharing the same normalized name + country or tvgId
     * so LiveStreamEngine can automatically fail over when a primary server (e.g. raw IP or dead domain) is offline.
     *
     * @param {Array<Channel>} channels - Sorted array of channels.
     */
    _linkMirrorFallbackUrls(channels) {
        const groups = new Map();
        channels.forEach(c => {
            const key = c.tvgId
                ? `tvg:${c.tvgId.toLowerCase()}`
                : `name:${c.country || 'global'}:${c.searchNameLower}`;
            let list = groups.get(key);
            if (!list) {
                list = [];
                groups.set(key, list);
            }
            list.push(c);
        });

        groups.forEach(list => {
            if (list.length <= 1) return;
            const allUrls = list.map(ch => ch.url).filter(Boolean);
            list.forEach(ch => {
                const existingFb = Array.isArray(ch.fallbackUrls) ? ch.fallbackUrls : [];
                const mergedFb = [...existingFb];
                allUrls.forEach(u => {
                    if (u !== ch.url && !mergedFb.includes(u) && mergedFb.length < 4) {
                        mergedFb.push(u);
                    }
                });
                ch.fallbackUrls = mergedFb;
            });
        });
    }

    /**
     * Rebuilds the O(1) category and country lookup buckets (`categoryIndex`) for instant UI filtering.
     *
     * @param {Array<Channel>} channels - Array of channels to index.
     * @param {boolean} [linkMirrors=true] - Whether to cross-link mirror fallback URLs across identical channels.
     */
    _rebuildCategoryIndex(channels, linkMirrors = true) {
        if (linkMirrors) {
            this._linkMirrorFallbackUrls(channels);
        }
        this.categoryIndex.clear();
        this.categoryIndex.set('all', channels);

        const sportsBucket = [];
        this.categoryIndex.set('sports', sportsBucket);

        channels.forEach(c => {
            if (c.isSports) {
                sportsBucket.push(c);
            }

            if (c.countries && c.countries.size > 0) {
                c.countries.forEach(country => {
                    const countryKey = `country:${country}`;
                    let bucket = this.categoryIndex.get(countryKey);
                    if (!bucket) {
                        bucket = [];
                        this.categoryIndex.set(countryKey, bucket);
                    }
                    bucket.push(c);
                });
            } else if (c.country) {
                const countryKey = `country:${c.country}`;
                let bucket = this.categoryIndex.get(countryKey);
                if (!bucket) {
                    bucket = [];
                    this.categoryIndex.set(countryKey, bucket);
                }
                bucket.push(c);
            }

            if (c.group) {
                const primary = c.group.split(/[;|]/)[0]?.trim() || '';
                if (primary) {
                    const matchedGenre = ALLOWED_GENRE_MAP.get(primary.toLowerCase());
                    if (matchedGenre) {
                        const genreKey = `genre:${matchedGenre.toLowerCase()}`;
                        let gBucket = this.categoryIndex.get(genreKey);
                        if (!gBucket) {
                            gBucket = [];
                            this.categoryIndex.set(genreKey, gBucket);
                        }
                        gBucket.push(c);
                    }
                }
            }
        });
    }

    /**
     * Returns the pre-indexed array of channels for a given category/country key in O(1) time.
     *
     * @param {string} [categoryKey='all'] - Category key ('all', 'sports', 'country:belgium', 'genre:news', etc.).
     * @returns {Array<Channel>} Matching channels.
     */
    getChannelsByCategory(categoryKey = 'all') {
        if (!categoryKey || categoryKey === 'all') {
            return this.cachedChannels;
        }
        return this.categoryIndex.get(categoryKey) || [];
    }

    /**
     * Ingests a provider's parsed channel list into the deduplicated merged array and map.
     * Enforces dead-stream filtering and merges country, sports, group, tvgId, and logo metadata.
     *
     * @param {Array<Object|Channel>} channels - Parsed channels from one provider.
     * @param {Set<string>} brokenSet - Normalized dead stream URLs.
     * @param {Map<string, Channel>} byNormalizedUrl - Deduplication map keyed by normalized URL.
     * @param {Array<Channel>} merged - Accumulated deduplicated channels array.
     * @returns {boolean} True when new channels or metadata updates were applied.
     */
    _ingestProviderChannels(channels, brokenSet, byNormalizedUrl, merged) {
        if (!Array.isArray(channels) || channels.length === 0) return false;
        let changed = false;

        for (let i = 0; i < channels.length; i++) {
            let channel = channels[i];
            if (!(channel instanceof Channel)) {
                channel = new Channel(channel);
            }
            const optimizedUrl = StreamOptimizer.optimizeStreamUrl(channel.url);
            if (optimizedUrl && optimizedUrl !== channel.url) {
                channel.url = optimizedUrl;
                channel.normalizedUrl = Channel.normalizeUrl(optimizedUrl);
            }
            const normalized = channel.normalizedUrl;
            if (!normalized || brokenSet.has(normalized)) continue;

            const existing = byNormalizedUrl.get(normalized);
            if (existing) {
                if (channel.country && existing.addCountry(channel.country)) {
                    changed = true;
                }
                if (channel.countries && channel.countries.size > 0) {
                    channel.countries.forEach(ctry => {
                        if (existing.addCountry(ctry)) changed = true;
                    });
                }
                if (!existing.isSports && channel.isSports) {
                    existing.isSports = true;
                    changed = true;
                }
                if ((!existing.group || existing.group === 'General') && channel.group && channel.group !== 'General') {
                    existing.group = channel.group;
                    existing.searchGroupLower = channel.group.toLowerCase();
                }
                if (!existing.tvgId && channel.tvgId) {
                    existing.tvgId = channel.tvgId;
                }
                if (!existing.logo && channel.logo) {
                    existing.logo = channel.logo;
                }
                continue;
            }

            byNormalizedUrl.set(normalized, channel);
            merged.push(channel);
            changed = true;
        }
        return changed;
    }

    /**
     * Executes providers through a priority-ordered concurrency worker pool and yields between completions
     * so low-CPU Android TV WebViews remain responsive during heavy playlist ingestion.
     *
     * @param {Array<BaseStreamProvider>} providers - Enabled providers to fetch.
     * @param {number} concurrency - Maximum parallel provider fetches.
     * @param {Function} onProviderDone - Callback invoked with each provider's channel array.
     * @returns {Promise<void>}
     */
    async _runProviderPool(providers, concurrency, onProviderDone) {
        const ordered = [...providers].sort((a, b) => (a.priority || 50) - (b.priority || 50));
        let cursor = 0;
        const workerCount = Math.min(Math.max(1, concurrency), ordered.length);

        const worker = async () => {
            while (cursor < ordered.length) {
                const provider = ordered[cursor++];
                try {
                    const channels = await provider.fetchChannels();
                    onProviderDone(channels);
                } catch (err) {
                    console.warn(`[SourceManager] Provider ${provider.name} failed:`, err);
                }
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        };

        await Promise.all(Array.from({ length: workerCount }, () => worker()));
    }

    /**
     * Executes providers through a bounded concurrency pool (4 TV / 8 PC), hydrates instant IndexedDB snapshots
     * when available, progressively notifies subscribers, and builds the O(1) category index.
     * 
     * @param {Set<string>} [_deprecatedBrokenSet] - Ignored so channels are never permanently hidden.
     * @param {boolean} [forceRefresh=false] - Bypasses memory/disk cache if true.
     * @param {Function} [onProgress=null] - Optional callback invoked progressively with current merged channels.
     * @returns {Promise<Array<Channel>>} Sorted and deduplicated channels.
     */
    async loadAllChannels(_deprecatedBrokenSet = null, forceRefresh = false, onProgress = null) {
        const now = Date.now();
        if (!forceRefresh && this.isCacheComplete && this.cachedChannels.length > 0 && (now - this.lastFetchTimestamp < this.cacheTtlMs)) {
            if (typeof onProgress === 'function') {
                onProgress(this.cachedChannels);
            }
            return this.cachedChannels;
        }

        if (typeof onProgress === 'function') {
            this._progressSubscribers.add(onProgress);
            if (this.cachedChannels.length > 0) {
                onProgress(this.cachedChannels);
            }
        }

        if (this._inFlightPromise && !forceRefresh) {
            return this._inFlightPromise;
        }

        const enabledProviders = Array.from(this.providers.values()).filter(p => p.enabled);
        if (enabledProviders.length === 0) return [];

        const lowRam = SourceManager.isLowRamDevice();
        const providerList = [];
        this._deferredProviders = [];
        enabledProviders.forEach(p => {
            if (lowRam && p.deferOnLowRam) {
                this._deferredProviders.push(p);
            } else {
                providerList.push(p);
            }
        });

        this.isCacheComplete = false;
        const merged = [];
        const byNormalizedUrl = new Map();
        const throttleMs = lowRam ? 600 : 450;
        const concurrency = lowRam ? 4 : 8;
        let lastProgressNotify = 0;
        let progressFlushTimer = null;

        const notifySubscribers = (list) => {
            this._progressSubscribers.forEach(cb => {
                try {
                    cb(list);
                } catch (_) {
                    // Ignore subscriber callback errors
                }
            });
        };

        const flushProgress = () => {
            if (progressFlushTimer) {
                clearTimeout(progressFlushTimer);
                progressFlushTimer = null;
            }
            lastProgressNotify = Date.now();
            this._rebuildCategoryIndex(merged, false);
            notifySubscribers(merged);
        };

        this._inFlightPromise = (async () => {
            if (!forceRefresh && this.cachedChannels.length === 0) {
                const snapshot = await this._readCachedSnapshot();
                if (snapshot && snapshot.channels.length > 0) {
                    const hydrated = [];
                    for (let i = 0; i < snapshot.channels.length; i++) {
                        const raw = snapshot.channels[i];
                        const ch = new Channel(raw);
                        if (Array.isArray(raw.countries)) {
                            raw.countries.forEach(ctry => ch.addCountry(ctry));
                        }
                        if (ch.normalizedUrl) {
                            byNormalizedUrl.set(ch.normalizedUrl, ch);
                        }
                        hydrated.push(ch);
                        if (lowRam && i > 0 && i % 800 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 0));
                        }
                    }
                    this.cachedChannels = hydrated;
                    this._rebuildCategoryIndex(hydrated, true);
                    notifySubscribers(hydrated);

                    if ((Date.now() - snapshot.timestamp) < this.cacheTtlMs) {
                        this.lastFetchTimestamp = snapshot.timestamp;
                        this.isCacheComplete = true;
                        this._inFlightPromise = null;
                        this._progressSubscribers.clear();
                        return this.cachedChannels;
                    }
                }
            }

            const brokenSet = await this._loadBrokenUrlsSet();

            await this._runProviderPool(providerList, concurrency, (channels) => {
                const changed = this._ingestProviderChannels(channels, brokenSet, byNormalizedUrl, merged);
                if (changed) {
                    this.cachedChannels = merged;
                    const ts = Date.now();
                    if (lastProgressNotify === 0 || (ts - lastProgressNotify) >= throttleMs) {
                        flushProgress();
                    } else if (!progressFlushTimer) {
                        progressFlushTimer = setTimeout(flushProgress, throttleMs - (ts - lastProgressNotify));
                    }
                }
            });

            if (progressFlushTimer) {
                clearTimeout(progressFlushTimer);
                progressFlushTimer = null;
            }
            this._sortChannels(merged);

            this.cachedChannels = merged;
            this._rebuildCategoryIndex(merged, true);
            this.lastFetchTimestamp = Date.now();
            this.isCacheComplete = true;
            this._inFlightPromise = null;
            notifySubscribers(merged);
            this._progressSubscribers.clear();
            this._writeCachedSnapshot(merged);
            return this.cachedChannels;
        })();

        return this._inFlightPromise;
    }

    /**
     * Fetches any heavy global/language providers deferred during initial low-RAM startup
     * and merges them into the live channel cache on demand.
     *
     * @param {Function} [onComplete=null] - Optional callback invoked once deferred channels are merged.
     * @returns {Promise<Array<Channel>>} Updated cached channels list.
     */
    async loadDeferredProviders(onComplete = null) {
        if (!this.hasDeferredProviders()) {
            return this.cachedChannels;
        }
        if (this._deferredPromise) {
            const list = await this._deferredPromise;
            if (typeof onComplete === 'function') onComplete(list);
            return list;
        }

        const deferred = [...this._deferredProviders];
        this._deferredProviders = [];

        this._deferredPromise = (async () => {
            const brokenSet = await this._loadBrokenUrlsSet();
            const merged = [...this.cachedChannels];
            const byNormalizedUrl = new Map();
            merged.forEach(c => {
                if (c.normalizedUrl) byNormalizedUrl.set(c.normalizedUrl, c);
            });

            await this._runProviderPool(deferred, 3, (channels) => {
                this._ingestProviderChannels(channels, brokenSet, byNormalizedUrl, merged);
            });

            this._sortChannels(merged);
            this.cachedChannels = merged;
            this._rebuildCategoryIndex(merged, true);
            this._writeCachedSnapshot(merged);
            this._deferredPromise = null;
            return this.cachedChannels;
        })();

        const result = await this._deferredPromise;
        if (typeof onComplete === 'function') {
            onComplete(result);
        }
        return result;
    }

    /**
     * Returns the count of registered providers.
     *
     * @returns {number}
     */
    getProviderCount() {
        return this.providers.size;
    }

    /**
     * Clears internal memory cache and category index.
     */
    clearCache() {
        this.cachedChannels = [];
        this.categoryIndex.clear();
        this.lastFetchTimestamp = 0;
        this.isCacheComplete = false;
        this._inFlightPromise = null;
        this._deferredPromise = null;
        this._deferredProviders = [];
        this._progressSubscribers.clear();
    }
}

// Export singleton instance
export const sourceManager = new SourceManager();
