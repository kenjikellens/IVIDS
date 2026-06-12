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

### Boot Flow & Reset
On app launch, the application initialization listener (`app.js`'s `DOMContentLoaded`) executes a clean-up routine:
- Removes any lingering `ivids-last-route` and `ivids-last-active` keys from `localStorage` to ensure a completely fresh start.
- Invokes `Router.loadPage('home')` to immediately boot the user to the landing page.
- Profiles are no longer required at launch; the user enters as the current active profile (or the guest profile by default) and can manage or switch profiles inside the **Account** panel accessed from the sidebar.

### In-Session Persistence
The router maintains navigation state in two ways during an active session:
1. **In-Memory Stack (`Router.history`)**: A standard array stack storing previous page names and their parameter sets. Used to support D-pad back transitions via `Router.goBack()`.
2. **Fallback Parent Maps**: If the stack is empty (e.g., returning from settings after direct selection), the router resolves logical parent relationships (e.g. `Player` -> `Details` -> `Home`).

---

## ⚡ Performance: Caching & Race-Condition Prevention

To guarantee a "zero-latency" SPA experience, the router implements two internal subsystems:

### 1. Template Caching (`_htmlCache`)
- A file-level in-memory `Map` that caches HTML templates (`pages/${pageName}.html`) on their first retrieval.
- Subsequent navigations to the same page resolve instantly from `_htmlCache`, avoiding HTTP requests, eliminating network lag, and preventing screen styling flashes.

### 2. Load Generation Tracking (`_loadGeneration`)
- **The Race Condition**: Fast-clicking users or remote triggers can request a new page while a slow network fetch is still resolving an earlier page. This can cause the wrong template to be injected out-of-order when the first fetch resolves late.
- **The Solution**: An internal monotonic counter `_loadGeneration`.
  - Every call to `loadPage()` increments `_loadGeneration` and captures the value as a local variable (`currentGen`).
  - At every asynchronous resolution stage (HTML fetch completion, script import, custom spatial nav bind, post-init signals), the engine verifies `currentGen === _loadGeneration`.
  - If a mismatch is detected, execution is immediately aborted, discarding outdated page load routines in favor of the most recent navigation request.


---

## ⚠️ Robust Error Recovery

If any fetch fails or a script crashes during loading, the router catches the exception and renders a specialized **Error Recovery UI** into the `#main-view`:
- **Retry Feature**: A one-click retry button that maintains the original navigation parameters.
- **Panic Exit**: A "Go Home" button that escapes the error state and resets the Router to the `home` page.
- **State Reset**: Explicitly clears `isLoading` to ensure the router doesn't get "stuck".
