# Performance & UI Optimization

On low-power TV hardware (SmartTVs, basic Android sticks), standard DOM operations are expensive. IVIDS applies specialized "Mobile-First" optimizations to maintain 60FPS.

## ⚡ Hardware Acceleration (GPU)

All animations (sidebar sliding, card transitions, toast popups) are restricted to **GPU-friendly properties**:
1.  **`transform: translate3d()`**: Triggers hardware layers for compositing.
2.  **`opacity`**: Changes can be handled during the paint phase without re-calculating layouts.
3.  **Will-Change**: Predictive hints are applied to the sidebar during transition states.

---

## ♻️ DOM Recycling & Virtualization

For high-content rows (50+ movies), IVIDS uses a manual **View Recycling** principle:
- **Off-screen components** are either removed from the DOM or hidden using `display: none` to reduce the browser's recalculation tree.
- **Image Intersection Observer**: Posters only begin loading when they are within 100px of the horizontal viewport.

---

## 📦 Asset Management

### Lazy Loading
Custom `LazyLoader` logic handles the heavy lifting for TMDB posters:
- **Low-res First**: Fetches small `w92` posters if the network is detected as slow.
- **Cleanup**: When a page is unloaded (via `Router`), all pending fetch requests are aborted.

### Memory Optimization
On TV browsers (Tizen/WebOS), memory leaks are fatal. The app implements:
- **EventListener Cleanup**: `SpatialNav` and `Router` ensure that listeners are detached or recycled between page transitions.
- **Image Heap Flush**: High-res backdrops are removed from the DOM as soon as the user navigates away to free up GPU memory.
