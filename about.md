# IVIDS - Comprehensive Technical Manual (v1.0)

> [!CAUTION]
> **Internal Document**: This file contains deep technical specifications for developer reference and AI agent context.

---

## 🏗️ System Pillars & Core Logic

### 1. Bootstrapping & Initialization Flow
The application follows a strict startup sequence to ensure all services are ready before the first pixel is rendered:
1.  **`index.html`**: The browser loads the skeleton. It injects a **Fetch Polyfill** (overriding `window.fetch` with `XMLHttpRequest`) to enable local file loading on Smart TVs where the `file://` protocol restricts standard fetch.
2.  **`app.js`**: The main entry point.
    - **Global Error Protection**: Hooks into `window.onerror` and `onunhandledrejection` to show a recovery modal instead of a white screen on crash.
    - **Settings Recovery**: Reads `localStorage ('ivids-settings')` to apply the user's **Accent Color** (`--primary-color`) and **Language** before the UI appears.
    - **Service Start**: Initializes `ErrorHandler`, `Screensaver`, `Splash`, and `Sidebar`.
    - **Initial Navigation**: Calls `Router.loadPage('home')` to trigger the first render.

### 2. The SPA Router & Lifecycle (`router.js`)
The `Router` doesn't just switch views; it manages a complex lifecycle for every page:
- **`loadPage(name, params)`**:
    1.  **CSS Injection**: Updates the `<link id="page-css">` href to `css/[name].css`.
    2.  **HTML Fetch**: Retrieves the template from `pages/[name].html`.
    3.  **Module Import**: Dynamically imports `pages/[name].js`.
    4.  **Initialization**: Calls the `init(params)` function from the imported module.
    5.  **Spatial Nav Hook**: Attempts to import `logic/spatial-nav/spatial-nav-[name].js` to apply custom directional logic.
    6.  **I18n Application**: Runs `window.i18n.applyTranslations()` to scan the new HTML for `data-i18n` attributes.
- **History Management**: maintains a stack of previous pages and their parameters for the `goBack()` functionality.

### 3. Spatial Navigation Algorithm (`spatial-nav.js`)
Our geometric focus engine replaces standard browser tab-navigation:
- **The "Cone" Algorithm**: When a direction is pressed (e.g., `ArrowDown`), the system calculates a geometric cone originating from the current element.
- **Weighting**: Candidates within the cone are ranked. We apply **weighted distances** (e.g., elements in the same container get a 50% distance "bonus" to make them more likely to be selected).
- **Page Logic Overrides**: Files in `logic/spatial-nav/` can override `findNext`. This is critical for complex grids where you want "Down" to jump specifically to the first item of a row rather than the nearest random element.

---

## 📂 File-by-File Technical Deep Dive

### `/gui/js` (System Services)
- **`app.js`**: Orchestrator for the startup sequence and global error listeners.
- **`router.js`**: SPA engine. Handles asynchronous asset loading (HTML/JS/CSS) and navigation state.
- **`spatial-nav.js`**: Core navigation engine. Implements the `setFocus`, `findNext`, and distance calculation logic.
- **`error-handler.js`**: UI manager for the error modal. Uses `requestAnimationFrame` for high-performance fade-in/out animations.
- **`i18n.js`**: Translation bridge. Scans the DOM for `data-i18n` and replaces `.innerText` or `.placeholder` with strings from the JSON language files.
- **`splash.js`**: Timeline controller for the initial boot animation.
- **`screensaver.js`**: Monitoring script that tracks user input and triggers a dimming effect after periods of inactivity.

### `/gui/pages` (Feature Modules)
- **`home.js`**: Fetches trending/popular content from `Api` and renders multiple horizontal `row-posters`.
- **`search.js`**: Manages complex state for filters (genre array, year string, sort order). Implements a debounced search input.
- **`details.js`**: Parses the `id` from Router params to fetch deep metadata. Manages the "Play" vs "Resume" button logic based on viewing history.
- **`player.js`**: Wraps the `<video>` or `<iframe>` embed. Handles TV-specific playback controls (Fast Forward / Rewind jumps).
- **`playlists.js` / `playlist-details.js`**: Interface for the `logic/playlists.js` service. Handles modal management for creation/deletion.

### `/logic` (Data & Brain)
- **`api.js`**: TMDB Integration layer. Includes `discoverContent` (for search/browse) and `getDetails`.
    - *Key Logic*: `shuffleArray` (Fisher-Yates) is used on all content rows to provide a fresh "discovery" feel on every home visit.
- **`playlists.js`**: A Singleton service managing a JSON array in `localStorage`. Handles deduplication of added items.
- **`recentlyWatched.js`**: Tracks item IDs and timestamps to populate the "Recently Watched" row on the home page.
- **`language-manager.js`**: Low-level JSON fetcher for the translation system.

### `/gui/css` (Design System)
- **`global.css`**: Defines the "Single Source of Truth" for the UI: `--primary-color`.
- **`sidebar.css`**: Uses complex media queries to transform from a fixed sidebar (TV) to a bottom tab-bar (Mobile).
- **`error.css`**: Implements the Responsive Error UI using `mask-image` for icons and portrait-specific `@media` blocks.

### 📐 Design Guidelines & Units
- **Flexible & Adaptive UI**: The UI needs to be **flexible at all times**. We prioritize **TV/Phone First** web development.
- **Flexible Units Policy**: As of v1.1, the UI must **never use `px`** for sizing, spacing, or typography.
- **Preferred Units**:
    - **Spacing/Typography**: Use `vh` (preferred) or `vw` for consistent scaling across screen sizes.
    - **Layout Widths**: Use `%` or `vw` for fluid horizontal flexibility.
    - **Layout Heights**: Use `vh` for viewport-dependent verticality.
- **Goal**: Ensure the interface remains fluid, completely flexible, and perfectly responsive across all TV screen sizes and mobile devices.

---

## 🛠️ Implementation History & Roadmap

### Recent Major Implementation (Q4 2025)
- **Universal Portrait Support**: We manually updated `search.css`, `playlists.css`, and `playlist-details.css` to support a premium vertical orientation for Mobile.
- **SVG Mask Migration**: Moved from inline SVGs to CSS masks for all main navigation and error icons, allowing the app to change the entire UI color by updating a single CSS variable.
- **Global Error Interception**: Added a robust safety net to catch unhandled JS errors and show a user-friendly recovery UI.

### Planned Future Logic
1.  **Cache Pre-fetching**: Logic to download the next page's HTML/JS as soon as a user focuses a link.
2.  **Adaptive Bitrate Detection**: enhancing `player.js` to report network speed and adjust video quality.
3.  **Cross-Device Sync**: A service to sync `localStorage` data with a central cloud profile.
