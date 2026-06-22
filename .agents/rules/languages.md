---
trigger: always_on
---

# Forced i18n & Translation Workflow

1. **Never hardcode text**: Any mention of adding new text to the UI must use the translation files (never hardcode text in HTML or JS).
2. **Add to base first**: Always add new translation keys to `en.json` first.
3. **Use the script for translations**: You must update all other 25+ language JSON files in the `lang/` directory using a script instead of editing each file individually. This script MUST be written in the agent's `scratch` folder (e.g. `C:\Users\kenji\.gemini\antigravity-ide\scratch\`). This rule applies **ONLY** to updating translation JSON files in the `lang/` folder. For modifying standard application source files (such as `.js`, `.css`, or `.html` files), you must use the standard file-editing tools directly, not Python scripts.
4. If you have any more questions, read the `about.md` file in the workspace.
