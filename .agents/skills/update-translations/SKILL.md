---
name: update-translations
description: Batch translation protocol to update translation keys across all language files in gui/lang/ using an automated Python script.
---

# Update Translations Workflow

This workflow defines the standardized protocol for adding, modifying, or batch-updating translation keys across all supported language files in the IVIDS application.

---

## 🛠️ Step-by-Step Translation Protocol

### 1. Define Base Keys in English
- **File**: [app/src/main/assets/main/gui/lang/en.json](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/lang/en.json)
- **ACTION**: Always define the canonical key name and English text in `en.json` first.
  - Group keys logically by feature area (e.g., `"nav"`, `"player"`, `"settings"`, `"livetv"`).
  - Use lowercase dotted notation: `"settings.playback_speed"`.

### 2. Create the Batch Translation Script
- **STRICT RULE**: You are strictly FORBIDDEN from editing individual `lang/*.json` files manually one by one.
- **DIRECT AUTHORING RULE (NO ONLINE APIS)**: The agent MUST write/author all translation strings directly inside the Python script's `new_translations` dictionary. NEVER make external HTTP calls or use online translation APIs (e.g. Google Translate / DeepL endpoints). All translations must be 100% self-contained in the script code so it executes offline in under a second.
- **Location**: Place the translation script in the workspace or agent scratch folder (e.g., `scratch/sync_translations.py`).
- **Python Script Structure**:
  ```python
  import os
  import json

  LANG_DIR = os.path.join("app", "src", "main", "assets", "main", "gui", "lang")
  EN_PATH = os.path.join(LANG_DIR, "en.json")

  with open(EN_PATH, "r", encoding="utf-8") as f:
      en_data = json.load(f)

  # Target language files (all non-English files)
  lang_files = [f for f in os.listdir(LANG_DIR) if f.endswith(".json") and f != "en.json"]

  # Translation dictionary directly authored by the agent
  new_translations = {
      # "key.name": {"nl": "...", "de": "...", "fr": "...", "es": "...", ...}
  }

  for lang_file in lang_files:
      lang_code = os.path.splitext(lang_file)[0]
      file_path = os.path.join(LANG_DIR, lang_file)
      
      with open(file_path, "r", encoding="utf-8") as f:
          data = json.load(f)
      
      # Apply translations or fallback to English if translation is pending
      for key, trans_map in new_translations.items():
          target_val = trans_map.get(lang_code, en_data.get(key, ""))
          data[key] = target_val
          
      with open(file_path, "w", encoding="utf-8") as f:
          json.dump(data, f, ensure_ascii=False, indent=2)
  ```

### 3. Execute the Script
- Run the script with Python (Always use the `py` launcher on Windows):
  ```powershell
  py scratch/sync_translations.py
  ```

### 4. Verification & Validation
- Check git status to ensure all 32 language files are consistently modified:
  ```powershell
  git status
  ```
- Inspect a few sample files (e.g., `nl.json`, `de.json`, `es.json`) to confirm valid JSON formatting and correct string values.
- Clean up the scratch script once verified:
  ```powershell
  Remove-Item scratch/sync_translations.py
  ```

