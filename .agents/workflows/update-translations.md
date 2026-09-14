---
description: Batch translation protocol to update translation keys across all 37 language files in gui/lang/ using an automated Python script.
---

# Update Translations Workflow

This workflow defines the standardized protocol for adding, modifying, or batch-updating translation keys across all 37 supported languages in the IVIDS application.

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

  # Target language files (all 36 non-English files)
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
          if key not in data:
              data[key] = trans_map.get(lang_code, en_data.get(key, ""))
              
      with open(file_path, "w", encoding="utf-8") as f:
          json.dump(data, f, indent=4, ensure_ascii=False)
          f.write("\n")

  print(f"[OK] Successfully synchronized {len(lang_files)} language files.")
  ```

### 3. Execute via Windows `py` Launcher
- **ACTION**: Execute the script using the Windows Python launcher:
  ```powershell
  py scratch/sync_translations.py
  ```
  *(NEVER invoke via `python`, always use `py`).*

### 4. Validate Language Files
- **ACTION**: Validate JSON syntax across all files to ensure no invalid characters or malformed brackets:
  ```powershell
  py -c "import os, json; dir='app/src/main/assets/main/gui/lang'; [json.load(open(os.path.join(dir, f), encoding='utf-8')) for f in os.listdir(dir) if f.endswith('.json')]; print('All 37 JSON files valid!')"
  ```

### 5. Clean Up Scratch Files
- **ACTION**: Delete the temporary translation script from `scratch/` once execution and validation are complete.
