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
   - On Android devices, system bars (3-button navigation & status bar) are handled natively in [MainActivity.java](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/java/com/kenjigames/ivids/MainActivity.java#L423-L428) via `ViewCompat.setOnApplyWindowInsetsListener`.
   - On mobile CSS, layout containers respect viewport bounds:
     ```css
     #app #sidebar-container, #app .navbar {
         padding-bottom: env(safe-area-inset-bottom, 0px);
     }
     ```

---

## 🛑 Hover & Focus Animation Standards

- **Strict Movement Rule**: Focus and hover state indicators MUST NEVER use `transform: scale()` or `translate()` movements. Moving elements during focus navigation cause browser layout recalculations and jank on smart TVs.
- **Standard Focus Indicator**: Focus states are signaled exclusively using a **thicker white border** (`border: 3px solid #ffffff`) or high-contrast glow (`box-shadow: 0 0 12px rgba(255, 255, 255, 0.4)`).

---

## 🔘 Button Component Hierarchy (`.btn`)

All interactive buttons follow a standardized class structure:

- `.btn`: Base class establishing height, cursor, flex alignment, and transition properties.
- `.btn-primary`: Theme accent button utilizing `var(--primary-color)`.
- `.btn-secondary`: Translucent dark button (`rgba(255, 255, 255, 0.08)`) with subtle borders.
- `.btn-danger`: High-visibility red button for destructive actions (e.g., deleting profiles or playlists).

---

## 🖼️ SVG Asset Management

- **Single Source of Truth**: Every SVG icon exists as an individual `.svg` file in the assets directory. Inline SVG markup in HTML/JS is strictly prohibited.
- **Dynamic Masking**: Icons use CSS `mask-image: url(...)` and `background-color: currentColor` to allow global accent recoloring without duplicating SVG assets.

---

*Single Source of Truth v0.4.5*
