# Data Management & Hybrid Caching

IVIDS manages user configuration, watch history, and API responses through a multi-tier storage architecture designed for zero-latency UI rendering and privacy-first data synchronization.

---

## 🧠 Dual-Layer Caching Strategy (`cacheManager`)

1. **Memory Layer (L1 Cache)**:
   - In-memory `Map` implementing **LRU (Least Recently Used) Eviction**.
   - Capped at 50 items to prevent RAM bloat on TV hardware.
   - Touched keys are re-promoted on every `get()` call to keep active content hot.
2. **Session Storage (L2 Cache)**:
   - Persists TMDB metadata across page navigations in `sessionStorage`.
   - Stores payloads with explicit TTL (Time-To-Live) timestamps (e.g. 15 mins for Trending, 60 mins for Top Rated).
   - Automatically executes `clearExpiredStorage()` when browser quotas are reached.

---

## 🔑 Namespaced LocalStorage Keys

| Key Format | Format | Description |
|------------|--------|-------------|
| `ivids-settings` | JSON Object | Global theme color, language, and player provider configuration. |
| `ivids-cloud-session` | JSON Object | Active user credentials (`pushId`, `username`, `email`). |
| `ivids-current-profile` | JSON Object | Active profile metadata (`id`, `name`, `color`). |
| `ivids-acc-{id}-user_playlists` | JSON Array | Namespaced array of user-created playlists for the account. |
| `ivids-acc-{id}-recently-watched` | JSON Array | Namespaced watch history and playback progress. |
| `ivids-acc-{id}-settings` | JSON Object | Namespaced user preferences and custom accent colors. |
| `ivids-acc-{id}-watch-progress` | JSON Object | Map of episode/movie timestamps and durations. |

---

## 🔒 Security & Client-Side Encryption

- **PBKDF2 Key Derivation**: Derives 256-bit encryption keys from user email and PIN using 100,000 iterations of SHA-256 and a unique salt generated on registration.
- **AES-GCM Payload Encryption**: Encrypts playlists, history, and settings using AES-GCM before syncing to Firebase Realtime Database. The cloud database only stores hex-encoded encrypted binary payloads.

---

*Single Source of Truth v0.4.5*
