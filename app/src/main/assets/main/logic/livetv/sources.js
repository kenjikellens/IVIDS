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
    "sports_global": {
        name: "IPTV-org Sports (Global)",
        url: "https://iptv-org.github.io/iptv/categories/sports.m3u",
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
    },
    // FAST Channels (Free Ad-supported Streaming TV) via de bekende Matt Huisman-lijsten (TEMPORARILY OFFLINE - 404 UPSTREAM)
    /*
    "pluto_tv": {
        name: "Pluto TV Global",
        url: "https://i.mjh.nz/PlutoTV/all.m3u8",
        category: "FAST Channels",
        priority: 2
    },
    "samsung_tv_plus": {
        name: "Samsung TV Plus",
        url: "https://i.mjh.nz/SamsungTVPlus/all.m3u8",
        category: "FAST Channels",
        priority: 2
    },
    "plex_tv": {
        name: "Plex TV",
        url: "https://i.mjh.nz/Plex/all.m3u8",
        category: "FAST Channels",
        priority: 2
    },
    "stirr_tv": {
        name: "Stirr TV",
        url: "https://i.mjh.nz/Stirr/all.m3u8",
        category: "FAST Channels",
        priority: 3
    },
    */

    // Kodinerds IPTV (Een uitstekend onderhouden, legaal community-project, vooral sterk in West-Europa/DACH-regio)
    "kodinerds_tv": {
        name: "Kodinerds Legal TV",
        url: "https://raw.githubusercontent.com/jnk22/kodinerds-iptv/master/iptv/clean/clean_tv.m3u",
        category: "Europe",
        priority: 2
    },

    // Aanvullende specifieke categorieën van IPTV-org die nog ontbraken in je setup
    "kids_global": {
        name: "IPTV-org Kids (Global)",
        url: "https://iptv-org.github.io/iptv/categories/kids.m3u",
        category: "Kids",
        priority: 4
    },
    "comedy_global": {
        name: "IPTV-org Comedy (Global)",
        url: "https://iptv-org.github.io/iptv/categories/comedy.m3u",
        category: "Entertainment",
        priority: 4
    },
    "education_global": {
        name: "IPTV-org Education (Global)",
        url: "https://iptv-org.github.io/iptv/categories/education.m3u",
        category: "Documentary",
        priority: 4
    },
    "animation_global": {
        name: "IPTV-org Animation (Global)",
        url: "https://iptv-org.github.io/iptv/categories/animation.m3u",
        category: "Kids",
        priority: 4
    }, 
    
    // APSatTV - Bekende community-bron die gratis FAST-netwerken indexeert
    "lg_channels": {
        name: "LG Channels (Global)",
        url: "https://www.apsattv.com/lg.m3u",
        category: "FAST Channels",
        priority: 3
    },
    "roku_channels": {
        name: "The Roku Channel",
        url: "https://www.apsattv.com/rok.m3u",
        category: "FAST Channels",
        priority: 3
    },
    "xumo_tv": {
        name: "Xumo TV",
        url: "https://www.apsattv.com/xumo.m3u",
        category: "FAST Channels",
        priority: 3
    },

    // Junguler - De grootste geautomatiseerde open-source playlist voor internetradio en muziekzenders
    "global_radio": {
        name: "Junguler Global Radio",
        url: "https://raw.githubusercontent.com/junguler/m3u-radio-music-playlists/main/---everything-lite.m3u",
        category: "Music",
        priority: 5
    },
    // Tundrak - Community-maintained IPTV streams for Italian television
    "iptv_italia": {
        name: "IPTV Italia (Tundrak)",
        url: "https://raw.githubusercontent.com/Tundrak/IPTV-Italia/main/iptvitaplus.m3u",
        category: "Europe",
        priority: 3
    },
    // YanG-1989 - Curated playlist for global sports and television networks
    "yang_gather": {
        name: "YanG Gather (Global)",
        url: "https://raw.githubusercontent.com/YanG-1989/m3u/main/Gather.m3u",
        category: "Global",
        priority: 4
    },
    // Sacuar - Community playlist containing global entertainment, kids, documentary, and regional feeds
    "sacuar_myiptv": {
        name: "MyIPTV Global (Sacuar)",
        url: "https://raw.githubusercontent.com/sacuar/MyIPTV/main/play.m3u",
        category: "Global",
        priority: 4
    }
};
