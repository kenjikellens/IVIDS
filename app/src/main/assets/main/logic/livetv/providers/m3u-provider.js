/**
 * M3uProvider Strategy
 * ====================
 * Concrete provider that fetches and parses standard M3U/M3U8 playlists
 * from remote HTTP/HTTPS URLs (including GitHub Free-TV, regional lists, and custom user M3U URLs).
 */

import { BaseStreamProvider } from './base-provider.js';
import { M3UParser } from '../../m3u-parser.js';
import { proxyUrl } from '../../../gui/js/utils/proxy.js';
import { StreamOptimizer } from '../core/stream-optimizer.js';

export class M3uProvider extends BaseStreamProvider {
    /**
     * Initializes an M3U playlist provider.
     * 
     * @param {string} id - Unique source identifier.
     * @param {string} name - Source name.
     * @param {string} url - Remote M3U playlist URL.
     * @param {Object} [options] - Optional category, priority, and country tags.
     */
    constructor(id, name, url, options = {}) {
        super(id, name, options);
        this.url = (url || '').trim();
        this.countryTag = options.country ? options.country.toLowerCase() : '';
    }

    /**
     * Fetches the playlist content via proxy and returns normalized Channel instances.
     * 
     * @returns {Promise<Array<Channel>>} Parsed channels.
     */
    async fetchChannels() {
        if (!this.url || !this.enabled) return [];

        try {
            const targetUrl = proxyUrl(StreamOptimizer.optimizePlaylistUrl(this.url));
            const response = await this.fetchWithTimeout(targetUrl);
            if (!response.ok) {
                console.warn(`[M3uProvider] HTTP error ${response.status} for ${this.name} (${this.url})`);
                return [];
            }

            const rawText = await response.text();
            const parsedItems = M3UParser.parse(rawText);

            return parsedItems.map(item => {
                const group = item.group || this.category;
                const extraTags = this.countryTag ? [this.countryTag] : [];
                const optimizedUrl = StreamOptimizer.optimizeStreamUrl(item.url);
                const reqHeaders = StreamOptimizer.getRequiredHeaders(optimizedUrl);
                return this.createChannel({
                    name: item.name,
                    url: optimizedUrl,
                    logo: item.logo || '',
                    group: group,
                    groupTags: extraTags,
                    tvgId: item.tvgId || '',
                    headers: reqHeaders
                });
            });
        } catch (error) {
            console.warn(`[M3uProvider] Failed to load ${this.name}:`, error.message);
            return [];
        }
    }
}

