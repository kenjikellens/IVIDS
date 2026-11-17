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
    {
        id: 'freetv_nl',
        name: 'Free-TV Netherlands',
        url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_netherlands.m3u8',
        category: 'Netherlands',
        country: 'netherlands',
        priority: 9
    },
    {
        id: 'iptvorg_master_nl',
        name: 'Netherlands Master Streams',
        url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/nl.m3u',
        category: 'Netherlands',
        country: 'netherlands',
        priority: 11
    },
    {
        id: 'lang_dutch',
        name: 'Dutch Language Channels',
        url: 'https://iptv-org.github.io/iptv/languages/nld.m3u',
        category: 'Global',
        country: 'global',
        priority: 11
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
    {
        id: 'freetv_be',
        name: 'Free-TV Belgium',
        url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_belgium.m3u8',
        category: 'Belgium',
        country: 'belgium',
        priority: 9
    },
    {
        id: 'iptvorg_master_be',
        name: 'Belgium Master Streams',
        url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/be.m3u',
        category: 'Belgium',
        country: 'belgium',
        priority: 11
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
    {
        id: 'freetv_es',
        name: 'Free-TV Spain',
        url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_spain.m3u8',
        category: 'Spain',
        country: 'spain',
        priority: 11
    },
    {
        id: 'lang_spanish',
        name: 'Spanish Language Channels',
        url: 'https://iptv-org.github.io/iptv/languages/spa.m3u',
        category: 'Global',
        country: 'global',
        priority: 13
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
    {
        id: 'freetv_fr',
        name: 'Free-TV France',
        url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_france.m3u8',
        category: 'France',
        country: 'france',
        priority: 11
    },
    {
        id: 'lang_french',
        name: 'French Language Channels',
        url: 'https://iptv-org.github.io/iptv/languages/fra.m3u',
        category: 'Global',
        country: 'global',
        priority: 13
    },

    // Verified Regional FAST Playlists (Samsung TV Plus, Pluto TV, Plex)
    {
        id: 'samsung_fr',
        name: 'Samsung TV Plus France',
        url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/samsungtvplus_fr.m3u',
        category: 'France',
        country: 'france',
        priority: 14
    },
    {
        id: 'pluto_fr',
        name: 'Pluto TV France',
        url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plutotv_fr.m3u',
        category: 'France',
        country: 'france',
        priority: 14
    },
    {
        id: 'plex_fr',
        name: 'Plex Live France',
        url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plex_fr.m3u',
        category: 'France',
        country: 'france',
        priority: 14
    },
    {
        id: 'samsung_gb',
        name: 'Samsung TV Plus UK',
        url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/samsungtvplus_gb.m3u',
        category: 'UK',
        country: 'united kingdom',
        priority: 16
    },
    {
        id: 'pluto_gb',
        name: 'Pluto TV UK',
        url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plutotv_gb.m3u',
        category: 'UK',
        country: 'united kingdom',
        priority: 16
    },
    {
        id: 'samsung_de',
        name: 'Samsung TV Plus Germany',
        url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/samsungtvplus_de.m3u',
        category: 'Germany',
        country: 'germany',
        priority: 16
    },
    {
        id: 'pluto_de',
        name: 'Pluto TV Germany',
        url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plutotv_de.m3u',
        category: 'Germany',
        country: 'germany',
        priority: 16
    },
    {
        id: 'samsung_es',
        name: 'Samsung TV Plus Spain',
        url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/samsungtvplus_es.m3u',
        category: 'Spain',
        country: 'spain',
        priority: 14
    },
    {
        id: 'pluto_es',
        name: 'Pluto TV Spain',
        url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plutotv_es.m3u',
        category: 'Spain',
        country: 'spain',
        priority: 14
    },
    {
        id: 'plex_es',
        name: 'Plex Live Spain',
        url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plex_es.m3u',
        category: 'Spain',
        country: 'spain',
        priority: 14
    },
    {
        id: 'samsung_it',
        name: 'Samsung TV Plus Italy',
        url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/samsungtvplus_it.m3u',
        category: 'Italy',
        country: 'italy',
        priority: 16
    },
    {
        id: 'pluto_it',
        name: 'Pluto TV Italy',
        url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plutotv_it.m3u',
        category: 'Italy',
        country: 'italy',
        priority: 16
    },
    {
        id: 'pluto_us',
        name: 'Pluto TV USA',
        url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plutotv_us.m3u',
        category: 'USA',
        country: 'united states',
        priority: 16
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
    {
        id: 'freetv_de',
        name: 'Free-TV Germany',
        url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_germany.m3u8',
        category: 'Germany',
        country: 'germany',
        priority: 14
    },
    {
        id: 'lang_german',
        name: 'German Language Channels',
        url: 'https://iptv-org.github.io/iptv/languages/deu.m3u',
        category: 'Global',
        country: 'global',
        priority: 16
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
    {
        id: 'freetv_pt',
        name: 'Free-TV Portugal',
        url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_portugal.m3u8',
        category: 'Portugal',
        country: 'portugal',
        priority: 14
    },
    {
        id: 'lang_portuguese',
        name: 'Portuguese Language Channels',
        url: 'https://iptv-org.github.io/iptv/languages/por.m3u',
        category: 'Global',
        country: 'global',
        priority: 16
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
    {
        id: 'freetv_it',
        name: 'Free-TV Italy',
        url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_italy.m3u8',
        category: 'Italy',
        country: 'italy',
        priority: 14
    },
    {
        id: 'lang_italian',
        name: 'Italian Language Channels',
        url: 'https://iptv-org.github.io/iptv/languages/ita.m3u',
        category: 'Global',
        country: 'global',
        priority: 16
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
    {
        id: 'freetv_uk',
        name: 'Free-TV UK',
        url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_uk.m3u8',
        category: 'UK',
        country: 'united kingdom',
        priority: 14
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
    {
        id: 'freetv_us',
        name: 'Free-TV USA',
        url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlists/playlist_usa.m3u8',
        category: 'USA',
        country: 'united states',
        priority: 14
    },
    {
        id: 'lang_english',
        name: 'English Language Channels',
        url: 'https://iptv-org.github.io/iptv/languages/eng.m3u',
        category: 'Global',
        country: 'global',
        priority: 18
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

