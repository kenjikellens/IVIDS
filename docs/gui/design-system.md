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
**NEVER use `px` for layout.**
- Containers: `%` or `vw/vh`
- Typography: `vh` (preferred for TV)
- Borders: `vh` (e.g., `0.3vh`)

## Responsive Patterns
- **Landscape (TV)**: Horizontal Sidebar, 6-col grids.
- **Portrait (Mobile)**: Bottom Tab Bar, 2-col or 3-col grids.
- **Focus States**: High-contrast white border + glow. No scaling or movement on focus/hover.

## SVG Masking
Icons use CSS `mask-image` instead of inline SVGs. This allows changing icon colors globally via the `--primary-color` variable.
