/**
 * Simple M3U Parser for IVIDS
 */

export const M3UParser = {
    /**
     * Parse an M3U string into an array of channel objects
     * @param {string} m3uString 
     * @returns {Array} channels
     */
    parse(m3uString) {
        if (!m3uString) return [];

        const lines = m3uString.split('\n');
        const channels = [];
        let currentChannel = null;

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            if (line.startsWith('#EXTM3U')) {
                continue;
            }

            if (line.startsWith('#EXTINF:')) {
                // Parse EXTINF line
                // Format: #EXTINF:-1 tvg-id="" tvg-name="" tvg-logo="" group-title="",Channel Name
                currentChannel = {};

                // Extract group-title
                const groupMatch = line.match(/group-title="([^"]*)"/);
                if (groupMatch) currentChannel.group = groupMatch[1];

                // Extract tvg-logo
                const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                if (logoMatch) currentChannel.logo = logoMatch[1];

                // Extract name (after the last comma)
                const commaIndex = line.lastIndexOf(',');
                const namePart = commaIndex !== -1 ? line.substring(commaIndex + 1).trim() : line.split(':').pop().trim();
                currentChannel.name = namePart || "Unknown Channel";
            } else if (line.startsWith('#')) {
                // Other tags we might ignore for now
                continue;
            } else {
                // This is the URL
                if (currentChannel) {
                    currentChannel.url = line;
                    currentChannel.id = 'live_' + btoa(line).substring(0, 16);
                    currentChannel.media_type = 'live';
                    channels.push(currentChannel);
                    currentChannel = null;
                }
            }
        }

        return channels;
    },

    /**
     * Fetch and parse an M3U file from a URL
     * @param {string} url 
     * @returns {Promise<Array>}
     */
    async fetchPlaylist(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to fetch playlist');
            const content = await response.text();
            return this.parse(content);
        } catch (error) {
            console.error('Error fetching M3U playlist:', error);
            return [];
        }
    }
};
