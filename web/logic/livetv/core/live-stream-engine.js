/**
 * LiveStreamEngine
 * ================
 * Unified Object-Oriented HLS & Native Live Video Stream Engine for both the Live TV
 * 16:9 preview card and the fullscreen TV Player across PC Browser, Windows .exe, and Android .apk.
 *
 * Features:
 * 1. Multi-Stage Smart Connection Pipeline:
 *    - Stage 1: Optimal primary route (Proxy-first for plain HTTP / raw IP / custom-header streams
 *      to prevent browser CORS blocks; Direct-first for public HTTPS CDN streams).
 *    - Stage 2: Automatic seamless route flip (Direct <-> Local/Android Proxy) on CORS, 403/502,
 *      network error, or manifest watchdog timeout.
 *    - Stage 3: Automatic media error recovery (`recoverMediaError()`) and `fallbackUrls` chain.
 *    - Stage 4: Non-destructive offline state notification (never deletes channels).
 * 2. Strict HD/FHD Quality Lock:
 *    - Automatically selects and locks the highest resolution/bitrate level (1080p/720p)
 *      immediately upon `MANIFEST_PARSED` with `capLevelToPlayerSize: false`.
 * 3. Race-Condition Safe Lifecycle:
 *    - Uses a monotonically increasing `generationId` token so rapid channel scrolling
 *      cancels stale playback attempts cleanly.
 */

import { StreamOptimizer } from './stream-optimizer.js';

export class LiveStreamEngine {
    /**
     * Initializes a new LiveStreamEngine bound to a target HTMLVideoElement.
     *
     * @param {HTMLVideoElement} videoElement - Target video DOM element.
     * @param {Object} [callbacks] - Lifecycle event callbacks.
     * @param {Function} [callbacks.onLoading] - Invoked when stream connection starts (`(channel) => void`).
     * @param {Function} [callbacks.onPlaying] - Invoked when video frames start rendering (`(channel, qualityLabel) => void`).
     * @param {Function} [callbacks.onOffline] - Invoked only after all stages and fallback URLs fail (`(channel, errorInfo) => void`).
     * @param {boolean} [callbacks.isPreview=false] - Whether this engine drives the compact preview player.
     */
    constructor(videoElement, callbacks = {}) {
        this.video = videoElement;
        this.onLoading = typeof callbacks.onLoading === 'function' ? callbacks.onLoading : null;
        this.onPlaying = typeof callbacks.onPlaying === 'function' ? callbacks.onPlaying : null;
        this.onOffline = typeof callbacks.onOffline === 'function' ? callbacks.onOffline : null;
        this.isPreview = Boolean(callbacks.isPreview);

        this.hls = null;
        this.generationId = 0;
        this.watchdogTimer = null;
        this.activeChannel = null;
    }

    /**
     * Loads and plays a channel using the Multi-Stage Smart Connection Pipeline.
     * Automatically tries direct HLS and proxied HLS routes plus any fallback URLs before declaring offline.
     *
     * @param {Object|string} channelOrUrl - Channel instance/object or raw stream URL.
     * @param {Object} [customHeaders] - Optional custom HTTP headers.
     * @returns {Promise<boolean>} Resolves true if playback started, false if all stages failed.
     */
    async loadChannel(channelOrUrl, customHeaders = null) {
        const genId = ++this.generationId;
        this._cleanupCurrentAttempt();

        if (!this.video || !channelOrUrl) return false;

        const channel = typeof channelOrUrl === 'string'
            ? { url: channelOrUrl, name: 'Live Stream', headers: customHeaders || {}, fallbackUrls: [] }
            : channelOrUrl;

        this.activeChannel = channel;
        if (this.onLoading) {
            this.onLoading(channel);
        }

        const primaryUrl = StreamOptimizer.optimizeStreamUrl(channel.url || '');
        if (!primaryUrl) {
            if (this.onOffline) this.onOffline(channel, 'Missing stream URL');
            return false;
        }

        const candidateUrls = [primaryUrl];
        if (Array.isArray(channel.fallbackUrls)) {
            channel.fallbackUrls.forEach(fb => {
                const opt = StreamOptimizer.optimizeStreamUrl(fb);
                if (opt && !candidateUrls.includes(opt)) {
                    candidateUrls.push(opt);
                }
            });
        }

        for (let i = 0; i < candidateUrls.length; i++) {
            if (genId !== this.generationId) return false;
            const candidateUrl = candidateUrls[i];
            const headers = {
                ...(StreamOptimizer.getRequiredHeaders(candidateUrl) || {}),
                ...(channel.headers || {}),
                ...(customHeaders || {})
            };
            const routeOrder = this._buildRouteOrder(candidateUrl, headers);

            for (let r = 0; r < routeOrder.length; r++) {
                if (genId !== this.generationId) return false;
                const endpointUrl = routeOrder[r];
                const started = await this._attemptSingleEndpoint(endpointUrl, channel, genId);
                if (started) {
                    return true;
                }
            }
        }

        if (genId === this.generationId) {
            this._cleanupCurrentAttempt();
            if (this.onOffline) {
                this.onOffline(channel, 'All playback routes exhausted');
            }
        }
        return false;
    }

    /**
     * Determines the ordered list of stream URLs to attempt (Direct vs Local/Android Proxy).
     * - Plain HTTP streams or raw IP/Astra IPTV servers on localhost route exclusivamente via Proxy
     *   so Chrome never logs CORS policy blocks on raw IP servers.
     * - Streams requiring custom Referer/Origin/User-Agent try Proxy first, then Direct.
     * - Standard public HTTPS streams try Direct first, then fallback to Proxy on CORS/403.
     *
     * @param {string} rawUrl - Optimized stream URL.
     * @param {Object} headers - Associated HTTP headers.
     * @returns {Array<string>} Ordered list of endpoint URLs to attempt.
     */
    _buildRouteOrder(rawUrl, headers = {}) {
        if (!StreamOptimizer.canUseProxy()) {
            return [rawUrl];
        }

        const proxied = StreamOptimizer.getProxiedStreamUrl(rawUrl, headers);
        if (proxied === rawUrl) {
            return [rawUrl];
        }

        const isPlainHttpOrRawIp = /^http:\/\/|^https?:\/\/\d+\.\d+\.\d+\.\d+|:(?:8008|8080|8880|25461|1935)\/|\/play\/[a-z0-9]+/i.test(rawUrl);
        const hasCustomHeaders = Boolean(
            headers && (
                headers.Referer || headers.referer ||
                headers.Origin || headers.origin ||
                headers['User-Agent'] || headers['user-agent']
            )
        );

        if (StreamOptimizer.isLocalhost()) {
            // On localhost, proxy-first prevents browser CORS policy blocks from external origins
            return isPlainHttpOrRawIp ? [proxied] : [proxied, rawUrl];
        }

        if (hasCustomHeaders || isPlainHttpOrRawIp) {
            return [proxied, rawUrl];
        }

        return [rawUrl, proxied];
    }

    /**
     * Attempts playback of a single resolved endpoint URL with a watchdog timeout and automatic media error recovery.
     *
     * @param {string} endpointUrl - Direct or proxied URL to load.
     * @param {Object} channel - Channel metadata object.
     * @param {number} genId - Active generation token.
     * @returns {Promise<boolean>} True if video playback started successfully.
     */
    _attemptSingleEndpoint(endpointUrl, channel, genId) {
        return new Promise((resolve) => {
            if (genId !== this.generationId || !this.video) {
                resolve(false);
                return;
            }

            this._cleanupCurrentAttempt();

            let settled = false;
            let mediaRecoveryAttempted = false;
            const timeoutMs = this.isPreview ? 5000 : 7000;

            const finish = (success, qualityLabel = 'HD') => {
                if (settled) return;
                settled = true;
                this._clearWatchdog();

                if (genId !== this.generationId) {
                    resolve(false);
                    return;
                }

                if (success && this.onPlaying) {
                    this.onPlaying(channel, qualityLabel);
                }
                resolve(success);
            };

            this.watchdogTimer = setTimeout(() => {
                finish(false);
            }, timeoutMs);

            const video = this.video;

            if (window.Hls && window.Hls.isSupported()) {
                const hls = new window.Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: this.isPreview ? 10 : 30,
                    maxBufferLength: this.isPreview ? 5 : 14,
                    maxMaxBufferLength: this.isPreview ? 10 : 28,
                    liveSyncDurationCount: 2,
                    initialLiveManifestSize: 1,
                    manifestLoadingTimeOut: this.isPreview ? 3500 : 5500,
                    manifestLoadingMaxRetry: 0,
                    levelLoadingTimeOut: this.isPreview ? 3500 : 5500,
                    levelLoadingMaxRetry: 0,
                    fragLoadingTimeOut: 5500,
                    fragLoadingMaxRetry: 1,
                    startLevel: -1,
                    capLevelToPlayerSize: false
                });

                this.hls = hls;

                let detectedQuality = channel.quality || 'HD';

                const onVideoPlaying = () => {
                    video.removeEventListener('playing', onVideoPlaying);
                    finish(true, detectedQuality);
                };
                video.addEventListener('playing', onVideoPlaying);

                hls.on(window.Hls.Events.MANIFEST_PARSED, (event, data) => {
                    if (genId !== this.generationId) {
                        finish(false);
                        return;
                    }
                    detectedQuality = this._lockHighestHdLevel(hls, data?.levels, channel.quality);
                    video.play().catch((err) => {
                        if (err && err.name === 'AbortError') return;
                        finish(false);
                    });
                });

                hls.on(window.Hls.Events.ERROR, (event, data) => {
                    if (genId !== this.generationId) {
                        finish(false);
                        return;
                    }
                    if (!data.fatal) return;

                    if (data.type === window.Hls.ErrorTypes.MEDIA_ERROR && !mediaRecoveryAttempted) {
                        mediaRecoveryAttempted = true;
                        try {
                            hls.recoverMediaError();
                            return;
                        } catch (recErr) {
                            // Fall through to fail this stage
                        }
                    }

                    video.removeEventListener('playing', onVideoPlaying);
                    finish(false);
                });

                hls.loadSource(endpointUrl);
                hls.attachMedia(video);
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                const onPlaying = () => {
                    cleanupNativeListeners();
                    finish(true, channel.quality || 'HD');
                };
                const onError = () => {
                    cleanupNativeListeners();
                    finish(false);
                };
                const cleanupNativeListeners = () => {
                    video.removeEventListener('playing', onPlaying);
                    video.removeEventListener('error', onError);
                };

                video.addEventListener('playing', onPlaying);
                video.addEventListener('error', onError);
                video.src = endpointUrl;
                video.play().catch((err) => {
                    if (err && err.name === 'AbortError') return;
                    cleanupNativeListeners();
                    finish(false);
                });
            } else {
                finish(false);
            }
        });
    }

    /**
     * Selects the highest available HD/FHD resolution and bitrate level in HLS.js.
     *
     * @param {Object} hls - Active Hls.js instance.
     * @param {Array} levels - Parsed HLS quality levels.
     * @param {string} [fallbackLabel='HD'] - Default quality label if levels have no height metadata.
     * @returns {string} Resolved quality badge string ('4K UHD', 'FHD 1080p', 'HD 720p', 'LIVE HD').
     */
    _lockHighestHdLevel(hls, levels, fallbackLabel = 'HD') {
        if (!hls || !Array.isArray(levels) || levels.length === 0) {
            return fallbackLabel || 'HD';
        }

        let bestIdx = levels.length - 1;
        let bestScore = -1;
        let maxHeight = 0;

        levels.forEach((lvl, idx) => {
            const height = lvl.height || 0;
            const bitrate = lvl.bitrate || 0;
            const score = height * 1000000 + bitrate;
            if (score > bestScore) {
                bestScore = score;
                bestIdx = idx;
                maxHeight = height;
            }
        });

        if (levels.length > 1) {
            hls.currentLevel = bestIdx;
            hls.nextLevel = bestIdx;
        }

        if (maxHeight >= 2160) return '4K UHD';
        if (maxHeight >= 1080) return 'FHD 1080p';
        if (maxHeight >= 720) return 'HD 720p';
        return fallbackLabel || 'LIVE HD';
    }

    /**
     * Clears the startup watchdog timer.
     */
    _clearWatchdog() {
        if (this.watchdogTimer) {
            clearTimeout(this.watchdogTimer);
            this.watchdogTimer = null;
        }
    }

    /**
     * Cleans up the current HLS instance and resets the video element without incrementing generationId.
     */
    _cleanupCurrentAttempt() {
        this._clearWatchdog();
        if (this.hls) {
            try {
                this.hls.destroy();
            } catch (e) {
                // Ignore destroy errors
            }
            this.hls = null;
        }
        if (this.video) {
            try {
                this.video.pause();
                this.video.removeAttribute('src');
                this.video.load();
            } catch (e) {
                // Ignore media reset errors
            }
        }
    }

    /**
     * Stops playback immediately and invalidates any in-flight stream load attempts.
     */
    stop() {
        this.generationId++;
        this._cleanupCurrentAttempt();
        this.activeChannel = null;
    }

    /**
     * Destroys the engine and releases all media resources.
     */
    destroy() {
        this.stop();
        this.video = null;
    }
}
