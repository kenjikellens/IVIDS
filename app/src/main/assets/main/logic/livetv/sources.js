export const PRESET_SOURCES = {
    // Quality-first curated source. This repo intentionally favors fewer working streams.
    "free_tv_global": {
        name: "Free-TV Curated Global",
        url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
        category: "Global",
        priority: 1
    },

    // IPTV-org official grouped playlists. Split playlists act as fallbacks if one large list fails.
    "global_index": {
        name: "IPTV-org Global",
        url: "https://iptv-org.github.io/iptv/index.m3u",
        category: "Global",
        priority: 2
    },
    "global_by_category": {
        name: "IPTV-org by Category",
        url: "https://iptv-org.github.io/iptv/index.category.m3u",
        category: "Global",
        priority: 3
    },
    "global_by_country": {
        name: "IPTV-org by Country",
        url: "https://iptv-org.github.io/iptv/index.country.m3u",
        category: "Global",
        priority: 3
    },
    "sports_global": {
        name: "IPTV-org Sports (Global)",
        url: "https://iptv-org.github.io/iptv/categories/sport.m3u",
        category: "Sports",
        priority: 3
    },
    "movies_global": {
        name: "IPTV-org Movies (Global)",
        url: "https://iptv-org.github.io/iptv/categories/movies.m3u",
        category: "Movies",
        priority: 4
    },
    "news_global": {
        name: "IPTV-org News (Global)",
        url: "https://iptv-org.github.io/iptv/categories/news.m3u",
        category: "News",
        priority: 3
    },
    "documentary_global": {
        name: "IPTV-org Documentary (Global)",
        url: "https://iptv-org.github.io/iptv/categories/documentary.m3u",
        category: "Documentary",
        priority: 4
    },
    "music_global": {
        name: "IPTV-org Music (Global)",
        url: "https://iptv-org.github.io/iptv/categories/music.m3u",
        category: "Music",
        priority: 4
    },
    "entertainment_global": {
        name: "IPTV-org Entertainment (Global)",
        url: "https://iptv-org.github.io/iptv/categories/entertainment.m3u",
        category: "Entertainment",
        priority: 4
    },

    // Country and region-specific official playlists.
    "france": {
        name: "France (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/fr.m3u",
        category: "France",
        priority: 3
    },
    "belgium": {
        name: "Belgium (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/be.m3u",
        category: "Belgium",
        priority: 3
    },
    "netherlands": {
        name: "Netherlands (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/nl.m3u",
        category: "Netherlands",
        priority: 3
    },
    "united_kingdom": {
        name: "UK (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/uk.m3u",
        category: "UK",
        priority: 3
    },
    "united_states": {
        name: "USA (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/us.m3u",
        category: "USA",
        priority: 3
    },
    "canada": {
        name: "Canada (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/ca.m3u",
        category: "Canada",
        priority: 4
    },
    "germany": {
        name: "Germany (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/de.m3u",
        category: "Germany",
        priority: 4
    },
    "italy": {
        name: "Italy (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/it.m3u",
        category: "Italy",
        priority: 4
    },
    "spain": {
        name: "Spain (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/es.m3u",
        category: "Spain",
        priority: 4
    },
    "portugal": {
        name: "Portugal (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/pt.m3u",
        category: "Portugal",
        priority: 4
    },
    "australia": {
        name: "Australia (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/au.m3u",
        category: "Australia",
        priority: 4
    },
    "europe": {
        name: "Europe Region (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/regions/eur.m3u",
        category: "Europe",
        priority: 5
    },
    "north_america": {
        name: "North America Region (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/regions/noram.m3u",
        category: "North America",
        priority: 5
    }
};
