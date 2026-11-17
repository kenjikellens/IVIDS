import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { EpgManager } from '../../logic/livetv/epg-manager.js';
import { Toast } from '../js/toast.js';
import { LiveStreamEngine } from '../../logic/livetv/core/live-stream-engine.js';
import { escapeHtml, isSafeMediaUrl } from '../js/utils/sanitize.js';
import { StreamOptionsDrawer } from '../js/utils/stream-options-drawer.js';
import I18n from '../js/i18n.js';

let overlayTimeout;
let zappingHudTimeout;
let zapDebounceTimer = null;
let playerEngine = null;
let epgRequestId = 0;

/**
 * Resolves a human-readable track label localized into the active UI language.
 * @param {Object} track - Track descriptor with optional label, lang code, and trackNumber.
 * @param {string} kindKey - i18n key prefix for numbered fallback ('livetv.audioTrack'|'livetv.subtitles').
 * @returns {string} Localized track label.
 */
function formatLocalizedTrackLabel(track, kindKey) {
    if (track?.label) return track.label;
    if (track?.lang && typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function') {
        try {
            const dn = new Intl.DisplayNames([I18n.currentLanguage || 'en'], { type: 'language' });
            const resolved = dn.of(track.lang);
            if (resolved) return resolved;
        } catch (_) {
            // Fall through to track number label when tag is non-standard
        }
        return track.lang;
    }
    return `${I18n.t(kindKey)} ${track?.trackNumber || 1}`;
}

/**
 * Formats a raw semicolon- or colon-delimited IPTV category string into a single clean primary category label.
 * @param {string} groupStr - Raw category or group string from the channel metadata.
 * @returns {string} Clean primary category name.
 */
export function formatPrimaryCategory(groupStr) {
    const defaultLabel = I18n.t('livetv.title');
    if (!groupStr || typeof groupStr !== 'string') return defaultLabel;
    const parts = groupStr
        .split(/[;|]/)
        .map(part => part.replace(/:/g, ' ').trim())
        .filter(Boolean);
    return parts.length > 0 ? parts[0] : defaultLabel;
}

/**
 * Initializes the compact fullscreen Live TV player with strictly 4 OSD items:
 * top-left Back, top-right Settings (opening dynamic Stream Options), bottom channel icon,
 * and channel name with optional EPG program underneath (blank when unavailable).
 * @param {Object} params - Dynamic route parameters including video URL and metadata.
 */
export async function init(params) {
    await I18n.init();

    const video = document.getElementById('tv-video');
    const title = document.getElementById('tv-title');
    const channelLogo = document.getElementById('tv-channel-logo');
    const overlay = document.getElementById('tv-overlay');
    const loader = document.getElementById('tv-loading');
    const backBtn = document.getElementById('tv-back-btn') || document.getElementById('tv-back');
    const settingsBtn = document.getElementById('tv-settings-btn');
    const settingsPanel = document.getElementById('tv-settings-panel');
    const settingsBackBtn = document.getElementById('tv-settings-back');
    const settingsTitleEl = document.getElementById('tv-settings-title');
    const settingsOptionsEl = document.getElementById('tv-settings-options');
    let settingsDrawer = null;
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

    /** Checks whether the Stream Options panel is currently visible. */
    function isSettingsPanelOpen() {
        return Boolean(settingsDrawer && settingsDrawer.isOpen());
    }

    /** Closes the Stream Options sidebar, resets submenu depth, and optionally restores focus. */
    function closeSettingsPanel(restoreFocus = false) {
        settingsDrawer?.close(restoreFocus);
    }

    /** Returns from a Stream Options submenu back to the root category menu, or closes if at root. */
    function navigateSettingsBack() {
        if (!settingsDrawer) return false;
        const handled = settingsDrawer.navigateBack();
        if (handled) resetOverlayTimer();
        return handled;
    }

    /**
     * Builds the structured category descriptors and current values available for this stream.
     * @returns {Array<Object>} Available stream option categories.
     */
    function getAvailableCategories() {
        const opts = playerEngine ? playerEngine.getStreamOptions() : {
            qualities: [], currentQuality: -1,
            audioTracks: [], currentAudioTrack: -1,
            subtitleTracks: [], currentSubtitleTrack: -1
        };

        const categories = [];

        if (opts.qualities.length > 0) {
            const currentItem = opts.qualities.find(q => q.index === opts.currentQuality);
            const currentLabel = opts.currentQuality === -1
                ? I18n.t('livetv.auto')
                : (currentItem?.label || I18n.t('livetv.auto'));
            categories.push({
                key: 'quality',
                label: I18n.t('livetv.quality'),
                currentValue: currentLabel,
                options: [{ value: -1, label: I18n.t('livetv.auto'), isActive: opts.currentQuality === -1, onPick: () => playerEngine?.setQualityLevel(-1) }]
                    .concat(opts.qualities.map(q => ({
                        value: q.index,
                        label: q.label,
                        isActive: opts.currentQuality === q.index,
                        onPick: () => playerEngine?.setQualityLevel(q.index)
                    })))
            });
        }

        if (opts.audioTracks.length > 0) {
            const localizedAudio = opts.audioTracks.map(a => ({
                index: a.index,
                label: formatLocalizedTrackLabel(a, 'livetv.audioTrack'),
                isActive: opts.currentAudioTrack === a.index
            }));
            const currentItem = localizedAudio.find(a => a.isActive) || localizedAudio[0];
            categories.push({
                key: 'audio',
                label: I18n.t('livetv.audioTrack'),
                currentValue: currentItem?.label || '',
                options: localizedAudio.map(a => ({
                    value: a.index,
                    label: a.label,
                    isActive: a.isActive,
                    onPick: () => playerEngine?.setAudioTrack(a.index)
                }))
            });
        }

        if (opts.subtitleTracks.length > 0) {
            const localizedSubs = opts.subtitleTracks.map(s => ({
                index: s.index,
                label: formatLocalizedTrackLabel(s, 'livetv.subtitles'),
                isActive: opts.currentSubtitleTrack === s.index
            }));
            const currentItem = localizedSubs.find(s => s.isActive);
            const currentLabel = opts.currentSubtitleTrack === -1
                ? I18n.t('livetv.off')
                : (currentItem?.label || I18n.t('livetv.off'));
            categories.push({
                key: 'subtitle',
                label: I18n.t('livetv.subtitles'),
                currentValue: currentLabel,
                options: [{ value: -1, label: I18n.t('livetv.off'), isActive: opts.currentSubtitleTrack === -1, onPick: () => playerEngine?.setSubtitleTrack(-1) }]
                    .concat(localizedSubs.map(s => ({
                        value: s.index,
                        label: s.label,
                        isActive: s.isActive,
                        onPick: () => playerEngine?.setSubtitleTrack(s.index)
                    })))
            });
        }

        const aspectLabelKeys = {
            contain: 'livetv.aspectContain',
            cover: 'livetv.aspectCover',
            fill: 'livetv.aspectFill'
        };
        const currentAspectMode = aspectModes[currentAspectIndex] || 'contain';
        const curKey = aspectLabelKeys[currentAspectMode];
        categories.push({
            key: 'aspect',
            label: I18n.t('livetv.aspectRatio'),
            currentValue: curKey ? I18n.t(curKey) : currentAspectMode,
            options: aspectModes.map((mode, idx) => ({
                value: idx,
                label: aspectLabelKeys[mode] ? I18n.t(aspectLabelKeys[mode]) : mode,
                isActive: currentAspectIndex === idx,
                onPick: () => {
                    currentAspectIndex = Math.max(0, Math.min(aspectModes.length - 1, idx));
                    if (video) video.style.objectFit = aspectModes[currentAspectIndex];
                }
            }))
        });

        return categories;
    }

    settingsDrawer = new StreamOptionsDrawer({
        panelEl: settingsPanel,
        titleEl: settingsTitleEl,
        optionsEl: settingsOptionsEl,
        backBtnEl: settingsBackBtn,
        anchorBtnEl: settingsBtn,
        getCategories: getAvailableCategories,
        getRootTitle: () => I18n.t('livetv.streamOptions'),
        useModalClass: false,
        itemBaseClass: 'tv-opt-btn',
        onOpen: () => clearTimeout(overlayTimeout),
        onClose: () => resetOverlayTimer(),
        onRender: (activeCategory) => {
            if (settingsBackBtn) {
                const backLabel = activeCategory ? I18n.t('details.back') : I18n.t('livetv.close');
                settingsBackBtn.setAttribute('aria-label', backLabel);
                settingsBackBtn.setAttribute('title', backLabel);
            }
        }
    });

    /** Renders Stream Options drawer content. */
    function renderSettingsPanel() {
        settingsDrawer.render();
    }

    /**
     * Re-renders the open Stream Options sidebar and preserves spatial focus on the current item.
     */
    function refreshSettingsPanelPreservingFocus() {
        if (!isSettingsPanelOpen() || !settingsOptionsEl) return;
        const activeBtn = settingsOptionsEl.querySelector('.tv-opt-btn.focused');
        const kind = activeBtn?.dataset.kind;
        const val = activeBtn?.dataset.value;
        const sub = activeBtn?.dataset.submenu;
        renderSettingsPanel();
        let selector = '';
        if (sub) {
            selector = `.tv-opt-btn[data-submenu="${sub}"]`;
        } else if (kind && val !== undefined) {
            selector = `.tv-opt-btn[data-kind="${kind}"][data-value="${val}"]`;
        }
        const target = (selector && settingsOptionsEl.querySelector(selector))
            || settingsOptionsEl.querySelector('.tv-opt-btn.focusable');
        if (target) SpatialNav.setFocus(target);
    }

    /** Opens or closes the Stream Options sidebar starting at the root category list. */
    function toggleSettingsPanel() {
        settingsDrawer.toggle();
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
            Toast.show(I18n.t('livetv.streamOffline'), { type: 'warning' });
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
            : (getCurrentChannel() || { url: channelOrUrl, name: title?.textContent || I18n.t('livetv.title'), headers: channelHeaders || {} });

        currentStreamUrl = channelObj.url || (typeof channelOrUrl === 'string' ? channelOrUrl : '');
        if (playerEngine) {
            playerEngine.loadChannel(channelObj, channelHeaders || channelObj.headers);
        }
    }

    const app = document.getElementById('app');
    if (app) app.classList.add('fullscreen-layout');

    I18n.applyTranslations();
    if (backBtn) backBtn.setAttribute('title', I18n.t('details.back'));
    if (settingsBtn) settingsBtn.setAttribute('title', I18n.t('livetv.streamOptions'));
    if (settingsPanel) settingsPanel.setAttribute('aria-label', I18n.t('livetv.streamOptions'));
    EpgManager.init();

    const activeChannel = getCurrentChannel();
    if (title) title.textContent = params.title || activeChannel?.name || '';
    updateChannelLogo(params.logo || activeChannel?.logo || '');
    updateEpgInfo(params.title || activeChannel?.name || '', params.group || '', params.tvgId || activeChannel?.tvgId || '');

    if (params.url) {
        const initialChannel = activeChannel || {
            url: params.url,
            name: params.title || I18n.t('livetv.title'),
            logo: params.logo || '',
            group: params.group || I18n.t('livetv.title'),
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

    if (settingsBackBtn) {
        settingsBackBtn.onclick = (e) => {
            e.stopPropagation();
            navigateSettingsBack();
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
    window.tvSettingsBack = () => navigateSettingsBack();

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
        delete window.tvSettingsBack;
    };

    showOverlay(true);
}
