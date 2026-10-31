/**
 * SourceManager Facade / Orchestrator
 * ===================================
 * Central registry and orchestrator for all Live TV stream providers.
 * Manages parallel execution, error isolation, stream scoring, URL deduplication,
 * and broken-channel filtering.
 */

import { Channel } from './channel.js';
import { SportsProvider } from '../providers/sports-provider.js';
import { M3uProvider } from '../providers/m3u-provider.js';
import { XtreamProvider } from '../providers/xtream-provider.js';
import { REGIONAL_CATALOG } from '../catalogs/regional-sources.js';

export class SourceManager {
    /**
     * Initializes the SourceManager singleton instance.
     */
    constructor() {
        this.providers = new Map();
        this.cachedChannels = [];
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
     * Registers the full suite of default providers (Sports, Regional Catalogs, Custom M3Us).
     * 
     * @param {Object} [settings] - Merged user settings.
     */
    registerDefaultProviders(settings = {}) {
        this.providers.clear();

        // 1. High-priority Canal+ Football & Live Sports
        const sports = new SportsProvider();
        this.registerProvider(sports);

        // 2. Curated Regional and Global M3U catalogs (NL, BE, ES, FR, DE, PT, IT, Global)
        REGIONAL_CATALOG.forEach(entry => {
            const m3u = new M3uProvider(entry.id, entry.name, entry.url, {
                category: entry.category,
                country: entry.country,
                priority: entry.priority
            });
            this.registerProvider(m3u);
        });

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
                    priority: 3 // Higher priority than public regional
                });
                this.registerProvider(customProvider);
            });
        } else if (settings.m3uUrl) {
            const singleCustom = new M3uProvider('custom_single', 'Custom Playlist', settings.m3uUrl, {
                category: 'Custom',
                priority: 3
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
     * Executes all registered providers in parallel, merges results, deduplicates by URL,
     * excludes persistent broken channels, and sorts streams by viability score and priority.
     * 
     * @param {Set<string>} [brokenUrlsSet] - Set of normalized broken channel URLs to skip.
     * @param {boolean} [forceRefresh] - Bypasses memory cache if true.
     * @returns {Promise<Array<Channel>>} Sorted and deduplicated channels.
     */
    async loadAllChannels(brokenUrlsSet = new Set(), forceRefresh = false) {
        const now = Date.now();
        if (!forceRefresh && this.cachedChannels.length > 0 && (now - this.lastFetchTimestamp < this.cacheTtlMs)) {
            return this.cachedChannels;
        }

        const providerList = Array.from(this.providers.values()).filter(p => p.enabled);
        if (providerList.length === 0) return [];

        // Parallel execution with error containment via allSettled
        const fetchPromises = providerList.map(async provider => {
            try {
                return await provider.fetchChannels();
            } catch (err) {
                console.warn(`[SourceManager] Provider ${provider.name} failed:`, err);
                return [];
            }
        });

        const results = await Promise.allSettled(fetchPromises);
        const merged = [];
        const seenUrls = new Set();

        results.forEach(res => {
            if (res.status === 'fulfilled' && Array.isArray(res.value)) {
                res.value.forEach(channel => {
                    if (!(channel instanceof Channel)) {
                        channel = new Channel(channel);
                    }

                    const normalized = channel.normalizedUrl;
                    if (!normalized || seenUrls.has(normalized)) return;
                    if (brokenUrlsSet && brokenUrlsSet.has(normalized)) return;

                    seenUrls.add(normalized);
                    merged.push(channel);
                });
            }
        });

        // Sort: Sports channels first, then by stream score, then source priority, then alphabetical
        merged.sort((a, b) => {
            // Live sports channels first
            if (a.isLiveMatch !== b.isLiveMatch) return b.isLiveMatch ? 1 : -1;
            if (a.isSports !== b.isSports) return b.isSports ? 1 : -1;

            // Stream viability score (.m3u8 vs .ts)
            const scoreDiff = b.getStreamScore() - a.getStreamScore();
            if (scoreDiff !== 0) return scoreDiff;

            // Source priority (lower number = higher priority)
            const prioDiff = a.sourcePriority - b.sourcePriority;
            if (prioDiff !== 0) return prioDiff;

            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

        this.cachedChannels = merged;
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
     * Clears internal memory cache.
     */
    clearCache() {
        this.cachedChannels = [];
        this.lastFetchTimestamp = 0;
    }
}

// Export singleton instance
export const sourceManager = new SourceManager();

