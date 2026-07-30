# Implementation Plan - Glued Hero Background with Pure CSS UI Scroll Mask Fade

## 1. Overview & Objectives

The hero header section (`<header class="hero" id="hero">`) contains backdrop slide images with an existing bottom gradient mask (`mask-image: linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)`).

**Objective**:
- Keep the hero backdrop image glued/fixed to the top of the viewport using pure CSS (`background-attachment: fixed`).
- As the user scrolls down `#main-view`, the `<header class="hero">` element and its existing bottom gradient fade mask move naturally UPWARDS in lockstep with the scrolling UI content.
- As the bottom fade mask moves up across the fixed backdrop image, the image naturally fades out from the bottom to the top without adding any extra JavaScript layers, scroll event listeners, or script classes.

---

## 2. Architectural Design & Pure CSS Implementation

### CSS Architecture
- `.hero`: Remains in normal document flow (`position: relative; z-index: 2; background: transparent;`).
- `.hero-slides-track`: Positioned absolutely inside `.hero` (`position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none;`).
- `.hero-slide`: Applies `background-attachment: fixed; background-position: center top; background-size: cover;` along with the existing `-webkit-mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 1) 50%, rgba(0, 0, 0, 0) 100%);`.

### How the Glued Bottom-Up Fade Operates:
1. **At `scrollTop = 0`**:
   - The hero backdrop image renders glued at the top of the viewport.
   - The bottom 50% of the hero slide transitions into page background transparency via `mask-image`.
2. **As user scrolls down**:
   - The `.hero` element and `.hero-slide` (containing the `mask-image`) scroll UP with the UI content.
   - The background image stays pinned at `(0, 0)` due to `background-attachment: fixed`.
   - The bottom mask fade moves UP over the fixed backdrop image in 1:1 sync with the scrolling UI, naturally fading out the image from bottom to top.

---

## 3. Proposed Changes & Key Files

### [MODIFY] [global.css](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/css/global.css)
- Set `background-attachment: fixed` on `.hero-slide`.
- Restore `.hero-slides-track` to `position: absolute; top: 0; left: 0; height: 100%; width: 100%; z-index: 1;`.

### [MODIFY] [global-mobile.css](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/css/global-mobile.css)
- Clean up mobile rules to maintain standard height flow for `.hero`.

---

## 4. Verification Plan

### Manual Verification
1. Open Home, Movies, or Series pages in browser/WebView.
2. Scroll down: confirm the hero background image stays glued to the top of the viewport (`background-attachment: fixed`).
3. Confirm the existing bottom mask gradient moves UP naturally with the scrolling UI elements, fading out the backdrop from bottom to top without any JS scroll manager layer.
