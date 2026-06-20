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

Primary user state is managed in `LocalStorage` with the following namespaced keys:

| Key | Format | Description |
|-----|--------|-------------|
| `ivids-settings` | JSON Object | Global theme colors, language, and player provider. |
| `ivids-cloud-session` | JSON Object | Logged in user session credentials `{ pushId, username, email }`. |
| `ivids-current-profile` | JSON Object | The active profile details for the session `{ id, name, color }`. |
| `ivids-acc-{id}-user_playlists` | JSON Array | Namespaced array of user-created playlists for the active account. |
| `ivids-acc-{id}-recently-watched` | JSON Array | Namespaced recently watched items with progress for the active account. |
| `ivids-acc-{id}-settings` | JSON Object | Namespaced preferences (like custom accent colors) for the active account. |
| `ivids-acc-{id}-watch-progress` | JSON Object | Namespaced map of watch positions and durations. |

---

## 📂 Virtual & Dynamic Playlists

While user-created playlists are stored in namespaced key storage, the **Recently Watched / Watch History** list is synthesized dynamically at runtime. It functions as a virtual/system playlist:
- Read directly from the `ivids-acc-{id}-recently-watched` (or anonymous fallback) localStorage array.
- Presented seamlessly alongside user-created playlists in the Playlists UI.
- Updates automatically whenever media playback starts or progresses.

---

## 🔒 Security & Data Encryption

- **Cloud Authentication & Encryption**: User accounts are registered and authenticated via a Firebase Realtime Database.
- **Client-Side PBKDF2 & AES-GCM**: To secure user data, credentials and profile info are encrypted on the client side:
  - Cryptographic keys are derived from the email and PIN using PBKDF2 (100,000 iterations, SHA-256) and a unique salt generated on registration.
  - Data payload (including playlists, settings, history) is encrypted using AES-GCM (256-bit) before syncing to Firebase.
  - The database only sees encrypted binary payloads (hex-encoded), ensuring absolute privacy.
- **Isolation**: When switching accounts, namespaced local keys (e.g., `ivids-acc-{id}-*`) segment playlists and watch history per account.

