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

## 4. Forced i18n
- **RULE**: Never hardcode text in HTML or JS.
- **STEP**: Add key to `en.json` first, then update ALL other 25+ language files.

## 5. Mandatory Changelog
- **RULE**: Every file edit MUST be logged in `CHANGELOG.md` immediately after the edit.
- **FORMAT**: `[HH:mm DD-MM-YYYY] filenames.ext - description.`
