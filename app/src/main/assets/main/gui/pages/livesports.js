import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';
import { SportsResolver } from '../../logic/livetv/sports-resolver.js';
import { Toast } from '../js/toast.js';
import { proxyUrl } from '../js/utils/proxy.js';
import { getNamespacedKey } from '../../logic/account-helper.js';

/** Live sports stream aggregator provider endpoints */
const SPORTS_AGGREGATORS = [
    { name: 'StreamEast', url: 'https://streameast.app/api/matches' },
    { name: 'VIPBox', url: 'https://vipleague.im/api/matches' },
    { name: 'LiveTV.sx', url: 'https://livetv.sx/enx/matches' },
    { name: 'SportSurge', url: 'https://sportsurge.net/api/matches' }
];

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
    console.log('[LiveSports] Initializing Live Sports page...');
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
 * Dynamically fetches live sports matches from streaming aggregators (StreamEast, VIPBox, LiveTV.sx, SportSurge).
 * No hardcoded match data and no GitHub reliance.
 */
async function loadDynamicSportsMatches() {
    const container = document.getElementById('livesports-rows-container');
    const emptyState = document.getElementById('livesports-empty-state');
    if (!container) return;

    try {
        const settings = loadMergedSettings();
        const customFeed = settings.sportsFeedUrl;
        
        console.log('[LiveSports] Fetching dynamic matches from sports aggregators...');
        let categories = null;

        if (customFeed) {
            console.log('[LiveSports] User specified custom sports feed URL:', customFeed);
            try {
                const res = await fetch(proxyUrl(customFeed));
                if (res.ok) {
                    const text = await res.text();
                    categories = parseDynamicSportsFeed(text);
                }
            } catch (e) {
                console.warn('[LiveSports] Custom feed fetch failed, using sports streaming aggregators:', e);
            }
        }

        // Fetch from live sports streaming aggregators if no custom feed or if custom feed returned empty
        if (!categories || categories.length === 0) {
            categories = await fetchFromSportsAggregators();
        }

        console.log('[LiveSports] Parsed sports categories count:', categories ? categories.length : 0);
        container.innerHTML = '';

        if (!categories || categories.length === 0) {
            console.warn('[LiveSports] No live sports matches available right now.');
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        // Render each sports category row using native global.css classes
        categories.forEach(cat => {
            console.log(`[LiveSports] Rendering category "${cat.title}" with ${cat.matches.length} matches`);
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

async function fetchFromSportsAggregators() {
    for (const aggregator of SPORTS_AGGREGATORS) {
        try {
            console.log(`[LiveSports] Trying sports aggregator provider: ${aggregator.name} (${aggregator.url})`);
            
            // Generate proxy and direct fallback URLs to bypass SSL 502 / Cloudflare 403
            const targetUrls = [
                proxyUrl(aggregator.url),
                aggregator.url,
                `https://corsproxy.io/?${encodeURIComponent(aggregator.url)}`,
                `https://api.allorigins.win/raw?url=${encodeURIComponent(aggregator.url)}`
            ];

            for (const targetUrl of targetUrls) {
                try {
                    const res = await fetch(targetUrl);
                    if (!res.ok) continue;

                    const contentType = res.headers.get('content-type') || '';
                    const text = await res.text();
                    if (!text || text.length < 50) continue;

                    if (contentType.includes('json') || (text.trim().startsWith('[') || text.trim().startsWith('{'))) {
                        try {
                            const data = JSON.parse(text);
                            if (Array.isArray(data) && data.length > 0) {
                                console.log(`[LiveSports] Successfully fetched JSON matches from ${aggregator.name}:`, data.length);
                                return formatAggregatorMatches(data);
                            }
                        } catch (jsonErr) {
                            // Proceed to HTML parsing if JSON parse failed
                        }
                    }

                    // Parse HTML response using DOMParser
                    const parsedMatches = parseHtmlSportsMatches(text, aggregator.name);
                    if (parsedMatches && parsedMatches.length > 0) {
                        console.log(`[LiveSports] Successfully parsed ${parsedMatches.length} HTML matches from ${aggregator.name}`);
                        return formatAggregatorMatches(parsedMatches);
                    }
                } catch (fetchErr) {
                    console.warn(`[LiveSports] Fetch attempt failed for ${targetUrl}:`, fetchErr.message);
                }
            }
        } catch (e) {
            console.warn(`[LiveSports] Aggregator ${aggregator.name} fetch attempt failed:`, e);
        }
    }
    return [];
}

/**
 * Parses raw HTML string from sports streaming sites to extract match titles and links.
 *
 * @param {string} htmlText - Raw HTML content.
 * @param {string} providerName - Name of the aggregator.
 * @returns {Array} List of extracted match objects.
 */
function parseHtmlSportsMatches(htmlText, providerName) {
    if (!htmlText) return [];

    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, 'text/html');
        const matches = [];

        // Query links containing match terms or VS
        const anchors = doc.querySelectorAll('a[href]');
        anchors.forEach(a => {
            const text = (a.textContent || '').trim();
            const href = a.getAttribute('href');

            if (href && text.length > 5 && (text.toLowerCase().includes(' vs ') || text.toLowerCase().includes(' v ') || text.toLowerCase().includes('grand prix'))) {
                let category = 'Live Sports';
                const lowerText = text.toLowerCase();
                
                if (lowerText.includes('psg') || lowerText.includes('marseille') || lowerText.includes('ligue 1') || lowerText.includes('lyon')) {
                    category = 'Ligue 1';
                } else if (lowerText.includes('arsenal') || lowerText.includes('chelsea') || lowerText.includes('premier league') || lowerText.includes('liverpool') || lowerText.includes('manchester')) {
                    category = 'Premier League';
                } else if (lowerText.includes('champions league') || lowerText.includes('real madrid') || lowerText.includes('bayern')) {
                    category = 'Champions League';
                } else if (lowerText.includes('formula 1') || lowerText.includes('f1') || lowerText.includes('grand prix')) {
                    category = 'Formula 1';
                }

                let fullUrl = href;
                if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
                    fullUrl = `https://${providerName.toLowerCase().replace(/[^a-z]/g, '')}.com${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
                }

                matches.push({
                    title: text,
                    category: category,
                    url: fullUrl
                });
            }
        });

        return matches;
    } catch (e) {
        console.warn('[LiveSports] HTML parsing error:', e);
        return [];
    }
}

/**
 * Triggers stream resolution and launches TV Player for the match.
 *
 * @param {object} match - Selected match object.
 */
async function playSportsMatch(match) {
    console.log('[LiveSports] User clicked match:', match.name, '| Embed URL:', match.embedUrl);
    Toast.show(`Connecting to ${match.name}...`, { type: 'info' });

    try {
        console.log('[LiveSports] Invoking SportsResolver for embedUrl:', match.embedUrl);
        const streamUrl = await SportsResolver.resolveStream(match.embedUrl, 12000);
        console.log('[LiveSports] SportsResolver returned streamUrl:', streamUrl);
        window.activeStreamReferer = match.embedUrl;

        console.log('[LiveSports] Routing to tv-player with title:', match.name);
        Router.loadPage('tv-player', {
            url: streamUrl,
            title: match.name,
            group: match.league
        });
    } catch (err) {
        console.warn('[LiveSports] Sports stream resolution fallback due to error:', err);
        Router.loadPage('tv-player', {
            url: match.embedUrl,
            title: match.name,
            group: match.league
        });
    }
}
