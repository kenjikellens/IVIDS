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
        this.cacheTtlMs = 15 * 60 * 1000; // 15 minutes
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
     * Sorts a channel array by source priority, stream viability score, and name.
     *
     * @param {Array<Channel>} list - Channels to sort in place.
     * @returns {Array<Channel>} Sorted channels.
     */
    _sortChannels(list) {
        return list.sort((a, b) => {
            const prioDiff = a.sourcePriority - b.sourcePriority;
            if (prioDiff !== 0) return prioDiff;

            const scoreDiff = b.getStreamScore() - a.getStreamScore();
            if (scoreDiff !== 0) return scoreDiff;

            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });
    }

    /**
     * Rebuilds the O(1) category and country lookup buckets (`categoryIndex`) for instant UI filtering.
     *
     * @param {Array<Channel>} channels - Sorted array of all channels.
     */
    _rebuildCategoryIndex(channels) {
        this.categoryIndex.clear();
        this.categoryIndex.set('all', channels);

        const sportsBucket = [];
        this.categoryIndex.set('sports', sportsBucket);

        channels.forEach(c => {
            if (c.isSports) {
                sportsBucket.push(c);
            }

            if (c.country) {
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
        if (!forceRefresh && this.cachedChannels.length > 0 && (now - this.lastFetchTimestamp < this.cacheTtlMs)) {
            if (typeof onProgress === 'function') {
                onProgress(this.cachedChannels);
            }
            return this.cachedChannels;
        }

        const providerList = Array.from(this.providers.values()).filter(p => p.enabled);
        if (providerList.length === 0) return [];

        const merged = [];
        const byNormalizedUrl = new Map();

        const fetchPromises = providerList.map(async provider => {
            try {
                const channels = await provider.fetchChannels();
                if (Array.isArray(channels) && channels.length > 0) {
                    let changed = false;
                    channels.forEach(channel => {
                        if (!(channel instanceof Channel)) {
                            channel = new Channel(channel);
                        }
                        const normalized = channel.normalizedUrl;
                        if (!normalized) return;

                        const existing = byNormalizedUrl.get(normalized);
                        if (existing) {
                            // Enrich existing channel if this regional provider supplies a concrete country tag
                            if (!existing.country && channel.country) {
                                existing.country = channel.country;
                                changed = true;
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
                        this._sortChannels(merged);
                        this.cachedChannels = merged;
                        this._rebuildCategoryIndex(merged);
                        if (typeof onProgress === 'function') {
                            onProgress([...merged]);
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
        this._sortChannels(merged);

        this.cachedChannels = merged;
        this._rebuildCategoryIndex(merged);
        this.lastFetchTimestamp = now;
        return this.cachedChannels;
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
    }
}

// Export singleton instance
export const sourceManager = new SourceManager();
