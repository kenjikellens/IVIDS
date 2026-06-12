# Design System & CSS Architecture

IVIDS follows a strict "Premium Glass" aesthetic optimized for both 4K TVs and high-density mobile screens.

## CSS Variables
Variables are defined in `:root` and user-selectable values (like accent color) are injected dynamically.
```css
:root {
    --background-color: #141414;
    --text-color: #e5e5e5;
    --primary-color: #46d369; /* Dynamic */
    --primary-rgb: 70, 211, 105;
}
```

## Flexible Unit Policy
**Prefer responsive units, but use `px` when necessary for layout safety.**
- **Preferred Layout Units**: Use `%`, `vw`, or `vh` for sizing major screen divisions and parent containers to adapt fluidly to screen ratios.
- **TV/Typography Styling**: Use `vh` units (e.g., `3vh` font-size) to keep typography scalable on huge television screens.
- **Pixel Layouts (`px`)**: The codebase utilizes `px` units extensively (e.g. `min-height: 476px`, `padding: 22px`, indicator dimensions) to guarantee exact borders, padding, and constraints where browser-specific scaling can introduce alignment bugs.

## Button Class Naming (v0.4.3 Standardization)
All legacy button classes (`.action-btn`, `.modal-btn`, `.ghost-btn`, etc.) have been renamed and consolidated into a standard base class with variant modifiers:
- `.btn`: Base class containing shared metrics (height, cursor, flex alignment, transition times).
- `.btn-primary`: Green theme accent button utilizing `var(--primary-color)`.
- `.btn-secondary`: Translucent dark button utilizing `rgba(255, 255, 255, 0.08)` and fine border elements. Ideal for neutral or destructive dismissals.
- `.btn-danger`: Red action button for high-risk deletions (e.g., clearing playlists, deleting profiles).

## Responsive Patterns
- **Landscape (TV)**: Horizontal Sidebar, 6-col grids.
- **Portrait (Mobile)**: Bottom Tab Bar, 2-col or 3-col grids.
- **Focus States**: High-contrast white border + glow. No scaling or translation movements on focus/hover (to respect device navigation performance and standard TV guidelines).


## SVG Masking
Icons use CSS `mask-image` instead of inline SVGs. This allows changing icon colors globally via the `--primary-color` variable.

## Stylesheet Structure & Consolidation
To prevent page-transition styling flashes and eliminate unnecessary network requests, the stylesheet structure is optimized as follows:
- **`global.css`**: The core, unified stylesheet. All 17 page-specific CSS files (such as `home.css`, `player.css`, `settings.css`, and `sidebar.css`) are consolidated here. Component and layout rules are bundled into a single file loaded during app startup.
- **`loader.css`**: A dedicated stylesheet containing styles for high-performance loading animations, dual-orbit nested spinners, shimmer overlays, and layout skeletons. This ensures that visual loading indicators are available immediately while the main interface loads.
