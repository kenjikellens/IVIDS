import json
import os
import glob

LANG_DIR = os.path.join("app", "src", "main", "assets", "main", "gui", "lang")
EN_FILE = os.path.join(LANG_DIR, "en.json")

def sync_translations():
    if not os.path.exists(EN_FILE):
        print(f"Error: Base language file not found at {EN_FILE}")
        return

    with open(EN_FILE, "r", encoding="utf-8") as f:
        try:
            en_data = json.load(f)
        except json.JSONDecodeError as e:
            print(f"Error parsing en.json: {e}")
            return

    lang_files = glob.glob(os.path.join(LANG_DIR, "*.json"))
    updated_count = 0

    for lang_file in lang_files:
        if lang_file == EN_FILE:
            continue
        
        with open(lang_file, "r", encoding="utf-8") as f:
            try:
                lang_data = json.load(f)
            except json.JSONDecodeError:
                lang_data = {}
        
        needs_update = False
        
        for key, value in en_data.items():
            if key not in lang_data:
                lang_data[key] = value  # Fallback to English text
                needs_update = True
        
        if needs_update:
            with open(lang_file, "w", encoding="utf-8") as f:
                json.dump(lang_data, f, ensure_ascii=False, indent=2)
            print(f"Updated {os.path.basename(lang_file)} with missing keys.")
            updated_count += 1
            
    print(f"Synchronization complete. {updated_count} files updated.")

if __name__ == "__main__":
    sync_translations()
