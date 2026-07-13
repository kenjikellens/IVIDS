# UI Inconsistencies

This file lists the UI inconsistencies found across the codebase that violate the project's styling and layout guidelines.

## Rule Violation: Inline CSS Styles (`style="..."`)
According to the project rules, all CSS styles MUST be written in external stylesheet files (e.g. `.css` files). Inline style attributes (`style="..."`) should not be used under any circumstances. Below is a list of files and locations where inline styles are currently being used to construct UI elements dynamically:

### `app/src/main/assets/main/gui/pages/settings.js`
- **Line 609**: `<span class="version-tag-badge" style="background: var(--primary-color)">`
- **Line 711**: `<div style="color: #ff3b30; text-align: center; padding: 20px; font-weight: 700; width: 100%;">`

### `app/src/main/assets/main/gui/pages/playlist-details.js`
- **Line 119**: `<div class="backdrop-overlay" style="background-color:#111;"></div>`
- **Line 136**: `<div class="empty-icon" style="font-size: 48px; margin-bottom: 18px;">`
- **Line 139**: `<h2 data-i18n="playlists.emptyPlaylist" style="margin-bottom: 22px; color: #fff; font-size: 24px;">`
- **Line 239**: `<div class="episode-image" style="background-image: ${bgImage};"></div>` (acceptable exception for dynamic background images if no alternative, but should be checked)

### `app/src/main/assets/main/gui/pages/details.js`
- **Line 318, 323, 403, 511, 518, 524, 547, 604, 752, 822**: Various error and empty state messages use inline styles such as `style="color: #f44; text-align: center;"` or `style="color: #aaa;"`. These should be replaced with standardized utility classes (e.g., `.text-error`, `.text-muted`, `.text-center`).
- **Line 832**: `style="background-image: url('...')" ` for actor profiles.

### `app/src/main/assets/main/gui/js/toast.js`
- **Line 56**: `<div class="toast-icon-mask" style="--icon-url: url('images/disconnected.svg')"></div>`

### `app/src/main/assets/main/gui/js/router.js`
- **Line 105**: `<div class="page-loader" style="display: flex; justify-content: center; align-items: center; height: 100vh;">`
- **Line 253, 258**: Error page container and buttons use inline styles like `style="text-align: center; padding: 50px; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;"` and `style="margin-left: 10px;"`.

### `app/src/main/assets/main/gui/js/app.js`
- **Line 705**: Critical initialization error fallback uses a massive inline style string: `style="background:#800;color:#fff;padding:30px;font-family:sans-serif;text-align:center;"`.

## Recommended Actions
1. **Create Utility Classes**: Define `.text-error`, `.text-muted`, `.text-center`, `.flex-center`, `.h-screen`, etc. in `global.css` to replace the one-off inline styles.
2. **Move Layouts to CSS**: For components like the `error-page-container` and `page-loader`, move their specific structural styles directly into `global.css`.
3. **Background Images**: For dynamic background images (like episode thumbnails or actor profiles), consider using a CSS variable approach or accept them as the only permitted use-case for inline styling, as it is often the most performant way to load dynamic imagery without bloating CSS.
