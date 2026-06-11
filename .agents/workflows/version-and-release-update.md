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

### 2. Update Android Version Config
- **ACTION**: Modify the Android build configuration in [build.gradle.kts](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/build.gradle.kts):
  - Bump `versionName` to match the target version precisely (e.g., `versionName = "v0.2.1"`).
  - Increment the integer `versionCode` by 1.
- **CHANGELOG HOOK**: Immediately document this gradle modification in [CHANGELOG.md](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/CHANGELOG.md) in the exact format:
  `[HH:mm DD-MM-YYYY] app/build.gradle.kts - Bumped versionName to vX.Y.Z and incremented versionCode to N.`

### 3. Compile the Application Packages (APK and EXE)
- **Android APK Compilation**: Execute the Gradle wrapper command in PowerShell to compile the application and produce the APK:
  ```powershell
  .\gradlew assembleDebug
  ```
  *(Or execute `.\gradlew assembleRelease` if building a signed production-ready package).*
- **Windows PC EXE Compilation**: Install dependencies and package the Electron app:
  ```powershell
  npm install
  npm run dist
  ```

### 4. Relocate and Rename the Packages to the Workspace Root
- **Android Package (APK)**: Copy the compiled APK to the root workspace directory and rename it to `IVIDS.apk`.
  - **Source Path**: `app/build/outputs/apk/debug/app-debug.apk` (or matching release path).
  - **Destination Path**: [IVIDS.apk](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/IVIDS.apk) (root).
  - **PowerShell Copy Command**:
    ```powershell
    Copy-Item -Path "app/build/outputs/apk/debug/app-debug.apk" -Destination "IVIDS.apk" -Force
    ```
- **Windows Package (EXE)**: Copy the compiled portable executable to the root workspace directory and rename it to `IVIDS.exe`.
  - **Source Path**: `dist/ivids*.exe` (or matching portable exe path).
  - **Destination Path**: [IVIDS.exe](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/IVIDS.exe) (root).
  - **PowerShell Copy Command**:
    ```powershell
    Copy-Item -Path "dist/*.exe" -Destination "IVIDS.exe" -Force
    ```
- **CHANGELOG HOOK**: Immediately document the copying and creation of both binaries in [CHANGELOG.md](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/CHANGELOG.md) in the exact format:
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
