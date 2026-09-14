---
trigger: always_on
---

# Development Workflow & Architecture Standards

## 1. OOP Architecture & Implementation Plans
- **Object-Oriented Structure**: All implementation plans MUST follow robust Object-Oriented Programming (OOP) principles (encapsulation, single responsibility, clean class interfaces).
- **Mandatory Mermaid Diagrams**: Implementation plans MUST include visual architectural diagrams formatted as Mermaid code blocks (`mermaid classDiagram` or `mermaid sequenceDiagram` / SSD) illustrating class structures, methods, function call flows, and IPC/native bridge interactions.

## 2. i18n & Translation Standards
- **Never Hardcode Text**: UI text MUST NEVER be hardcoded directly in HTML or JavaScript. Always use `data-i18n` attributes in HTML templates or `window.i18n.t('key')` in JavaScript.
- **Base Key Entry**: Always add new translation keys to [en.json](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/lang/en.json) first.
- **Automated Script Translations**: Updates to translation files (`app/src/main/assets/main/gui/lang/*.json`) across all language files MUST be performed using an automated Python script. Follow the dedicated workflow [/update-translations](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/workflows/update-translations.md). NEVER manually edit individual language JSON files one by one.
- **Direct Authoring in Script (No Online APIs/Web Scraping)**: The agent MUST write/author all translation strings directly in the Python script's dictionary (`new_translations = { ... }`). NEVER make external HTTP requests or scrape online translation services (e.g. Google Translate / DeepL endpoints), which introduce rate limits, slow execution, and fragile dependencies. The script must be completely self-contained and run instantly offline.

## 3. Windows Python Execution Guardrail
- **Launcher Rule**: Always execute Python scripts on Windows using the `py` launcher command (e.g., `py ...`), NEVER `python`.

## 4. Method-Level Documentation
- **Mandatory Doc Blocks**: Every single function or method created, modified, or refactored MUST have a concise (1-2 sentences) documentation block directly above it (JSDoc for JS, Docstring for Python).
- **Content**: Explain precisely what the method does and which parts of the application or state it affects.

## 5. UI Mockups & Scratch File Hygiene
- **Mockups**: Create requested UI mockups in a dedicated `/mockup/` folder as standalone, offline-capable files (`mockup_[name].html`, `.css`, `.js`). Delete mockup files once integrated into the main application.
- **Temporary Files**: Create scratch scripts, test files, or data dumps in the agent `scratch/` folder and delete them when no longer needed.

## 6. File Discovery & Procedural Workflows
- **File Discovery**: Consult [docs/file_list.md](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/docs/file_list.md) to locate files across the project before navigating directories.
- **Adding New Pages**: To create and wire a new view into the navigation and routing system, follow the dedicated workflow [/add-page](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/workflows/add-page.md).

