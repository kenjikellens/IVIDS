---
trigger: always_on
---

# UI, CSS & Animation Standards

## 1. Centralized Stylesheet Architecture
- **Unified Stylesheets**: All CSS styles MUST be written in external stylesheet files under `app/src/main/assets/main/gui/css/`:
  - [global.css](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/css/global.css): Primary stylesheet for desktop, Android TV, and standard viewports.
  - [global-mobile.css](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/css/global-mobile.css): Responsive overrides for mobile touch devices and compact viewports.
- **No Page-Specific CSS Files**: NEVER create individual page stylesheets (e.g. `css/[page].css`) or component CSS files, as they are not loaded by `index.html`.
- **No Inline Styles**: NEVER use inline `style="..."` attributes in HTML.

## 2. Spatial Navigation & TV Compatibility
- **Focusable Elements**: Every interactive element (buttons, cards, links, inputs) MUST include the `focusable` class (e.g., `class="nav-item focusable"`) so that the D-pad navigation engine in [spatial-nav.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/js/spatial-nav.js) can register and navigate to it on Android TV, Tizen, and PC keyboards.
- **Focus Visibility**: Ensure all focusable elements have an unambiguous focused appearance via `:focus` and `.focused` selectors.

## 3. Hover & Focus Animations
- **Forbidden Transforms**: Buttons and interactive elements MUST NEVER have scale, translate, or displacement moving animations (`translateX`, `translateY`, `translate3d`, `scale`) on hover or focus.
- **Standard Focus Indicator**: The standard hover and focus indicator is ALWAYS a thicker white border (e.g., `outline: 2px solid #ffffff;` or `border-color: #ffffff;`).

## 4. Accent Colors & Theming
- **Primary Token**: Always use `var(--primary-color)` for all brand highlights, active selection indicators, and theme accents.
- **Intent Clarification**: If the user asks for "green" or "colored" elements, clarify whether they intend to use `var(--primary-color)`.

## 5. CSS Class Annotations & Code Style
- **Class Annotations**: Every CSS class definition MUST be preceded by a single-line comment describing what UI element it styles and its visual responsibility.
- **No `!important`**: NEVER use `!important` in CSS unless strictly unavoidable (e.g. overriding external player elements).
- **Responsive Sizing**: Prefer responsive sizing units (`%`, `rem`, `vh`, `vw`) over rigid pixel bounds for layout containers.
- **Style Reuse**: Prioritize reusing existing component classes (e.g., `.card--poster`, `.media-rail`, `.btn--primary`) over writing duplicate styles.

## 6. OOCSS Component Architecture & Design System Tokens
The project follows Object-Oriented CSS (OOCSS) and BEM-like modular composition. Always compose elements using standard base classes and modifier classes:
- **Buttons**: Base `.btn` with sizes (`.btn--sm`, `.btn--md`, `.btn--lg`, `.btn--block`, `.btn--fixed-min`) and variants (`.btn--primary`, `.btn--secondary`, `.btn--danger`, `.btn--ghost`).
- **Button Groups**: `.btn-group` (horizontal row), `.btn-group--vertical` (vertical stack), `.btn-group--fill` (stretch buttons), `.btn-group--end` (right alignment).
- **Cards**: Abstract `.card`, with modifiers `.card--interactive`, `.card--poster` (2:3 aspect ratio), `.card--widescreen` (16:9 aspect ratio), `.card--row` (horizontal media card), `.card--panel` (solid dark surface), `.card--compact`.
- **Media Grids & Rails**:
  - Horizontal scrolling carousels: `.media-rail` (legacy alias: `.row-posters`).
  - Fluid card grids: `.media-grid`, `.media-grid--posters` (search/playlist grids), `.media-grid--cast` (actor profile grid).
- **Modals**: `.modal` overlay with dialog `.modal__dialog` (sizes: `.modal__dialog--sm`, `.modal__dialog--md`, `.modal__dialog--lg`, `.modal__dialog--xl`), `.modal__title`, `.modal__desc`, `.modal__body`, `.modal__footer`.
- **Form Controls**: `.form-control-wrapper` (glassmorphic input container), `.form-input`, `.form-select-wrapper`, `.form-select`, `.form-toggle` / `.form-toggle__slider` (toggle switch).
- **Chips & Badges**: Selection chips `.chip` (modifiers: `.chip--option`, `.chip--recent`, `.chip--rating`, `.chip--color`), `.badge` (variants: `.badge--primary`, `.badge--glass`), `.chip-grid`.
- **Navigation Rail**: `.nav-rail` (alias: `.navbar`), `.nav-rail__header`, `.nav-rail__logo`, `.nav-rail__brand`, `.nav-rail__group`, `.nav-rail__group--bottom`, `.nav-item`, `.nav-item__icon`, `.nav-item__label`.
- **Typography Tokens**: `.title-hero` (large fluid display title), `.section-title` (category/row header).
- **Legacy Alias Invariant**: When refactoring or updating templates, NEVER delete legacy alias selectors (e.g. `.poster-wrapper`, `.btn-primary`, `.row-title`) from `global.css` while dynamic JavaScript string templates across the application still reference them.

## 7. FOUC Prevention & Dark Mode Engine Safety
- **Critical Inline Splash CSS**: `index.html` MUST ALWAYS retain the critical inline `<style>` block for `#splash-screen` to eliminate Flash of Unstyled Content (FOUC). `#splash-screen` must be fixed full-screen with `#050505` background and `z-index: 9999` so that raw DOM containers never flash before `global.css` parses.
- **Dark Mode Meta Tags**: `index.html` MUST declare `<meta name="color-scheme" content="dark">` and `<meta name="darkreader-lock">` in `<head>` to prevent third-party dark mode extensions (such as Dark Reader) and browser auto-darkening engines from injecting unwanted container backgrounds (`#181a1b`) or outline borders (`rgb(119, 110, 98)`).
- **Native Color-Scheme Declaration**: `:root` in `global.css` MUST always retain `color-scheme: dark;`.
