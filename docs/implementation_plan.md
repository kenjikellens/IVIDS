# Plan: Custom Widescreen Containers for Collections Rows

We will introduce a dedicated container class for collections rows to ensure the 16:9 cards fit beautifully without empty space and display in the correct aspect ratio.

## Dynamic Discovery (Softcoded Explanation)
The reason collections like **Mortal Kombat (Reboot) Collection**, **Michael Collection**, and **The Super Mario Collection** are appearing is because their upcoming sequels/biopics (e.g. *Mortal Kombat 2* (2025), *Michael* (2025/2026), and *The Super Mario Bros. Movie 2* (2026)) are currently highly popular/trending on TMDB. 

Since our discovery logic is **100% softcoded**, it resolves these parent franchises dynamically from the trending list. There is **zero hardcoded mention** of these movie names in the code.

## User Review Required

> [!IMPORTANT]
> **Container layout changes**:
> 1. Set `.collection-row-container` and `.collection-posters` min-height to `auto` (overriding standard poster row min-height of ~250px).
> 2. Make collections rows fit the cards exactly with minimal padding.
> 3. Card dimensions adjusted to `clamp(240px, 20vw, 320px)` width and `16/9` height auto-resolved.
> 
> Does this structure look good to you?

---

## Proposed Changes

### UI Helper

#### [MODIFY] [ui-helper.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/utils/ui-helper.js)

Update the container creation logic in `setupCollectionRow` to assign the `.collection-row-container` class instead of `.row-container`, and the `.collection-posters` class instead of `.row-posters`.

- **Container**: `row-container collection-row-container`
- **Posters List**: `row-posters collection-posters`

---

### Home & Series Templates

#### [MODIFY] [home.html](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/home.html)
#### [MODIFY] [series.html](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/series.html)

Add the `.collection-posters` class to the popular collections div:
```html
<div class="row-posters collection-posters" id="popular-collections-row"></div>
```

---

### CSS Styling

#### [MODIFY] [global.css](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/css/global.css)

Update the CSS section for Collections to override the heights:

```css
/* Custom height for collection rows to fit 16:9 cards perfectly */
.collection-row-container {
    min-height: auto !important;
    margin-bottom: 24px;
}

.collection-posters {
    min-height: auto !important;
    padding-top: 8px !important;
    padding-bottom: 12px !important;
    display: flex;
    gap: 16px;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: none;
    width: 100%;
}

/* Widescreen 16:9 clickable card used in Collections grids and rows. */
.collection-card {
    align-self: center; /* Prevents vertical stretching in flex container rows */
    aspect-ratio: 16 / 9 !important;
    background: #101010;
    border: 3px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    flex: 0 0 clamp(240px, 20vw, 320px) !important;
    height: auto !important;
    overflow: hidden;
    padding: 0;
    position: relative;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    width: clamp(240px, 20vw, 320px) !important;
}
```

---

## Verification Plan

### Manual Verification
- Load Home / Series page.
- Verify Popular Collections row fits nicely without excessive top/bottom spacing.
- Verify cards are exactly 16:9 aspect ratio and not stretched.
