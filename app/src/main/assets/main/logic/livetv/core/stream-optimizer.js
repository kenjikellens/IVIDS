/**
 * Stream Optimizer Service
 * ========================
 * Provides URL normalization, Xtream Codes compatibility optimizations,
 * anti-403 anti-hotlinking header spoofing for protected sports/Canal+/IPTV CDNs,
 * and proxy query string encoding for both PC localhost and Android APK WebView.
 */

export class StreamOptimizer {
    /**
     * Determines whether the current client runtime is hosted on a local proxy server.
     *
     * @returns {boolean} True if running on localhost or 127.0.0.1.
     */
    static isLocalhost() {
        if (typeof window === 'undefined' || !window.location) return false;
        const host = window.location.hostname;
        return host === 'localhost' || host === '127.0.0.1';
    }

    /**
     * Determines whether the current client runtime is the Android APK WebView.
     *
     * @returns {boolean} True if running inside MainActivity WebView on Android.
     */
    static isAndroidWebView() {
        if (typeof window === 'undefined') return false;
        return Boolean(window.AndroidUpdate || window.AndroidSettings);
    }

    /**
     * Determines whether a local or native WebView stream proxy is available.
     *
     * @returns {boolean} True on localhost server or Android APK WebView.
     */
    static canUseProxy() {
        return StreamOptimizer.isLocalhost() || StreamOptimizer.isAndroidWebView();
    }

    /**
     * Optimizes a live video stream URL by intercepting known dead upstream M3U hosts
     * (e.g. expired iptvnetwork / rabah DNS) to active high-availability CDN streams,
     * and converting legacy MPEG-TS (.ts) endpoints to modern HLS (.m3u8).
     *
     * @param {string} url - Original stream URL.
     * @param {Object} [headers] - Optional associated HTTP headers.
     * @returns {string} Optimized stream URL.
     */
    static optimizeStreamUrl(url, headers = {}) {
        if (!url || typeof url !== 'string') return '';
        let trimmed = url.trim();

        // 1. Automatic override of dead / defunct public upstream M3U hosts to active high-availability CDN streams
        const DEAD_HOST_OVERRIDES = [
            // VTM 1 (Belgium) - lb.iptvnetwork.net dead DNS host
            { pattern: /lb\.iptvnetwork\.net\/ls28\/10033/i, target: 'http://4ce5e2d62ee2c10e43c709f9b87c44d5.streamhost.cc/m3u8/Belgium/5dee2de1f4661ce.m3u8' },
            // VTM 2 (Belgium)
            { pattern: /lb\.iptvnetwork\.net\/ls28\/10035/i, target: 'http://4ce5e2d62ee2c10e43c709f9b87c44d5.streamhost.cc/m3u8/Belgium/6cf956ee937bdf3.m3u8' },
            // VTM 3 (Belgium)
            { pattern: /lb\.iptvnetwork\.net\/ls28\/10037/i, target: 'http://4ce5e2d62ee2c10e43c709f9b87c44d5.streamhost.cc/m3u8/Belgium/633c70f0e0bc3c8.m3u8' },
            // VTM 4 (Belgium)
            { pattern: /lb\.iptvnetwork\.net\/ls28\/(?:10038|10015)/i, target: 'http://4ce5e2d62ee2c10e43c709f9b87c44d5.streamhost.cc/m3u8/Belgium/15869fe90278788.m3u8' },

            // Eén / VRT 1 (Belgium) - live-vrt.rabah.net dead DNS host -> Akamai VRT CDN endpoint
            { pattern: /live-vrt\.rabah\.net.*(?:8edf3bdf|groupc|live_aes)/i, target: 'https://live.vrtcdn.be/groupa/live/3c3a12b5-093d-4a19-ae1f-3e775433286e/live.isml/.m3u8' },
            { pattern: /live-vrt\.rabah\.net/i, target: 'https://live.vrtcdn.be/groupa/live/3c3a12b5-093d-4a19-ae1f-3e775433286e/live.isml/.m3u8' },

            // TF1 (France) - dead / geo-blocked upstream streambox
            { pattern: /tv\.streambox\.fr\/tf1/i, target: 'http://149.62.177.107:9999/TF1/index.m3u8' },

            // France 2 (France) - dead / geo-blocked upstream streambox
            { pattern: /tv\.streambox\.fr\/france_?2/i, target: 'http://149.62.177.107:9999/France_2/index.m3u8' },

            // Canal+ (France) - dead / geo-blocked upstream streambox
            { pattern: /tv\.streambox\.fr\/canal/i, target: 'http://92.114.85.87:8019/play/a003/index.m3u8' }
        ];

        for (let i = 0; i < DEAD_HOST_OVERRIDES.length; i++) {
            if (DEAD_HOST_OVERRIDES[i].pattern.test(trimmed)) {
                trimmed = DEAD_HOST_OVERRIDES[i].target;
                break;
            }
        }

        // Convert .ts extension to .m3u8 (e.g. Xtream /live/user/pass/12345.ts)
        if (/\.ts(\?|$|#)/i.test(trimmed)) {
            trimmed = trimmed.replace(/\.ts(\?|$|#)/i, '.m3u8$1');
        }

        return trimmed;
    }

    /**
     * Ensures Xtream Codes M3U playlist URLs request HLS (.m3u8) output format
     * by injecting or updating the 'output=m3u8' query parameter.
     *
     * @param {string} url - Target M3U playlist URL.
     * @returns {string} Optimized playlist URL.
     */
    static optimizePlaylistUrl(url) {
        if (!url || typeof url !== 'string') return '';
        let trimmed = url.trim();

        const isXtream = /get\.php|player_api\.php|type=m3u/i.test(trimmed);
        if (isXtream) {
            if (/([?&])output=[^&]*/i.test(trimmed)) {
                trimmed = trimmed.replace(/([?&])output=[^&]*/i, '$1output=m3u8');
            } else {
                const delimiter = trimmed.includes('?') ? '&' : '?';
                trimmed = `${trimmed}${delimiter}output=m3u8`;
            }
        }

        return trimmed;
    }

    /**
     * Resolves required anti-blocking spoof headers (Referer, Origin, User-Agent)
     * for known protected sports domains, Canal+ streams, and raw IP / Astra IPTV servers.
     *
     * @param {string} url - Target stream URL.
     * @returns {Object} Headers dictionary with Referer, Origin, and/or User-Agent.
     */
    static getRequiredHeaders(url) {
        if (!url || typeof url !== 'string') return {};
        const lower = url.toLowerCase();
        const headers = {};

        const defaultUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        const vlcUA = 'VLC/3.0.20 LibVLC/3.0.20';

        if (lower.includes('daddylive') || lower.includes('dlhd') || lower.includes('daddyhd')) {
            headers['Referer'] = 'https://daddylive.mp/';
            headers['Origin'] = 'https://daddylive.mp';
            headers['User-Agent'] = defaultUA;
        } else if (lower.includes('sportshub')) {
            headers['Referer'] = 'https://sportshub.stream/';
            headers['Origin'] = 'https://sportshub.stream';
            headers['User-Agent'] = defaultUA;
        } else if (lower.includes('1stream')) {
            headers['Referer'] = 'https://1stream.top/';
            headers['Origin'] = 'https://1stream.top';
            headers['User-Agent'] = defaultUA;
        } else if (lower.includes('canal') || lower.includes('mycanal')) {
            headers['Referer'] = 'https://www.canalplus.com/';
            headers['Origin'] = 'https://www.canalplus.com';
            headers['User-Agent'] = defaultUA;
        } else if (/^https?:\/\/\d+\.\d+\.\d+\.\d+|:(?:8008|8080|8880|25461|1935)\/|\/play\/[a-z0-9]+/i.test(lower)) {
            headers['User-Agent'] = vlcUA;
        }

        return headers;
    }

    /**
     * Converts a stream URL into a proxied URL with anti-blocking headers encoded
     * into query parameters when running in a localhost or Android APK WebView environment.
     *
     * @param {string} url - Raw or optimized stream URL.
     * @param {Object} [customHeaders] - Optional custom headers to merge.
     * @returns {string} Proxied stream URL or optimized direct URL.
     */
    static getProxiedStreamUrl(url, customHeaders = {}) {
        if (!url) return '';
        const optimized = StreamOptimizer.optimizeStreamUrl(url);

        if (!StreamOptimizer.canUseProxy() || (!optimized.startsWith('http://') && !optimized.startsWith('https://'))) {
            return optimized;
        }

        const requiredHeaders = StreamOptimizer.getRequiredHeaders(optimized);
        const mergedHeaders = { ...customHeaders, ...requiredHeaders };

        const basePrefix = StreamOptimizer.isAndroidWebView() && !StreamOptimizer.isLocalhost()
            ? 'http://localhost/proxy?url='
            : '/proxy?url=';

        let proxyPath = `${basePrefix}${encodeURIComponent(optimized)}`;

        const referer = mergedHeaders['Referer'] || mergedHeaders['referer'];
        if (referer) {
            proxyPath += `&referer=${encodeURIComponent(referer)}`;
        }

        const origin = mergedHeaders['Origin'] || mergedHeaders['origin'];
        if (origin) {
            proxyPath += `&origin=${encodeURIComponent(origin)}`;
        }

        const ua = mergedHeaders['User-Agent'] || mergedHeaders['user-agent'] || mergedHeaders['userAgent'];
        if (ua) {
            proxyPath += `&user-agent=${encodeURIComponent(ua)}`;
        }

        return proxyPath;
    }
}
