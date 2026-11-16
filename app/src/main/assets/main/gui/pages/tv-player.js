import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { EpgManager } from '../../logic/livetv/epg-manager.js';
import { Toast } from '../js/toast.js';
import { LiveStreamEngine } from '../../logic/livetv/core/live-stream-engine.js';
import { escapeHtml, isSafeMediaUrl } from '../js/utils/sanitize.js';

let overlayTimeout;
let zappingHudTimeout;
let zapDebounceTimer = null;
let playerEngine = null;
let epgRequestId = 0;

/**
 * Formats a raw semicolon- or colon-delimited IPTV category string into a single clean primary category label.
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
 * Initializes the compact fullscreen Live TV player with strictly 4 OSD items:
 * top-left Back, top-right Settings (opening dynamic Stream Options), bottom channel icon,
 * and channel name with optional EPG program underneath (blank when unavailable).
 * @param {Object} params - Dynamic route parameters including video URL and metadata.
 */
export async function init(params) {
    const video = document.getElementById('tv-video');
    const title = document.getElementById('tv-title');
    const channelLogo = document.getElementById('tv-channel-logo');
    const overlay = document.getElementById('tv-overlay');
    const loader = document.getElementById('tv-loading');
    const backBtn = document.getElementById('tv-back-btn') || document.getElementById('tv-back');
    const settingsBtn = document.getElementById('tv-settings-btn');
    const settingsPanel = document.getElementById('tv-settings-panel');
    const settingsCloseBtn = document.getElementById('tv-settings-close');
    const settingsOptionsEl = document.getElementById('tv-settings-options');
    const zappingHud = document.getElementById('tv-zapping-hud');
    const zappingName = document.getElementById('zapping-channel-name');
    const retryBtn = document.getElementById('tv-retry-btn');
    const offlineFallback = document.getElementById('tv-offline-fallback');

    let currentStreamUrl = '';
    const aspectModes = ['contain', 'cover', 'fill'];
    let currentAspectIndex = 0;

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
     * Safely updates the bottom channel profile/icon image with fallback.
     * @param {string} logoUrl - Candidate channel logo URL.
     */
    function updateChannelLogo(logoUrl) {
        if (!channelLogo) return;
        const safeUrl = isSafeMediaUrl(logoUrl) ? logoUrl : 'images/livetv.svg';
        channelLogo.onerror = () => {
            channelLogo.onerror = null;
            channelLogo.src = 'images/livetv.svg';
        };
        channelLogo.src = safeUrl;
    }

    /**
     * Checks whether the Stream Options panel is currently visible.
     * @returns {boolean} True if #tv-settings-panel is open.
     */
    function isSettingsPanelOpen() {
        return Boolean(settingsPanel && !settingsPanel.classList.contains('hidden'));
    }

    /**
     * Closes the Stream Options panel and clears auto-hide timer suspension.
     * @param {boolean} [restoreFocus=false] - Whether to return spatial focus to #tv-settings-btn.
     */
    function closeSettingsPanel(restoreFocus = false) {
        if (!settingsPanel) return;
        settingsPanel.classList.add('hidden');
        if (restoreFocus && settingsBtn) {
            SpatialNav.setFocus(settingsBtn);
        }
        resetOverlayTimer();
    }

    /**
     * Renders dynamic Stream Options (Quality, Audio, Subtitles when available, plus Aspect Ratio)
     * inside #tv-settings-options.
     */
    function renderSettingsPanel() {
        if (!settingsOptionsEl) return;
        const t = (key, fallback) => window.i18n?.t(key) || fallback;
        const opts = playerEngine ? playerEngine.getStreamOptions() : {
            qualities: [], currentQuality: -1,
            audioTracks: [], currentAudioTrack: -1,
            subtitleTracks: [], currentSubtitleTrack: -1
        };

        /**
         * Builds a single full-width sidebar option row without overlapping indicator artifacts.
         * @param {string} kind - Option category ('quality'|'audio'|'subtitle'|'aspect').
         * @param {number} value - Option value index.
         * @param {string} label - Localized option label.
         * @param {boolean} isActive - Whether this option is currently active.
         * @returns {string} HTML string for the option button.
         */
        const buildOptionRow = (kind, value, label, isActive) => (
            `<button type="button" class="tv-opt-btn focusable universal-onclick ${isActive ? 'is-active' : ''}" data-kind="${kind}" data-value="${value}">` +
                `<span class="tv-opt-label">${escapeHtml(label)}</span>` +
                `<span class="tv-opt-check" aria-hidden="true"></span>` +
            `</button>`
        );

        const groups = [];

        if (opts.qualities.length > 0) {
            const buttons = [
                buildOptionRow('quality', -1, t('livetv.auto', 'Auto'), opts.currentQuality === -1)
            ].concat(opts.qualities.map(q =>
                buildOptionRow('quality', q.index, q.label, opts.currentQuality === q.index)
            ));
            groups.push(`<div class="tv-settings-group"><span class="tv-settings-label">${escapeHtml(t('livetv.quality', 'Quality'))}</span><div class="tv-settings-choices">${buttons.join('')}</div></div>`);
        }

        if (opts.audioTracks.length > 0) {
            const buttons = opts.audioTracks.map(a =>
                buildOptionRow('audio', a.index, a.label, opts.currentAudioTrack === a.index)
            );
            groups.push(`<div class="tv-settings-group"><span class="tv-settings-label">${escapeHtml(t('livetv.audioTrack', 'Audio'))}</span><div class="tv-settings-choices">${buttons.join('')}</div></div>`);
        }

        if (opts.subtitleTracks.length > 0) {
            const buttons = [
                buildOptionRow('subtitle', -1, t('livetv.off', 'Off'), opts.currentSubtitleTrack === -1)
            ].concat(opts.subtitleTracks.map(s =>
                buildOptionRow('subtitle', s.index, s.label, opts.currentSubtitleTrack === s.index)
            ));
            groups.push(`<div class="tv-settings-group"><span class="tv-settings-label">${escapeHtml(t('livetv.subtitles', 'Subtitles'))}</span><div class="tv-settings-choices">${buttons.join('')}</div></div>`);
        }

        const aspectLabelKeys = {
            contain: ['livetv.aspectContain', 'Contain'],
            cover: ['livetv.aspectCover', 'Cover'],
            fill: ['livetv.aspectFill', 'Fill']
        };
        const aspectButtons = aspectModes.map((mode, idx) => {
            const [key, fallback] = aspectLabelKeys[mode] || ['', mode];
            const label = key ? t(key, fallback) : fallback;
            return buildOptionRow('aspect', idx, label, currentAspectIndex === idx);
        });
        groups.push(`<div class="tv-settings-group"><span class="tv-settings-label">${escapeHtml(t('livetv.aspectRatio', 'Aspect Ratio'))}</span><div class="tv-settings-choices">${aspectButtons.join('')}</div></div>`);

        settingsOptionsEl.innerHTML = groups.join('');
        if (settingsPanel) {
            SpatialNav.ensureTabindex(settingsPanel);
        }

        settingsOptionsEl.querySelectorAll('.tv-opt-btn').forEach((btn) => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const kind = btn.dataset.kind;
                const val = Number(btn.dataset.value);
                if (kind === 'quality' && playerEngine) {
                    playerEngine.setQualityLevel(val);
                } else if (kind === 'audio' && playerEngine) {
                    playerEngine.setAudioTrack(val);
                } else if (kind === 'subtitle' && playerEngine) {
                    playerEngine.setSubtitleTrack(val);
                } else if (kind === 'aspect') {
                    currentAspectIndex = Math.max(0, Math.min(aspectModes.length - 1, val));
                    if (video) video.style.objectFit = aspectModes[currentAspectIndex];
                }
                renderSettingsPanel();
                const selector = `.tv-opt-btn[data-kind="${kind}"][data-value="${val}"]`;
                const nextFocus = settingsOptionsEl.querySelector(selector);
                if (nextFocus) SpatialNav.setFocus(nextFocus);
            };
        });
    }

    /**
     * Re-renders the open Stream Options panel and restores spatial focus onto the active option.
     */
    function refreshSettingsPanelPreservingFocus() {
        if (!isSettingsPanelOpen() || !settingsOptionsEl) return;
        const activeBtn = settingsOptionsEl.querySelector('.tv-opt-btn.focused');
        const kind = activeBtn?.dataset.kind;
        const val = activeBtn?.dataset.value;
        renderSettingsPanel();
        const selector = kind && val !== undefined ? `.tv-opt-btn[data-kind="${kind}"][data-value="${val}"]` : '';
        const target = (selector && settingsOptionsEl.querySelector(selector))
            || settingsOptionsEl.querySelector('.tv-opt-btn.focusable');
        if (target) SpatialNav.setFocus(target);
    }

    /**
     * Toggles the Stream Options panel visibility and focuses its first option when opened.
     */
    function toggleSettingsPanel() {
        if (!settingsPanel) return;
        if (isSettingsPanelOpen()) {
            closeSettingsPanel(true);
            return;
        }
        clearTimeout(overlayTimeout);
        renderSettingsPanel();
        settingsPanel.classList.remove('hidden');
        const firstOpt = settingsPanel.querySelector('.tv-opt-btn.focusable');
        if (firstOpt) {
            SpatialNav.setFocus(firstOpt);
        }
    }

    /**
     * Updates the optional program label under #tv-title; leaves it empty and hidden when unavailable.
     * @param {string} channelName - The current channel name.
     * @param {string} channelGroup - The category or group string.
     * @param {string} [tvgId] - Optional EPG identifier.
     */
    async function updateEpgInfo(channelName, channelGroup, tvgId = '') {
        const tvEpgEl = document.getElementById('tv-epg');
        const requestId = ++epgRequestId;
        if (!tvEpgEl) return;

        tvEpgEl.textContent = '';
        tvEpgEl.classList.add('hidden');

        const epg = await EpgManager.getCurrentProgram(channelName, channelGroup, tvgId);
        if (requestId !== epgRequestId) return;

        if (epg && epg.hasData && epg.title) {
            tvEpgEl.textContent = `${epg.title} (${epg.start} – ${epg.end})`;
            tvEpgEl.classList.remove('hidden');
        } else {
            tvEpgEl.textContent = '';
            tvEpgEl.classList.add('hidden');
        }
    }

    if (playerEngine) {
        playerEngine.destroy();
    }

    playerEngine = new LiveStreamEngine(video, {
        isPreview: false,
        onLoading: () => {
            if (offlineFallback) offlineFallback.classList.add('hidden');
            if (loader) {
                loader.classList.remove('hidden');
                loader.style.display = 'flex';
            }
        },
        onPlaying: () => {
            if (offlineFallback) offlineFallback.classList.add('hidden');
            if (loader) {
                loader.classList.add('hidden');
                loader.style.display = 'none';
            }
            refreshSettingsPanelPreservingFocus();
        },
        onTracksUpdated: () => {
            refreshSettingsPanelPreservingFocus();
        },
        onOffline: () => {
            if (loader) {
                loader.classList.add('hidden');
                loader.style.display = 'none';
            }
            if (offlineFallback) offlineFallback.classList.remove('hidden');
            const msg = window.i18n?.t('livetv.streamOffline') || 'Stream is currently offline. Try another channel or retry.';
            Toast.show(msg, { type: 'warning' });
            showOverlay(true);
        }
    });

    /**
     * Loads the given channel or URL via the Multi-Stage Smart LiveStreamEngine.
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

    const app = document.getElementById('app');
    if (app) app.classList.add('fullscreen-layout');

    if (window.i18n) window.i18n.applyTranslations();
    EpgManager.init();

    const activeChannel = getCurrentChannel();
    if (title) title.textContent = params.title || activeChannel?.name || '';
    updateChannelLogo(params.logo || activeChannel?.logo || '');
    updateEpgInfo(params.title || activeChannel?.name || '', params.group || '', params.tvgId || activeChannel?.tvgId || '');

    if (params.url) {
        const initialChannel = activeChannel || {
            url: params.url,
            name: params.title || 'Live TV',
            logo: params.logo || '',
            group: params.group || 'Live TV',
            tvgId: params.tvgId || '',
            headers: params.headers || {}
        };
        loadStream(initialChannel, initialChannel.headers || params.headers);
    }

    /**
     * Toggles playback between paused and playing states for hardware media keys.
     */
    function togglePlayPause() {
        if (!video) return;
        if (video.paused) {
            video.play().catch(() => {
                const ch = getCurrentChannel();
                loadStream(ch || currentStreamUrl, ch?.headers);
            });
        } else {
            video.pause();
        }
        showOverlay(false);
    }

    if (settingsBtn) {
        settingsBtn.onclick = (e) => {
            e.stopPropagation();
            toggleSettingsPanel();
        };
    }

    if (settingsCloseBtn) {
        settingsCloseBtn.onclick = (e) => {
            e.stopPropagation();
            closeSettingsPanel(true);
        };
    }

    if (retryBtn) {
        retryBtn.onclick = (e) => {
            e.stopPropagation();
            const ch = getCurrentChannel();
            loadStream(ch || currentStreamUrl, ch?.headers);
        };
    }

    if (backBtn) {
        backBtn.onclick = (e) => {
            e.stopPropagation();
            exitPlayer();
        };
    }

    const tvPlayerBackHandler = () => {
        if (SpatialNav.currentPageLogic && typeof SpatialNav.currentPageLogic.handleBack === 'function') {
            if (SpatialNav.currentPageLogic.handleBack()) return true;
        }
        exitPlayer();
        return true;
    };
    SpatialNav.pushBackHandler(tvPlayerBackHandler);

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
     * Resets the 4-second auto-hide timer when the settings panel is closed.
     */
    function resetOverlayTimer() {
        clearTimeout(overlayTimeout);
        if (isSettingsPanelOpen()) return;
        overlayTimeout = setTimeout(() => {
            hideOverlay();
        }, 4000);
    }

    /**
     * Shows the TV controls overlay and focuses #tv-retry-btn (if offline) or #tv-settings-btn.
     * @param {boolean} [shouldFocus=true] - Whether to focus an interactive button on the overlay.
     */
    const showOverlay = (shouldFocus = true) => {
        const wasHidden = overlay && !overlay.classList.contains('show');
        if (overlay) overlay.classList.add('show');

        if (shouldFocus) {
            const hasFocusedInside = overlay && overlay.querySelector('.focused');
            if (wasHidden || !hasFocusedInside) {
                const retryTarget = (retryBtn && offlineFallback && !offlineFallback.classList.contains('hidden')) ? retryBtn : null;
                const target = retryTarget || settingsBtn || backBtn;
                if (target) {
                    SpatialNav.setFocus(target);
                }
            }
        } else if (wasHidden && overlay) {
            overlay.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
        }

        resetOverlayTimer();
    };

    /**
     * Hides the TV controls overlay and settings panel immediately.
     */
    const hideOverlay = () => {
        clearTimeout(overlayTimeout);
        if (settingsPanel) settingsPanel.classList.add('hidden');
        if (overlay) {
            overlay.classList.remove('show');
            overlay.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
            if (document.activeElement && overlay.contains(document.activeElement)) {
                document.activeElement.blur();
            }
        }
    };

    /**
     * Switches channel by direction delta (-1 previous, +1 next) with rapid-zap debounce.
     * @param {number} direction - Direction modifier (-1 UP/Prev, +1 DOWN/Next).
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

        if (zappingHud && zappingName) {
            zappingName.textContent = nextChannel.name || '';
            zappingHud.classList.remove('hidden');
            zappingHud.style.display = 'flex';

            clearTimeout(zappingHudTimeout);
            zappingHudTimeout = setTimeout(() => {
                zappingHud.classList.add('hidden');
                zappingHud.style.display = 'none';
            }, 2500);
        }

        if (title) title.textContent = nextChannel.name || '';
        updateChannelLogo(nextChannel.logo || '');
        const tvEpgEl = document.getElementById('tv-epg');
        if (tvEpgEl) {
            tvEpgEl.textContent = '';
            tvEpgEl.classList.add('hidden');
        }
        if (offlineFallback) offlineFallback.classList.add('hidden');

        if (zapDebounceTimer) {
            clearTimeout(zapDebounceTimer);
        }
        zapDebounceTimer = setTimeout(() => {
            zapDebounceTimer = null;
            updateEpgInfo(nextChannel.name, nextChannel.group || '', nextChannel.tvgId || '');
            loadStream(nextChannel, nextChannel.headers);
        }, 250);

        showOverlay(false);
    };

    /**
     * Reveals overlay on pointer movement without stealing focus.
     */
    const mousemoveHandler = () => {
        showOverlay(false);
    };

    /**
     * Toggles overlay visibility when tapping the video surface on touch/pointer devices.
     */
    const videoTapHandler = () => {
        if (isSettingsPanelOpen()) {
            closeSettingsPanel(false);
            return;
        }
        if (overlay && overlay.classList.contains('show')) {
            hideOverlay();
        } else {
            showOverlay(false);
        }
    };

    if (window.tvPlayerCleanups) {
        window.tvPlayerCleanups();
    }

    window.addEventListener('mousemove', mousemoveHandler);
    if (video) video.addEventListener('click', videoTapHandler);
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) videoTapHandler();
        });
    }

    window.tvZapChannel = (dir) => switchChannel(dir);
    window.tvSwitchChannel = (dir) => switchChannel(dir);
    window.tvPlayPause = () => togglePlayPause();
    window.tvShowOverlay = (shouldFocus = true) => showOverlay(shouldFocus);
    window.tvHideOverlay = () => hideOverlay();
    window.tvResetOverlayTimer = () => resetOverlayTimer();
    window.tvIsOverlayVisible = () => overlay && overlay.classList.contains('show');
    window.tvIsSettingsOpen = () => isSettingsPanelOpen();
    window.tvCloseSettingsPanel = (restoreFocus = true) => closeSettingsPanel(restoreFocus);

    window.tvPlayerCleanups = () => {
        window.removeEventListener('mousemove', mousemoveHandler);
        if (video) video.removeEventListener('click', videoTapHandler);
        if (tvPlayerBackHandler) {
            SpatialNav.popBackHandler(tvPlayerBackHandler);
        }
        clearTimeout(overlayTimeout);
        clearTimeout(zappingHudTimeout);
        if (zapDebounceTimer) {
            clearTimeout(zapDebounceTimer);
            zapDebounceTimer = null;
        }
        if (playerEngine) {
            playerEngine.destroy();
            playerEngine = null;
        }

        delete window.tvZapChannel;
        delete window.tvSwitchChannel;
        delete window.tvPlayPause;
        delete window.tvShowOverlay;
        delete window.tvHideOverlay;
        delete window.tvResetOverlayTimer;
        delete window.tvIsOverlayVisible;
        delete window.tvIsSettingsOpen;
        delete window.tvCloseSettingsPanel;
    };

    showOverlay(true);
}
