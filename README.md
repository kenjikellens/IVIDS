# IVIDS - Your Entertainment Hub

IVIDS is a premium, high-performance media player designed for a cinematic experience across multi-platform devices, including Android TVs, Tizen Smart TVs, Mobile, and Desktop browsers.

## 🚀 Core Technologies
- **Vanilla JS (ES6+)**: Modular architecture using native ES modules.
- **HTML5 & CSS3**: Modern responsive layouts using CSS Grid and Flexbox.
- **Spatial Navigation**: A custom-built focus management system optimized for remote controls and keyboards.

## 🏗️ Technical Architecture

### Custom SPA Router
The application uses a bespoke Single Page Application (SPA) router (`router.js`).
- **Dynamic Loading**: HTML templates are fetched from `pages/*.html` on demand.
- **Modular Logic**: Each page has a corresponding `.js` module (e.g., `pages/home.js`) which is imported dynamically upon navigation.
- **State Management**: Navigation history and page parameters are managed within the `Router` object.

### Spatial Navigation System
Ensures a native TV experience:
- **Focus Management**: Automatically tracks and manages `.focusable` elements.
- **Page Logic Overrides**: Specific pages can override navigation behavior (e.g., guiding the "Down" press from a header button to a content grid).
- **Responsive Handling**: Adapts focus logic between Landscape (TV) and Portrait (Mobile) orientations.

### i18n Support
Global translation system (`lang/*.json`) allows for easy localization across multiple languages, updating the UI dynamically without page reloads.

## 📁 Project Structure
- `app/src/main/assets/main/gui/`:
    - `pages/`: Page-specific HTML and JS logic.
    - `components/`: Shared UI components (Sidebar, Loader).
    - `css/`: Styling organized by page and global utility.
    - `js/`: Core system logic (Router, SpatialNav, ErrorHandler).
    - `lang/`: JSON translation files.

## 🛠️ Getting Started
Simply serve the `assets/main/gui` directory via a web server or load `index.html` in a compatible web-view environment.
