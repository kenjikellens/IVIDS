/**
 * VodStreamResolver
 * =================
 * Orchestrates hybrid VOD playback resolution across three configurable priority tiers:
 * 1. Real-Debrid via Stremio (`debrid_primary`)
 * 2. Free API-keyless Direct HTTP Stremio addon (`direct_http`)
 * 3. The 7 original Embed Servers (`embed_servers`)
 */
import { Api, DEFAULT_PLAYBACK_SOURCE_ORDER } from '../api.js';
import { RealDebridClient } from './real-debrid-client.js';
import { StremioDebridProvider } from './stremio-debrid-provider.js';
import { HttpStreamProvider } from './http-stream-provider.js';

export class VodStreamResolver {
    /**
     * Constructs a VodStreamResolver bound to the active user player configuration.
     */
    constructor() {
        const config = Api.getPlayerConfig();
        this.config = config;
        this.lastError = '';
        this.rdClient = new RealDebridClient(config.debridConfig?.apiKey || '');
        this.primaryProvider = new StremioDebridProvider({
            id: 'debrid_primary',
            name: 'Real-Debrid',
            addonBaseUrl: config.debridConfig?.primaryAddonUrl || '',
            rdClient: this.rdClient
        });
        this.httpProvider = new HttpStreamProvider({
            id: 'direct_http',
            name: 'Direct HTTP',
            addonBaseUrl: config.debridConfig?.httpAddonUrl || ''
        });
    }

    /**
     * Resolves IMDb ID metadata for a TMDb movie or TV episode.
     *
     * @param {Object} params - Route parameters ({ id, type, season, episode, imdbId }).
     * @returns {Promise<Object>} Media descriptor with tmdbId, imdbId, type, season, episode.
     */
    async resolveMediaMetadata(params) {
        let imdbId = params.imdbId || '';
        if (!imdbId && params.id && (params.type === 'movie' || params.type === 'tv')) {
            try {
                const details = await Api.getDetails(params.id, params.type);
                imdbId = details?.imdb_id || details?.external_ids?.imdb_id || '';
            } catch {
                imdbId = '';
            }
        }
        return {
            tmdbId: params.id,
            imdbId,
            type: params.type,
            season: params.season || 1,
            episode: params.episode || 1
        };
    }

    /**
     * Returns configured source priority tier IDs in execution order.
     *
     * @returns {Array<string>} Ordered list of tier IDs.
     */
    getSourceOrder() {
        const order = this.config?.playbackSourceOrder;
        return Array.isArray(order) && order.length > 0 ? order : [...DEFAULT_PLAYBACK_SOURCE_ORDER];
    }

    /**
     * Resolves a specific tier (`debrid_primary`, `direct_http`, or `embed_servers`) to playable targets.
     *
     * @param {string} tierId - Source tier identifier.
     * @param {Object} mediaMeta - Media metadata with IMDb ID.
     * @returns {Promise<Object|null>} Resolved tier object, or null when unavailable.
     */
    async resolveTier(tierId, mediaMeta) {
        if (tierId === 'embed_servers') {
            const servers = Api.SERVERS;
            if (!Array.isArray(servers) || servers.length === 0) return null;
            return { tierId: 'embed_servers', kind: 'embed', servers };
        }

        if (tierId === 'direct_http') {
            if (!this.httpProvider.addonBaseUrl || !mediaMeta?.imdbId) {
                this.lastError = 'Missing HTTP addon URL or IMDb ID';
                return null;
            }
            const streams = await this.httpProvider.fetchStreams(mediaMeta);
            if (!streams || streams.length === 0) {
                this.lastError = this.httpProvider.lastError || 'No free HTTP streams found';
                return null;
            }
            this.lastError = '';
            return {
                tierId: 'direct_http',
                kind: 'native',
                url: streams[0].url,
                selectedStreamIndex: 0,
                streams
            };
        }

        if (tierId === 'debrid_primary') {
            if (!this.primaryProvider.addonBaseUrl || !mediaMeta?.imdbId) {
                this.lastError = 'Missing IMDb ID or Real-Debrid addon config';
                return null;
            }
            if (!(await this.rdClient.hasCredentials())) {
                this.lastError = 'No Real-Debrid API key configured';
                return null;
            }
            if (!(await this.rdClient.isPremiumActive())) {
                this.lastError = 'Real-Debrid: No active Premium subscription (free account)';
                return null;
            }

            const streams = await this.primaryProvider.fetchStreams(mediaMeta);
            if (!streams || streams.length === 0) {
                this.lastError = this.primaryProvider.lastError || 'No playable Real-Debrid streams found';
                return null;
            }

            for (let i = 0; i < Math.min(streams.length, 4); i++) {
                const directUrl = await this.rdClient.resolveStreamUrl(streams[i]);
                if (directUrl) {
                    this.lastError = '';
                    return {
                        tierId: 'debrid_primary',
                        kind: 'native',
                        url: directUrl,
                        selectedStreamIndex: i,
                        streams
                    };
                }
            }
            this.lastError = 'Failed to resolve candidate URLs from Real-Debrid';
            return null;
        }

        return null;
    }

    /**
     * Resolves an individual stream candidate URL depending on its tier type.
     *
     * @param {Object} stream - Candidate stream descriptor.
     * @param {string} [tierId] - Tier identifier ('debrid_primary' | 'direct_http').
     * @returns {Promise<string|null>} Resolved stream URL or null.
     */
    async resolveCandidateUrl(stream, tierId = '') {
        if (!stream) return null;
        if (tierId === 'direct_http' || stream.providerId === 'direct_http') {
            return stream.url || null;
        }
        return this.rdClient.resolveStreamUrl(stream);
    }

    /**
     * Evaluates all tiers in user-configured priority order until a playable source succeeds.
     *
     * @param {Object} params - Route parameters from player.js.
     * @returns {Promise<Object>} Resolved playback plan.
     */
    async resolveInitialPlayback(params) {
        const mediaMeta = await this.resolveMediaMetadata(params);
        const order = this.getSourceOrder();

        for (const tierId of order) {
            const result = await this.resolveTier(tierId, mediaMeta);
            if (result) {
                return { mediaMeta, order, active: result };
            }
        }

        return {
            mediaMeta,
            order,
            active: {
                tierId: 'embed_servers',
                kind: 'embed',
                servers: Api.SERVERS
            }
        };
    }
}
