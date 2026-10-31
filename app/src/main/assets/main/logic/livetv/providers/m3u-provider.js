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
            const optimizedPlaylistUrl = StreamOptimizer.optimizePlaylistUrl(this.url);
            let response = null;

            // Public GitHub/iptv-org playlists support direct CORS and fetch 10x faster directly
            const isCorsSafePublic = /^https:\/\/(raw\.githubusercontent\.com|iptv-org\.github\.io)\//i.test(optimizedPlaylistUrl);
            if (isCorsSafePublic) {
                try {
                    response = await this.fetchWithTimeout(optimizedPlaylistUrl);
                } catch (directErr) {
                    response = null;
                }
            }

            if (!response || !response.ok) {
                const targetUrl = proxyUrl(optimizedPlaylistUrl);
                response = await this.fetchWithTimeout(targetUrl);
            }

            if (!response.ok) {
                console.warn(`[M3uProvider] HTTP error ${response.status} for ${this.name} (${this.url})`);
                return [];
            }

            const rawText = await response.text();
            const parsedItems = M3UParser.parse(rawText);

            return parsedItems
                .filter(item => {
                    const rawName = (item.name || '').toLowerCase();
                    const rawUrl = (item.url || '').toLowerCase();
                    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) return false;
                    // Skip geo-blocked, DRM-encrypted, or known dead hosts
                    if (/\[geo-?blocked\]|\[drm\]|live_aes\.isml|rabah\.net|ln24\.be|145\.239\.5\.177|artesimulcast\.akamaized\.net/i.test(`${rawName} ${rawUrl}`)) {
                        return false;
                    }
                    return true;
                })
                .map(item => {
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

