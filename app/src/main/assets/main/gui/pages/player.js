import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { addToRecentlyWatched } from '../../logic/recentlyWatched.js';
import { ErrorHandler } from '../js/error-handler.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { VodStreamResolver } from '../../logic/vod/vod-stream-resolver.js';
import { proxyUrl } from '../js/utils/proxy.js';
import { escapeHtml } from '../js/utils/sanitize.js';

let hudTimeout = null;
let mouseMoveHandler = null;
let popstateHandler = null;
let playerBackHandler = null;

let activeHls = null;
let activePlaybackMode = 'native'; // 'native' | 'embed' | 'live' | 'trailer'
let playbackGeneration = 0;
let activeSubtitleBlobUrls = [];
let cachedStremioSubtitles = [];
let activeExternalSubId = 'off';
let activeAudioTrackId = null;
let activeHlsQualityLevel = -1;

/**
 * Formats seconds as MM:SS or HH:MM:SS for the bottom timeline display.
 *
 * @param {number} seconds - Timestamp in seconds.
 * @returns {string} Formatted duration label.
 */
function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const totalSecs = Math.floor(seconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

/**
 * Translates an i18n key with a readable fallback string.
 *
 * @param {string} key - Dot-delimited i18n key.
 * @param {string} fallback - Fallback display label.
 * @returns {string} Localized or fallback text.
 */
function t(key, fallback) {
    const val = window.i18n?.t(key);
    return (val && val !== key) ? val : fallback;
}

/**
 * Syncs the Play / Pause button SVG icon visibility with playback state.
 *
 * @param {boolean} isPaused - True when media is paused.
 */
function syncPlayPauseIcons(isPaused) {
    const iconPause = document.getElementById('player-icon-pause');
    const iconPlay = document.getElementById('player-icon-play');
    if (!iconPause || !iconPlay) return;
    if (isPaused) {
        iconPause.classList.add('hidden');
        iconPlay.classList.remove('hidden');
    } else {
        iconPause.classList.remove('hidden');
        iconPlay.classList.add('hidden');
    }
}

/**
 * Tears down any active Hls.js decoder, native video source, and external subtitle blob URLs.
 */
function teardownNativeMedia() {
    playbackGeneration += 1;

    if (activeHls) {
        try {
            activeHls.destroy();
        } catch (err) {
            console.warn('[IVIDS Player] Hls destroy notice:', err);
        }
        activeHls = null;
    }

    const videoEl = document.getElementById('native-video-player');
    if (videoEl) {
        videoEl.onloadedmetadata = null;
        videoEl.oncanplay = null;
        videoEl.onerror = null;
        videoEl.pause();
        videoEl.querySelectorAll('track').forEach(track => track.remove());
        videoEl.removeAttribute('src');
        videoEl.load();
        videoEl.classList.add('hidden');
        videoEl.style.display = 'none';
    }

    if (activeSubtitleBlobUrls.length > 0) {
        activeSubtitleBlobUrls.forEach(url => {
            try {
                URL.revokeObjectURL(url);
            } catch {
                // Ignore blob cleanup errors
            }
        });
        activeSubtitleBlobUrls = [];
    }

    const fill = document.getElementById('player-progress-fill');
    const curTime = document.getElementById('player-current-time');
    const durTime = document.getElementById('player-duration');
    if (fill) fill.style.width = '0%';
    if (curTime) curTime.textContent = '00:00';
    if (durTime) durTime.textContent = '00:00';
}

/**
 * Attaches progress tracking, play/pause state synchronization, and console logs to `#native-video-player`.
 *
 * @param {HTMLVideoElement} videoEl - The native HTML5 video element.
 */
function bindNativeVideoListeners(videoEl) {
    if (!videoEl || videoEl.dataset.ividsBound === 'true') return;
    videoEl.dataset.ividsBound = 'true';

    videoEl.addEventListener('play', () => {
        console.log('[IVIDS Player] Native Video: Playing');
        syncPlayPauseIcons(false);
        if (typeof window.playerResetHudTimer === 'function') {
            window.playerResetHudTimer();
        }
    });

    videoEl.addEventListener('pause', () => {
        console.log('[IVIDS Player] Native Video: Paused');
        syncPlayPauseIcons(true);
        if (typeof window.playerShowHud === 'function') {
            window.playerShowHud(false);
        }
    });

    videoEl.addEventListener('ended', () => {
        syncPlayPauseIcons(true);
        if (typeof window.playerShowHud === 'function') {
            window.playerShowHud(true);
        }
    });

    const syncProgress = () => {
        const fill = document.getElementById('player-progress-fill');
        const curTime = document.getElementById('player-current-time');
        const durTime = document.getElementById('player-duration');
        if (videoEl.duration && Number.isFinite(videoEl.duration) && fill) {
            const pct = Math.max(0, Math.min(100, (videoEl.currentTime / videoEl.duration) * 100));
            fill.style.width = `${pct}%`;
        }
        if (curTime) curTime.textContent = formatTime(videoEl.currentTime);
        if (durTime) durTime.textContent = formatTime(videoEl.duration);
    };

    videoEl.addEventListener('loadedmetadata', syncProgress);
    videoEl.addEventListener('timeupdate', syncProgress);
    videoEl.addEventListener('seeked', syncProgress);
}

/**
 * Cleanly exits the player, tears down media decoders, restores layout chrome, and returns.
 *
 * @param {Object} params - Active player route parameters.
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
 * Releases all event listeners, decoders, subtitle blobs, and global player window hooks.
 */
window.playerCleanups = function() {
    if (hudTimeout) {
        clearTimeout(hudTimeout);
        hudTimeout = null;
    }
    if (mouseMoveHandler) {
        window.removeEventListener('mousemove', mouseMoveHandler);
        mouseMoveHandler = null;
    }
    if (popstateHandler) {
        window.removeEventListener('popstate', popstateHandler);
        popstateHandler = null;
    }
    if (playerBackHandler) {
        SpatialNav.popBackHandler(playerBackHandler);
        playerBackHandler = null;
    }

    try {
        teardownNativeMedia();
    } catch (e) {
        console.error('Error cleaning up native video:', e);
    }

    cachedStremioSubtitles = [];
    activeExternalSubId = 'off';
    activeAudioTrackId = null;
    activeHlsQualityLevel = -1;

    delete window.playerShowHud;
    delete window.playerHideHud;
    delete window.playerResetHudTimer;
    delete window.playerTogglePlayPause;
    delete window.playerSeek;
    delete window.playerSettingsBack;
};

/**
 * Toggles Play/Pause directly on `#native-video-player`.
 */
function togglePlayPause() {
    const videoEl = document.getElementById('native-video-player');
    if (!videoEl || activePlaybackMode === 'embed') return;

    if (videoEl.paused) {
        videoEl.play().catch(e => console.warn('[IVIDS Player] Play error:', e));
        syncPlayPauseIcons(false);
    } else {
        videoEl.pause();
        syncPlayPauseIcons(true);
    }
}

/**
 * Seeks native playback forward or backward by `deltaSeconds` (-30, -10, +10, +30).
 *
 * @param {number} deltaSeconds - Signed seek delta in seconds.
 */
function seekBy(deltaSeconds) {
    const videoEl = document.getElementById('native-video-player');
    if (!videoEl || activePlaybackMode === 'embed') return;
    if (!(videoEl.currentSrc || videoEl.src || activeHls)) return;

    const target = Math.max(0, Math.min(videoEl.duration || Infinity, (videoEl.currentTime || 0) + deltaSeconds));
    videoEl.currentTime = target;
    if (typeof window.playerShowHud === 'function') {
        window.playerShowHud(false);
    }
}

/**
 * Fetches community subtitles from Stremio OpenSubtitles v3 in the background.
 *
 * @param {Object} mediaMeta - Media metadata with `imdbId`, `type`, `season`, `episode`.
 */
async function loadStremioSubtitles(mediaMeta) {
    if (!mediaMeta?.imdbId) return;
    const stremioType = mediaMeta.type === 'tv' ? 'series' : 'movie';
    const idTuple = stremioType === 'series'
        ? `${mediaMeta.imdbId}:${mediaMeta.season || 1}:${mediaMeta.episode || 1}`
        : mediaMeta.imdbId;
    const url = `https://opensubtitles-v3.strem.io/subtitles/${encodeURIComponent(stremioType)}/${encodeURIComponent(idTuple)}.json`;

    try {
        const res = await fetch(proxyUrl(url));
        if (!res.ok) return;
        const data = await res.json();
        const raw = Array.isArray(data?.subtitles) ? data.subtitles : [];
        const preferredOrder = ['nld', 'dut', 'nl', 'eng', 'en', 'fra', 'deu', 'spa', 'por', 'ita', 'tur', 'ara'];
        const normalized = raw
            .filter(s => s && s.url)
            .sort((a, b) => {
                const aLang = String(a.lang || '').toLowerCase();
                const bLang = String(b.lang || '').toLowerCase();
                const ai = preferredOrder.indexOf(aLang);
                const bi = preferredOrder.indexOf(bLang);
                if (ai !== -1 && bi !== -1) return ai - bi;
                if (ai !== -1) return -1;
                if (bi !== -1) return 1;
                return aLang.localeCompare(bLang);
            });

        const langCounts = {};
        cachedStremioSubtitles = normalized.filter(item => {
            const code = String(item.lang || 'und').toLowerCase();
            langCounts[code] = (langCounts[code] || 0) + 1;
            return langCounts[code] <= 3;
        }).slice(0, 24);
    } catch (err) {
        console.warn('[IVIDS Player] Background subtitle lookup failed:', err);
    }
}

/**
 * Converts SRT text to WebVTT markup for Chromium HTML5 `<track>` rendering.
 *
 * @param {string} rawText - Raw SRT/VTT text.
 * @returns {string} WebVTT formatted text.
 */
function convertSrtToVtt(rawText) {
    const clean = String(rawText || '').replace(/^\uFEFF/, '').replace(/\r+/g, '');
    if (clean.startsWith('WEBVTT')) return clean;
    const converted = clean.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    return `WEBVTT\n\n${converted}`;
}

/**
 * Downloads an external Stremio `.srt` subtitle, converts it to WebVTT, and activates it.
 *
 * @param {Object} sub - Subtitle entry (`id`, `lang`, `url`).
 */
async function activateStremioSubtitle(sub) {
    const videoEl = document.getElementById('native-video-player');
    if (!videoEl || !sub?.url) return;

    try {
        const res = await fetch(proxyUrl(sub.url));
        if (!res.ok) return;
        const vtt = convertSrtToVtt(await res.text());
        const blobUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
        activeSubtitleBlobUrls.push(blobUrl);

        videoEl.querySelectorAll('track[data-stremio-sub="true"]').forEach(el => el.remove());
        Array.from(videoEl.textTracks || []).forEach(track => { track.mode = 'disabled'; });

        const trackEl = document.createElement('track');
        trackEl.kind = 'subtitles';
        trackEl.label = sub.lang ? sub.lang.toUpperCase() : 'Subtitle';
        trackEl.srclang = (sub.lang || 'en').slice(0, 2).toLowerCase();
        trackEl.src = blobUrl;
        trackEl.default = true;
        trackEl.dataset.stremioSub = 'true';
        videoEl.appendChild(trackEl);

        requestAnimationFrame(() => {
            Array.from(videoEl.textTracks || []).forEach(tObj => {
                tObj.mode = (tObj.label === trackEl.label) ? 'showing' : 'disabled';
            });
        });

        activeExternalSubId = `stremio:${sub.id || sub.url}`;
    } catch (err) {
        console.warn('[IVIDS Player] Failed to load external subtitle:', err);
    }
}

/**
 * Disables all HLS, native `<track>`, and Stremio subtitles.
 */
function disableAllSubtitles() {
    const videoEl = document.getElementById('native-video-player');
    if (activeHls) activeHls.subtitleTrack = -1;
    if (videoEl) {
        Array.from(videoEl.textTracks || []).forEach(track => { track.mode = 'disabled'; });
    }
    activeExternalSubId = 'off';
}

/**
 * Switches the overlay bottom visibility cleanly between Native VOD controls and Embed mode.
 *
 * @param {string} mode - 'native' | 'embed' | 'live' | 'trailer'.
 */
function setOverlayPlaybackMode(mode) {
    activePlaybackMode = mode;
    const overlay = document.getElementById('player-hud');
    const bottomControls = document.getElementById('vod-overlay-bottom');
    if (overlay) {
        overlay.classList.toggle('vod-embed-mode', mode === 'embed' || mode === 'trailer');
    }
    if (bottomControls) {
        bottomControls.classList.toggle('hidden', mode === 'embed' || mode === 'trailer');
    }
}

/**
 * Starts native HTML5 / Hls.js playback for a direct Debrid stream URL.
 *
 * @param {string} streamUrl - Playable `.mp4`/`.m3u8`/`.mkv` URL.
 * @param {Function} [onPlaybackFailed] - Failure fallback callback.
 */
function startNativePlayback(streamUrl, onPlaybackFailed = null) {
    const gen = playbackGeneration + 1;
    teardownNativeMedia();
    playbackGeneration = gen;
    setOverlayPlaybackMode('native');

    const loadingOverlay = document.getElementById('player-loading-overlay');
    const statusPanel = document.getElementById('player-status-panel');
    if (statusPanel) {
        statusPanel.classList.add('hidden');
        statusPanel.style.display = 'none';
    }
    if (loadingOverlay) loadingOverlay.style.display = 'flex';

    const iframe = document.getElementById('player-iframe');
    if (iframe) {
        iframe.style.display = 'none';
        iframe.src = 'about:blank';
    }

    const videoEl = document.getElementById('native-video-player');
    if (!videoEl) {
        if (onPlaybackFailed) onPlaybackFailed();
        return;
    }

    bindNativeVideoListeners(videoEl);
    videoEl.classList.remove('hidden');
    videoEl.style.display = 'block';
    syncPlayPauseIcons(true);

    console.log(`[IVIDS Player] Starting native stream: ${streamUrl}`);
    let failedTriggered = false;
    let loadTimer = setTimeout(() => {
        if (!failedTriggered && playbackGeneration === gen && (!videoEl.readyState || videoEl.readyState < 1)) {
            handleFatalFailure('Native stream metadata timeout (12s)');
        }
    }, 12000);

    const clearLoadTimer = () => {
        if (loadTimer) {
            clearTimeout(loadTimer);
            loadTimer = null;
        }
    };

    const handleFatalFailure = (reason) => {
        clearLoadTimer();
        if (failedTriggered || playbackGeneration !== gen) return;
        failedTriggered = true;
        console.warn('[IVIDS Player] Native stream failed:', reason);
        if (onPlaybackFailed) {
            onPlaybackFailed();
        } else {
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            if (statusPanel) {
                statusPanel.classList.remove('hidden');
                statusPanel.style.display = 'flex';
            }
        }
    };

    const isHls = /\.m3u8(\?|$)/i.test(streamUrl);
    if (isHls && typeof window.Hls !== 'undefined' && window.Hls.isSupported()) {
        activeHls = new window.Hls({ enableWorker: true });
        activeHls.loadSource(streamUrl);
        activeHls.attachMedia(videoEl);
        activeHls.on(window.Hls.Events.MANIFEST_PARSED, () => {
            clearLoadTimer();
            if (playbackGeneration !== gen) return;
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            videoEl.play().catch(err => console.warn('[IVIDS Player] Autoplay prevented:', err));
        });
        activeHls.on(window.Hls.Events.ERROR, (_event, data) => {
            if (playbackGeneration !== gen) return;
            if (data && data.fatal) {
                handleFatalFailure(data.details || data.type || 'HLS fatal error');
            }
        });
    } else {
        const onReady = () => {
            clearLoadTimer();
            if (playbackGeneration !== gen) return;
            if (videoEl.readyState >= 1 && videoEl.videoWidth === 0) {
                handleFatalFailure('Video codec unsupported (videoWidth=0)');
                return;
            }
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            videoEl.play().catch(err => console.warn('[IVIDS Player] Autoplay prevented:', err));
        };
        videoEl.onloadedmetadata = onReady;
        videoEl.oncanplay = onReady;
        videoEl.onerror = () => handleFatalFailure(videoEl.error ? `MEDIA_ERR_${videoEl.error.code}` : 'Video error');
        videoEl.src = streamUrl;
    }

    if (typeof window.playerShowHud === 'function') {
        window.playerShowHud(false);
    }
}

/**
 * Loads one of the 7 embed servers (or a YouTube trailer) inside `#player-iframe`.
 *
 * @param {string} url - Embed player URL.
 * @returns {HTMLIFrameElement|null} The active iframe element.
 */
function startEmbedPlayback(url) {
    teardownNativeMedia();
    setOverlayPlaybackMode('embed');

    const loadingOverlay = document.getElementById('player-loading-overlay');
    const statusPanel = document.getElementById('player-status-panel');
    if (statusPanel) {
        statusPanel.classList.add('hidden');
        statusPanel.style.display = 'none';
    }
    if (loadingOverlay) loadingOverlay.style.display = 'flex';

    const container = document.getElementById('video-container');
    let iframe = document.getElementById('player-iframe');
    if (!iframe && container) {
        iframe = document.createElement('iframe');
        iframe.id = 'player-iframe';
        iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
        iframe.className = 'focusable';
        iframe.tabIndex = 0;
        iframe.style.position = 'absolute';
        iframe.style.top = '0';
        iframe.style.left = '0';
        iframe.style.width = '100vw';
        iframe.style.height = '100vh';
        iframe.style.border = 'none';
        iframe.style.background = '#000';
        iframe.style.zIndex = '1';
        container.appendChild(iframe);
    }

    if (iframe) {
        iframe.style.display = 'block';
        iframe.onload = () => {
            console.log(`[IVIDS Player] Embed loaded (src: ${iframe.src})`);
            if (loadingOverlay) loadingOverlay.style.display = 'none';
        };
        iframe.src = url;
    }

    return iframe;
}

/**
 * Initializes the Live TV-matched VOD player with top-left Back, top-right Settings sidebar
 * (Quality, Subtitles, Audio, Server Settings), and minimal bottom transport controls.
 *
 * @param {Object} params - Route parameters containing `id`, `type`, `season`, `episode`, `title`.
 */
export async function init(params) {
    try {
        console.log('[IVIDS Player] Initializing Player with params:', params);
        if (!params || (!params.id && params.type !== 'live')) {
            Router.loadPage('home');
            return;
        }

        try {
            window.playerCleanups();
        } catch (e) {
            console.error('Error in initial cleanup:', e);
        }

        const app = document.getElementById('app');
        if (app) app.classList.add('fullscreen-layout');
        const header = document.getElementById('header');
        if (header) header.style.display = 'none';

        popstateHandler = () => {
            try {
                window.playerCleanups();
                if (app) app.classList.remove('fullscreen-layout');
                if (header) header.style.display = '';
            } catch (e) {
                console.error('Error on popstate cleanup:', e);
            }
        };
        window.addEventListener('popstate', popstateHandler);

        playerBackHandler = () => {
            if (SpatialNav.currentPageLogic && typeof SpatialNav.currentPageLogic.handleBack === 'function') {
                if (SpatialNav.currentPageLogic.handleBack()) return true;
            }
            exitPlayer(params);
            return true;
        };
        SpatialNav.pushBackHandler(playerBackHandler);

        const overlay = document.getElementById('player-hud');
        const backBtn = document.getElementById('player-back');
        const settingsBtn = document.getElementById('player-settings');
        const settingsPanel = document.getElementById('player-settings-panel');
        const settingsBackBtn = document.getElementById('player-settings-back');
        const settingsTitleEl = document.getElementById('player-settings-title');
        const settingsOptionsEl = document.getElementById('player-settings-options');
        const videoEl = document.getElementById('native-video-player');

        let activeSubmenu = null;
        let lastCategoryKey = null;
        let nextEpisodeTarget = null;
        let vodState = null;

        /** Checks whether the right-edge Settings drawer is open. */
        const isSettingsOpen = () => Boolean(settingsPanel && !settingsPanel.classList.contains('hidden'));

        /** Resets the 4s overlay auto-hide timer (stays open when paused or drawer open). */
        const resetOverlayTimer = () => {
            if (hudTimeout) clearTimeout(hudTimeout);
            if (isSettingsOpen()) return;
            hudTimeout = setTimeout(() => {
                const isPausedNative = activePlaybackMode === 'native' && videoEl && videoEl.paused;
                if (isSettingsOpen() || isPausedNative || activePlaybackMode === 'embed') {
                    return;
                }
                hideOverlay();
            }, 4000);
        };

        /** Reveals the HUD overlay and focuses Play/Pause or Settings when requested. */
        const showOverlay = (shouldFocus = false) => {
            if (overlay) overlay.classList.add('show');
            if (shouldFocus) {
                const playPause = document.getElementById('play-pause-btn');
                const focusTarget = (playPause && !document.getElementById('vod-overlay-bottom')?.classList.contains('hidden'))
                    ? playPause
                    : settingsBtn;
                if (focusTarget) SpatialNav.setFocus(focusTarget);
            }
            resetOverlayTimer();
        };

        /** Hides the HUD overlay and returns keyboard focus safely off buttons. */
        const hideOverlay = () => {
            if (isSettingsOpen() || activePlaybackMode === 'embed') return;
            if (overlay) overlay.classList.remove('show');
            if (document.activeElement && overlay?.contains(document.activeElement)) {
                document.activeElement.blur();
            }
        };

        /** Closes the Settings sidebar cleanly. */
        const closeSettingsPanel = (restoreFocus = false) => {
            if (!settingsPanel) return;
            activeSubmenu = null;
            settingsPanel.classList.add('hidden');
            if (restoreFocus && settingsBtn) SpatialNav.setFocus(settingsBtn);
            resetOverlayTimer();
        };

        /** Steps up one level inside Settings or closes the drawer if already at root. */
        const navigateSettingsBack = () => {
            if (!isSettingsOpen()) return false;
            if (activeSubmenu) {
                const prevCat = activeSubmenu;
                activeSubmenu = null;
                renderSettingsPanel();
                const catBtn = settingsOptionsEl?.querySelector(`.tv-opt-btn[data-submenu="${prevCat}"]`)
                    || settingsOptionsEl?.querySelector('.tv-opt-btn.focusable');
                if (catBtn) SpatialNav.setFocus(catBtn);
                resetOverlayTimer();
                return true;
            }
            closeSettingsPanel(true);
            return true;
        };

        /** Collects dynamic categories for Quality, Subtitles, Audio, Server Settings, and Next Episode. */
        const getSidebarCategories = () => {
            const categories = [];

            // 1. Quality / Candidate Stream selector
            const qualityOpts = [];
            if (activeHls && Array.isArray(activeHls.levels) && activeHls.levels.length > 0) {
                qualityOpts.push({
                    value: 'hls-auto',
                    label: t('livetv.auto', 'Auto'),
                    isActive: activeHlsQualityLevel === -1,
                    onPick: () => {
                        activeHlsQualityLevel = -1;
                        if (activeHls) activeHls.currentLevel = -1;
                    }
                });
                activeHls.levels.forEach((lvl, idx) => {
                    const label = lvl.height ? `${lvl.height}p` : `Level ${idx + 1}`;
                    qualityOpts.push({
                        value: `hls-${idx}`,
                        label,
                        isActive: activeHlsQualityLevel === idx,
                        onPick: () => {
                            activeHlsQualityLevel = idx;
                            if (activeHls) activeHls.currentLevel = idx;
                        }
                    });
                });
            } else if (vodState && vodState.activeTierId !== 'embed_servers') {
                const tierRes = vodState.tierResults[vodState.activeTierId];
                if (tierRes?.streams?.length) {
                    tierRes.streams.slice(0, 8).forEach((s, idx) => {
                        qualityOpts.push({
                            value: `cand-${idx}`,
                            label: s.label || `Stream ${idx + 1}`,
                            isActive: vodState.activeStreamIndex === idx,
                            onPick: () => vodState.handlers.onSelectDebridCandidate(vodState.activeTierId, idx)
                        });
                    });
                }
            }
            if (qualityOpts.length > 0) {
                const activeQ = qualityOpts.find(o => o.isActive) || qualityOpts[0];
                categories.push({
                    key: 'quality',
                    label: t('livetv.quality', 'Quality'),
                    currentValue: activeQ.label,
                    options: qualityOpts
                });
            }

            // 2. Subtitles selector (Off + native/HLS + Stremio OpenSubtitles)
            const subOpts = [
                {
                    value: 'off',
                    label: t('livetv.off', 'Off'),
                    isActive: activeExternalSubId === 'off',
                    onPick: () => disableAllSubtitles()
                }
            ];
            if (activeHls && Array.isArray(activeHls.subtitleTracks)) {
                activeHls.subtitleTracks.forEach((tr, idx) => {
                    const val = `hls-sub-${idx}`;
                    subOpts.push({
                        value: val,
                        label: tr.name || tr.lang || `Subtitle ${idx + 1}`,
                        isActive: activeExternalSubId === val,
                        onPick: () => {
                            disableAllSubtitles();
                            if (activeHls) activeHls.subtitleTrack = idx;
                            activeExternalSubId = val;
                        }
                    });
                });
            }
            if (videoEl && videoEl.textTracks) {
                Array.from(videoEl.textTracks).forEach((tr, idx) => {
                    if (tr.kind !== 'subtitles' && tr.kind !== 'captions') return;
                    const val = `native-sub-${idx}`;
                    subOpts.push({
                        value: val,
                        label: tr.label || tr.language || `Track ${idx + 1}`,
                        isActive: tr.mode === 'showing' && activeExternalSubId !== 'off',
                        onPick: () => {
                            disableAllSubtitles();
                            tr.mode = 'showing';
                            activeExternalSubId = val;
                        }
                    });
                });
            }
            cachedStremioSubtitles.forEach((sub, idx) => {
                const subKey = `stremio:${sub.id || sub.url}`;
                subOpts.push({
                    value: subKey,
                    label: `${String(sub.lang || 'SUB').toUpperCase()} #${idx + 1}`,
                    isActive: activeExternalSubId === subKey,
                    onPick: () => activateStremioSubtitle(sub)
                });
            });
            const activeSub = subOpts.find(s => s.isActive) || subOpts[0];
            categories.push({
                key: 'subtitle',
                label: t('livetv.subtitles', 'Subtitles'),
                currentValue: activeSub.label,
                options: subOpts
            });

            // 3. Audio tracks selector (when multi-audio available)
            const audioOpts = [];
            if (activeHls && Array.isArray(activeHls.audioTracks) && activeHls.audioTracks.length > 1) {
                activeHls.audioTracks.forEach((tr, idx) => {
                    audioOpts.push({
                        value: `hls-aud-${idx}`,
                        label: tr.name || tr.lang || `Audio ${idx + 1}`,
                        isActive: activeHls.audioTrack === idx,
                        onPick: () => {
                            if (activeHls) activeHls.audioTrack = idx;
                            activeAudioTrackId = `hls-aud-${idx}`;
                        }
                    });
                });
            } else if (videoEl && videoEl.audioTracks && videoEl.audioTracks.length > 1) {
                Array.from(videoEl.audioTracks).forEach((tr, idx) => {
                    audioOpts.push({
                        value: `nat-aud-${idx}`,
                        label: tr.label || tr.language || `Audio ${idx + 1}`,
                        isActive: Boolean(tr.enabled),
                        onPick: () => {
                            Array.from(videoEl.audioTracks).forEach((o, i) => { o.enabled = (i === idx); });
                            activeAudioTrackId = `nat-aud-${idx}`;
                        }
                    });
                });
            }
            if (audioOpts.length > 0) {
                const activeAud = audioOpts.find(a => a.isActive) || audioOpts[0];
                categories.push({
                    key: 'audio',
                    label: t('livetv.audioTrack', 'Audio'),
                    currentValue: activeAud.label,
                    options: audioOpts
                });
            }

            // 4. Server Settings (Primary Debrid, Backup Debrid, and the 7 original Embed Servers)
            if (vodState && params.type !== 'trailer' && params.type !== 'live') {
                const serverOpts = [];
                const tierLabels = {
                    debrid_primary: t('settings.tierDebridPrimary', 'Primary Debrid'),
                    debrid_backup: t('settings.tierDebridBackup', 'Backup Debrid')
                };

                vodState.order.forEach(tierId => {
                    if (tierId === 'embed_servers') {
                        Api.SERVERS.forEach(srv => {
                            const isCur = vodState.activeTierId === 'embed_servers' && vodState.activeServerId === srv.id;
                            serverOpts.push({
                                value: `srv:${srv.id}`,
                                label: srv.name,
                                isActive: isCur,
                                onPick: () => vodState.handlers.onSelectEmbedServer(srv.id)
                            });
                        });
                    } else {
                        const isCur = vodState.activeTierId === tierId;
                        serverOpts.push({
                            value: `tier:${tierId}`,
                            label: tierLabels[tierId] || tierId,
                            isActive: isCur,
                            onPick: () => vodState.handlers.onTriggerDebridTier(tierId)
                        });
                    }
                });

                const activeSrv = serverOpts.find(s => s.isActive) || serverOpts[0];
                categories.push({
                    key: 'server',
                    label: t('player.selectServer', 'Server Settings'),
                    currentValue: activeSrv ? activeSrv.label : '',
                    options: serverOpts
                });
            }

            // 5. Optional Next Episode shortcut row
            if (nextEpisodeTarget) {
                categories.push({
                    key: 'next_episode',
                    label: t('player.nextEpisode', 'Next Episode'),
                    currentValue: `S${nextEpisodeTarget.season} E${nextEpisodeTarget.episode}`,
                    isDirectAction: true,
                    onPick: () => Router.loadPage('player', nextEpisodeTarget)
                });
            }

            return categories;
        };

        /** Renders either the root category list or selected submenu inside `#player-settings-panel`. */
        const renderSettingsPanel = () => {
            if (!settingsOptionsEl) return;
            const categories = getSidebarCategories();
            if (activeSubmenu && !categories.some(c => c.key === activeSubmenu && !c.isDirectAction)) {
                activeSubmenu = null;
            }
            const activeCategory = activeSubmenu ? categories.find(c => c.key === activeSubmenu) : null;

            if (settingsTitleEl) {
                settingsTitleEl.textContent = activeCategory
                    ? activeCategory.label
                    : t('livetv.streamOptions', 'Stream Options');
            }

            if (!activeCategory) {
                settingsOptionsEl.innerHTML = categories.map(cat => (
                    `<button type="button" class="tv-opt-btn tv-opt-btn--category focusable universal-onclick" data-submenu="${escapeHtml(cat.key)}">` +
                        `<span class="tv-opt-label">${escapeHtml(cat.label)}</span>` +
                        `<span class="tv-opt-value">${escapeHtml(cat.currentValue || '')}</span>` +
                        `<span class="tv-opt-chevron" aria-hidden="true">&#8250;</span>` +
                    `</button>`
                )).join('');

                if (settingsPanel) SpatialNav.ensureTabindex(settingsPanel);

                settingsOptionsEl.querySelectorAll('.tv-opt-btn--category').forEach(btn => {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const key = btn.dataset.submenu;
                        const match = categories.find(c => c.key === key);
                        if (match?.isDirectAction && typeof match.onPick === 'function') {
                            match.onPick();
                            return;
                        }
                        activeSubmenu = key;
                        lastCategoryKey = key;
                        renderSettingsPanel();
                        const target = settingsOptionsEl.querySelector('.tv-opt-btn.is-active')
                            || settingsOptionsEl.querySelector('.tv-opt-btn.focusable');
                        if (target) SpatialNav.setFocus(target);
                    };
                });
                return;
            }

            settingsOptionsEl.innerHTML = activeCategory.options.map((opt, idx) => (
                `<button type="button" class="tv-opt-btn focusable universal-onclick ${opt.isActive ? 'is-active' : ''}" data-opt-idx="${idx}">` +
                    `<span class="tv-opt-label">${escapeHtml(opt.label)}</span>` +
                    (opt.isActive ? `<span class="tv-opt-checkmark" aria-hidden="true">&#10003;</span>` : '') +
                `</button>`
            )).join('');

            if (settingsPanel) SpatialNav.ensureTabindex(settingsPanel);

            settingsOptionsEl.querySelectorAll('.tv-opt-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    const idx = Number(btn.dataset.optIdx);
                    const picked = activeCategory.options[idx];
                    if (picked && typeof picked.onPick === 'function') {
                        picked.onPick();
                    }
                    renderSettingsPanel();
                    const refBtn = settingsOptionsEl.querySelector(`[data-opt-idx="${idx}"]`);
                    if (refBtn) SpatialNav.setFocus(refBtn);
                };
            });
        };

        /** Toggles the right-edge Settings drawer open/closed. */
        const toggleSettingsPanel = () => {
            if (!settingsPanel) return;
            if (isSettingsOpen()) {
                closeSettingsPanel(true);
                return;
            }
            if (hudTimeout) clearTimeout(hudTimeout);
            if (overlay) overlay.classList.add('show');
            activeSubmenu = null;
            renderSettingsPanel();
            settingsPanel.classList.remove('hidden');
            const firstOpt = (lastCategoryKey && settingsPanel.querySelector(`.tv-opt-btn[data-submenu="${lastCategoryKey}"]`))
                || settingsPanel.querySelector('.tv-opt-btn.focusable');
            if (firstOpt) SpatialNav.setFocus(firstOpt);
        };

        // Bind guaranteed non-bubbling Back button -> direct player exit
        if (backBtn) {
            backBtn.onclick = (e) => {
                e.stopPropagation();
                exitPlayer(params);
            };
        }

        // Bind Settings gear + drawer back arrow
        if (settingsBtn) {
            settingsBtn.onclick = (e) => {
                e.stopPropagation();
                toggleSettingsPanel();
            };
        }
        if (settingsBackBtn) {
            settingsBackBtn.onclick = (e) => {
                e.stopPropagation();
                navigateSettingsBack();
            };
        }
        if (settingsPanel) {
            settingsPanel.onclick = (e) => e.stopPropagation();
        }

        // Bind bottom transport bar: strictly -30s, -10s, Play/Pause, +10s, +30s
        const bindTransport = (id, fn) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.onclick = (e) => {
                e.stopPropagation();
                fn();
                resetOverlayTimer();
            };
        };
        bindTransport('player-rewind-30', () => seekBy(-30));
        bindTransport('player-rewind-10', () => seekBy(-10));
        bindTransport('play-pause-btn', () => togglePlayPause());
        bindTransport('player-forward-10', () => seekBy(10));
        bindTransport('player-forward-30', () => seekBy(30));

        // Bind thin scrub timeline pointer scrubbing
        const progressBar = document.getElementById('player-progress-bar');
        if (progressBar) {
            const scrubToX = (clientX) => {
                const rect = progressBar.getBoundingClientRect();
                if (!rect.width || !videoEl || !Number.isFinite(videoEl.duration) || videoEl.duration <= 0) return;
                const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
                videoEl.currentTime = pos * videoEl.duration;
                const fill = document.getElementById('player-progress-fill');
                if (fill) fill.style.width = `${pos * 100}%`;
            };
            let scrubbing = false;
            progressBar.onpointerdown = (e) => { e.stopPropagation(); scrubbing = true; scrubToX(e.clientX); };
            progressBar.onpointermove = (e) => { if (scrubbing) scrubToX(e.clientX); };
            progressBar.onpointerup = () => { scrubbing = false; };
            progressBar.onpointercancel = () => { scrubbing = false; };
            progressBar.onclick = (e) => { e.stopPropagation(); scrubToX(e.clientX); resetOverlayTimer(); };
        }

        // Status error panel actions
        const statusBack = document.getElementById('player-status-back');
        if (statusBack) statusBack.onclick = (e) => { e.stopPropagation(); exitPlayer(params); };
        const statusSettings = document.getElementById('player-status-settings');
        if (statusSettings) {
            statusSettings.onclick = (e) => {
                e.stopPropagation();
                try { window.playerCleanups(); } catch {}
                Router.loadPage('settings');
            };
        }

        // Overlay backdrop tap + mousemove behavior matching tv-player.js
        const surfaceTapHandler = () => {
            if (isSettingsOpen()) {
                closeSettingsPanel(false);
                return;
            }
            if (activePlaybackMode === 'embed') return;
            if (overlay && overlay.classList.contains('show')) {
                hideOverlay();
            } else {
                showOverlay(false);
            }
        };
        if (videoEl) {
            videoEl.onclick = surfaceTapHandler;
        }
        if (overlay) {
            overlay.onclick = (e) => {
                if (e.target === overlay) surfaceTapHandler();
            };
        }
        mouseMoveHandler = () => showOverlay(false);
        window.addEventListener('mousemove', mouseMoveHandler);

        // Expose window hooks for spatialNavPlayer
        window.playerShowHud = showOverlay;
        window.playerHideHud = hideOverlay;
        window.playerResetHudTimer = resetOverlayTimer;
        window.playerTogglePlayPause = togglePlayPause;
        window.playerSeek = seekBy;
        window.playerSettingsBack = navigateSettingsBack;

        // Populate top title
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

        showOverlay(false);

        if (params.type === 'live') {
            startNativePlayback(params.url);
            activePlaybackMode = 'live';
            return;
        }

        const container = document.getElementById('video-container');
        if (!container) {
            ErrorHandler.show('Failed to load player. Video container missing.', () => Router.loadPage('home'));
            Router.loadPage('home');
            return;
        }
        container.style.position = 'fixed';
        container.style.inset = '0';
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.background = '#000';

        if (params.type === 'trailer') {
            startEmbedPlayback(`https://www.youtube.com/embed/${params.ytKey}?autoplay=1&enablejsapi=1`);
            activePlaybackMode = 'trailer';
            return;
        }

        // Background recently-watched + next episode check
        Api.getDetails(params.id, params.type).then(details => {
            if (details) {
                try {
                    addToRecentlyWatched({
                        ...details,
                        media_type: params.type,
                        season: params.season,
                        episode: params.episode
                    });
                } catch {}
            }
        }).catch(() => {});

        if (params.type === 'tv' && params.season && params.episode) {
            checkForNextEpisode(params.id, parseInt(params.season, 10), parseInt(params.episode, 10))
                .then(next => { nextEpisodeTarget = next; });
        }

        const loadingOverlay = document.getElementById('player-loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'flex';

        const resolver = new VodStreamResolver();
        const plan = await resolver.resolveInitialPlayback(params);
        console.log('[IVIDS Player] Resolved plan:', plan.active.tierId, plan.active.kind, plan.mediaMeta?.imdbId || 'no-imdb', resolver.lastError || '');

        if (plan.mediaMeta?.imdbId) {
            loadStremioSubtitles(plan.mediaMeta);
        }

        const playerConfig = Api.getPlayerConfig();
        const configuredEmbedServer = Api.SERVERS.find(s => s.url === playerConfig.playerBaseUrl) || Api.SERVERS[0];

        vodState = {
            resolver,
            mediaMeta: plan.mediaMeta,
            order: plan.order,
            tierResults: { [plan.active.tierId]: plan.active },
            activeTierId: plan.active.tierId,
            activeStreamIndex: plan.active.kind === 'native' ? (plan.active.selectedStreamIndex || 0) : -1,
            activeServerId: plan.active.kind === 'embed' ? (configuredEmbedServer?.id || 'vidlink') : null,
            handlers: null
        };

        const advanceFallbackPlayback = async (fromTierId, failedIndex) => {
            const tierRes = vodState.tierResults[fromTierId];
            if (tierRes && tierRes.kind === 'native' && Array.isArray(tierRes.streams)) {
                const maxTries = Math.min(tierRes.streams.length, 4);
                for (let nextIdx = failedIndex + 1; nextIdx < maxTries; nextIdx++) {
                    const resolvedUrl = await resolver.resolveCandidateUrl(tierRes.streams[nextIdx]);
                    if (resolvedUrl) {
                        vodState.activeTierId = fromTierId;
                        vodState.activeStreamIndex = nextIdx;
                        vodState.activeServerId = null;
                        if (isSettingsOpen()) renderSettingsPanel();
                        startNativePlayback(resolvedUrl, () => advanceFallbackPlayback(fromTierId, nextIdx));
                        return;
                    }
                }
            }

            const startTierPos = Math.max(0, vodState.order.indexOf(fromTierId) + 1);
            for (let tIdx = startTierPos; tIdx < vodState.order.length; tIdx++) {
                const nextTierId = vodState.order[tIdx];
                const resolvedTier = vodState.tierResults[nextTierId] || await resolver.resolveTier(nextTierId, vodState.mediaMeta);
                if (!resolvedTier) continue;
                vodState.tierResults[nextTierId] = resolvedTier;
                if (resolvedTier.kind === 'native' && resolvedTier.url) {
                    vodState.activeTierId = nextTierId;
                    vodState.activeStreamIndex = resolvedTier.selectedStreamIndex || 0;
                    vodState.activeServerId = null;
                    if (isSettingsOpen()) renderSettingsPanel();
                    startNativePlayback(resolvedTier.url, () => advanceFallbackPlayback(nextTierId, vodState.activeStreamIndex));
                    return;
                }
                if (resolvedTier.kind === 'embed') {
                    activateEmbedServer(configuredEmbedServer?.id || 'vidlink');
                    return;
                }
            }

            activateEmbedServer(configuredEmbedServer?.id || 'vidlink');
        };

        const activateEmbedServer = (serverId) => {
            vodState.activeTierId = 'embed_servers';
            vodState.activeStreamIndex = -1;
            vodState.activeServerId = serverId;
            if (isSettingsOpen()) renderSettingsPanel();
            startEmbedPlayback(Api.getVideoUrl(params.id, params.type, params.season, params.episode, serverId));
        };

        vodState.handlers = {
            onSelectDebridCandidate: async (tierId, idx) => {
                const tierRes = vodState.tierResults[tierId];
                const candidate = tierRes?.streams?.[idx];
                if (!candidate) return;
                if (loadingOverlay) loadingOverlay.style.display = 'flex';
                const resolvedUrl = await resolver.resolveCandidateUrl(candidate);
                if (resolvedUrl) {
                    vodState.activeTierId = tierId;
                    vodState.activeStreamIndex = idx;
                    vodState.activeServerId = null;
                    if (isSettingsOpen()) renderSettingsPanel();
                    startNativePlayback(resolvedUrl, () => advanceFallbackPlayback(tierId, idx));
                } else {
                    advanceFallbackPlayback(tierId, idx);
                }
            },
            onTriggerDebridTier: async (tierId) => {
                if (loadingOverlay) loadingOverlay.style.display = 'flex';
                const resolvedTier = vodState.tierResults[tierId]?.url
                    ? vodState.tierResults[tierId]
                    : await resolver.resolveTier(tierId, vodState.mediaMeta);
                if (resolvedTier && resolvedTier.url) {
                    vodState.tierResults[tierId] = resolvedTier;
                    vodState.activeTierId = tierId;
                    vodState.activeStreamIndex = resolvedTier.selectedStreamIndex || 0;
                    vodState.activeServerId = null;
                    if (isSettingsOpen()) renderSettingsPanel();
                    startNativePlayback(resolvedTier.url, () => advanceFallbackPlayback(tierId, vodState.activeStreamIndex));
                } else {
                    if (loadingOverlay) loadingOverlay.style.display = 'none';
                    const reason = resolver.lastError || 'No playable Debrid stream found for this title.';
                    console.warn(`[IVIDS Player] Manual Debrid switch failed (${tierId}):`, reason);
                    const statusPanel = document.getElementById('player-status-panel');
                    const statusTitle = document.getElementById('player-status-title');
                    const statusMsg = document.getElementById('player-status-message');
                    if (statusTitle) statusTitle.textContent = t(`settings.${tierId === 'debrid_backup' ? 'tierDebridBackup' : 'tierDebridPrimary'}`, tierId);
                    if (statusMsg) statusMsg.textContent = reason;
                    if (statusPanel) {
                        statusPanel.classList.remove('hidden');
                        statusPanel.style.display = 'flex';
                        const backEl = document.getElementById('player-status-back');
                        if (backEl) SpatialNav.setFocus(backEl);
                    }
                }
            },
            onSelectEmbedServer: (serverId) => activateEmbedServer(serverId)
        };

        if (plan.active.kind === 'native' && plan.active.url) {
            startNativePlayback(plan.active.url, () => advanceFallbackPlayback(plan.active.tierId, vodState.activeStreamIndex));
        } else {
            activateEmbedServer(configuredEmbedServer?.id || 'vidlink');
        }
    } catch (error) {
        console.error('Critical error in player.init:', error);
        ErrorHandler.show('An error occurred while loading the player.');
    }
}

/**
 * Checks TMDB to see if a following episode or next season exists for the active TV series.
 *
 * @param {string} seriesId - TMDB series ID.
 * @param {number} currentSeason - Current season number.
 * @param {number} currentEpisode - Current episode number.
 * @returns {Promise<Object|null>} Route params object for the next episode, or null.
 */
async function checkForNextEpisode(seriesId, currentSeason, currentEpisode) {
    try {
        const seasonDetails = await Api.getSeasonDetails(seriesId, currentSeason);
        if (seasonDetails?.episodes?.some(e => e.episode_number === currentEpisode + 1)) {
            return { id: seriesId, type: 'tv', season: currentSeason, episode: currentEpisode + 1 };
        }
        const seriesDetails = await Api.getDetails(seriesId, 'tv');
        if (seriesDetails?.seasons?.some(s => s.season_number === currentSeason + 1)) {
            return { id: seriesId, type: 'tv', season: currentSeason + 1, episode: 1 };
        }
    } catch {
        // Ignore next-episode lookup failures
    }
    return null;
}
