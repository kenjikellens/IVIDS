# SPA Router & Page Lifecycle

The IVIDS Router (`router.js`) is an asynchronous Single Page Application (SPA) engine designed specifically for High-Performance Smart TV hardware. It coordinates page transitions, history management, and asynchronous asset loading.

## 🔄 The Navigation Lifecycle (`loadPage`)

When `Router.loadPage(pageName, params)` is called, the following sequence occurs:

1.  **Duplicate Guard**: Prevents redundant loads if requested page and parameters are identical to the current one.
2.  **History Push**: If `addToHistory` is true, the current state is added to the internal memory stack for `goBack()` support.
3.  **Loading Visuals**: 
    - Clears the `#main-view` and renders a high-performance conic-gradient orbit spinner loader (styles defined in `loader.css`). Page-specific stylesheet swapping is disabled; all component and page styles are consolidated into the unified `global.css`.
    - Removes `fullscreen-layout` class from the main container (usually added for player views).
4.  **Asynchronous Load (Parallelized)**:
    - **HTML**: Fetches `pages/${pageName}.html`. Includes a **10-second timeout** safety mechanism.
    - **JS Module**: Dynamically imports `../pages/${pageName}.js`.
5.  **Initialization (`init`)**: 
    - The new page's `init(params)` function is called (returning a Promise). 
    - This is where API data fetching typically begins.
6.  **Spatial Nav logic**: 
    - Dynamically attempts to import `../../logic/spatial-nav/spatial-nav-${pageName}.js`.
    - If found, binds custom D-pad logic to the current page.
7.  **Post-Initialization**: 
    - `Splash.signalContentLoaded()` notifies the bootloader that rendering is complete.
    - `i18n.applyTranslations()` scans the new template for translation keys.
8.  **Navigation Reset**: 
    - `this.resetFocus()` determines the initial focus element (either from `params` or the first available `.focusable`).

---

## 📜 History & Routing State

### Persistence
The router maintains state in two ways:
1.  **In-Memory Stack**: `Router.history` — Used for immediate `goBack()` navigation.
2.  **LocalStorage**: `ivids-last-route` — Stores `{ page, params }` to allow the app to resume exactly where the user left off after a restart.

### Context-Aware Fallbacks
If `goBack()` is called while the history is empty (e.g., after a fresh boot), it uses an internal fallback map to determine the logical parent:
- **Player** → **Details**
- **Details** → **Home**
- **Settings** → **Home**

---

## ⚠️ Robust Error Recovery

If any fetch fails or a script crashes during loading, the router catches the exception and renders a specialized **Error Recovery UI** into the `#main-view`:
- **Retry Feature**: A one-click retry button that maintains the original navigation parameters.
- **Panic Exit**: A "Go Home" button that escapes the error state and resets the Router to the `home` page.
- **State Reset**: Explicitly clears `isLoading` to ensure the router doesn't get "stuck".
