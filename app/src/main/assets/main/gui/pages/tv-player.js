import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { EpgManager } from '../../logic/livetv/epg-manager.js';
import { Toast } from '../js/toast.js';
import { LiveStreamEngine } from '../../logic/livetv/core/live-stream-engine.js';
import { getNamespacedKey } from '../../logic/account-helper.js';

let overlayTimeout;
let zappingHudTimeout;
let playerEngine = null;
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
 * Initializes the custom TV player using the unified LiveStreamEngine, binds media controls,
 * handles D-pad zapping, manages custom overlay visibility behavior, and handles memory cleanup.
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
    const qualityBadgeEl = document.querySelector('.tv-quality-badge');
    const statusDotEl = document.querySelector('.tv-status-badge .status-dot');

    let currentStreamUrl = '';
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
                const startIdx = Math.max(0, Math.min(currentIndex - 20, channels.length - maxRender));
                const endIdx = startIdx + maxRender;

                for (let i = startIdx; i < endIdx; i++) {
                    const ch = channels[i];
                    const btn = document.createElement('button');
                    btn.className = 'btn btn--secondary btn--block focusable channel-list-item' + (i === currentIndex ? ' is-active active btn--primary' : '');
                    const cleanGroup = formatPrimaryCategory(ch.group || '');
                    btn.textContent = cleanGroup && cleanGroup !== 'Live TV' ? `${ch.name} (${cleanGroup})` : ch.name;
                    btn.dataset.channelIndex = i;
                    btn.onclick = () => {
                        window.liveTvState.currentIndex = i;
                        loadStream(ch, ch.headers);
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

    if (playerEngine) {
        playerEngine.destroy();
    }

    playerEngine = new LiveStreamEngine(video, {
        isPreview: false,
        onLoading: (channel) => {
            if (loader) {
                loader.classList.remove('hidden');
                loader.style.display = 'flex';
            }
            if (statusDotEl) {
                statusDotEl.classList.remove('online', 'offline');
                statusDotEl.classList.add('checking');
            }
        },
        onPlaying: (channel, qualityLabel) => {
            if (loader) {
                loader.classList.add('hidden');
                loader.style.display = 'none';
            }
            updatePlaybackIconState(false);
            if (qualityBadgeEl) {
                qualityBadgeEl.textContent = qualityLabel || 'LIVE HD';
            }
            if (statusDotEl) {
                statusDotEl.classList.remove('checking', 'offline');
                statusDotEl.classList.add('online');
            }
            if (channel?.url) {
                updateStoredChannelStatus(channel.url, 'online');
            }
        },
        onOffline: (channel) => {
            if (loader) {
                loader.classList.add('hidden');
                loader.style.display = 'none';
            }
            if (statusDotEl) {
                statusDotEl.classList.remove('checking', 'online');
                statusDotEl.classList.add('offline');
            }
            if (channel?.url) {
                updateStoredChannelStatus(channel.url, 'offline');
            }
            Toast.show('Stream is momenteel offline. Gebruik pijl omhoog/omlaag voor een ander kanaal of probeer het later opnieuw.', { type: 'warning' });
        }
    });

    /**
     * Loads the given channel or URL via the Multi-Stage Smart LiveStreamEngine.
     * Never auto-zaps away against the user's will and never deletes the channel.
     *
     * @param {Object|string} channelOrUrl - Channel object or stream URL.
     * @param {Object} [channelHeaders] - Optional custom HTTP headers.
     */
    function loadStream(channelOrUrl, channelHeaders = null) {
        const channelObj = typeof channelOrUrl === 'object' && channelOrUrl !== null
            ? channelOrUrl
            : (getCurrentChannel() || { url: channelOrUrl, name: title?.textContent || 'Live TV', headers: channelHeaders || {} });

        currentStreamUrl = channelObj.url || (typeof channelOrUrl === 'string' ? channelOrUrl : '');
        if (playerEngine) {
            playerEngine.loadChannel(channelObj, channelHeaders || channelObj.headers);
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
        const initialChannel = getCurrentChannel() || {
            url: params.url,
            name: params.title || 'Live TV',
            group: params.group || 'Live TV',
            tvgId: params.tvgId || '',
            headers: params.headers || {}
        };
        loadStream(initialChannel, initialChannel.headers || params.headers);
    }

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
            video.play().then(() => updatePlaybackIconState(false)).catch(() => {
                const ch = getCurrentChannel();
                loadStream(ch || currentStreamUrl, ch?.headers);
            });
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
            loadStream(ch || currentStreamUrl, ch?.headers);
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

        if (playerEngine) {
            playerEngine.destroy();
            playerEngine = null;
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
     * updates DOM metadata with clean primary category formatting, shows the zapping HUD,
     * and loads the stream via LiveStreamEngine.
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
        loadStream(nextChannel, nextChannel.headers);

        // Briefly show overlay banner without moving focus to a random button if overlay wasn't actively focused
        const isActivelyFocused = Boolean(overlay && overlay.querySelector('.focused'));
        showOverlay(isActivelyFocused);
    };

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
        if (playerEngine) {
            playerEngine.destroy();
            playerEngine = null;
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
 * Persists channel status dot color in localStorage (used only for the status dot indicator, never to hide channels).
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
