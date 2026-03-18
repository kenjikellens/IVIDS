# Development Guides

Standard procedures for extending the IVIDS application.

## 📄 Adding a New Page
1. Create `pages/[name].html` (Structure).
2. Create `pages/[name].js` (Init Logic).
3. Create `css/[name].css` (Styles).
4. Add translation keys to `lang/*.json`.
5. Update `js/sidebar/sidebar.js` with the new link.
6. Optional: Create `logic/spatial-nav/spatial-nav-[name].js` for custom navigation.

## 🌐 Adding a Language
1. Create a new JSON file in `lang/` (e.g., `pt.json`).
2. Add the language code to the selection list in `pages/settings.js`.
3. Update `js/i18n.js` to ensure the new file is loaded correctly.

## 🧩 Shared Components
Components are stored in `gui/components/`. Use them when UI elements are shared across 3+ pages.
- Sidebar
- Hero Slider
- Toast Notifications
- List Rows
