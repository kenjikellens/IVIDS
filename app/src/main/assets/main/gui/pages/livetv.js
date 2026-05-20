import { M3UParser } from '../../logic/m3u-parser.js';
import { PRESET_SOURCES } from '../../logic/livetv/sources.js';
import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { EpgManager } from '../../logic/livetv/epg-manager.js';

let allChannels = [];
let filteredChannels = [];
let searchQuery = '';
let selectedChannel = null;
let hideBroken = false;
let activeCategory = 'all';
let categories = [];
const statusCache = new Map(); // Store channel status results: url -> {status, timestamp}

/**
 * init function
 * =============
 * Explains: Initializes the Live TV grid page, loads translation mappings,
 * loads M3U playlists, sets up action listeners, and initiates focus.
 * 
 * @param {object} params - Routing parameters.
 */
export async function init(params) {
    console.log('Live TV Grid UI initializing...');

    // Reset state variables to prevent carry-over from cached ES modules when returning from player
    searchQuery = '';
    activeCategory = 'all';
    selectedChannel = null;
    hideBroken = false;

    if (window.i18n) window.i18n.applyTranslations();

    await loadAllSources();
    setupEventListeners();
    SpatialNav.focusFirst();
}

/**
 * loadAllSources function
 * =======================
 * Explains: Iterates over the preset and custom M3U playlist URLs, fetches their
 * contents, merges duplicates, and triggers rendering of category chips and cards.
 */
async function loadAllSources() {
    const loading = document.getElementById('loading-channels');
    const empty = document.getElementById('no-channels-message');
    const grid = document.getElementById('channels-grid');
    const countEl = document.getElementById('hero-total-channels');

    try {
        if (loading) loading.style.display = 'flex';
        if (empty) empty.style.display = 'none';
        if (grid) grid.innerHTML = '';

        const sourceEntries = Object.entries(PRESET_SOURCES);
        const settings = JSON.parse(localStorage.getItem('ivids-settings') || '{}');
        if (settings.m3uUrl) {
            sourceEntries.push(['custom', { name: 'Custom Playlist', url: settings.m3uUrl }]);
        }

        allChannels = [];
        const seenUrls = new Set();
        let loadedCount = 0;

        for (const [id, source] of sourceEntries) {
            try {
                const playlistChannels = await M3UParser.fetchPlaylist(source.url);

                if (playlistChannels && playlistChannels.length > 0) {
                    playlistChannels.forEach(c => {
                        if (!c.group) c.group = source.name;

                        if (!seenUrls.has(c.url)) {
                            seenUrls.add(c.url);
                            allChannels.push(c);
                            loadedCount++;
                        }
                    });

                    if (allChannels.length > 0 && (loadedCount % 50 === 0 || id === sourceEntries[sourceEntries.length - 1][0])) {
                        filterAndRenderChannels(false);
                    }
                }
            } catch (err) {
                console.warn(`Failed to load source ${source.name}:`, err);
            }
        }

        allChannels.sort((a, b) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: 'base' }));

        if (loading) loading.style.display = 'none';

        // Extract unique categories
        const groupSet = new Set();
        allChannels.forEach(c => {
            if (c.group) groupSet.add(c.group);
        });
        categories = Array.from(groupSet).sort();

        // Render dynamic category filter chips
        renderCategoriesBar();

        // Show stats banner
        const statsInfo = document.getElementById('hero-stats-info');
        const totalSrcEl = document.getElementById('hero-total-sources');
        if (statsInfo && countEl && totalSrcEl) {
            countEl.textContent = `${allChannels.length} channels`;
            totalSrcEl.textContent = `${sourceEntries.length} sources`;
            statsInfo.style.display = 'flex';
        }

        if (allChannels.length === 0) {
            if (empty) empty.style.display = 'flex';
        } else {
            const currentFocused = document.querySelector('.focused');
            filterAndRenderChannels(!currentFocused);
        }
    } catch (error) {
        console.error('Error loading sources:', error);
        if (loading) loading.style.display = 'none';
        if (empty) empty.style.display = 'flex';
    }
}

/**
 * renderCategoriesBar function
 * ============================
 * Explains: Dynamically constructs horizontal category chips with channel counts
 * and binds focus and click event handlers for filtering.
 */
function renderCategoriesBar() {
    const bar = document.getElementById('livetv-categories-bar');
    if (!bar) return;

    bar.innerHTML = '';

    // Create 'All' category chip
    const allChip = document.createElement('button');
    allChip.className = `category-chip focusable ${activeCategory === 'all' ? 'active' : ''}`;
    allChip.tabIndex = 0;
    allChip.innerHTML = `
        <span class="chip-name">${window.i18n?.t('livetv.allCategories') || 'All Categories'}</span>
        <span class="chip-count">${allChannels.length}</span>
    `;
    allChip.onclick = () => selectCategory('all', allChip);
    bar.appendChild(allChip);

    // Create a chip for each unique category group
    categories.forEach(cat => {
        const count = allChannels.filter(c => c.group === cat).length;
        if (count === 0) return;

        const chip = document.createElement('button');
        chip.className = `category-chip focusable ${activeCategory === cat ? 'active' : ''}`;
        chip.tabIndex = 0;
        chip.innerHTML = `
            <span class="chip-name">${cat}</span>
            <span class="chip-count">${count}</span>
        `;
        chip.onclick = () => selectCategory(cat, chip);
        bar.appendChild(chip);
    });
}

/**
 * selectCategory function
 * =======================
 * Explains: Updates the currently active category filter selection state and triggers grid updates.
 * 
 * @param {string} cat - The selected category value.
 * @param {HTMLElement} chipEl - The selected chip element.
 */
function selectCategory(cat, chipEl) {
    activeCategory = cat;
    
    // Toggle active state styling across chips
    const chips = document.querySelectorAll('.category-chip');
    chips.forEach(c => c.classList.remove('active'));
    if (chipEl) chipEl.classList.add('active');

    filterAndRenderChannels(true);
}

/**
 * filterAndRenderChannels function
 * ================================
 * Explains: Filters channels list based on search term, category chips,
 * and broken links hide filter, then constructs grid cards.
 * 
 * @param {boolean} resetFocus - Resets navigation focus to the first card if true.
 */
function filterAndRenderChannels(resetFocus = false) {
    const container = document.getElementById('channels-grid');
    if (!container) return;

    const currentFocused = document.querySelector('.focused');
    const focusedUrl = currentFocused && currentFocused.dataset.url;

    container.innerHTML = '';

    filteredChannels = allChannels.filter(c => {
        const matchesSearch = !searchQuery || (c.name || "").toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = activeCategory === 'all' || c.group === activeCategory;
        const isNotBroken = !hideBroken || (statusCache.get(c.url)?.status !== 'offline');
        return matchesSearch && matchesCategory && isNotBroken;
    });

    // Update shared window state for Zapping features in tv-player page
    window.liveTvState = {
        channels: filteredChannels,
        currentIndex: 0
    };

    // Update search badge counters
    const counter = document.getElementById('search-counter');
    if (counter) {
        counter.textContent = `${filteredChannels.length} / ${allChannels.length}`;
    }

    // Toggle search clear button visibility
    const clearBtn = document.getElementById('search-clear');
    if (clearBtn) {
        clearBtn.style.display = searchQuery ? 'block' : 'none';
    }

    filteredChannels.forEach((channel) => {
        const item = document.createElement('div');
        item.className = 'channel-card focusable';
        item.tabIndex = 0;
        item.dataset.url = channel.url;

        const iconUrl = channel.logo || 'images/livetv.svg';
        const cachedStatus = statusCache.get(channel.url)?.status || 'checking';
        const epg = EpgManager.getCurrentProgram(channel.name, channel.group);

        item.innerHTML = `
            <div class="card-status-dot ${cachedStatus}"></div>
            <div class="channel-card-logo-container">
                <img src="${iconUrl}" class="channel-card-logo" onerror="this.src='images/livetv.svg'">
            </div>
            <div class="channel-card-meta-container">
                <span class="channel-card-name">${channel.name}</span>
                <span class="channel-card-group-tag">${channel.group || ''}</span>
                <!-- EPG Info Block -->
                <div class="channel-card-epg-info">
                    <span class="channel-card-epg-title">${epg.title}</span>
                    <div class="channel-card-epg-progress-container">
                        <div class="channel-card-epg-progress-bar" style="width: ${epg.progress}%"></div>
                    </div>
                </div>
            </div>
        `;

        item.onfocus = () => showChannelDetail(channel);
        item.onclick = () => playChannel(channel);

        container.appendChild(item);

        if (focusedUrl === channel.url) {
            SpatialNav.setFocus(item);
        }
    });

    const empty = document.getElementById('no-channels-message');
    if (filteredChannels.length === 0) {
        if (empty) empty.style.display = 'flex';
    } else {
        if (empty) empty.style.display = 'none';

        if (resetFocus && !document.querySelector('.focused')) {
            SpatialNav.focusFirst();
        }
    }
}

/**
 * showChannelDetail function
 * ==========================
 * Explains: Updates the compact hero dashboard structure to reflect currently focused channel metadata.
 * 
 * @param {object} channel - The selected channel item.
 */
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

    // Update EPG Dashboard Section
    const epg = EpgManager.getCurrentProgram(channel.name, channel.group);
    const epgContainer = document.getElementById('hero-epg-container');
    const epgTitleEl = document.getElementById('hero-epg-title');
    const epgStartEl = document.getElementById('hero-epg-start');
    const epgEndEl = document.getElementById('hero-epg-end');
    const epgProgressEl = document.getElementById('hero-epg-progress');

    if (epgContainer) {
        epgContainer.style.display = 'block';
        if (epgTitleEl) epgTitleEl.textContent = epg.title;
        if (epgStartEl) epgStartEl.textContent = epg.start;
        if (epgEndEl) epgEndEl.textContent = epg.end;
        if (epgProgressEl) epgProgressEl.style.width = `${epg.progress}%`;
    }

    const playBtn = document.getElementById('hero-play-btn');
    if (playBtn) playBtn.onclick = () => playChannel(channel);

    updateStatusBadge('checking');
    const cached = statusCache.get(channel.url);
    if (cached && (Date.now() - cached.timestamp < 300000)) { // 5 min cache
        updateStatusBadge(cached.status);
    } else {
        const status = await checkChannelStatus(channel.url);
        statusCache.set(channel.url, { status, timestamp: Date.now() });
        
        // Update status dot on the card immediately if card exists
        const cards = document.querySelectorAll('.channel-card');
        cards.forEach(card => {
            if (card.dataset.url === channel.url) {
                const dot = card.querySelector('.card-status-dot');
                if (dot) {
                    dot.className = `card-status-dot ${status}`;
                }
            }
        });

        if (selectedChannel && selectedChannel.url === channel.url) {
            updateStatusBadge(status);
        }
    }
}

/**
 * updateStatusBadge function
 * ==========================
 * Explains: Formats the status checking badges and dot colors inside the active hero area.
 * 
 * @param {string} status - Current online, offline, or checking state.
 */
function updateStatusBadge(status) {
    const badge = document.getElementById('hero-status');
    if (!badge) return;

    badge.className = `status-badge ${status}`;
    const text = badge.querySelector('.status-text');

    if (status === 'checking') text.textContent = window.i18n?.t('livetv.checking') || 'Checking...';
    else if (status === 'online') text.textContent = window.i18n?.t('livetv.online') || 'Online';
    else if (status === 'offline') text.textContent = window.i18n?.t('livetv.unavailable') || 'Unavailable';
}

/**
 * checkChannelStatus function
 * ===========================
 * Explains: Performs a lightweight HEAD/GET request with ranges to quickly test link availability.
 * 
 * @param {string} url - Target stream source URL.
 * @returns {string} Status string ('online' or 'offline').
 */
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

/**
 * playChannel function
 * ====================
 * Explains: Records the channel zapping index state variables and routes the app to the TV player.
 * 
 * @param {object} channel - Target channel item.
 */
function playChannel(channel) {
    const index = filteredChannels.findIndex(c => c.url === channel.url);
    window.liveTvState = {
        channels: filteredChannels,
        currentIndex: index >= 0 ? index : 0
    };

    Router.loadPage('tv-player', {
        url: channel.url,
        title: channel.name,
        group: channel.group
    });
}

/**
 * setupEventListeners function
 * ============================
 * Explains: Hooks UI element events including search box typing, clearing input,
 * category selection, and custom back handling.
 */
function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const filterBtn = document.getElementById('hero-filter-btn');
    const clearBtn = document.getElementById('search-clear');

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
            filterAndRenderChannels(false);
        };

        searchInput.onclick = () => {
            searchInput.readOnly = false;
            searchInput.focus();
        };

        searchInput.onblur = () => {
            searchInput.readOnly = true;
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            searchQuery = '';
            if (searchInput) {
                searchInput.value = '';
            }
            filterAndRenderChannels(true);
            if (searchInput) {
                SpatialNav.setFocus(searchInput);
            }
        };
    }

    if (filterBtn) {
        filterBtn.onclick = () => {
            hideBroken = !hideBroken;
            filterBtn.classList.toggle('active', hideBroken);
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
