# IVIDS Documentation Hub

Welcome to the modular documentation for IVIDS. This hub replaces the monolithic `about.md` with structured, easy-to-maintain modules.

## Architecture
- [SPA Router & Lifecycle](architecture/router.md) — How page transitions and history work.
- [Spatial Navigation](architecture/spatial-nav.md) — Geometric focus engine for TV remotes.
- [Internationalization (i18n)](architecture/i18n.md) — Multi-language support and translation application.
- [Update Checker](architecture/updater.md) — Cross-platform native/web automatic update service.

## Logic & Data
- [Content API (TMDB)](logic/api.md) — Integration with The Movie Database and player providers (VidLink, VidSrc.to, Videasy, VidSrc.cc).
- [Data Management & Caching](logic/data-management.md) — LocalStorage, Profiles, and Hybrid Caching.
- [Live TV & M3U](logic/livetv.md) — M3U parsing and IPTV stream integration.

## GUI & Design
- [Design System](gui/design-system.md) — CSS Variables, Units, and UI tokens.
- [Pages & UI (Page Inventory)](gui/pages.md) — Complete screen inventory (Account, Profiles, Playlists, Details, etc.) and page modules.
- [Performance & Optimization](gui/performance.md) — DOM Recycling, Hybrid Caching, and GPU acceleration.

## Issues, Optimizations & Improvements
- [Known Problems & Technical Debt](problems.md) — Inventory of identified bugs, architectural bottlenecks, and active tech debt.
- [Optimization Report](optimalisaties.md) — Detailed code reduction, redundancy removal, and performance plan.
- [Project File List](file_list.md) — Auto-updated inventory of all source files in the project.

## Workflow & Standards
- [Project Agent Standards](../.agents/AGENTS.md) — Core rules, OOCSS standards, git/release guardrails, and interactive skills.
- [UI & Styling Rules](../.agents/rules/ui-and-styling.md) — Unified stylesheets, spatial nav focus, and OOCSS tokens.
- [Architecture & i18n Rules](../.agents/rules/workflow-and-architecture.md) — OOP plans, Mermaid diagrams, and i18n automation.

---
*Single Source of Truth v0.6.4*
