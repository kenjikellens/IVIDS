/**
 * VersionManager Service
 * ======================
 * Centralized, singleton service providing dynamic version resolution for the entire GUI application.
 * Automatically interrogates native runtime environments (Android PackageManager, Electron app, or Web API)
 * with zero hardcoded fallbacks or duplicate client logic.
 */
export class VersionManager {
    /** @type {VersionManager|null} */
    static instance = null;

    /** @type {string|null} */
    cachedVersion = null;

    /**
     * Singleton instance accessor.
     * @returns {VersionManager} The single shared instance of VersionManager.
     */
    static getInstance() {
        if (!VersionManager.instance) {
            VersionManager.instance = new VersionManager();
        }
        return VersionManager.instance;
    }

    /**
     * Resolves the current application version asynchronously from the active host environment.
     * @returns {Promise<string>} Resolved version string in format "vX.Y.Z" or "--" if undetermined.
     */
    async getVersion() {
        if (this.cachedVersion) {
            return this.cachedVersion;
        }

        // 1. Android Native WebView Interface
        if (window.AndroidUpdate && typeof window.AndroidUpdate.getCurrentVersion === 'function') {
            try {
                const androidVer = window.AndroidUpdate.getCurrentVersion();
                if (androidVer && androidVer !== 'v0.0.0') {
                    this.cachedVersion = androidVer.startsWith('v') ? androidVer : `v${androidVer}`;
                    return this.cachedVersion;
                }
            } catch (err) {
                console.error('VersionManager: Error querying AndroidUpdate interface', err);
            }
        }

        // 2. Electron IPC Preload Bridge
        if (window.ElectronAPI && typeof window.ElectronAPI.getAppVersion === 'function') {
            try {
                const electronVer = await window.ElectronAPI.getAppVersion();
                if (electronVer && electronVer !== '0.0.0') {
                    this.cachedVersion = electronVer.startsWith('v') ? electronVer : `v${electronVer}`;
                    return this.cachedVersion;
                }
            } catch (err) {
                console.error('VersionManager: Error querying ElectronAPI interface', err);
            }
        }

        // 3. Web / Tizen Server API Endpoint
        try {
            const response = await fetch('/api/version');
            if (response.ok) {
                const data = await response.json();
                if (data && data.version) {
                    this.cachedVersion = data.version.startsWith('v') ? data.version : `v${data.version}`;
                    return this.cachedVersion;
                }
            }
        } catch (err) {
            // Web API not active
        }

        return '--';
    }

    /**
     * Synchronous version getter for quick UI rendering if already cached or Android native available.
     * @returns {string} Version string or placeholder if not yet resolved.
     */
    getVersionSync() {
        if (this.cachedVersion) {
            return this.cachedVersion;
        }
        if (window.AndroidUpdate && typeof window.AndroidUpdate.getCurrentVersion === 'function') {
            try {
                const v = window.AndroidUpdate.getCurrentVersion();
                if (v && v !== 'v0.0.0') {
                    this.cachedVersion = v.startsWith('v') ? v : `v${v}`;
                    return this.cachedVersion;
                }
            } catch (e) {}
        }
        return '--';
    }

    /**
     * Binds the dynamically resolved version to a DOM element by ID.
     * @param {string} elementId - The ID of the HTML element to populate with the version string.
     * @returns {Promise<void>}
     */
    async bindDisplayElement(elementId) {
        const el = document.getElementById(elementId);
        if (!el) return;

        // Instant populate if sync version is available
        const syncVer = this.getVersionSync();
        if (syncVer !== '--') {
            el.textContent = syncVer;
        }

        // Resolve fully async
        const resolvedVer = await this.getVersion();
        if (resolvedVer) {
            el.textContent = resolvedVer;
        }
    }
}
