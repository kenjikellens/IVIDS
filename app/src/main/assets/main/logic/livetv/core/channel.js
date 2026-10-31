/**
 * Channel Domain Entity Model
 * ===========================
 * Encapsulates Live TV channel metadata, stream endpoints, fallback chains,
 * strict country/genre classification, custom headers, and scoring methods.
 */

const EXACT_COUNTRY_LOOKUP = new Map([
    ['netherlands', 'netherlands'],
    ['the netherlands', 'netherlands'],
    ['nederland', 'netherlands'],
    ['dutch', 'netherlands'],
    ['holland', 'netherlands'],
    ['belgium', 'belgium'],
    ['belgie', 'belgium'],
    ['belgië', 'belgium'],
    ['belgique', 'belgium'],
    ['belgian', 'belgium'],
    ['france', 'france'],
    ['french', 'france'],
    ['spain', 'spain'],
    ['españa', 'spain'],
    ['espana', 'spain'],
    ['spanish', 'spain'],
    ['germany', 'germany'],
    ['deutschland', 'germany'],
    ['german', 'germany'],
    ['portugal', 'portugal'],
    ['portuguese', 'portugal'],
    ['italy', 'italy'],
    ['italia', 'italy'],
    ['italian', 'italy'],
    ['united kingdom', 'united kingdom'],
    ['uk', 'united kingdom'],
    ['great britain', 'united kingdom'],
    ['britain', 'united kingdom'],
    ['england', 'united kingdom'],
    ['united states', 'united states'],
    ['usa', 'united states'],
    ['us', 'united states'],
    ['america', 'united states']
]);

export class Channel {
    /**
     * Initializes a new Channel instance with strict country and genre classification.
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
        this.country = Channel.resolveExactCountry(data.country, this.group, this.groupTags, this.name, this.tvgId);
        this.isSports = Boolean(
            data.isSports ||
            Channel.detectSports(this.name, this.group, this.groupTags)
        );
        this.isLiveMatch = Boolean(data.isLiveMatch);
        this.media_type = 'live';
    }

    /**
     * Resolves an exact canonical country key ('netherlands', 'belgium', 'france', 'spain',
     * 'germany', 'portugal', 'italy', 'united kingdom', 'united states', or '') without
     * ever performing substring matching (so 'Belarus' / 'Беларусь 1' can NEVER match 'Belgium').
     *
     * @param {string} [providerCountry] - Explicit country tag from the provider.
     * @param {string} [groupTitle] - Raw M3U group-title string.
     * @param {Array<string>} [groupTags] - Parsed lowercase group tags.
     * @param {string} [channelName] - Cleaned channel name.
     * @param {string} [tvgId] - Optional XMLTV ID (e.g. 'Canvas.be', 'NPO1.nl').
     * @returns {string} Canonical country key or empty string.
     */
    static resolveExactCountry(providerCountry = '', groupTitle = '', groupTags = [], channelName = '', tvgId = '') {
        // Guard against Cyrillic channels (e.g. 'Беларусь 1') ever being classified into Western European countries
        if (/[А-Яа-яЁё]/.test(channelName)) {
            return '';
        }

        const cleanProvider = (providerCountry || '').trim().toLowerCase();
        if (cleanProvider && cleanProvider !== 'global' && EXACT_COUNTRY_LOOKUP.has(cleanProvider)) {
            return EXACT_COUNTRY_LOOKUP.get(cleanProvider);
        }

        // Check exact group segments (split by ; or |)
        if (groupTitle) {
            const segments = groupTitle.split(/[;|]/).map(s => s.trim().toLowerCase()).filter(Boolean);
            for (let i = 0; i < segments.length; i++) {
                if (EXACT_COUNTRY_LOOKUP.has(segments[i])) {
                    return EXACT_COUNTRY_LOOKUP.get(segments[i]);
                }
            }
        }

        // Check exact groupTags
        if (Array.isArray(groupTags)) {
            for (let i = 0; i < groupTags.length; i++) {
                const tag = (groupTags[i] || '').trim().toLowerCase();
                if (tag !== 'global' && EXACT_COUNTRY_LOOKUP.has(tag)) {
                    return EXACT_COUNTRY_LOOKUP.get(tag);
                }
            }
        }

        // Check exact TLD suffix in tvg-id (e.g. 'VTM.be' -> '.be', 'NPO1.nl' -> '.nl', while 'Belarus1.by' -> '.by')
        if (tvgId) {
            const baseId = tvgId.split('@')[0].toLowerCase();
            const dotIdx = baseId.lastIndexOf('.');
            if (dotIdx !== -1) {
                const tld = baseId.slice(dotIdx + 1);
                const tldMap = {
                    nl: 'netherlands',
                    be: 'belgium',
                    fr: 'france',
                    es: 'spain',
                    de: 'germany',
                    pt: 'portugal',
                    it: 'italy',
                    uk: 'united kingdom',
                    gb: 'united kingdom',
                    us: 'united states'
                };
                if (tldMap[tld]) {
                    return tldMap[tld];
                }
            }
        }

        return '';
    }

    /**
     * Detects whether a channel is a live sports broadcast.
     *
     * @param {string} name - Channel name.
     * @param {string} group - Channel group string.
     * @param {Array<string>} groupTags - Parsed group tags.
     * @returns {boolean} True if sports channel.
     */
    static detectSports(name = '', group = '', groupTags = []) {
        const tags = Array.isArray(groupTags) ? groupTags.join(' ') : '';
        const combined = `${tags} ${group} ${name}`.toLowerCase();
        return /sport|voetbal|football|soccer|canal\+\s*(foot|sport|live)|bein|ziggo|dazn|eurosport|espn|sky\s*sport|tnt\s*sport|arena\s*sport|premier\s*league|fighting|motor|golf|tennis|nba|nfl|ufc|f1/i.test(combined);
    }

    /**
     * Extracts stream resolution quality label ('4K', 'FHD', 'HD', 'SD') from channel name or URL.
     *
     * @param {string} name - Raw channel name.
     * @param {string} [url] - Stream URL.
     * @returns {string} Quality tag ('4K', 'FHD', 'HD', 'SD').
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
     * [Not 24/7], (1080p), (720p), etc.
     *
     * @param {string} rawName - Raw channel name from M3U playlist.
     * @returns {string} Clean display name.
     */
    static cleanChannelName(rawName = '') {
        if (!rawName) return 'Unknown Channel';
        return rawName
            .replace(/\[(?:geo-?blocked|not\s*24\/7|2160p|1080p|1080i|720p|576p|480p|360p|240p|\d+fps|sd|hd|fhd|uhd|4k|hevc|h\.?264|ipv6)[^\]]*\]/gi, '')
            .replace(/\((?:geo-?blocked|not\s*24\/7|2160p|1080p|1080i|720p|576p|480p|360p|240p|\d+fps|sd|hd|fhd|uhd|4k|hevc|h\.?264|ipv6)[^\)]*\)/gi, '')
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
            group.split(/[;|]/)
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
     * Prioritizes HTTPS HLS (.m3u8) HD/FHD/4K streams over raw HTTP or SD streams.
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
            if (!this.searchNameLower.includes(query.toLowerCase())) return false;
        }
        if (genre) {
            const genreLower = genre.toLowerCase();
            if (!this.groupTags.includes(genreLower)) return false;
        }
        if (country) {
            const countryLower = country.toLowerCase();
            if (this.country !== countryLower) return false;
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
            name: this.rawName || this.name,
            url: this.url,
            fallbackUrls: [...this.fallbackUrls],
            logo: this.logo,
            group: this.group,
            groupTags: [...this.groupTags],
            country: this.country,
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
