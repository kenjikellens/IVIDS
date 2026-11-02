import os

HTML_PATH = os.path.join("app", "src", "main", "assets", "main", "gui", "pages", "settings.html")

with open(HTML_PATH, "r", encoding="utf-8", newline="") as f:
    content = f.read()

target = """        <div class="modal__footer modal__footer--vertical btn-group btn-group--vertical">
            <button class="btn btn--primary focusable universal-onclick" data-i18n="common.apply">Apply</button>
            <button class="btn btn--secondary btn--sm focusable universal-onclick" data-i18n="common.cancel">Cancel</button>
        </div>"""

replacement = """        <div class="modal__footer btn-group btn-group--end">
            <button class="btn btn--secondary focusable universal-onclick" data-i18n="common.cancel">Cancel</button>
            <button class="btn btn--primary focusable universal-onclick" data-i18n="common.apply">Apply</button>
        </div>"""

content_norm = content.replace("\r\n", "\n")
target_norm = target.replace("\r\n", "\n")
replacement_norm = replacement.replace("\r\n", "\n")

if target_norm in content_norm:
    new_content = content_norm.replace(target_norm, replacement_norm).replace("\n", "\r\n")
    with open(HTML_PATH, "w", encoding="utf-8", newline="") as f:
        f.write(new_content)
    print("settings.html successfully updated!")
else:
    print("Target not found in settings.html")

