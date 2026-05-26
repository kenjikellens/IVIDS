/**
 * Unified Update Checker module for IVIDS.
 * Handles update verification, storage-level throttle checks, and environment routing.
 */

const Config = {
    isNative: !!window.AndroidUpdate,
    isElectron: !!window.ElectronAPI,
    isStaticWeb: !window.AndroidUpdate && !window.ElectronAPI
};

/**
 * Retrieves the current installed version of the application asynchronously.
 * Checks the native Android interface, then the Electron bridge, attempts local server API, and falls back to v0.4.1.
 * @returns {Promise<string>} A promise resolving to the version string (e.g., 'v0.4.1').
 */
async function getLocalVersion() {
    if (window.AndroidUpdate && typeof window.AndroidUpdate.getCurrentVersion === 'function') {
        return window.AndroidUpdate.getCurrentVersion();
    }
    if (window.ElectronAPI && typeof window.ElectronAPI.getAppVersion === 'function') {
        try {
            const version = await window.ElectronAPI.getAppVersion();
            return version ? `v${version}` : 'v0.4.1';
        } catch (err) {
            console.error('Updater: Failed to fetch Electron app version', err);
        }
    }
    try {
        const response = await fetch('/api/version');
        if (response.ok) {
            const data = await response.json();
            if (data && data.version) {
                return `v${data.version}`;
            }
        }
    } catch (err) {
        // Silent fallback for production web hosting environments
    }
    return 'v0.4.1';
}

/**
 * Compares the local version string against the remote version string.
 * Splits version strings by period and compares each segment numerically.
 * @param {string} local - The local version string (e.g., 'v0.4.1').
 * @param {string} remote - The remote version string (e.g., 'v0.2.4').
 * @returns {boolean} True if the remote version is newer, false otherwise.
 */
export function isNewer(local, remote) {
    if (!local || !remote) return false;
    const cleanLocal = local.startsWith('v') ? local.substring(1) : local;
    const cleanRemote = remote.startsWith('v') ? remote.substring(1) : remote;

    const localParts = cleanLocal.split('.').map(x => parseInt(x, 10) || 0);
    const remoteParts = cleanRemote.split('.').map(x => parseInt(x, 10) || 0);

    const maxLen = Math.max(localParts.length, remoteParts.length);
    for (let i = 0; i < maxLen; i++) {
        const lVal = localParts[i] || 0;
        const rVal = remoteParts[i] || 0;
        if (rVal > lVal) return true;
        if (lVal > rVal) return false;
    }
    return false;
}

/**
 * Initiates an update check either automatically or manually.
 * Bypasses the 24-hour frequency limit if forced manually from settings.
 * @param {boolean} force - If true, ignores the 24-hour rate limit check.
 */
export async function checkForUpdates(force = false) {
    if (!force) {
        const lastCheck = localStorage.getItem('iv_last_update_check');
        const now = Date.now();
        if (lastCheck && (now - parseInt(lastCheck, 10) < 24 * 60 * 60 * 1000)) {
            console.log('Updater: Last update check was less than 24 hours ago. Skipping...');
            return;
        }
    }

    // Save last check timestamp
    localStorage.setItem('iv_last_update_check', String(Date.now()));

    if (window.AndroidUpdate) {
        console.log('Updater: Routing update check to Native Android layer');
        if (typeof window.onUpdateStatus === 'function') {
            window.onUpdateStatus('connecting-api');
        }
        window.AndroidUpdate.checkForUpdates();
    } else if (window.ElectronAPI) {
        console.log('Updater: Routing update check to Electron IPC');
        if (typeof window.onUpdateStatus === 'function') {
            window.onUpdateStatus('connecting-api');
        }
        try {
            if (typeof window.onUpdateStatus === 'function') {
                window.onUpdateStatus('fetching-releases');
            }
            const result = await window.ElectronAPI.checkPcUpdate();
            if (result && result.status === 'ok' && result.release) {
                if (typeof window.onUpdateStatus === 'function') {
                    window.onUpdateStatus('comparing-versions');
                }
                const release = result.release;
                const remoteVersion = release.tag_name;
                const localVersion = await getLocalVersion();
                console.log(`Updater (Electron): Local: ${localVersion}, Remote: ${remoteVersion}`);
                if (isNewer(localVersion, remoteVersion)) {
                    console.log(`Updater (Electron): Newer version found: ${remoteVersion}`);
                    const exeAsset = release.assets && release.assets.find(asset => asset.name.toLowerCase().endsWith('.exe'));
                    if (exeAsset) {
                        window.latestUpdateDownloadUrl = exeAsset.browser_download_url;
                        window.latestUpdateVersion = remoteVersion;
                        window.latestRelease = release;
                        if (typeof window.onUpdateFound === 'function') {
                            window.onUpdateFound(remoteVersion);
                        }
                    } else {
                        console.warn('Updater (Electron): No EXE asset found in latest release');
                        if (typeof window.onNoUpdateFound === 'function') {
                            window.onNoUpdateFound();
                        }
                    }
                } else {
                    console.log('Updater (Electron): App is up to date.');
                    if (typeof window.onNoUpdateFound === 'function') {
                        window.onNoUpdateFound();
                    }
                }
            } else {
                throw new Error(result ? result.message : 'Invalid response');
            }
        } catch (err) {
            console.error('Updater (Electron): Failed to check updates', err);
            if (typeof window.onUpdateCheckError === 'function') {
                window.onUpdateCheckError();
            }
        }
    } else {
        console.log('Updater: Direct update check via Static Web API');
        if (typeof window.onUpdateStatus === 'function') {
            window.onUpdateStatus('connecting-api');
        }

        try {
            if (typeof window.onUpdateStatus === 'function') {
                window.onUpdateStatus('fetching-releases');
            }
            const response = await fetch('https://corsproxy.io/?https://api.github.com/repos/kenjikellens/IVIDS/releases/latest');
            if (!response.ok) {
                throw new Error(`CORS proxy returned status ${response.status}`);
            }
            const release = await response.json();
            
            if (typeof window.onUpdateStatus === 'function') {
                window.onUpdateStatus('comparing-versions');
            }

            const remoteVersion = release.tag_name;
            const localVersion = await getLocalVersion();

            console.log(`Updater: Local: ${localVersion}, Remote: ${remoteVersion}`);

            if (isNewer(localVersion, remoteVersion)) {
                console.log(`Updater: Newer version found: ${remoteVersion}`);
                
                // Match target APK for mobile vs TV
                const ua = navigator.userAgent.toLowerCase();
                const isTv = ua.includes('smarttv') || ua.includes('tizen') || ua.includes('webos') || ua.includes('androidtv') || ua.includes('appletv');
                const targetKeyword = isTv ? 'tv' : 'mobile';

                let downloadUrl = null;
                if (release.assets && release.assets.length > 0) {
                    const matchedAsset = release.assets.find(asset => {
                        const name = asset.name.toLowerCase();
                        return name.endsWith('.apk') && name.includes(targetKeyword);
                    });
                    if (matchedAsset) {
                        downloadUrl = matchedAsset.browser_download_url;
                    } else {
                        // Fallback to first APK asset
                        const fallbackAsset = release.assets.find(asset => asset.name.toLowerCase().endsWith('.apk'));
                        if (fallbackAsset) {
                            downloadUrl = fallbackAsset.browser_download_url;
                        }
                    }
                }

                if (downloadUrl) {
                    window.latestUpdateDownloadUrl = downloadUrl;
                    window.latestRelease = release;
                    if (typeof window.onUpdateFound === 'function') {
                        window.onUpdateFound(remoteVersion);
                    }
                } else {
                    console.warn('Updater: No APK asset found in the latest release');
                    if (typeof window.onNoUpdateFound === 'function') {
                        window.onNoUpdateFound();
                    }
                }
            } else {
                console.log('Updater: Application is up to date.');
                if (typeof window.onNoUpdateFound === 'function') {
                    window.onNoUpdateFound();
                }
            }
        } catch (error) {
            console.error('Updater: Failed to check updates directly', error);
            if (typeof window.onUpdateCheckError === 'function') {
                window.onUpdateCheckError();
            }
        }
    }
}

/**
 * Initializes the auto-updater background service on boot.
 * Schedules an automatic check if update mode is enabled and last check was > 24 hours ago.
 */
export function initAutoCheck() {
    try {
        const savedSettings = localStorage.getItem('ivids-settings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            if (settings.updateMode && settings.updateMode !== 'none') {
                console.log('Updater: Starting automatic boot update check...');
                checkForUpdates(false);
            }
        }
    } catch (e) {
        console.error('Updater: Error in initAutoCheck trigger', e);
    }
}

export const Updater = {
    checkForUpdates,
    initAutoCheck,
    isNewer
};
