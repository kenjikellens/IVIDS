/**
 * Real XMLTV-backed Electronic Program Guide manager for Live TV channels.
 * Uses iptv-org guide metadata to lazily fetch only the guide files needed by
 * the channel currently being viewed.
 */
import { proxyUrl } from '../../gui/js/utils/proxy.js';

export class EpgManager {
    static GUIDES_URL = 'https://iptv-org.github.io/api/guides.json';
    static CACHE_TTL_MS = 2 * 60 * 60 * 1000;
    static guideLookup = new Map();
    static guideCache = new Map();
    static failedGuideCache = new Map();
    static FAILED_CACHE_TTL_MS = 30 * 60 * 1000;
    static guideFetchPromises = new Map();
    static channelProgramCache = new Map();
    static initPromise = null;
    static initialized = false;
    static FETCH_TIMEOUT_MS = 12000;
    static EPG_BASE_URL = 'https://iptv-org.github.io/epg/guides';

    static MAX_GUIDE_CACHE = 4;
    static MAX_CHANNEL_PROGRAM_CACHE = 150;

    /**
     * Inserts a value into a Map while enforcing a bounded LRU capacity to prevent unbounded memory growth.
     * Mutates the target Map by deleting the oldest entry when maxEntries is exceeded.
     *
     * @param {Map} map - Target cache Map.
     * @param {string} key - Cache key.
     * @param {*} value - Cached payload.
     * @param {number} maxEntries - Maximum retained entries.
     */
    static _setBoundedCache(map, key, value, maxEntries) {
        if (map.has(key)) {
            map.delete(key);
        } else if (map.size >= maxEntries) {
            const oldestKey = map.keys().next().value;
            map.delete(oldestKey);
        }
        map.set(key, value);
    }

    /**
     * Loads iptv-org guide metadata and builds channel-id to XMLTV source mappings.
     * Integrates CORS proxy wrapper when running on localhost.
     *
     * @returns {Promise<void>}
     */
    static async init() {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = this.fetchWithTimeout(proxyUrl(this.GUIDES_URL))
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load guides: ${response.status}`);
                return response.json();
            })
            .then(guides => {
                this.guideLookup.clear();
                if (Array.isArray(guides)) {
                    guides.forEach(guide => this.registerGuide(guide));
                }
                this.initialized = true;
            })
            .catch(error => {
                console.warn('EPG guide metadata unavailable:', error);
                this.initialized = true;
            });

        return this.initPromise;
    }

    /**
     * Registers EPG source mappings for a channel, routing US/UK/Latino regions to active daily guides.
     * This updates the internal guideLookup registry.
     *
     * @param {object} guide - Guide descriptor from iptv-org API.
     */
    static registerGuide(guide) {
        if (!guide.channel) return;

        let urls = [];
        const lowerChannel = guide.channel.toLowerCase();
        const lowerLang = (guide.lang || '').toLowerCase();

        if (lowerChannel.endsWith('.us') || lowerChannel.endsWith('.ca') || (lowerLang === 'eng' && (lowerChannel.includes('.us') || lowerChannel.includes('.ca')))) {
            urls = ['https://raw.githubusercontent.com/acidjesuz/EPGTalk/master/US_guide.xml.gz'];
        } else if (lowerChannel.endsWith('.uk') || (lowerLang === 'eng' && lowerChannel.includes('.uk'))) {
            urls = ['https://raw.githubusercontent.com/acidjesuz/EPGTalk/master/UK_guide.xml.gz'];
        } else if (lowerLang === 'spa' || lowerLang === 'por' || lowerLang === 'es' || lowerLang === 'pt' || 
                   lowerChannel.endsWith('.mx') || lowerChannel.endsWith('.cl') || lowerChannel.endsWith('.ar') || 
                   lowerChannel.endsWith('.co') || lowerChannel.endsWith('.pe') || lowerChannel.endsWith('.br')) {
            urls = ['https://raw.githubusercontent.com/acidjesuz/EPGTalk/master/Latino_guide.xml.gz'];
        } else {
            const epgshareCode = this.getEpgshareCountryCode(guide);
            if (epgshareCode) {
                urls = [
                    `https://epgshare01.online/epgshare01/epg_ripper_${epgshareCode}.xml.gz`,
                    'https://raw.githubusercontent.com/acidjesuz/EPGTalk/master/guide.xml.gz'
                ];
            } else {
                urls = ['https://raw.githubusercontent.com/acidjesuz/EPGTalk/master/guide.xml.gz'];
            }
        }

        const entry = {
            channelId: guide.channel,
            feed: guide.feed || '',
            urls
        };

        this.addGuideKey(guide.channel, entry);
        if (guide.feed) {
            this.addGuideKey(`${guide.channel}@${guide.feed}`, entry);
        }
    }

    /**
     * Maps guide language or country code to verified epgshare01 XMLTV ripper codes.
     *
     * @param {object} guide - The guide object.
     * @returns {string|null} Country feed code (e.g. 'BE2', 'NL1', 'FR1', 'TR1').
     */
    static getEpgshareCountryCode(guide) {
        const lang = (guide.lang || '').toLowerCase();
        const channel = (guide.channel || '').toLowerCase();

        if (channel.endsWith('.nl')) return 'NL1';
        if (channel.endsWith('.fr')) return 'FR1';
        if (channel.endsWith('.de')) return 'DE1';
        if (channel.endsWith('.it')) return 'IT1';
        if (channel.endsWith('.es')) return 'ES1';
        if (channel.endsWith('.pt')) return 'PT1';
        if (channel.endsWith('.uk')) return 'UK1';
        if (channel.endsWith('.be')) return 'BE2';
        if (channel.endsWith('.tr')) return 'TR1';

        switch (lang) {
            case 'nld': case 'nl': return 'NL1';
            case 'fra': case 'fr': return 'FR1';
            case 'deu': case 'de': return 'DE1';
            case 'ita': case 'it': return 'IT1';
            case 'spa': case 'es': return 'ES1';
            case 'por': case 'pt': return 'PT1';
            case 'tur': case 'tr': return 'TR1';
            case 'bel': return 'BE2';
            default: return null;
        }
    }

    /**
     * Adds a normalized lookup key without replacing an already registered source.
     *
     * @param {string} key - Channel or channel@feed identifier.
     * @param {object} entry - Guide entry.
     */
    static addGuideKey(key, entry) {
        const normalized = this.normalizeTvgId(key);
        if (normalized && !this.guideLookup.has(normalized)) {
            this.guideLookup.set(normalized, entry);
        }
    }

    /**
     * Returns current programme data for a channel, or a clean fallback object.
     *
     * @param {string} channelName - Display name used only for diagnostics/fallback context.
     * @param {string} channelGroup - Group/category, retained for API compatibility.
     * @param {string} tvgId - XMLTV/iptv-org channel identifier.
     * @returns {Promise<object>}
     */
    static async getCurrentProgram(channelName, channelGroup = '', tvgId = '') {
        const programs = await this.getProgramsForChannel(tvgId);
        const now = new Date();
        const current = programs.find(program => program.startDate <= now && program.endDate > now);

        if (!current) {
            return this.createFallbackProgram();
        }

        const totalMs = current.endDate.getTime() - current.startDate.getTime();
        const elapsedMs = now.getTime() - current.startDate.getTime();
        const progress = totalMs > 0 ? Math.floor((elapsedMs / totalMs) * 100) : 0;

        return {
            title: current.title,
            start: this.formatTime(current.startDate),
            end: this.formatTime(current.endDate),
            progress: Math.min(100, Math.max(0, progress)),
            timeLeft: Math.max(0, Math.floor((current.endDate.getTime() - now.getTime()) / 60000)),
            hasData: true
        };
    }

    /**
     * Returns upcoming programme rows after the current time.
     *
     * @param {string} channelName - Display name, retained for API compatibility.
     * @param {string} channelGroup - Group/category, retained for API compatibility.
     * @param {number} limit - Maximum number of upcoming programmes.
     * @param {string} tvgId - XMLTV/iptv-org channel identifier.
     * @returns {Promise<Array>}
     */
    static async getUpcomingPrograms(channelName, channelGroup = '', limit = 3, tvgId = '') {
        const programs = await this.getProgramsForChannel(tvgId);
        const now = new Date();

        return programs
            .filter(program => program.startDate > now)
            .slice(0, limit)
            .map(program => ({
                title: program.title,
                start: this.formatTime(program.startDate),
                end: this.formatTime(program.endDate),
                hasData: true
            }));
    }

    /**
     * Resolves guide metadata, fetches XMLTV when needed, and extracts programmes for a tvg-id.
     *
     * @param {string} tvgId - XMLTV/iptv-org channel identifier.
     * @returns {Promise<Array>}
     */
    static async getProgramsForChannel(tvgId) {
        await this.init();

        const normalizedTvgId = this.normalizeTvgId(tvgId);
        if (!normalizedTvgId) return [];

        const cachedPrograms = this.channelProgramCache.get(normalizedTvgId);
        if (cachedPrograms && Date.now() - cachedPrograms.timestamp < this.CACHE_TTL_MS) {
            return cachedPrograms.programs;
        }

        const guide = this.resolveGuide(normalizedTvgId);
        if (!guide) return [];

        const xml = await this.fetchGuideXml(guide.urls);
        if (!xml) return [];

        const candidateIds = this.getCandidateChannelIds(normalizedTvgId, guide);
        const programs = this.parsePrograms(xml, candidateIds);
        programs.sort((a, b) => a.startDate - b.startDate);
        this._setBoundedCache(this.channelProgramCache, normalizedTvgId, { programs, timestamp: Date.now() }, this.MAX_CHANNEL_PROGRAM_CACHE);
        return programs;
    }

    /**
     * Finds guide metadata using exact id, decoded id, or channel-only id.
     *
     * @param {string} tvgId - Normalized channel identifier.
     * @returns {object|null}
     */
    static resolveGuide(tvgId) {
        if (this.guideLookup.has(tvgId)) return this.guideLookup.get(tvgId);

        const channelOnly = tvgId.split('@')[0];
        if (this.guideLookup.has(channelOnly)) return this.guideLookup.get(channelOnly);

        return null;
    }

    /**
     * Fetches and caches an XMLTV document.
     *
     * @param {string|Array<string>} urlOrUrls - XMLTV guide URL or fallback URL list.
     * @returns {Promise<string>}
     */
    static async fetchGuideXml(urlOrUrls) {
        const urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
        for (const url of urls.filter(Boolean)) {
            const xml = await this.fetchSingleGuideXml(url);
            if (xml) return xml;
        }
        return '';
    }

    /**
     * Fetches and caches one XMLTV document URL.
     * Detects .gz URLs and decompresses them via DecompressionStream before reading as text.
     * Integrates CORS proxy wrapper when running on localhost.
     *
     * @param {string} url - XMLTV guide URL.
     * @returns {Promise<string>}
     */
    static async fetchSingleGuideXml(url) {
        const failedAt = this.failedGuideCache.get(url);
        if (failedAt && Date.now() - failedAt < this.FAILED_CACHE_TTL_MS) {
            return '';
        }
        const cached = this.guideCache.get(url);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
            return cached.xml;
        }
        if (this.guideFetchPromises.has(url)) {
            return this.guideFetchPromises.get(url);
        }

        const request = this.fetchWithTimeout(proxyUrl(url))
            .then(response => {
                if (!response.ok) throw new Error(`Guide fetch failed: ${response.status}`);
                return this.readResponseBody(response, url);
            })
            .then(xml => {
                this._setBoundedCache(this.guideCache, url, { xml, timestamp: Date.now() }, this.MAX_GUIDE_CACHE);
                return xml;
            })
            .catch(error => {
                this.failedGuideCache.set(url, Date.now());
                console.warn('EPG XML unavailable:', url, error);
                return '';
            });

        const cleanUp = () => this.guideFetchPromises.delete(url);
        request.then(cleanUp, cleanUp);

        this.guideFetchPromises.set(url, request);
        return request;
    }

    /**
     * Reads the response body as text, decompressing gzip content when the URL ends with .gz.
     * Uses the browser-native DecompressionStream API for transparent decompression.
     *
     * @param {Response} response - The fetch Response object.
     * @param {string} url - The original URL, used to detect .gz extension.
     * @returns {Promise<string>}
     */
    static async readResponseBody(response, url) {
        const isGzip = url.toLowerCase().endsWith('.gz');
        if (isGzip) {
            const buffer = await response.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
                try {
                    const decompressedStream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
                    const reader = decompressedStream.getReader();
                    const decoder = new TextDecoder('utf-8');
                    let result = '';
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        result += decoder.decode(value, { stream: true });
                    }
                    result += decoder.decode();
                    return result;
                } catch (e) {
                    return new TextDecoder('utf-8').decode(bytes);
                }
            }
            return new TextDecoder('utf-8').decode(bytes);
        }
        return response.text();
    }

    /**
     * Parses XMLTV programme elements from the XML document for matching candidate channel IDs.
     * It shifts stale program dates to match the current day for seamless guide display.
     *
     * @param {string} xml - XMLTV document.
     * @param {Set<string>} candidateIds - Acceptable channel IDs.
     * @returns {Array}
     */
    static parsePrograms(xml, candidateIds) {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const parseError = doc.querySelector('parsererror');
        if (parseError) return [];

        const parsedPrograms = Array.from(doc.querySelectorAll('programme'))
            .filter(node => candidateIds.has(this.normalizeTvgId(node.getAttribute('channel') || '')))
            .map(node => {
                const titleNode = node.querySelector('title');
                const startDate = this.parseXmltvDate(node.getAttribute('start') || '');
                const endDate = this.parseXmltvDate(node.getAttribute('stop') || '');

                if (!titleNode || !startDate || !endDate) return null;

                return {
                    title: titleNode.textContent.trim() || this.getNoEpgText(),
                    startDate,
                    endDate
                };
            })
            .filter(Boolean);

        if (parsedPrograms.length > 0) {
            const maxEndDate = new Date(Math.max(...parsedPrograms.map(p => p.endDate.getTime())));
            const now = new Date();
            if (maxEndDate < now) {
                const minStartDate = new Date(Math.min(...parsedPrograms.map(p => p.startDate.getTime())));
                const diffTime = now.getTime() - minStartDate.getTime();
                const diffDays = Math.floor(diffTime / (24 * 60 * 60 * 1000));
                const offsetMs = diffDays * 24 * 60 * 60 * 1000;

                if (offsetMs > 0) {
                    parsedPrograms.forEach(p => {
                        p.startDate = new Date(p.startDate.getTime() + offsetMs);
                        p.endDate = new Date(p.endDate.getTime() + offsetMs);
                    });
                }
            }
        }

        return parsedPrograms;
    }

    /**
     * Fetches a URL with a bounded timeout so Live TV never hangs on EPG network calls.
     *
     * @param {string} url - URL to fetch.
     * @returns {Promise<Response>}
     */
    static fetchWithTimeout(url) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS);

        const promise = fetch(url, { signal: controller.signal });
        const cleanUp = () => clearTimeout(timeout);
        return promise.then(
            val => { cleanUp(); return val; },
            err => { cleanUp(); throw err; }
        );
    }

    /**
     * Builds matching IDs because iptv-org guides may reference channel or channel@feed ids.
     *
     * @param {string} tvgId - Normalized requested tvg-id.
     * @param {object} guide - Resolved guide metadata.
     * @returns {Set<string>}
     */
    static getCandidateChannelIds(tvgId, guide) {
        const ids = new Set();
        const add = value => {
            const normalized = this.normalizeTvgId(value);
            if (normalized) ids.add(normalized);
        };

        add(tvgId);
        add(tvgId.split('@')[0]);
        add(guide.channelId);
        if (guide.feed) add(`${guide.channelId}@${guide.feed}`);

        return ids;
    }

    /**
     * Parses XMLTV timestamps like "20260521193000 +0200".
     *
     * @param {string} value - XMLTV timestamp.
     * @returns {Date|null}
     */
    static parseXmltvDate(value) {
        const match = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4}|Z)?/);
        if (!match) return null;

        const [, year, month, day, hour, minute, second = '00', zone = 'Z'] = match;
        const isoZone = zone === 'Z' ? 'Z' : `${zone.slice(0, 3)}:${zone.slice(3)}`;
        const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${isoZone}`);

        return Number.isNaN(date.getTime()) ? null : date;
    }

    /**
     * Normalizes XMLTV IDs for case-insensitive map/set matching.
     *
     * @param {string} tvgId - Raw tvg-id.
     * @returns {string}
     */
    static normalizeTvgId(tvgId) {
        return (tvgId || '').trim().toLowerCase();
    }

    /**
     * Formats a Date as local HH:mm.
     *
     * @param {Date} date - Date to format.
     * @returns {string}
     */
    static formatTime(date) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    }

    /**
     * Returns localized fallback text.
     *
     * @returns {string}
     */
    static getNoEpgText() {
        return window.i18n?.t('livetv.noEpgInfo') || window.i18n?.t('livetv.epgNoInfo') || 'No program info available';
    }

    /**
     * Creates the display-safe fallback object used when no guide exists.
     *
     * @returns {object}
     */
    static createFallbackProgram() {
        return {
            title: this.getNoEpgText(),
            start: '--:--',
            end: '--:--',
            progress: 0,
            timeLeft: 0,
            hasData: false
        };
    }
}
