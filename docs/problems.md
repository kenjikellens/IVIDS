# Known Problems and Issues

This document tracks known issues, architectural discrepancies, and performance bottlenecks identified within the IVIDS application.

## Mobile Mode
- The loader is not properly centered in mobile mode on the search page for the movies/series template on the general search page (not the results page).
- Mobile devices download high-resolution images (posters, backdrops, stills) due to high Device Pixel Ratio (DPR), consuming excessive bandwidth and slowing down page load times on mobile networks.
  - **Proposed Solution**: Simplify the image size recommendation logic in `app/src/main/assets/main/logic/api.js` to rely only on **two factors** (Internet Quality and Screen Layout/Size):
    - **Factor 1 (Internet/Data Saver)**: If `isSlowConnection()` is true, immediately return the lowest resolution (e.g. `w154` poster, `w300` backdrop).
    - **Factor 2 (Screen Layout/Size)**: If portrait mode matches (`window.matchMedia('(max-aspect-ratio: 3/4)').matches`), return a standardized mobile-friendly resolution (e.g. `w185` poster, `w780` backdrop). Otherwise (Desktop/TV landscape), return the standard high-resolution (e.g. `w342` poster, `w1280` backdrop).
    - *Benefits*: Removes complex math, ignores fluctuating Device Pixel Ratio multipliers, reduces code complexity, and saves significant bandwidth.




