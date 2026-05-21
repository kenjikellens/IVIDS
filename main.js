const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

const GITHUB_RELEASE_API_URL = 'https://api.github.com/repos/kenjikellens/IVIDS/releases/latest';

// Determine local directories for cached/downloaded files inside User Data
const updateDir = path.join(app.getPath('userData'), 'updates');
if (!fs.existsSync(updateDir)) {
    fs.mkdirSync(updateDir, { recursive: true });
}

/**
 * requestUrl Function
 * ===================
 * Performs a HTTP or HTTPS GET request with support for handling redirects.
 * Used internally for checking and downloading updates.
 *
 * @param {string} url - The URL to make the request to.
 * @param {number} redirects - Recursion tracker for redirect count.
 * @returns {Promise<http.IncomingMessage>} Resolve with response object.
 */
function requestUrl(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https:') ? https : http;
        const request = client.get(url, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'IVIDS-PC-App'
            }
        }, (response) => {
            if (response.statusCode >= 300 && response.statusCode <= 308 && response.headers.location && redirects < 5) {
                response.resume();
                const nextUrl = new URL(response.headers.location, url).toString();
                requestUrl(nextUrl, redirects + 1).then(resolve).catch(reject);
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
 * Fetches and parses a JSON response from a URL.
 * Used for fetching latest release details from GitHub API.
 *
 * @param {string} url - The URL of the API endpoint.
 * @returns {Promise<object>} Resolved JSON payload.
 */
async function fetchJson(url) {
    const response = await requestUrl(url);
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
 * Downloads a file to disk and reports progress via callback function.
 * Used to download update installer binaries.
 *
 * @param {string} url - Remote file download URL.
 * @param {string} outputPath - Local output path.
 * @param {function} onProgress - Callback triggered with percent value (0-100).
 * @returns {Promise<string>} Resolved with local output path upon completion.
 */
async function downloadFile(url, outputPath, onProgress) {
    const response = await requestUrl(url);
    if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        throw new Error(`HTTP ${response.statusCode}`);
    }
    const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
    let downloadedBytes = 0;
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputPath);
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
        output.on('error', reject);
        response.on('error', reject);
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
            webSecurity: false
        },
        icon: path.join(__dirname, 'app/src/main/ic_launcher-playstore.png')
    });

    // Hide default menu bar for standard app look
    mainWindow.setMenuBarVisibility(false);

    // Load local index.html
    const indexPath = path.join(__dirname, 'app/src/main/assets/main/gui/index.html');
    mainWindow.loadFile(indexPath);

    // Injects a console event listener to print renderer process logs directly to the terminal for debugging.
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[RENDERER CONSOLE] [Level ${level}] ${message} (${path.basename(sourceId)}:${line})`);
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// App lifecycle listeners
app.whenReady().then(() => {
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
 * download-pc-update IPC Handler
 * =============================
 * Handles request to download the update executable and sends progress events to the renderer.
 */
ipcMain.handle('download-pc-update', async (event, downloadUrl, version) => {
    try {
        const safeVersion = String(version || 'latest').replace(/[^a-zA-Z0-9._-]/g, '');
        const outputPath = path.join(updateDir, `IVIDS_PC_${safeVersion}.exe`);
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
 * Spawns the downloaded update executable and terminates the running instance.
 */
ipcMain.handle('install-pc-update', async (event, filePath) => {
    try {
        const resolvedUpdateDir = path.resolve(updateDir);
        const resolvedFilePath = path.resolve(filePath);
        if (!resolvedFilePath.startsWith(resolvedUpdateDir + path.sep) || !fs.existsSync(resolvedFilePath)) {
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
