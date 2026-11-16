/**
 * StremioDebridProvider
 * =====================
 * Queries Stremio-compatible HTTP addon endpoints (/stream/{type}/{id}.json),
 * injects Real-Debrid configuration on bare Torrentio/Comet URLs, and scores
 * streams by playability (browser-friendly containers first) and resolution.
 */
import { isLocalhost as isLocalhostEnv, proxyUrl } from '../../gui/js/utils/proxy.js';

export class StremioDebridProvider {
    /**
     * Initializes a Stremio addon stream provider.
     *
     * @param {Object} options - Provider options.
     * @param {string} options.id - Tier identifier ('debrid_primary'|'debrid_backup').
     * @param {string} options.name - Human-readable provider label.
     * @param {string} options.addonBaseUrl - Stremio addon base URL or manifest.json URL.
     * @param {RealDebridClient} options.rdClient - Shared Real-Debrid resolver client.
     */
    constructor({ id, name, addonBaseUrl, rdClient }) {
        this.id = id;
        this.name = name;
        this.addonBaseUrl = (addonBaseUrl || '').trim();
        this.rdClient = rdClient;
    }

    /**
     * Fetches candidate streams for a movie or TV episode from the configured Stremio addon.
     *
     * @param {Object} mediaMeta - Normalized media descriptor ({ imdbId, type, season, episode }).
     * @returns {Promise<Array<Object>>} Ranked stream descriptors.
     */
    async fetchStreams(mediaMeta) {
        if (!this.addonBaseUrl || !mediaMeta?.imdbId) return [];

        const stremioType = mediaMeta.type === 'tv' ? 'series' : 'movie';
        const streamId = stremioType === 'series'
            ? `${mediaMeta.imdbId}:${mediaMeta.season || 1}:${mediaMeta.episode || 1}`
            : mediaMeta.imdbId;

        let rawStreams = [];
        try {
            if (isLocalhostEnv()) {
                const apiUrl = `/api/debrid/streams?addonBase=${encodeURIComponent(this.addonBaseUrl)}&type=${encodeURIComponent(stremioType)}&id=${encodeURIComponent(streamId)}&token=${encodeURIComponent(this.rdClient?.userApiKey || '')}`;
                const res = await fetch(apiUrl);
                if (res.ok) {
                    const data = await res.json();
                    rawStreams = Array.isArray(data?.streams) ? data.streams : [];
                }
            } else {
                const directEndpoint = this._buildDirectEndpoint(stremioType, streamId);
                const res = await fetch(proxyUrl(directEndpoint));
                if (res.ok) {
                    const data = await res.json();
                    rawStreams = Array.isArray(data?.streams) ? data.streams : [];
                }
            }
        } catch (err) {
            console.warn(`[StremioDebridProvider:${this.id}] Failed to fetch streams:`, err);
            return [];
        }

        return this._rankAndNormalizeStreams(rawStreams);
    }

    /**
     * Builds the direct manifest/stream URL on non-localhost environments (Android WebView).
     *
     * @param {string} stremioType - 'movie' or 'series'.
     * @param {string} streamId - IMDb ID or series tuple.
     * @returns {string} Stremio stream JSON endpoint URL.
     */
    _buildDirectEndpoint(stremioType, streamId) {
        let base = this.addonBaseUrl.replace(/\/manifest\.json$/i, '').replace(/\/+$/, '');
        const token = this.rdClient?.userApiKey || '';
        try {
            const parsed = new URL(base);
            const pathOnly = parsed.pathname.replace(/^\/+|\/+$/g, '');
            if (token && !pathOnly) {
                if (parsed.hostname.includes('torrentio')) {
                    base = `${base}/${encodeURIComponent(`sort=qualitysize|realdebrid=${token}`)}`;
                } else if (parsed.hostname.includes('comet')) {
                    const b64 = btoa(JSON.stringify({ debridService: 'realdebrid', debridApiKey: token }));
                    base = `${base}/${b64}`;
                }
            }
        } catch {
            // Preserve user-supplied URL verbatim if non-standard
        }
        return `${base}/stream/${encodeURIComponent(stremioType)}/${encodeURIComponent(streamId)}.json`;
    }

    /**
     * Filters and scores returned Stremio streams so browser-playable MP4/HLS streams
     * and cached Debrid hits appear at the top.
     *
     * @param {Array<Object>} streams - Raw stream objects returned by the Stremio addon.
     * @returns {Array<Object>} Ranked normalized stream candidates.
     */
    _rankAndNormalizeStreams(streams) {
        this.lastError = '';
        const usable = [];
        for (let i = 0; i < streams.length; i++) {
            const s = streams[i];
            if (!s || (!s.url && !s.infoHash)) continue;
            const text = `${s.name || ''} ${s.title || ''} ${s.description || ''}`;
            if (/❌|no active subscription|invalid.*api|expired/i.test(text)) {
                if (!this.lastError) {
                    this.lastError = (s.description || s.title || s.name || '').replace(/\s+/g, ' ').trim();
                }
                continue;
            }
            const label = this._extractCompactLabel(s, text, i);
            const score = this._scoreStream(s, text);
            usable.push({
                providerId: this.id,
                providerName: this.name,
                url: s.url || '',
                infoHash: s.infoHash || '',
                fileIdx: typeof s.fileIdx === 'number' ? s.fileIdx : undefined,
                label,
                rawTitle: (s.title || s.description || s.name || '').trim(),
                score
            });
        }
        usable.sort((a, b) => b.score - a.score);
        return usable.slice(0, 12);
    }

    /**
     * Scores a stream for native browser/WebView compatibility and video quality.
     *
     * @param {Object} s - Raw Stremio stream object.
     * @param {string} text - Combined metadata string.
     * @returns {number} Computed suitability score.
     */
    _scoreStream(s, text) {
        let score = 0;
        const fullText = `${s.url || ''} ${text}`;
        if (s.url && /^https?:\/\//i.test(s.url)) score += 200;
        if (/\b(RD\+|TB\+|AD\+|PM\+|⚡)/i.test(text)) score += 140;
        if (/\bRD download\b/i.test(text)) score -= 120;
        if (/\.mp4\b|\.m3u8\b|webm/i.test(fullText)) score += 70;
        if (/\b(aac|mp3|opus|vorbis|stereo|2\.0)\b/i.test(fullText)) score += 75;
        if (/\b(h\.?264|x264|avc)\b/i.test(fullText)) score += 55;
        if (/1080p|fhd/i.test(text)) score += 50;
        else if (/720p|hd/i.test(text)) score += 35;
        else if (/2160p|4k|uhd/i.test(text)) score += 25;
        if (/dolbyd|ddp?\s*5\.1|e?-?ac-?3|\bdts\b|truehd|atmos/i.test(fullText)) score -= 65;
        if (/remux|dv\b|dolby\s*vision|hevc|x265|h\.265/i.test(fullText)) score -= 50;
        if (/\b(3d|hsbs|hou)\b/i.test(fullText)) score -= 90;
        return score;
    }

    /**
     * Extracts a short readable quality/source badge label for player UI lists.
     *
     * @param {Object} s - Stream object.
     * @param {string} text - Combined metadata text.
     * @param {number} index - Fallback index.
     * @returns {string} Short badge label.
     */
    _extractCompactLabel(s, text, index) {
        const resMatch = text.match(/\b(2160p|4K|1080p|720p|480p)\b/i);
        const res = resMatch ? resMatch[1].toUpperCase() : '';
        const namePart = (s.name || '').replace(/\s+/g, ' ').trim().slice(0, 26);
        if (namePart && res && !namePart.toUpperCase().includes(res)) {
            return `${namePart} ${res}`;
        }
        return namePart || `${this.name} #${index + 1}`;
    }
}
