/**
 * HttpStreamProvider
 * ==================
 * Queries API-keyless direct HTTP Stremio addons (e.g. NoTorrent / custom HTTP addons)
 * and ranks direct playable `.mp4`/`.m3u8`/redirect URLs so the custom HTML5/Hls.js HUD
 * player can stream movies and series without requiring a Real-Debrid subscription.
 */
import { isLocalhost, proxyUrl } from '../../gui/js/utils/proxy.js';

export class HttpStreamProvider {
    /**
     * Initializes an API-keyless HTTP Stremio stream provider.
     *
     * @param {Object} options - Provider options.
     * @param {string} [options.id='direct_http'] - Tier identifier.
     * @param {string} [options.name='Direct HTTP'] - Display name.
     * @param {string} options.addonBaseUrl - Stremio HTTP addon base URL or manifest URL.
     */
    constructor({ id = 'direct_http', name = 'Direct HTTP', addonBaseUrl = '' }) {
        this.id = id;
        this.name = name;
        this.addonBaseUrl = (addonBaseUrl || '').trim();
        this.lastError = '';
    }

    /**
     * Fetches candidate direct HTTP streams for a movie or episode without any Debrid key.
     *
     * @param {Object} mediaMeta - Media metadata ({ imdbId, type, season, episode }).
     * @returns {Promise<Array<Object>>} Ranked stream descriptors.
     */
    async fetchStreams(mediaMeta) {
        this.lastError = '';
        if (!this.addonBaseUrl || !mediaMeta?.imdbId) {
            this.lastError = 'Missing HTTP addon URL or IMDb ID';
            return [];
        }

        const stremioType = mediaMeta.type === 'tv' ? 'series' : 'movie';
        const streamId = stremioType === 'series'
            ? `${mediaMeta.imdbId}:${mediaMeta.season || 1}:${mediaMeta.episode || 1}`
            : mediaMeta.imdbId;

        let rawStreams = [];
        try {
            if (isLocalhost()) {
                const apiUrl = `/api/debrid/streams?addonBase=${encodeURIComponent(this.addonBaseUrl)}&type=${encodeURIComponent(stremioType)}&id=${encodeURIComponent(streamId)}&noToken=1`;
                const res = await fetch(apiUrl);
                if (res.ok) {
                    const data = await res.json();
                    if (data?.error) this.lastError = data.error;
                    rawStreams = Array.isArray(data?.streams) ? data.streams : [];
                }
            } else {
                const cleanBase = this.addonBaseUrl.replace(/\/manifest\.json$/i, '').replace(/\/+$/, '');
                const endpoint = `${cleanBase}/stream/${encodeURIComponent(stremioType)}/${encodeURIComponent(streamId)}.json`;
                const res = await fetch(proxyUrl(endpoint));
                if (res.ok) {
                    const data = await res.json();
                    rawStreams = Array.isArray(data?.streams) ? data.streams : [];
                }
            }
        } catch (err) {
            this.lastError = err?.message || 'HTTP stream lookup failed';
            console.warn('[HttpStreamProvider] Failed to fetch HTTP streams:', err);
            return [];
        }

        return this._rankAndNormalizeStreams(rawStreams);
    }

    /**
     * Filters paywall/external links and prioritizes free, original-audio HTTP streams.
     * Wraps URLs with `proxyUrl()` on localhost/Android so cross-origin redirects & HLS load cleanly.
     *
     * @param {Array<Object>} streams - Raw Stremio stream entries.
     * @returns {Array<Object>} Sorted candidate list.
     */
    _rankAndNormalizeStreams(streams) {
        const usable = [];
        for (let i = 0; i < streams.length; i++) {
            const s = streams[i];
            if (!s || !s.url || !/^https?:\/\//i.test(s.url)) continue;
            if (s.externalUrl && !s.url) continue;

            const combined = `${s.name || ''} ${s.title || ''} ${s.description || ''}`;
            if (/🔒|paypal|premium streams available|free trial/i.test(combined)) continue;
            // Skip foreign-dubbed streams unless Original Audio / MultiLang / English / Dutch is present
            const hasOriginalOrMulti = /original audio|multilang|english|dutch|nederlands|🌐|🇬🇧|🇺🇸|🇳🇱/i.test(combined);
            const isForeignDub = /türkçe|turkish|audio latino|castellano|hindi|dublado|vf\b|vostfr|italiano|deutsch|polski|русск|🇹🇷|🇲🇽|🇪🇸|🇮🇳|🇧🇷/i.test(combined);
            if (isForeignDub && !hasOriginalOrMulti) continue;

            const score = this._scoreHttpStream(s, combined);
            const label = this._extractCompactLabel(s, combined, i);
            usable.push({
                providerId: this.id,
                providerName: this.name,
                url: proxyUrl(s.url),
                rawUrl: s.url,
                label,
                rawTitle: (s.title || s.description || s.name || '').trim(),
                score
            });
        }
        usable.sort((a, b) => b.score - a.score);
        if (usable.length === 0 && !this.lastError) {
            this.lastError = 'No free HTTP streams found for this title';
        }
        return usable.slice(0, 10);
    }

    /**
     * Scores free HTTP streams favoring non-trial Original Audio 1080p/720p web-playable links.
     *
     * @param {Object} s - Raw stream item.
     * @param {string} text - Combined metadata label.
     * @returns {number} Suitability score.
     */
    _scoreHttpStream(s, text) {
        let score = 0;
        if (/\[free\]/i.test(text)) score += 160;
        if (/original audio/i.test(text)) score += 120;
        if (/all players|vidplay|moviebox|direct stream/i.test(text)) score += 60;
        if (/1080p|fhd/i.test(text)) score += 45;
        else if (/720p|hd/i.test(text)) score += 35;
        if (/free trial/i.test(text)) score -= 80;
        if (/audio latino|castellano|hindi|turkish|dubbed/i.test(text) && !/original audio/i.test(text)) score -= 70;
        if (/\.mp4(\?|$)|\.m3u8(\?|$)/i.test(s.url)) score += 30;
        return score;
    }

    /**
     * Formats a compact label (`1080p · VidPlay` / `720p · Free`) for player menus.
     *
     * @param {Object} s - Stream object.
     * @param {string} text - Combined text.
     * @param {number} index - Candidate index.
     * @returns {string} Readable label.
     */
    _extractCompactLabel(s, text, index) {
        const resMatch = text.match(/\b(2160p|4K|1080p|720p|480p)\b/i);
        const res = resMatch ? resMatch[1].toUpperCase() : '';
        const cleanTitle = (s.title || '').replace(/\s+/g, ' ').replace(/\[FREE.*?\]/gi, '').trim().slice(0, 26);
        if (res && cleanTitle) return `${res} · ${cleanTitle}`;
        if (res) return `${res} · HTTP #${index + 1}`;
        return cleanTitle || `HTTP #${index + 1}`;
    }
}
