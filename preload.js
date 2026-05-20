const { contextBridge, ipcRenderer } = require('electron');

/**
 * contextBridge.exposeInMainWorld call
 * ===================================
 * Exposes a structured window.ElectronAPI object to the renderer process context securely.
 * This acts as the secure bridge for calling backend Node.js APIs from UI JavaScript.
 */
contextBridge.exposeInMainWorld('ElectronAPI', {
    /**
     * checkPcUpdate function
     * ----------------------
     * Explains: Triggers update checking process by invoking the 'check-pc-update' IPC channel.
     * @returns {Promise<object>} Response with status and release payload.
     */
    checkPcUpdate: () => ipcRenderer.invoke('check-pc-update'),

    /**
     * downloadPcUpdate function
     * -------------------------
     * Explains: Initiates downloading the update package from a remote repository URL.
     * @param {string} url - Remote file download URL.
     * @param {string} version - Target release version string.
     * @returns {Promise<object>} Download status and path details.
     */
    downloadPcUpdate: (url, version) => ipcRenderer.invoke('download-pc-update', url, version),

    /**
     * installPcUpdate function
     * ------------------------
     * Explains: Runs the installer process using the local downloaded file path.
     * @param {string} filePath - Absolute path to downloaded executable installer.
     * @returns {Promise<object>} Status of spawn request.
     */
    installPcUpdate: (filePath) => ipcRenderer.invoke('install-pc-update', filePath),

    /**
     * onUpdateProgress function
     * -------------------------
     * Explains: Allows the renderer UI to register a callback listener to monitor download progress percentage.
     * @param {function} callback - Function called with progress value (0 to 100).
     * @returns {function} Unsubscribe cleanup function to unregister progress listener.
     */
    onUpdateProgress: (callback) => {
        const subscription = (event, progress) => callback(progress);
        ipcRenderer.on('pc-update-progress', subscription);
        return () => ipcRenderer.removeListener('pc-update-progress', subscription);
    }
});
