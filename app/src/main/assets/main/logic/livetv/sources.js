export const PRESET_SOURCES = {
    // High Quality Global Sources (IPTV-org - Well Maintained)
    // These are the most reliable for general content and sports
    "global_index": {
        name: "IPTV-org Global",
        url: "https://iptv-org.github.io/iptv/index.m3u",
        category: "Global"
    },
    "sports_global": {
        name: "IPTV-org Sports (Global)",
        url: "https://iptv-org.github.io/iptv/categories/sport.m3u",
        category: "Sports"
    },
    "movies_global": {
        name: "IPTV-org Movies (Global)",
        url: "https://iptv-org.github.io/iptv/categories/movies.m3u",
        category: "Movies"
    },

    // Country Specific (IPTV-org)
    // France and Belgium are priority for Ligue 1/2
    "france": {
        name: "France (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/fr.m3u",
        category: "France"
    },
    "belgium": {
        name: "Belgium (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/be.m3u",
        category: "Belgium"
    },
    "netherlands": {
        name: "Netherlands (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/nl.m3u",
        category: "Netherlands"
    },
    "united_kingdom": {
        name: "UK (IPTV-org)",
        url: "https://iptv-org.github.io/iptv/countries/uk.m3u",
        category: "UK"
    },

    // Community Curated Collections (Alternative reliable repositories)
    "free_tv_global": {
        name: "Free-TV Original (Global)",
        url: "https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8",
        category: "Global"
    },
    "fluxus_iptv": {
        name: "Fluxus TV (World)",
        url: "https://raw.githubusercontent.com/skylinetech/iptv/main/iptv.m3u",
        category: "Global"
    },

    // Specialized Sports Bundles
    // Note: Search "Ligue" or "BeIN" to find specific matches
    "sports_bundle_1": {
        name: "World Sports Bundle",
        url: "https://raw.githubusercontent.com/v8t/iptv/main/sport.m3u",
        category: "Sports"
    }
};
