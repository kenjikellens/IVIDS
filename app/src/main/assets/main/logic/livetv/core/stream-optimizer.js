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
     * Optimizes a live video stream URL by converting legacy MPEG-TS (.ts) endpoints
     * to modern HLS (.m3u8) streams for Xtream Codes and general IPTV providers.
     *
     * @param {string} url - Original stream URL.
     * @param {Object} [headers] - Optional associated HTTP headers.
     * @returns {string} Optimized stream URL.
     */
    static optimizeStreamUrl(url, headers = {}) {
        if (!url || typeof url !== 'string') return '';
        let trimmed = url.trim();

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
