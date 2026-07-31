# Known Problems, Technical Debt & Architectural Opportunities (IVIDS)

This document tracks known issues, architectural discrepancies, performance bottlenecks, and technical debt identified within the IVIDS application codebase.

---

## 1. Resolved Issues (Tracked for Reference)

### 1.1 Android System Navigation Bar Overlay (Clipped Mobile Navbar)
- **Status**: FIXED
- **Location**: [MainActivity.java](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/java/com/kenjigames/ivids/MainActivity.java)
- **Description**: On mobile devices with 3-button system navigation (Back, Home, Recents), the bottom navigation bar rendered underneath the soft buttons.
- **Resolution**: Implemented `ViewCompat.setOnApplyWindowInsetsListener` in `MainActivity.java` to dynamically pad `mWebView` above the system bars.

---

## 2. Active Technical Debt & Architectural Issues

### 2.1 Dual i18n Translation Systems (`language-manager.js` vs `i18n.js`)
- **Location**: [i18n.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/i18n.js) & [language-manager.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/logic/language-manager.js)
- **Problem**: The codebase contains two separate internationalization mechanisms:
  - `language-manager.js`: Uses static inline JS dictionary objects.
  - `i18n.js`: Uses dynamic JSON fetching (`lang/*.json`) with `i18next` key formatting.
- **Impact**: Code duplication, increased bundle size, and maintenance confusion when adding new translation keys.
- **Recommended Action**: Deprecate `language-manager.js` completely and consolidate all i18n logic into `i18n.js`.

### 2.2 `transform: scale()` Animations on Hover/Focus (UI Rule Violation & Performance Jank)
- **Location**: [global.css](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/css/global.css) (`.focusable-card:hover`, `.focusable-card:focus`, `.focusable-card.focused`)
- **Problem**: CSS cards use `transform: scale(1.04)` on hover and D-pad focus.
- **Impact**: Violates project UI guidelines prohibiting `scale`/`translate` hover effects. Causes browser layout recalcs and frame drops during rapid TV D-pad navigation.
- **Recommended Action**: Replace `scale()` with a high-contrast white border (`border: 3px solid #fff`) or outline animation.

### 2.3 Excessive Synchronous `localStorage` I/O in Live TV Zapping
- **Location**: [livetv.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/livetv.js) (`updateStoredChannelStatus`)
- **Problem**: Every channel zap or stream status event triggers synchronous `localStorage.getItem`, `JSON.parse`, array filtration, and `localStorage.setItem`.
- **Impact**: Blocks the main thread UI loop during zapping, causing dropped frames on lower-end Android TV hardware.
- **Recommended Action**: Implement an in-memory `Map` cache and debounce `localStorage` writes (flush to disk 1.5s after user stops zapping).

---

## 3. Performance & Rendering Bottlenecks

### 3.1 JavaScript-Driven DOM Recycling vs Native CSS `content-visibility`
- **Location**: [dom-recycler.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/dom-recycler.js)
- **Problem**: Uses `IntersectionObserver` to manually toggle `display: none` / visibility on list elements offscreen.
- **Impact**: High JavaScript main thread execution and garbage collection during rapid scrolling of long poster grids or Live TV channels.
- **Recommended Action**: Utilize native Chromium `content-visibility: auto` with `contain-intrinsic-size` on card grids to offload rendering optimization directly to the browser layout engine.

### 3.2 Native Image Lazy Loading Optimization
- **Location**: [lazy-loader.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/lazy-loader.js)
- **Problem**: Custom `IntersectionObserver` logic manages image lazy loading manually.
- **Impact**: Unnecessary script execution when standard HTML5 `loading="lazy"` attribute is natively supported in WebView / Chromium.
- **Recommended Action**: Add `loading="lazy"` to poster `<img>` tags and reduce custom lazy loader footprint.

---

## 4. Security & Electron Main Process Improvements

### 4.1 Node.js `http`/`https` Request Migration to Electron `net.request`
- **Location**: [main.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/main.js)
- **Problem**: `main.js` uses legacy Node `http`/`https` modules with manual redirect handling and has `webSecurity: false` enabled.
- **Impact**: Bypasses Chromium proxy configurations, lower connection pooling efficiency, and security risk.
- **Recommended Action**: Refactor API routing to Electron's native `net.request` API and proxy CORS headers to enable `webSecurity: true`.

---

*Document updated: July 2026*
