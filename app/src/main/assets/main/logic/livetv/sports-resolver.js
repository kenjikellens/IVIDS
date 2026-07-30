/**
 * SportsResolver Class
 * =====================
 * Handles resolution of live sports streams (Ligue 1, Champions League, Premier League, F1)
 * from live sports embed providers across Android APK (Java Bridge), Electron EXE, and PC Dev server.
 */

export class SportsResolver {
    /**
     * Detects the active execution environment for stream resolving.
     * 
     * @returns {string} 'android' | 'electron' | 'pc_server'
     */
    static getEnvironment() {
        if (typeof window !== 'undefined' && window.AndroidResolver && typeof window.AndroidResolver.resolveEmbedStream === 'function') {
            return 'android';
        }
        if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.resolveSportsEmbed === 'function') {
            return 'electron';
        }
        return 'pc_server';
    }

    /**
     * Initiates stream extraction for a given sports embed URL.
     * Registers a global handler `window.onBackgroundStreamCaptured` for asynchronous stream resolution.
     * 
     * @param {string} embedUrl - Target sports embed URL.
     * @param {function} callback - Callback function receiving the resolved .m3u8/.ts stream URL.
     * @param {function} onError - Error callback if resolution fails/times out.
     * @returns {Promise<string>} Resolved stream URL or empty string.
     */
    static async resolveStream(embedUrl, callback = null, onError = null) {
        const env = this.getEnvironment();
        console.log(`[SportsResolver] Resolving sports stream via environment: ${env} for URL:`, embedUrl);

        if (!embedUrl) {
            if (onError) onError('Missing embed URL');
            return '';
        }

        return new Promise((resolve, reject) => {
            let timeoutId = null;

            const handleSuccess = (streamUrl) => {
                if (timeoutId) clearTimeout(timeoutId);
                delete window.onBackgroundStreamCaptured;
                console.log('[SportsResolver] Captured live sports stream:', streamUrl);
                if (callback) callback(streamUrl);
                resolve(streamUrl);
            };

            const handleFailure = (err) => {
                if (timeoutId) clearTimeout(timeoutId);
                delete window.onBackgroundStreamCaptured;
                console.warn('[SportsResolver] Resolution failed or timed out:', err);
                if (onError) onError(err);
                reject(new Error(err));
            };

            // Set 12s fallback timeout for embed stream resolution
            timeoutId = setTimeout(() => {
                handleFailure('Sports stream extraction timed out (12s)');
            }, 12000);

            window.onBackgroundStreamCaptured = (capturedUrl) => {
                if (capturedUrl) {
                    handleSuccess(capturedUrl);
                } else {
                    handleFailure('Empty stream URL captured');
                }
            };

            if (env === 'android') {
                try {
                    window.AndroidResolver.resolveEmbedStream(embedUrl);
                } catch (e) {
                    handleFailure(`Android bridge error: ${e.message}`);
                }
            } else if (env === 'electron') {
                window.electronAPI.resolveSportsEmbed(embedUrl)
                    .then(url => handleSuccess(url))
                    .catch(err => handleFailure(err.message || String(err)));
            } else {
                // PC Dev server fallback
                fetch(`/resolve-sports-stream?url=${encodeURIComponent(embedUrl)}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data && data.status === 'success' && data.streamUrl) {
                            handleSuccess(data.streamUrl);
                        } else {
                            handleFailure(data.message || 'Server failed to extract sports stream');
                        }
                    })
                    .catch(err => handleFailure(err.message));
            }
        });
    }

    /**
     * Curated list of popular live sports leagues and competetive event presets.
     * 
     * @returns {Array<object>} List of sports categories.
     */
    static getCuratedSportsCategories() {
        return [
            { id: 'ligue1', name: 'Ligue 1 McDonald\'s (France)', icon: '⚽' },
            { id: 'champions_league', name: 'UEFA Champions League', icon: '🏆' },
            { id: 'premier_league', name: 'Premier League (UK)', icon: '⚽' },
            { id: 'formula1', name: 'Formule 1 (F1 GP)', icon: '🏎️' },
            { id: 'eredivisie', name: 'Eredivisie (Nederland)', icon: '🇳🇱' },
            { id: 'la_liga', name: 'La Liga (Spanje)', icon: '🇪🇸' },
            { id: 'serie_a', name: 'Serie A (Italië)', icon: '🇮🇹' }
        ];
    }
}
