/**
 * Determines whether the app is running on a local development server (localhost).
 * Returns true when the origin is http://localhost, indicating the CORS proxy is available.
 *
 * @returns {boolean} True if the app is served from localhost.
 */
export function isLocalhost() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/**
 * Wraps a remote stream URL with the local CORS proxy prefix when running on localhost or Android WebView.
 * Uses same-origin `/proxy` on localhost and Android `appassets.androidplatform.net`, falling back to `http://localhost/proxy` on file://.
 *
 * @param {string} url - The original remote stream URL.
 * @returns {string} The proxied URL if on localhost or Android WebView, otherwise the original URL.
 */
export function proxyUrl(url) {
    if (!url || typeof url !== 'string') return url;
    if (url.startsWith('/proxy?url=') || url.startsWith('http://localhost/proxy') || url.startsWith('http://127.0.0.1/proxy')) {
        return url;
    }
    if (url.startsWith('http://') || url.startsWith('https://')) {
        if (isLocalhost() || (typeof window !== 'undefined' && window.location.hostname === 'appassets.androidplatform.net')) {
            return `/proxy?url=${encodeURIComponent(url)}`;
        }
        if (typeof window !== 'undefined' && (window.AndroidUpdate || window.AndroidSettings)) {
            return window.location && window.location.protocol && window.location.protocol.startsWith('http')
                ? `/proxy?url=${encodeURIComponent(url)}`
                : `http://localhost/proxy?url=${encodeURIComponent(url)}`;
        }
    }
    return url;
}
