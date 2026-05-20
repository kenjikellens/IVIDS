# Unified Multi-Platform Update Checker

The IVIDS Update Checker (`updater.js`) is an asynchronous update verification and delivery engine that works across heterogeneous client environments (Android WebView, Electron, and Web).

## ⚙️ Environment Execution Routing

The updater automatically detects the client environment on load and routes update checks to the appropriate layer:

1. **Native Android (TV/Mobile)**:
   - Interface: Native JavascriptInterface bridge `window.AndroidUpdate`.
   - Execution: Invokes native updates checking, manages network connections, downloads files using Android's download manager, and triggers system package installations.
   - APK Version Filter: At runtime, detects whether it's executing on a TV vs. Mobile device based on user-agent strings. It filters GitHub release assets to match the target device (looking for `tv` vs. `mobile` in the `.apk` filename).
   
2. **Electron PC Client**:
   - Interface: Inter-Process Communication (IPC) bridge `window.ElectronAPI`.
   - Execution: Relays update checks directly to the Electron main process via `checkPcUpdate()`.

3. **Static Web (Browser)**:
   - Interface: Standard REST fetch API.
   - Execution: Hits the GitHub Releases API (`https://api.github.com/repos/kenjikellens/IVIDS/releases/latest`) through a CORS proxy helper (`corsproxy.io`) to retrieve the latest version tag.

---

## ⏱️ Throttle & Frequency Controls

To prevent hitting API rate limits (especially the GitHub API) and to reduce client-side network overhead:
- **24-Hour Cool-Down**: The `checkForUpdates(force = false)` method stores the timestamp of the last check in `localStorage` under `iv_last_update_check`. Subsequent checks within 24 hours are automatically throttled and skipped.
- **Manual Override**: If `force` is set to `true` (e.g., when the user manually clicks "Check for Updates" in the Settings UI), the 24-hour rate limit is bypassed, forcing a live check.

---

## 🔄 Version Comparison Logic (`isNewer`)

Local and remote version strings are compared semantically using the `isNewer(local, remote)` helper:
- Sanitizes version inputs (removes leading `v` prefixes).
- Splits version strings by periods (`.`) into integer segments (e.g. `[0, 3, 2]` from `v0.3.2`).
- Iterates through the segment arrays and compares values numerically from left to right.
- Ensures robust matching even if segments differ in length.

---

## 🎨 UI Integration & Dialog Hooks

The module triggers callback hooks to notify the UI of updates:
- **`window.onUpdateStatus(status)`**: Broadcasts current checking state (`connecting-api`, `fetching-releases`, `comparing-versions`) to update UI progress indicators.
- **`window.onUpdateFound(remoteVersion)`**: Fired when a newer version is available. It launches the Update Dialog modal (`update-prompt.js`) with remote focus trapping and dynamic progress tracking.
- **`window.onNoUpdateFound()`** / **`window.onUpdateCheckError()`**: Cleanly resets UI states if no update is found or a network error occurs.
