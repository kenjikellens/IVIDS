# Known Problems, Technical Debt & Architectural Opportunities (IVIDS)

This document tracks known issues, architectural discrepancies, performance bottlenecks, and technical debt identified within the IVIDS application codebase.

---

## 1. Resolved Issues (Tracked for Reference)

### 1.1 Android System Navigation Bar Overlay (Clipped Mobile Navbar)
- **Status**: FIXED
- **Location**: [MainActivity.java](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/java/com/kenjigames/ivids/MainActivity.java)
- **Description**: On mobile devices with 3-button system navigation (Back, Home, Recents), the bottom navigation bar rendered underneath the soft buttons.
- **Resolution**: Enabled `WindowCompat.setDecorFitsSystemWindows(getWindow(), false)` with CSS `env(safe-area-inset-*)` padding in `global-mobile.css`.

### 1.2 Android APK Startup CORS Block & Same-Origin `/proxy`
- **Status**: FIXED
- **Location**: [MainActivity.java](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/java/com/kenjigames/ivids/MainActivity.java), [proxy.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/js/utils/proxy.js), [stream-optimizer.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/logic/livetv/core/stream-optimizer.js)
- **Description**: Loading `file:///android_asset/main/gui/index.html` with `setAllowFileAccessFromFileURLs(false)` caused Chromium WebView to block ES modules (`app.js`, `loader.js`) and SVGs with `file://` CORS errors, stalling on the splash screen.
- **Resolution**: Served bundled assets from `https://appassets.androidplatform.net/assets/` and routed `/proxy` same-origin so ES modules, Free HTTP (`HttpStreamProvider`), and Live TV streams load without `file://` or stripped-`Referer` errors.

### 1.3 Mobile & TV Remote Back Navigation + Landscape Player HUD
- **Status**: FIXED
- **Location**: [MainActivity.java](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/java/com/kenjigames/ivids/MainActivity.java), [spatial-nav.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/js/spatial-nav.js), [spatial-nav-player.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/logic/spatial-nav/spatial-nav-player.js), [player.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/pages/player.js), [global-mobile.css](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/css/global-mobile.css)
- **Description**: `SpatialNav.back()` consumed Back presses on touch devices for invisible D-pad focus recentering, and `WebView`/embed iframes could swallow `KEYCODE_BACK`/`KEYCODE_ESCAPE` from TV remotes.
- **Resolution**: Intercepted `KEYCODE_BACK`/`KEYCODE_ESCAPE` in `MainActivity.dispatchKeyEvent`, skipped D-pad focus-recentering on touch/mobile in `SpatialNav.back()`, updated mobile player HUD buttons to borderless YouTube-style icons, and refreshed HUD visibility on `resize`.

---

## 2. Performance & Rendering Bottlenecks

### 2.1 JavaScript-Driven DOM Recycling vs Native CSS `content-visibility`
- **Location**: [dom-recycler.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/js/dom-recycler.js)
- **Problem**: Uses `IntersectionObserver` to manually toggle `display: none` / visibility on list elements offscreen.
- **Impact**: High JavaScript main thread execution and garbage collection during rapid scrolling of long poster grids or Live TV channels.
- **Recommended Action**: Utilize native Chromium `content-visibility: auto` with `contain-intrinsic-size` on card grids to offload rendering optimization directly to the browser layout engine.

### 2.2 Native Image Lazy Loading Optimization
- **Location**: [lazy-loader.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/js/lazy-loader.js)
- **Problem**: Custom `IntersectionObserver` logic manages image lazy loading manually.
- **Impact**: Unnecessary script execution when standard HTML5 `loading="lazy"` attribute is natively supported in WebView / Chromium.
- **Recommended Action**: Add `loading="lazy"` to poster `<img>` tags and reduce custom lazy loader footprint.

---

## 3. Security & Electron Main Process Improvements

### 3.1 Node.js `http`/`https` Request Migration to Electron `net.request`
- **Location**: [main.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/main.js)
- **Problem**: `main.js` uses legacy Node `http`/`https` modules with manual redirect handling and has `webSecurity: false` enabled.
- **Impact**: Bypasses Chromium proxy configurations, lower connection pooling efficiency, and security risk.
- **Recommended Action**: Refactor API routing to Electron's native `net.request` API and proxy CORS headers to enable `webSecurity: true`.

---

*Document updated: November 2026*
