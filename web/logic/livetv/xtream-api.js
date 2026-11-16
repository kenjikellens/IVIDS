/**
 * XtreamApi Class
 * ===============
 * Handles authentication, live stream fetching, category retrieval, short EPG lookup,
 * and HLS (.m3u8) / MPEG-TS (.ts) URL generation for Xtream Codes IPTV servers.
 */
import { proxyUrl } from '../../gui/js/utils/proxy.js';

export class XtreamApi {
    /**
     * Initializes an XtreamApi instance with server credentials.
     * 
     * @param {string} host - Xtream server URL (e.g. http://example.com:8080).
     * @param {string} username - IPTV account username.
     * @param {string} password - IPTV account password.
     */
    constructor(host = '', username = '', password = '') {
        this.host = (host || '').trim().replace(/\/+$/, '');
        this.username = (username || '').trim();
        this.password = (password || '').trim();
        this.userInfo = null;
        this.serverInfo = null;
    }

    /**
     * Validates if the credentials and host are configured.
     * @returns {boolean}
     */
    isValid() {
        return Boolean(this.host && this.username && this.password);
    }

    /**
     * Builds the base player API URL.
     * 
     * @param {string} action - Optional API action parameter.
     * @param {object} extraParams - Additional query parameters.
     * @returns {string} The formatted API endpoint URL.
     */
    buildApiUrl(action = '', extraParams = {}) {
        let url = `${this.host}/player_api.php?username=${encodeURIComponent(this.username)}&password=${encodeURIComponent(this.password)}`;
        if (action) {
            url += `&action=${encodeURIComponent(action)}`;
        }
        Object.entries(extraParams).forEach(([key, val]) => {
            if (val !== undefined && val !== null) {
                url += `&${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
            }
        });
        return url;
    }

    /**
     * Authenticates credentials with the Xtream server and caches account/server info.
     * 
     * @returns {Promise<boolean>} True if authentication succeeded.
     */
    async authenticate() {
        if (!this.isValid()) return false;
        try {
            const endpoint = proxyUrl(this.buildApiUrl());
            const response = await fetch(endpoint);
            if (!response.ok) return false;
            const data = await response.json();
            if (data && data.user_info && data.user_info.auth === 1) {
                this.userInfo = data.user_info;
                this.serverInfo = data.server_info;
                return true;
            }
            return false;
        } catch (error) {
            console.warn('[XtreamApi] Authentication failed:', error);
            return false;
        }
    }

    /**
     * Fetches all live stream categories/genres from the Xtream server.
     * 
     * @returns {Promise<Array>} List of category objects [{category_id, category_name}].
     */
    async getLiveCategories() {
        if (!this.isValid()) return [];
        try {
            const endpoint = proxyUrl(this.buildApiUrl('get_live_categories'));
            const response = await fetch(endpoint);
            if (!response.ok) return [];
            const categories = await response.json();
            return Array.isArray(categories) ? categories : [];
        } catch (error) {
            console.warn('[XtreamApi] Failed to fetch live categories:', error);
            return [];
        }
    }

    /**
     * Fetches live streams from the server, optionally filtered by category.
     * Maps raw stream objects to unified IVIDS Channel objects.
     * 
     * @param {string|number} categoryId - Optional category ID filter.
     * @returns {Promise<Array>} List of parsed channel objects.
     */
    async getLiveStreams(categoryId = null) {
        if (!this.isValid()) return [];
        try {
            const params = categoryId ? { category_id: categoryId } : {};
            const endpoint = proxyUrl(this.buildApiUrl('get_live_streams', params));
            const response = await fetch(endpoint);
            if (!response.ok) return [];
            const streams = await response.json();
            if (!Array.isArray(streams)) return [];

            return streams.map(s => this.formatChannel(s));
        } catch (error) {
            console.warn('[XtreamApi] Failed to fetch live streams:', error);
            return [];
        }
    }

    /**
     * Fetches short EPG data for a specific stream ID.
     * 
     * @param {string|number} streamId - Xtream stream_id.
     * @param {number} limit - Max program entries to retrieve.
     * @returns {Promise<Array>} List of EPG program listings.
     */
    async getShortEpg(streamId, limit = 4) {
        if (!this.isValid() || !streamId) return [];
        try {
            const endpoint = proxyUrl(this.buildApiUrl('get_short_epg', { stream_id: streamId, limit }));
            const response = await fetch(endpoint);
            if (!response.ok) return [];
            const data = await response.json();
            return data && Array.isArray(data.epg_listings) ? data.epg_listings : [];
        } catch (error) {
            console.warn(`[XtreamApi] Failed to fetch short EPG for stream ${streamId}:`, error);
            return [];
        }
    }

    /**
     * Generates a direct playback URL for an Xtream stream ID.
     * 
     * @param {string|number} streamId - Xtream stream_id.
     * @param {string} format - Output format ('m3u8' or 'ts').
     * @returns {string} The full playback stream URL.
     */
    getStreamUrl(streamId, format = 'm3u8') {
        if (!this.isValid() || !streamId) return '';
        const ext = format === 'ts' ? 'ts' : 'm3u8';
        return `${this.host}/live/${encodeURIComponent(this.username)}/${encodeURIComponent(this.password)}/${encodeURIComponent(streamId)}.${ext}`;
    }

    /**
     * Formats a raw Xtream JSON stream item into an IVIDS Channel object.
     * 
     * @param {object} stream - Raw stream descriptor from Xtream API.
     * @returns {object} Standardized channel item.
     */
    formatChannel(stream) {
        const primaryUrl = this.getStreamUrl(stream.stream_id, 'm3u8');
        const secondaryUrl = this.getStreamUrl(stream.stream_id, 'ts');

        return {
            id: `xtream_${stream.stream_id}`,
            streamId: stream.stream_id,
            name: stream.name || 'Xtream Channel',
            logo: stream.stream_icon || '',
            group: stream.category_name || stream.category_id || 'Xtream IPTV',
            tvgId: stream.epg_channel_id || '',
            url: primaryUrl,
            streamUrls: [primaryUrl, secondaryUrl],
            activeStreamIndex: 0,
            isXtream: true,
            media_type: 'live'
        };
    }
}
