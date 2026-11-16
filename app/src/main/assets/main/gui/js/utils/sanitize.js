/**
 * Security sanitization utilities for escaping HTML output and validating media URLs.
 */

const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

const SAFE_RASTER_DATA_URI_RE = /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;
const SAFE_HTTP_URL_RE = /^https?:\/\/\S+$/i;
const SAFE_RELATIVE_IMAGE_RE = /^images\/[^\s"'<>\\]+$/i;
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/;

/**
 * Escapes HTML special characters (&, <, >, ", ') to prevent XSS when interpolating text into HTML templates.
 * Returns an empty string for null or undefined inputs without mutating external state.
 *
 * @param {*} value - Input value to escape.
 * @returns {string} HTML-escaped string.
 */
export function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

/**
 * Validates that a media or image URL uses an allowed safe protocol or local asset prefix.
 * Allows http(s)://, relative images/..., and raster base64 data URIs while rejecting javascript:, vbscript:, and SVG data URIs.
 *
 * @param {string} url - Candidate media URL to validate.
 * @returns {boolean} True if the URL is safe for rendering in media/image attributes.
 */
export function isSafeMediaUrl(url) {
    if (typeof url !== 'string') {
        return false;
    }
    const trimmed = url.trim();
    if (!trimmed || CONTROL_CHARS_RE.test(trimmed)) {
        return false;
    }

    const lower = trimmed.toLowerCase();
    if (
        lower.startsWith('javascript:') ||
        lower.startsWith('vbscript:') ||
        lower.startsWith('data:image/svg+xml')
    ) {
        return false;
    }

    if (SAFE_HTTP_URL_RE.test(trimmed)) {
        return true;
    }
    if (SAFE_RELATIVE_IMAGE_RE.test(trimmed) && !trimmed.includes('..')) {
        return true;
    }
    if (SAFE_RASTER_DATA_URI_RE.test(trimmed)) {
        return true;
    }
    return false;
}
