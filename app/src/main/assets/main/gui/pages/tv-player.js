import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { EpgManager } from '../../logic/livetv/epg-manager.js';
import { Toast } from '../js/toast.js';

let overlayTimeout;
let zappingHudTimeout;
let hlsInstance = null;

/**
 * init function
 * =============
 * Explains: Initializes the custom TV player, binds media controls, handles D-pad zapping,
 * handles custom overlay visibility behavior, and handles memory cleanup.
 * 
 * @param {object} params - Dynamic route parameters including video URL and metadata.
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

    /**
     * updateEpgInfo function
     * ======================
     * Explains: Dynamically updates the Electronic Program Guide details in the player overlay.
     */
    function updateEpgInfo(channelName, channelGroup) {
        const tvEpgEl = document.getElementById('tv-epg');
        if (tvEpgEl) {
            const epg = EpgManager.getCurrentProgram(channelName, channelGroup);
            tvEpgEl.textContent = `${epg.title} (${epg.start} - ${epg.end})`;
        }
    }

    /**
     * loadStream function
     * ===================
     * Explains: Loads HLS/Live stream URL, attaching it to Hls.js demuxer on PC,
     * or natively on Android WebView/Safari.
     */
    function loadStream(url) {
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }

        if (window.Hls && window.Hls.isSupported()) {
            console.log('TV Player: Playing stream using HLS.js library');
            hlsInstance = new window.Hls({
                maxMaxBufferLength: 10,
                liveSyncDuration: 3
            });
            hlsInstance.loadSource(url);
            hlsInstance.attachMedia(video);
            hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(e => console.error('Error starting TV stream (HLS.js):', e));
            });
            hlsInstance.on(window.Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case window.Hls.ErrorTypes.NETWORK_ERROR:
                            console.error('Fatal network error, trying to recover...', data);
                            hlsInstance.startLoad();
                            break;
                        case window.Hls.ErrorTypes.MEDIA_ERROR:
                            console.error('Fatal media error, trying to recover...', data);
                            hlsInstance.recoverMediaError();
                            break;
                        default:
                            console.error('Fatal unrecoverable HLS.js error:', data);
                            if (loader) loader.style.display = 'none';
                            Toast.show('Error playing stream. This channel may be temporarily unavailable.', { type: 'error' });
                            hlsInstance.destroy();
                            hlsInstance = null;
                            break;
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            console.log('TV Player: Playing stream natively');
            video.src = url;
            video.play().catch(e => console.error('Error starting TV stream (Native):', e));
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

    // Set initial text content
    if (params.title) title.textContent = params.title;
    if (params.group) group.textContent = params.group ? params.group.replace(/:/g, ' ') : '';

    // Set initial EPG details
    updateEpgInfo(params.title || 'Channel Name', params.group || '');

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
        updatePlaybackIconState(false); // Make sure pause button shows
    };
    video.onerror = () => {
        console.error('Video error:', video.error);
        if (loader) loader.style.display = 'none';
        Toast.show('Error playing stream. This channel may be temporarily unavailable.', { type: 'error' });
    };

    /**
     * updatePlaybackIconState function
     * ================================
     * Explains: Toggles play and pause vector icon representations based on player state.
     * 
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

    // Toggle play/pause
    if (playPauseBtn) {
        playPauseBtn.onclick = () => {
            if (video.paused) {
                video.play().then(() => updatePlaybackIconState(false)).catch(err => console.error(err));
            } else {
                video.pause();
                updatePlaybackIconState(true);
            }
            showOverlay();
        };
    }

    // Back button clean handler
    if (backBtn) {
        backBtn.onclick = () => {
            exitPlayer();
        };
    }

    /**
     * exitPlayer function
     * ===================
     * Explains: Dismantles video sources, triggers cleanup functions, and navigates backwards.
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
     * showOverlay function
     * ====================
     * Explains: Sets overlay class to show, resets the auto-hide timer, and makes overlay elements visible.
     */
    const showOverlay = () => {
        if (overlay) overlay.classList.add('show');
        clearTimeout(overlayTimeout);
        overlayTimeout = setTimeout(() => {
            if (overlay && !document.querySelector('.focused')?.closest('.tv-overlay')) {
                overlay.classList.remove('show');
            }
        }, 4000);
    };

    /**
     * zapChannel function
     * ===================
     * Explains: Shifts current channel to a new index, updates DOM elements, triggers zapping HUD displays,
     * and performs channel stream switches.
     * 
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
        updateEpgInfo(nextChannel.name, nextChannel.group || '');

        // Switch stream URL
        if (loader) loader.style.display = 'flex';
        video.pause();
        loadStream(nextChannel.url);

        showOverlay();
    };

    // Keyboard handlers
    const keydownHandler = (e) => {
        showOverlay();
    };

    const zappingHandler = (e) => {
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            zapChannel(-1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            zapChannel(1);
        }
    };

    const mousemoveHandler = () => {
        showOverlay();
    };

    // Register cleanup hook
    if (window.tvPlayerCleanups) {
        window.tvPlayerCleanups();
    }

    window.addEventListener('keydown', keydownHandler);
    window.addEventListener('keydown', zappingHandler);
    window.addEventListener('mousemove', mousemoveHandler);

    window.tvPlayerCleanups = () => {
        window.removeEventListener('keydown', keydownHandler);
        window.removeEventListener('keydown', zappingHandler);
        window.removeEventListener('mousemove', mousemoveHandler);
        clearTimeout(overlayTimeout);
        clearTimeout(zappingHudTimeout);
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }
    };

    // Display initial overlay
    showOverlay();

    // Focus controls
    SpatialNav.focusFirst();
}
