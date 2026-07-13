# Mobile UI Inconsistencies

This document lists visual layout and design inconsistencies found in the IVIDS application when rendered in mobile portrait viewports (e.g., 375x812).

---

## 1. Disconnected Wi-Fi Overlay Icon
* **Issue:** The yellow/orange "disconnected" status icon is absolute-positioned in the bottom-right corner. On narrow/mobile screens, this icon floats directly over and obscures the **Settings** gear icon in the bottom navigation bar.
* **Impact:** High. Users in offline mode cannot tap or see the settings icon properly.

## 2. Bottom Navigation Bar Highlighting
* **Issue:** The active tab border/highlight (e.g., around the active **Search** icon) is disproportionately large, causing alignment issues and breaking the visual rhythm of the navigation items.
* **Impact:** Medium. Looks unpolished and breaks the spacing of the nav items.

## 3. Filter Modal Height and Overflow
* **Issue:** In the search filter modal, the content card is excessively tall. Filters like the **Year** input field are completely pushed off the bottom of the screen and cannot be accessed or seen.
* **Impact:** High. Users cannot filter content by year on mobile.

## 4. Hero Banner Layout
* **Issue:** The description text in the hero slider on the main page is abruptly truncated (e.g., `...will seize every...`) and the **Play** button spans the entire width of the container in a squished layout, which does not look premium.
* **Impact:** Low. Aesthetics look unpolished on smaller viewports.

## 5. Poster Row Scaling
* **Issue:** Poster rows (such as "Highly Rated") do not scale their card elements down for mobile screens. The poster items remain too large, resulting in excessive horizontal clipping.
* **Impact:** Medium. Visual design feels unoptimized for mobile.
