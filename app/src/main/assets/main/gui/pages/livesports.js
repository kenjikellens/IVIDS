import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { SportsResolver } from '../../logic/livetv/sports-resolver.js';
import { Toast } from '../js/toast.js';
import { proxyUrl } from '../js/utils/proxy.js';
import { getNamespacedKey } from '../../logic/account-helper.js';

/** Default remote feed URL for dynamic sports matches */
const DEFAULT_SPORTS_FEED_URL = 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8';

function loadMergedSettings() {
    try {
        const globalSaved = localStorage.getItem('ivids-settings');
        const globalSettings = globalSaved ? JSON.parse(globalSaved) : {};

        const userKey = getNamespacedKey('settings');
        const userSaved = localStorage.getItem(userKey);
        const userSettings = userSaved ? JSON.parse(userSaved) : {};

        return { ...globalSettings, ...userSettings };
    } catch (e) {
        console.error('LiveSports: Error loading settings:', e);
        return {};
    }
}

/**
 * Initializes the Live Sports Page.
 */
export async function init() {
    renderLoadingSkeletons();
    await loadDynamicSportsMatches();
    SpatialNav.focusFirst();
}

/**
 * Renders skeleton loader rows using existing global.css skeleton classes.
 */
function renderLoadingSkeletons() {
    const container = document.getElementById('livesports-rows-container');
    if (!container) return;

    container.innerHTML = `
        <div class="row-container">
            <h2 class="row-title">${window.i18n?.t('livetv.loading') || 'Loading Live Sports...'}</h2>
            <div class="row-content">
                <div class="playlist-card focusable-card is-skeleton"></div>
                <div class="playlist-card focusable-card is-skeleton"></div>
                <div class="playlist-card focusable-card is-skeleton"></div>
            </div>
        </div>
    `;
}

/**
 * Dynamically fetches live sports match categories from remote API / JSON feeds.
 * No hardcoded match data.
 */
async function loadDynamicSportsMatches() {
    const container = document.getElementById('livesports-rows-container');
    const emptyState = document.getElementById('livesports-empty-state');
    if (!container) return;

    try {
        const settings = loadMergedSettings();
        const feedUrl = settings.sportsFeedUrl || DEFAULT_SPORTS_FEED_URL;

        const response = await fetch(proxyUrl(feedUrl));
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const text = await response.text();
        const categories = parseDynamicSportsFeed(text);

        container.innerHTML = '';

        if (!categories || categories.length === 0) {
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        // Render each sports category row using native global.css classes
        categories.forEach(cat => {
            const rowEl = document.createElement('div');
            rowEl.className = 'row-container';

            const titleEl = document.createElement('h2');
            titleEl.className = 'row-title';
            titleEl.textContent = cat.title;
            rowEl.appendChild(titleEl);

            const contentEl = document.createElement('div');
            contentEl.className = 'row-content';

            cat.matches.forEach(match => {
                const card = document.createElement('div');
                card.className = 'playlist-card focusable-card focusable';
                card.tabIndex = 0;

                card.innerHTML = `
                    <div class="poster-wrapper">
                        <img src="${match.logo || 'images/livetv.svg'}" class="playlist-poster" loading="lazy" onerror="this.src='images/livetv.svg'">
                        <div class="playlist-overlay">
                            <span class="playlist-count">LIVE</span>
                        </div>
                    </div>
                    <div class="playlist-info">
                        <h3 class="playlist-title">${match.name}</h3>
                        <p class="playlist-subtitle">${match.league || 'Live Sports'}</p>
                    </div>
                `;

                card.onclick = () => playSportsMatch(match);
                contentEl.appendChild(card);
            });

            rowEl.appendChild(contentEl);
            container.appendChild(rowEl);
        });

    } catch (error) {
        console.error('[LiveSports] Failed to fetch dynamic sports feed:', error);
        container.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
    }
}

/**
 * Parses raw remote feed data into structured categories and matches.
 *
 * @param {string} content - Raw response string.
 * @returns {Array} List of category objects.
 */
function parseDynamicSportsFeed(content) {
    if (!content) return [];
    
    const categoriesMap = new Map();
    const lines = content.split('\n');
    let currentMatch = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXTINF:')) {
            currentMatch = {};
            const groupMatch = line.match(/group-title="([^"]+)"/);
            const logoMatch = line.match(/tvg-logo="([^"]+)"/);
            const nameParts = line.split(',');
            
            currentMatch.league = groupMatch ? groupMatch[1] : 'Live Sports';
            currentMatch.logo = logoMatch ? logoMatch[1] : null;
            currentMatch.name = nameParts[nameParts.length - 1] || 'Live Match';
        } else if (line.startsWith('http://') || line.startsWith('https://')) {
            if (currentMatch) {
                currentMatch.embedUrl = line;
                const catName = currentMatch.league;
                if (!categoriesMap.has(catName)) {
                    categoriesMap.set(catName, []);
                }
                categoriesMap.get(catName).push(currentMatch);
                currentMatch = null;
            }
        }
    }

    const result = [];
    categoriesMap.forEach((matches, title) => {
        result.push({ title, matches: matches.slice(0, 12) });
    });

    return result;
}

/**
 * Triggers stream resolution and launches TV Player for the match.
 *
 * @param {object} match - Selected match object.
 */
async function playSportsMatch(match) {
    Toast.show(`Connecting to ${match.name}...`, { type: 'info' });

    try {
        const streamUrl = await SportsResolver.resolveStream(match.embedUrl, 12000);
        window.activeStreamReferer = match.embedUrl;

        Router.loadPage('tv-player', {
            url: streamUrl,
            title: match.name,
            group: match.league
        });
    } catch (err) {
        console.warn('Sports stream resolution fallback:', err);
        Router.loadPage('tv-player', {
            url: match.embedUrl,
            title: match.name,
            group: match.league
        });
    }
}
