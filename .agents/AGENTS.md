# Project-Specific Standards for IVIDS Development

All project-specific development standards, invariants, and procedural workflows for IVIDS are organized under `.agents/`:

## 1. Core Development Rules (`.agents/rules/`)
These rules are active on every turn (`trigger: always_on`) to enforce quality, consistency, and safety guardrails:

1. **[UI, CSS & Animation Standards](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/rules/ui-and-styling.md)**: Unified stylesheet architecture (`global.css`, `global-mobile.css`), distinct mobile portrait vs. landscape/desktop/TV mode styling boundaries, OOCSS component architecture (`.btn`, `.card`, `.media-grid`, `.nav-rail`, `.modal`), spatial navigation focus (`.focusable`), CSS comment annotations, critical splash FOUC prevention, and Dark Mode engine protection.
2. **[Git, Build, APK Signing & Release Rules](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/rules/git-and-releases.md)**: Main branch push prohibition, build autonomy restrictions (`build.bat`), mandatory pre-release builds, APK keystore signing (`keystore.jks`), and SDK target limits (API 35).
3. **[Development Workflow & Architecture Standards](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/rules/workflow-and-architecture.md)**: OOP architectural plans with mandatory Mermaid diagrams (Class/Sequence), strict i18n policy (no raw text), Windows `py` launcher requirement, method JSDoc documentation, and scratch cleanup.

## 2. Interactive Workflows & Skills (`.agents/skills/`)
Step-by-step procedural runbooks invoked via slash commands or recommended when relevant:

1. **[/build-and-release](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/skills/build-and-release/SKILL.md)**: Protocol for bumping semantic versions, running parallel builds (`IVIDS.exe` and `IVIDS.apk`), tagging the commit, pushing tags, and publishing a verified GitHub Release.
2. **[/add-page](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/skills/add-page/SKILL.md)**: End-to-end walkthrough for creating new views (HTML template, JS controller, `global.css`, `sidebar.html`, `router.js`, and i18n keys).
3. **[/update-translations](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/skills/update-translations/SKILL.md)**: Batch translation workflow to sync translation keys across all language files in `gui/lang/` using Python scripts in `scratch/`.
4. **[/oocss-refactor](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/skills/oocss-refactor/SKILL.md)**: Phased protocol for refactoring CSS components to Object-Oriented CSS (OOCSS), updating HTML/JS templates in synchronized batches, and purging redundant container overrides.
5. **[/build-and-push-main](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/skills/build-and-push-main/SKILL.md)**: Protocol for compiling Windows EXE and Android APK binaries, verifying packaging, and pushing commit history directly to main without creating releases or tags.

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

## 4. CSS Class Reuse Contract (OOCSS) — MANDATORY Before Writing Any CSS, HTML or JS Markup

**Core principle: the same component = the same class, everywhere.** A class name describes WHAT an element is (button, title, row, badge), NEVER WHERE it lives (page, feature, `#id`). Two elements that look and behave the same MUST share the same classes, in HTML templates AND in JS-generated markup.

> Example of the failure this rule prevents: the Hero play button (`#play-btn`), the Details play button (`#details-play`) and the Login submit button (`#login-submit`) each had their own CSS block with slightly different font sizes, heights and radii. They are the same component and MUST all be `class="btn btn--primary focusable"` with `btn__icon` + `btn__label` children, styled ONCE.

### 4.1 Decision flow — follow it in this exact order before adding ANY class
1. **Search first**: grep `global.css` and `global-mobile.css` for an existing base class that matches the component (see catalog 4.5).
2. **Exists and fits?** → Use it as-is. Done.
3. **Only differs in size, shape, color or layout?** → Add a BEM modifier on the existing base (`.btn--sm`, `.card--compact`, `.badge--outline`). Modifiers contain ONLY the differing properties.
4. **Truly a new kind of component that no base can express?** → Only then create ONE new generic base class (e.g. `.empty-state`, never `.playlists-empty-state`), with a comment above it listing the pages/components that consume it.
5. In your response, explicitly name every NEW class you created and why no existing class could be reused.

### 4.2 Strictly forbidden
- **Page/feature-prefixed classes for generic components**: `.details-play-btn`, `.login-title-text`, `.update-version-badge`, `.extras-empty-text`, `.settings-header h1`.
- **ID selectors for styling** (`#play-btn { ... }`, `#login-submit { ... }`). IDs are for JS hooks only.
- **Context overrides that restyle a shared component in one place**: `.modal__footer .btn { ... }`, `.login-panel .form-input { ... }`. Use a modifier or a container object (`.btn-group--fill`) instead.
- **Duplicate definitions**: the same selector or the same component defined in two blocks of the same file.
- **Mobile-only or icon-only duplicate classes** (`.mobile-play-icon`, `.details-back-icon`, `.trash-icon`): icons inside buttons are always `.btn__icon`, labels `.btn__label`.
- **Per-state icon color rules**: icons are masks with `background-color: currentColor`; set `color` on the component per state and the icon follows. Never add separate `background-color` rules on icons for `:hover` / `.is-active` / `:focus`.

### 4.3 Viewport separation (one class name, two skins)
- Every shared class is styled **once in `global.css`** (Landscape / Desktop / TV) and, where mobile looks different, **once in `global-mobile.css`** (Mobile portrait) — using the SAME class name.
- The skins are intentionally DIFFERENT and MUST NEVER be merged or copied across files. Example: `.btn--primary` is translucent green with a white focus border in `global.css`, but solid white with dark text in `global-mobile.css`.
- Unify only WITHIN a viewport file (e.g. all mobile list rows share one mobile row base; all landscape list rows share one landscape card base).

### 4.4 Base vs. modifier layout (DRY)
- The **base selector** holds all shared structure and skin (display, alignment, padding, radius, background, border, typography, transitions).
- **Modifiers and states** hold only the properties that differ. When several components share an identical base, group them in ONE selector list instead of repeating declarations.
- State rule order inside a component (equal specificity): `default → active → hover → focus`, so D-pad focus (white border `#ffffff`) always wins.

### 4.5 Canonical component catalog (reuse these — do not reinvent)
| Component | Classes |
| :--- | :--- |
| Buttons | `.btn` + skin `--primary` / `--secondary` / `--danger` / `--ghost`, size/shape `--sm` / `--md` / `--lg` / `--block` / `--circle` / `--fixed-min`; children `.btn__icon`, `.btn__label`; container `.btn-group` (`--fill`, `--vertical`, `--end`) |
| Headings | `.title-hero` (hero/details), `.page-title` (page `h1`), `.section-title` / `.row-title`, `.section-subtitle`, `.modal__title` |
| Cards & grids | `.card` (`--poster`, `--widescreen`, `--row`, `--panel`, `--compact`, `--interactive`), `.media-rail`, `.media-grid` (`--posters`, `--cast`) |
| List / selection rows | `.setting-item`, `.language-card`, `.provider-item` (landscape: rounded cards; mobile: edge-to-edge divider rows sharing one base) |
| Modals | `.modal`, `.modal__dialog` (`--sm`…`--xl`), `.modal__title`, `.modal__desc`, `.modal__body`, `.modal__footer`, `.modal__back-btn` |
| Forms | `.form-control-wrapper`, `.form-input`, `.form-select-wrapper`, `.form-select`, `.form-toggle` |
| Chips & badges | `.chip` (`--option`, `--recent`, `--rating`, `--color`), `.chip-grid`, `.badge` (`--primary`, `--glass`, `--outline`) |
| Feedback | `.empty-state` + `.empty-state__text`, `.toast` |
| Navigation | `.nav-rail`, `.nav-item`, `.nav-item__icon`, `.nav-item__label` |

### 4.6 When you find duplicates
Migrate EVERY HTML and JS reference to the general class, delete the old class/`#id` rules from BOTH CSS files, then grep the whole repo (`.html`, `.js`, `.css`) and confirm **0 hits** for the removed names. Large clean-ups follow the [/oocss-refactor](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/.agents/skills/oocss-refactor/SKILL.md) skill.

