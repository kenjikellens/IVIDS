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
| `ivids-profiles` | JSON Array | Array of user profile objects with plaintext PINs. |
| `ivids-current-profile` | ID | The active profile for the session. |
| `recentlyWatched` | JSON Array | List of recently watched items with progress. |
| `user_playlists` | JSON Object | Map of user-created playlists by profile ID. |
| `ivids-guest-pos` | Number | Left/X coordinate position of the default Guest profile icon in settings/profiles screen layout. |
| `ivids-last-route` | JSON Object | Page and params of the last active route (cleared on fresh startup to ensure clean boots). |
| `ivids-last-active` | Number | Timestamp of the last visibility state change when the app went to background. |

---

## 📂 Virtual & Dynamic Playlists

While user-created playlists are stored in `user_playlists`, the **Recently Watched / Watch History** list is synthesized dynamically at runtime. It functions as a virtual/system playlist:
- Read directly from the `recentlyWatched` localStorage array.
- Presented seamlessly alongside user-created playlists in the Playlists UI.
- Updates automatically whenever media playback starts or progresses.

---

## 🔒 Security & Profile Isolation

- **PIN Protection**: Profile PINs are stored locally (not on a server). In the current implementation (v0.4.3), they are stored as **plaintext** within the `ivids-profiles` JSON array. There is no hashing or encryption applied.
- **Isolation**: When switching profiles, the user playlists and recently watched entries are loaded dynamically based on the active profile ID, preventing cross-contamination between family members.

