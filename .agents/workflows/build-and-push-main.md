---
description: Standardized step-by-step protocol to build Windows EXE and Android APK binaries, verify compilation, commit changes, and push directly to the main branch without creating a GitHub release or tag.
---

# Build and Push to Main Workflow

This document defines the strict, standardized protocol for compiling the Windows Portable Executable (`IVIDS.exe`) and Android package (`IVIDS.apk`), validating build outputs, and pushing commits directly to `main` without creating a Git tag or publishing a GitHub Release.

---

## 🛠️ Step-by-Step Protocol

### 1. Pre-Build Validation & Status Check
- **ACTION**: Check the current git status to verify what files have been modified or need to be committed:
  ```powershell
  git status
  ```
- **Integrity Validation**: Validate that project configuration files and version identifiers are intact:
  ```powershell
  node validate-build-integrity.js
  ```
- **Code Syntax Check**: Ensure all JavaScript/TypeScript files touched during development pass syntax checks with zero errors (e.g. `node -c <file>`).

---

### 2. Compile and Package Applications (APK and EXE)
- **ACTION**: Run the automated build script to compile the packages:
  - For **Debug Build** (standard development build):
    ```powershell
    .\build.bat
    ```
  - For **Release Build** (optimized, signed production binaries):
    ```powershell
    .\build.bat release
    ```
- **Automated Actions & What `build.bat` Does**:
  1. **Auto-Increments Build Number**: Automatically runs `increment-version-code.js` to increment `versionCode` in `app/build.gradle.kts`.
  2. **Compiles Windows Portable Executable**: Builds the Electron application using `npm run dist`.
  3. **Compiles Android APK**: Invokes `gradlew.bat assembleDebug` or `assembleRelease` using the workspace keystore (`keystore.jks`).
  4. **Copies and Names Binaries**: Places the resulting `IVIDS.exe` and `IVIDS.apk` directly in the workspace root.
  5. **Cleans Up Temporary Artifacts**: Deletes temporary build directories (e.g. `dist/`).

---

### 3. Verify Output Binaries
- **ACTION**: Confirm that both binaries were successfully compiled in the workspace root and are non-empty:
  ```powershell
  Get-Item "IVIDS.exe", "IVIDS.apk" | Select-Object Name, Length, LastWriteTime
  ```
- **Note on Git Ignore**: `IVIDS.exe` and `IVIDS.apk` are tracked in `.gitignore` and are NOT committed to the git repository.

---

### 4. Stage and Commit Changes
- **ACTION**: Stage the modified application files and the auto-incremented `app/build.gradle.kts`:
  ```powershell
  git add app/build.gradle.kts
  git add app/src/
  # Add other modified files as needed
  ```
- **Commit with Clear Message**: Author a high-quality commit with a concise title and detailed bullet points explaining the changes and features:
  ```powershell
  git commit -m "feat/fix: <summary of changes>" -m "- <detail 1>`n- <detail 2>`n- <detail 3>"
  ```

---

### 5. Push to Main Branch (No Release / No Tag)
- **ACTION**: Fetch remote changes and push the local commits directly to the remote `main` branch:
  ```powershell
  git fetch origin main
  git push origin main
  ```
- **BRANCH SAFETY & DISTINCTION FROM RELEASE WORKFLOW**:
  - ❌ **DO NOT** create a Git tag (`git tag -a ...`).
  - ❌ **DO NOT** push tags (`git push origin v...`).
  - ❌ **DO NOT** publish a GitHub Release (`gh release create ...`).
  - ✅ **DO** verify that the push to `origin/main` was successful:
    ```powershell
    git status
    ```
