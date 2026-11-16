/**
 * VodStreamResolver
 * =================
 * Orchestrates hybrid VOD playback resolution across configurable priority tiers:
 * Primary Debrid (Stremio + Real-Debrid), Backup Debrid, and the 7 Embed Servers.
 */
import { Api, DEFAULT_PLAYBACK_SOURCE_ORDER } from '../api.js';
import { RealDebridClient } from './real-debrid-client.js';
import { StremioDebridProvider } from './stremio-debrid-provider.js';

export class VodStreamResolver {
    /**
     * Constructs a VodStreamResolver bound to the active user player configuration.
     */
    constructor() {
        const config = Api.getPlayerConfig();
        this.config = config;
        this.rdClient = new RealDebridClient(config.debridConfig?.apiKey || '');
        this.primaryProvider = new StremioDebridProvider({
            id: 'debrid_primary',
            name: 'Debrid',
            addonBaseUrl: config.debridConfig?.primaryAddonUrl || '',
            rdClient: this.rdClient
        });
        this.backupProvider = new StremioDebridProvider({
            id: 'debrid_backup',
            name: 'Debrid Backup',
            addonBaseUrl: config.debridConfig?.backupAddonUrl || '',
            rdClient: this.rdClient
        });
    }

    /**
     * Resolves IMDb ID metadata for a TMDb movie or series item so Stremio addons can query streams.
     *
     * @param {Object} params - Player route params ({ id, type, season, episode, imdbId }).
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
     * Returns configured source priority tier IDs in active execution order.
     *
     * @returns {Array<string>} Ordered list of tier IDs.
     */
    getSourceOrder() {
        const order = this.config?.playbackSourceOrder;
        return Array.isArray(order) && order.length > 0 ? order : [...DEFAULT_PLAYBACK_SOURCE_ORDER];
    }

    /**
     * Resolves a specific tier ('debrid_primary', 'debrid_backup', or 'embed_servers') to playable targets.
     *
     * @param {string} tierId - Source tier identifier.
     * @param {Object} mediaMeta - Normalized media descriptor with IMDb/TMDb IDs.
     * @returns {Promise<Object|null>} Resolved native or embed tier result, or null if unavailable.
     */
    async resolveTier(tierId, mediaMeta) {
        if (tierId === 'embed_servers') {
            const servers = Api.SERVERS;
            if (!Array.isArray(servers) || servers.length === 0) return null;
            return {
                tierId: 'embed_servers',
                kind: 'embed',
                servers
            };
        }

        const provider = tierId === 'debrid_primary' ? this.primaryProvider : (tierId === 'debrid_backup' ? this.backupProvider : null);
        if (!provider || !mediaMeta?.imdbId) {
            this.lastError = 'Missing IMDb ID or Debrid provider config';
            return null;
        }
        if (!(await this.rdClient.hasCredentials())) {
            this.lastError = 'No Real-Debrid API key configured (restart run_pc.py if using .env)';
            return null;
        }

        const streams = await provider.fetchStreams(mediaMeta);
        if (!streams || streams.length === 0) {
            this.lastError = provider.lastError || `No playable Debrid streams returned by ${provider.name}`;
            return null;
        }

        for (let i = 0; i < Math.min(streams.length, 4); i++) {
            const candidate = streams[i];
            const directUrl = await this.rdClient.resolveStreamUrl(candidate);
            if (directUrl) {
                this.lastError = '';
                return {
                    tierId,
                    kind: 'native',
                    url: directUrl,
                    selectedStreamIndex: i,
                    streams
                };
            }
        }
        this.lastError = `Failed to resolve candidate URLs from ${provider.name}`;
        return null;
    }

    /**
     * Resolves a specific Stremio stream candidate to a playable direct URL.
     *
     * @param {Object} stream - Stremio stream candidate descriptor.
     * @returns {Promise<string|null>} Resolved URL or null.
     */
    async resolveCandidateUrl(stream) {
        return this.rdClient.resolveStreamUrl(stream);
    }

    /**
     * Evaluates all tiers according to the user's configured priority order until
     * a playable source is found, returning both the active source and pre-fetched fallback tiers.
     *
     * @param {Object} params - Route parameters from player.js.
     * @returns {Promise<Object>} Resolved initial playback plan.
     */
    async resolveInitialPlayback(params) {
        const mediaMeta = await this.resolveMediaMetadata(params);
        const order = this.getSourceOrder();

        for (const tierId of order) {
            const result = await this.resolveTier(tierId, mediaMeta);
            if (result) {
                return {
                    mediaMeta,
                    order,
                    active: result
                };
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
