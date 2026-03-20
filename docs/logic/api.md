# Logic: Content Discovery & API Layer

The API layer (`api.js`) is the primary interface for content discovery, metadata retrieval, and provider routing. It is built to minimize latency and maximize display quality across heterogeneous hardware.

## 📡 Resilient API Fetching (`fetchWithRetry`)

All TMDB requests go through an intelligent fetch wrapper that implements:
- **Exponential Backoff**: Retries with increasing delays (`500ms * 2^i`) to recover from transient carrier drops.
- **Hard Timeouts**: Requests are aborted after 8 seconds (via `AbortController`) to avoid blocking the UI.
- **Idempotency**: Requests for static metadata (Top Rated, etc.) are automatically cached after the first successful response.

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

## ⏯️ Provider Routing

The `getVideoUrl()` method implements a multi-provider strategy:
- **Preferred Provider**: Respects the user setting (`VidSrc` vs `VidKing`).
- **Deep Linking**: Correctly constructs embed parameters for Seasons/Episodes vs Movies.
- **Uniform API**: Regardless of provider, `autoplay=true` and `ds_lang=en` are appended to ensure an instant play experience.
