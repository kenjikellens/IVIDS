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
  1. Update the `version` field in [package.json](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/package.json).
  2. Update the version fields in [package-lock.json](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/package-lock.json).
  3. Bump `versionName` to `vX.Y.Z` and increment `versionCode` by 1 in [build.gradle.kts](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/build.gradle.kts).
  4. Update the `version` attribute in Tizen's [config.xml](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/config.xml) and [config.xml](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/config.xml) to match `X.Y.Z`.
  5. Append the modification log entry to [CHANGELOG.md](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/CHANGELOG.md).

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

### 4. Tag and Push the Release Tag
- **ACTION**: You MUST autonomously commit the release changes locally and tag the release commit, but you must push ONLY the tag to the remote GitHub repository. You are strictly FORBIDDEN from pushing the release commit directly to the `main` branch autonomously; the `main` branch push must be explicitly authorized by the developer later.
  ```powershell
  git commit -m "Release vX.Y.Z"
  git tag -a vX.Y.Z -m "Release vX.Y.Z"
  git push origin vX.Y.Z
  ```

### 5. Create the GitHub Release Online (MANDATORY — DO NOT SKIP)
> **⚠️ CRITICAL: This step is NON-NEGOTIABLE. A pushed tag without a live GitHub release is INCOMPLETE. The release is NOT done until this step succeeds.**

- **ACTION**: You MUST autonomously create a **live, published GitHub release** using the `gh` CLI. The release MUST include the compiled `IVIDS.apk` and `IVIDS.exe` as downloadable assets.
- **AUTH FIX**: If `gh` fails with a `401 Unauthorized` error, it is likely caused by an invalid `GITHUB_TOKEN` environment variable overriding the valid keyring credentials. Fix this by clearing the variable before running `gh`:
  ```powershell
  $env:GITHUB_TOKEN = ""; gh release create vX.Y.Z "IVIDS.apk" "IVIDS.exe" --title "Release vX.Y.Z" --notes "<release notes>" --latest
  ```
- **RELEASE NOTES**: Use the high-quality title and description formulated in Step 1. Include a "What's Changed" section summarizing the key improvements.

### 6. Verify the Release is Live (MANDATORY — DO NOT SKIP)
- **ACTION**: After creating the release, you MUST verify it is actually live and accessible by running:
  ```powershell
  $env:GITHUB_TOKEN = ""; gh release view vX.Y.Z
  ```
- **VALIDATION CHECKLIST** — the release is only complete when ALL of the following are true:
  1. ✅ The release URL is returned and accessible (e.g., `https://github.com/kenjikellens/IVIDS/releases/tag/vX.Y.Z`)
  2. ✅ The release title and description are present
  3. ✅ `IVIDS.apk` is listed as an attached asset
  4. ✅ `IVIDS.exe` is listed as an attached asset
- **FAILURE HANDLING**: If ANY of the above checks fail, you MUST retry or report the specific failure to the user. Do NOT silently proceed as if the release succeeded.