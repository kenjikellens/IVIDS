---
trigger: always_on
---

# Forced i18n & Translation Workflow

1. **Never hardcode text**: Any mention of adding new text to the UI must use the translation files (never hardcode text in HTML or JS).
2. **Add to base first**: Always add new translation keys to `en.json` first.
3. **Use the script**: You must update all other 25+ language files using a script instead of editing each file individually.
4. If you have any more questions, read the `about.md` file in the workspace.
