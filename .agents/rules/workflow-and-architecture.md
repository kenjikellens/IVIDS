---
trigger: always_on
---

# Development Workflow & Architecture Standards

## 1. OOP Architecture & Implementation Plans
- **Object-Oriented Structure**: All implementation plans MUST follow robust Object-Oriented Programming (OOP) principles (encapsulation, single responsibility, clean class interfaces).
- **Mandatory Mermaid Diagrams**: Implementation plans MUST include visual architectural diagrams formatted as Mermaid code blocks (`mermaid classDiagram` or `mermaid sequenceDiagram` / SSD) illustrating class structures, methods, function call flows, and IPC/native bridge interactions.

## 2. i18n & Translation Workflow
- **Never Hardcode Text**: Any UI text MUST use translation keys via translation files (`lang/*.json`), never hardcode text in HTML or JS.
- **Base Key Entry**: Always add new translation keys to `en.json` first.
- **Automated Script Translations**: Batch update all 25+ language JSON files using a Python script located in the agent `scratch/` folder (`C:\Users\kenji\.gemini\antigravity-ide\scratch\`).

## 3. UI Mockups & Temporary Files
- **Mockups**: Create requested UI mockups in a dedicated `/mockup/` folder as standalone, offline-capable files (`mockup_[name].html`, `.css`, `.js`). Delete mockup files once integrated into the main application.
- **Temporary Files**: Create scratch scripts, test files, or data dumps in the agent `scratch/` folder and delete them when no longer needed.

## 4. Development Guides & File Navigation
- **Adding a Page**: Create `pages/[name].html`, `pages/[name].js`, `css/[name].css`, add translation keys to `lang/*.json`, and update `js/sidebar/sidebar.js`.
- **File Discovery**: Use `docs/file_list.md` to locate files quickly before navigating directories.
