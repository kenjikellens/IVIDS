---
description: 
---

# Version and Release Update Workflow

This document defines the strict, standardized protocol for launching new release builds, compiling the Android installation package, and configuring distribution binaries for IVIDS.

---

## 🛠️ Step-by-Step Release Protocol

### 1. Inquire the Target Version (Mandatory Step)
- **ACTION**: The AI Agent MUST ask the developer/user explicitly what version name the new release should be (e.g., `v0.2.1`). Do NOT assume, auto-select, or hardcode the version bump without developer confirmation.
- **Title and Description Generation**: Upon receiving the version name, the Agent must formulate a high-quality, professional release title (e.g., `Release v0.2.1 (Prerelease)`) and a detailed, feature-rich release description highlighting all visual, spatial-nav, and core logic improvements.

### 2. Update Android Version Config
- **ACTION**: Modify the Android build configuration in [build.gradle.kts](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/build.gradle.kts):
  - Bump `versionName` to match the target version precisely (e.g., `versionName = "v0.2.1"`).
  - Increment the integer `versionCode` by 1.
- **CHANGELOG HOOK**: Immediately document this gradle modification in [CHANGELOG.md](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/CHANGELOG.md) in the exact format:
  `[HH:mm DD-MM-YYYY] app/build.gradle.kts - Bumped versionName to vX.Y.Z and incremented versionCode to N.`

### 3. Compile the Application Package (APK)
- **ACTION**: Execute the Gradle wrapper command in PowerShell to compile the application and produce the APK:
  ```powershell
  .\gradlew assembleDebug
  ```
  *(Or execute `.\gradlew assembleRelease` if building a signed production-ready package).*

### 4. Relocate and Rename the Package to the Workspace Root
- **ACTION**: Copy the compiled APK to the root workspace directory and rename it to `IVIDS.apk`.
  - **Source Path**: `app/build/outputs/apk/debug/app-debug.apk` (or matching release path).
  - **Destination Path**: [IVIDS.apk](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/IVIDS.apk) (root).
  - **PowerShell Copy Command**:
    ```powershell
    Copy-Item -Path "app/build/outputs/apk/debug/app-debug.apk" -Destination "IVIDS.apk" -Force
    ```
- **CHANGELOG HOOK**: Immediately document the copying and creation of the root APK in [CHANGELOG.md](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/CHANGELOG.md) in the exact format:
  `[HH:mm DD-MM-YYYY] IVIDS.apk - Placed compiled prerelease APK at workspace root directory for distribution.`

### 5. Tag and Push the Release
- **ACTION**: Tag the release commit and push it to the remote GitHub repository:
  ```powershell
  git tag -a vX.Y.Z -m "Release vX.Y.Z"
  git push origin vX.Y.Z
  ```
- **GitHub Release Entry**: Draft a new release on GitHub using the pushed tag, applying the high-quality title and description formulated in Step 1.
