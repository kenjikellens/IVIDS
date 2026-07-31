# Unified Multi-Platform Update Checker

The IVIDS Update Checker (`updater.js`) is an asynchronous update verification and delivery engine that operates across heterogeneous client environments (Android WebView, Electron PC Client, and Static Web Browsers).

---

## ⚙️ Environment Execution Routing

The updater automatically detects the host environment at runtime and delegates update checks accordingly:

1. **Native Android (TV / Mobile)**:
   - **Bridge Interface**: Native `JavascriptInterface` binding `window.AndroidUpdate`.
   - **Native Layer**: [MainActivity.java](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/java/com/kenjigames/ivids/MainActivity.java) and [UpdateManager.java](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/java/com/kenjigames/ivids/UpdateManager.java).
   - **Execution**: Delegates release checking and package downloading to Android's native `DownloadManager`. Triggers system package installer intents upon download completion.
   - **APK Asset Selection**: Automatically inspects device user-agent strings at runtime to differentiate between Android TV and Mobile platforms, selecting release assets labeled with `tv` or `mobile`.

2. **Electron PC Client**:
   - **Bridge Interface**: Inter-Process Communication (IPC) bridge `window.ElectronAPI`.
   - **Execution**: Delegates version verification and executable updates directly to the Electron main process ([main.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/main.js)).

3. **Static Web (Browser / Development Server)**:
   - **Interface**: Direct REST fetch API against GitHub Releases endpoint (`https://api.github.com/repos/kenjikellens/IVIDS/releases/latest`).
   - **Execution**: Queries latest release metadata via `corsproxy.io` and parses asset download links.

---

## ⏱️ Rate Limiting & Cool-Down Controls

To avoid hitting API rate limits on GitHub endpoints and minimize network overhead:
- **24-Hour Cool-Down**: `checkForUpdates(force = false)` stores the timestamp of the last verification in `localStorage` under `iv_last_update_check`. Subsequent checks within 24 hours are bypassed automatically.
- **Manual Force Trigger**: Passing `force = true` (e.g. user manually clicks "Check for Updates" in Settings) overrides the cool-down timer and performs an active API request.

---

## 🔄 Version Comparison Engine (`isNewer`)

Version strings are validated semantically:
- Strips leading `v` prefixes (e.g., `v0.4.5` -> `0.4.5`).
- Splits semantic strings into integer arrays (e.g., `[0, 4, 5]`).
- Compares numerical values from major to minor/patch segments to determine if remote assets exceed local version build numbers.

---

## 🎨 UI Overlay & Modal Lifecycle (`update-prompt.js`)

When an update is detected:
1. Programmatically injects a glassmorphic modal overlay into `document.body`.
2. Fetches release notes and renders GitHub markdown release changelogs.
3. Activates `SpatialNav.setFocusTrap(modalElement)` to restrict D-pad navigation strictly to the modal controls ("Install Now" / "Later").
4. Reports live download percentage via native callback `UpdatePrompt.handleProgress(percent)`.

---

*Single Source of Truth v0.4.5*
