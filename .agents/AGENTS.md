# Project-Specific Rules for IVIDS Development

## 🚀 Release and Push Rules
- **Explicit Failure Notification**: If a remote push, tag creation, or GitHub Release creation fails (e.g., due to repository rule violations, lack of credentials, or authentication issues), you **MUST** immediately stop and explicitly inform the user of the failure. Do not silently proceed or assume success.
- **Verification Requirement**: Always verify that the GitHub Release is live and that the correct `IVIDS.apk` (signed and installable) and `IVIDS.exe` assets are attached before ending the release workflow.
- **APK Signing**: Do not distribute unsigned APKs. Both `release` and `debug` build types in `app/build.gradle.kts` must always reference the `keystore.jks` in the workspace root.
  - File path: `keystore.jks` (must be in `.gitignore`, never committed).
  - Alias: `ivids`
  - Store & Key Password: `ivids2025`
  - If missing, regenerate the key or warn the user. All builds must use this key so in-app self-updates do not fail with "package appears to be invalid" due to signature mismatch.
- **SDK Target Limitation**: Never set `compileSdk` or `targetSdk` to an unreleased or developer-preview API level (e.g. API 36 / Android 16 during preview phases). Stable consumer devices running current Android versions will block the installation of APKs compiled against preview versions, resulting in "package appears to be invalid" errors when updating or downloading via browser. Stick to stable, finalized SDK versions (e.g. API 35).
