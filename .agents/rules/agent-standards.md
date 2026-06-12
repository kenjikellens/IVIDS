---
trigger: always_on
---

# AI Agent Implementation Standards

Every AI agent working on IVIDS MUST follow these strict rules.

## 1. Accent Color Usage
- **RULE**: Use `var(--primary-color)` for all theme-highlighted elements.
- **CLARIFICATION**: If the user asks for "green" or "colored" elements, ask if they mean the accent color.

## 2. No Scale Animations
- **RULE**: Buttons NEVER have scale or moving animations on hover/focus.
- **FEEDBACK**: Use a white thicker border for focus/hover.

## 3. Pixel-Less Layout
- **RULE**: Avoid `px` for containers. Use `%` of the screen.

## 6. Temporary Files
- **RULE**: Any temporary file or script (like translation scripts, test files, or data dumps) MUST be created in the agent's `scratch` folder (e.g., `C:\Users\kenji\.gemini\antigravity-ide\scratch\`).
- **CLEANUP**: You must delete any temporary files you created after use (when they are no longer needed).