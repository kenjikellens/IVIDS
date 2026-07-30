/**
 * Unified Sports Stream Resolver for IVIDS
 * Handles background stream capture across Android APK (window.AndroidResolver)
 * and Electron EXE environments.
 */
export class SportsResolver {
    /**
     * Resolves a sports embed URL into a direct playable HLS (.m3u8) or TS stream URL.
     *
     * @param {string} embedUrl - The iframe embed URL of the sports stream.
     * @param {number} timeoutMs - Maximum wait time in ms for background capture (default 12s).
     * @returns {Promise<string>} Direct stream URL (.m3u8/.ts).
     */
    static resolveStream(embedUrl, timeoutMs = 12000) {
        return new Promise((resolve, reject) => {
            if (!embedUrl) {
                return reject(new Error('Invalid embed URL'));
            }

            let timeoutId = null;

            // Define window callback for captured stream
            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                delete window.onBackgroundStreamCaptured;
            };

            window.onBackgroundStreamCaptured = (streamUrl) => {
                cleanup();
                if (streamUrl) {
                    console.log('[SportsResolver] Stream captured successfully:', streamUrl);
                    resolve(streamUrl);
                } else {
                    reject(new Error('Empty stream URL captured'));
                }
            };

            timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('Stream capture timed out after ' + (timeoutMs / 1000) + 's'));
            }, timeoutMs);

            // 1. Android APK environment
            if (window.AndroidResolver && typeof window.AndroidResolver.resolveEmbedStream === 'function') {
                console.log('[SportsResolver] Resolving stream via Android Native Bridge:', embedUrl);
                try {
                    window.AndroidResolver.resolveEmbedStream(embedUrl);
                } catch (e) {
                    cleanup();
                    reject(e);
                }
                return;
            }

            // 2. Electron EXE environment
            if (window.electronAPI && typeof window.electronAPI.resolveSportsEmbed === 'function') {
                console.log('[SportsResolver] Resolving stream via Electron IPC:', embedUrl);
                window.electronAPI.resolveSportsEmbed(embedUrl)
                    .then(url => {
                        cleanup();
                        resolve(url);
                    })
                    .catch(err => {
                        cleanup();
                        reject(err);
                    });
                return;
            }

            // 3. Direct HLS stream fallback
            if (embedUrl.includes('.m3u8') || embedUrl.includes('.ts')) {
                cleanup();
                return resolve(embedUrl);
            }

            // Standalone fallback: return embed URL as-is
            cleanup();
            resolve(embedUrl);
        });
    }
}
