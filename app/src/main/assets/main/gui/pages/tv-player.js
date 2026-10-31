import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { EpgManager } from '../../logic/livetv/epg-manager.js';
import { Toast } from '../js/toast.js';
import { StreamOptimizer } from '../../logic/livetv/core/stream-optimizer.js';
import { getNamespacedKey } from '../../logic/account-helper.js';

let overlayTimeout;
let zappingHudTimeout;
let hlsInstance = null;
let epgRequestId = 0;
const LIVE_TV_STATUS_KEY = 'ivids-live-tv-status-cache';
const LIVE_TV_FAVORITES_KEY = 'ivids-live-tv-favorites';
const STATUS_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Formats a raw semicolon- or colon-delimited IPTV category string into a single clean primary category label.
 * For example, "Sports;Voetbal;Canal+" becomes "Sports".
 * @param {string} groupStr - Raw category or group string from the channel metadata.
 * @returns {string} Clean primary category name.
 */
export function formatPrimaryCategory(groupStr) {
    if (!groupStr || typeof groupStr !== 'string') return 'Live TV';
    const parts = groupStr
        .split(/[;|]/)
        .map(part => part.replace(/:/g, ' ').trim())
        .filter(Boolean);
    return parts.length > 0 ? parts[0] : 'Live TV';
}

/**
 * Initializes the custom TV player, binds media controls, handles D-pad zapping,
 * manages custom overlay visibility behavior, and handles memory cleanup.
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
    const backBtn = document.getElementById('tv-back-btn') || document.getElementById('tv-back');
    const iconPlay = document.getElementById('icon-play');
    const iconPause = document.getElementById('icon-pause');
    const zappingHud = document.getElementById('tv-zapping-hud');
    const zappingName = document.getElementById('zapping-channel-name');
    const aspectRatioBtn = document.getElementById('tv-aspect-ratio');
    const epgBtn = document.getElementById('tv-channels-btn') || document.getElementById('tv-epg-btn');
    const epgCloseBtn = document.getElementById('tv-epg-close');
    const favBtn = document.getElementById('tv-fav-btn');
    const prevBtn = document.getElementById('tv-prev-btn');
    const nextBtn = document.getElementById('tv-next-btn');
    const retryBtn = document.getElementById('tv-retry-btn');

    let currentStreamUrl = '';
    let streamErrorRetries = 0;
    let autoZapAttempts = 0;
    let autoZapTimer = null;
    let streamStartupTimer = null;
    let fallbackIndex = 0;
    const favoritesSet = new Set();

    /**
     * Loads saved Live TV favorites from localStorage into the player's favoritesSet.
     */
    function loadFavorites() {
        favoritesSet.clear();
        try {
            const userFavKey = getNamespacedKey(LIVE_TV_FAVORITES_KEY);
            const saved = localStorage.getItem(userFavKey) || localStorage.getItem(LIVE_TV_FAVORITES_KEY);
            if (saved) {
                const list = JSON.parse(saved);
                if (Array.isArray(list)) {
                    list.forEach(id => favoritesSet.add(id));
                }
            }
        } catch (e) {
            console.warn('TV Player: Error loading favorites:', e);
        }
    }

    /**
     * Saves the updated favoritesSet back to localStorage.
     */
    function saveFavorites() {
        try {
            const userFavKey = getNamespacedKey(LIVE_TV_FAVORITES_KEY);
            const data = JSON.stringify(Array.from(favoritesSet));
            localStorage.setItem(userFavKey, data);
            localStorage.setItem(LIVE_TV_FAVORITES_KEY, data);
        } catch (e) {
            console.warn('TV Player: Error saving favorites:', e);
        }
    }

    /**
     * Resolves the active Channel domain object from the global liveTvState.
     * @returns {Object|null} Active channel object or null if unavailable.
     */
    function getCurrentChannel() {
        if (window.liveTvState?.channels && typeof window.liveTvState.currentIndex === 'number') {
            return window.liveTvState.channels[window.liveTvState.currentIndex] || null;
        }
        return null;
    }

    /**
     * Checks whether the given channel is marked as a favorite.
     * @param {Object|null} channel - Channel object to check.
     * @returns {boolean} True if favorited.
     */
    function isChannelFavorite(channel) {
        if (!channel) return false;
        const id = channel.id || channel.url;
        return favoritesSet.has(id) ||
            Boolean(channel.id && favoritesSet.has(channel.id)) ||
            Boolean(channel.url && favoritesSet.has(channel.url));
    }

    /**
     * Updates the #tv-fav-btn and #tv-fav-icon UI using standalone SVG files (images/star-filled.svg vs images/star.svg).
     * Never uses inline SVG markup.
     * @param {Object|null} [channel] - Channel to reflect; defaults to getCurrentChannel().
     */
    function updateFavUI(channel = getCurrentChannel()) {
        const btn = document.getElementById('tv-fav-btn');
        const icon = document.getElementById('tv-fav-icon') || (btn ? btn.querySelector('img') : null);
        const isFav = isChannelFavorite(channel);
        if (btn) {
            btn.classList.toggle('active', isFav);
        }
        if (icon) {
            icon.src = isFav ? 'images/star-filled.svg' : 'images/star.svg';
        }
    }

    /**
     * Toggles the favorite state for the current channel and updates #tv-fav-btn.
     */
    function toggleFavorite() {
        const channel = getCurrentChannel() || { url: currentStreamUrl, name: title?.textContent || '' };
        const id = channel.id || channel.url;
        if (!id) return;

        if (isChannelFavorite(channel)) {
            if (channel.id) favoritesSet.delete(channel.id);
            if (channel.url) favoritesSet.delete(channel.url);
        } else {
            favoritesSet.add(id);
        }
        saveFavorites();
        updateFavUI(channel);
        resetOverlayTimer();
    }

    loadFavorites();

    /**
     * Attempts loading an alternative stream from channel fallback URLs when available,
     * otherwise schedules zapping to the next channel in the playlist.
     * @param {string} failedUrl - The URL that encountered a failure.
     * @returns {boolean} True if a fallback URL was found and loaded.
     */
    function tryFallbackOrZap(failedUrl) {
        updateStoredChannelStatus(failedUrl, 'offline');
        const channel = getCurrentChannel();
        if (channel && Array.isArray(channel.fallbackUrls) && fallbackIndex < channel.fallbackUrls.length) {
            const nextFallbackUrl = channel.fallbackUrls[fallbackIndex++];
            console.warn(`Stream failed, attempting fallback (${fallbackIndex}/${channel.fallbackUrls.length}):`, nextFallbackUrl);
            Toast.show(`Stream error. Trying fallback stream (${fallbackIndex}/${channel.fallbackUrls.length})...`, { type: 'warning' });
            loadStream(nextFallbackUrl, channel.headers, true);
            return true;
        }
        scheduleNextPlayableChannel();
        return false;
    }

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
        resetOverlayTimer();
    }

    /**
     * Opens or closes the quick electronic program guide / side channel list panel.
     * Renders clean channel items with primary category badges.
     * @param {boolean} [show] - Explicit open or close flag.
     */
    function toggleQuickEpg(show) {
        const quickEpg = document.getElementById('tv-side-panel') || document.getElementById('tv-quick-epg');
        const quickEpgList = document.getElementById('tv-channel-list') || document.getElementById('tv-quick-epg-list');
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
                    btn.className = 'btn btn--secondary btn--block focusable channel-list-item' + (i === currentIndex ? ' is-active active btn--primary' : '');
                    const cleanGroup = formatPrimaryCategory(ch.group || '');
                    btn.textContent = cleanGroup && cleanGroup !== 'Live TV' ? `${ch.name} (${cleanGroup})` : ch.name;
                    btn.dataset.channelIndex = i;
                    btn.onclick = () => {
                        window.liveTvState.currentIndex = i;
                        fallbackIndex = 0;
                        loadStream(ch.url, ch.headers);
                        if (title) title.textContent = ch.name;
                        if (group) group.textContent = formatPrimaryCategory(ch.group || '');
                        updateFavUI(ch);
                        updateEpgInfo(ch.name, ch.group || '', ch.tvgId || '');
                        toggleQuickEpg(false);
                        showOverlay(true);
                    };
                    quickEpgList.appendChild(btn);
                }
            }
            quickEpg.classList.add('is-open', 'active');
            quickEpg.classList.remove('hidden');
            quickEpg.style.display = 'flex';

            const activeItem = quickEpg.querySelector('.channel-list-item.is-active') || quickEpg.querySelector('.channel-list-item.focusable');
            if (activeItem) SpatialNav.setFocus(activeItem);
        } else {
            quickEpg.classList.remove('is-open', 'active', 'open');
            quickEpg.classList.add('hidden');
            quickEpg.style.display = 'none';

            const returnBtn = document.getElementById('tv-channels-btn') || document.getElementById('tv-epg-btn') || playPauseBtn;
            if (returnBtn) SpatialNav.setFocus(returnBtn);
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
     * @param {Object} [channelHeaders] - Optional headers for stream authentication.
     * @param {boolean} [isFallback=false] - Whether this load is an alternative fallback attempt.
     */
    function loadStream(url, channelHeaders = null, isFallback = false) {
        currentStreamUrl = url;
        streamErrorRetries = 0;
        if (!isFallback) {
            fallbackIndex = 0;
        }
        if (autoZapTimer) {
            clearTimeout(autoZapTimer);
            autoZapTimer = null;
        }
        clearTimeout(streamStartupTimer);

        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }

        const headers = channelHeaders || getCurrentChannel()?.headers || {};
        const streamUrl = StreamOptimizer.getProxiedStreamUrl(url, headers);
        streamStartupTimer = setTimeout(() => {
            const isReady = video && video.readyState >= 2 && !video.paused;
            if (!isReady && currentStreamUrl === url) {
                console.warn('Stream startup timed out, attempting fallback or next channel:', url);
                tryFallbackOrZap(url);
            }
        }, 12000);

        if (window.Hls && window.Hls.isSupported()) {
            console.log('TV Player: Playing stream using HLS.js library');
            hlsInstance = new window.Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 30,
                maxBufferLength: 10,
                maxMaxBufferLength: 20,
                liveSyncDurationCount: 2,
                initialLiveManifestSize: 2
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
                    tryFallbackOrZap(url);
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
                                console.error('Fatal network error, attempting fallback or next channel...', data);
                                tryFallbackOrZap(url);
                            }
                            break;
                        case window.Hls.ErrorTypes.MEDIA_ERROR:
                            if (streamErrorRetries < 1) {
                                streamErrorRetries++;
                                console.error('Fatal media error, trying to recover...', data);
                                hlsInstance.recoverMediaError();
                            } else {
                                console.error('Fatal media error, attempting fallback or next channel...', data);
                                tryFallbackOrZap(url);
                            }
                            break;
                        default:
                            console.error('Fatal unrecoverable HLS.js error:', data);
                            tryFallbackOrZap(url);
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
                tryFallbackOrZap(url);
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

    // Set initial text content with clean primary category formatting
    if (params.title && title) title.textContent = params.title;
    if (group) group.textContent = formatPrimaryCategory(params.group || getCurrentChannel()?.group || '');
    updateFavUI(getCurrentChannel());

    // Set initial EPG details
    updateEpgInfo(params.title || 'Channel Name', params.group || '', params.tvgId || '');

    // Load initial source
    if (params.url) {
        const initialChannel = getCurrentChannel();
        loadStream(params.url, initialChannel?.headers || params.headers);
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
        fallbackIndex = 0;
        updateStoredChannelStatus(currentStreamUrl, 'online');
    };
    video.onerror = () => {
        console.error('Video error:', video.error);
        if (loader) loader.style.display = 'none';
        tryFallbackOrZap(currentStreamUrl);
    };

    /**
     * Toggles play and pause icon elements based on player state.
     * @param {boolean} isPaused - True if playback is paused.
     */
    function updatePlaybackIconState(isPaused) {
        if (isPaused) {
            if (iconPlay) {
                iconPlay.classList.remove('hidden');
                iconPlay.style.display = 'block';
            }
            if (iconPause) {
                iconPause.classList.add('hidden');
                iconPause.style.display = 'none';
            }
        } else {
            if (iconPlay) {
                iconPlay.classList.add('hidden');
                iconPlay.style.display = 'none';
            }
            if (iconPause) {
                iconPause.classList.remove('hidden');
                iconPause.style.display = 'block';
            }
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
        showOverlay(true);
    }

    // Bind control button click handlers
    if (playPauseBtn) {
        playPauseBtn.onclick = () => togglePlayPause();
    }
    if (aspectRatioBtn) {
        aspectRatioBtn.onclick = () => toggleAspectRatio();
    }
    if (epgBtn) {
        epgBtn.onclick = () => toggleQuickEpg(true);
    }
    if (epgCloseBtn) {
        epgCloseBtn.onclick = () => toggleQuickEpg(false);
    }
    if (favBtn) {
        favBtn.onclick = () => toggleFavorite();
    }
    if (prevBtn) {
        prevBtn.onclick = () => switchChannel(-1);
    }
    if (nextBtn) {
        nextBtn.onclick = () => switchChannel(1);
    }
    if (retryBtn) {
        retryBtn.onclick = () => {
            const ch = getCurrentChannel();
            loadStream(ch?.url || currentStreamUrl, ch?.headers);
        };
    }

    let tvPlayerBackHandler = () => {
        if (SpatialNav.currentPageLogic && typeof SpatialNav.currentPageLogic.handleBack === 'function') {
            if (SpatialNav.currentPageLogic.handleBack()) return true;
        }
        exitPlayer();
        return true;
    };
    SpatialNav.pushBackHandler(tvPlayerBackHandler);

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

        const appEl = document.getElementById('app');
        if (appEl) appEl.classList.remove('fullscreen-layout');

        video.pause();
        video.src = '';
        if (hlsInstance) {
            hlsInstance.destroy();
            hlsInstance = null;
        }
        Router.goBack();
    }

    /**
     * Resets the 4-second auto-hide timer for the TV controls overlay.
     */
    function resetOverlayTimer() {
        clearTimeout(overlayTimeout);
        overlayTimeout = setTimeout(() => {
            hideOverlay();
        }, 4000);
    }

    /**
     * Shows the TV controls overlay and optionally moves spatial focus to the default control.
     * When called with shouldFocus=false (e.g., during fullscreen channel zapping), displays the
     * info banner briefly without moving focus to a random button.
     * @param {boolean} [shouldFocus=true] - Whether to focus an interactive button on the overlay.
     */
    const showOverlay = (shouldFocus = true) => {
        const wasHidden = overlay && !overlay.classList.contains('show');
        if (overlay) overlay.classList.add('show');

        if (shouldFocus) {
            const hasFocusedInside = overlay && overlay.querySelector('.focused');
            if (wasHidden || !hasFocusedInside) {
                SpatialNav.focusFirst();
            }
        } else if (wasHidden && overlay) {
            overlay.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
        }

        resetOverlayTimer();
    };

    /**
     * Hides the TV controls overlay immediately and clears button focus inside it.
     */
    const hideOverlay = () => {
        clearTimeout(overlayTimeout);
        if (overlay) {
            overlay.classList.remove('show');
            overlay.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
            if (document.activeElement && overlay.contains(document.activeElement)) {
                document.activeElement.blur();
            }
        }
    };

    /**
     * Switches current channel by the given direction delta (-1 for previous, +1 for next),
     * updates DOM metadata with clean primary category formatting, shows the zapping HUD
     * and passive overlay banner without stealing focus to a random button, and loads the stream.
     * @param {number} direction - Direction modifier (-1 for UP/Prev, +1 for DOWN/Next).
     */
    const switchChannel = (direction) => {
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

        // Update Zapping HUD
        if (zappingHud && zappingName) {
            zappingName.textContent = nextChannel.name;
            zappingHud.classList.remove('hidden');
            zappingHud.style.display = 'flex';
            zappingHud.classList.add('fade-in');

            clearTimeout(zappingHudTimeout);
            zappingHudTimeout = setTimeout(() => {
                zappingHud.classList.add('hidden');
                zappingHud.style.display = 'none';
            }, 3000);
        }

        // Update control panel metadata with clean primary category
        if (title) title.textContent = nextChannel.name;
        if (group) group.textContent = formatPrimaryCategory(nextChannel.group || '');
        updateFavUI(nextChannel);

        // Update zapped EPG details
        updateEpgInfo(nextChannel.name, nextChannel.group || '', nextChannel.tvgId || '');

        // Switch stream URL
        if (loader) loader.style.display = 'flex';
        video.pause();
        fallbackIndex = 0;
        loadStream(nextChannel.url, nextChannel.headers);

        // Briefly show overlay banner without moving focus to a random button if overlay wasn't actively focused
        const isActivelyFocused = Boolean(overlay && overlay.querySelector('.focused'));
        showOverlay(isActivelyFocused);
    };

    const zapChannel = switchChannel;

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
        autoZapTimer = setTimeout(() => switchChannel(1), 900);
    }

    /**
     * Mouse movement handler that reveals the control overlay for pointer users.
     */
    const mousemoveHandler = () => {
        showOverlay(true);
    };

    // Register cleanup hook
    if (window.tvPlayerCleanups) {
        window.tvPlayerCleanups();
    }

    window.addEventListener('mousemove', mousemoveHandler);

    // Expose helpers for spatialNavTvPlayer
    window.tvZapChannel = (dir) => switchChannel(dir);
    window.tvSwitchChannel = (dir) => switchChannel(dir);
    window.tvToggleQuickEpg = (show) => toggleQuickEpg(show);
    window.tvToggleAspectRatio = () => toggleAspectRatio();
    window.tvPlayPause = () => togglePlayPause();
    window.tvShowOverlay = (shouldFocus = true) => showOverlay(shouldFocus);
    window.tvHideOverlay = () => hideOverlay();
    window.tvResetOverlayTimer = () => resetOverlayTimer();
    window.tvUpdateFavUI = () => updateFavUI();
    window.tvIsOverlayVisible = () => overlay && overlay.classList.contains('show');
    window.tvIsQuickEpgOpen = () => {
        const q = document.getElementById('tv-side-panel') || document.getElementById('tv-quick-epg');
        return Boolean(q && q.classList.contains('is-open'));
    };

    window.tvPlayerCleanups = () => {
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
        delete window.tvSwitchChannel;
        delete window.tvToggleQuickEpg;
        delete window.tvToggleAspectRatio;
        delete window.tvPlayPause;
        delete window.tvShowOverlay;
        delete window.tvHideOverlay;
        delete window.tvResetOverlayTimer;
        delete window.tvUpdateFavUI;
        delete window.tvIsOverlayVisible;
        delete window.tvIsQuickEpgOpen;
    };

    // Display initial overlay and focus controls
    showOverlay(true);
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
