import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { addToRecentlyWatched } from '../../logic/recentlyWatched.js';
import { ErrorHandler } from '../js/error-handler.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { VodStreamResolver } from '../../logic/vod/vod-stream-resolver.js';
import { proxyUrl } from '../js/utils/proxy.js';

let hudTimeout = null;
let providerTimeout = null;
let mouseMoveHandler = null;
let clickHandler = null;
let keydownHandler = null;
let globalKeydownHandler = null;
let popstateHandler = null;
let playerBackHandler = null;
let progressInterval = null;

let activeHls = null;
let activePlaybackMode = 'embed'; // 'native' | 'embed' | 'live' | 'trailer'
let playbackGeneration = 0;
let activeSubtitleBlobUrls = [];
let cachedStremioSubtitles = [];
let activeExternalSubId = 'off';
let activeAudioTrackId = null;

/**
 * Formats a duration in seconds into MM:SS or HH:MM:SS format.
 *
 * @param {number} seconds - Playback timestamp in seconds.
 * @returns {string} Formatted timestamp string.
 */
function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const totalSecs = Math.floor(seconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
    if (hrs > 0) {
        return `${hrs}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Updates the Play/Pause HUD button icons to reflect the active playback state.
 *
 * @param {boolean} isPaused - True when playback is paused, false when playing.
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
 * Safely tears down any active Hls.js instance, native `<video>` source, and dynamically
 * attached subtitle `<track>` elements without leaving leaked blob URLs behind.
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
 * Binds playback logging, progress synchronization, and smart icon updates to `#native-video-player`.
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
            window.playerShowHud();
        }
    });

    videoEl.addEventListener('ended', () => {
        console.log('[IVIDS Player] Native Video: Completed');
        syncPlayPauseIcons(true);
        if (typeof window.playerShowHud === 'function') {
            window.playerShowHud();
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
    videoEl.addEventListener('waiting', () => console.log('[IVIDS Player] Native Video: Buffering...'));
}

/**
 * Cleans up player resources, restores global UI layout elements, and navigates back.
 *
 * @param {Object} params - Current player route parameters.
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
 * Removes all global event listeners, media decoders, blob URLs, and timers on player exit.
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

    try {
        teardownNativeMedia();
    } catch (e) {
        console.error('Error cleaning up native video:', e);
    }

    cachedStremioSubtitles = [];
    activeExternalSubId = 'off';
    activeAudioTrackId = null;

    delete window.playerShowHud;
    delete window.playerHideHud;
    delete window.playerResetHudTimer;
    delete window.playerTogglePlayPause;
    delete window.playerSeek;
    delete window.playerOpenModal;
    delete window.playerCloseModal;
};

/**
 * Toggles Play/Pause on the active native `<video>` player or falls back to iframe postMessage.
 */
function togglePlayPause() {
    const videoEl = document.getElementById('native-video-player');

    if (videoEl && activePlaybackMode === 'native' && (videoEl.currentSrc || videoEl.src || activeHls)) {
        if (videoEl.paused) {
            videoEl.play().catch(e => console.warn('[IVIDS Player] Play error:', e));
            syncPlayPauseIcons(false);
        } else {
            videoEl.pause();
            syncPlayPauseIcons(true);
        }
        return;
    }

    if (videoEl && !videoEl.classList.contains('hidden') && videoEl.style.display !== 'none' && videoEl.src) {
        if (videoEl.paused) {
            videoEl.play().catch(e => console.warn('[IVIDS Player] Play error:', e));
            syncPlayPauseIcons(false);
        } else {
            videoEl.pause();
            syncPlayPauseIcons(true);
        }
        return;
    }

    const iframe = document.getElementById('player-iframe');
    if (iframe && iframe.contentWindow) {
        try {
            iframe.contentWindow.postMessage({ type: 'play', action: 'toggle' }, '*');
        } catch (e) {
            console.warn('[IVIDS Player] Iframe postMessage notice:', e);
        }
    }
    const iconPause = document.getElementById('player-icon-pause');
    if (iconPause) {
        const currentlyPaused = iconPause.classList.contains('hidden');
        syncPlayPauseIcons(!currentlyPaused);
    }
}

/**
 * Seeks playback forward or backward by a relative number of seconds.
 *
 * @param {number} deltaSeconds - Signed seek delta in seconds.
 */
function seekBy(deltaSeconds) {
    const videoEl = document.getElementById('native-video-player');
    if (videoEl && (activePlaybackMode === 'native' || (!videoEl.classList.contains('hidden') && videoEl.style.display !== 'none')) && (videoEl.currentSrc || videoEl.src || activeHls)) {
        const target = Math.max(0, Math.min(videoEl.duration || Infinity, (videoEl.currentTime || 0) + deltaSeconds));
        videoEl.currentTime = target;
        if (typeof window.playerShowHud === 'function') {
            window.playerShowHud();
        }
        return;
    }

    const iframe = document.getElementById('player-iframe');
    if (iframe && iframe.contentWindow) {
        try {
            iframe.contentWindow.postMessage({ type: 'seek', delta: deltaSeconds }, '*');
        } catch (e) {
            console.warn('[IVIDS Player] Iframe postMessage notice:', e);
        }
    }
}

/**
 * Translates an i18n key with a guaranteed readable fallback string.
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
 * Fetches community subtitles from the Stremio OpenSubtitles v3 addon in the background.
 *
 * @param {Object} mediaMeta - Media metadata containing `imdbId`, `type`, `season`, `episode`.
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

        // Deduplicate to max 3 variants per language to keep the HUD menu compact
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
 * Converts SRT subtitle text into standard WebVTT markup so Chromium HTML5 `<track>` renders it.
 *
 * @param {string} rawText - Raw SRT or VTT subtitle text.
 * @returns {string} Valid WebVTT formatted subtitle string.
 */
function convertSrtToVtt(rawText) {
    const clean = String(rawText || '').replace(/^\uFEFF/, '').replace(/\r+/g, '');
    if (clean.startsWith('WEBVTT')) return clean;
    const converted = clean.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
    return `WEBVTT\n\n${converted}`;
}

/**
 * Downloads a Stremio subtitle file, converts it to WebVTT, and activates it on `#native-video-player`.
 *
 * @param {Object} sub - Subtitle descriptor containing `id`, `lang`, and `url`.
 */
async function activateStremioSubtitle(sub) {
    const videoEl = document.getElementById('native-video-player');
    if (!videoEl || !sub?.url) return;

    try {
        const res = await fetch(proxyUrl(sub.url));
        if (!res.ok) return;
        const raw = await res.text();
        const vtt = convertSrtToVtt(raw);
        const blob = new Blob([vtt], { type: 'text/vtt' });
        const blobUrl = URL.createObjectURL(blob);
        activeSubtitleBlobUrls.push(blobUrl);

        videoEl.querySelectorAll('track[data-stremio-sub="true"]').forEach(el => el.remove());
        Array.from(videoEl.textTracks || []).forEach(track => {
            track.mode = 'disabled';
        });

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
 * Disables all active HLS, native `<track>`, and external Stremio subtitle tracks.
 */
function disableAllSubtitles() {
    const videoEl = document.getElementById('native-video-player');
    if (activeHls) {
        activeHls.subtitleTrack = -1;
    }
    if (videoEl) {
        Array.from(videoEl.textTracks || []).forEach(track => {
            track.mode = 'disabled';
        });
    }
    activeExternalSubId = 'off';
}

/**
 * Displays the audio / subtitle / quality modal sheet and populates selectable options
 * (supporting optional section dividers).
 *
 * @param {string} title - Modal header title.
 * @param {Array<Object>} options - Items (`{ isHeader, label, value, active, onSelect }`).
 * @param {Function} [fallbackOnSelect] - Fallback click handler if item has no own callback.
 */
function openModalSheet(title, options = [], fallbackOnSelect = null) {
    const modal = document.getElementById('player-modal-sheet');
    const modalTitle = document.getElementById('player-modal-title');
    const modalOptions = document.getElementById('player-modal-options');
    if (!modal) return;

    if (modalTitle) modalTitle.textContent = title || t('player.tracksTitle', 'Audio & Subtitles');
    if (modalOptions) {
        modalOptions.innerHTML = '';
        const items = (options && options.length > 0) ? options : [
            { label: t('livetv.auto', 'Auto'), value: 'auto', active: true }
        ];

        items.forEach(opt => {
            if (opt.isHeader) {
                const header = document.createElement('div');
                header.className = 'modal-options-section';
                header.textContent = opt.label;
                modalOptions.appendChild(header);
                return;
            }
            const btn = document.createElement('button');
            btn.className = 'btn btn--secondary btn--block focusable modal-option' + (opt.active ? ' is-active' : '');
            btn.textContent = opt.label;
            btn.dataset.value = opt.value;
            btn.onclick = () => {
                if (typeof opt.onSelect === 'function') {
                    opt.onSelect(opt);
                } else if (fallbackOnSelect) {
                    fallbackOnSelect(opt);
                }
                closeModalSheet();
            };
            modalOptions.appendChild(btn);
        });
    }

    modal.style.display = 'flex';
    modal.classList.add('is-open');
    modal.classList.remove('hidden');

    const activeOpt = modal.querySelector('.modal-option.is-active.focusable') || modal.querySelector('.modal-option.focusable');
    if (activeOpt) SpatialNav.setFocus(activeOpt);
}

/**
 * Opens the unified Audio & Subtitles track modal using live HLS tracks, HTML5 tracks,
 * and Stremio community subtitles when playing native VOD media.
 */
function openAudioSubtitlesModal() {
    const videoEl = document.getElementById('native-video-player');
    const items = [];

    // 1. Audio Tracks
    const audioItems = [];
    if (activeHls && Array.isArray(activeHls.audioTracks) && activeHls.audioTracks.length > 0) {
        activeHls.audioTracks.forEach((track, idx) => {
            const label = track.name || track.lang || `Audio ${idx + 1}`;
            audioItems.push({
                label,
                value: `hls-audio-${idx}`,
                active: activeHls.audioTrack === idx,
                onSelect: () => {
                    activeHls.audioTrack = idx;
                    activeAudioTrackId = `hls-${idx}`;
                }
            });
        });
    } else if (videoEl && videoEl.audioTracks && videoEl.audioTracks.length > 0) {
        Array.from(videoEl.audioTracks).forEach((track, idx) => {
            const label = track.label || track.language || `Audio ${idx + 1}`;
            audioItems.push({
                label,
                value: `native-audio-${idx}`,
                active: Boolean(track.enabled),
                onSelect: () => {
                    Array.from(videoEl.audioTracks).forEach((tObj, i) => {
                        tObj.enabled = (i === idx);
                    });
                    activeAudioTrackId = `native-${idx}`;
                }
            });
        });
    } else {
        audioItems.push({
            label: t('livetv.auto', 'Auto'),
            value: 'audio-auto',
            active: !activeAudioTrackId
        });
    }

    items.push({ isHeader: true, label: t('livetv.audioTrack', 'Audio') });
    items.push(...audioItems);

    // 2. Subtitle Tracks
    const subItems = [
        {
            label: t('livetv.off', 'Off'),
            value: 'sub-off',
            active: activeExternalSubId === 'off',
            onSelect: () => disableAllSubtitles()
        }
    ];

    if (activeHls && Array.isArray(activeHls.subtitleTracks) && activeHls.subtitleTracks.length > 0) {
        activeHls.subtitleTracks.forEach((track, idx) => {
            const val = `hls-sub-${idx}`;
            subItems.push({
                label: track.name || track.lang || `Subtitle ${idx + 1}`,
                value: val,
                active: activeExternalSubId === val || activeHls.subtitleTrack === idx,
                onSelect: () => {
                    disableAllSubtitles();
                    activeHls.subtitleTrack = idx;
                    activeExternalSubId = val;
                }
            });
        });
    }

    if (videoEl && videoEl.textTracks && videoEl.textTracks.length > 0) {
        Array.from(videoEl.textTracks).forEach((track, idx) => {
            if (track.kind !== 'subtitles' && track.kind !== 'captions') return;
            const val = `native-sub-${idx}`;
            subItems.push({
                label: track.label || track.language || `Track ${idx + 1}`,
                value: val,
                active: track.mode === 'showing' && activeExternalSubId !== 'off',
                onSelect: () => {
                    disableAllSubtitles();
                    track.mode = 'showing';
                    activeExternalSubId = val;
                }
            });
        });
    }

    if (cachedStremioSubtitles.length > 0) {
        cachedStremioSubtitles.forEach((sub, idx) => {
            const subKey = `stremio:${sub.id || sub.url}`;
            const langLabel = String(sub.lang || 'SUB').toUpperCase();
            subItems.push({
                label: `${langLabel} (OpenSubtitles #${idx + 1})`,
                value: subKey,
                active: activeExternalSubId === subKey,
                onSelect: () => activateStremioSubtitle(sub)
            });
        });
    }

    items.push({ isHeader: true, label: t('livetv.subtitles', 'Subtitles') });
    items.push(...subItems);

    openModalSheet(t('player.tracksTitle', 'Audio & Subtitles'), items);
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
 * Binds click listeners, drag scrubbing, and actions to all OSD controls.
 *
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
            if (params.type === 'tv' && params.season && params.episode && parseInt(params.episode, 10) > 1) {
                Router.loadPage('player', {
                    id: params.id,
                    type: 'tv',
                    season: params.season,
                    episode: parseInt(params.episode, 10) - 1
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
                    episode: parseInt(params.episode, 10) + 1
                });
            } else {
                seekBy(30);
            }
        };
    }

    const audioSubBtn = document.getElementById('player-audio-sub');
    if (audioSubBtn) {
        audioSubBtn.onclick = () => openAudioSubtitlesModal();
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
        const scrubToPointer = (clientX) => {
            const rect = progressBar.getBoundingClientRect();
            if (!rect.width) return;
            const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            const videoEl = document.getElementById('native-video-player');
            if (videoEl && Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
                videoEl.currentTime = pos * videoEl.duration;
                const fill = document.getElementById('player-progress-fill');
                if (fill) fill.style.width = `${pos * 100}%`;
            }
        };

        let isScrubbing = false;
        progressBar.onpointerdown = (e) => {
            isScrubbing = true;
            scrubToPointer(e.clientX);
        };
        progressBar.onpointermove = (e) => {
            if (isScrubbing) scrubToPointer(e.clientX);
        };
        progressBar.onpointerup = () => { isScrubbing = false; };
        progressBar.onpointercancel = () => { isScrubbing = false; };
        progressBar.onclick = (e) => scrubToPointer(e.clientX);
    }

    const modalClose = document.getElementById('player-modal-close');
    if (modalClose) {
        modalClose.onclick = () => closeModalSheet();
    }

    const statusBack = document.getElementById('player-status-back');
    if (statusBack) {
        statusBack.onclick = () => exitPlayer(params);
    }

    const statusSettings = document.getElementById('player-status-settings');
    if (statusSettings) {
        statusSettings.onclick = () => {
            try { window.playerCleanups(); } catch {}
            Router.loadPage('settings');
        };
    }

    const nativeVideo = document.getElementById('native-video-player');
    if (nativeVideo) {
        bindNativeVideoListeners(nativeVideo);
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
}

/**
 * Starts native HTML5 / Hls.js playback for a direct Debrid stream URL inside `#native-video-player`.
 * Invokes `onPlaybackFailed` automatically if the container or codec fails to decode in WebView/browser.
 *
 * @param {string} streamUrl - Direct playable `.mp4`/`.m3u8`/`.mkv` URL.
 * @param {Function} [onPlaybackFailed] - Callback executed if this stream fails fatally.
 */
function startNativePlayback(streamUrl, onPlaybackFailed = null) {
    const gen = playbackGeneration + 1;
    teardownNativeMedia();
    playbackGeneration = gen;
    activePlaybackMode = 'native';

    const loadingOverlay = document.getElementById('player-loading-overlay');
    const statusPanel = document.getElementById('player-status-panel');
    if (statusPanel) statusPanel.style.display = 'none';
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

    let failedTriggered = false;
    const handleFatalFailure = (reason) => {
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
            if (playbackGeneration !== gen) return;
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            videoEl.play().catch(err => console.warn('[IVIDS Player] Autoplay prevented:', err));
        };
        videoEl.onloadedmetadata = onReady;
        videoEl.oncanplay = onReady;
        videoEl.onerror = () => handleFatalFailure(videoEl.error ? `MEDIA_ERR_${videoEl.error.code}` : 'Video error');
        videoEl.src = streamUrl;
    }

    if (typeof window.playerShowHud === 'function') {
        window.playerShowHud();
    }
}

/**
 * Loads or updates an embed server iframe inside `#video-container` as fallback or primary choice.
 *
 * @param {string} url - Embed player URL.
 * @returns {HTMLIFrameElement} The active iframe element.
 */
function startEmbedPlayback(url) {
    teardownNativeMedia();
    activePlaybackMode = 'embed';

    const loadingOverlay = document.getElementById('player-loading-overlay');
    const statusPanel = document.getElementById('player-status-panel');
    if (statusPanel) statusPanel.style.display = 'none';
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
            if (statusPanel) {
                statusPanel.style.display = 'none';
                statusPanel.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
            }
            if (loadingOverlay) loadingOverlay.style.display = 'none';
            SpatialNav.setFocus(iframe);

            setTimeout(() => {
                try {
                    iframe.focus();
                    iframe.contentWindow?.postMessage({ type: 'play', action: 'play' }, '*');
                } catch {
                    // Cross-origin postMessage fallback is best-effort
                }
            }, 1500);
        };
        iframe.src = url;
    }

    return iframe;
}

/**
 * Initializes the hybrid VOD video player, resolving Debrid/Stremio streams and the 7 embed
 * servers according to user-defined playback priority, and attaching `#player-hud` controls.
 *
 * @param {Object} params - Route parameters containing `id`, `type`, `season`, and `episode`.
 */
export async function init(params) {
    try {
        console.log('[IVIDS Player] Initializing Player with params:', params);
        if (!params || (!params.id && params.type !== 'live')) {
            console.error('[IVIDS Player] Invalid or missing parameters provided for player');
            Router.loadPage('home');
            return;
        }

        try {
            window.playerCleanups();
        } catch (e) {
            console.error('Error in initial cleanup:', e);
        }

        try {
            const app = document.getElementById('app');
            if (app) app.classList.add('fullscreen-layout');
            const header = document.getElementById('header');
            if (header) header.style.display = 'none';
        } catch (headerError) {
            console.error('Error hiding header:', headerError);
        }

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
            backBtn.onclick = () => SpatialNav.back();
        }

        setupMediaControls(params);
        setupOverlayVisibility(params);

        // 1. Live TV standalone direct mode
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
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.background = '#000';
        container.style.overflow = 'hidden';

        // 2. YouTube trailer embed mode
        if (params.type === 'trailer') {
            const trailerUrl = `https://www.youtube.com/embed/${params.ytKey}?autoplay=1&enablejsapi=1`;
            startEmbedPlayback(trailerUrl);
            activePlaybackMode = 'trailer';
            const overlay = document.getElementById('server-selection-overlay');
            if (overlay) overlay.style.display = 'none';
            return;
        }

        // Background metadata tracking & next-episode check
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
        }).catch(() => {});

        if (params.type === 'tv' && params.season && params.episode) {
            checkForNextEpisode(params.id, parseInt(params.season, 10), parseInt(params.episode, 10));
        }

        // 3. Hybrid VOD resolution across configured priority tiers (Debrid / Backup Debrid / 7 Embed Servers)
        const loadingOverlay = document.getElementById('player-loading-overlay');
        if (loadingOverlay) loadingOverlay.style.display = 'flex';

        const resolver = new VodStreamResolver();
        const plan = await resolver.resolveInitialPlayback(params);
        if (plan.mediaMeta?.imdbId) {
            loadStremioSubtitles(plan.mediaMeta);
        }

        const playerConfig = Api.getPlayerConfig();
        const configuredEmbedServer = Api.SERVERS.find(s => s.url === playerConfig.playerBaseUrl) || Api.SERVERS[0];

        const state = {
            resolver,
            mediaMeta: plan.mediaMeta,
            order: plan.order,
            tierResults: { [plan.active.tierId]: plan.active },
            activeTierId: plan.active.tierId,
            activeStreamIndex: plan.active.kind === 'native' ? (plan.active.selectedStreamIndex || 0) : -1,
            activeServerId: plan.active.kind === 'embed' ? (configuredEmbedServer?.id || 'vidlink') : null
        };

        /**
         * Attempts playback of the active tier's next candidate stream or advances down `state.order`.
         *
         * @param {string} fromTierId - Tier whose stream just failed.
         * @param {number} failedIndex - Index in `streams` that failed.
         */
        const advanceFallbackPlayback = async (fromTierId, failedIndex) => {
            const tierRes = state.tierResults[fromTierId];
            if (tierRes && tierRes.kind === 'native' && Array.isArray(tierRes.streams)) {
                const maxTries = Math.min(tierRes.streams.length, 4);
                for (let nextIdx = failedIndex + 1; nextIdx < maxTries; nextIdx++) {
                    const resolvedUrl = await resolver.resolveCandidateUrl(tierRes.streams[nextIdx]);
                    if (resolvedUrl) {
                        state.activeTierId = fromTierId;
                        state.activeStreamIndex = nextIdx;
                        state.activeServerId = null;
                        refreshServerButtons();
                        startNativePlayback(resolvedUrl, () => advanceFallbackPlayback(fromTierId, nextIdx));
                        return;
                    }
                }
            }

            const startTierPos = Math.max(0, state.order.indexOf(fromTierId) + 1);
            for (let tIdx = startTierPos; tIdx < state.order.length; tIdx++) {
                const nextTierId = state.order[tIdx];
                const resolvedTier = state.tierResults[nextTierId] || await resolver.resolveTier(nextTierId, state.mediaMeta);
                if (!resolvedTier) continue;
                state.tierResults[nextTierId] = resolvedTier;
                if (resolvedTier.kind === 'native' && resolvedTier.url) {
                    state.activeTierId = nextTierId;
                    state.activeStreamIndex = resolvedTier.selectedStreamIndex || 0;
                    state.activeServerId = null;
                    refreshServerButtons();
                    startNativePlayback(resolvedTier.url, () => advanceFallbackPlayback(nextTierId, state.activeStreamIndex));
                    return;
                }
                if (resolvedTier.kind === 'embed') {
                    activateEmbedServer(configuredEmbedServer?.id || 'vidlink');
                    return;
                }
            }

            activateEmbedServer(configuredEmbedServer?.id || 'vidlink');
        };

        /**
         * Switches playback to one of the 7 Embed Servers (or custom embed servers).
         *
         * @param {string} serverId - ID of the target server in `Api.SERVERS`.
         */
        const activateEmbedServer = (serverId) => {
            state.activeTierId = 'embed_servers';
            state.activeStreamIndex = -1;
            state.activeServerId = serverId;
            refreshServerButtons();
            const embedUrl = Api.getVideoUrl(params.id, params.type, params.season, params.episode, serverId);
            startEmbedPlayback(embedUrl);
        };

        /**
         * Renders unified `#player-server-list` buttons containing Debrid stream candidates
         * alongside all 7 original Embed Servers in the user's preferred priority order.
         */
        const refreshServerButtons = () => {
            renderHybridServerList(state, params, {
                onSelectDebridCandidate: async (tierId, idx) => {
                    const tierRes = state.tierResults[tierId];
                    const candidate = tierRes?.streams?.[idx];
                    if (!candidate) return;
                    const loadingEl = document.getElementById('player-loading-overlay');
                    if (loadingEl) loadingEl.style.display = 'flex';
                    const resolvedUrl = await resolver.resolveCandidateUrl(candidate);
                    if (resolvedUrl) {
                        state.activeTierId = tierId;
                        state.activeStreamIndex = idx;
                        state.activeServerId = null;
                        refreshServerButtons();
                        startNativePlayback(resolvedUrl, () => advanceFallbackPlayback(tierId, idx));
                    } else {
                        advanceFallbackPlayback(tierId, idx);
                    }
                },
                onTriggerDebridTier: async (tierId) => {
                    const loadingEl = document.getElementById('player-loading-overlay');
                    if (loadingEl) loadingEl.style.display = 'flex';
                    const resolvedTier = await resolver.resolveTier(tierId, state.mediaMeta);
                    if (resolvedTier && resolvedTier.url) {
                        state.tierResults[tierId] = resolvedTier;
                        state.activeTierId = tierId;
                        state.activeStreamIndex = resolvedTier.selectedStreamIndex || 0;
                        state.activeServerId = null;
                        refreshServerButtons();
                        startNativePlayback(resolvedTier.url, () => advanceFallbackPlayback(tierId, state.activeStreamIndex));
                    } else {
                        if (loadingEl) loadingEl.style.display = 'none';
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
                            const backBtnEl = document.getElementById('player-status-back');
                            if (backBtnEl) SpatialNav.setFocus(backBtnEl);
                        }
                    }
                },
                onSelectEmbedServer: (serverId) => activateEmbedServer(serverId)
            });
        };

        refreshServerButtons();

        if (plan.active.kind === 'native' && plan.active.url) {
            startNativePlayback(plan.active.url, () => advanceFallbackPlayback(plan.active.tierId, state.activeStreamIndex));
        } else {
            activateEmbedServer(configuredEmbedServer?.id || 'vidlink');
        }
    } catch (error) {
        console.error('Critical error in player.init:', error);
        ErrorHandler.show('An error occurred while loading the player.');
    }
}

/**
 * Checks TMDB to determine if a subsequent episode or season exists for the active TV series.
 *
 * @param {string} seriesId - The TMDB ID of the TV show.
 * @param {number} currentSeason - Current season number.
 * @param {number} currentEpisode - Current episode number.
 */
async function checkForNextEpisode(seriesId, currentSeason, currentEpisode) {
    try {
        const nextBtnContainer = document.getElementById('next-episode-container');
        const nextBtn = document.getElementById('player-next-ep-btn') || document.getElementById('player-next');
        if (!nextBtnContainer || !nextBtn) return;

        const seasonDetails = await Api.getSeasonDetails(seriesId, currentSeason);
        if (seasonDetails && seasonDetails.episodes) {
            const nextEpisode = seasonDetails.episodes.find(e => e.episode_number === currentEpisode + 1);
            if (nextEpisode) {
                showNextButton(seriesId, currentSeason, currentEpisode + 1);
                return;
            }
        }

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
 * Configures and displays the "Next Episode" button on the HUD.
 *
 * @param {string} seriesId - TMDB TV show ID.
 * @param {number} nextSeason - Next season number.
 * @param {number} nextEpisode - Next episode number.
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
 * Renders unified hybrid source selector buttons inside `#player-server-list`:
 * Debrid stream candidates (resolved or on-demand trigger) AND all 7 original Embed Servers.
 *
 * @param {Object} state - Active VOD resolution state.
 * @param {Object} params - Route parameters.
 * @param {Object} handlers - Selection callbacks (`onSelectDebridCandidate`, `onTriggerDebridTier`, `onSelectEmbedServer`).
 */
function renderHybridServerList(state, params, handlers) {
    const overlay = document.getElementById('server-selection-overlay');
    const serverList = document.getElementById('player-server-list');

    if (params.type === 'trailer') {
        if (overlay) overlay.style.display = 'none';
        return;
    }
    if (overlay) overlay.style.display = 'flex';
    if (!serverList) return;

    serverList.innerHTML = '';

    const debridBadge = {
        debrid_primary: t('settings.tierDebridPrimary', 'Primary Debrid'),
        debrid_backup: t('settings.tierDebridBackup', 'Backup Debrid')
    };

    state.order.forEach(tierId => {
        if (tierId === 'embed_servers') {
            Api.SERVERS.forEach(server => {
                const isSelected = state.activeTierId === 'embed_servers' && state.activeServerId === server.id;
                const btn = document.createElement('button');
                btn.className = `btn server-btn focusable ${isSelected ? 'active is-active btn--primary' : 'btn--secondary'}`;
                btn.textContent = server.name;
                btn.dataset.serverId = server.id;
                btn.onclick = () => handlers.onSelectEmbedServer(server.id);
                serverList.appendChild(btn);
            });
            return;
        }

        const tierRes = state.tierResults[tierId];
        if (tierRes && tierRes.kind === 'native' && Array.isArray(tierRes.streams) && tierRes.streams.length > 0) {
            const topStreams = tierRes.streams.slice(0, 4);
            topStreams.forEach((stream, idx) => {
                const isSelected = state.activeTierId === tierId && state.activeStreamIndex === idx;
                const btn = document.createElement('button');
                btn.className = `btn server-btn focusable ${isSelected ? 'active is-active btn--primary' : 'btn--secondary'}`;
                const prefix = tierId === 'debrid_backup' ? 'Backup' : 'Debrid';
                btn.textContent = `${prefix} · ${stream.label || `Stream ${idx + 1}`}`;
                btn.title = stream.rawTitle || btn.textContent;
                btn.dataset.tierId = tierId;
                btn.dataset.streamIdx = String(idx);
                btn.onclick = () => handlers.onSelectDebridCandidate(tierId, idx);
                serverList.appendChild(btn);
            });
            return;
        }

        const cfg = Api.getPlayerConfig().debridConfig;
        const addonUrl = tierId === 'debrid_primary' ? cfg?.primaryAddonUrl : cfg?.backupAddonUrl;
        if (addonUrl && state.mediaMeta?.imdbId && !tierRes) {
            const btn = document.createElement('button');
            btn.className = 'btn server-btn focusable btn--secondary';
            btn.textContent = debridBadge[tierId] || tierId;
            btn.dataset.tierId = tierId;
            btn.onclick = () => handlers.onTriggerDebridTier(tierId);
            serverList.appendChild(btn);
        }
    });
}

/**
 * Configures activity and pointer listeners to manage `#player-hud` visibility,
 * smart auto-hide (stays open when native video is paused), and click-to-toggle playback.
 *
 * @param {Object} _params - Route parameters of the player.
 */
function setupOverlayVisibility(_params) {
    const playerHud = document.getElementById('player-hud');
    if (!playerHud) return;

    const resetTimer = () => {
        if (hudTimeout) clearTimeout(hudTimeout);
        hudTimeout = setTimeout(() => {
            const modal = document.getElementById('player-modal-sheet');
            const modalOpen = modal && (modal.classList.contains('is-open') || modal.style.display !== 'none');
            const videoEl = document.getElementById('native-video-player');
            const isPausedNative = activePlaybackMode === 'native' && videoEl && videoEl.paused;
            const focused = document.activeElement;
            const hasFocusInside = focused && playerHud.contains(focused);

            if (modalOpen || isPausedNative || hasFocusInside) {
                resetTimer();
            } else {
                hideHUD();
            }
        }, 4000);
    };

    /**
     * Reveals the HUD overlay, schedules auto-hide, and places focus on Play/Pause if newly shown.
     */
    const showHUD = () => {
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

        resetTimer();
    };

    /**
     * Hides the HUD overlay and shifts focus back to the underlying video or embed element.
     */
    const hideHUD = () => {
        const modal = document.getElementById('player-modal-sheet');
        if (modal && (modal.classList.contains('is-open') || modal.style.display !== 'none')) {
            return;
        }

        playerHud.classList.remove('visible');
        playerHud.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));

        if (document.activeElement && playerHud.contains(document.activeElement)) {
            document.activeElement.blur();
            const iframe = document.getElementById('player-iframe');
            if (iframe && iframe.style.display !== 'none') {
                SpatialNav.setFocus(iframe);
            } else {
                const nativeVideo = document.getElementById('native-video-player');
                if (nativeVideo) {
                    nativeVideo.tabIndex = -1;
                    nativeVideo.focus();
                }
            }
        }

        setTimeout(() => {
            if (!playerHud.classList.contains('visible')) {
                playerHud.style.display = 'none';
            }
        }, 400);
    };

    mouseMoveHandler = showHUD;
    clickHandler = (e) => {
        const wasVisible = playerHud.classList.contains('visible');
        const clickedVideoSurface = e.target && (e.target.id === 'native-video-player' || e.target.id === 'player-hud');
        if (wasVisible && activePlaybackMode === 'native' && clickedVideoSurface) {
            togglePlayPause();
        }
        showHUD();
    };
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

    window.playerShowHud = showHUD;
    window.playerHideHud = hideHUD;
    window.playerResetHudTimer = resetTimer;
    window.playerTogglePlayPause = togglePlayPause;
    window.playerSeek = seekBy;
    window.playerOpenModal = openModalSheet;
    window.playerCloseModal = closeModalSheet;

    showHUD();
}
