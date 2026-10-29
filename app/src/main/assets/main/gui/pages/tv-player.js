import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { EpgManager } from '../../logic/livetv/epg-manager.js';
import { Toast } from '../js/toast.js';
import { proxyUrl } from '../js/utils/proxy.js';

let overlayTimeout;
let zappingHudTimeout;
let hlsInstance = null;
let epgRequestId = 0;
const LIVE_TV_STATUS_KEY = 'ivids-live-tv-status-cache';
const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Initializes the custom TV player, binds media controls, handles D-pad zapping,
 * handles custom overlay visibility behavior, and handles memory cleanup.
 * @param {Object} params - Dynamic route parameters including video URL and metadata.
 */
export async function init(params) {
    console.log('TV Player initializing with params:', params);

    const video = document.getElementById('tv-video');
    const title = document.getElementById('tv-title');
    const group = document.getElementById('tv-group');
    const overlay = document.getElementById('tv-overlay');
    const loader = document.getElementById('tv-loading');
    const playPauseBtn = document.getElementById('tv-play-pause');
    const backBtn = document.getElementById('tv-back');
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');
    const zappingHud = document.getElementById('tv-zapping-hud');
    const zappingName = document.getElementById('zapping-channel-name');
    const aspectRatioBtn = document.getElementById('tv-aspect-ratio');
    const epgBtn = document.getElementById('tv-epg-btn');
    const epgCloseBtn = document.getElementById('tv-epg-close');

    let currentStreamUrl = '';
    let streamErrorRetries = 0;
    let autoZapAttempts = 0;
    let autoZapTimer = null;
    let streamStartupTimer = null;

    const aspectModes = ['contain', 'cover', 'fill'];
    let currentAspectIndex = 0;

    /**
     * Cycles the video container object-fit mode across contain, cover, and fill.
     */
    function toggleAspectRatio() {
        currentAspectIndex = (currentAspectIndex + 1) % aspectModes.length;
        const mode = aspectModes[currentAspectIndex];
        if (video) {
            video.style.objectFit = mode;
        }
        Toast.show(`Aspect Ratio: ${mode.toUpperCase()}`, { type: 'info' });
    }

    /**
     * Opens or closes the quick electronic program guide channel overlay list.
     * @param {boolean} [show] - Explicit open or close flag.
     */
    function toggleQuickEpg(show) {
        const quickEpg = document.getElementById('tv-quick-epg');
        const quickEpgList = document.getElementById('tv-quick-epg-list');
        if (!quickEpg) return;

        const shouldOpen = (show !== undefined) ? show : !quickEpg.classList.contains('is-open');

        if (shouldOpen) {
            if (quickEpgList && window.liveTvState?.channels) {
                quickEpgList.innerHTML = '';
                const channels = window.liveTvState.channels;
                const currentIndex = window.liveTvState.currentIndex || 0;
                const maxRender = Math.min(channels.length, 60);

                for (let i = 0; i < maxRender; i++) {
                    const ch = channels[i];
                    const btn = document.createElement('button');
                    btn.className = 'btn btn--secondary btn--block focusable channel-list-item' + (i === currentIndex ? ' is-active btn--primary' : '');
                    btn.textContent = ch.name;
                    btn.dataset.channelIndex = i;
                    btn.onclick = () => {
                        window.liveTvState.currentIndex = i;
                        loadStream(ch.url);
                        if (title) title.textContent = ch.name;
                        if (group) group.textContent = ch.group ? ch.group.replace(/:/g, ' ') : '';
                        updateEpgInfo(ch.name, ch.group || '', ch.tvgId || '');
                        toggleQuickEpg(false);
                        showOverlay();
                    };
                    quickEpgList.appendChild(btn);
                }
            }
            quickEpg.style.display = 'flex';
            quickEpg.classList.add('is-open');
            quickEpg.classList.remove('hidden');

            const activeItem = quickEpg.querySelector('.channel-list-item.is-active') || quickEpg.querySelector('.channel-list-item.focusable');
            if (activeItem) SpatialNav.setFocus(activeItem);
        } else {
            quickEpg.classList.remove('is-open');
            quickEpg.classList.add('hidden');
            quickEpg.style.display = 'none';

            if (playPauseBtn) SpatialNav.setFocus(playPauseBtn);
        }
    }

    /**
     * Dynamically updates the Electronic Program Guide details in the player overlay.
     * @param {string} channelName - The current channel name.
     * @param {string} channelGroup - The category or group string.
     * @param {string} [tvgId] - Optional EPG identifier.
     */
    async function updateEpgInfo(channelName, channelGroup, tvgId = '') {
        const tvEpgEl = document.getElementById('tv-epg');
        const requestId = ++epgRequestId;
        if (tvEpgEl) {
            tvEpgEl.textContent = window.i18n?.t('livetv.loading') || 'Loading channels...';
            const epg = await EpgManager.getCurrentProgram(channelName, channelGroup, tvgId);
            if (requestId !== epgRequestId) return;
            tvEpgEl.textContent = `${epg.title} (${epg.start} - ${epg.end})`;
        }
    }

    /**
     * Loads HLS/Live stream URL, attaching it to Hls.js demuxer on PC,
     * or natively on Android WebView/Safari.
     * @param {string} url - Target stream source URL.
     */
    function loadStream(url) {
        currentStreamUrl = url;
        streamErrorRetries = 0;
        if (autoZapTimer) {
            clearTimeout(autoZapTimer);
            autoZapTimer = null;
        }
        clearTimeout(streamStartupTimer);

        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }

        const streamUrl = proxyUrl(url);
        streamStartupTimer = setTimeout(() => {
            const isReady = video && video.readyState >= 2 && !video.paused;
            if (!isReady && currentStreamUrl === url) {
                console.warn('Stream startup timed out, skipping channel:', url);
                updateStoredChannelStatus(url, 'offline');
                scheduleNextPlayableChannel();
            }
        }, 12000);

        if (window.Hls && window.Hls.isSupported()) {
            console.log('TV Player: Playing stream using HLS.js library');
            hlsInstance = new window.Hls({
                maxMaxBufferLength: 10,
                maxBufferLength: 6,
                liveSyncDurationCount: 2,
                initialLiveManifestSize: 2,
                enableWorker: true,
                lowLatencyMode: true
            });
            hlsInstance.loadSource(streamUrl);
            hlsInstance.attachMedia(video);
            hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(e => {
                    if (e.name === 'AbortError') {
                        console.log('Playback request was interrupted (AbortError), ignoring.');
                        return;
                    }
                    console.error('Error starting TV stream (HLS.js):', e);
                    updateStoredChannelStatus(url, 'offline');
                    scheduleNextPlayableChannel();
                });
            });
            hlsInstance.on(window.Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case window.Hls.ErrorTypes.NETWORK_ERROR:
                            if (streamErrorRetries < 1) {
                                streamErrorRetries++;
                                console.error('Fatal network error, trying to recover...', data);
                                hlsInstance.startLoad();
                            } else {
                                console.error('Fatal network error, skipping channel...', data);
                                updateStoredChannelStatus(url, 'offline');
                                scheduleNextPlayableChannel();
                            }
                            break;
                        case window.Hls.ErrorTypes.MEDIA_ERROR:
                            if (streamErrorRetries < 1) {
                                streamErrorRetries++;
                                console.error('Fatal media error, trying to recover...', data);
                                hlsInstance.recoverMediaError();
                            } else {
                                console.error('Fatal media error, skipping channel...', data);
                                updateStoredChannelStatus(url, 'offline');
                                scheduleNextPlayableChannel();
                            }
                            break;
                        default:
                            console.error('Fatal unrecoverable HLS.js error:', data);
                            updateStoredChannelStatus(url, 'offline');
                            scheduleNextPlayableChannel();
                            break;
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            console.log('TV Player: Playing stream natively');
            video.src = streamUrl;
            video.play().catch(e => {
                if (e.name === 'AbortError') {
                    console.log('Playback request was interrupted (AbortError), ignoring.');
                    return;
                }
                console.error('Error starting TV stream (Native):', e);
                updateStoredChannelStatus(url, 'offline');
                scheduleNextPlayableChannel();
            });
        } else {
            if (loader) loader.style.display = 'none';
            Toast.show('HLS playback is not supported in this browser.', { type: 'error' });
        }
    }

    // Enable fullscreen layout tweaks
    const app = document.getElementById('app');
    if (app) app.classList.add('fullscreen-layout');

    // Apply translation strings
    if (window.i18n) window.i18n.applyTranslations();
    EpgManager.init();

    // Set initial text content
    if (params.title) title.textContent = params.title;
    if (params.group) group.textContent = params.group ? params.group.replace(/:/g, ' ') : '';

    // Set initial EPG details
    updateEpgInfo(params.title || 'Channel Name', params.group || '', params.tvgId || '');

    // Load initial source
    if (params.url) {
        loadStream(params.url);
    }

    // Media element callbacks
    video.onloadstart = () => {
        if (loader) loader.style.display = 'flex';
    };
    video.onplaying = () => {
        if (loader) loader.style.display = 'none';
        clearTimeout(streamStartupTimer);
        updatePlaybackIconState(false);
        autoZapAttempts = 0;
        updateStoredChannelStatus(currentStreamUrl, 'online');
    };
    video.onerror = () => {
        console.error('Video error:', video.error);
        if (loader) loader.style.display = 'none';
        updateStoredChannelStatus(currentStreamUrl, 'offline');
        scheduleNextPlayableChannel();
    };

    /**
     * Toggles play and pause vector icon representations based on player state.
     * @param {boolean} isPaused - True if playback is paused.
     */
    function updatePlaybackIconState(isPaused) {
        if (isPaused) {
            if (iconPlay) iconPlay.style.display = 'block';
            if (iconPause) iconPause.style.display = 'none';
        } else {
            if (iconPlay) iconPlay.style.display = 'none';
            if (iconPause) iconPause.style.display = 'block';
        }
    }

    /**
     * Toggles playback between paused and playing states.
     */
    function togglePlayPause() {
        if (video.paused) {
            video.play().then(() => updatePlaybackIconState(false)).catch(err => console.error(err));
        } else {
            video.pause();
            updatePlaybackIconState(true);
        }
        showOverlay();
    }

    // Toggle play/pause
    if (playPauseBtn) {
        playPauseBtn.onclick = () => togglePlayPause();
    }

    // Aspect ratio button click handler
    if (aspectRatioBtn) {
        aspectRatioBtn.onclick = () => toggleAspectRatio();
    }

    // Quick EPG button click handler
    if (epgBtn) {
        epgBtn.onclick = () => toggleQuickEpg(true);
    }

    // Quick EPG close button handler
    if (epgCloseBtn) {
        epgCloseBtn.onclick = () => toggleQuickEpg(false);
    }

    let tvPlayerBackHandler = () => {
        if (SpatialNav.currentPageLogic && typeof SpatialNav.currentPageLogic.handleBack === 'function') {
            if (SpatialNav.currentPageLogic.handleBack()) return true;
        }
        exitPlayer();
        return true;
    };
    SpatialNav.pushBackHandler(tvPlayerBackHandler);

    // Back button clean handler
    if (backBtn) {
        backBtn.onclick = () => {
            SpatialNav.back();
        };
    }

    /**
     * Dismantles video sources, triggers cleanup functions, and navigates backwards.
     */
    function exitPlayer() {
        if (window.tvPlayerCleanups) {
            window.tvPlayerCleanups();
            window.tvPlayerCleanups = null;
        }

        const app = document.getElementById('app');
        if (app) app.classList.remove('fullscreen-layout');

        video.pause();
        video.src = '';
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }
        Router.goBack();
    }

    /**
     * Toggles visibility of the TV controls overlay and manages spatial focus.
     * Shows the overlay, triggers focusFirst to select controls, and handles auto-hiding of elements.
     */
    const showOverlay = () => {
        const wasHidden = overlay && !overlay.classList.contains('show');
        if (overlay) overlay.classList.add('show');
        
        if (wasHidden) {
            SpatialNav.focusFirst();
        }

        clearTimeout(overlayTimeout);
        overlayTimeout = setTimeout(() => {
            if (overlay) {
                overlay.classList.remove('show');
                overlay.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
                if (document.activeElement && overlay.contains(document.activeElement)) {
                    document.activeElement.blur();
                    const tvVideo = document.getElementById('tv-video');
                    if (tvVideo) tvVideo.focus();
                }
            }
        }, 4000);
    };

    /**
     * Hides the TV controls overlay immediately.
     */
    const hideOverlay = () => {
        if (overlay) {
            overlay.classList.remove('show');
            overlay.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
            if (document.activeElement && overlay.contains(document.activeElement)) {
                document.activeElement.blur();
            }
        }
    };

    /**
     * Shifts current channel to a new index, updates DOM elements, triggers zapping HUD displays,
     * and performs channel stream switches.
     * @param {number} direction - Direction modifier (-1 for UP, +1 for DOWN).
     */
    const zapChannel = (direction) => {
        if (!window.liveTvState || !window.liveTvState.channels || window.liveTvState.channels.length === 0) {
            return;
        }

        const { channels, currentIndex } = window.liveTvState;
        let newIndex = currentIndex + direction;

        if (newIndex < 0) newIndex = channels.length - 1;
        if (newIndex >= channels.length) newIndex = 0;

        window.liveTvState.currentIndex = newIndex;
        const nextChannel = channels[newIndex];

        console.log(`Zapping to ${newIndex}: ${nextChannel.name}`);

        // Update HUD
        if (zappingHud && zappingName) {
            zappingName.textContent = nextChannel.name;
            zappingHud.style.display = 'flex';
            zappingHud.classList.add('fade-in');
            
            clearTimeout(zappingHudTimeout);
            zappingHudTimeout = setTimeout(() => {
                zappingHud.style.display = 'none';
            }, 3000);
        }

        // Update control panel elements if overlay is active
        if (title) title.textContent = nextChannel.name;
        if (group) group.textContent = nextChannel.group ? nextChannel.group.replace(/:/g, ' ') : '';

        // Update zapped EPG details
        updateEpgInfo(nextChannel.name, nextChannel.group || '', nextChannel.tvgId || '');

        // Switch stream URL
        if (loader) loader.style.display = 'flex';
        video.pause();
        loadStream(nextChannel.url);

        showOverlay();
    };

    /**
     * Moves forward after a broken stream instead of leaving the player dead.
     */
    function scheduleNextPlayableChannel() {
        if (loader) loader.style.display = 'none';
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }
        clearTimeout(streamStartupTimer);

        if (!window.liveTvState?.channels || window.liveTvState.channels.length < 2) {
            Toast.show('Error playing stream. This channel may be temporarily unavailable.', { type: 'error' });
            return;
        }

        if (autoZapAttempts >= Math.min(10, window.liveTvState.channels.length - 1)) {
            Toast.show('Could not find a playable channel nearby. Try another channel or source.', { type: 'error' });
            return;
        }

        autoZapAttempts++;
        Toast.show('Channel failed. Trying the next stream...', { type: 'warning' });
        clearTimeout(autoZapTimer);
        autoZapTimer = setTimeout(() => zapChannel(1), 900);
    }

    /**
     * Keydown handler that triggers showing the control overlay.
     * Ensures overlays are visible upon user activity.
     * @param {KeyboardEvent} e - The keydown event object.
     */
    const keydownHandler = (e) => {
        showOverlay();
    };

    /**
     * Mouse movement handler that triggers showing the control overlay.
     * Ensures overlays are visible upon user mouse activity.
     */
    const mousemoveHandler = () => {
        showOverlay();
    };

    // Register cleanup hook
    if (window.tvPlayerCleanups) {
        window.tvPlayerCleanups();
    }

    window.addEventListener('keydown', keydownHandler);
    window.addEventListener('mousemove', mousemoveHandler);

    // Expose helpers for spatialNavTvPlayer
    window.tvZapChannel = (dir) => zapChannel(dir);
    window.tvToggleQuickEpg = (show) => toggleQuickEpg(show);
    window.tvToggleAspectRatio = () => toggleAspectRatio();
    window.tvPlayPause = () => togglePlayPause();
    window.tvShowOverlay = () => showOverlay();
    window.tvHideOverlay = () => hideOverlay();
    window.tvIsOverlayVisible = () => overlay && overlay.classList.contains('show');
    window.tvIsQuickEpgOpen = () => {
        const q = document.getElementById('tv-quick-epg');
        return q && q.classList.contains('is-open');
    };

    window.tvPlayerCleanups = () => {
        window.removeEventListener('keydown', keydownHandler);
        window.removeEventListener('mousemove', mousemoveHandler);
        if (tvPlayerBackHandler) {
            SpatialNav.popBackHandler(tvPlayerBackHandler);
            tvPlayerBackHandler = null;
        }
        clearTimeout(overlayTimeout);
        clearTimeout(zappingHudTimeout);
        clearTimeout(autoZapTimer);
        clearTimeout(streamStartupTimer);
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }

        delete window.tvZapChannel;
        delete window.tvToggleQuickEpg;
        delete window.tvToggleAspectRatio;
        delete window.tvPlayPause;
        delete window.tvShowOverlay;
        delete window.tvHideOverlay;
        delete window.tvIsOverlayVisible;
        delete window.tvIsQuickEpgOpen;
    };

    // Display initial overlay
    showOverlay();

    // Focus controls
    SpatialNav.focusFirst();
}

/**
 * Persists channel health so the Live TV list can hide broken streams by default.
 * @param {string} url - Channel stream URL.
 * @param {string} status - online/offline status string.
 */
function updateStoredChannelStatus(url, status) {
    if (!url) return;
    try {
        const now = Date.now();
        const entries = JSON.parse(localStorage.getItem(LIVE_TV_STATUS_KEY) || '[]')
            .filter(([, value]) => value && now - value.timestamp < STATUS_TTL_MS);
        const cache = new Map(entries);
        cache.set(url, { status, timestamp: now });
        localStorage.setItem(LIVE_TV_STATUS_KEY, JSON.stringify(Array.from(cache.entries())));
    } catch (error) {
        console.warn('Failed to store channel status:', error);
    }
}
