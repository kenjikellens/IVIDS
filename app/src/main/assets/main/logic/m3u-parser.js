/**
 * Simple M3U Parser for IVIDS
 */

export const M3UParser = {
    /**
     * Creates a stable ASCII-safe identifier for any URL, including Unicode URLs.
     * @param {string} value
     * @returns {string}
     */
    createChannelId(value) {
        let hash = 0;
        const input = value || '';
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) - hash) + input.charCodeAt(i);
            hash |= 0;
        }
        return `live_${Math.abs(hash).toString(36)}`;
    },

    /**
     * Parses the raw contents of an M3U playlist file into a structured array of channel objects.
     * Does not modify any external state, returning a new array of parsed channel items.
     * 
     * @param {string} m3uString - Raw M3U playlist string content.
     * @returns {Array} List of parsed channel objects.
     */
    parse(m3uString) {
        if (!m3uString) return [];

        const lines = m3uString.split('\n');
        const channels = [];
        let currentChannel = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            if (line.startsWith('#EXTM3U')) {
                continue;
            }

            if (line.startsWith('#EXTINF:')) {
                currentChannel = {};

                // High-performance string index scanner for M3U tags
                const groupIdx = line.indexOf('group-title="');
                if (groupIdx !== -1) {
                    const start = groupIdx + 13;
                    const end = line.indexOf('"', start);
                    if (end !== -1) currentChannel.group = line.substring(start, end);
                }

                const tvgIdIdx = line.indexOf('tvg-id="');
                if (tvgIdIdx !== -1) {
                    const start = tvgIdIdx + 8;
                    const end = line.indexOf('"', start);
                    if (end !== -1) currentChannel.tvgId = line.substring(start, end);
                }

                const logoIdx = line.indexOf('tvg-logo="');
                if (logoIdx !== -1) {
                    const start = logoIdx + 10;
                    const end = line.indexOf('"', start);
                    if (end !== -1) currentChannel.logo = line.substring(start, end);
                }

                const commaIndex = line.lastIndexOf(',');
                const namePart = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : line.split(':').pop().trim();
                currentChannel.name = namePart || "Unknown Channel";
            } else if (line.startsWith('#')) {
                continue;
            } else {
                if (currentChannel) {
                    currentChannel.url = line;
                    currentChannel.id = this.createChannelId(line);
                    currentChannel.media_type = 'live';
                    channels.push(currentChannel);
                    currentChannel = null;
                }
            }
        }

        return channels;
    },

    /**
     * Fetches an M3U playlist from a remote URL with an abort timeout, then parses its content.
     * Returns an empty array if the request times out or encounters network/HTTP errors.
     * 
     * @param {string} url - Target playlist URL.
     * @returns {Promise<Array>} Parsed list of channels.
     */
    async fetchPlaylist(url) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error('Failed to fetch playlist');
            const content = await response.text();
            return this.parse(content);
        } catch (error) {
            console.error('Error fetching M3U playlist:', error, url);
            return [];
        }
    }
};
