# Project-Specific Rules for IVIDS Development

## 🚀 Release and Push Rules
- **Explicit Failure Notification**: If a remote push, tag creation, or GitHub Release creation fails (e.g., due to repository rule violations, lack of credentials, or authentication issues), you **MUST** immediately stop and explicitly inform the user of the failure. Do not silently proceed or assume success.
- **Verification Requirement**: Always verify that the GitHub Release is live and that the correct `IVIDS.apk` (signed and installable) and `IVIDS.exe` assets are attached before ending the release workflow.
- **APK Signing**: Do not distribute unsigned APKs. If a keystore config is missing for release builds, notify the user or generate a debug-signed build so the APK remains installable.
