import { M3UParser } from '../../logic/m3u-parser.js';
import { PRESET_SOURCES } from '../../logic/livetv/sources.js';
import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';

let allChannels = [];
let filteredChannels = [];
let searchQuery = '';
let selectedChannel = null;
let hideBroken = false;
const statusCache = new Map(); // Store channel status results: url -> {status, timestamp}

export async function init(params) {
    console.log('Live TV Grid UI initializing...');

    if (window.i18n) window.i18n.applyTranslations();

    await loadAllSources();

    setupEventListeners();
    SpatialNav.focusFirst();
}

async function loadAllSources() {
    const loading = document.getElementById('loading-channels');
    const empty = document.getElementById('no-channels-message');
    const grid = document.getElementById('channels-grid');
    const countEl = document.getElementById('hero-count-info');

    try {
        if (loading) loading.style.display = 'flex';
        if (empty) empty.style.display = 'none';
        if (grid) grid.innerHTML = '';
        if (countEl) countEl.textContent = 'Loading sources...';

        const sourceEntries = Object.entries(PRESET_SOURCES);
        const settings = JSON.parse(localStorage.getItem('ivids-settings') || '{}');
        if (settings.m3uUrl) {
            sourceEntries.push(['custom', { name: 'Custom Playlist', url: settings.m3uUrl }]);
        }

        allChannels = [];
        const seenUrls = new Set();
        let loadedCount = 0;

        // Fetch sequentially to avoid network issues and show progress
        for (const [id, source] of sourceEntries) {
            try {
                if (countEl) countEl.textContent = `Loading ${source.name}... (${loadedCount} channels)`;
                console.log(`Fetching ${source.name}: ${source.url}`);

                const playlistChannels = await M3UParser.fetchPlaylist(source.url);

                if (playlistChannels && playlistChannels.length > 0) {
                    // Enrich channels with source group if missing
                    playlistChannels.forEach(c => {
                        if (!c.group) c.group = source.name;

                        if (!seenUrls.has(c.url)) {
                            seenUrls.add(c.url);
                            allChannels.push(c);
                            loadedCount++;
                        }
                    });

                    // Partial render every few sources to show activity
                    if (allChannels.length > 0 && (loadedCount % 50 === 0 || id === sourceEntries[sourceEntries.length - 1][0])) {
                        filterAndRenderChannels(false); // Quick render without resetting focus
                    }
                }
            } catch (err) {
                console.warn(`Failed to load source ${source.name}:`, err);
            }
        }

        allChannels.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: 'base' }));

        if (loading) loading.style.display = 'none';

        if (allChannels.length === 0) {
            if (empty) empty.style.display = 'flex';
            if (countEl) countEl.textContent = 'No channels found';
        } else {
            if (countEl) countEl.textContent = `${loadedCount} channels processed`;
            // Only focus first if no element is currently focused
            const currentFocused = document.querySelector('.focused');
            filterAndRenderChannels(!currentFocused);
        }
    } catch (error) {
        console.error('Error loading sources:', error);
        if (loading) loading.style.display = 'none';
        if (empty) empty.style.display = 'flex';
    }
}

function filterAndRenderChannels(resetFocus = false) {
    const container = document.getElementById('channels-grid');
    if (!container) return;

    // Cache current focused element URL to restore focus if needed
    const currentFocused = document.querySelector('.focused');
    const focusedUrl = currentFocused && currentFocused.dataset.url;

    container.innerHTML = '';

    filteredChannels = allChannels.filter(c => {
        const matchesSearch = !searchQuery || (c.name || "").toLowerCase().includes(searchQuery.toLowerCase());
        const isNotBroken = !hideBroken || (statusCache.get(c.url)?.status !== 'offline');
        return matchesSearch && isNotBroken;
    });

    filteredChannels.forEach((channel) => {
        const item = document.createElement('div');
        item.className = 'channel-card focusable';
        item.tabIndex = 0;
        item.dataset.url = channel.url; // For focus restoration

        const iconUrl = channel.logo || 'images/livetv.svg';

        item.innerHTML = `
            <img src="${iconUrl}" class="channel-card-logo" onerror="this.src='images/livetv.svg'">
            <span class="channel-card-name">${channel.name}</span>
        `;

        item.onfocus = () => showChannelDetail(channel);
        item.onclick = () => playChannel(channel);

        container.appendChild(item);

        // Restore focus if this item was focused before re-rendering
        if (focusedUrl === channel.url) {
            SpatialNav.setFocus(item);
        }
    });

    const empty = document.getElementById('no-channels-message');
    if (filteredChannels.length === 0) {
        if (empty) empty.style.display = 'flex';
    } else {
        if (empty) empty.style.display = 'none';

        // Final fallback: reset focus if requested and nothing is focused
        if (resetFocus && !document.querySelector('.focused')) {
            SpatialNav.focusFirst();
        }
    }
}

async function showChannelDetail(channel) {
    selectedChannel = channel;
    const placeholder = document.getElementById('hero-placeholder');
    const content = document.getElementById('hero-active-content');

    if (placeholder) placeholder.style.display = 'none';
    if (content) content.style.display = 'flex';

    const logoEl = document.getElementById('hero-logo');
    const nameEl = document.getElementById('hero-name');
    const groupEl = document.getElementById('hero-group');

    if (logoEl) logoEl.src = channel.logo || 'images/livetv.svg';
    if (nameEl) nameEl.textContent = channel.name;
    if (groupEl) groupEl.textContent = channel.group ? channel.group.replace(/:/g, ' ') : '';

    const playBtn = document.getElementById('hero-play-btn');
    if (playBtn) playBtn.onclick = () => playChannel(channel);

    // Dynamic Status Check
    updateStatusBadge('checking');
    const cached = statusCache.get(channel.url);
    if (cached && (Date.now() - cached.timestamp < 300000)) { // 5 min cache
        updateStatusBadge(cached.status);
    } else {
        const status = await checkChannelStatus(channel.url);
        statusCache.set(channel.url, { status, timestamp: Date.now() });
        // Only update if we are still on the same channel
        if (selectedChannel && selectedChannel.url === channel.url) {
            updateStatusBadge(status);
        }
    }
}

function updateStatusBadge(status) {
    const badge = document.getElementById('hero-status');
    if (!badge) return;

    badge.className = `status-badge ${status}`;
    const text = badge.querySelector('.status-text');

    if (status === 'checking') text.textContent = window.i18n?.t('livetv.checking') || 'Checking...';
    else if (status === 'online') text.textContent = window.i18n?.t('livetv.online') || 'Online';
    else if (status === 'offline') text.textContent = window.i18n?.t('livetv.unavailable') || 'Unavailable';
}

async function checkChannelStatus(url) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'Range': 'bytes=0-0' }
        });

        clearTimeout(timeoutId);
        return response.ok ? 'online' : 'offline';
    } catch (e) {
        if (e.name === 'AbortError') return 'offline';
        return 'online';
    }
}

function playChannel(channel) {
    Router.loadPage('tv-player', {
        url: channel.url,
        title: channel.name,
        group: channel.group
    });
}

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const filterBtn = document.getElementById('hero-filter-btn');

    // Override global back to focus search first if result is focused
    const originalBack = SpatialNav.onBack;
    SpatialNav.onBack = () => {
        const current = document.querySelector('.focused');
        const grid = document.getElementById('channels-grid');

        if (current && grid && grid.contains(current) && searchInput) {
            SpatialNav.setFocus(searchInput);
        } else if (originalBack) {
            originalBack();
        }
    };

    if (searchInput) {
        searchInput.oninput = (e) => {
            searchQuery = e.target.value;
            filterAndRenderChannels(false); // Never reset focus during typing
        };

        searchInput.onclick = () => {
            searchInput.readOnly = false;
            searchInput.focus();
        };

        searchInput.onblur = () => {
            searchInput.readOnly = true;
        };
    }

    if (filterBtn) {
        filterBtn.onclick = () => {
            hideBroken = !hideBroken;
            filterBtn.classList.toggle('active', hideBroken);
            // Apply a visual state to the button
            if (hideBroken) {
                filterBtn.style.borderColor = 'var(--primary-color)';
                filterBtn.style.color = 'var(--primary-color)';
            } else {
                filterBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                filterBtn.style.color = 'white';
            }
            filterAndRenderChannels();
        };
    }
}
