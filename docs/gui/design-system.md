# Design System & CSS Architecture

IVIDS follows a strict "Premium Glassmorphic" design language optimized for high-resolution 4K TVs and high-density mobile viewports.

---

## 🎨 Design Tokens & Theme Variables

Core tokens are declared in `:root` inside `global.css`. Accent colors adapt dynamically based on user preferences stored in settings:

```css
:root {
    --background-color: #141414;
    --card-background: rgba(255, 255, 255, 0.05);
    --text-color: #e5e5e5;
    --primary-color: #46d369; /* Dynamic Accent */
    --primary-rgb: 70, 211, 105;
    --app-sidebar-width: 72px;
    --app-sidebar-expanded-width: 240px;
    --radius-sm: 6px;
    --radius-md: 12px;
    --radius-lg: 20px;
}
```

---

## 📐 Layout & Unit Guidelines

1. **Percentage-Based Sizing**: Sizing for primary view containers prefers `%`, `vw`, and `vh` over static pixel bounds to allow fluid scaling across TV and mobile display aspect ratios.
2. **Typography**: Uses `vh` and `clamp()` expressions (e.g. `font-size: clamp(14px, 2vh, 18px)`) to guarantee legibility on big-screen TVs without breaking layout density on phone screens.
3. **Safe Area & WindowInsets Handling**:
   - On Android devices, edge-to-edge rendering is enabled in [MainActivity.java](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/java/com/kenjigames/ivids/MainActivity.java) via `WindowCompat.setDecorFitsSystemWindows(getWindow(), false)`, letting Chromium `viewport-fit=cover` and CSS `env(safe-area-inset-*)` handle system bars and camera cutouts natively.
   - On mobile CSS ([global-mobile.css](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/css/global-mobile.css)), layout containers and fullscreen player overlays respect viewport insets:
     ```css
     #app #sidebar-container, #app .navbar {
         padding-bottom: env(safe-area-inset-bottom, 0px);
     }
     ```
   - Mobile fullscreen player HUD controls (`.tv-back-btn`, `.tv-settings-btn`, `.vod-skip-btn`, `.vod-play-btn`) use transparent, borderless YouTube-style icon targets with `drop-shadow` contrast in `global-mobile.css`, while desktop/TV retains rounded button surfaces and focus rings in `global.css`.

---

## 🛑 Hover & Focus Animation Standards

- **Strict Movement Rule**: Focus and hover state indicators MUST NEVER use `transform: scale()` or `translate()` movements. Moving elements during focus navigation cause browser layout recalculations and jank on smart TVs.
- **Standard Focus Indicator**: Focus states are signaled exclusively using a **thicker white border** (`outline: 2px solid #ffffff;` or `border-color: #ffffff;`).

---

## 🔘 OOCSS Component Hierarchy (`.btn`, `.card`, `.modal`)

All interactive components follow the OOCSS/BEM modular system in `global.css`:

- **Buttons**: Base `.btn` with sizes (`.btn--sm`, `.btn--md`, `.btn--lg`, `.btn--circle-md`, `.btn--circle-lg`, `.btn--circle-xl`) and variants (`.btn--primary`, `.btn--secondary`, `.btn--danger`, `.btn--ghost`).
- **Cards & Grids**: `.card` (`.card--interactive`, `.card--poster`, `.card--widescreen`, `.card--row`, `.card--panel`), `.media-rail` (horizontal carousels), and `.media-grid` (`.media-grid--posters`, `.media-grid--cast`).
- **Navigation & Modals**: `.nav-rail` / `.nav-item`, `.modal` / `.modal__dialog` (`.modal__dialog--sm` through `.modal__dialog--xl`), and `.chip` / `.badge` tokens.

---

## 🖼️ SVG Asset Management

- **Single Source of Truth**: Every SVG icon exists as an individual `.svg` file in the assets directory. Inline SVG markup in HTML/JS is strictly prohibited.
- **Dynamic Masking**: Icons use CSS `mask-image: url(...)` and `background-color: currentColor` to allow global accent recoloring without duplicating SVG assets.

---

*Single Source of Truth v0.6.4*
