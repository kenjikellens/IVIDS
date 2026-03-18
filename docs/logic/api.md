# Content API Layer (TMDB & VidSrc)

IVIDS integrates with The Movie Database (TMDB) for metadata and VidSrc for video streaming.

## Configuration
- **TMDB API**: v3 REST endpoint.
- **Images**: `image.tmdb.org/t/p/w1280`
- **Video**: `vidsrc.net/embed/`

## Core Methods (`api.js`)
- `fetchTrending()`: Weekly trending content.
- `getDetails(id, type)`: Metadata, credits, and similar content.
- `getSeasons(id)` / `getEpisodes(id, season)`: TV show structure.
- `discoverContent(filters)`: Advanced filtering by year, genre, and country.

## Discovery Optimization
- **Fisher-Yates Shuffle**: Most rows are randomized on each visit to provide a "discovery" feel.
- **Network Timeouts**: All fetches are wrapped in a 10s timeout to prevent UI hangs on slow TV networks.

## Embed URLs
- **Movie**: `.../embed/movie/{tmdbId}`
- **TV**: `.../embed/tv/{tmdbId}/{season}/{episode}`
