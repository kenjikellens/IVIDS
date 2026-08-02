# Logic: Content Discovery & API Layer

The API layer (`api.js`) coordinates content discovery via The Movie Database (TMDB), manages network deduplication, and routes media streams through external provider embed pipelines.

---

## 📡 Resilient Network Architecture (`deduplicatedFetch` & Retry)

To ensure zero-latency responses and protect against network drops:

1. **In-Flight Deduplication (`deduplicatedFetch`)**:
   - Maintains an in-memory `Map` (`_inflightRequests`) tracking pending fetch Promises by endpoint URL.
   - Concurrent requests for the same TMDB resource (e.g. initial row population + prefetching) share a single network call.
   - Cleans up request keys using explicit double-handler promises to ensure Android WebView compatibility.

2. **Exponential Backoff (`fetchWithRetry`)**:
   - Retries failed network requests up to 2 times with exponential delays (`500ms * 2^i`).
   - Aborts pending requests after an 8-second threshold via `AbortController` to prevent UI lockups on slow TV connections.

---

## ⏯️ Media Stream Providers & Resolution Pipeline

### 1. Default Player Provider Hierarchy
The application supports a pre-configured provider array managed in `DEFAULT_PLAYER_PROVIDERS`:

| Rank | Provider | Base URL | ID |
|------|----------|----------|----|
| **1 (Default)** | VidLink | `https://vidlink.pro` | `vidlink` |
| **2** | VidSrc.to | `https://vidsrc.to/embed` | `vidsrc_to` |
| **3** | Videasy | `https://player.videasy.net` | `videasy` |
| **4** | VidSrc.cc | `https://vidsrc.cc/v2/embed` | `vidsrc_cc` |

### 2. Auto-Migration Engine
If a user's stored settings contain legacy or decommissioned domains (e.g. `vidsrc.xyz`, `vidsrc.me`), `getPlayerConfig()` automatically migrates playback settings to `vidlink.pro` persistently in `localStorage`.

### 3. Direct Embed & Native Live TV Playback
- **Direct Embed Player**: Embed providers (`VidLink`, `Videasy`, `VidSrc`, etc.) load directly into an `<iframe>` container with 0ms initialization delay.
- **Native Live TV Player**: Live TV streams render natively inside HTML5 `<video>` tags with HLS support.

---

## 🖼️ Intelligent Image Engine

To minimize GPU memory overhead on Smart TVs while delivering crisp poster art:
- **Grid Posters**: Defaults to `w342` for poster rows.
- **Hero Backdrops**: Uses `w1280` for desktop/mobile, but restricts TV backdrops (`Api.isTV()`) to `w780` to prevent out-of-memory crashes.
- **Data Saver Mode**: When Data Saver is active or downlink speed is low (< 1.5 Mbps), images scale down to `w92` posters and `w300` backdrops.

---

*Single Source of Truth v0.4.5*
