import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { addToRecentlyWatched } from '../../logic/recentlyWatched.js';
import { ErrorHandler } from '../js/error-handler.js';
import { SpatialNav } from '../js/spatial-nav.js';

let hudTimeout = null;
let providerTimeout = null;
let mouseMoveHandler = null;
let clickHandler = null;
let keydownHandler = null;
let globalKeydownHandler = null;
let popstateHandler = null;
let playerBackHandler = null;
let progressInterval = null;

/**
 * Formats a duration in seconds into MM:SS format.
 * @param {number} seconds - Playback timestamp in seconds.
 * @returns {string} Formatted timestamp string.
 */
function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Binds detailed console log event listeners to native HTML5 video player element.
 * @param {HTMLVideoElement} videoEl - The target video element.
 */
function bindNativeVideoLogs(videoEl) {
    if (!videoEl || videoEl.dataset.logsBound) return;
    videoEl.dataset.logsBound = 'true';
    videoEl.addEventListener('play', () => console.log('[IVIDS Player] Native Video: Playback started'));
    videoEl.addEventListener('pause', () => console.log('[IVIDS Player] Native Video: Playback paused'));
    videoEl.addEventListener('seeking', () => console.log(`[IVIDS Player] Native Video: Seeking to ${videoEl.currentTime.toFixed(1)}s`));
    videoEl.addEventListener('seeked', () => console.log(`[IVIDS Player] Native Video: Seeked to ${videoEl.currentTime.toFixed(1)}s`));
    videoEl.addEventListener('waiting', () => console.log('[IVIDS Player] Native Video: Buffering...'));
    videoEl.addEventListener('playing', () => console.log('[IVIDS Player] Native Video: Playing'));
    videoEl.addEventListener('ended', () => console.log('[IVIDS Player] Native Video: Playback completed'));
    videoEl.addEventListener('error', (e) => console.error('[IVIDS Player] Native Video Error:', videoEl.error || e));
}

/**
 * Cleans up player resources, restores global UI layout elements, and returns to the details view.
 * This removes the iframe, restores the header/sidebar layout, and navigates using the router.
 * @param {Object} params - The current player route parameters.
 */
function exitPlayer(params) {
    try {
        window.playerCleanups();
    } catch (e) {
        console.error('Error during player cleanups:', e);
    }
    try {
        const oldIframe = document.getElementById('player-iframe');
        if (oldIframe) oldIframe.remove();
    } catch (e) {
        console.error('Error removing player iframe:', e);
    }
    try {
        const app = document.getElementById('app');
        if (app) app.classList.remove('fullscreen-layout');
        const header = document.getElementById('header');
        if (header) header.style.display = '';
    } catch (e) {
        console.error('Error restoring header layout:', e);
    }
    if (params && params.type === 'live') {
        Router.goBack('home');
    } else if (params) {
        const backType = params.type === 'trailer' ? params.mediaType : params.type;
        Router.goBack('details', { id: params.id, type: backType });
    } else {
        Router.loadPage('home');
    }
}

/**
 * Removes all global event listeners and clears active timeouts registered by the player page.
 * This prevents memory leaks and unintended behavior after navigating away from the player.
 */
window.playerCleanups = function() {
    if (hudTimeout) {
        clearTimeout(hudTimeout);
        hudTimeout = null;
    }
    if (providerTimeout) {
        clearTimeout(providerTimeout);
        providerTimeout = null;
    }
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    if (mouseMoveHandler) {
        window.removeEventListener('mousemove', mouseMoveHandler);
        mouseMoveHandler = null;
    }
    if (clickHandler) {
        window.removeEventListener('click', clickHandler);
        clickHandler = null;
    }
    if (keydownHandler) {
        window.removeEventListener('keydown', keydownHandler);
        keydownHandler = null;
    }
    if (globalKeydownHandler) {
        window.removeEventListener('keydown', globalKeydownHandler);
        globalKeydownHandler = null;
    }
    if (popstateHandler) {
        window.removeEventListener('popstate', popstateHandler);
        popstateHandler = null;
    }
    if (playerBackHandler) {
        SpatialNav.popBackHandler(playerBackHandler);
        playerBackHandler = null;
    }
    
    // Stop native video player if active
    try {
        const videoEl = document.getElementById('native-video-player');
        if (videoEl) {
            videoEl.pause();
            videoEl.src = '';
            videoEl.load();
        }
    } catch (e) {
        console.error('Error cleaning up native video:', e);
    }

    // Clean up window hooks
    delete window.playerShowHud;
    delete window.playerHideHud;
    delete window.playerResetHudTimer;
    delete window.playerTogglePlayPause;
    delete window.playerSeek;
    delete window.playerOpenModal;
    delete window.playerCloseModal;
};

/**
 * Toggles play and pause state between the active video playback source and HUD icons.
 */
function togglePlayPause() {
    const videoEl = document.getElementById('native-video-player');
    const iconPause = document.getElementById('player-icon-pause');
    const iconPlay = document.getElementById('player-icon-play');

    if (videoEl && videoEl.style.display !== 'none' && videoEl.src) {
        if (videoEl.paused) {
            videoEl.play().catch(e => console.warn('Play error:', e));
            if (iconPause) iconPause.classList.remove('hidden');
            if (iconPlay) iconPlay.classList.add('hidden');
        } else {
            videoEl.pause();
            if (iconPause) iconPause.classList.add('hidden');
            if (iconPlay) iconPlay.classList.remove('hidden');
        }
    } else {
        const iframe = document.getElementById('player-iframe');
        if (iframe && iframe.contentWindow) {
            try {
                iframe.contentWindow.postMessage({ type: 'play', action: 'toggle' }, '*');
            } catch (e) {
                console.warn('[IVIDS Player] Iframe postMessage notice:', e);
            }
        }
        if (iconPause && iconPlay) {
            const isPaused = iconPause.classList.contains('hidden');
            if (isPaused) {
                iconPause.classList.remove('hidden');
                iconPlay.classList.add('hidden');
            } else {
                iconPause.classList.add('hidden');
                iconPlay.classList.remove('hidden');
            }
        }
    }
}

/**
 * Seeks playback forward or backward by a relative number of seconds.
 * @param {number} deltaSeconds - Time delta to seek (positive or negative).
 */
function seekBy(deltaSeconds) {
    const videoEl = document.getElementById('native-video-player');
    if (videoEl && videoEl.style.display !== 'none' && videoEl.src) {
        videoEl.currentTime = Math.max(0, Math.min(videoEl.duration || Infinity, videoEl.currentTime + deltaSeconds));
    } else {
        const iframe = document.getElementById('player-iframe');
        if (iframe && iframe.contentWindow) {
            try {
                iframe.contentWindow.postMessage({ type: 'seek', delta: deltaSeconds }, '*');
            } catch (e) {
                console.warn('[IVIDS Player] Iframe postMessage notice:', e);
            }
        }
    }
}

/**
 * Displays the audio / subtitle / quality modal sheet and populates selectable options.
 * @param {string} title - The header title string of the modal.
 * @param {Array<{label: string, value: string, active?: boolean}>} options - Options list to display.
 * @param {Function} [onSelect] - Optional selection callback.
 */
function openModalSheet(title, options = [], onSelect = null) {
    const modal = document.getElementById('player-modal-sheet');
    const modalTitle = document.getElementById('player-modal-title');
    const modalOptions = document.getElementById('player-modal-options');
    if (!modal) return;

    if (modalTitle) modalTitle.textContent = title || window.i18n?.t('player.tracksTitle') || 'Audio & Subtitles';
    if (modalOptions) {
        modalOptions.innerHTML = '';
        const items = (options && options.length > 0) ? options : [
            { label: 'Default / Auto', value: 'default', active: true },
            { label: 'English', value: 'en', active: false },
            { label: 'Original Audio', value: 'orig', active: false }
        ];

        items.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'btn btn--secondary btn--block focusable modal-option' + (opt.active ? ' is-active' : '');
            btn.textContent = opt.label;
            btn.dataset.value = opt.value;
            btn.onclick = () => {
                modalOptions.querySelectorAll('.modal-option').forEach(b => b.classList.remove('is-active'));
                btn.classList.add('is-active');
                if (onSelect) onSelect(opt);
                closeModalSheet();
            };
            modalOptions.appendChild(btn);
        });
    }

    modal.style.display = 'flex';
    modal.classList.add('is-open');
    modal.classList.remove('hidden');

    const firstOption = modal.querySelector('.modal-option.focusable');
    if (firstOption) SpatialNav.setFocus(firstOption);
}

/**
 * Closes the active audio / subtitle / quality modal sheet and restores focus to OSD trigger.
 */
function closeModalSheet() {
    const modal = document.getElementById('player-modal-sheet');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.classList.add('hidden');
    modal.style.display = 'none';

    const trigger = document.getElementById('player-audio-sub') || document.getElementById('player-settings') || document.getElementById('play-pause-btn');
    if (trigger) SpatialNav.setFocus(trigger);
}

/**
 * Binds click listeners and actions to all OSD buttons, scrub bar, and modal sheets.
 * @param {Object} params - Active route parameters.
 */
function setupMediaControls(params) {
    const playPauseBtn = document.getElementById('play-pause-btn');
    if (playPauseBtn) {
        playPauseBtn.onclick = () => togglePlayPause();
    }

    const rewindBtn = document.getElementById('player-rewind');
    if (rewindBtn) {
        rewindBtn.onclick = () => seekBy(-10);
    }

    const forwardBtn = document.getElementById('player-forward');
    if (forwardBtn) {
        forwardBtn.onclick = () => seekBy(10);
    }

    const prevBtn = document.getElementById('player-prev');
    if (prevBtn) {
        prevBtn.onclick = () => {
            if (params.type === 'tv' && params.season && params.episode && parseInt(params.episode) > 1) {
                Router.loadPage('player', {
                    id: params.id,
                    type: 'tv',
                    season: params.season,
                    episode: parseInt(params.episode) - 1
                });
            } else {
                seekBy(-9999);
            }
        };
    }

    const nextBtn = document.getElementById('player-next');
    if (nextBtn) {
        nextBtn.onclick = () => {
            if (params.type === 'tv' && params.season && params.episode) {
                Router.loadPage('player', {
                    id: params.id,
                    type: 'tv',
                    season: params.season,
                    episode: parseInt(params.episode) + 1
                });
            } else {
                seekBy(30);
            }
        };
    }

    const audioSubBtn = document.getElementById('player-audio-sub');
    if (audioSubBtn) {
        audioSubBtn.onclick = () => {
            openModalSheet('Audio & Subtitles', [
                { label: 'Auto (Original Audio)', value: 'auto', active: true },
                { label: 'English Stereo', value: 'en', active: false },
                { label: 'English Subtitles', value: 'en-sub', active: false },
                { label: 'Subtitles Off', value: 'off', active: false }
            ]);
        };
    }

    const settingsBtn = document.getElementById('player-settings');
    if (settingsBtn) {
        settingsBtn.onclick = () => {
            const serverOverlay = document.getElementById('server-selection-overlay');
            if (serverOverlay) {
                const isHidden = serverOverlay.style.display === 'none';
                serverOverlay.style.display = isHidden ? 'flex' : 'none';
                if (isHidden) {
                    const activeServer = serverOverlay.querySelector('.server-btn.active') || serverOverlay.querySelector('.server-btn.focusable');
                    if (activeServer) SpatialNav.setFocus(activeServer);
                }
            }
        };
    }

    const fullscreenBtn = document.getElementById('player-fullscreen');
    if (fullscreenBtn) {
        fullscreenBtn.onclick = () => {
            try {
                if (!document.fullscreenElement) {
                    document.documentElement.requestFullscreen().catch(e => console.warn(e));
                } else {
                    document.exitFullscreen().catch(e => console.warn(e));
                }
            } catch (err) {
                console.warn('Fullscreen toggle failed:', err);
            }
        };
    }

    const progressBar = document.getElementById('player-progress-bar');
    if (progressBar) {
        progressBar.onclick = (e) => {
            const rect = progressBar.getBoundingClientRect();
            const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const videoEl = document.getElementById('native-video-player');
            if (videoEl && videoEl.duration) {
                videoEl.currentTime = pos * videoEl.duration;
            }
        };
    }

    const modalClose = document.getElementById('player-modal-close');
    if (modalClose) {
        modalClose.onclick = () => closeModalSheet();
    }

    // Set title display
    const titleEl = document.getElementById('player-title');
    if (titleEl) {
        if (params.title) {
            titleEl.textContent = params.title;
        } else if (params.id) {
            Api.getDetails(params.id, params.type || 'movie').then(details => {
                if (details && titleEl) {
                    const name = details.title || details.name || 'IVIDS Player';
                    const epInfo = (params.season && params.episode) ? ` - S${params.season} E${params.episode}` : '';
                    titleEl.textContent = `${name}${epInfo}`;
                }
            }).catch(() => {});
        }
    }

    // Track native video playback progress
    const nativeVideo = document.getElementById('native-video-player');
    if (nativeVideo) {
        nativeVideo.addEventListener('timeupdate', () => {
            const fill = document.getElementById('player-progress-fill');
            const curTime = document.getElementById('player-current-time');
            const durTime = document.getElementById('player-duration');
            if (nativeVideo.duration && fill) {
                const pct = (nativeVideo.currentTime / nativeVideo.duration) * 100;
                fill.style.width = `${pct}%`;
            }
            if (curTime) curTime.textContent = formatTime(nativeVideo.currentTime);
            if (durTime) durTime.textContent = formatTime(nativeVideo.duration);
        });
    }
}

/**
 * Initializes the video player page by loading content metadata, configuring the iframe source,
 * handling server selection, and setting up the premium HUD controls.
 * This affects the global page router, active video container state, and player settings.
 * @param {Object} params - Route parameters containing id, type, season, and episode.
 */
export async function init(params) {
    try {
        console.log('[IVIDS Player] Initializing Player with params:', params);
        if (!params || (!params.id && params.type !== 'live')) {
            console.error('[IVIDS Player] Invalid or missing parameters provided for player');
            Router.loadPage('home');
            return;
        }

        // Run any previous cleanups just in case
        try {
            window.playerCleanups();
        } catch (e) {
            console.error('Error in initial cleanup:', e);
        }

        // Hide header and apply fullscreen layout
        try {
            const app = document.getElementById('app');
            if (app) app.classList.add('fullscreen-layout');
            const header = document.getElementById('header');
            if (header) header.style.display = 'none';
        } catch (headerError) {
            console.error('Error hiding header:', headerError);
        }

        // Set up global exit handlers
        globalKeydownHandler = (event) => {
            const key = event.key || '';
            const code = event.keyCode || event.which;
            if (key === 'Escape' || key === 'Backspace' || code === 27 || code === 8 || code === 4 || code === 10009 || code === 461 || key === 'GoBack' || key === 'Back') {
                event.preventDefault();
                SpatialNav.back();
            }
        };
        window.addEventListener('keydown', globalKeydownHandler);

        popstateHandler = () => {
            try {
                window.playerCleanups();
                const app = document.getElementById('app');
                if (app) app.classList.remove('fullscreen-layout');
                const header = document.getElementById('header');
                if (header) header.style.display = '';
            } catch (e) {
                console.error('Error on popstate cleanup:', e);
            }
        };
        window.addEventListener('popstate', popstateHandler);

        if (playerBackHandler) {
            SpatialNav.popBackHandler(playerBackHandler);
        }
        playerBackHandler = () => {
            if (SpatialNav.currentPageLogic && typeof SpatialNav.currentPageLogic.handleBack === 'function') {
                if (SpatialNav.currentPageLogic.handleBack()) return true;
            }
            exitPlayer(params);
            return true;
        };
        SpatialNav.pushBackHandler(playerBackHandler);

        const backBtn = document.getElementById('player-back');
        if (backBtn) {
            backBtn.onclick = () => {
                SpatialNav.back();
            };
        }

        // Setup media button listeners
        setupMediaControls(params);

        // Handle Live TV
        if (params.type === 'live') {
            const videoUrl = params.url;

            // Hide standard iframe, show native video
            const iframe = document.getElementById('video-player');
            if (iframe) iframe.style.display = 'none';

            const videoEl = document.getElementById('native-video-player');
            if (videoEl) {
                videoEl.style.display = 'block';
                videoEl.src = videoUrl;
                bindNativeVideoLogs(videoEl);
                videoEl.play().catch(e => console.error('Error playing live stream:', e));
            }

            // Hide loading overlay once live TV loads/plays
            const loadingOverlay = document.getElementById('player-loading-overlay');
            if (loadingOverlay) loadingOverlay.style.display = 'none';

            // Setup overlay visibility for back button / HUD
            setupOverlayVisibility(params);
            return;
        }

        // Fetch details to add to recently watched in the background (non-blocking)
        if (params.type !== 'live' && params.type !== 'trailer') {
            Api.getDetails(params.id, params.type).then(details => {
                if (details) {
                    try {
                        addToRecentlyWatched({
                            ...details,
                            media_type: params.type,
                            season: params.season,
                            episode: params.episode
                        });
                    } catch (watchedError) {
                        console.error('Error adding to recently watched:', watchedError);
                    }
                }
            }).catch(detailsError => {
                console.error('Error fetching details in player background:', detailsError);
            });
        }

        // Check for next episode if it's a TV show
        if (params.type === 'tv' && params.season && params.episode) {
            checkForNextEpisode(params.id, parseInt(params.season), parseInt(params.episode));
        }

        const container = document.getElementById('video-container');
        if (!container) {
            console.error('Video container not found');
            ErrorHandler.show('Failed to load player. Video container missing.', () => Router.loadPage('home'));
            Router.loadPage('home');
            return;
        }

        // Ensure container fills viewport and is fixed
        try {
            container.style.position = "fixed";
            container.style.top = "0";
            container.style.left = "0";
            container.style.width = "100vw";
            container.style.height = "100vh";
            container.style.background = "#000";
            container.style.overflow = "hidden";
        } catch (styleError) {
            console.error('Error styling container:', styleError);
        }

        // Show loader
        const loadingOverlay = document.getElementById('player-loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'flex';

        let url = '';
        try {
            if (params.type === 'trailer') {
                url = `https://www.youtube.com/embed/${params.ytKey}?autoplay=1&enablejsapi=1`;
            } else {
                url = Api.getVideoUrl(params.id, params.type, params.season, params.episode, 'vidlink');
            }
        } catch (urlError) {
            console.error('Error generating video URL:', urlError);
            ErrorHandler.show('Failed to generate video URL.', () => init(params));
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            const backType = params.type === 'trailer' ? params.mediaType : params.type;
            Router.loadPage('details', { id: params.id, type: backType });
            return;
        }

        // Remove any existing iframe
        try {
            const oldIframe = document.getElementById('player-iframe');
            if (oldIframe) oldIframe.remove();
        } catch (cleanupError) {
            console.error('Error removing old iframe:', cleanupError);
        }

        try {
            console.log(`[IVIDS Player] Initializing direct embed player for URL: ${url}`);
            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";

            iframe.style.position = "absolute";
            iframe.style.top = "0";
            iframe.style.left = "0";
            iframe.style.width = "100vw";
            iframe.style.height = "100vh";
            iframe.style.border = "none";
            iframe.style.background = "#000";
            iframe.id = "player-iframe";
            iframe.className = "focusable";
            iframe.tabIndex = 0;
            iframe.style.zIndex = "1";

            const statusPanel = document.getElementById('player-status-panel');
            if (statusPanel) statusPanel.style.display = 'none';

            iframe.onload = () => {
                console.log(`[IVIDS Player] Provider iframe loaded successfully (src: ${iframe.src})`);
                if (statusPanel) {
                    statusPanel.style.display = 'none';
                    statusPanel.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
                }
                if (loadingOverlay) loadingOverlay.style.display = 'none';
                SpatialNav.setFocus(iframe);

                setTimeout(() => {
                    try {
                        iframe.focus();
                        console.log('[IVIDS Player] Sending autoplay postMessage trigger to iframe content window');
                        iframe.contentWindow?.postMessage({ type: 'play', action: 'play' }, '*');
                    } catch (e) {
                        console.warn('[IVIDS Player] Auto-play trigger message notice:', e);
                    }
                }, 1500);
            };

            container.appendChild(iframe);

            // Render Server Selection
            renderServerSelection(params, iframe);

        } catch (iframeError) {
            console.error('Error creating/appending iframe:', iframeError);
            ErrorHandler.show('Failed to initialize video player.', () => init(params));
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            Router.loadPage('details', { id: params.id, type: params.type });
            return;
        }

        // Handle overlay visibility on activity
        setupOverlayVisibility(params);

    } catch (error) {
        console.error('Critical error in player.init:', error);
        ErrorHandler.show('An error occurred while loading the player.');
    }
}

/**
 * Checks the TMDB API to determine if a subsequent episode or season exists for the active TV series.
 * This determines the visibility of the "Next Episode" button on the player HUD.
 * @param {string} seriesId - The TMDB ID of the TV show.
 * @param {number} currentSeason - The current season number.
 * @param {number} currentEpisode - The current episode number.
 */
async function checkForNextEpisode(seriesId, currentSeason, currentEpisode) {
    try {
        const nextBtnContainer = document.getElementById('next-episode-container');
        const nextBtn = document.getElementById('player-next-ep-btn') || document.getElementById('player-next');

        if (!nextBtnContainer || !nextBtn) return;

        // 1. Try to find next episode in current season
        const seasonDetails = await Api.getSeasonDetails(seriesId, currentSeason);

        if (seasonDetails && seasonDetails.episodes) {
            const nextEpisode = seasonDetails.episodes.find(e => e.episode_number === currentEpisode + 1);

            if (nextEpisode) {
                showNextButton(seriesId, currentSeason, currentEpisode + 1);
                return;
            }
        }

        // 2. If not in current season, check if there is a next season
        const seriesDetails = await Api.getDetails(seriesId, 'tv');
        if (seriesDetails && seriesDetails.seasons) {
            const nextSeason = seriesDetails.seasons.find(s => s.season_number === currentSeason + 1);
            if (nextSeason) {
                showNextButton(seriesId, currentSeason + 1, 1);
            }
        }

    } catch (error) {
        console.error('Error checking for next episode:', error);
    }
}

/**
 * Configures and shows the "Next Episode" button on the player HUD bottom controls panel.
 * This sets the click handler to reload the player page with the next episode details.
 * @param {string} seriesId - The TMDB ID of the TV show.
 * @param {number} nextSeason - The season number of the next episode.
 * @param {number} nextEpisode - The episode number of the next episode.
 */
function showNextButton(seriesId, nextSeason, nextEpisode) {
    const container = document.getElementById('next-episode-container');
    const btn = document.getElementById('player-next-ep-btn') || document.getElementById('player-next');

    if (container && btn) {
        container.style.display = 'block';
        container.classList.remove('hidden');
        btn.onclick = () => {
            Router.loadPage('player', {
                id: seriesId,
                type: 'tv',
                season: nextSeason,
                episode: nextEpisode
            });
        };
    }
}

/**
 * Renders the available streaming server source buttons and configures their click behavior.
 * This modifies the player server list container and updates the player iframe source URL upon selection.
 * @param {Object} params - Route parameters containing content ID and type details.
 * @param {HTMLIFrameElement} iframe - The player iframe element.
 */
function renderServerSelection(params, iframe) {
    const overlay = document.getElementById('server-selection-overlay');
    const serverList = document.getElementById('player-server-list');
    
    if (params.type === 'trailer') {
        if (overlay) overlay.style.display = 'none';
        return;
    } else {
        if (overlay) overlay.style.display = 'block';
    }

    if (!serverList) return;

    serverList.innerHTML = '';
    
    const config = Api.getPlayerConfig();
    let currentServerId = 'vidlink';
    
    const matchingServer = Api.SERVERS.find(s => s.url === config.playerBaseUrl);
    if (matchingServer) {
        currentServerId = matchingServer.id;
    }

    Api.SERVERS.forEach(server => {
        const btn = document.createElement('button');
        btn.className = 'btn server-btn focusable';
        if (server.id === currentServerId) {
            btn.classList.add('active', 'is-active', 'btn--primary');
        } else {
            btn.classList.add('btn--secondary');
        }
        btn.textContent = server.name;
        btn.dataset.serverId = server.id;

        btn.onclick = () => {
            if (currentServerId === server.id) return;
            console.log(`[IVIDS Player] Switching server provider to: ${server.name} (ID: ${server.id})`);
            
            document.querySelectorAll('.server-btn').forEach(b => {
                b.classList.remove('active', 'is-active', 'btn--primary', 'btn-primary');
                b.classList.add('btn--secondary');
            });
            btn.classList.add('active', 'is-active', 'btn--primary');
            btn.classList.remove('btn--secondary', 'btn-secondary');
            currentServerId = server.id;

            const statusPanel = document.getElementById('player-status-panel');
            const videoEl = document.getElementById('native-video-player');

            if (statusPanel) statusPanel.style.display = 'none';
            if (providerTimeout) {
                clearTimeout(providerTimeout);
                providerTimeout = null;
            }

            if (videoEl) {
                videoEl.pause();
                videoEl.style.display = 'none';
            }
            if (iframe) {
                iframe.style.display = 'block';
                iframe.src = Api.getVideoUrl(params.id, params.type, params.season, params.episode, server.id);
            }
        };

        serverList.appendChild(btn);
    });
}

/**
 * Configures the activity event listeners to toggle visibility of the player HUD overlay.
 * Toggles visibility on mouse move, clicks, or key presses, auto-hiding after 4 seconds of inactivity.
 * @param {Object} params - Route parameters of the player.
 */
function setupOverlayVisibility(params) {
    const playerHud = document.getElementById('player-hud');
    if (!playerHud) return;

    /**
     * Reveals the player HUD overlay, sets up auto-hide timers, and handles default control focus.
     * Affects the display style and visibility state of the HUD elements, and updates spatial focus.
     */
    const showHUD = () => {
        if (hudTimeout) {
            clearTimeout(hudTimeout);
        }
        
        const wasHidden = !playerHud.classList.contains('visible');
        playerHud.style.display = 'flex';
        playerHud.classList.remove('hidden');
        
        requestAnimationFrame(() => {
            playerHud.classList.add('visible');
            if (wasHidden) {
                const playPause = document.getElementById('play-pause-btn');
                if (playPause && SpatialNav.isVisible(playPause)) {
                    SpatialNav.setFocus(playPause);
                } else {
                    const activeServer = playerHud.querySelector('.server-btn.active');
                    if (activeServer) {
                        SpatialNav.setFocus(activeServer);
                    } else {
                        const backBtn = document.getElementById('player-back');
                        if (backBtn) SpatialNav.setFocus(backBtn);
                    }
                }
            }
        });

        hudTimeout = setTimeout(() => {
            const focused = document.activeElement;
            const hasFocusInside = focused && playerHud.contains(focused);

            if (hasFocusInside) {
                showHUD();
            } else {
                hideHUD();
            }
        }, 4000);
    };

    /**
     * Hides the player HUD overlay and shifts spatial focus back to the primary video playback container.
     * Resets the display style of HUD elements and blurs any active HUD controls.
     */
    const hideHUD = () => {
        playerHud.classList.remove('visible');
        playerHud.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
        
        if (document.activeElement && playerHud.contains(document.activeElement)) {
            document.activeElement.blur();
            const iframe = document.getElementById('player-iframe');
            if (iframe) {
                SpatialNav.setFocus(iframe);
            } else {
                const nativeVideo = document.getElementById('native-video-player');
                if (nativeVideo) nativeVideo.focus();
            }
        }
        
        setTimeout(() => {
            if (!playerHud.classList.contains('visible')) {
                playerHud.style.display = 'none';
            }
        }, 400);
    };

    mouseMoveHandler = showHUD;
    clickHandler = showHUD;
    keydownHandler = (e) => {
        const key = e.key || '';
        const code = e.keyCode || e.which;
        if (key === 'Escape' || key === 'Backspace' || code === 27 || code === 8 || code === 4 || code === 10009 || code === 461 || key === 'GoBack' || key === 'Back') {
            return;
        }
        showHUD();
    };

    window.addEventListener('mousemove', mouseMoveHandler);
    window.addEventListener('click', clickHandler);
    window.addEventListener('keydown', keydownHandler);

    // Expose helpers for spatialNavPlayer
    window.playerShowHud = showHUD;
    window.playerHideHud = hideHUD;
    window.playerResetHudTimer = () => {
        if (hudTimeout) {
            clearTimeout(hudTimeout);
            hudTimeout = setTimeout(() => hideHUD(), 4000);
        }
    };
    window.playerTogglePlayPause = togglePlayPause;
    window.playerSeek = seekBy;
    window.playerOpenModal = openModalSheet;
    window.playerCloseModal = closeModalSheet;
    
    showHUD();
}
