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

        const channels = [];
        let currentChannel = null;

        let pos = 0;
        const len = m3uString.length;

        while (pos < len) {
            let nextLineEnd = m3uString.indexOf('\n', pos);
            let line;
            if (nextLineEnd === -1) {
                line = m3uString.substring(pos).trim();
                pos = len;
            } else {
                line = m3uString.substring(pos, nextLineEnd).trim();
                pos = nextLineEnd + 1;
            }

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
        const timeout = 4000;
        const retries = 2;
        let lastError;

        for (let i = 0; i <= retries; i++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            try {
                const response = await fetch(url, { signal: controller.signal });
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const content = await response.text();
                return this.parse(content);
            } catch (error) {
                clearTimeout(timeoutId);
                lastError = error;
                if (i < retries) {
                    // Wait slightly before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i)));
                }
            }
        }
        console.error('Error fetching M3U playlist after retries:', lastError, url);
        return [];
    }
};
