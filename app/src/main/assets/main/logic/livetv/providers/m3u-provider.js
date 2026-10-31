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
        this.countryTag = options.country ? options.country.toLowerCase().trim() : '';
    }

    /**
     * Fetches the playlist content (using direct CORS first for public GitHub/iptv-org playlists,
     * falling back to the local proxy) and returns normalized Channel instances with explicit country metadata.
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
                    // Skip only explicitly DRM-encrypted streams
                    if (/\[drm\]/i.test(rawName)) {
                        return false;
                    }
                    return true;
                })
                .map(item => {
                    const cleanName = (item.name || '').replace(/\s*\[geo-?blocked\]\s*/gi, ' ').trim();
                    const group = item.group || this.category;
                    const extraTags = this.countryTag ? [this.countryTag] : [];
                    const reqHeaders = StreamOptimizer.getRequiredHeaders(item.url);
                    return this.createChannel({
                        name: cleanName || item.name,
                        url: item.url,
                        logo: item.logo || '',
                        group: group,
                        groupTags: extraTags,
                        country: this.countryTag,
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
