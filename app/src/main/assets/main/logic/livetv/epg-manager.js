/**
 * EpgManager Class
 * ================
 * Generates stable, realistic, and real-time mock Electronic Program Guide (EPG) data 
 * for Live TV channels based on their category/group and the current system time.
 * This guarantees consistent show metadata across different UI views.
 */
export class EpgManager {
    // Database of mock program titles grouped by genre/category
    static PROGRAM_DATABASE = {
        sports: [
            "Live: Premier League Match",
            "Live: UEFA Champions League Football",
            "Formula 1 Grand Prix Special",
            "Live: NBA Regular Season Basketball",
            "ATP Tour Tennis Finals Live",
            "Ligue 1 Football Highlights",
            "Extreme Sports Showcase",
            "World Sports Center Daily",
            "PGA Tour Golf Highlights",
            "Live: Cricket Test Match"
        ],
        movies: [
            "The Dark Knight",
            "Interstellar",
            "Inception",
            "The Matrix Resurrections",
            "Gladiator (Extended Cut)",
            "Pulp Fiction",
            "Spider-Man: No Way Home",
            "Avatar: The Way of Water",
            "Dune: Part Two",
            "Blade Runner 2049"
        ],
        news: [
            "Global News Hour",
            "World Business Report",
            "Morning Edition Live",
            "Tech & Innovation Today",
            "Documentary Special Report",
            "Evening News Brief",
            "Politics Weekly",
            "Weather & Climate Update",
            "Global Investigation",
            "Headline News Today"
        ],
        music: [
            "Hits Today: Top 40 Charts",
            "Retro Mix Hour",
            "Live Concert Special",
            "Late Night Jazz Sessions",
            "Electronic Beats Live",
            "Acoustic Live Sessions",
            "Indie Spotlight",
            "Pop Anthem Countdown"
        ],
        general: [
            "Daily Talk Show with Host",
            "Comedy Club Standup Special",
            "Cooking Masterclass Live",
            "Travel & Culture Explorer",
            "Science & Discovery Special",
            "Drama Series Marathon",
            "Reality Show Showdown",
            "Game Show Championship",
            "Wild Nature Documentary",
            "Home & Living Makeover"
        ]
    };

    /**
     * getStringHash Function
     * ======================
     * Computes a simple, stable hash value for a given string.
     * Used to seed the deterministic random selection of program titles.
     * 
     * @param {string} str - The input string to hash.
     * @returns {number} A positive hash integer.
     */
    static getStringHash(str) {
        let hash = 0;
        if (!str) return hash;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash);
    }

    /**
     * getCurrentProgram Function
     * ==========================
     * Computes the current active program block, elapsed timeline progress,
     * and duration details for a channel name and group category.
     * 
     * @param {string} channelName - The name of the channel.
     * @param {string} channelGroup - The category or group of the channel (e.g. Sports, Movies).
     * @returns {Object} An object containing title, start, end, progress, and timeLeft.
     */
    static getCurrentProgram(channelName, channelGroup = '') {
        const name = channelName || 'Channel';
        const group = (channelGroup || '').toLowerCase();

        // Determine program category list
        let category = 'general';
        let slotDurationHours = 1; // Default 1-hour shows for news, general, music

        if (group.includes('sport')) {
            category = 'sports';
            slotDurationHours = 2; // Sports are typically 2 hours
        } else if (group.includes('movie') || group.includes('cinema')) {
            category = 'movies';
            slotDurationHours = 2; // Movies are typically 2 hours
        } else if (group.includes('news') || group.includes('aktu') || group.includes('info')) {
            category = 'news';
            slotDurationHours = 1;
        } else if (group.includes('music') || group.includes('radio') || group.includes('hit')) {
            category = 'music';
            slotDurationHours = 1;
        }

        const programList = this.PROGRAM_DATABASE[category] || this.PROGRAM_DATABASE.general;
        const channelSeed = this.getStringHash(name);

        // Fetch current clock details
        const now = new Date();
        const currentHour = now.getHours();

        // Compute slot bounds
        const startHour = Math.floor(currentHour / slotDurationHours) * slotDurationHours;
        const endHour = startHour + slotDurationHours;

        // Create date milestones
        const startDate = new Date(now);
        startDate.setHours(startHour, 0, 0, 0);

        const endDate = new Date(now);
        endDate.setHours(endHour, 0, 0, 0);

        // Compute deterministic show selection index for the active slot
        const slotIndex = Math.floor(currentHour / slotDurationHours);
        const programIndex = (channelSeed + slotIndex) % programList.length;
        const title = programList[programIndex];

        // Format visual output timestamps (e.g. "14:00")
        const formatTime = (date) => {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        };

        // Calculate progress percentage
        const elapsedMs = now.getTime() - startDate.getTime();
        const totalMs = endDate.getTime() - startDate.getTime();
        const progress = Math.min(100, Math.max(0, Math.floor((elapsedMs / totalMs) * 100)));

        // Calculate minutes remaining
        const timeLeftMin = Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (60 * 1000)));

        return {
            title: title,
            start: formatTime(startDate),
            end: formatTime(endDate),
            progress: progress,
            timeLeft: timeLeftMin
        };
    }
}
