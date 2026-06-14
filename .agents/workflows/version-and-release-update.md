---
description: 
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
- **ACTION**: Run the automatic version updater via `build.bat` in the workspace root:
  ```powershell
  .\build.bat version vX.Y.Z
  ```
  *(Replace `vX.Y.Z` with your target version, e.g. `v0.4.4` or `0.4.4`).*
- **Automated Actions**: This command will automatically:
  1. Update the `version` field in [package.json](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/package.json).
  2. Update the version fields in [package-lock.json](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/package-lock.json).
  3. Bump `versionName` to `vX.Y.Z` and increment `versionCode` by 1 in [build.gradle.kts](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/build.gradle.kts).
  4. Append the modification log entry to [CHANGELOG.md](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/CHANGELOG.md).

### 3. Compile and Package the Applications (APK and EXE)
- **ACTION**: Run the automated build script to compile the packages:
  - For **Debug Build** (default):
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

### 4. Document Build Binaries in Changelog
- **CHANGELOG HOOK**: Document the copy/creation of the binaries in [CHANGELOG.md](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/CHANGELOG.md) in the exact format:
  `[HH:mm DD-MM-YYYY] IVIDS.apk - Placed compiled prerelease APK at workspace root directory for distribution.`
  `[HH:mm DD-MM-YYYY] IVIDS.exe - Placed compiled portable Electron Windows executable at workspace root directory for distribution.`

### 5. Tag and Push the Release
- **ACTION**: You MUST autonomously commit the release changes locally and tag the release commit, but you must push ONLY the tag to the remote GitHub repository. You are strictly FORBIDDEN from pushing the release commit directly to the `main` branch autonomously; the `main` branch push must be explicitly authorized by the developer later.
  ```powershell
  git commit -m "Release vX.Y.Z"
  git tag -a vX.Y.Z -m "Release vX.Y.Z"
  git push origin vX.Y.Z
  ```
- **GitHub Release Entry**: Draft a new release on GitHub autonomously using the pushed tag, applying the high-quality title and description formulated in Step 1. Ensure you attach the compiled `IVIDS.apk` and `IVIDS.exe` as assets.