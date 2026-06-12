# Logic: Content Discovery & API Layer

The API layer (`api.js`) is the primary interface for content discovery, metadata retrieval, and provider routing. It is built to minimize latency and maximize display quality across heterogeneous hardware.

## 📡 Resilient API Fetching (`fetchWithRetry` & `deduplicatedFetch`)

All TMDB and media requests route through unified helper layers to optimize network efficiency:
- **Exponential Backoff**: `fetchWithRetry` retries failed requests up to 2 times with increasing delays (`500ms * 2^i`) to recover from transient carrier drops.
- **Hard Timeouts**: Requests abort after 8 seconds (via `AbortController`) to prevent lockups on slow TV connections.
- **In-flight Deduplication (`deduplicatedFetch`)**:
  - A file-scope Map (`_inflightRequests`) tracks current, pending request promises keyed by their full URL endpoints.
  - If a duplicate fetch call is initiated concurrently (e.g. while generating multiple movie row feeds or during fast page transitions), the API layer immediately returns the existing promise instead of spawning a new network request.
  - Once resolved or rejected, callbacks automatically clean up the URL key from the map.
- **WebView Compatibility Migration**:
  - Older Android System WebView versions lack robust support for `.finally()` handler chains.
  - To prevent uncaught Promise lockups on these platforms, `deduplicatedFetch` cleans up its cache map using explicit double handlers: `.then(val => { cleanUp(); return val; }, err => { cleanUp(); throw err; })` instead of a `.finally(cleanUp)` block.
- **Static Idempotency**: Results are cached in the global `cacheManager` after successful fetch parsing.


---

## 🖼️ Intelligent Image Engine

To save memory on low-end TVs while providing sharp images on 4K displays, the `Api.getImageUrl()` method uses a **Heuristic Size Selection** system.

### Responsive Constants
- **Grid Poster**: Optimized for row browsing (~342px width).
- **Hero Backdrop**: High resolution (w1280) for hero sections.
- **TV Heuristics**: If TV detection is active (`Api.isTV()`), the engine strictly limits backdrops to `w780` to prevent memory-related crashes on devices with limited RAM.

### Pre-warming
`Api.prefetchImage(path)` allows the app to warm up the CDN connection for the next likely navigation target (e.g., the first item in a trending row as the page loads).

---

## 🕵️ Discovery & Search Filtering

The Discovery engine implements several server-side and client-side filters to ensure content quality:
- **Release Guard**: All results are filtered by date (`release_date <= today`). This prevents "TBA" or placeholder content from cluttering the trending rows.
- **Adult Content Separation**: Discovery (Trending, Genres) is strictly `include_adult=false`. Explicit adult content is only available via the **Search** interface if specifically queried.
- **Regional Logic**: Specialized methods like `fetchKoreanContent()` and `fetchBollywood()` use `with_original_language` to build high-quality regional rows.

---

## ⏯️ Provider Routing & Server Selector

The `getVideoUrl()` method implements a multi-provider and multi-server routing strategy:
- **Default Provider**: Uses VidLink.pro (`https://vidlink.pro`) as the primary default video source.
- **Alternative Servers**: Supports a selection of servers (configured in the `SERVERS` array, e.g., `vidlink` for VidLink and `embed_su` for Embed.su) via the UI playback interface.
- **Auto-Migration Check**: If the user has a legacy player configuration pointing to blocked `vidsrc` domains, the `getPlayerConfig()` loader automatically migrates their settings to `vidlink.pro` persistently in `localStorage`.
- **Deep Linking**: Correctly constructs embed paths and parameters for TV Seasons/Episodes (`/tv/{id}/{season}/{episode}`) vs Movies (`/movie/{id}`).
- **Uniform Playback Parameters**: Appends URL query parameters like `autoplay=true`, `autoPlay=true`, and `ds_lang=en` to ensure instant playback without manual configuration.
