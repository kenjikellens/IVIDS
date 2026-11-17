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
        this._progressSubscribers = new Set();
        this._brokenUrlsSet = null;
        this.cacheTtlMs = 15 * 60 * 1000; // 15 minutes
    }

    /**
     * Loads and caches normalized URLs from broken-channels.json so dead streams are filtered out.
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
                        const norm = Channel.normalizeUrl(list[i]);
                        if (norm) brokenSet.add(norm);
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
     * Sorts a channel array strictly alphabetically from A to Z by channel display name.
     *
     * @param {Array<Channel>} list - Channels to sort in place.
     * @returns {Array<Channel>} Alphabetically sorted channels.
     */
    _sortChannels(list) {
        return list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
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
                    const matchedGenre = ALLOWED_GENRES.find(g => g.toLowerCase() === primary.toLowerCase());
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
     * Executes all registered providers in parallel, progressively invokes onProgress as providers resolve,
     * deduplicates by URL (enriching country metadata when a regional source resolves for an existing URL),
     * and builds the O(1) category index. Never discards channels based on broken-channels.json.
     * 
     * @param {Set<string>} [_deprecatedBrokenSet] - Ignored so channels are never permanently hidden.
     * @param {boolean} [forceRefresh=false] - Bypasses memory cache if true.
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

        const providerList = Array.from(this.providers.values()).filter(p => p.enabled);
        if (providerList.length === 0) return [];

        this.isCacheComplete = false;
        const merged = [];
        const byNormalizedUrl = new Map();
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
            const brokenSet = await this._loadBrokenUrlsSet();

            const fetchPromises = providerList.map(async provider => {
                try {
                    const channels = await provider.fetchChannels();
                    if (Array.isArray(channels) && channels.length > 0) {
                        let changed = false;
                        channels.forEach(channel => {
                            if (!(channel instanceof Channel)) {
                                channel = new Channel(channel);
                            }
                            const optimizedUrl = StreamOptimizer.optimizeStreamUrl(channel.url);
                            if (optimizedUrl && optimizedUrl !== channel.url) {
                                channel.url = optimizedUrl;
                                channel.normalizedUrl = Channel.normalizeUrl(optimizedUrl);
                            }
                            const normalized = channel.normalizedUrl;
                            if (!normalized || brokenSet.has(normalized)) return;

                            const existing = byNormalizedUrl.get(normalized);
                            if (existing) {
                                // Merge all country tags so regional playlists never lose channels to earlier language playlists
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
                                }
                                if (!existing.tvgId && channel.tvgId) {
                                    existing.tvgId = channel.tvgId;
                                }
                                if (!existing.logo && channel.logo) {
                                    existing.logo = channel.logo;
                                }
                                return;
                            }

                            byNormalizedUrl.set(normalized, channel);
                            merged.push(channel);
                            changed = true;
                        });

                        if (changed) {
                            this.cachedChannels = merged;
                            const ts = Date.now();
                            if (lastProgressNotify === 0 || (ts - lastProgressNotify) >= 350) {
                                flushProgress();
                            } else if (!progressFlushTimer) {
                                progressFlushTimer = setTimeout(flushProgress, 350 - (ts - lastProgressNotify));
                            }
                        }
                    }
                    return channels;
                } catch (err) {
                    console.warn(`[SourceManager] Provider ${provider.name} failed:`, err);
                    return [];
                }
            });

            await Promise.allSettled(fetchPromises);
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
            this._progressSubscribers.clear();
            return this.cachedChannels;
        })();

        return this._inFlightPromise;
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
        this._progressSubscribers.clear();
    }
}

// Export singleton instance
export const sourceManager = new SourceManager();
