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
 * Wraps a remote stream URL with the local CORS proxy prefix when running on localhost.
 * On non-localhost environments (Smart TVs, Electron, production), returns the URL unchanged.
 *
 * @param {string} url - The original remote stream URL.
 * @returns {string} The proxied URL if on localhost, otherwise the original URL.
 */
export function proxyUrl(url) {
    if (!url) return url;
    if (isLocalhost() && (url.startsWith('http://') || url.startsWith('https://'))) {
        return `/proxy?url=${encodeURIComponent(url)}`;
    }
    return url;
}
