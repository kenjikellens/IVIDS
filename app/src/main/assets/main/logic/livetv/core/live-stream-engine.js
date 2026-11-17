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
        this.onTracksUpdated = typeof callbacks.onTracksUpdated === 'function' ? callbacks.onTracksUpdated : null;
        this.isPreview = Boolean(callbacks.isPreview);

        this.hls = null;
        this.generationId = 0;
        this.watchdogTimer = null;
        this.activeChannel = null;
    }

    /**
     * Extracts the upstream hostname from either a direct stream URL or a local `/proxy?url=...` path.
     * Used to identify dead DNS hosts across stream stages without mutating channel data.
     *
     * @param {string} targetUrl - Direct or proxied stream URL.
     * @returns {string} Lowercase hostname or empty string when unparseable.
     */
    static _extractUpstreamHost(targetUrl) {
        try {
            let candidate = String(targetUrl || '').trim();
            if (candidate.includes('/proxy?')) {
                const parsedProxy = new URL(candidate, 'http://localhost');
                candidate = parsedProxy.searchParams.get('url') || candidate;
            }
            return (new URL(candidate).hostname || '').toLowerCase();
        } catch {
            return '';
        }
    }

    /**
     * Loads and plays a channel using the Multi-Stage Smart Connection Pipeline.
     * Automatically skips already-known unreachable hosts during previews and stops redundant direct fallbacks after proxy 502/404 responses.
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

        const rawUrl = (channel.url || '').trim();
        const primaryUrl = StreamOptimizer.optimizeStreamUrl(rawUrl);
        if (!primaryUrl) {
            if (this.onOffline) this.onOffline(channel, 'Missing stream URL');
            return false;
        }

        const candidateUrls = [primaryUrl];
        if (rawUrl && rawUrl !== primaryUrl && !candidateUrls.includes(rawUrl)) {
            candidateUrls.push(rawUrl);
        }
        if (Array.isArray(channel.fallbackUrls)) {
            channel.fallbackUrls.forEach(fb => {
                const opt = StreamOptimizer.optimizeStreamUrl(fb);
                if (opt && !candidateUrls.includes(opt)) {
                    candidateUrls.push(opt);
                }
            });
        }

        const orderedCandidates = candidateUrls.filter(u => !LiveStreamEngine._deadHosts.has(LiveStreamEngine._extractUpstreamHost(u)));
        const effectiveCandidates = orderedCandidates.length > 0
            ? orderedCandidates
            : (this.isPreview ? [] : candidateUrls);

        for (let i = 0; i < effectiveCandidates.length; i++) {
            if (genId !== this.generationId) return false;
            const candidateUrl = effectiveCandidates[i];
            const headers = {
                ...(StreamOptimizer.getRequiredHeaders(candidateUrl) || {}),
                ...(channel.headers || {}),
                ...(customHeaders || {})
            };
            const routeOrder = this._buildRouteOrder(candidateUrl, headers);

            for (let r = 0; r < routeOrder.length; r++) {
                if (genId !== this.generationId) return false;
                const endpointUrl = routeOrder[r];
                const attempt = await this._attemptSingleEndpoint(endpointUrl, channel, genId);
                if (attempt.ok) {
                    return true;
                }
                if (attempt.skipDirectFallback) {
                    break;
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
     * Records dead upstream DNS hosts on 502 responses so subsequent direct-fallback attempts can be skipped cleanly.
     *
     * @param {string} endpointUrl - Direct or proxied URL to load.
     * @param {Object} channel - Channel metadata object.
     * @param {number} genId - Active generation token.
     * @returns {Promise<{ok: boolean, skipDirectFallback: boolean}>} Attempt status object.
     */
    _attemptSingleEndpoint(endpointUrl, channel, genId) {
        return new Promise((resolve) => {
            if (genId !== this.generationId || !this.video) {
                resolve({ ok: false, skipDirectFallback: false });
                return;
            }

            this._cleanupCurrentAttempt();

            let settled = false;
            let mediaRecoveryAttempted = false;
            const timeoutMs = this.isPreview ? 5000 : 7000;

            const finish = (success, qualityLabel = 'HD', skipDirectFallback = false) => {
                if (settled) return;
                settled = true;
                this._clearWatchdog();

                if (genId !== this.generationId) {
                    resolve({ ok: false, skipDirectFallback: true });
                    return;
                }

                if (success && this.onPlaying) {
                    this.onPlaying(channel, qualityLabel);
                }
                resolve({ ok: success, skipDirectFallback });
            };

            this.watchdogTimer = setTimeout(() => {
                finish(false);
            }, timeoutMs);

            const video = this.video;

            if (window.Hls && window.Hls.isSupported()) {
                const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent || '');
                const channelHeaders = {
                    ...(StreamOptimizer.getRequiredHeaders(endpointUrl) || {}),
                    ...(channel.headers || {})
                };
                const useElectronHeaderBridge = !StreamOptimizer.canUseProxy()
                    && Boolean(channelHeaders['User-Agent'] || channelHeaders['Referer'] || channelHeaders['Origin']);

                const hls = new window.Hls({
                    enableWorker: !this.isPreview,
                    lowLatencyMode: !this.isPreview,
                    backBufferLength: this.isPreview ? 2 : (isAndroid ? 8 : 30),
                    maxBufferLength: this.isPreview ? 3 : (isAndroid ? 10 : 14),
                    maxMaxBufferLength: this.isPreview ? 6 : (isAndroid ? 15 : 28),
                    liveSyncDurationCount: this.isPreview ? 1 : 2,
                    initialLiveManifestSize: 1,
                    manifestLoadingTimeOut: this.isPreview ? 3500 : 5500,
                    manifestLoadingMaxRetry: 0,
                    levelLoadingTimeOut: this.isPreview ? 3500 : 5500,
                    levelLoadingMaxRetry: 0,
                    fragLoadingTimeOut: 5500,
                    fragLoadingMaxRetry: 1,
                    startLevel: this.isPreview ? 0 : -1,
                    capLevelToPlayerSize: this.isPreview,
                    ...(useElectronHeaderBridge ? {
                        xhrSetup: (xhr) => {
                            if (channelHeaders['User-Agent']) xhr.setRequestHeader('X-IVIDS-User-Agent', channelHeaders['User-Agent']);
                            if (channelHeaders['Referer']) xhr.setRequestHeader('X-IVIDS-Referer', channelHeaders['Referer']);
                            if (channelHeaders['Origin']) xhr.setRequestHeader('X-IVIDS-Origin', channelHeaders['Origin']);
                        }
                    } : {})
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
                    detectedQuality = this.isPreview
                        ? (channel.quality || 'SD')
                        : this._lockHighestHdLevel(hls, data?.levels, channel.quality);
                    if (this.onTracksUpdated) this.onTracksUpdated(this.getStreamOptions());
                    video.play().catch((err) => {
                        if (err && err.name === 'AbortError') return;
                        finish(false);
                    });
                });

                hls.on(window.Hls.Events.AUDIO_TRACKS_UPDATED, () => {
                    if (genId === this.generationId && this.onTracksUpdated) {
                        this.onTracksUpdated(this.getStreamOptions());
                    }
                });

                hls.on(window.Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
                    if (genId === this.generationId && this.onTracksUpdated) {
                        this.onTracksUpdated(this.getStreamOptions());
                    }
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

                    // Fall back to native <video> for direct MP4/MP3/AAC/Shoutcast streams that fail HLS manifest parsing
                    if (window.Hls.ErrorDetails && data.details === window.Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                        video.removeEventListener('playing', onVideoPlaying);
                        try {
                            hls.stopLoad();
                            hls.detachMedia();
                            hls.destroy();
                        } catch (_) {}
                        if (this.hls === hls) this.hls = null;
                        this._startNativePlayback(video, endpointUrl, channel.quality || 'HD', genId, finish);
                        return;
                    }

                    const statusCode = data?.response?.code;
                    const isProxied = endpointUrl.includes('/proxy?');
                    const skipFallback = Boolean(isProxied && (statusCode === 502 || statusCode === 504 || statusCode === 404 || statusCode === 403));
                    if (isProxied && (statusCode === 502 || statusCode === 504)) {
                        const deadHost = LiveStreamEngine._extractUpstreamHost(endpointUrl);
                        if (deadHost) LiveStreamEngine._deadHosts.add(deadHost);
                    }

                    video.removeEventListener('playing', onVideoPlaying);
                    finish(false, 'HD', skipFallback);
                });

                hls.loadSource(endpointUrl);
                hls.attachMedia(video);
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                this._startNativePlayback(video, endpointUrl, channel.quality || 'HD', genId, finish);
            } else {
                finish(false);
            }
        });
    }

    /**
     * Attempts native HTMLVideoElement playback for Safari HLS or direct non-HLS media streams (MP4/MP3/AAC).
     *
     * @param {HTMLVideoElement} video - Target video DOM element.
     * @param {string} endpointUrl - Stream URL to load.
     * @param {string} qualityLabel - Quality badge label.
     * @param {number} genId - Active generation token.
     * @param {Function} finish - Completion callback `(success, qualityLabel) => void`.
     */
    _startNativePlayback(video, endpointUrl, qualityLabel, genId, finish) {
        if (genId !== this.generationId || !video) {
            finish(false);
            return;
        }

        const onPlaying = () => {
            cleanupNativeListeners();
            finish(true, qualityLabel);
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
                this.hls.stopLoad();
                this.hls.detachMedia();
                this.hls.destroy();
            } catch (e) {
                // Ignore destroy errors
            }
            this.hls = null;
        }
        if (this.video) {
            try {
                this.video.pause();
                if (this.video.hasAttribute('src') || this.video.src) {
                    this.video.removeAttribute('src');
                    this.video.load();
                }
            } catch (e) {
                // Ignore media reset errors
            }
        }
    }

    /**
     * Stops playback immediately when active and invalidates any in-flight stream load attempts.
     */
    stop() {
        if (!this.hls && !this.activeChannel && !this.watchdogTimer) {
            return;
        }
        this.generationId++;
        this._cleanupCurrentAttempt();
        this.activeChannel = null;
    }

    /**
     * Returns available quality levels, audio tracks, and subtitle tracks for the active stream.
     *
     * @returns {{qualities: Array, currentQuality: number, audioTracks: Array, currentAudioTrack: number, subtitleTracks: Array, currentSubtitleTrack: number}}
     */
    getStreamOptions() {
        const result = {
            qualities: [],
            currentQuality: -1,
            audioTracks: [],
            currentAudioTrack: -1,
            subtitleTracks: [],
            currentSubtitleTrack: -1
        };

        if (this.hls) {
            if (Array.isArray(this.hls.levels) && this.hls.levels.length > 1) {
                result.qualities = this.hls.levels.map((lvl, idx) => ({
                    index: idx,
                    label: lvl.height ? `${lvl.height}p` : `${Math.max(1, Math.round((lvl.bitrate || 0) / 1000))} kbps`
                }));
                result.currentQuality = this.hls.autoLevelEnabled ? -1 : this.hls.currentLevel;
            }
            if (Array.isArray(this.hls.audioTracks) && this.hls.audioTracks.length > 1) {
                result.audioTracks = this.hls.audioTracks.map((t, idx) => ({
                    index: idx,
                    label: t.name || '',
                    lang: t.lang || '',
                    fallbackKind: 'audio',
                    trackNumber: idx + 1
                }));
                result.currentAudioTrack = typeof this.hls.audioTrack === 'number' ? this.hls.audioTrack : 0;
            }
            if (Array.isArray(this.hls.subtitleTracks) && this.hls.subtitleTracks.length > 0) {
                result.subtitleTracks = this.hls.subtitleTracks.map((t, idx) => ({
                    index: idx,
                    label: t.name || '',
                    lang: t.lang || '',
                    fallbackKind: 'subtitle',
                    trackNumber: idx + 1
                }));
                result.currentSubtitleTrack = typeof this.hls.subtitleTrack === 'number' ? this.hls.subtitleTrack : -1;
            }
        } else if (this.video && this.video.textTracks && this.video.textTracks.length > 0) {
            const tracks = Array.from(this.video.textTracks);
            result.subtitleTracks = tracks.map((t, idx) => ({
                index: idx,
                label: t.label || '',
                lang: t.language || '',
                fallbackKind: 'subtitle',
                trackNumber: idx + 1
            }));
            result.currentSubtitleTrack = tracks.findIndex(t => t.mode === 'showing');
        }

        return result;
    }

    /**
     * Switches HLS video quality level (-1 restores automatic adaptive selection).
     *
     * @param {number} levelIndex - Target HLS level index or -1 for Auto.
     */
    setQualityLevel(levelIndex) {
        if (!this.hls) return;
        this.hls.currentLevel = levelIndex;
        this.hls.nextLevel = levelIndex;
    }

    /**
     * Switches the active HLS audio track by index.
     *
     * @param {number} trackIndex - Target audio track index.
     */
    setAudioTrack(trackIndex) {
        if (!this.hls || trackIndex < 0) return;
        this.hls.audioTrack = trackIndex;
    }

    /**
     * Switches the active subtitle track (-1 disables subtitles).
     *
     * @param {number} trackIndex - Target subtitle track index or -1 to disable.
     */
    setSubtitleTrack(trackIndex) {
        if (this.hls) {
            this.hls.subtitleTrack = trackIndex;
            this.hls.subtitleDisplay = trackIndex >= 0;
        }
        if (this.video && this.video.textTracks) {
            Array.from(this.video.textTracks).forEach((track, idx) => {
                track.mode = idx === trackIndex ? 'showing' : 'disabled';
            });
        }
    }

    /**
     * Destroys the engine and releases all media resources.
     */
    destroy() {
        this.stop();
        this.video = null;
    }
}

/** Session cache of upstream hostnames that returned 502/504 DNS or gateway failures. */
LiveStreamEngine._deadHosts = new Set();
