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
- **Style Reuse**: Prioritize reusing existing component classes (e.g., `.playlist-card`, `.poster-wrapper`, `.playlist-overlay`) over writing duplicate styles.

