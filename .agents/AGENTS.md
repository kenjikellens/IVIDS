# Project-Specific Standards for IVIDS Development

All project-specific development standards, invariants, and procedural workflows for IVIDS are organized under `.agents/`:

## 1. Core Development Rules (`.agents/rules/`)
These rules are active on every turn (`trigger: always_on`) to enforce quality, consistency, and safety guardrails:

1. **[UI, CSS & Animation Standards](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/rules/ui-and-styling.md)**: Unified stylesheet architecture (`global.css`, `global-mobile.css`), distinct mobile portrait vs. landscape/desktop/TV mode styling boundaries, OOCSS component architecture (`.btn`, `.card`, `.media-grid`, `.nav-rail`, `.modal`), spatial navigation focus (`.focusable`), CSS comment annotations, critical splash FOUC prevention, and Dark Mode engine protection.
2. **[Git, Build, APK Signing & Release Rules](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/rules/git-and-releases.md)**: Main branch push prohibition, build autonomy restrictions (`build.bat`), mandatory pre-release builds, APK keystore signing (`keystore.jks`), and SDK target limits (API 35).
3. **[Development Workflow & Architecture Standards](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/rules/workflow-and-architecture.md)**: OOP architectural plans with mandatory Mermaid diagrams (Class/Sequence), strict i18n policy (no raw text), Windows `py` launcher requirement, method JSDoc documentation, and scratch cleanup.

## 2. Interactive Workflows (`.agents/workflows/`)
Step-by-step procedural runbooks invoked via slash commands or recommended when relevant:

1. **[/version-and-release-update](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/workflows/version-and-release-update.md)**: Protocol for bumping semantic versions, running parallel builds (`IVIDS.exe` and `IVIDS.apk`), tagging the commit, pushing tags, and publishing a verified GitHub Release.
2. **[/add-page](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/workflows/add-page.md)**: End-to-end walkthrough for creating new views (HTML template, JS controller, `global.css`, `sidebar.html`, `router.js`, and i18n keys).
3. **[/update-translations](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/workflows/update-translations.md)**: Batch translation workflow to sync translation keys across all language files in `gui/lang/` using Python scripts in `scratch/`.
4. **[/oocss-refactor](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/workflows/oocss-refactor.md)**: Phased protocol for refactoring CSS components to Object-Oriented CSS (OOCSS), updating HTML/JS templates in synchronized batches, and purging redundant container overrides.
5. **[/build-and-push-main](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/.agents/workflows/build-and-push-main.md)**: Protocol for compiling Windows EXE and Android APK binaries, verifying packaging, and pushing commit history directly to main without creating releases or tags.

## 3. General Agent Discipline & Self-Critique Guardrails (CRITICAL)

### Anti-Patterns to Strictly Avoid
1. **No Repetitive Analysis Paralysis**:
   - NEVER loop repeatedly through read or diff commands without taking action. If a problem or user critique is raised, identify the root cause logically in a single step, make the targeted edit, and verify immediately.
   - Stop reading unrelated backend, server, or script files (`run_pc.py`, etc.) when the issue is in GUI templates or stylesheets.

2. **No Unrequested Class Removal or Ad-Hoc Renaming**:
   - NEVER strip, alter, or rename existing structural classes (e.g. `edit-trigger`, `btn`, `btn--square`, `modal__back-btn`) across working HTML components unless explicitly instructed with a fully coordinated CSS migration plan.
   - Stripping established classes causes catastrophic styling regressions across responsive viewports where media queries rely on those exact selectors.

3. **Strict Separation of Viewport Styling Domains**:
   - "Unified styling" means internal consistency **within that specific viewport environment**:
     - **Mobile Viewport (`global-mobile.css`)**: Edge-to-edge touch rows, subtle border dividers, instant auto-apply on tap, hidden dialog footers, and native YouTube-style arrow chevrons.
     - **Landscape / Desktop / TV Viewport (`global.css`)**: Standalone rounded cards (`var(--radius-md)`), 10px spacing, tactile hover states, and thick white D-pad focus outlines (`outline: 2px solid #ffffff`).
   - NEVER copy, merge, or force mobile flat list styling into desktop/TV dialogs, and NEVER bleed desktop button sizing or square triggers into mobile viewports.

4. **Listen Immediately & Execute Directly**:
   - When the user asks for a specific correction (e.g. vertical layout instead of a grid, fixing broken icon geometry), execute that exact task immediately.
   - Do NOT procrastinate, do NOT start refactoring unrelated code, and do NOT require the user to repeat or shout instructions before acting.

5. **Task Tracking Discipline**:
   - You MUST always update the `task.md` artifact whenever the user requests a task, gives feedback, or criticizes an action, so progress and pending items are never lost.
