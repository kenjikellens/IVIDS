# Data Management & Hybrid Caching

IVIDS manages user data and API responses through a multi-tier storage strategy designed for "Zero-Latency" feel and persistence.

## 🧠 Hybrid Caching System (`cacheManager`)

To avoid redundant TMDB API calls, the app uses a dual-layer caching strategy:

1.  **Memory Layer (L1)**: An in-memory `Map` with **LRU (Least Recently Used) Eviction**. 
    - Capped at 50 items to prevent memory bloat.
    - Refreshing the position in the Map occurs on every `get()` to ensure hot data remains active.
2.  **Session Layer (L2)**: `SessionStorage` is used to persist data across page refreshes (common on TV browsers).
    - Data is stored as JSON with an `expiry` timestamp.
    - If the browser quota is hit, the `clearExpiredStorage()` method is triggered.

### TTL (Time-To-Live) Policies
- **Trending**: 15 minutes.
- **Search Results**: 10 minutes.
- **Top Rated**: 60 minutes (statically updated).

---

## 👤 User Data Persistence

Primary user state is managed in `LocalStorage` with the following keys:

| Key | Format | Description |
|-----|--------|-------------|
| `ivids-settings` | JSON Object | Theme colors, language, and player provider. |
| `ivids-profiles` | JSON Array | Array of user profile objects with encrypted PINs. |
| `ivids-current-profile` | ID | The active profile for the session. |
| `ivids-watch-history` | JSON Array | List of recently watched items with progress. |
| `ivids-playlists` | JSON Object | Map of user-created playlists by profile ID. |

---

## 🔒 Security & Profile Isolation

- **PIN Protection**: Profile PINs are stored locally (not on a server).
- **Isolation**: When switching profiles, the `playlists` and `recentlyWatched` caches are purged and reloaded to prevent cross-contamination between family members.
