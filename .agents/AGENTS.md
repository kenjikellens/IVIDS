# Project-Specific Standards for IVIDS Development

All project-specific development standards, invariants, and procedural workflows for IVIDS are organized under `.agents/`:

## 1. Core Development Rules (`.agents/rules/`)
These rules are active on every turn (`trigger: always_on`) to enforce quality, consistency, and safety guardrails:

1. **[UI, CSS & Animation Standards](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/rules/ui-and-styling.md)**: Unified stylesheet architecture (`global.css`, `global-mobile.css`), color tokens, hover/focus white border standards, spatial navigation focus (`.focusable`), and CSS comment annotations.
2. **[Git, Build, APK Signing & Release Rules](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/rules/git-and-releases.md)**: Main branch push prohibition, build autonomy restrictions (`build.bat`), mandatory pre-release builds, APK keystore signing (`keystore.jks`), and SDK target limits (API 35).
3. **[Development Workflow & Architecture Standards](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/rules/workflow-and-architecture.md)**: OOP architectural plans with mandatory Mermaid diagrams (Class/Sequence), strict i18n policy (no raw text), Windows `py` launcher requirement, method JSDoc documentation, and scratch cleanup.

## 2. Interactive Workflows (`.agents/workflows/`)
Step-by-step procedural runbooks invoked via slash commands or recommended when relevant:

1. **[/version-and-release-update](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/workflows/version-and-release-update.md)**: Protocol for bumping semantic versions, running parallel builds (`IVIDS.exe` and `IVIDS.apk`), tagging the commit, pushing tags, and publishing a verified GitHub Release.
2. **[/add-page](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/workflows/add-page.md)**: End-to-end walkthrough for creating new views (HTML template, JS controller, `global.css`, `sidebar.html`, `router.js`, and i18n keys).
3. **[/update-translations](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/workflows/update-translations.md)**: Batch translation workflow to sync translation keys across all language files in `gui/lang/` using Python scripts in `scratch/`.
4. **[/oocss-refactor](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/workflows/oocss-refactor.md)**: Phased protocol for refactoring CSS components to Object-Oriented CSS (OOCSS), updating HTML/JS templates in synchronized batches, and purging redundant container overrides.

