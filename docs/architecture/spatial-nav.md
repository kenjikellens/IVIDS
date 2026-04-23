# Spatial Navigation System

TV remotes only have 4 directional buttons + Enter/Back. IVIDS uses a custom **geometric focus engine** to provide a native TV experience.

## Geometric Focus Engine
The algorithm calculates the nearest focusable element in any direction using a weighted distance formula.

### Scoring Algorithm
```javascript
// Lower score = better candidate
const mainDist = direction === 'left' || direction === 'right' ? |dx| : |dy|;
const crossDist = direction === 'left' || direction === 'right' ? |dy| : |dx|;

// Cross-axis penalty prevents accidental diagonal jumps
const crossPenalty = (direction === 'up' || direction === 'down') ? 2.5 : 4;
const score = (mainDist²) + (crossDist² × crossPenalty);
```

## Core Features
1. **Focus Trap**: Restricts navigation to a specific container (e.g., modals).
2. **Container Isolation**: Prevents accidental jumps between Sidebar and Main View.
3. **Page Overrides**: Complex layouts can define custom `findNext` logic.
4. **Input Handling**: Special double-Enter logic for TV virtual keyboards.

## Implementation Standard
All interactive elements MUST have the `.focusable` class and appropriate `tabindex`.
```html
<button class="btn focusable">Click me</button>
```
