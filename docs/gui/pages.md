# Pages & UI: Screen Inventory

IVIDS is built as a Single Page Application (SPA). Pages are loaded dynamically by the `Router` as pairs of `.html` templates and `.js` controller modules located in `app/src/main/assets/main/gui/pages/`.

This document details all 13 pages, their purpose, key components, and user flows.

---

## 📂 Page Inventory

### 1. Home (`home.html` / `home.js`)
- **Purpose**: The default landing page of the application after startup.
- **Key Features**:
  - Displays a large hero slider displaying high-profile trending titles with primary actions (Play, More Info).
  - Renders horizontal browsing rows containing categories: Trending, Highly Rated, Netflix Originals, Marvel, Disney, and Korean Content.
  - Integration with spatial navigation to navigate rows and elements smoothly via TV D-pad or keyboard arrow keys.

### 2. Movies (`movies.html` / `movies.js`)
- **Purpose**: A dedicated workspace to discover and filter movie content.
- **Key Features**:
  - Showcases movie-only trending titles.
  - Horizontal browsing rows grouped by genres (Action, Adventure, Animation, Comedy, Crime, Sci-Fi, etc.).
  - Header search access and standard categorization.

### 3. Series (`series.html` / `series.js`)
- **Purpose**: A dedicated workspace to browse and discover TV shows.
- **Key Features**:
  - Shows TV show-only trending and popular sections.
  - Rows categorized by television genres (Drama, Mystery, Reality, Sci-Fi & Fantasy, Soap, etc.).
  - Standard layout consistency matching the Movies page.

### 4. Live TV (`livetv.html` / `livetv.js`)
- **Purpose**: Live IPTV channel browser and guide interface.
- **Key Features**:
  - Parses `.m3u` IPTV playlists and displays channels by categories.
  - Supports search, group selection, favorites management, and channel logo image rendering.
  - Embedded TV stream controller using native video frameworks.

### 5. Search (`search.html` / `search.js`)
- **Purpose**: General text search interface.
- **Key Features**:
  - Real-time TMDB query execution as the user types (with debouncing).
  - Explicit adult content filtering: `include_adult` is set to `false` in normal discovery rows, but adult search queries are allowed to return results here.
  - Visual grid of results.

### 6. Playlists (`playlists.html` / `playlists.js`)
- **Purpose**: Interface for accessing custom content groupings.
- **Key Features**:
  - Lists all user-created playlists stored in `user_playlists`.
  - Displays the virtual **Recently Watched / Watch History** system playlist synthesized at runtime.
  - Options to create new playlists.

### 7. Playlist Details (`playlist-details.html` / `playlist-details.js`)
- **Purpose**: Detailed overview and curation interface for a specific playlist.
- **Key Features**:
  - Displays list of movies/shows added to the playlist.
  - Interactive controls to delete items, rename the playlist, or delete the entire playlist.
  - Handles empty states gracefully.

### 8. Details (`details.html` / `details.js`)
- **Purpose**: Complete overview page for a specific movie or series.
- **Key Features**:
  - Renders large backdrop poster, title, plot description, ratings, certifications (PG-13, R, etc.), and duration.
  - For TV Series: Renders season dropdowns and dynamic lists of episodes.
  - Renders recommendations list.
  - Play button linking directly to the streaming player, and "+" action button to add/remove from playlists.

### 9. Player (`player.html` / `player.js`)
- **Purpose**: High-performance streaming interface for movies and episodes.
- **Key Features**:
  - Embeds the third-party provider inside a sandboxed `<iframe>`.
  - Server selector popup overlay allowing users to change playback sources (e.g. VidLink, Videasy, VidSrc.cc) dynamically.
  - Progress tracking: Stores current timestamp in `recentlyWatched` to resume playback.
  - Overlays with TV-friendly back/close buttons.

### 10. TV Player (`tv-player.html` / `tv-player.js`)
- **Purpose**: High-performance HLS/M3U8 player for Live TV streams.
- **Key Features**:
  - Integrates with Hls.js for adaptive streaming.
  - Custom controller overlay (Play/Pause, volume, channel switcher, aspect ratio).
  - Auto-retries streams on network dropped frames.

### 11. Settings (`settings.html` / `settings.js`)
- **Purpose**: Configuration hub for custom preferences and updates.
- **Key Features**:
  - Theme color selection (modifies `--primary-color`).
  - Language selection (scans i18n modules).
  - Custom stream provider config (URLs, order, custom lists).
  - IPTV M3U Playlist management (add, edit, remove).
  - Update center: Manual check trigger and native Android APK installer bridge hook.

### 12. Account (`account.html` / `account.js`)
- **Purpose**: Profile and session control center.
- **Key Features**:
  - Displays current active profile info (name, custom avatar color).
  - Quick action to sign out (resets session) or switch profiles (navigates to profiles screen).
  - List of account preferences.

### 13. Profiles (`profiles.html` / `profiles.js`)
- **Purpose**: Multi-user profile management panel.
- **Key Features**:
  - Displays grid of up to 5 profiles, including the permanent hardcoded "Guest" profile.
  - Interactive modal dialogs for:
    - Creating a new profile (name, custom color selection).
    - Editing an existing profile.
    - PIN code entry validation.
  - Drag-and-drop / long-press interface to reorder profiles.

---

## 👥 Profile & Account Systems Flow

The profiles system isolates preferences and custom configurations locally:
1. **Boot routing**: App boots directly to `home` page in a default state. Users can access `profiles` via `account` inside the sidebar.
2. **Guest Profile**: Hardcoded default profile. Always present, position saved in `ivids-guest-pos`.
3. **PIN Verification**: Users can set a 4-digit PIN for custom profiles. Verification matches user input against the plaintext value stored under the profile object inside `ivids-profiles`.
4. **Data Isolation**: Switching profiles updates the active profile in `ivids-current-profile`. User playlists (`user_playlists`) are segmented by profile ID to keep contents isolated.
