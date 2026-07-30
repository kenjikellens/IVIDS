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
        'ar', 'bg', 'cs', 'da', 'de', 'el', 'en', 'es', 'fi', 'fr', 'hi',
        'hr', 'hu', 'id', 'it', 'ja', 'ko', 'ms', 'nl', 'no', 'pl', 'pt',
        'ro', 'ru', 'sk', 'sv', 'th', 'tl', 'tr', 'uk', 'vi', 'zh'
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
        { id: 'direct_stream', name: 'IVIDS Direct Stream (Clean)', url: 'direct://resolver', isCustom: false },
        { id: 'vidlink', name: 'VidLink (Server 2)', url: 'https://vidlink.pro', isCustom: false },
        { id: 'vidsrc_to', name: 'VidSrc.to (Server 3)', url: 'https://vidsrc.to/embed', isCustom: false },
        { id: 'videasy', name: 'Videasy (Server 4)', url: 'https://player.videasy.net', isCustom: false },
        { id: 'embed_su', name: 'Embed.su (Server 5)', url: 'https://embed.su/embed', isCustom: false }
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
        { id: 'recently-watched-row', i18nKey: 'home.recentlyWatched', defaultTitle: 'Recently Watched' },
        { id: 'trending-today-row', i18nKey: 'row.trendingToday', defaultTitle: 'Trending Today' },
        { id: 'highly-rated-row', i18nKey: 'row.highlyRated', defaultTitle: 'Highly Rated' },
        { id: 'new-this-year-row', i18nKey: 'row.newThisYear', defaultTitle: 'New This Year' },
        { id: 'hbo-row', i18nKey: 'row.hboHits', defaultTitle: 'HBO & Max Hits' },
        { id: 'apple-tv-row', i18nKey: 'row.appleOriginals', defaultTitle: 'Apple TV+ Originals' },
        { id: 'prime-row', i18nKey: 'row.amazonOriginals', defaultTitle: 'Amazon Prime Originals' },
        { id: 'award-winners-row', i18nKey: 'row.awardWinners', defaultTitle: 'Award Winners' },
        { id: 'oscar-winners-row', i18nKey: 'row.oscarWinners', defaultTitle: 'Oscar & Academy Winners' },
        { id: 'top-rated-row', i18nKey: 'home.popular', defaultTitle: 'Popular' },
        { id: 'action-row', i18nKey: 'home.newReleases', defaultTitle: 'New Releases' },
        { id: 'blockbuster-movies-row', i18nKey: 'row.blockbusterHits', defaultTitle: 'Blockbuster Hits' },
        { id: 'tv-row', i18nKey: 'nav.series', defaultTitle: 'Series' },
        { id: 'binge-worthy-series-row', i18nKey: 'row.bingeWorthySeries', defaultTitle: 'Binge-Worthy Series' },
        { id: 'comedy-series-row', i18nKey: 'row.comedySeries', defaultTitle: 'Comedy Series' },
        { id: 'anime-row', i18nKey: 'row.anime', defaultTitle: 'Anime' },
        { id: 'disney-row', i18nKey: 'row.disney', defaultTitle: 'Disney' },
        { id: 'marvel-row', i18nKey: 'row.marvel', defaultTitle: 'Marvel' },
        { id: 'pixar-row', i18nKey: 'row.pixar', defaultTitle: 'Pixar' },
        { id: 'ghibli-row', i18nKey: 'row.ghibli', defaultTitle: 'Studio Ghibli' },
        { id: 'netflix-row', i18nKey: 'row.netflix', defaultTitle: 'Netflix Originals' },
        { id: 'korean-row', i18nKey: 'row.korean', defaultTitle: 'Korean Content' },
        { id: 'bollywood-row', i18nKey: 'row.bollywood', defaultTitle: 'Bollywood' },
        { id: 'mind-bending-row', i18nKey: 'row.mindBending', defaultTitle: 'Mind-Bending & Mystery' },
        { id: 'classics-row', i18nKey: 'row.classics', defaultTitle: 'Classic Movies' },
        { id: 'nostalgia-80s-90s-row', i18nKey: 'row.nostalgia80s90s', defaultTitle: '80s & 90s Cult Favorites' },
        { id: 'indie-gems-row', i18nKey: 'row.indieGems', defaultTitle: 'Indie Film Gems' },
        { id: 'horror-row', i18nKey: 'row.horror', defaultTitle: 'Horror' },
        { id: 'scifi-row', i18nKey: 'row.scifi', defaultTitle: 'Sci-Fi' },
        { id: 'thriller-row', i18nKey: 'row.thriller', defaultTitle: 'Thriller' },
        { id: 'romance-row', i18nKey: 'row.romance', defaultTitle: 'Romance' },
        { id: 'family-row', i18nKey: 'row.family', defaultTitle: 'Family' },
        { id: 'documentary-row', i18nKey: 'row.documentary', defaultTitle: 'Documentary' },
        { id: 'crime-row', i18nKey: 'row.crime', defaultTitle: 'Crime' },
        { id: 'fantasy-row', i18nKey: 'row.fantasy', defaultTitle: 'Fantasy' }
    ]),
    movies: Object.freeze([
        { id: 'top-rated-movies-row', i18nKey: 'row.top_rated_movies', defaultTitle: 'Top Rated' },
        { id: 'trending-movies-today-row', i18nKey: 'row.trendingMoviesToday', defaultTitle: 'Trending Movies Today' },
        { id: 'hbo-movies-row', i18nKey: 'row.hboMovies', defaultTitle: 'HBO & Warner Bros Movies' },
        { id: 'apple-movies-row', i18nKey: 'row.appleMovies', defaultTitle: 'Apple Original Films' },
        { id: 'paramount-movies-row', i18nKey: 'row.paramountMovies', defaultTitle: 'Paramount Pictures' },
        { id: 'universal-movies-row', i18nKey: 'row.universalMovies', defaultTitle: 'Universal Pictures' },
        { id: 'sony-movies-row', i18nKey: 'row.sonyMovies', defaultTitle: 'Columbia & Sony Pictures' },
        { id: 'indie-movies-row', i18nKey: 'row.indieMovies', defaultTitle: 'A24 & Indie Cinema' },
        { id: 'cult-classics-movies-row', i18nKey: 'row.cultClassics', defaultTitle: 'Cult Classics' },
        { id: 'high-octane-action-movies-row', i18nKey: 'row.highOctaneAction', defaultTitle: 'High-Octane Action' },
        { id: 'standup-comedy-movies-row', i18nKey: 'row.standupComedy', defaultTitle: 'Stand-Up Specials' },
        { id: 'action-movies-row', i18nKey: 'row.action', defaultTitle: 'Action' },
        { id: 'comedy-movies-row', i18nKey: 'row.comedy', defaultTitle: 'Comedy' },
        { id: 'adventure-movies-row', i18nKey: 'row.adventure', defaultTitle: 'Adventure' },
        { id: 'animation-movies-row', i18nKey: 'row.animation', defaultTitle: 'Animation' },
        { id: 'crime-movies-row', i18nKey: 'row.crime', defaultTitle: 'Crime' },
        { id: 'documentary-movies-row', i18nKey: 'row.documentary', defaultTitle: 'Documentary' },
        { id: 'drama-movies-row', i18nKey: 'row.drama', defaultTitle: 'Drama' },
        { id: 'family-movies-row', i18nKey: 'row.family', defaultTitle: 'Family' },
        { id: 'fantasy-movies-row', i18nKey: 'row.fantasy', defaultTitle: 'Fantasy' },
        { id: 'history-movies-row', i18nKey: 'row.history', defaultTitle: 'History' },
        { id: 'horror-movies-row', i18nKey: 'row.horror', defaultTitle: 'Horror' },
        { id: 'music-movies-row', i18nKey: 'row.music', defaultTitle: 'Music' },
        { id: 'mystery-movies-row', i18nKey: 'row.mystery', defaultTitle: 'Mystery' },
        { id: 'romance-movies-row', i18nKey: 'row.romance', defaultTitle: 'Romance' },
        { id: 'scifi-movies-row', i18nKey: 'row.scifi', defaultTitle: 'Sci-Fi' },
        { id: 'thriller-movies-row', i18nKey: 'row.thriller', defaultTitle: 'Thriller' },
        { id: 'war-movies-row', i18nKey: 'row.war', defaultTitle: 'War' },
        { id: 'western-movies-row', i18nKey: 'row.western', defaultTitle: 'Western' },
        { id: 'anime-movies-row', i18nKey: 'row.anime', defaultTitle: 'Anime' }
    ]),
    series: Object.freeze([
        { id: 'top-rated-series-row', i18nKey: 'row.top_rated_series', defaultTitle: 'Top Rated Series' },
        { id: 'trending-series-today-row', i18nKey: 'row.trendingSeriesToday', defaultTitle: 'Trending Series Today' },
        { id: 'hbo-series-row', i18nKey: 'row.hboSeries', defaultTitle: 'HBO & Max Series' },
        { id: 'apple-series-row', i18nKey: 'row.appleSeries', defaultTitle: 'Apple TV+ Series' },
        { id: 'amazon-series-row', i18nKey: 'row.amazonSeries', defaultTitle: 'Amazon Prime Series' },
        { id: 'disney-series-row', i18nKey: 'row.disneySeries', defaultTitle: 'Disney+ Series' },
        { id: 'hulu-series-row', i18nKey: 'row.huluSeries', defaultTitle: 'Hulu Originals' },
        { id: 'paramount-series-row', i18nKey: 'row.paramountSeries', defaultTitle: 'Paramount+ Series' },
        { id: 'mini-series-row', i18nKey: 'row.miniSeries', defaultTitle: 'Limited & Mini-Series' },
        { id: 'korean-dramas-series-row', i18nKey: 'row.koreanDramas', defaultTitle: 'K-Dramas (Korean Series)' },
        { id: 'docuseries-series-row', i18nKey: 'row.docuseries', defaultTitle: 'Docuseries & True Crime' },
        { id: 'sitcoms-series-row', i18nKey: 'row.sitcoms', defaultTitle: 'Classic Sitcoms & Comedies' },
        { id: 'marvel-series-row', i18nKey: 'row.marvelSeries', defaultTitle: 'Marvel Series Universe' },
        { id: 'action-adventure-series-row', i18nKey: 'row.action_adventure', defaultTitle: 'Action & Adventure' },
        { id: 'animation-series-row', i18nKey: 'row.animation', defaultTitle: 'Animation' },
        { id: 'crime-series-row', i18nKey: 'row.crime', defaultTitle: 'Crime' },
        { id: 'documentary-series-row', i18nKey: 'row.documentary', defaultTitle: 'Documentary' },
        { id: 'drama-series-row', i18nKey: 'row.drama', defaultTitle: 'Drama' },
        { id: 'family-series-row', i18nKey: 'row.family', defaultTitle: 'Family' },
        { id: 'kids-series-row', i18nKey: 'row.kids', defaultTitle: 'Kids' },
        { id: 'mystery-series-row', i18nKey: 'row.mystery', defaultTitle: 'Mystery' },
        { id: 'reality-series-row', i18nKey: 'row.reality', defaultTitle: 'Reality' },
        { id: 'scifi-fantasy-series-row', i18nKey: 'row.scifi_fantasy', defaultTitle: 'Sci-Fi & Fantasy' },
        { id: 'soap-series-row', i18nKey: 'row.soap', defaultTitle: 'Soap' },
        { id: 'war-politics-series-row', i18nKey: 'row.war_politics', defaultTitle: 'War & Politics' },
        { id: 'western-series-row', i18nKey: 'row.western', defaultTitle: 'Western' },
        { id: 'anime-series-row', i18nKey: 'row.anime', defaultTitle: 'Anime' }
    ])
});
