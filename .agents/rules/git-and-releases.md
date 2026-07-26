---
trigger: always_on
---

# Git, Build, APK Signing & Release Rules

## 1. Git Push & Main Branch Safety
- **No Autonomous Pushes to Main**: Standard code or document edits MUST NOT be committed or pushed autonomously. Authorization to commit/push applies ONLY to that specific turn when explicitly instructed (e.g. "push to main").
- **Code Push vs. Release Separation**: Instructing "push to main" authorizes ONLY pushing commit history to `main`. It does NOT authorize creating Git tags or GitHub releases.

## 2. Release Workflows
- **Autonomous Release Execution**: When explicitly instructed to make a release (e.g., `/version-and-release-update` or "make a release vX.Y.Z"), autonomously execute the release process: create release commit, create tag, push ONLY the tag to GitHub, and publish the GitHub release with signed `IVIDS.apk` and `IVIDS.exe` assets. Do NOT push the release commit directly to `main` autonomously.
- **Mandatory Build Before Push/Release**: ALWAYS run `.\build.bat` (or `.\build.bat release`) before executing any `git push` or release publish.
- **Explicit Failure Notification**: If remote push, tag creation, or GitHub Release fails, STOP immediately and notify the user.

## 3. APK Signing & SDK Target Requirements
- **APK Signing**: Both `release` and `debug` build types in `app/build.gradle.kts` MUST reference `keystore.jks` in workspace root (`alias: ivids`, `password: ivids2025`). NEVER remove signing configs.
- **SDK Target Limitation**: NEVER set `compileSdk` or `targetSdk` to unreleased or developer-preview API levels (e.g., API 36 / Android 16 preview). Stick to stable, finalized SDK versions (e.g., API 35).
- **Version Code Synchronization**: `versionCode` in `app/build.gradle.kts` MUST auto-increment via `increment-version-code.js` on every `build.bat` run. Synchronize Tizen `config.xml` versions during official releases.
