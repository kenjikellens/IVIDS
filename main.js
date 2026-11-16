const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const { fileURLToPath } = require('url');

// Enable GPU rasterization for smoother CSS animations and scrolling
app.commandLine.appendSwitch('enable-gpu-rasterization');

// Performance optimizations for better core and hardware utilization
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('enable-hardware-overlays');
app.commandLine.appendSwitch('enable-features', 'WebAssemblyThreads,SharedArrayBuffer');

const GITHUB_RELEASE_API_URL = 'https://api.github.com/repos/kenjikellens/IVIDS/releases/latest';
const GUI_ROOT_DIR = path.resolve(__dirname, 'app/src/main/assets/main/gui');

// Determine local directories for cached/downloaded files inside User Data
const updateDir = path.join(app.getPath('userData'), 'updates');
if (!fs.existsSync(updateDir)) {
    fs.mkdirSync(updateDir, { recursive: true });
}

/**
 * Validates that an update download URL uses HTTPS and points exclusively to official IVIDS GitHub release hosts.
 * Rejects non-HTTPS schemes, embedded credentials, and third-party origins.
 *
 * @param {string} rawUrl - Candidate update download URL.
 * @returns {boolean} True if the URL matches the official GitHub/CDN allowlist.
 */
function isAllowedUpdateUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
            return false;
        }
        const host = parsed.hostname.toLowerCase();
        if (host === 'github.com') {
            return /^\/kenjikellens\/IVIDS\//i.test(parsed.pathname);
        }
        return host === 'objects.githubusercontent.com' || host === 'release-assets.githubusercontent.com';
    } catch (e) {
        return false;
    }
}

/**
 * Validates that an update metadata API request targets the official IVIDS GitHub repository API over HTTPS.
 *
 * @param {string} rawUrl - Candidate API URL.
 * @returns {boolean} True if the URL points to the official GitHub API endpoint.
 */
function isAllowedApiUrl(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) return false;
    try {
        const parsed = new URL(rawUrl);
        if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
            return false;
        }
        return parsed.hostname.toLowerCase() === 'api.github.com' &&
            /^\/repos\/kenjikellens\/IVIDS\//i.test(parsed.pathname);
    } catch (e) {
        return false;
    }
}

/**
 * Validates whether a top-level Electron navigation URL stays within the local bundled GUI directory.
 * Prevents top-level navigation to external origins or arbitrary local filesystem paths.
 *
 * @param {string} navigationUrl - Target navigation URL.
 * @returns {boolean} True if navigation stays inside the local GUI directory.
 */
function isAllowedLocalNavigation(navigationUrl) {
    try {
        const parsed = new URL(navigationUrl);
        if (parsed.protocol !== 'file:') {
            return false;
        }
        const targetPath = path.resolve(fileURLToPath(parsed));
        return targetPath === GUI_ROOT_DIR || targetPath.startsWith(GUI_ROOT_DIR + path.sep);
    } catch (e) {
        return false;
    }
}

/**
 * requestUrl Function
 * ===================
 * Performs an HTTPS GET request with strict URL validation on the initial target and every redirect hop.
 * Used internally for checking and downloading official updates.
 *
 * @param {string} url - The HTTPS URL to make the request to.
 * @param {number} redirects - Recursion tracker for redirect count.
 * @param {function} validator - URL allowlist predicate applied before every request and redirect.
 * @returns {Promise<http.IncomingMessage>} Resolve with response object.
 */
function requestUrl(url, redirects = 0, validator = isAllowedUpdateUrl) {
    return new Promise((resolve, reject) => {
        if (typeof validator === 'function' && !validator(url)) {
            reject(new Error('Blocked disallowed update URL.'));
            return;
        }
        let parsed;
        try {
            parsed = new URL(url);
        } catch (err) {
            reject(err);
            return;
        }
        if (parsed.protocol !== 'https:') {
            reject(new Error('Only HTTPS update URLs are allowed.'));
            return;
        }

        const request = https.get(url, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'IVIDS-PC-App'
            }
        }, (response) => {
            if (response.statusCode >= 300 && response.statusCode <= 308 && response.headers.location) {
                response.resume();
                if (redirects >= 5) {
                    reject(new Error('Too many redirects while fetching update.'));
                    return;
                }
                let nextUrl;
                try {
                    nextUrl = new URL(response.headers.location, url).toString();
                } catch (err) {
                    reject(err);
                    return;
                }
                requestUrl(nextUrl, redirects + 1, validator).then(resolve).catch(reject);
                return;
            }
            resolve(response);
        });
        request.on('error', reject);
    });
}

/**
 * fetchJson Function
 * ==================
 * Fetches and parses a JSON response from the official GitHub release API URL.
 * Used for fetching latest release details from GitHub API.
 *
 * @param {string} url - The URL of the API endpoint.
 * @returns {Promise<object>} Resolved JSON payload.
 */
async function fetchJson(url) {
    const response = await requestUrl(url, 0, isAllowedApiUrl);
    if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        throw new Error(`HTTP ${response.statusCode}`);
    }
    return new Promise((resolve, reject) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { body += chunk; });
        response.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
        response.on('error', reject);
    });
}

/**
 * downloadFile Function
 * =====================
 * Downloads a verified official update file to disk and reports progress via callback function.
 * Validates download URLs and redirects against the official GitHub/CDN allowlist.
 *
 * @param {string} url - Remote file download URL.
 * @param {string} outputPath - Local output path.
 * @param {function} onProgress - Callback triggered with percent value (0-100).
 * @returns {Promise<string>} Resolved with local output path upon completion.
 */
async function downloadFile(url, outputPath, onProgress) {
    if (!isAllowedUpdateUrl(url)) {
        throw new Error('Blocked update download from untrusted URL.');
    }
    const response = await requestUrl(url, 0, isAllowedUpdateUrl);
    if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        throw new Error(`HTTP ${response.statusCode}`);
    }
    const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
    let downloadedBytes = 0;
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
        const cleanupAndReject = (err) => {
            output.destroy();
            fs.unlink(outputPath, () => reject(err));
        };
        response.on('data', chunk => {
            downloadedBytes += chunk.length;
            if (totalBytes > 0 && onProgress) {
                onProgress(Math.min(100, Math.round(downloadedBytes * 100 / totalBytes)));
            }
        });
        response.pipe(output);
        output.on('finish', () => {
            output.close(() => {
                if (onProgress) onProgress(100);
                resolve(outputPath);
            });
        });
        output.on('error', cleanupAndReject);
        response.on('error', cleanupAndReject);
    });
}

let mainWindow = null;

/**
 * createWindow Function
 * =====================
 * Creates the primary browser window, disables the native menu bar,
 * configures secure webPreferences, and loads the HTML5 GUI.
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            // TODO: Investigate migrating to webSecurity: true by routing TMDB/VidSrc requests
            // through Electron's session.webRequest API or local HTTP server proxy to mitigate XSS risks.
            webSecurity: false
        },
        icon: path.join(__dirname, 'app/src/main/ic_launcher-playstore.png')
    });

    // Hide default menu bar for standard app look
    mainWindow.setMenuBarVisibility(false);

    // Load local index.html
    const indexPath = path.join(GUI_ROOT_DIR, 'index.html');
    mainWindow.loadFile(indexPath);

    // Block top-level navigation to external origins or paths outside the bundled GUI directory
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        if (!isAllowedLocalNavigation(navigationUrl)) {
            console.warn(`[SECURITY] Blocked top-level navigation to: ${navigationUrl}`);
            event.preventDefault();
        }
    });

    // Block popup windows and target="_blank" external window creation
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        console.warn(`[SECURITY] Blocked new window request to: ${url}`);
        return { action: 'deny' };
    });

    // Injects a console event listener to print renderer process logs directly to the terminal for debugging.
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[RENDERER CONSOLE] [Level ${level}] ${message} (${path.basename(sourceId)}:${line})`);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App lifecycle listeners
/**
 * Configures Electron session network interceptors so Live TV HLS streams (.m3u8 / .ts)
 * work in IVIDS.exe without CORS blocks, file:// Origin rejections, or Electron User-Agent blocks.
 */
function configureStreamNetworkInterceptors() {
    const defaultSession = session.defaultSession;
    if (!defaultSession || !defaultSession.webRequest) return;

    const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const vlcUA = 'VLC/3.0.20 LibVLC/3.0.20';

    defaultSession.webRequest.onBeforeSendHeaders({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
        const headers = { ...details.requestHeaders };
        const urlLower = (details.url || '').toLowerCase();
        const isRawIptv = /^https?:\/\/\d+\.\d+\.\d+\.\d+|:(?:8008|8080|8880|25461|1935)\/|\/play\/[a-z0-9]+/i.test(urlLower);

        // Extract optional per-channel override headers injected by LiveStreamEngine
        let customUa = null;
        let customRef = null;
        let customOrig = null;
        Object.keys(headers).forEach((k) => {
            const lk = k.toLowerCase();
            if (lk === 'x-ivids-user-agent') {
                customUa = headers[k];
                delete headers[k];
            } else if (lk === 'x-ivids-referer') {
                customRef = headers[k];
                delete headers[k];
            } else if (lk === 'x-ivids-origin') {
                customOrig = headers[k];
                delete headers[k];
            }
        });

        if (customUa || customRef || customOrig) {
            headers['User-Agent'] = customUa || (isRawIptv ? vlcUA : chromeUA);
            if (customRef) headers['Referer'] = customRef;
            if (customOrig) headers['Origin'] = customOrig;
        } else if (isRawIptv) {
            headers['User-Agent'] = vlcUA;
            delete headers['Origin'];
            delete headers['Referer'];
        } else {
            headers['User-Agent'] = chromeUA;
            if (urlLower.includes('daddylive') || urlLower.includes('dlhd') || urlLower.includes('daddyhd')) {
                headers['Referer'] = 'https://daddylive.mp/';
                headers['Origin'] = 'https://daddylive.mp';
            } else if (urlLower.includes('sportshub')) {
                headers['Referer'] = 'https://sportshub.stream/';
                headers['Origin'] = 'https://sportshub.stream';
            } else if (urlLower.includes('1stream')) {
                headers['Referer'] = 'https://1stream.top/';
                headers['Origin'] = 'https://1stream.top';
            } else if (urlLower.includes('canal') || urlLower.includes('mycanal')) {
                headers['Referer'] = 'https://www.canalplus.com/';
                headers['Origin'] = 'https://www.canalplus.com';
            } else if (!headers['Origin'] || headers['Origin'] === 'null' || String(headers['Origin']).startsWith('file://')) {
                try {
                    const parsed = new URL(details.url);
                    headers['Origin'] = `${parsed.protocol}//${parsed.host}`;
                    if (!headers['Referer'] || String(headers['Referer']).startsWith('file://')) {
                        headers['Referer'] = `${parsed.protocol}//${parsed.host}/`;
                    }
                } catch (e) {
                    delete headers['Origin'];
                }
            }
        }

        callback({ requestHeaders: headers });
    });

    defaultSession.webRequest.onHeadersReceived({ urls: ['http://*/*', 'https://*/*'] }, (details, callback) => {
        const responseHeaders = { ...(details.responseHeaders || {}) };
        delete responseHeaders['access-control-allow-origin'];
        delete responseHeaders['Access-Control-Allow-Origin'];
        responseHeaders['Access-Control-Allow-Origin'] = ['*'];
        responseHeaders['Access-Control-Allow-Methods'] = ['GET, HEAD, POST, OPTIONS'];
        responseHeaders['Access-Control-Allow-Headers'] = ['*'];
        callback({ responseHeaders });
    });
}

app.whenReady().then(() => {
    configureStreamNetworkInterceptors();
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handler implementations for Native Desktop Logic

/**
 * check-pc-update IPC Handler
 * ===========================
 * Handles request to query latest release version from GitHub API.
 */
ipcMain.handle('check-pc-update', async () => {
    try {
        const release = await fetchJson(GITHUB_RELEASE_API_URL);
        return { status: 'ok', release };
    } catch (error) {
        console.error('Failed to check PC update', error);
        return { status: 'error', message: error.message };
    }
});

/**
 * get-app-version IPC Handler
 * ===========================
 * Retrieves the current Electron application version name from package.json.
 * This is used by the renderer process to display and compare version numbers.
 */
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});


/**
 * download-pc-update IPC Handler
 * =============================
 * Validates the update URL against the official GitHub/CDN allowlist, downloads the update executable,
 * and sends progress events to the renderer.
 */
ipcMain.handle('download-pc-update', async (event, downloadUrl, version) => {
    try {
        if (!isAllowedUpdateUrl(downloadUrl)) {
            throw new Error('Blocked disallowed PC update download URL.');
        }
        const safeVersion = String(version || 'latest').replace(/[^a-zA-Z0-9._-]/g, '') || 'latest';
        const resolvedUpdateDir = path.resolve(updateDir);
        const outputPath = path.resolve(updateDir, `IVIDS_PC_${safeVersion}.exe`);
        if (!outputPath.startsWith(resolvedUpdateDir + path.sep)) {
            throw new Error('Invalid update output path.');
        }
        await downloadFile(downloadUrl, outputPath, (progress) => {
            event.sender.send('pc-update-progress', progress);
        });
        return { status: 'downloaded', filePath: outputPath };
    } catch (error) {
        console.error('Failed to download PC update', error);
        return { status: 'error', message: error.message };
    }
});

/**
 * install-pc-update IPC Handler
 * ============================
 * Verifies the downloaded file is a regular .exe inside updateDir, spawns it, and exits the app.
 */
ipcMain.handle('install-pc-update', async (event, filePath) => {
    try {
        if (typeof filePath !== 'string' || !filePath.trim()) {
            throw new Error('Invalid update executable path.');
        }
        const resolvedUpdateDir = path.resolve(updateDir);
        const resolvedFilePath = path.resolve(filePath);
        if (
            !resolvedFilePath.startsWith(resolvedUpdateDir + path.sep) ||
            path.extname(resolvedFilePath).toLowerCase() !== '.exe' ||
            !fs.existsSync(resolvedFilePath) ||
            !fs.statSync(resolvedFilePath).isFile()
        ) {
            throw new Error('Invalid update executable path.');
        }
        const child = spawn(resolvedFilePath, [], {
            detached: true,
            stdio: 'ignore'
        });
        child.unref();
        setTimeout(() => app.quit(), 500);
        return { status: 'launching' };
    } catch (error) {
        console.error('Failed to install PC update', error);
        return { status: 'error', message: error.message };
    }
});
