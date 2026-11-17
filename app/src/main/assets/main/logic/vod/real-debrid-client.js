/**
 * RealDebridClient
 * ================
 * Handles Real-Debrid credential detection (Settings token or PC local .env backup)
 * and resolves direct links or cached torrent hashes into playable HTTPS media URLs.
 */
import { isLocalhost as isLocalhostEnv, proxyUrl } from '../../gui/js/utils/proxy.js';

export class RealDebridClient {
    /**
     * Initializes a RealDebridClient instance.
     *
     * @param {string} [userApiKey=''] - Optional user-supplied Real-Debrid API token from Settings.
     */
    constructor(userApiKey = '') {
        this.userApiKey = (userApiKey || '').trim();
        this._envStatusCache = null;
    }

    /**
     * Checks whether the local PC dev server exposes a .env Real-Debrid backup token
     * and whether the active credential has an active Real-Debrid Premium subscription.
     *
     * @returns {Promise<{envConfigured: boolean, hasPremium: boolean}>} Debrid credential status.
     */
    async getStatus() {
        if (this._envStatusCache !== null) return this._envStatusCache;
        if (isLocalhostEnv()) {
            try {
                const headers = this.userApiKey ? { 'X-RD-Token': this.userApiKey } : {};
                const res = await fetch('/api/debrid/status', { headers });
                if (res.ok) {
                    const data = await res.json();
                    this._envStatusCache = {
                        envConfigured: Boolean(data?.envConfigured),
                        hasPremium: Boolean(data?.hasPremium)
                    };
                    return this._envStatusCache;
                }
            } catch {
                // Fall through to unconfigured status
            }
            this._envStatusCache = { envConfigured: false, hasPremium: false };
            return this._envStatusCache;
        }

        if (!this.userApiKey) {
            this._envStatusCache = { envConfigured: false, hasPremium: false };
            return this._envStatusCache;
        }

        try {
            const res = await fetch('https://api.real-debrid.com/rest/1.0/user', {
                headers: { Authorization: `Bearer ${this.userApiKey}` }
            });
            if (res.ok) {
                const data = await res.json();
                const isPrem = Boolean(data?.type === 'premium' || Number(data?.premium || 0) > 0);
                this._envStatusCache = { envConfigured: false, hasPremium: isPrem };
                return this._envStatusCache;
            }
        } catch {
            // Network/API check failed cleanly
        }
        this._envStatusCache = { envConfigured: false, hasPremium: false };
        return this._envStatusCache;
    }

    /**
     * Checks whether the local PC dev server exposes a .env Real-Debrid backup token.
     *
     * @returns {Promise<boolean>} True if /api/debrid/status confirms a local backup token exists.
     */
    async isEnvBackupAvailable() {
        const status = await this.getStatus();
        return status.envConfigured;
    }

    /**
     * Checks whether the active Real-Debrid token belongs to a paid Premium account.
     *
     * @returns {Promise<boolean>} True when the token has active Premium days remaining.
     */
    async isPremiumActive() {
        const status = await this.getStatus();
        return status.hasPremium;
    }

    /**
     * Determines whether either a Settings API token or a local PC .env backup is available.
     *
     * @returns {Promise<boolean>} True when Debrid API requests can be authenticated.
     */
    async hasCredentials() {
        if (this.userApiKey) return true;
        return this.isEnvBackupAvailable();
    }

    /**
     * Resolves a Stremio stream entry (direct URL, hoster link, or cached infoHash)
     * into a browser/WebView playable stream URL.
     *
     * @param {Object} stream - Normalized Stremio stream descriptor.
     * @returns {Promise<string|null>} Direct or proxied HTTPS stream URL, or null on failure.
     */
    async resolveStreamUrl(stream) {
        if (!stream) return null;

        if (stream.url && /^https?:\/\//i.test(stream.url)) {
            return stream.url;
        }

        if (!stream.infoHash) return null;
        if (!(await this.hasCredentials())) return null;

        if (isLocalhostEnv()) {
            return this._resolveMagnetViaLocalServer(stream.infoHash, stream.fileIdx);
        }

        return this._resolveMagnetDirectly(stream.infoHash, stream.fileIdx);
    }

    /**
     * Delegates magnet resolution to the local Python bridge (using UI key or .env backup).
     *
     * @param {string} infoHash - Lowercase 40-char BitTorrent SHA1 infoHash.
     * @param {number|undefined} fileIdx - Preferred file index within torrent.
     * @returns {Promise<string|null>} Resolved direct stream URL or null.
     */
    async _resolveMagnetViaLocalServer(infoHash, fileIdx) {
        try {
            const res = await fetch('/api/debrid/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'magnet',
                    infoHash,
                    fileIdx,
                    token: this.userApiKey
                })
            });
            if (!res.ok) return null;
            const data = await res.json();
            return (data && data.status === 'success' && data.url) ? data.url : null;
        } catch (err) {
            console.warn('[RealDebridClient] Local bridge magnet resolution failed:', err);
            return null;
        }
    }

    /**
     * Resolves a cached torrent hash directly via api.real-debrid.com on Android WebView.
     *
     * @param {string} infoHash - Lowercase 40-char BitTorrent SHA1 infoHash.
     * @param {number|undefined} fileIdx - Preferred file index within torrent.
     * @returns {Promise<string|null>} Resolved direct HTTPS media URL or null.
     */
    async _resolveMagnetDirectly(infoHash, fileIdx) {
        if (!this.userApiKey) return null;
        const base = 'https://api.real-debrid.com/rest/1.0';
        const authHeaders = { Authorization: `Bearer ${this.userApiKey}` };

        try {
            const addBody = new URLSearchParams({ magnet: `magnet:?xt=urn:btih:${infoHash}` });
            const addRes = await fetch(`${base}/torrents/addMagnet`, { method: 'POST', headers: authHeaders, body: addBody });
            if (!addRes.ok) return null;
            const added = await addRes.json();
            if (!added?.id) return null;

            const infoRes = await fetch(`${base}/torrents/info/${added.id}`, { headers: authHeaders });
            if (!infoRes.ok) return null;
            const info = await infoRes.json();
            const files = Array.isArray(info?.files) ? info.files : [];

            let selectedId = null;
            if (typeof fileIdx === 'number' && fileIdx >= 0 && fileIdx < files.length) {
                selectedId = files[fileIdx].id;
            }
            if (!selectedId && files.length > 0) {
                const videoFiles = files.filter(f => /\.(mp4|mkv|webm|avi|mov|m4v)$/i.test(f.path || ''));
                const pool = videoFiles.length > 0 ? videoFiles : files;
                const largest = pool.reduce((best, cur) => ((cur.bytes || 0) > (best.bytes || 0) ? cur : best), pool[0]);
                selectedId = largest?.id;
            }
            if (!selectedId) return null;

            await fetch(`${base}/torrents/selectFiles/${added.id}`, {
                method: 'POST',
                headers: authHeaders,
                body: new URLSearchParams({ files: String(selectedId) })
            });

            const afterRes = await fetch(`${base}/torrents/info/${added.id}`, { headers: authHeaders });
            if (!afterRes.ok) return null;
            const afterInfo = await afterRes.json();
            const firstLink = Array.isArray(afterInfo?.links) ? afterInfo.links[0] : null;
            if (!firstLink) return null;

            const unrestrictRes = await fetch(`${base}/unrestrict/link`, {
                method: 'POST',
                headers: authHeaders,
                body: new URLSearchParams({ link: firstLink })
            });
            if (!unrestrictRes.ok) return null;
            const unrestricted = await unrestrictRes.json();
            return unrestricted?.download || null;
        } catch (err) {
            console.warn('[RealDebridClient] Direct API magnet resolution failed:', err);
            return null;
        }
    }
}
