# IVIDS — Comprehensive Technical Architecture Manual (v2.0)

> [!CAUTION]
> **Internal Document**: This file contains deep technical specifications for developer reference and AI agent context. It serves as the single source of truth for understanding the IVIDS application architecture.

---

## 📋 Table of Contents

1. [Project Overview](#-project-overview)
2. [System Architecture](#-system-architecture)
3. [Bootstrapping & Initialization](#-bootstrapping--initialization-flow)
4. [The SPA Router & Page Lifecycle](#-the-spa-router--page-lifecycle)
5. [Spatial Navigation System](#-spatial-navigation-system)
6. [Internationalization (i18n)](#-internationalization-i18n-system)
7. [Content API Layer](#-content-api-layer-tmdb-integration)
8. [User Data Management](#-user-data-management)
9. [File-by-File Technical Reference](#-file-by-file-technical-reference)
10. [Performance & Optimization](#-performance--optimization)
11. [Design System & CSS Architecture](#-design-system--css-architecture)
12. [AI Agent Implementation Standards](#-ai-agent-implementation-standards)
13. [Implementation History & Roadmap](#-implementation-history--roadmap)
14. [Quick Reference Cheat Sheet](#-quick-reference-cheat-sheet)

---

## 🎯 Project Overview

### What is IVIDS?
**IVIDS** (Intelligent Video Discovery System) is a premium entertainment hub application designed for **Smart TVs** and **mobile devices**. It provides a Netflix-like streaming interface that:

- Aggregates content from **The Movie Database (TMDB)** API
- Streams via **VidSrc** embedding services
- Runs natively on **Samsung Tizen**, **LG webOS**, **Android TV**, and **mobile browsers**
- Uses a **Single Page Application (SPA)** architecture for seamless navigation

### Target Platforms
| Platform | Runtime | Special Considerations |
|----------|---------|----------------------|
| Samsung Tizen | Tizen Web App | Uses `$WEBAPIS` for TV-specific APIs |
| Android TV | WebView | Requires `XMLHttpRequest` polyfill for `file://` |
| LG webOS | Web App | Standard browser APIs |
| Mobile Browsers | Chrome/Safari | Portrait mode with bottom navigation |
| Desktop Browsers | Any modern browser | Full keyboard navigation support |

### Technology Stack
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+ Modules)
- **No Build Tools**: Direct file loading — no bundlers, transpilers, or npm dependencies
- **API Integration**: TMDB v3 REST API
- **Video Playback**: VidSrc iframe embeds
- **Storage**: `localStorage` for settings, profiles, playlists, and watch history

---

## 🏗️ System Architecture

### High-Level Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                         index.html                               │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐   │
│  │   Sidebar       │  │           Main View                  │   │
│  │  (Navigation)   │  │  ┌─────────────────────────────────┐ │   │
│  │                 │  │  │     Page Content (Dynamic)      │ │   │
│  │  • Home         │  │  │                                 │ │   │
│  │  • Movies       │  │  │  home.html / movies.html /      │ │   │
│  │  • Series       │  │  │  search.html / details.html     │ │   │
│  │  • Search       │  │  │                                 │ │   │
│  │  • Playlists    │  │  └─────────────────────────────────┘ │   │
│  │  • Settings     │  │                                      │   │
│  │  • Account      │  │  Controlled by Router.loadPage()     │   │
│  └─────────────────┘  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼────────────────────────────┐
        ▼                           ▼                            ▼
┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
│  Spatial Nav  │         │    Router.js     │         │   i18n.js    │
│  (Focus Mgmt) │         │  (Page Loading)  │         │ (Translations)│
└──────────────┘         └──────────────────┘         └──────────────┘
        │                           │                            │
        └───────────────────────────┼────────────────────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
           ┌─────────────────┐           ┌─────────────────┐
           │    Logic Layer   │           │   CSS System    │
           │                  │           │                 │
           │  • api.js        │           │  • global.css   │
           │  • playlists.js  │           │  • [page].css   │
           │  • recentlyWatched│          │  • components   │
           └─────────────────┘           └─────────────────┘
```

### Core Module Dependencies
```
app.js (Entry Point)
    ├── router.js (SPA Navigation)
    │   ├── spatial-nav.js (Focus Management)
    │   └── loader.js (Loading Indicators)
    ├── i18n.js (Internationalization)
    ├── error-handler.js (Error Recovery UI)
    ├── screensaver.js (Idle Detection)
    ├── splash.js (Boot Animation)
    └── components/sidebar/sidebar.js (Navigation Bar)
```

---

## 🚀 Bootstrapping & Initialization Flow

The application follows a **strict 6-phase startup sequence** to ensure all services are ready before user interaction:

### Phase 1: HTML Shell Loading
```html
<!-- index.html loads the skeleton structure -->
<body>
    <div id="splash-screen">...</div>     <!-- Boot animation -->
    <div id="exit-modal">...</div>        <!-- Exit confirmation -->
    <div id="app">
        <div id="sidebar-container"></div> <!-- Dynamic nav -->
        <div id="main-view"></div>         <!-- Page content -->
    </div>
</body>
```

### Phase 2: Fetch Polyfill Injection
**Critical for Android TV / file:// protocol compatibility:**
```javascript
// Overrides window.fetch for local file loading
window.fetch = function(url, options) {
    if (url.startsWith('lang/') || url.startsWith('pages/') || url.startsWith('components/')) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = () => resolve({
                ok: true,
                json: () => Promise.resolve(JSON.parse(xhr.responseText)),
                text: () => Promise.resolve(xhr.responseText)
            });
            xhr.onerror = () => reject(new Error('Local fetch failed'));
            xhr.open('GET', url);
            xhr.send();
        });
    }
    return originalFetch(url, options);
};
```
**Why?** Smart TVs loading via `file://` protocol cannot use standard `fetch()` for local files due to CORS restrictions. This polyfill intercepts local requests and uses `XMLHttpRequest` instead.

### Phase 3: Global Error Protection
```javascript
window.onerror = (message, source, lineno, colno, error) => {
    ErrorHandler.show({ message, source, lineno, colno, error });
    return true; // Prevents white screen of death
};

window.onunhandledrejection = (event) => {
    ErrorHandler.show({ message: event.reason });
};
```
**Purpose:** Catches all uncaught exceptions and Promise rejections, displaying a user-friendly recovery UI instead of a blank screen.

### Phase 4: Settings Recovery
```javascript
function loadSettings() {
    const saved = localStorage.getItem('ivids-settings');
    if (saved) {
        const settings = JSON.parse(saved);
        // Apply accent color before first render
        document.documentElement.style.setProperty('--primary-color', settings.accentColor);
        document.documentElement.style.setProperty('--primary-rgb', hexToRgb(settings.accentColor));
        // Set language for i18n
        window.i18n.currentLanguage = settings.language;
    }
}
```
**Key Insight:** Settings are loaded BEFORE any UI renders to prevent visual "flash" of default colors.

### Phase 5: Service Initialization
```javascript
async function initServices() {
    await ErrorHandler.init();
    await Screensaver.init();
    await Splash.init();
    await Sidebar.init();
}
```

### Phase 6: Initial Navigation
```javascript
// Check for profile-lock requirement
const profiles = localStorage.getItem('ivids-profiles');
if (profiles && JSON.parse(profiles).length > 0) {
    Router.loadPage('profiles');
} else {
    Router.loadPage('home');
}
```

---

## 🔀 The SPA Router & Page Lifecycle

### Router Architecture
The Router (`router.js`) is the heart of IVIDS navigation. It manages a complete lifecycle for every page transition:

```javascript
export const Router = {
    currentPage: null,     // Current page name (e.g., 'home', 'search')
    params: {},            // Parameters passed to the page (e.g., { id: 123 })
    history: [],           // Stack of previous pages for back navigation
    isLoading: false       // Prevents double-loading during transitions
};
```

### Page Loading Sequence (7 Steps)

```
Router.loadPage('details', { id: 12345, type: 'movie' })
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ Step 1: HISTORY MANAGEMENT                                        │
│   - Push current page to history stack                           │
│   - Store: { page: 'home', params: {} }                          │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ Step 2: CSS INJECTION                                             │
│   - Update <link id="page-css"> href to css/details.css          │
│   - Cache-bust with timestamp: css/details.css?t=1703412345678   │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ Step 3: HTML FETCH (with 10s timeout)                             │
│   - Fetch pages/details.html                                     │
│   - Race against timeout promise to prevent infinite loading     │
│   - Replace #main-view innerHTML with fetched HTML               │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ Step 4: MODULE IMPORT                                             │
│   - Dynamic import: import('../pages/details.js')                │
│   - Call module.init({ id: 12345, type: 'movie' })               │
│   - Page JS can fetch data, render content, bind events          │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ Step 5: SPATIAL NAV LOGIC                                         │
│   - Try import: logic/spatial-nav/spatial-nav-details.js         │
│   - If exists, call SpatialNav.setPageLogic(module)              │
│   - Enables custom focus behavior for complex UIs                │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ Step 6: I18N APPLICATION                                          │
│   - Call window.i18n.applyTranslations()                         │
│   - Scans DOM for [data-i18n] attributes                         │
│   - Replaces textContent/placeholder with translations           │
└──────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│ Step 7: FOCUS RESET                                               │
│   - Update sidebar active state                                   │
│   - Call SpatialNav.focusFirst() to set initial focus            │
│   - Save route to localStorage for session persistence           │
└──────────────────────────────────────────────────────────────────┘
```

### History & Back Navigation
```javascript
// Going back
Router.goBack() {
    if (this.history.length > 0) {
        const lastPage = this.history.pop();
        this.loadPage(lastPage.page, lastPage.params, false); // Don't add to history
    }
}
```

### Route Persistence
```javascript
// Saved after every navigation (except profiles page)
localStorage.setItem('ivids-last-route', JSON.stringify({
    page: 'details',
    params: { id: 12345, type: 'movie' }
}));
```

---

## 🎮 Spatial Navigation System

### The Problem
TV remotes have only 4 directional buttons + Enter/Back. Standard browser tab-navigation (Tab/Shift+Tab) is linear and doesn't understand 2D layouts like content grids.

### The Solution: Geometric Focus Engine
IVIDS implements a custom **cone-based spatial navigation algorithm** that calculates the nearest focusable element in any direction.

### Core Algorithm (`findNext` function)

```javascript
findNext(current, direction) {
    // 1. Get bounding rectangle and center point of current element
    const rect = current.getBoundingClientRect();
    const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };

    // 2. Filter all .focusable elements that are visible
    const candidates = Array.from(document.querySelectorAll('.focusable'))
        .filter(el => el !== current && this.isVisible(el));

    // 3. For each candidate, calculate if it's in the right direction
    candidates.forEach(el => {
        const elCenter = { x: ..., y: ... };
        const dx = elCenter.x - center.x;
        const dy = elCenter.y - center.y;

        // Direction check
        switch (direction) {
            case 'left':  if (dx < -1) isPossible = true; break;
            case 'right': if (dx > 1)  isPossible = true; break;
            case 'up':    if (dy < -1) isPossible = true; break;
            case 'down':  if (dy > 1)  isPossible = true; break;
        }

        // 4. Score candidates using weighted distance
        // Lower score = better candidate
        const mainDist = direction === 'left' || direction === 'right' ? |dx| : |dy|;
        const crossDist = direction === 'left' || direction === 'right' ? |dy| : |dx|;
        
        // Cross-axis penalty prevents diagonal jumps
        const crossPenalty = (direction === 'up' || direction === 'down') ? 2.5 : 4;
        const score = (mainDist²) + (crossDist² × crossPenalty);
    });

    // 5. Return candidate with lowest score
    return best;
}
```

### Visual Representation: The Scoring Algorithm
```
                        UP DIRECTION
                            │
                      ┌─────┴─────┐
                      │   best    │  ← Low score: directly above
                      │  choice   │
                      └───────────┘
                            │
    ┌───────────┐           │           ┌───────────┐
    │  ignored  │ ← High    │    High → │  ignored  │
    │ (penalty) │  cross    │   cross   │ (penalty) │
    └───────────┘  dist     │   dist    └───────────┘
                            │
                      ┌─────┴─────┐
                      │  CURRENT  │
                      │  ELEMENT  │
                      └───────────┘
```

### Focus Trap System
For modals and overlays, IVIDS uses a "focus trap" that restricts navigation to a container:

```javascript
// When opening a modal
SpatialNav.setFocusTrap(document.querySelector('.modal-content'));

// Navigation is now restricted to elements inside .modal-content

// When closing modal
SpatialNav.clearFocusTrap();
```

### Sidebar/Main View Isolation
To prevent accidental jumps between sidebar and content:
```javascript
// Up/Down navigation respects containers
if (direction === 'up' || direction === 'down') {
    if (mainView.contains(current)) {
        searchScope = mainView; // Only search in main content
    } else if (sidebar.contains(current)) {
        searchScope = sidebar; // Only search in sidebar
    }
}
```

### Override System (Page-Specific Logic)
Complex pages can override the default algorithm via `logic/spatial-nav/spatial-nav-[page].js`:

```javascript
// Example: spatial-nav-search.js
export const spatialNavSearch = {
    findNext(current, direction, defaultFn) {
        // Custom logic for search grid
        if (current.classList.contains('poster-wrapper') && direction === 'down') {
            // Jump to first item in next row, not nearest element
            return getNextRowFirstItem(current);
        }
        return defaultFn(current, direction);
    },
    
    getDefaultFocus() {
        return document.querySelector('#search-input');
    }
};
```

### Key Bindings Map
```javascript
const KEY_MAP = {
    ArrowLeft: 37,  Left: 37,
    ArrowUp: 38,    Up: 38,
    ArrowRight: 39, Right: 39,
    ArrowDown: 40,  Down: 40,
    Enter: 13,
    Escape: 27,
    Backspace: 8,
    Back: 10009,      // Samsung Tizen back button
    AndroidBack: 4    // Android TV back button
};
```

### Input Field Handling
TV keyboards require special handling:
```javascript
// On Enter while focused on input:
if (current.tagName === 'INPUT') {
    if (current.readOnly) {
        // First Enter: Enable editing
        current.readOnly = false;
        current.classList.add('active-typing');
    } else {
        // Second Enter: Confirm and lock input
        current.readOnly = true;
        current.classList.remove('active-typing');
        current.dispatchEvent(new Event('change'));
    }
}
```

---

## 🌍 Internationalization (i18n) System

### Supported Languages
| Code | Language | File |
|------|----------|------|
| `en` | English | `lang/en.json` |
| `es` | Español | `lang/es.json` |
| `fr` | Français | `lang/fr.json` |
| `de` | Deutsch | `lang/de.json` |
| `nl` | Nederlands | `lang/nl.json` |

### Translation File Structure
```json
{
    "app": {
        "name": "IVIDS",
        "tagline": "Your entertainment hub"
    },
    "nav": {
        "home": "Home",
        "movies": "Movies",
        "series": "Series",
        "search": "Search"
    },
    "search": {
        "placeholder": "Search for movies or series...",
        "noResults": "No results found"
    }
}
```

### HTML Usage
```html
<!-- Text content -->
<h1 data-i18n="app.name">IVIDS</h1>

<!-- Input placeholders -->
<input data-i18n="search.placeholder" placeholder="Search...">
```

### JavaScript Usage
```javascript
// Get translated string
const text = window.i18n.t('search.noResults');
// Returns: "No results found" (or translated equivalent)

// Alternative
const text = window.i18n.getTranslation('nav.home');
```

### Translation Application Process
```javascript
applyTranslations() {
    // Find all elements with [data-i18n]
    const elements = document.querySelectorAll('[data-i18n]');
    
    elements.forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = this.getTranslation(key);
        
        if (translation) {
            if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
                element.placeholder = translation;
            } else {
                element.textContent = translation;
            }
        }
    });
}
```

### Nested Key Resolution
```javascript
// Key: "search.filters.year"
getTranslation(key) {
    const keys = key.split('.'); // ['search', 'filters', 'year']
    let value = this.translations;
    
    for (const k of keys) {
        value = value[k]; // Traverse the object tree
    }
    
    return value;
}
```

---

## 🎬 Content API Layer (TMDB Integration)

### API Configuration
```javascript
const API_KEY = 'a341dc9a3c2dffa62668b614a98c1188';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w1280';
const VIDSRC_BASE_URL = 'https://vidsrc.net/embed';
```

### Core API Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `Api.fetchTrending()` | Current trending content | Movie/TV array |
| `Api.fetchTopRated()` | Highest rated of all time | Movie/TV array |
| `Api.fetchHighlyRated()` | 8.0+ rating filter | Movie array |
| `Api.fetchNewThisYear()` | Released this year | Movie/TV array |
| `Api.getDetails(id, type)` | Full media details | Detail object |
| `Api.getSeasons(id)` | TV show seasons | Season array |
| `Api.getEpisodes(id, season)` | Episodes in season | Episode array |
| `Api.discoverContent(filters)` | Advanced search | Filtered results |

### Genre-Based Fetches
```javascript
// Movies by genre
Api.fetchActionMovies()      // Genre ID: 28
Api.fetchComedyMovies()      // Genre ID: 35
Api.fetchHorrorMovies()      // Genre ID: 27
Api.fetchSciFiMovies()       // Genre ID: 878
Api.fetchThrillerMovies()    // Genre ID: 53
Api.fetchRomanceMovies()     // Genre ID: 10749
Api.fetchAnimationMovies()   // Genre ID: 16
// ... and more

// Series by genre
Api.fetchActionAdventureSeries()  // Genre ID: 10759
Api.fetchComedySeries()           // Genre ID: 35
Api.fetchDramaSeries()            // Genre ID: 18
Api.fetchAnimationSeries()        // Genre ID: 16
// ... and more
```

### Studio/Network Fetches
```javascript
Api.fetchDisneyMovies()      // Company ID: 2 (Walt Disney Pictures)
Api.fetchMarvelMovies()      // Company ID: 420 (Marvel Studios)
Api.fetchPixarMovies()       // Company ID: 3 (Pixar)
Api.fetchStudioGhibli()      // Company ID: 10342 (Studio Ghibli)
Api.fetchNetflixOriginals()  // Network ID: 213 (Netflix)
```

### Regional Content
```javascript
Api.fetchKoreanContent()     // Region: KR
Api.fetchBollywood()         // Region: IN, Language: hi
```

### The Fisher-Yates Shuffle
```javascript
// Every home page visit shows content in random order
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
```
**Purpose:** Provides a fresh "discovery" experience on each visit.

### Network Timeout Handling
```javascript
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 10000 } = options;
    
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal
        });
        return response;
    } finally {
        clearTimeout(id);
    }
}
```

### Video Playback URLs
```javascript
// Movie playback
const movieUrl = `${VIDSRC_BASE_URL}/movie/${tmdbId}`;
// => https://vidsrc.net/embed/movie/12345

// TV Episode playback
const episodeUrl = `${VIDSRC_BASE_URL}/tv/${tmdbId}/${season}/${episode}`;
// => https://vidsrc.net/embed/tv/12345/1/1
```

---

## 💾 User Data Management

### localStorage Keys

| Key | Purpose | Structure |
|-----|---------|-----------|
| `ivids-settings` | User preferences | `{ accentColor, language }` |
| `ivids-profiles` | User profiles | `[{ id, name, color, pin }]` |
| `ivids-active-profile` | Current profile | `{ id, name, color }` |
| `ivids-playlists` | Custom playlists | `[{ id, name, items: [] }]` |
| `ivids-recently-watched` | Watch history | `[{ id, type, timestamp }]` |
| `ivids-last-route` | Session persistence | `{ page, params }` |
| `ivids-watch-progress-{id}` | Resume position | `{ currentTime, duration }` |

### Settings Object Structure
```javascript
{
    accentColor: '#46d369',  // Hex color
    language: 'en'           // Language code
}
```

### Profile Object Structure
```javascript
{
    id: 'profile_1703412345678',
    name: 'John',
    color: '#e50914',
    pin: '1234'  // Optional, for parental controls
}
```

### Playlist Object Structure
```javascript
{
    id: 'playlist_1703412345678',
    name: 'My Favorites',
    items: [
        { id: 12345, type: 'movie', title: 'Movie Name', posterPath: '/path.jpg' },
        { id: 67890, type: 'tv', title: 'Series Name', posterPath: '/path2.jpg' }
    ]
}
```

### Recently Watched Entry
```javascript
{
    id: 12345,
    type: 'movie',          // or 'tv'
    title: 'Content Title',
    posterPath: '/poster.jpg',
    timestamp: 1703412345678,
    // For TV shows:
    season: 1,
    episode: 5,
    episodeName: 'Episode Title'
}
```

### Playlists Service API
```javascript
import { PlaylistService } from '../logic/playlists.js';

// Get all playlists
const playlists = PlaylistService.getAll();

// Create new playlist
const newPlaylist = PlaylistService.create('My Watchlist');

// Add item (with deduplication)
const success = PlaylistService.addItem(playlistId, {
    id: 12345,
    type: 'movie',
    title: 'Inception',
    posterPath: '/inception.jpg'
});

// Remove item
PlaylistService.removeItem(playlistId, itemId);

// Delete playlist
PlaylistService.delete(playlistId);
```

---

## 📂 File-by-File Technical Reference

### `/gui/js` — Core System Services

| File | Purpose | Key Exports |
|------|---------|-------------|
| **`app.js`** | Application bootstrapper | `loadSettings()`, `initServices()`, `initNavigation()` |
| **`router.js`** | SPA page loader | `Router.loadPage()`, `Router.goBack()` |
| **`spatial-nav.js`** | D-pad navigation | `SpatialNav.init()`, `SpatialNav.setFocus()`, `SpatialNav.findNext()` |
| **`i18n.js`** | Translation system | `window.i18n.t()`, `window.i18n.applyTranslations()` |
| **`error-handler.js`** | Crash recovery UI | `ErrorHandler.show()`, `ErrorHandler.hide()` |
| **`screensaver.js`** | Inactivity detector | `Screensaver.init()`, `Screensaver.reset()` |
| **`splash.js`** | Boot animation | `Splash.init()`, `Splash.hide()` |
| **`toast.js`** | Notification system | `Toast.show()`, `Toast.hide()` |
| **`loader.js`** | Loading indicators | `getLoaderHtml()` |
| **`hero-slider.js`** | Hero image carousel | `HeroSlider.init()`, `HeroSlider.next()` |
| **`lazy-loader.js`** | Image lazy loading | `LazyLoader.observe()` |
| **`dom-recycler.js`** | DOM memory optimization | `DomRecycler.observe()` |
| **`skeleton-renderer.js`** | Skeleton placeholders | `renderSkeletons()` |
| **`debounce.js`** | Input search optimization | `debounce()` |

### `/gui/pages` — Feature Modules

| File | Route | Features |
|------|-------|----------|
| **`home.js/html`** | `/home` | Hero slider, trending rows, genre rows, recently watched |
| **`movies.js/html`** | `/movies` | Movie-specific browsing with filter strips |
| **`series.js/html`** | `/series` | TV-specific browsing with genre categories |
| **`search.js/html`** | `/search` | Full-text search, advanced filters (genre, year, country, rating) |
| **`details.js/html`** | `/details` | Content metadata, season/episode picker, playlist add, play/resume |
| **`player.js/html`** | `/player` | VidSrc iframe embed, next episode logic, resume tracking |
| **`playlists.js/html`** | `/playlists` | Playlist grid, create/delete modals |
| **`playlist-details.js/html`** | `/playlist-details` | Playlist content view, item removal, "Play All" |
| **`settings.js/html`** | `/settings` | Accent color picker, language selector |
| **`profiles.js/html`** | `/profiles` | Profile selection, PIN entry, profile CRUD |
| **`account.js/html`** | `/account` | Current profile info, profile switching |

### `/logic` — Business Logic

| File | Purpose |
|------|---------|
| **`api.js`** | TMDB API wrapper with all fetch methods |
| **`playlists.js`** | Playlist CRUD operations with localStorage |
| **`recentlyWatched.js`** | Watch history tracking |
| **`cache-manager.js`** | Hybrid (Mem+Storage) API response caching |
| **`language-manager.js`** | Translation file loading utilities |

### `/logic/spatial-nav` — Page-Specific Navigation

| File | Overrides For |
|------|---------------|
| `spatial-nav-home.js` | Hero + rows grid navigation |
| `spatial-nav-search.js` | Search input + filter + results grid |
| `spatial-nav-details.js` | Episode list navigation |
| `spatial-nav-settings.js` | Settings form navigation |
| `spatial-nav-playlists.js` | Playlist grid |
| `spatial-nav-playlist-details.js` | Playlist item navigation |
| `spatial-nav-profiles.js` | Profile grid + modals |

### `/gui/components` — Reusable Components

| Directory | Contents |
|-----------|----------|
| `sidebar/` | `sidebar.html`, `sidebar.js`, `sidebar.css` |

### `/gui/css` — Stylesheets

| File | Scope |
|------|-------|
| **`global.css`** | CSS variables, reset, common buttons, posters, modals |
| **`splash.css`** | Boot animation styles |
| **`toast.css`** | Notification toast styles |
| **`loader.css`** | Loading spinner animation |
| **`error.css`** | Error modal and recovery UI |
| **`[page].css`** | Page-specific layouts |

### `/gui/lang` — Translation Files

All JSON files follow the same nested structure with keys like:
- `app.name`, `app.tagline`
- `nav.home`, `nav.movies`, `nav.series`
- `settings.title`, `settings.accentColor`
- `search.placeholder`, `search.noResults`
- `details.play`, `details.addToPlaylist`

---

## 🚀 Performance & Optimization

To ensure a "wow" experience on all hardware, including lower-powered Smart TVs, IVIDS employs several advanced optimization techniques:

### 1. DOM Recycling & Memory Management (`DomRecycler`)
The [dom-recycler.js](file:///app/src/main/assets/main/gui/js/dom-recycler.js) uses the **Intersection Observer API** to optimize memory usage in long lists.
- **Pruning**: Off-screen elements are hidden (`visibility: hidden`) to reduce the painting workload.
- **Restoration**: Elements are restored as they enter the viewport margin.
- **Impact**: Drastic reduction in memory footprint and smoother scrolling on high-count lists like search results.

### 2. Hybrid API Caching (`CacheManager`)
The [cache-manager.js](file:///app/src/main/assets/main/logic/cache-manager.js) implements a dual-layer caching strategy:
- **In-Memory Cache**: Lightning-fast access for repeated requests in the same session.
- **SessionStorage Cache**: Persists data across page refreshes but clears on app restart.
- **TTL Support**: Each item has a configurable Time-To-Live (default: 10 mins) to ensure data freshness.

### 3. Input Debouncing
The [debounce.js](file:///app/src/main/assets/main/gui/js/utils/debounce.js) utility prevents excessive API calls and UI lag during fast typing in search fields.

### 4. Hardware Acceleration (GPU) & Layout Stability
- **GPU Layers**: All animations use `transform` and `opacity` to leverage hardware acceleration.
- **CLS Optimization**: Pre-defined `min-height` and fixed aspect ratios for content containers prevent layout shifts.

---

## 🎨 Design System & CSS Architecture

### CSS Variables (Single Source of Truth)

```css
:root {
    /* Core Colors */
    --background-color: #141414;
    --text-color: #e5e5e5;
    --primary-color: #46d369;        /* User-configurable accent */
    --primary-rgb: 70, 211, 105;     /* RGB version for rgba() */
    --focus-border-color: #ffffff;
    --card-bg: #2f2f2f;
}
```

### Flexible Unit Policy

| Context | Required Unit | Example |
|---------|---------------|---------|
| Container width | `%` | `width: 90%` |
| Container height | `%` or `vh` | `height: 100%`, `height: 50vh` |
| Typography | `vh` or `vw` | `font-size: 2vh` |
| Spacing/Padding | `vh` or `vw` | `padding: 2vh 3vw` |
| Borders | `vh` (small) | `border: 0.3vh solid white` |

**⚠️ NEVER use `px` for layout!** Only exception: very small decorative elements or borders.

### Responsive Breakpoints

```css
/* Portrait mode (Mobile/Tablet) */
@media (orientation: portrait) {
    #app { flex-direction: column; }
    #sidebar { /* Transforms to bottom tab bar */ }
}

/* TV/Desktop scaling */
@media (max-width: 1400px) { /* Medium TVs */ }
@media (max-width: 1000px) { /* Smaller screens */ }
@media (max-width: 700px) { /* Very small */ }
```

### Focus States (Critical for TV)

```css
/* All interactive elements MUST have visible focus */
.focusable:focus,
.focusable.focused {
    border-color: white;
    box-shadow: 0 0 0 3px white;
    outline: none;
}

/* Accent color for primary actions */
.btn-primary:focus {
    box-shadow: 0 0 0 3px var(--primary-color);
}
```

### Portrait Mode Transformation

```css
/* Sidebar becomes bottom tab bar */
@media (orientation: portrait) {
    #sidebar-container {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 80px;
        flex-direction: row;
    }
    
    .nav-item {
        flex-direction: column;
        /* Icon on top, label below */
    }
}
```

---

## 🤖 AI Agent Implementation Standards

### 1. Accent Color Usage
```css
/* ✅ CORRECT: Use CSS variable */
.active-element {
    color: var(--primary-color);
    border-color: var(--primary-color);
}

/* ❌ WRONG: Hardcoded color */
.active-element {
    color: #46d369;
}
```

**Clarification Rule:** If user mentions "green colored" or any specific color, ASK if they mean the accent color (`--primary-color`).

### 2. Focus & Hover Animations

```css
/* ✅ CORRECT: Color/border transitions only */
.btn:hover,
.btn:focus {
    border-color: white;
    background-color: rgba(255, 255, 255, 0.1);
    transition: background-color 0.2s, border-color 0.2s;
}

/* ❌ WRONG: Scale/transform animations */
.btn:hover {
    transform: scale(1.05);  /* NEVER DO THIS */
}
```

### 3. Localization (i18n) Requirements

**HTML:**
```html
<!-- ✅ CORRECT -->
<button data-i18n="settings.save">Save</button>

<!-- ❌ WRONG -->
<button>Save</button>
```

**JavaScript:**
```javascript
// ✅ CORRECT
const message = window.i18n.t('playlists.empty');

// ❌ WRONG
const message = 'No playlists found';
```

**When adding new text:**
1. Add key to `lang/en.json`
2. Add translations to `lang/es.json`, `lang/fr.json`, `lang/de.json`, `lang/nl.json`
3. Use `data-i18n` attribute or `window.i18n.t()`

### 4. Container Flexibility

```css
/* ✅ CORRECT: Percentage-based */
.content-container {
    width: 90%;
    max-width: 100%;
    margin: 0 auto;
}

/* ❌ WRONG: Fixed pixel widths */
.content-container {
    width: 1200px;
}
```

### 5. Focusable Elements

```html
<!-- All interactive elements need .focusable class -->
<button class="btn focusable">Click me</button>
<div class="poster-wrapper focusable" tabindex="0">...</div>
<input class="search-input focusable" type="text">
```

### 6. Error Handling

```javascript
// Always wrap async operations
try {
    const data = await Api.fetchTrending();
    renderContent(data);
} catch (error) {
    console.error('Failed to fetch:', error);
    // Show user-friendly error or fallback UI
}
```

---

## 🛠️ Implementation History & Roadmap

### Completed Features (2024-2025)

| Feature | Description | Status |
|---------|-------------|--------|
| **SPA Architecture** | Client-side routing with history management | ✅ Complete |
| **Spatial Navigation** | D-pad focus navigation for TV remotes | ✅ Complete |
| **Multi-Language** | 5 languages (EN, ES, FR, DE, NL) | ✅ Complete |
| **Profile System** | Multiple user profiles with optional PIN | ✅ Complete |
| **Playlist Management** | Create, edit, delete custom playlists | ✅ Complete |
| **Watch History** | Recently watched with resume support | ✅ Complete |
| **Portrait Support** | Mobile-friendly bottom tab bar | ✅ Complete |
| **Accent Color Theming** | User-selectable theme colors | ✅ Complete |
| **Error Recovery** | Crash-safe with user-friendly recovery UI | ✅ Complete |
| **Screensaver** | Dim screen after inactivity | ✅ Complete |

### Recent Major Updates (Q4 2025)

1. **Toast Notification System**
   - Non-intrusive feedback for user actions.
   - Success, error, and info states with animations.
   - Auto-dismissal and stacking logic.

2. **Universal Portrait Support**
   - Sidebar transforms to bottom tab bar
   - Touch-friendly interactions
   - Responsive grids for all pages

2. **SVG Mask Migration**
   - Icons use CSS masks instead of inline SVGs
   - Single color change updates all icons

3. **Global Error Interception**
   - `window.onerror` and `onunhandledrejection` handling
   - No more white screen of death

4. **Profile PIN Protection**
   - Optional PIN for parental controls
   - Per-profile settings isolation

### Performance Optimizations (Q1 2025)

To ensure a premium, "wow" experience on all hardware, the following optimizations have been implemented:

1.  **Layout Stability (CLS Optimization)**: ✅ Complete
    - Pre-defined `min-height` and fixed aspect ratios for all content containers.
    - Verified by checking for layout shifts during page transitions.

2.  **Smart Lazy Loading & DOM Recycling**: ✅ Complete
    - `DomRecycler` for virtualization of high-count lists.
    - `LazyLoader` for image viewport detection.
    - Drastic reduction in memory footprint and initial CPU load.

3.  **Hybrid Caching System**: ✅ Complete
    - `CacheManager` with TTL-based Memory + SessionStorage strategy.
    - Prevents redundant API calls and ensures instant navigation for recently viewed content.

4.  **Hardware Acceleration (GPU)**: ✅ Complete
    - Transitioned all animations to `transform` and `opacity` properties.
    - Utilizes `translate3d(0,0,0)` to force GPU layers where necessary.

### Planned Features (2025+)

| Feature | Priority | Description |
|---------|----------|-------------|
| **Cache Pre-fetching** | High | Pre-load next page assets on focus |
| **Adaptive Bitrate** | Medium | Adjust video quality based on network |
| **Cloud Sync** | Medium | Sync profiles/playlists across devices |
| **Parental Controls** | Medium | Content filtering by age rating |
| **Continue Watching** | High | Home page row for in-progress content |
| **Search History** | Low | Recently searched terms |

---

## 📝 Quick Reference Cheat Sheet

### Adding a New Page

1. Create `pages/newpage.html` (HTML template)
2. Create `pages/newpage.js` (exports `init(params)`)
3. Create `css/newpage.css` (page styles)
4. Optional: `logic/spatial-nav/spatial-nav-newpage.js`
5. Add translation keys to all `lang/*.json` files
6. Add navigation link to sidebar

### Adding Translation

```json
// lang/en.json
{ "feature": { "newKey": "English text" } }

// lang/es.json
{ "feature": { "newKey": "Texto en español" } }
```

### Making Element Focusable

```html
<div class="my-element focusable" tabindex="0">Content</div>
```

### Using Accent Color

```css
.my-element {
    color: var(--primary-color);
    background: rgba(var(--primary-rgb), 0.2);
}
```

### Calling API

```javascript
import { Api } from '../logic/api.js';

const movies = await Api.fetchActionMovies();
const details = await Api.getDetails(12345, 'movie');
const imageUrl = Api.getImageUrl('/poster_path.jpg');
```

### Navigating Pages

```javascript
import { Router } from '../js/router.js';

Router.loadPage('details', { id: 12345, type: 'movie' });
Router.goBack();
```

---

*Last Updated: December 2025*
*Document Version: 2.1*
