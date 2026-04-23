# Performance & Optimization

To ensure a "wow" experience on low-powered hardware devices (e.g., Tizen/Android Stick), IVIDS uses several high-performance strategies.

## DOM Recycling (`DomRecycler`)
Uses **Intersection Observer** to hide off-screen list items (`visibility: hidden`).
- **Pruning**: Reduces the browser's painting and layout workload.
- **Memory**: Drastic reduction in active DOM nodes for long search results.

## Hybrid Caching (`CacheManager`)
- **Layer 1**: In-memory Map for instant access.
- **Layer 2**: `SessionStorage` for persistence across refreshes.
- **TTL**: Data expires after 10 minutes to maintain freshness.

## UI Stability
- **CLS Control**: Containers have pre-defined aspect ratios to prevent layout shifts during image loading.
- **Skeleton Screens**: Shimmer placeholders show the layout before data arrives.

## GPU Acceleration
Animations are restricted to `transform` and `opacity` properties to ensure they run on the GPU.
