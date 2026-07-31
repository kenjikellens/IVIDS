# Geometric Spatial Navigation Engine

Smart TV remotes lack a touch pointer or mouse cursor. IVIDS relies on a **Geometric Focus Engine** (`spatial-nav.js`) to translate 4-way D-pad directional inputs into fluid, intuitive focus movements.

---

## 🧠 Geometric Focus Algorithm (`findNext`)

When a directional key (Up, Down, Left, Right) is pressed, the engine scans the active scope for all elements matching `.focusable` and calculates a **Weighted Distance Score**.

### Scoring Formula
```javascript
// Score calculation based on current focus center and target element center
const dx = candidate.x - current.x;
const dy = candidate.y - current.y;

// Cross-axis penalty prevents accidental diagonal jumps
const weight = (direction === 'up' || direction === 'down') ? 2.5 : 4;
const score = (mainDist * mainDist) + (crossDist * crossDist * weight);
```
- **Main Distance**: Distance along the primary axis of movement.
- **Cross Distance**: Perpendicular offset.
- **Directional Weighting**: Horizontal movements carry a 4x cross-axis penalty to keep focus within horizontal poster rows without prematurely jumping to adjacent vertical rows.

---

## 🏗️ Core Architectural Features

### 1. Focus Scoping & Container Isolation
Prevents focus from unexpectedly jumping outside active content boundaries (e.g. between sidebar navigation and poster grids) unless explicit boundary edges are reached.

### 2. Focus Traps (Modals & Overlays)
Activating `SpatialNav.setFocusTrap(container)` restricts all geometric D-pad calculations exclusively to descendants of `container`. Essential for modals (Profile PIN, Update Prompts, Server Selectors).

### 3. Native Android Back Dispatcher Integration
On Android devices, hardware back button presses (or gesture back) are intercepted in [MainActivity.java](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/java/com/kenjigames/ivids/MainActivity.java#L463-L471) via `OnBackPressedDispatcher` and dispatched directly to `SpatialNav.back()`:
```javascript
if (window.SpatialNav && typeof window.SpatialNav.back === 'function') {
    window.SpatialNav.back();
}
```
This closes open focus traps/modals first before navigating backward in page history.

### 4. Smooth Element Centering (`centerElement`)
Forces elements into view using `element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })` to maintain a consistent "Snap-to-Grid" feel across Smart TV browsers.

---

## ⌨️ Key Mapping Table

| Logical Key | Key Codes / Values | Action |
|-------------|-------------------|--------|
| **Navigation** | ArrowUp, ArrowDown, ArrowLeft, ArrowRight, D-pad | Move focus geometrically |
| **Select / Enter** | Enter (13), DpadCenter (23) | Trigger `.click()` / activate control |
| **Back / Escape** | Backspace (8), Esc (27), Android Back (4) | Invoke `SpatialNav.back()` / Router `goBack()` |
| **Numeric Input** | 0-9 (48-57, 96-105) | Direct PIN entry & search query input |

---

*Single Source of Truth v0.4.5*
