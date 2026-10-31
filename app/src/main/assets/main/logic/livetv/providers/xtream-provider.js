/**
 * XtreamProvider Strategy
 * =======================
 * Integrates Xtream Codes IPTV services, querying categories and live stream channels,
 * then standardizing output into unified Channel entity models.
 */

import { BaseStreamProvider } from './base-provider.js';
import { XtreamApi } from '../xtream-api.js';

export class XtreamProvider extends BaseStreamProvider {
    /**
     * Initializes the Xtream provider with server credentials.
     * 
     * @param {string} host - Xtream server URL.
     * @param {string} username - Account username.
     * @param {string} password - Account password.
     * @param {Object} [options] - Additional provider options.
     */
    constructor(host, username, password, options = {}) {
        super('xtream_custom', 'Xtream IPTV', {
            category: 'Xtream',
            priority: 5,
            ...options
        });
        this.api = new XtreamApi(host, username, password);
    }

    /**
     * Authenticates and loads all live streams from the Xtream server.
     * 
     * @returns {Promise<Array<Channel>>} Array of Channel instances.
     */
    async fetchChannels() {
        if (!this.api.isValid() || !this.enabled) return [];

        try {
            const authOk = await this.api.authenticate();
            if (!authOk) {
                console.warn('[XtreamProvider] Authentication failed for user:', this.api.username);
                return [];
            }

            const rawStreams = await this.api.getLiveStreams();
            return rawStreams.map(s => {
                const primaryUrl = this.api.getStreamUrl(s.stream_id, 'm3u8');
                const secondaryUrl = this.api.getStreamUrl(s.stream_id, 'ts');

                return this.createChannel({
                    id: `xtream_${s.stream_id}`,
                    name: s.name || 'Xtream Channel',
                    url: primaryUrl,
                    fallbackUrls: [secondaryUrl],
                    logo: s.stream_icon || '',
                    group: s.category_name || s.category_id || 'Xtream IPTV',
                    tvgId: s.epg_channel_id || ''
                });
            });
        } catch (error) {
            console.warn('[XtreamProvider] Error loading streams:', error.message);
            return [];
        }
    }
}

