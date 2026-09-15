/**
 * APP_CONFIG - Centralized configuration registry for IVIDS.
 * Single source of truth for UI categories, slider durations, network thresholds, cache limits,
 * API endpoints, player settings, and internationalization registries.
 */

/** Hero carousel slider parameters */
export const HERO_CONFIG = Object.freeze({
    DEFAULT_DURATION: 6000,       // Slide transition cycle duration (ms)
    FADE_TRANSITION_TIMEOUT: 500, // Slide text content fade transition duration (ms)
    TRUNCATE_LIMIT: 250           // Maximum character limit for hero description text
});

/** Network quality monitoring and warning alert parameters */
export const NETWORK_CONFIG = Object.freeze({
    SLOW_THRESHOLD_MBPS: 1.5,     // Threshold below which connection is considered slow
    ALERT_DURATION_MS: 3000,      // Duration to show slow internet warning icon (ms)
    ALERT_COOLDOWN_MS: 15000      // Minimum cooldown interval between slow internet alerts (ms)
});

/** In-memory blob image cache parameters */
export const CACHE_CONFIG = Object.freeze({
    MAX_IMAGE_ITEMS: 200          // Maximum blob items stored in ImageCache before LRU eviction
});

/** Internationalization & language settings */
export const I18N_CONFIG = Object.freeze({
    DEFAULT_LANGUAGE: 'en',
    AVAILABLE_LANGUAGES: Object.freeze([
        'ar', 'bg', 'bn', 'ca', 'cs', 'da', 'de', 'el', 'en', 'es', 'fa', 'fi', 'fr', 'he', 'hi',
        'hr', 'hu', 'id', 'it', 'ja', 'ko', 'ms', 'nl', 'no', 'pl', 'pt',
        'ro', 'ru', 'sk', 'sr', 'sv', 'th', 'tl', 'tr', 'uk', 'vi', 'zh'
    ])
});

/** TMDb API endpoints, image CDN paths, and target image dimensions */
export const API_CONFIG = Object.freeze({
    BASE_URL: 'https://api.themoviedb.org/3',
    IMAGE_BASE_PATH: 'https://image.tmdb.org/t/p',
    DEFAULT_PLAYER_BASE_URL: 'https://vidlink.pro',
    FETCH_TIMEOUT_MS: 15000,
    FETCH_RETRIES: 2,
    POSTER_SIZES: Object.freeze({
        LOW: 'w92',
        SMALL: 'w154',
        MEDIUM: 'w185',
        STANDARD: 'w342',
        LARGE: 'w500',
        XLARGE: 'w780',
        ORIGINAL: 'original'
    }),
    BACKDROP_SIZES: Object.freeze({
        LOW: 'w300',
        MEDIUM: 'w780',
        STANDARD: 'w1280',
        ORIGINAL: 'original'
    })
});

/** Video player controls & streaming server provider registry */
export const PLAYER_CONFIG = Object.freeze({
    CONTROLS_TIMEOUT_MS: 4000,
    SEEK_STEP_SECONDS: 10,
    DEFAULT_PROVIDERS: Object.freeze([
        { id: 'vidlink', name: 'VidLink (Server 1)', url: 'https://vidlink.pro', isCustom: false },
        { id: 'vidsrc_to', name: 'VidSrc.to (Server 2)', url: 'https://vidsrc.to/embed', isCustom: false },
        { id: 'videasy', name: 'Videasy (Server 3)', url: 'https://player.videasy.net', isCustom: false },
        { id: 'vidsrc_me', name: 'VidSrc.me (Server 4)', url: 'https://vidsrc.me/embed', isCustom: false },
        { id: 'vidsrc_pm', name: 'VidSrc.pm (Server 5)', url: 'https://vidsrc.pm/embed', isCustom: false },
        { id: '2embed', name: '2Embed (Server 6)', url: 'https://www.2embed.cc/embed', isCustom: false },
        { id: 'vidjoy', name: 'VidJoy (Server 7)', url: 'https://vidjoy.pro/embed', isCustom: false }
    ])
});

/** UI Scale limits and display settings */
export const UI_CONFIG = Object.freeze({
    MIN_SCALE: 0.5,
    MAX_SCALE: 1.5,
    SCALE_STEP: 0.1,
    DEFAULT_SCALE: '1.0'
});

/** Dynamic category row configurations for Home, Movies, and Series views */
export const CATEGORY_CONFIG = Object.freeze({
    home: Object.freeze([
        { id: 'trending-today-row', i18nKey: 'row.trendingToday', defaultTitle: 'Trending Today' },
        { id: 'top-rated-row', i18nKey: 'row.top_rated', defaultTitle: 'Top Rated' },
        { id: 'new-this-year-row', i18nKey: 'row.newThisYear', defaultTitle: 'New This Year' },
        { id: 'popular-movies-row', i18nKey: 'row.popular_movies', defaultTitle: 'Popular Movies' },
        { id: 'popular-series-row', i18nKey: 'row.popular_tv', defaultTitle: 'Popular Series' },
        { id: 'blockbuster-movies-row', i18nKey: 'row.blockbusterHits', defaultTitle: 'Blockbuster Hits' },
        { id: 'award-winners-row', i18nKey: 'row.awardWinners', defaultTitle: 'Award Winners' },
        { id: 'true-story-row', i18nKey: 'row.trueStory', defaultTitle: 'Based on a True Story' },
        { id: 'heist-movies-row', i18nKey: 'row.heist', defaultTitle: 'Heist Movies' },
        { id: 'zombie-apocalypse-row', i18nKey: 'row.zombies', defaultTitle: 'Zombies & Apocalypse' },
        { id: 'sports-movies-row', i18nKey: 'row.sports', defaultTitle: 'Sports & Legends' },
        { id: 'marvel-row', i18nKey: 'row.marvel', defaultTitle: 'Marvel Universe' },
        { id: 'dc-universe-row', i18nKey: 'row.dcUniverse', defaultTitle: 'DC Universe' },
        { id: 'anime-row', i18nKey: 'row.anime', defaultTitle: 'Anime' },
        { id: 'eighties-movies-row', i18nKey: 'row.eightiesNostalgia', defaultTitle: '80s Classics' },
        { id: 'nineties-movies-row', i18nKey: 'row.ninetiesNostalgia', defaultTitle: '90s Classics' },
        { id: 'classics-row', i18nKey: 'row.classics', defaultTitle: 'Classic Movies' },
        { id: 'action-movies-row', i18nKey: 'row.action', defaultTitle: 'Action' },
        { id: 'comedy-movies-row', i18nKey: 'row.comedy', defaultTitle: 'Comedy' },
        { id: 'romcom-movies-row', i18nKey: 'row.romcom', defaultTitle: 'Rom-Coms' },
        { id: 'thriller-movies-row', i18nKey: 'row.thriller', defaultTitle: 'Thriller' },
        { id: 'horror-movies-row', i18nKey: 'row.horror', defaultTitle: 'Horror' },
        { id: 'scifi-movies-row', i18nKey: 'row.scifi', defaultTitle: 'Sci-Fi' },
        { id: 'family-movies-row', i18nKey: 'row.family', defaultTitle: 'Family' },
        { id: 'documentary-movies-row', i18nKey: 'row.documentary', defaultTitle: 'Documentary' },
        { id: 'fantasy-movies-row', i18nKey: 'row.fantasy', defaultTitle: 'Fantasy' }
    ]),
    movies: Object.freeze([
        { id: 'trending-movies-today-row', i18nKey: 'row.trendingMoviesToday', defaultTitle: 'Trending Movies Today' },
        { id: 'top-rated-movies-row', i18nKey: 'row.top_rated_movies', defaultTitle: 'Top Rated Movies' },
        { id: 'popular-movies-row', i18nKey: 'row.popular_movies', defaultTitle: 'Popular Movies' },
        { id: 'blockbuster-movies-row', i18nKey: 'row.blockbusterHits', defaultTitle: 'Blockbuster Hits' },
        { id: 'award-winners-movies-row', i18nKey: 'row.awardWinners', defaultTitle: 'Award Winners' },
        { id: 'true-story-movies-row', i18nKey: 'row.trueStory', defaultTitle: 'Based on a True Story' },
        { id: 'heist-movies-row', i18nKey: 'row.heist', defaultTitle: 'Heist Movies' },
        { id: 'zombie-movies-row', i18nKey: 'row.zombies', defaultTitle: 'Zombies & Apocalypse' },
        { id: 'sports-movies-row', i18nKey: 'row.sports', defaultTitle: 'Sports & Legends' },
        { id: 'psychological-thriller-movies-row', i18nKey: 'row.psychologicalThriller', defaultTitle: 'Psychological Thrillers' },
        { id: 'cyberpunk-movies-row', i18nKey: 'row.cyberpunk', defaultTitle: 'Cyberpunk & Dystopia' },
        { id: 'eighties-movies-row', i18nKey: 'row.eightiesNostalgia', defaultTitle: '80s Classics' },
        { id: 'nineties-movies-row', i18nKey: 'row.ninetiesNostalgia', defaultTitle: '90s Classics' },
        { id: 'action-movies-row', i18nKey: 'row.action', defaultTitle: 'Action' },
        { id: 'adventure-movies-row', i18nKey: 'row.adventure', defaultTitle: 'Adventure' },
        { id: 'comedy-movies-row', i18nKey: 'row.comedy', defaultTitle: 'Comedy' },
        { id: 'romcom-movies-row', i18nKey: 'row.romcom', defaultTitle: 'Rom-Coms' },
        { id: 'animation-movies-row', i18nKey: 'row.animation', defaultTitle: 'Animation' },
        { id: 'crime-movies-row', i18nKey: 'row.crime', defaultTitle: 'Crime' },
        { id: 'thriller-movies-row', i18nKey: 'row.thriller', defaultTitle: 'Thriller' },
        { id: 'horror-movies-row', i18nKey: 'row.horror', defaultTitle: 'Horror' },
        { id: 'scifi-movies-row', i18nKey: 'row.scifi', defaultTitle: 'Sci-Fi' },
        { id: 'fantasy-movies-row', i18nKey: 'row.fantasy', defaultTitle: 'Fantasy' },
        { id: 'mystery-movies-row', i18nKey: 'row.mystery', defaultTitle: 'Mystery' },
        { id: 'romance-movies-row', i18nKey: 'row.romance', defaultTitle: 'Romance' },
        { id: 'family-movies-row', i18nKey: 'row.family', defaultTitle: 'Family' },
        { id: 'documentary-movies-row', i18nKey: 'row.documentary', defaultTitle: 'Documentary' },
        { id: 'western-movies-row', i18nKey: 'row.western', defaultTitle: 'Western' },
        { id: 'cult-classics-movies-row', i18nKey: 'row.cultClassics', defaultTitle: 'Cult Classics' },
        { id: 'standup-comedy-movies-row', i18nKey: 'row.standupComedy', defaultTitle: 'Stand-Up Specials' },
        { id: 'music-movies-row', i18nKey: 'row.music', defaultTitle: 'Music & Musicals' },
        { id: 'anime-movies-row', i18nKey: 'row.anime', defaultTitle: 'Anime' }
    ]),
    series: Object.freeze([
        { id: 'trending-series-today-row', i18nKey: 'row.trendingSeriesToday', defaultTitle: 'Trending Series Today' },
        { id: 'top-rated-series-row', i18nKey: 'row.top_rated_series', defaultTitle: 'Top Rated Series' },
        { id: 'popular-series-row', i18nKey: 'row.popular_tv', defaultTitle: 'Popular Series' },
        { id: 'mini-series-row', i18nKey: 'row.miniSeries', defaultTitle: 'Limited & Mini-Series' },
        { id: 'docuseries-series-row', i18nKey: 'row.docuseries', defaultTitle: 'Docuseries & True Crime' },
        { id: 'sitcoms-series-row', i18nKey: 'row.sitcoms', defaultTitle: 'Classic Sitcoms & Comedies' },
        { id: 'marvel-series-row', i18nKey: 'row.marvelSeries', defaultTitle: 'Marvel Series Universe' },
        { id: 'dc-series-row', i18nKey: 'row.dcSeries', defaultTitle: 'DC Series Universe' },
        { id: 'action-adventure-series-row', i18nKey: 'row.action_adventure', defaultTitle: 'Action & Adventure' },
        { id: 'crime-series-row', i18nKey: 'row.crime', defaultTitle: 'Crime' },
        { id: 'scifi-fantasy-series-row', i18nKey: 'row.scifi_fantasy', defaultTitle: 'Sci-Fi & Fantasy' },
        { id: 'mystery-series-row', i18nKey: 'row.mystery', defaultTitle: 'Mystery' },
        { id: 'drama-series-row', i18nKey: 'row.drama', defaultTitle: 'Drama' },
        { id: 'animation-series-row', i18nKey: 'row.animation', defaultTitle: 'Animation' },
        { id: 'family-series-row', i18nKey: 'row.family', defaultTitle: 'Family' },
        { id: 'kids-series-row', i18nKey: 'row.kids', defaultTitle: 'Kids' },
        { id: 'reality-series-row', i18nKey: 'row.reality', defaultTitle: 'Reality' },
        { id: 'anime-series-row', i18nKey: 'row.anime', defaultTitle: 'Anime' }
    ])
});
