# Geometric Spatial Navigation Engine

Smart TV remotes lack a pointer. IVIDS uses a **Geometric Focus Engine** (`spatial-nav.js`) to translate 4-way D-pad inputs into a fluid, intuitive experience.

## 🧠 The Geometric Algorithm (`findNext`)

When a user presses a direction, the engine scans the current scope for all `.focusable` elements and calculates a **Weighted Distance Score**.

### Scoring Formula
```javascript
// Score is calculated based on current center and candidate center
const dx = candidate.x - current.x;
const dy = candidate.y - current.y;

// Weighting prevents accidental diagonal jumps (higher cross-axis penalty)
const weight = (direction === 'up' || direction === 'down') ? 2.5 : 4;
const score = (mainDist²) + (crossDist² * weight);
```
- **Main Distance**: Distance along the primary axis of movement.
- **Cross Distance**: Distance along the perpendicular axis.
- **Directional Weighting**: Horizontal movement (Left/Right) is weighted more heavily (4x) against vertical drift compared to Vertical movement (2.5x), as grids are typically wider than they are tall.

---

## 🏗️ Architectural Concepts

### Focus Scoping & Isolation
The engine prevents accidental jumps between the **Sidebar** and **Main Content** on Up/Down presses. It "scopes" the search to the container currently holding the focus unless a Left/Right press specifically breaks the boundary.

### Focus Traps (Modals)
Using `setFocusTrap(container)`, all geometric calculations are restricted to children of that container. This ensures that opening a Modal (like Profile PIN entry) completely locks the user inside until the trap is cleared.

### Virtual Center Logic (`centerElement`)
Standard `scrollIntoView()` on some TVs is jumpy or unaccelerated. IVIDS uses `el.scrollIntoView({ behavior: 'smooth', block: 'center' })` to ensure the focused element is always centered vertically and horizontally, providing a "Snap-to-Grid" feel popular on premium TV platforms (Apple TV, Netflix).

---

## 📱 Mobile & Portrait Support

The engine is **Adaptive**.
- **Input Transformation**: In Portrait mode (or on Mobile), selecting an `INPUT` field automatically removes `readOnly` and adds the `.active-typing` class to bring up the OS virtual keyboard.
- **Scroll Hijacking**: The engine forces `element.focus({ preventScroll: true })` and handles scrolling manually via the `centerElement` logic to prevent browser-native scrolling from interfering with the custom UI layout.

---

## ⌨️ Key Mapping Table

| Logical Key | Values (Standard / TV) | Action |
|-------------|-------------------------|-------|
| **Navigation**| Arrow keys, D-pad | Move focus geometrically |
| **Action** | Enter, DpadCenter (23) | Trigger `.click()` / Activate Input |
| **Back** | Backspace (8), Esc (27), Back (10009) | Go back in Router history |
| **Numeric** | 0-9 (48-57, 96-105) | Direct input into PIN fields / Search |
