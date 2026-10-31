/**
 * Regional & Global IPTV Source Catalogs
 * ======================================
 * Declarative configuration for curated international Free-TV and regional public playlists.
 * Consumed by M3uProvider instances orchestrated by SourceManager.
 */

export const REGIONAL_CATALOG = [
    // Quality-first curated global source
    {
        id: 'free_tv_global',
        name: 'Free-TV Curated Global',
        url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
        category: 'Global',
        country: 'global',
        priority: 2
    },

    // Netherlands
    {
        id: 'netherlands',
        name: 'Netherlands',
        url: 'https://iptv-org.github.io/iptv/countries/nl.m3u',
        category: 'Netherlands',
        country: 'netherlands',
        priority: 10
    },

    // Belgium
    {
        id: 'belgium',
        name: 'Belgium',
        url: 'https://iptv-org.github.io/iptv/countries/be.m3u',
        category: 'Belgium',
        country: 'belgium',
        priority: 10
    },

    // Spain
    {
        id: 'spain',
        name: 'Spain',
        url: 'https://iptv-org.github.io/iptv/countries/es.m3u',
        category: 'Spain',
        country: 'spain',
        priority: 12
    },

    // France
    {
        id: 'france',
        name: 'France',
        url: 'https://iptv-org.github.io/iptv/countries/fr.m3u',
        category: 'France',
        country: 'france',
        priority: 12
    },

    // Germany
    {
        id: 'germany',
        name: 'Germany',
        url: 'https://iptv-org.github.io/iptv/countries/de.m3u',
        category: 'Germany',
        country: 'germany',
        priority: 15
    },

    // Portugal
    {
        id: 'portugal',
        name: 'Portugal',
        url: 'https://iptv-org.github.io/iptv/countries/pt.m3u',
        category: 'Portugal',
        country: 'portugal',
        priority: 15
    },

    // Italy
    {
        id: 'italy',
        name: 'Italy',
        url: 'https://iptv-org.github.io/iptv/countries/it.m3u',
        category: 'Italy',
        country: 'italy',
        priority: 15
    },

    // United Kingdom
    {
        id: 'united_kingdom',
        name: 'UK',
        url: 'https://iptv-org.github.io/iptv/countries/uk.m3u',
        category: 'UK',
        country: 'united kingdom',
        priority: 15
    },

    // United States
    {
        id: 'united_states',
        name: 'USA',
        url: 'https://iptv-org.github.io/iptv/countries/us.m3u',
        category: 'USA',
        country: 'united states',
        priority: 15
    },

    // Global thematic playlists
    {
        id: 'sports_global',
        name: 'IPTV-org Sports (Global)',
        url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
        category: 'Sports',
        country: 'global',
        priority: 20
    },
    {
        id: 'movies_global',
        name: 'IPTV-org Movies (Global)',
        url: 'https://iptv-org.github.io/iptv/categories/movies.m3u',
        category: 'Movies',
        country: 'global',
        priority: 25
    },
    {
        id: 'news_global',
        name: 'IPTV-org News (Global)',
        url: 'https://iptv-org.github.io/iptv/categories/news.m3u',
        category: 'News',
        country: 'global',
        priority: 25
    }
];

