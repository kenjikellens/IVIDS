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

The updater module triggers hooks to notify the client interface when updates are checked:
- **`window.onUpdateStatus(status)`**: Broadcasts the current checking phase (`connecting-api`, `fetching-releases`, `comparing-versions`) to settings page indicators.
- **`window.onUpdateFound(remoteVersion)`**: Fired when a newer version is available. It asynchronously imports and launches the `UpdatePrompt` dialog module.
- **`window.onNoUpdateFound()`** / **`window.onUpdateCheckError()`**: Cleanly resets UI progress animations if the system is up-to-date or encountered API failures.

---

## 🚀 Premium Update Overlay (`update-prompt.js`)

When an update is found, the system instantiates a premium glassmorphic modal defined in `update-prompt.js`:

### 1. Overlay Lifecycle
- **Instantiation**: The modal is injected programmatically into `document.body` to avoid local container overflow or styling truncations.
- **Data Load**: Queries the latest GitHub Release JSON. If available, it parses and displays the markdown changelog as formatted bullet points.
- **Dismissal / Transition**: Fades out using standard CSS transitions. It then restores the user's active cursor/element focus to whatever was highlighted prior to the update popup.

### 2. Spatial Navigation Focus Trap
To ensure smart TV compatibility (remotes operating purely with D-pad navigation):
- The modal activates `SpatialNav.setFocusTrap(modalElement)`, disabling D-pad movement to any background page elements.
- The focus is immediately centered on the **"Install Now"** button.
- Dismissing the update clears the trap (`SpatialNav.clearFocusTrap()`) and refocuses the settings page focus target.

### 3. Execution Delegation & Progress Tracking
When the user selects "Install Now", the overlay hides the action buttons, displays a progress bar, and routes the action depending on the host device:
- **Native Android APKs**: Passes control to the `window.AndroidUpdate.downloadAndInstall()` (or `downloadAndInstallForUrl(url)`) bridge. Native Java code reports download percentages back through `UpdatePrompt.handleProgress(percent)` and switches to "Installing..." upon APK execution.
- **Electron PC Executables**: Registers progress listeners via `window.ElectronAPI.onUpdateProgress()`, triggers download via `window.ElectronAPI.downloadPcUpdate()`, and executes the local installer via `window.ElectronAPI.installPcUpdate(filePath)`.
- **Static Web Browsers**: Opens the remote asset download link directly in a new browser tab and closes the modal.

