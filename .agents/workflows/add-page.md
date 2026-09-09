---
description: Step-by-step workflow for creating a new view, wiring routing, styling with global CSS, and registering sidebar navigation.
---

# Add New Page Workflow

This workflow provides the standardized protocol for creating and integrating a new page/view into the IVIDS application.

---

## 📋 Step-by-Step Implementation Protocol

### 1. Create the HTML Template
- **Location**: `app/src/main/assets/main/gui/pages/<page-name>.html`
- **Requirements**:
  - Encapsulate content in a primary container with clear semantic class: `<div class="page <page-name>-page">`.
  - **Zero Raw Text**: ALL visible user-facing text MUST have a `data-i18n="key"` attribute for automatic translation.
  - **Spatial Navigation**: Every interactive element (button, card, tab, input) MUST include the `focusable` class to enable TV remote / D-pad navigation.

### 2. Create the JavaScript Controller
- **Location**: `app/src/main/assets/main/gui/pages/<page-name>.js`
- **Requirements**:
  - Export an `init(params)` lifecycle function that [router.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/js/router.js) calls upon page load.
  - Export a `destroy()` or cleanup function if timers, web sockets, or background listeners need teardown upon page departure.
  - **Method Documentation**: Add a concise (1-2 sentence) JSDoc block directly above every function detailing its purpose and state effects.
  - Structure code using robust OOP / module patterns.

### 3. Add Styles to Centralized Stylesheets
- **Locations**:
  - Desktop / TV: [app/src/main/assets/main/gui/css/global.css](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/css/global.css)
  - Mobile Overrides: [app/src/main/assets/main/gui/css/global-mobile.css](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/css/global-mobile.css)
- **Rules**:
  - NEVER create standalone `css/<page-name>.css` files (they are not imported by `index.html`).
  - Add a single-line comment above every CSS class definition explaining what UI element it styles.
  - Use `var(--primary-color)` for theme accent highlights.
  - Focus indicator MUST be the standard thicker white border (NO `scale`, `translateX`, or `translateY` animations on focus/hover).

### 4. Register in Sidebar Navigation (Optional)
If the page belongs in the main navigation menu:
- **Location**: [app/src/main/assets/main/gui/components/sidebar/sidebar.html](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/components/sidebar/sidebar.html)
- Add a new navigation item:
  ```html
  <a href="#" class="nav-item focusable" data-route="<page-name>" title="<Page Title>">
      <div class="nav-icon <page-name>"></div>
      <span data-i18n="nav.<page-name>"><Page Title></span>
  </a>
  ```
- If an icon is needed, place the SVG in `app/src/main/assets/main/gui/images/` and define its CSS background mask in `global.css`.

### 5. Check Router Behavior
- **Location**: [app/src/main/assets/main/gui/js/router.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/js/router.js)
- [Router.loadPage('<page-name>')](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/js/router.js) automatically resolves `pages/<page-name>.html` and `../pages/<page-name>.js`.
- If the new view should hide the global sidebar (like full-screen players or modal logins), add `<page-name>` to the sidebar display condition in `Router.loadPage`.

### 6. Synchronize Translations
- Add the new UI keys to [app/src/main/assets/main/gui/lang/en.json](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/lang/en.json).
- Run the batch translation script per [/update-translations](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/workflows/update-translations.md) to populate the keys across all other 31 languages.

### 7. Validation Checklist
- [ ] Page loads cleanly via `Router.loadPage('<page-name>')` without console errors.
- [ ] D-pad / arrow-key spatial navigation moves smoothly to all `.focusable` elements.
- [ ] No unstyled text; all strings load through translation keys.
- [ ] Viewport renders correctly on desktop widescreen, Android TV, and mobile landscape.
