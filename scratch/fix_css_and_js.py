import os

CSS_PATH = os.path.join("app", "src", "main", "assets", "main", "gui", "css", "global.css")
JS_PATH = os.path.join("app", "src", "main", "assets", "main", "gui", "pages", "settings.js")

# 1. Update global.css
with open(CSS_PATH, "r", encoding="utf-8", newline="") as f:
    css_content = f.read()

target_css = """/* Landscape/TV Language modal dialog container - Expands width for 3-column remote navigation grid */
#language-modal .modal__dialog { max-width: 880px; width: 90vw; }
/* Landscape/TV Language modal body - Scrollable container for TV remote spatial navigation */
#language-modal .modal__body { box-sizing: border-box; max-height: 58vh; overflow-y: auto; padding: 8px 14px 16px; scroll-behavior: smooth; }
/* Landscape/TV Language selection grid - 3-column structured grid for deterministic D-pad vectors */
#language-modal .language-selection-grid { box-sizing: border-box; display: grid; gap: 12px; grid-template-columns: repeat(3, 1fr); padding: 4px 2px; width: 100%; }
/* Landscape/TV Language selection grid - 2-column fallback for compact landscape viewports */
@media (max-width: 1024px) {
    #language-modal .language-selection-grid { grid-template-columns: repeat(2, 1fr); }
}
/* Landscape/TV Language stepper container - Hidden in landscape mode in favor of the full 3-column grid */
#language-modal .language-stepper-container { display: none !important; }
/* Landscape/TV Language modal footer - Horizontal button alignment for TV navigation */
#language-modal .modal__footer { border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex !important; flex-direction: row !important; gap: 12px !important; justify-content: flex-end !important; margin-top: 16px !important; padding-top: 14px !important; width: 100% !important; }
/* Landscape/TV Language modal footer buttons - Consistent button sizing for TV remote confirmation */
#language-modal .modal__footer .btn { min-width: 130px; }"""

replacement_css = """/* Landscape/TV Language modal dialog container - Expands width for 3-column remote navigation grid */
#language-modal .modal__dialog { max-width: 880px; width: 90vw; }
/* Landscape/TV Language modal body - Scrollable container for TV remote spatial navigation */
#language-modal .modal__body { box-sizing: border-box; max-height: min(62vh, 480px); overflow-y: auto; padding: 12px 14px 18px; scroll-behavior: smooth; scroll-padding-top: 10px; scroll-padding-bottom: 10px; scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.25) transparent; }
/* Landscape/TV Language modal body scrollbar track */
#language-modal .modal__body::-webkit-scrollbar { display: block !important; width: 6px; }
/* Landscape/TV Language modal body scrollbar thumb */
#language-modal .modal__body::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.25); border-radius: 4px; }
/* Landscape/TV Language selection grid - 3-column structured grid for deterministic D-pad vectors */
#language-modal .language-selection-grid { box-sizing: border-box; display: grid; gap: 12px; grid-template-columns: repeat(3, 1fr); padding: 4px 2px; width: 100%; }
/* Landscape/TV Language selection grid - 2-column fallback for compact landscape viewports */
@media (max-width: 1024px) {
    #language-modal .language-selection-grid { grid-template-columns: repeat(2, 1fr); }
}
/* Landscape/TV Language stepper container - Hidden in landscape mode in favor of the full 3-column grid */
#language-modal .language-stepper-container { display: none !important; }
/* Landscape/TV Language modal footer - Horizontal button alignment for TV navigation */
#language-modal .modal__footer { border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex !important; flex-direction: row !important; gap: 12px !important; justify-content: flex-end !important; align-items: center !important; margin-top: 16px !important; padding-top: 14px !important; width: 100% !important; }
/* Landscape/TV Language modal footer buttons - Consistent button sizing for TV remote confirmation */
#language-modal .modal__footer .btn { flex: 0 0 auto !important; min-width: 140px !important; width: auto !important; }"""

css_norm = css_content.replace("\r\n", "\n")
target_css_norm = target_css.replace("\r\n", "\n")
replacement_css_norm = replacement_css.replace("\r\n", "\n")

if target_css_norm in css_norm:
    new_css = css_norm.replace(target_css_norm, replacement_css_norm).replace("\n", "\r\n")
    with open(CSS_PATH, "w", encoding="utf-8", newline="") as f:
        f.write(new_css)
    print("global.css updated successfully!")
else:
    print("target_css NOT found in global.css")

# 2. Update settings.js
with open(JS_PATH, "r", encoding="utf-8", newline="") as f:
    js_content = f.read()

target_js = """            if (focusTarget && typeof focusTarget.scrollIntoView === 'function') {
                focusTarget.scrollIntoView({ block: 'nearest', behavior: 'auto' });
            }"""

replacement_js = """            if (focusTarget && typeof focusTarget.scrollIntoView === 'function') {
                focusTarget.scrollIntoView({ block: 'center', behavior: 'auto' });
            }"""

js_norm = js_content.replace("\r\n", "\n")
target_js_norm = target_js.replace("\r\n", "\n")
replacement_js_norm = replacement_js.replace("\r\n", "\n")

if target_js_norm in js_norm:
    new_js = js_norm.replace(target_js_norm, replacement_js_norm).replace("\n", "\r\n")
    with open(JS_PATH, "w", encoding="utf-8", newline="") as f:
        f.write(new_js)
    print("settings.js updated successfully!")
else:
    print("target_js NOT found in settings.js")

