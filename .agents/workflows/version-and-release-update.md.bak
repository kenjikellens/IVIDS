---
description: Standardized step-by-step protocol to bump version numbers, compile Windows EXE and Android APK binaries, tag the release, and publish a live GitHub Release.
---

# Version and Release Update Workflow

This document defines the strict, standardized protocol for launching new release builds, compiling the Android installation package, and configuring distribution binaries for IVIDS.

---

## 🛠️ Step-by-Step Release Protocol

### 1. Determine the Target Version via GitHub Releases / Tags (Mandatory Step)
- **ACTION**: The AI Agent MUST check the **GitHub releases/tags** (e.g., using `git tag`) to identify the latest released version, rather than relying on local configuration files in the workspace (which may be out of date or unbumped).
- **Version Bump**: Determine the target version based on the latest release tag following standard semantic versioning (`vX.Y.Z`):
  - **Large (Major) Update**: Increment `X` by 1 and reset `Y` and `Z` to 0 (e.g., `v0.4.2` -> `v1.0.0`).
  - **Medium (Minor) Update**: Increment `Y` by 1 and reset `Z` to 0 (e.g., `v0.4.2` -> `v0.5.0`).
  - **Small (Patch) Update**: Increment `Z` by 1 (e.g., `v0.4.2` -> `v0.4.3`).
  Ask the user to confirm this calculated version before modifying any files.
- **Title and Description Generation**: Once confirmed, formulate a high-quality, professional release title (e.g., `Release v0.4.2 (Prerelease)`) and a detailed, feature-rich release description highlighting all visual, spatial-nav, and core logic improvements.

### 2. Update Application Versions Automatically
- **ACTION**: Run the automatic version updater via [build.bat](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/build.bat) in the workspace root:
  ```powershell
  .\build.bat version vX.Y.Z
  ```
  *(Replace `vX.Y.Z` with your target version, e.g. `v0.6.2` or `0.6.2`).*
- **Automated Actions & Propagation**: This command automatically synchronizes the version across all platform layers:
  1. **[package.json](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/package.json)** & **[package-lock.json](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/package-lock.json)**: Updates `version` string (consumed directly by Electron, the PC updater, and the Settings version display on Windows).
  2. **[app/build.gradle.kts](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/build.gradle.kts)**: Bumps `versionName` to `vX.Y.Z` and auto-increments `versionCode` (consumed by the Android OS `PackageManager`, the Android `UpdateManager.java`, and the Settings version display on Android).
  3. **[config.xml](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/config.xml)** & **[assets/main/config.xml](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/config.xml)**: Updates `version` attribute for Tizen TV applications.
  4. **[CHANGELOG.md](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/CHANGELOG.md)**: Appends the version bump and build timestamp entry.
  5. **Settings UI & Updater Verification**: Because [settings.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/pages/settings.js) dynamically queries `AndroidUpdate.getCurrentVersion()` and `ElectronAPI.getAppVersion()` at runtime, updating `build.gradle.kts` and `package.json` automatically guarantees that the Settings App Info modal displays the exact active version without manual code edits.

### 3. Compile and Package the Applications (APK and EXE)
- **ACTION**: Run the automated build script to compile the packages:
  - For **Debug Build**:
    ```powershell
    .\build.bat
    ```
  - For **Release/Production Build**:
    ```powershell
    .\build.bat release
    ```
- **Automated Actions**: This script will automatically:
  1. Compile the Windows Portable Executable using `npm run dist`.
  2. Compile the Android APK (debug or release variant).
  3. Copy and rename the compiled Windows binary to the workspace root as [IVIDS.exe](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/IVIDS.exe).
  4. Copy and rename the compiled Android APK to the workspace root as [IVIDS.apk](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/IVIDS.apk).
  5. Clean up temporary build artifacts (the `dist` folder).

### 4. Stage, Commit and Push the Release Tag
- **ACTION**: Stage the version configuration files, create the release commit, tag it, and push ONLY the tag to GitHub:
  ```powershell
  git add package.json package-lock.json app/build.gradle.kts app/src/main/config.xml app/src/main/assets/main/config.xml CHANGELOG.md
  git commit -m "Release vX.Y.Z"
  git tag -a vX.Y.Z -m "Release vX.Y.Z"
  git push origin vX.Y.Z
  ```
  *(Note: Binaries `IVIDS.apk` and `IVIDS.exe` are in `.gitignore` and are attached to the GitHub release in step 5, not committed).*
- **BRANCH SAFETY**: You are strictly FORBIDDEN from pushing the release commit directly to the `main` branch autonomously; pushing to `main` must be explicitly authorized by the user separately.

### 5. Create the GitHub Release Online (MANDATORY — DO NOT SKIP)
> **⚠️ CRITICAL: This step is NON-NEGOTIABLE. A pushed tag without a live, published GitHub release is INCOMPLETE. The release must NOT be created as a draft; it MUST be published live online immediately. The release is NOT done until this step succeeds.**

- **ACTION**: Autonomously create a **live, published, non-draft GitHub release** using the `gh` CLI. The release MUST include the compiled `IVIDS.apk` and `IVIDS.exe` as downloadable assets:
  ```powershell
  $env:GITHUB_TOKEN = ""; gh release create vX.Y.Z "IVIDS.apk" "IVIDS.exe" --title "Release vX.Y.Z" --notes "<release notes>" --latest
  ```
- **AUTH FIX**: If `gh` fails with a `401 Unauthorized` error, it is caused by an invalid `GITHUB_TOKEN` environment variable overriding the valid keyring credentials. Clearing the variable (`$env:GITHUB_TOKEN = ""`) resolves this.
- **RELEASE NOTES**: Use the high-quality title and description formulated in Step 1. Include a "What's Changed" section summarizing the key improvements. Ensure the release is published live immediately (do NOT use `--draft`).

### 6. Verify the Release is Live (MANDATORY — DO NOT SKIP)
- **ACTION**: After creating the release, verify it is accessible by running:
  ```powershell
  $env:GITHUB_TOKEN = ""; gh release view vX.Y.Z
  ```
- **VALIDATION CHECKLIST** — the release is only complete when ALL of the following are true:
  1. ✅ The release URL is returned and accessible (e.g., `https://github.com/kenjikellens/IVIDS/releases/tag/vX.Y.Z`)
  2. ✅ The release title and description are present
  3. ✅ `IVIDS.apk` is listed as an attached asset
  4. ✅ `IVIDS.exe` is listed as an attached asset
- **FAILURE HANDLING**: If ANY of the above checks fail, STOP and notify the user immediately with the specific error.