---
trigger: always_on
---

# UI, CSS & Animation Standards

## 1. Accent Colors
- Use `var(--primary-color)` for all theme-highlighted elements.
- If the user asks for "green" or "colored" elements, clarify if they mean the accent color.

## 2. Hover & Focus Animations
- Buttons and interactive elements MUST NEVER have scale or translate moving animations (`translateX`, `translateY`, `scale`) on hover/focus.
- The standard hover/focus indicator is ALWAYS a thicker white border.

## 3. Layout & Sizing
- Prefer `%` of the screen container bounds over fixed `px` values for container sizing.

## 4. CSS Rules & Code Style
- All styles MUST be written in external `.css` files. NEVER use inline `style="..."` attributes in HTML.
- NEVER use `!important` in CSS unless strictly unavoidable.
- Prioritize reusing existing CSS classes (e.g., `.playlist-card`, `.poster-wrapper`, `.playlist-overlay`) over writing duplicate styles. Only add new CSS rules when existing classes cannot accomplish the layout.
