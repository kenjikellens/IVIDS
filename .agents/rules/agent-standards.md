---
trigger: always_on
---

# AI Agent Implementation Standards

Every AI agent working on IVIDS MUST follow these strict rules.

## 1. Accent Color Usage
- **RULE**: Use `var(--primary-color)` for all theme-highlighted elements.
- **CLARIFICATION**: If the user asks for "green" or "colored" elements, ask if they mean the accent color.

## 2. No Scale Animations
- **RULE**: NEVER add moving animations on hover/focus yourself, unless the user wants to.
- **FEEDBACK**: Use a white thicker border for focus/hover.

## 3. Pixel-Less Layout
- **RULE**: Avoid `px` for containers. Use `%` of the screen.

## 4. No Browser Subagent
- **RULE**: DO NOT use the browser subagent autonomously for testing, visual checks, or navigating. You are only allowed to use it if explicitly instructed by the user.

## 6. Temporary Files
- **RULE**: Any temporary file or script (like translation scripts, test files, or data dumps) MUST be created in the agent's `scratch` folder (e.g., `C:\Users\kenji\.gemini\antigravity-ide\scratch\`).
- **CLEANUP**: You must delete any temporary files you created after use (when they are no longer needed).

## 7. Class Reusability & CSS Minimization
- **RULE**: ALWAYS prioritize reusing already made CSS classes (e.g. `.playlist-card`, `.playlist-cover`, `.playlist-overlay`, `.poster-wrapper`, etc.) instead of writing duplicate styles or creating new classes, most classes for buttons are already defined.
- **RULE**: Only add new CSS rules when absolutely necessary for custom layouts that cannot be achieved using existing class declarations.

## 8. Android Build & Version Code Rules
- **RULE**: The Android `versionCode` in `app/build.gradle.kts` MUST be automatically incremented by 1 every time `build.bat` runs.
- **RULE**: The `versionName` (e.g., `v0.4.5`) MUST remain unchanged during local compilations, and only change when initiating an official version update.
- **RULE**: Do NOT bypass the `increment-version-code.js` auto-increment script in the build chain.