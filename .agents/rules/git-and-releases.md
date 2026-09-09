---
trigger: always_on
---

# Git, Build, APK Signing & Release Rules

## 1. Git Safety & Branch Protection
- **Strict Prohibition on Autonomous Commits & Pushes**: You are strictly FORBIDDEN from executing `git commit` or `git push` commands autonomously. Authorization to commit or push applies ONLY to that specific turn when explicitly and directly instructed by the user in the chat (e.g., "commit these changes" or "push to main").
- **Branch Push vs. Release Distinction**: Instructing "push to main" authorizes ONLY pushing existing commit history to `main`. It does NOT authorize creating Git tags, bumping versions, or publishing GitHub releases.
- **Allowed Diagnostic Git Commands**: Diagnostic commands such as `git status`, `git diff`, `git fetch`, `git pull`, `git stash`, `git branch`, and `git log` are fully permitted to inspect state, diagnose issues, or resolve merge conflicts.

## 2. Build Script & Execution Guardrails
- **DO NOT RUN BUILD.BAT AUTONOMOUSLY**: NEVER run `build.bat` on your own initiative during normal feature development, debugging, or after standard file edits. `build.bat` MUST ONLY be executed when the user explicitly instructs you to build, or when executing an explicitly requested release flow.
- **Mandatory Pre-Push/Pre-Release Build**: When authorized to push to `main` or make a release, ALWAYS execute `.\build.bat` (or `.\build.bat release`) first to ensure builds and packaging succeed before pushing.
- **Dedicated Release Workflow**: All official releases, version bumps, and tag pushes MUST strictly follow the dedicated interactive workflow [version-and-release-update.md](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/.agents/workflows/version-and-release-update.md).
- **Explicit Failure Notification**: If any build step, tag creation, remote push, or GitHub release fails, STOP immediately and notify the user.

## 3. APK Signing & SDK Target Requirements
- **APK Signing Configuration**: Both `release` and `debug` build types in [build.gradle.kts](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/build.gradle.kts) MUST reference `keystore.jks` located in the workspace root (`alias: ivids`, `password: ivids2025`). NEVER remove or alter signing configurations.
- **SDK Target Limitation**: NEVER set `compileSdk` or `targetSdk` to unreleased or developer-preview API levels (e.g., API 36 / Android 16 preview). Stick strictly to stable, finalized SDK versions (API 35).
- **Version Code Synchronization**: `versionCode` in `app/build.gradle.kts` MUST auto-increment via [increment-version-code.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/increment-version-code.js) on every `build.bat` run. Synchronize Tizen [config.xml](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/config.xml) versions during official releases.

