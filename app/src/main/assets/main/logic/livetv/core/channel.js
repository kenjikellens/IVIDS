/**
 * Channel Domain Entity Model
 * ===========================
 * Encapsulates Live TV channel metadata, stream endpoints, fallback chains,
 * custom headers (for protected streams), and scoring methods.
 */

export class Channel {
    /**
     * Initializes a new Channel instance.
     * 
     * @param {Object} data - Raw channel attributes.
     */
    constructor(data = {}) {
        this.id = data.id || Channel.createChannelId(data.url || data.name || Math.random().toString());
        this.rawName = (data.name || 'Unknown Channel').trim();
        this.quality = Channel.extractQuality(this.rawName, data.url);
        this.name = Channel.cleanChannelName(this.rawName);
        this.searchNameLower = this.name.toLowerCase();
        this.url = (data.url || '').trim();
        this.normalizedUrl = Channel.normalizeUrl(this.url);
        this.fallbackUrls = Array.isArray(data.fallbackUrls) ? data.fallbackUrls.filter(Boolean) : [];
        this.logo = data.logo || '';
        this.group = (data.group || 'General').trim();
        this.groupTags = this._buildGroupTags(this.group, data.groupTags);
        this.tvgId = (data.tvgId || '').trim();
        this.sourceName = data.sourceName || 'IPTV';
        this.sourcePriority = typeof data.sourcePriority === 'number' ? data.sourcePriority : 50;
        this.headers = data.headers || {};
        this.isSports = Boolean(data.isSports || this.groupTags.includes('sports') || this.groupTags.includes('football') || this.groupTags.includes('voetbal'));
        this.isLiveMatch = Boolean(data.isLiveMatch);
        this.media_type = 'live';
    }

    /**
     * Extracts stream resolution quality label ('4K', 'FHD', 'HD', 'SD') from channel name or URL.
     *
     * @param {string} name - Raw channel name.
     * @param {string} [url] - Stream URL.
     * @returns {string} Quality tag ('4K', 'FHD', 'HD', 'SD', or '').
     */
    static extractQuality(name = '', url = '') {
        const combined = `${name} ${url}`.toLowerCase();
        if (/2160p|4k|uhd/.test(combined)) return '4K';
        if (/1080p|1080i|fhd/.test(combined)) return 'FHD';
        if (/720p|\bhd\b/.test(combined)) return 'HD';
        if (/576p|480p|360p|240p|\bsd\b/.test(combined)) return 'SD';
        return 'HD';
    }

    /**
     * Cleans raw M3U channel names by removing bracketed technical tags like [Geo-blocked],
     * [Not 24/7], (1080p), (720p), and expanding obscure ISO country codes like (SK) -> (SK).
     *
     * @param {string} rawName - Raw channel name from M3U playlist.
     * @returns {string} Clean display name.
     */
    static cleanChannelName(rawName = '') {
        if (!rawName) return 'Unknown Channel';
        return rawName
            .replace(/\[(?:geo-?blocked|not\s*24\/7|720p|1080p|576p|480p|360p|sd|hd|fhd|uhd|4k|hevc|h\.?264|ipv6)[^\]]*\]/gi, '')
            .replace(/\((?:1080p|1080i|720p|576p|480p|360p|240p|2160p|4k|uhd|fhd|hd|sd|not\s*24\/7|geo-?blocked)\)/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim() || rawName.trim();
    }

    /**
     * Generates a stable ASCII-safe hash identifier for any stream URL.
     * 
     * @param {string} value - URL or identifier source string.
     * @returns {string} Standardized live stream ID.
     */
    static createChannelId(value) {
        let hash = 0;
        const input = value || '';
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) - hash) + input.charCodeAt(i);
            hash |= 0;
        }
        return `live_${Math.abs(hash).toString(36)}`;
    }

    /**
     * Normalizes a URL by stripping schemes, trailing slashes, and whitespace.
     * 
     * @param {string} url - Target URL.
     * @returns {string} Normalized string for deduplication.
     */
    static normalizeUrl(url) {
        if (!url) return '';
        return url.trim()
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/\/+$/, '');
    }

    /**
     * Splits and parses group strings into an array of lowercase tag keywords.
     * 
     * @param {string} group - Group title or categories.
     * @param {Array<string>} [extraTags] - Optional additional tags.
     * @returns {Array<string>} Array of lowercase search tags.
     */
    _buildGroupTags(group, extraTags = []) {
        const set = new Set();
        if (group) {
            group.split(';')
                .map(t => t.trim().toLowerCase())
                .filter(Boolean)
                .forEach(t => set.add(t));
        }
        if (Array.isArray(extraTags)) {
            extraTags
                .map(t => (t || '').trim().toLowerCase())
                .filter(Boolean)
                .forEach(t => set.add(t));
        }
        return Array.from(set);
    }

    /**
     * Calculates a stream viability and quality score.
     * Prioritizes HTTPS HLS (.m3u8) streams over raw HTTP or MPEG-TS.
     * 
     * @returns {number} Quality score.
     */
    getStreamScore() {
        const u = this.url.toLowerCase();
        const rawLower = (this.rawName || this.name || '').toLowerCase();
        let score = 0;
        if (u.includes('.m3u8')) score += 100;
        else if (u.includes('.mpd')) score += 80;
        else if (u.includes('.ts')) score += 20;

        if (u.startsWith('https://')) score += 20;
        if (this.quality === '4K' || this.quality === 'FHD') score += 45;
        else if (this.quality === 'HD') score += 30;
        else if (this.quality === 'SD') score -= 25;

        if (/geo-?blocked|not\s*24\/7/.test(rawLower)) score -= 60;
        if (this.isSports) score += 15;
        return score;
    }

    /**
     * Evaluates if this channel matches active search query and filter criteria.
     * 
     * @param {string} query - Lowercase search term.
     * @param {string} genre - Active genre filter.
     * @param {string} country - Active country filter.
     * @returns {boolean} True if matching.
     */
    matchesFilter(query = '', genre = '', country = '') {
        if (query) {
            const nameLower = this.name.toLowerCase();
            if (!nameLower.includes(query.toLowerCase())) return false;
        }
        if (genre) {
            const genreLower = genre.toLowerCase();
            if (!this.groupTags.includes(genreLower)) return false;
        }
        if (country) {
            const countryLower = country.toLowerCase();
            if (!this.groupTags.includes(countryLower)) return false;
        }
        return true;
    }

    /**
     * Clones the channel instance with optional overrides.
     * 
     * @param {Object} overrides - Attributes to modify.
     * @returns {Channel} New Channel instance.
     */
    clone(overrides = {}) {
        return new Channel({
            id: this.id,
            name: this.name,
            url: this.url,
            fallbackUrls: [...this.fallbackUrls],
            logo: this.logo,
            group: this.group,
            groupTags: [...this.groupTags],
            tvgId: this.tvgId,
            sourceName: this.sourceName,
            sourcePriority: this.sourcePriority,
            headers: { ...this.headers },
            isSports: this.isSports,
            isLiveMatch: this.isLiveMatch,
            ...overrides
        });
    }
}
