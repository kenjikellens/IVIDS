/**
 * SportsProvider Strategy
 * =======================
 * Dedicated strategy for live sports and Canal+ / French / European sports broadcasts.
 * Uses verified live HLS (.m3u8) streams and dynamically enriches sports channels
 * without injecting dead placeholder domains.
 */

import { BaseStreamProvider } from './base-provider.js';
import { StreamOptimizer } from '../core/stream-optimizer.js';

export class SportsProvider extends BaseStreamProvider {
    /**
     * Initializes the SportsProvider.
     * 
     * @param {Object} [options] - Configuration overrides.
     */
    constructor(options = {}) {
        super('sports_canalplus', 'Live Sports', {
            category: 'Sports',
            priority: 15,
            ...options
        });
    }

    /**
     * Fetches verified live sports and European broadcast channels.
     * 
     * @returns {Promise<Array<Channel>>} Array of sports Channel instances.
     */
    async fetchChannels() {
        if (!this.enabled) return [];

        const verifiedStreams = [
            {
                id: 'sport_redbull_tv',
                name: 'Red Bull TV HD',
                url: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
                logo: 'https://i.imgur.com/7b2p6kH.png',
                group: 'Sports',
                groupTags: ['sports', 'global'],
                tvgId: 'RedBullTV.us'
            },
            {
                id: 'sport_africa24_fr',
                name: 'Africa 24 Sport (FR)',
                url: 'https://africa24.vedge.infomaniak.com/livecast/ik:africa24sport/manifest.m3u8',
                logo: 'https://i0.wp.com/africa24tv.com/wp-content/uploads/2023/12/LOGO-AFRICASPORT-4-HD-sans-fond.png?fit=512%2C107&ssl=1',
                group: 'Sports',
                groupTags: ['sports', 'france'],
                tvgId: 'Africa24Sport.fr'
            },
            {
                id: 'sport_aci_sport_it',
                name: 'ACI Sport TV (IT)',
                url: 'https://webstream.multistream.it/memfs/e2cb3629-c1a2-495b-b43a-9eb386f04ed8.m3u8',
                logo: 'https://i.imgur.com/U8cHMOt.png',
                group: 'Sports',
                groupTags: ['sports', 'italy'],
                tvgId: 'ACISportTV.it'
            },
            {
                id: 'sport_aspor_tr',
                name: 'A Spor HD',
                url: 'https://rnttwmjcin.turknet.ercdn.net/lcpmvefbyo/aspor/aspor.m3u8',
                logo: 'https://i.imgur.com/ZhkZzLf.png',
                group: 'Sports',
                groupTags: ['sports', 'football'],
                tvgId: 'ASpor.tr'
            },
            {
                id: 'sport_acc_digital',
                name: 'ACC Digital Network',
                url: 'https://raycom-accdn-firetv.amagi.tv/playlist.m3u8',
                logo: 'https://i.imgur.com/V6Kaqha.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'ACCDigitalNetwork.us'
            },
            {
                id: 'sport_30a_golf',
                name: '30A Golf Kingdom',
                url: 'https://30a-tv.com/feeds/vidaa/golf.m3u8',
                logo: 'https://i.imgur.com/Lv53nh4.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: '30AGolfKingdom.us'
            }
        ];

        return verifiedStreams.map(item => this.createChannel({
            ...item,
            headers: StreamOptimizer.getRequiredHeaders(item.url),
            isSports: true
        }));
    }
}
