/**
 * SportsProvider Strategy
 * =======================
 * Dedicated strategy for live sports and European sports broadcasts.
 * Uses verified high-availability CDN HLS (.m3u8) streams.
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
            priority: 8,
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
                tvgId: 'RedBullTV.at@SD'
            },
            {
                id: 'sport_africa24_fr',
                name: 'Africa 24 Sport (FR)',
                url: 'https://africa24.vedge.infomaniak.com/livecast/ik:africa24sport/manifest.m3u8',
                logo: 'https://i0.wp.com/africa24tv.com/wp-content/uploads/2023/12/LOGO-AFRICASPORT-4-HD-sans-fond.png?fit=512%2C107&ssl=1',
                group: 'Sports',
                groupTags: ['sports', 'france'],
                tvgId: 'Africa24Sport.fr@SD'
            },
            {
                id: 'sport_aci_sport_it',
                name: 'ACI Sport TV (IT)',
                url: 'https://webstream.multistream.it/memfs/e2cb3629-c1a2-495b-b43a-9eb386f04ed8.m3u8',
                logo: 'https://i.imgur.com/U8cHMOt.png',
                group: 'Sports',
                groupTags: ['sports', 'italy'],
                tvgId: 'ACISportTV.it@SD'
            },
            {
                id: 'sport_aspor_tr',
                name: 'A Spor HD',
                url: 'https://rnttwmjcin.turknet.ercdn.net/lcpmvefbyo/aspor/aspor.m3u8',
                logo: 'https://i.imgur.com/ZhkZzLf.png',
                group: 'Sports',
                groupTags: ['sports', 'football'],
                tvgId: 'ASpor.tr@SD'
            },
            {
                id: 'sport_acc_digital',
                name: 'ACC Digital Network',
                url: 'https://raycom-accdn-firetv.amagi.tv/playlist.m3u8',
                logo: 'https://i.imgur.com/V6Kaqha.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'ACCDigitalNetwork.us@SD'
            },
            {
                id: 'sport_eurosport1_fr',
                name: 'Eurosport 1 (FR)',
                url: 'https://r.eu.cdn-redge.media/livehls/oeu/mt/live/eurosport_1/live.livx/playlist.m3u8',
                logo: 'https://i.imgur.com/olQJgm7.png',
                group: 'Sports',
                groupTags: ['sports', 'france'],
                tvgId: 'Eurosport1.fr@France'
            },
            {
                id: 'sport_eurosport2_fr',
                name: 'Eurosport 2 (FR)',
                url: 'https://r.eu.cdn-redge.media/livehls/oeu/mt/live/eurosport_2/live.livx/playlist.m3u8',
                logo: 'https://i.imgur.com/f56dHgR.png',
                group: 'Sports',
                groupTags: ['sports', 'france'],
                tvgId: 'Eurosport2.fr@France'
            },
            {
                id: 'sport_eurosport1_it',
                name: 'Eurosport 1 (IT)',
                url: 'https://r.eu.cdn-redge.media/livehls/oeu/mt/live/eurosport_1_it/live.livx/playlist.m3u8',
                logo: 'https://i.imgur.com/olQJgm7.png',
                group: 'Sports',
                groupTags: ['sports', 'italy'],
                tvgId: 'Eurosport1.fr@Italy'
            },
            {
                id: 'sport_eurosport2_uk',
                name: 'Eurosport 2 (UK)',
                url: 'https://r.eu.cdn-redge.media/livehls/oeu/mt/live/eurosport_2_en/live.livx/playlist.m3u8',
                logo: 'https://i.imgur.com/f56dHgR.png',
                group: 'Sports',
                groupTags: ['sports', 'united kingdom'],
                tvgId: 'Eurosport2.fr@UK'
            },
            {
                id: 'sport_lequipe_fr',
                name: 'L\'Équipe Live (FR)',
                url: 'https://dq37unyetkpcz.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-m04j89j7k5gtp/LEquipe_FR.m3u8',
                logo: 'https://i.imgur.com/t35zhM9.png',
                group: 'Sports',
                groupTags: ['sports', 'france'],
                tvgId: 'LEquipe.fr@SD'
            },
            {
                id: 'sport_equidia_fr',
                name: 'Equidia (FR)',
                url: 'https://raw.githubusercontent.com/Paradise-91/ParaTV/main/streams/equidia/live2.m3u8',
                logo: 'https://i.imgur.com/QPpbRcZ.png',
                group: 'Sports',
                groupTags: ['sports', 'france'],
                tvgId: 'Equidia.fr@SD'
            },
            {
                id: 'sport_after_foot_fr',
                name: 'After Foot TV (FR)',
                url: 'https://jmp2.uk/stvp-FR1100002RF',
                logo: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/FR1100002RF_20260622T063925SQUARE.png',
                group: 'Sports',
                groupTags: ['sports', 'france', 'football'],
                tvgId: 'FR1100002RF'
            },
            {
                id: 'sport_so_foot_fr',
                name: 'So Foot+ (FR)',
                url: 'https://jmp2.uk/stvp-FR12000040D',
                logo: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/FR12000040D_20261013T053916SQUARE.png',
                group: 'Sports',
                groupTags: ['sports', 'france', 'football'],
                tvgId: 'FR12000040D'
            },
            {
                id: 'sport_sport1_de',
                name: 'Sport1 (DE)',
                url: 'https://r.eu.cdn-redge.media/livehls/oeu/mt/live/sport1/live.livx/playlist.m3u8',
                logo: 'https://i.imgur.com/Tsjt7v9.png',
                group: 'Sports',
                groupTags: ['sports', 'germany'],
                tvgId: 'Sport1.de@SD'
            },
            {
                id: 'sport_sportdigital_de',
                name: 'Sportdigital Free (DE)',
                url: 'https://jmp2.uk/stvp-DEAJ0500429A',
                logo: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/DEAJ0500429A_20250527T015726SQUARE.png',
                group: 'Sports',
                groupTags: ['sports', 'germany', 'football'],
                tvgId: 'DEAJ0500429A'
            },
            {
                id: 'sport_more_than_sports_de',
                name: 'More Than Sports TV (DE)',
                url: 'https://mts1.iptv-playoutcenter.de/mts/mts-web/playlist.m3u8',
                logo: 'https://i.imgur.com/SLrjImc.png',
                group: 'Sports',
                groupTags: ['sports', 'germany'],
                tvgId: 'MoreThanSportsTV.de@SD'
            },
            {
                id: 'sport_orf_sport_at',
                name: 'ORF Sport+ (AT)',
                url: 'https://test02.mdn.ors.at/orf/orfs/qxa/manifest.m3u8',
                logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/ORF_Sport%2B.svg/960px-ORF_Sport%2B.svg.png',
                group: 'Sports',
                groupTags: ['sports', 'germany'],
                tvgId: 'ORFSportPlus.at@SD'
            },
            {
                id: 'sport_sportitalia_it',
                name: 'Sportitalia (IT)',
                url: 'https://jmp2.uk/stvp-IT1000002TG',
                logo: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/IT1000002TG_20260707T053001SQUARE.png',
                group: 'Sports',
                groupTags: ['sports', 'italy', 'football'],
                tvgId: 'IT1000002TG'
            },
            {
                id: 'sport_solocalcio_it',
                name: 'Sportitalia Solocalcio (IT)',
                url: 'https://distribution.sportitalialive.it/sportitalia/sisolocalcio_abr/playlist.m3u8',
                logo: 'https://i.imgur.com/hu56Ya5.png',
                group: 'Sports',
                groupTags: ['sports', 'italy', 'football'],
                tvgId: 'SportitaliaSolocalcio.it@SD'
            },
            {
                id: 'sport_supertennis_it',
                name: 'SuperTennis (IT)',
                url: 'https://jmp2.uk/stvp-IT800003V4',
                logo: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/IT800003V4_20260915T041845SQUARE.png',
                group: 'Sports',
                groupTags: ['sports', 'italy', 'tennis'],
                tvgId: 'IT800003V4'
            },
            {
                id: 'sport_inter_tv_it',
                name: 'Inter TV (IT)',
                url: 'https://d3k8wzt41aflvx.cloudfront.net/INTERTV/Live.m3u8',
                logo: 'https://i.imgur.com/FUTqh2L.png',
                group: 'Sports',
                groupTags: ['sports', 'italy', 'football'],
                tvgId: 'InterTV.it@SD'
            },
            {
                id: 'sport_esport3_es',
                name: 'Esport3 (ES)',
                url: 'https://directes-tv-int.3catdirectes.cat/live-content/esport3-hls/master.m3u8',
                logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Esport3.svg/960px-Esport3.svg.png',
                group: 'Sports',
                groupTags: ['sports', 'spain'],
                tvgId: 'Esport3.es@Originals'
            },
            {
                id: 'sport_realmadrid_tv',
                name: 'Real Madrid TV',
                url: 'https://live-manifest.production-public.tubi.io/live/5cfbe5af-a9c2-45cc-ade9-8e13e39fa2d0/playlist.m3u8',
                logo: 'https://canvas-lb.tubitv.com/opts/0eZIOEWFj-zM3A==/4bb7bdf1-16ba-4d7c-b077-893f549c4022/CHgQeDoFMS4xLjlAAQ==',
                group: 'Sports',
                groupTags: ['sports', 'spain', 'football'],
                tvgId: 'RealMadridTV.es@SD'
            },
            {
                id: 'sport_barca_24h',
                name: 'Barça 24H',
                url: 'https://jmp2.uk/stvp-GB1100002OE',
                logo: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/GB1100002OE_20261102T070516SQUARE.png',
                group: 'Sports',
                groupTags: ['sports', 'spain', 'football'],
                tvgId: 'GB1100002OE'
            },
            {
                id: 'sport_mypadel_es',
                name: 'MyPadel TV (ES)',
                url: 'https://jmp2.uk/stvp-ES30000091V',
                logo: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/ES30000091V_20241022T050555SQUARE.png',
                group: 'Sports',
                groupTags: ['sports', 'spain'],
                tvgId: 'ES30000091V'
            },
            {
                id: 'sport_mutv_uk',
                name: 'MUTV (UK)',
                url: 'https://fastly.live.brightcove.com/6374054671112/eu-west-1/6058004203001/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJob3N0IjoiYXplMnp5LmVncmVzcy55ODN1ZWIiLCJhY2NvdW50X2lkIjoiNjA1ODAwNDIwMzAwMSIsImVobiI6ImZhc3RseS5saXZlLmJyaWdodGNvdmUuY29tIiwiaXNzIjoiYmxpdmUtcGxheWJhY2stc291cmNlLWFwaSIsInN1YiI6InBhdGhtYXB0b2tlbiIsImF1ZCI6WyI2MDU4MDA0MjAzMDAxIl0sImp0aSI6IjYzNzQwNTQ2NzExMTIifQ.3FmuTna3DAmY7xlhK5fk6LMrosrtrR5VsU2QOgYO5y4/playlist-hls.m3u8',
                logo: 'https://d2n0069hmnqmmx.cloudfront.net/epgdata/1.0/newchanlogos/512/512/skychb1834.png',
                group: 'Sports',
                groupTags: ['sports', 'united kingdom', 'football'],
                tvgId: 'MUTV.uk@SD'
            },
            {
                id: 'sport_talksport_uk',
                name: 'talkSPORT (UK)',
                url: 'https://af7a8b4e.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfdGFsa1NQT1JUX0hMUw/playlist.m3u8',
                logo: 'https://upload.wikimedia.org/wikipedia/en/9/9d/Talksport_logo.png',
                group: 'Sports',
                groupTags: ['sports', 'united kingdom'],
                tvgId: 'talkSPORT.uk@SD'
            },
            {
                id: 'sport_tvr_sport_ro',
                name: 'TVR Sport',
                url: 'https://tvr-sport.lg.mncdn.com/tvrsport/smil:tvrsport.smil/playlist.m3u8',
                logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/TVR_Sport_Logo_2023.svg/960px-TVR_Sport_Logo_2023.svg.png',
                group: 'Sports',
                groupTags: ['sports', 'global'],
                tvgId: 'TVRSport.ro@SD'
            },
            {
                id: 'sport_fifa_plus',
                name: 'FIFA+',
                url: 'https://jmp2.uk/plu-660c29b5aec9680008f5b4a4.m3u8',
                logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/960px-FIFA%2B_(2025).svg.png',
                group: 'Sports',
                groupTags: ['sports', 'global', 'football'],
                tvgId: 'FIFAPlus.uk@English'
            },
            {
                id: 'sport_fifa_plus_fr',
                name: 'FIFA+ French',
                url: 'https://37b4c228.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWZyX0ZJRkFQbHVzRnJlbmNoX0hMUw/playlist.m3u8',
                logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/960px-FIFA%2B_(2025).svg.png',
                group: 'Sports',
                groupTags: ['sports', 'france', 'football'],
                tvgId: 'FIFAPlus.uk@French'
            },
            {
                id: 'sport_fifa_plus_es',
                name: 'FIFA+ Spain',
                url: 'https://d63fabad.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWVzX0ZJRkFQbHVzU3BhbmlzaF9ITFM/playlist.m3u8',
                logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/960px-FIFA%2B_(2025).svg.png',
                group: 'Sports',
                groupTags: ['sports', 'spain', 'football'],
                tvgId: 'FIFAPlus.uk@Spain'
            },
            {
                id: 'sport_fifa_plus_it',
                name: 'FIFA+ Italy',
                url: 'https://5d95f7d7.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWl0X0ZJRkFQbHVzSXRhbGlhbl9ITFM/playlist.m3u8',
                logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/960px-FIFA%2B_(2025).svg.png',
                group: 'Sports',
                groupTags: ['sports', 'italy', 'football'],
                tvgId: 'FIFAPlus.uk@Italy'
            },
            {
                id: 'sport_fifa_plus_de',
                name: 'FIFA+ German',
                url: 'https://4397879b.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWRlX0ZJRkFQbHVzR2VybWFuX0hMUw/playlist.m3u8',
                logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/FIFA%2B_(2025).svg/960px-FIFA%2B_(2025).svg.png',
                group: 'Sports',
                groupTags: ['sports', 'germany', 'football'],
                tvgId: 'FIFAPlus.uk@German'
            },
            {
                id: 'sport_fifa_plus_women',
                name: 'FIFA+ Women',
                url: 'https://cffda8ff.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/U2Ftc3VuZy1nYl9GSUZBUGx1c3dvbWVuX0hMUw/playlist.m3u8',
                logo: 'https://i.imgur.com/xy9ZxVO.png',
                group: 'Sports',
                groupTags: ['sports', 'global', 'football'],
                tvgId: 'FIFAPlusWomen.uk@English'
            },
            {
                id: 'sport_uefa_tv',
                name: 'UEFA.tv',
                url: 'https://live-manifest.production-public.tubi.io/live/d846008d-b608-4ddf-931c-48e9b60bf6c5/playlist.m3u8',
                logo: 'https://canvas-lb.tubitv.com/opts/vYU_W6gGesX41A==/f137edcb-de3c-4b3c-9e41-ef2cc6f8d156/CHgQeDoFMS4xLjlAAQ==',
                group: 'Sports',
                groupTags: ['sports', 'global', 'football'],
                tvgId: 'UEFA.tv'
            },
            {
                id: 'sport_ucl_fast',
                name: 'UEFA Champions League',
                url: 'https://jmp2.uk/plu-65ea8b928145cb0008509426.m3u8',
                logo: 'https://images.pluto.tv/channels/65ea8b928145cb0008509426/colorLogoPNG.png',
                group: 'Sports',
                groupTags: ['sports', 'united states', 'football'],
                tvgId: 'UEFAChampionsLeague.us'
            },
            {
                id: 'sport_cbs_sports_hq',
                name: 'CBS Sports HQ',
                url: 'https://jmp2.uk/plu-5e9f2c05172a0f0007db4786.m3u8',
                logo: 'https://i.imgur.com/q8BENJg.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'CBSSportsHQ.us@SD'
            },
            {
                id: 'sport_bein_xtra',
                name: 'beIN SPORTS XTRA',
                url: 'https://bein-xtra-bein.amagi.tv/playlist.m3u8',
                logo: 'https://i.ibb.co/HT49GPmB/XTRA-2.png',
                group: 'Sports',
                groupTags: ['sports', 'united states', 'football'],
                tvgId: 'beINSPORTSXTRA.us@SD'
            },
            {
                id: 'sport_bein_xtra_es',
                name: 'beIN SPORTS XTRA en Español',
                url: 'https://dc1644a9jazgj.cloudfront.net/beIN_Sports_Xtra_Espanol.m3u8',
                logo: 'https://i.imgur.com/V562tpO.png',
                group: 'Sports',
                groupTags: ['sports', 'united states', 'football'],
                tvgId: 'beINSPORTSXTRAenEspanol.us@SD'
            },
            {
                id: 'sport_tyc_sports',
                name: 'TyC Sports',
                url: 'https://amg26268-amg26268c14-freelivesports-emea-10267.playouts.now.amagi.tv/ts-us-e2-n2/playlist/amg26268-sportsstudio-tycsports-freelivesportsemea/playlist.m3u8',
                logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/TyC_Sports_logo.svg/960px-TyC_Sports_logo.svg.png',
                group: 'Sports',
                groupTags: ['sports', 'global', 'football'],
                tvgId: 'TyCSports.ar@SD'
            },
            {
                id: 'sport_azteca_deportes',
                name: 'Azteca Deportes',
                url: 'https://jmp2.uk/rok-04be54c79d1f55d0909e684f64f9fb57.m3u8',
                logo: 'https://images.sr.roku.com/idType/roku-trc/context/trc/id/04be54c79d1f55d0909e684f64f9fb57/https%3A%2F%2Fimage.roku.com%2Fbh-uploads%2Fproduction%2FinfoHUDLogo%2F1718994621239_AI_Roku_260x147_Mono_DEPORTES_TB_Oct23.png',
                group: 'Sports',
                groupTags: ['sports', 'global', 'football'],
                tvgId: 'AztecaDeportes.mx'
            },
            {
                id: 'sport_vix_ligamx',
                name: 'ViX Liga MX',
                url: 'https://jmp2.uk/rok-35633f08c98857cb9e85c91eae17c0d5.m3u8',
                logo: 'https://images.sr.roku.com/idType/roku-trc/context/trc/id/35633f08c98857cb9e85c91eae17c0d5/https%3A%2F%2Fimage.roku.com%2Fbh-uploads%2Fproduction%2FinfoHUDLogo%2F1749856192932_LoMejorDeLigaMX_HUD_ChannelLogo_260x147px.png',
                group: 'Sports',
                groupTags: ['sports', 'global', 'football'],
                tvgId: 'ViXLigaMX.us'
            },
            {
                id: 'sport_eurovision_sport',
                name: 'Eurovision Sport',
                url: 'https://amg26268-amg26268c34-amgplt0018.playout.now3.amagi.tv/ts-us-e2-n1/playlist/amg26268-amg26268c34-amgplt0018/playlist.m3u8',
                logo: 'https://images.ctfassets.net/2b1dkanupt14/1A1Z8Gcn2NkbJRzTjxuj6h/2c14436cdc5b78e746a256e9f0c11a70/eurovision-icon.png',
                group: 'Sports',
                groupTags: ['sports', 'global'],
                tvgId: 'EurovisionSport.uk@Europe'
            },
            {
                id: 'sport_fox_sports',
                name: 'FOX Sports',
                url: 'https://jmp2.uk/plu-5a74b8e1e22a61737979c6bf.m3u8',
                logo: 'https://images.pluto.tv/channels/5a74b8e1e22a61737979c6bf/colorLogoPNG.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'FOXSports.us'
            },
            {
                id: 'sport_fox_sports_news',
                name: 'Fox Sports News',
                url: 'https://skynewsau-live-premium.akamaized.net/hls/live/2105307/foxsportsnews/live_1080p.m3u8',
                logo: 'https://i.imgur.com/FhMQrJk.png',
                group: 'Sports',
                groupTags: ['sports', 'global'],
                tvgId: 'FoxSportsNews.au@SD'
            },
            {
                id: 'sport_espn8_ocho',
                name: 'ESPN8: The Ocho',
                url: 'https://d3b6q2ou5kp8ke.cloudfront.net/ESPNTheOcho.m3u8',
                logo: 'https://images.fubo.tv/channel-config-ui/station-logos/on-dark/espn_8_the_ocho_bw.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'ESPN8TheOcho.us'
            },
            {
                id: 'sport_tsn_ocho',
                name: 'TSN The Ocho',
                url: 'https://d3pnbvng3bx2nj.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-rds8g35qfqrnv/TSN_The_Ocho.m3u8',
                logo: 'https://tvpnlogopus.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/CA1400003R3_20240709T002034SQUARE.png',
                group: 'Sports',
                groupTags: ['sports', 'global'],
                tvgId: 'TSNTheOcho.ca@SD'
            },
            {
                id: 'sport_nfl_channel',
                name: 'NFL Channel',
                url: 'https://jmp2.uk/plu-5ced7d5df64be98e07ed47b6.m3u8',
                logo: 'https://i.imgur.com/mPGtwAP.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'NFLChannel.us@SD'
            },
            {
                id: 'sport_nba_channel',
                name: 'The NBA Channel',
                url: 'https://jmp2.uk/plu-6792c30abc03978b9b8bb832.m3u8',
                logo: 'https://images.pluto.tv/channels/6792c30abc03978b9b8bb832/colorLogoPNG_1793984084091.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'TheNBAChannel.us'
            },
            {
                id: 'sport_mlb',
                name: 'MLB',
                url: 'https://jmp2.uk/plu-5e66968a70f34c0007d050be.m3u8',
                logo: 'https://i.imgur.com/ym3su2J.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'MLB.us@SD'
            },
            {
                id: 'sport_nhl_network',
                name: 'NHL Network',
                url: 'https://nhl-firetv.amagi.tv/playlist.m3u8',
                logo: 'https://i.imgur.com/UNZ8bef.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'NHLNetwork.us@SD'
            },
            {
                id: 'sport_pac12_insider',
                name: 'Pac-12 Insider',
                url: 'https://pac12-firetv.amagi.tv/playlist.m3u8',
                logo: 'https://i.imgur.com/736QREy.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'Pac12Insider.us@SD'
            },
            {
                id: 'sport_big12_studios',
                name: 'Big 12 Studios',
                url: 'https://live-manifest.production-public.tubi.io/live/57a9f9ac-881b-4786-bb9e-77259eaed1b6/playlist.m3u8',
                logo: 'https://canvas-lb.tubitv.com/opts/-0nmELSyfaWqNg==/eace1598-de1c-499a-8005-405d5cb5adb5/CHgQeDoFMS4xLjlAAQ==',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'Big12Studios.us'
            },
            {
                id: 'sport_sportsgrid',
                name: 'SportsGrid',
                url: 'https://sportsgrid-tribal.amagi.tv/playlist.m3u8',
                logo: 'https://i.imgur.com/ulGKX30.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'SportsGrid.us@SD'
            },
            {
                id: 'sport_fubo_sports',
                name: 'Fubo Sports Network',
                url: 'https://jmp2.uk/rok-b4273871759a5631bd536d2214f175e5.m3u8',
                logo: 'https://i.imgur.com/qFNRJLb.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'FuboSportsNetwork.us@SD'
            },
            {
                id: 'sport_draftkings',
                name: 'DraftKings Network',
                url: 'https://na.linear.zype.com/e0bd0e23-a958-4e43-8164-4f2fef8876a8/fd3614bd-90bf-4530-a277-65ae3a1720c8-zype/live.m3u8',
                logo: 'https://i.imgur.com/SFYhgrt.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'DraftKingsNetwork.us@SD'
            },
            {
                id: 'sport_unbeaten',
                name: 'Unbeaten Sports',
                url: 'https://d1t5afz6qed3xk.cloudfront.net/Unbeaten.m3u8',
                logo: 'https://i.imgur.com/LmkNt3v.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'Unbeaten.us@SD'
            },
            {
                id: 'sport_womens_sports',
                name: 'Women\'s Sports Network',
                url: 'https://d39accvx65hq9o.cloudfront.net/Womens_Sports_Network.m3u8',
                logo: 'https://i.imgur.com/rhIwUcQ.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'WomensSportsNetwork.us@SD'
            },
            {
                id: 'sport_awsn',
                name: 'AWSN',
                url: 'https://jmp2.uk/plu-682e43b21295f98347710917.m3u8',
                logo: 'https://images.pluto.tv/channels/682e43b21295f98347710917/colorLogoPNG_1748886692805.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'AWSN.us'
            },
            {
                id: 'sport_ufc',
                name: 'UFC',
                url: 'https://jmp2.uk/plu-677d9adfa9a51b0008497fa0.m3u8',
                logo: 'https://images.pluto.tv/channels/677d9adfa9a51b0008497fa0/colorLogoPNG.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'UFC.us'
            },
            {
                id: 'sport_pfl_mma',
                name: 'PFL MMA',
                url: 'https://jmp2.uk/plu-64f6180130ab3300083d896b.m3u8',
                logo: 'https://provider-static.plex.tv/epg/cms/production/96dd0531-b500-4bd4-93ca-763cbf46defe/1500x1000_PFL_SHIELD_DARK_BG_-_Allie_Dinsmore.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'PFLMMA.us@SD'
            },
            {
                id: 'sport_bellator_mma',
                name: 'Bellator MMA',
                url: 'https://jmp2.uk/plu-5ebc8688f3697d00072f7cf8.m3u8',
                logo: 'https://i.imgur.com/VBKoLHk.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'BellatorMMA.us@SD'
            },
            {
                id: 'sport_dazn_combat',
                name: 'DAZN Combat',
                url: 'https://jmp2.uk/plu-64d626ac9b414d000820e2fc.m3u8',
                logo: 'https://i.postimg.cc/VsW3Jsrz/logo-dazn-combat.png',
                group: 'Sports',
                groupTags: ['sports', 'united kingdom'],
                tvgId: 'DAZNCombat.uk@SD'
            },
            {
                id: 'sport_dazn_ringside',
                name: 'DAZN Ringside',
                url: 'https://jmp2.uk/stvp-GBBD30000038U',
                logo: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/GBBD30000038U_20260421T123903SQUARE.png',
                group: 'Sports',
                groupTags: ['sports', 'united kingdom'],
                tvgId: 'GBBD30000038U'
            },
            {
                id: 'sport_dazn_rise',
                name: 'DAZN Rise (DE)',
                url: 'https://jmp2.uk/stvp-DEBD700001C5',
                logo: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/DEBD700001C5_20260421T123614SQUARE.png',
                group: 'Sports',
                groupTags: ['sports', 'germany'],
                tvgId: 'DEBD700001C5'
            },
            {
                id: 'sport_glory_kickboxing',
                name: 'GLORY Kickboxing',
                url: 'https://6f972d29.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWV1X0dsb3J5S2lja2JveGluZ19ITFM/playlist.m3u8',
                logo: 'https://i.imgur.com/tS7Ub7i.png',
                group: 'Sports',
                groupTags: ['sports', 'global'],
                tvgId: 'GloryKickboxing.us'
            },
            {
                id: 'sport_top_rank',
                name: 'Top Rank Classics',
                url: 'https://jmp2.uk/plu-64d160f53c785e0008df525e.m3u8',
                logo: 'https://images.pluto.tv/channels/64d160f53c785e0008df525e/colorLogoPNG.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'TopRankClassics.us'
            },
            {
                id: 'sport_wwe_nxt',
                name: 'WWE NXT',
                url: 'https://jmp2.uk/plu-6a30478d0be0264f4a4e227c.m3u8',
                logo: 'https://images.pluto.tv/channels/6a30478d0be0264f4a4e227c/colorLogoPNG_1789664021838.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'WWENXT.us'
            },
            {
                id: 'sport_tna_wrestling',
                name: 'TNA Wrestling',
                url: 'https://jmp2.uk/plu-59b722526996084038c01e1b.m3u8',
                logo: 'https://provider-static.plex.tv/epg/cms/production/5d4f68c3-82af-45e7-b2c4-39aff69f3ce0/TNAWrestling_Plex_LogoforDarkBG_1500x1000_-_Alex_TushinghamRDX.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'TNAWrestlingChannel.pl'
            },
            {
                id: 'sport_watch_aew',
                name: 'Watch AEW',
                url: 'https://live-manifest.production-public.tubi.io/live/512cbe42-c22e-40c8-90e3-7d62684f51a7/playlist.m3u8',
                logo: 'https://canvas-lb.tubitv.com/opts/yeAV3-c2XWfYzw==/e9cd4624-20d8-421b-b5ed-282769cf2f57/CHgQeDoFMS4xLjlAAQ==',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'WatchAEW.us'
            },
            {
                id: 'sport_swerve_combat',
                name: 'Swerve Combat',
                url: 'https://linear-253.frequency.stream/mt/roku/253/hls/master/playlist.m3u8',
                logo: 'https://i.imgur.com/eFZh7aG.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'SwerveCombat.us@SD'
            },
            {
                id: 'sport_swerve_sports',
                name: 'Swerve Sports',
                url: 'https://a-cdn.klowdtv.com/live3/swervewomenssports_720p/playlist.m3u8',
                logo: 'https://i.imgur.com/GT0Yi2T.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'SwerveSports.us@SD'
            },
            {
                id: 'sport_fite_247',
                name: 'FITE 24/7',
                url: 'https://d3d85c7qkywguj.cloudfront.net/scheduler/scheduleMaster/263.m3u8',
                logo: 'https://i.imgur.com/ESV6qgH.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'FITE247.us@SD'
            },
            {
                id: 'sport_xfc_tv',
                name: 'XFC TV',
                url: 'https://stream-us-east-1.getpublica.com/playlist.m3u8?network_id=2247',
                logo: 'https://i.imgur.com/LcfzmG0.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'XFCTV.us@SD'
            },
            {
                id: 'sport_fightbox',
                name: 'FightBox HD',
                url: 'https://nosignal1.antenaplay.ro/hls/fightbox-hd/index.m3u8',
                logo: 'https://i.imgur.com/mRsnztA.png',
                group: 'Sports',
                groupTags: ['sports', 'netherlands'],
                tvgId: 'FightBox.nl@HD'
            },
            {
                id: 'sport_nascar',
                name: 'NASCAR',
                url: 'https://live-manifest.production-public.tubi.io/live/3404f25c-24bd-4ced-9d72-f2b4d5f63c57/playlist.m3u8',
                logo: 'https://canvas-lb.tubitv.com/opts/1hBihc5u12jjfA==/7739dd1a-423d-4a56-92c7-d27129356eb0/CHgQeDoFMS4xLjlAAQ==',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'NASCAR.us'
            },
            {
                id: 'sport_rally_tv',
                name: 'Rally TV',
                url: 'https://rally-tv-live.akamaized.net/hls/live/2117704/RallyTV-Pri/master.m3u8',
                logo: 'https://i.postimg.cc/WtLq2C7c/logo-rally-tv.png',
                group: 'Sports',
                groupTags: ['sports', 'global'],
                tvgId: 'RallyTV.us@SD'
            },
            {
                id: 'sport_motorvision',
                name: 'Motorvision',
                url: 'https://mvg-mv.otteravision.com/mvg/mv/mv_1080p.m3u8',
                logo: 'https://i.imgur.com/v4kj8pI.png',
                group: 'Sports',
                groupTags: ['sports', 'germany'],
                tvgId: 'Motorvision.de@SD'
            },
            {
                id: 'sport_motorvision_plus',
                name: 'Motorvision+ (EN)',
                url: 'https://r.eu.cdn-redge.media/livehls/oeu/mt/live/motorvision_en/live.livx/playlist.m3u8',
                logo: 'https://i.imgur.com/5cs5GkJ.png',
                group: 'Sports',
                groupTags: ['sports', 'global'],
                tvgId: 'MotorvisionPlus.de@SD'
            },
            {
                id: 'sport_auto_motor_sport',
                name: 'Auto Motor und Sport (DE)',
                url: 'https://jmp2.uk/plu-5f760c3d41aa2d0007bfde19.m3u8',
                logo: 'https://images.pluto.tv/channels/5f760c3d41aa2d0007bfde19/colorLogoPNG.png',
                group: 'Sports',
                groupTags: ['sports', 'germany'],
                tvgId: 'AutoMotorSport.de'
            },
            {
                id: 'sport_racer_intl',
                name: 'RACER International',
                url: 'https://amg00378-mavtv-amg00378c2-rakuten-us-1048.playouts.now.amagi.tv/playlist/amg00378-mavtvfast-motorsportsnetwork-rakutenus/playlist.m3u8',
                logo: 'https://provider-static.plex.tv/epg/cms/production/dd4e5871-4347-49e3-9ea1-a8770ea9c518/RACER_Intl_logo_1500x1000.png',
                group: 'Sports',
                groupTags: ['sports', 'global'],
                tvgId: 'RACERInternational.pl@FAST'
            },
            {
                id: 'sport_floracing',
                name: 'FloRacing',
                url: 'https://amg02278-amg02278c1-flosports-worldwide-7592.playouts.now.amagi.tv/playlist.m3u8',
                logo: 'https://images.fubo.tv/channel-config-ui/station-logos/on-dark/floracing-white.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'FloRacing.us@HD'
            },
            {
                id: 'sport_flohockey',
                name: 'FloHockey',
                url: 'https://amg02278-amg02278c2-flosports-worldwide-9916.playouts.now.amagi.tv/playlist.m3u8',
                logo: 'https://images.fubo.tv/channel-config-ui/station-logos/on-dark/flohockey-white.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'FloHockey.us@HD'
            },
            {
                id: 'sport_fuel_tv',
                name: 'FUEL TV',
                url: 'https://amg01074-fueltv-fueltvemeaen-rakuten-b6j62.amagi.tv/hls/amagi_hls_data_rakutenAA-fueltvemeaen/CDN/master.m3u8',
                logo: 'https://i.imgur.com/I8mviBy.png',
                group: 'Sports',
                groupTags: ['sports', 'portugal'],
                tvgId: 'FUELTV.pt@EMEA'
            },
            {
                id: 'sport_world_freesports',
                name: 'World of Freesports',
                url: 'https://mainstreammedia-worldoffreesportsintl-rakuten.amagi.tv/playlist.m3u8',
                logo: 'https://i.imgur.com/lta5Mog.png',
                group: 'Sports',
                groupTags: ['sports', 'germany'],
                tvgId: 'WorldofFreesports.de@SD'
            },
            {
                id: 'sport_tennis_channel',
                name: 'Tennis Channel',
                url: 'https://cdn-ue1-prod.tsv2.amagi.tv/linear/amg01444-tennischannelth-tennischannelnl-samsungnl/playlist.m3u8',
                logo: 'https://i.imgur.com/tsljAnY.png',
                group: 'Sports',
                groupTags: ['sports', 'netherlands', 'tennis'],
                tvgId: 'TennisChannel.us@SD'
            },
            {
                id: 'sport_tennis_plus',
                name: 'Tennis+ (UK)',
                url: 'https://jmp2.uk/stvp-GB2000010ML',
                logo: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/GB2000010ML_20250624T021705SQUARE.png',
                group: 'Sports',
                groupTags: ['sports', 'united kingdom', 'tennis'],
                tvgId: 'GB2000010ML'
            },
            {
                id: 'sport_pga_tour',
                name: 'PGA Tour',
                url: 'https://d11k1mnrgfposz.cloudfront.net/playlist.m3u8',
                logo: 'https://i.imgur.com/J0TY9dG.png',
                group: 'Sports',
                groupTags: ['sports', 'united states', 'golf'],
                tvgId: 'PGATour.us@SD'
            },
            {
                id: 'sport_golf_channel',
                name: 'Golf Channel',
                url: 'https://tvsen6.aynaott.com/golfchannel/index.m3u8',
                logo: 'https://i.imgur.com/Lgux6Ik.png',
                group: 'Sports',
                groupTags: ['sports', 'united states', 'golf'],
                tvgId: 'GolfChannel.us@SD'
            },
            {
                id: 'sport_golfpass',
                name: 'GolfPass',
                url: 'https://jmp2.uk/plu-65493029ab052400089e9d2f.m3u8',
                logo: 'https://images.pluto.tv/channels/65493029ab052400089e9d2f/colorLogoPNG_1766432879705.png',
                group: 'Sports',
                groupTags: ['sports', 'united states', 'golf'],
                tvgId: 'GolfPass.us'
            },
            {
                id: 'sport_30a_golf',
                name: '30A Golf Kingdom',
                url: 'https://30a-tv.com/feeds/vidaa/golf.m3u8',
                logo: 'https://i.imgur.com/Lv53nh4.png',
                group: 'Sports',
                groupTags: ['sports', 'united states', 'golf'],
                tvgId: '30AGolfKingdom.us@SD'
            },
            {
                id: 'sport_dazn_darts',
                name: 'DAZN Darts',
                url: 'https://jmp2.uk/plu-64b67f0424ade50008a3be17.m3u8',
                logo: 'https://images.pluto.tv/channels/64b67f0424ade50008a3be17/colorLogoPNG.png',
                group: 'Sports',
                groupTags: ['sports', 'germany'],
                tvgId: 'DAZNDartsxPlutoTV.de'
            },
            {
                id: 'sport_modus_darts',
                name: 'MODUS Super Series Darts',
                url: 'https://jmp2.uk/plu-67063e78b2ffb10008195d08.m3u8',
                logo: 'https://images.pluto.tv/channels/67063e78b2ffb10008195d08/colorLogoPNG.png',
                group: 'Sports',
                groupTags: ['sports', 'united kingdom'],
                tvgId: 'MODUSSuperSeriesDarts.uk'
            },
            {
                id: 'sport_snooker_900',
                name: 'Snooker 900',
                url: 'https://jmp2.uk/plu-655b7cbb2c46f300086f0afa.m3u8',
                logo: 'https://images.pluto.tv/channels/655b7cbb2c46f300086f0afa/colorLogoPNG_1759435114417.png',
                group: 'Sports',
                groupTags: ['sports', 'united kingdom'],
                tvgId: 'PlutoTVSnooker900.uk'
            },
            {
                id: 'sport_world_billiards',
                name: 'World Billiards',
                url: 'https://9a81dd4ee3884d0dbcacafaf0d81327a.mediatailor.us-east-1.amazonaws.com/v1/master/04fd913bb278d8775298c26fdca9d9841f37601f/RakutenTV-eu_BilliardsTV/playlist.m3u8',
                logo: 'https://images-3.rakuten.tv/storage/global-live-channel/translation/artwork/80af06f2-a12e-4406-bd13-b932fd69fffe-width200-quality90.png',
                group: 'Sports',
                groupTags: ['sports', 'global'],
                tvgId: 'WorldBilliards.pl'
            },
            {
                id: 'sport_world_poker_tour',
                name: 'World Poker Tour',
                url: 'https://d2e00kr7m9coe4.cloudfront.net/scheduler/scheduleMaster/406.m3u8',
                logo: 'https://i.imgur.com/98kLMjj.png',
                group: 'Sports',
                groupTags: ['sports', 'global'],
                tvgId: 'WorldPokerTour.us@US'
            },
            {
                id: 'sport_pokergo',
                name: 'PokerGO',
                url: 'https://jmp2.uk/plu-5fc54366b04b2300072e31af.m3u8',
                logo: 'https://i.imgur.com/1603HED.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'PokerGo.us@US'
            },
            {
                id: 'sport_triton_poker',
                name: 'Triton Poker',
                url: 'https://jmp2.uk/rok-3b1bd759566ea4c0fe9d7d6eb354d23d.m3u8',
                logo: 'https://images.sr.roku.com/idType/roku-trc/context/trc/id/3b1bd759566ea4c0fe9d7d6eb354d23d/https%3A%2F%2Fimage.roku.com%2Fbh-uploads%2Fproduction%2FinfoHUDLogo%2F1783457506047_triton_poker_logo_hud.png',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'TritonPoker.us'
            },
            {
                id: 'sport_rugbypass_tv',
                name: 'RugbyPass TV',
                url: 'https://jmp2.uk/plu-66f137cb483d460008ece053.m3u8',
                logo: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/GB330000144_20250624T020553SQUARE.png',
                group: 'Sports',
                groupTags: ['sports', 'united kingdom'],
                tvgId: 'RugbyPassTV.uk@SD'
            },
            {
                id: 'sport_cricket_gold',
                name: 'Cricket Gold',
                url: 'https://streams2.sofast.tv/ptnr-yupptv/title-cricketgold/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/b2048bb8-1686-4432-aa50-647245383e0c/manifest.m3u8',
                logo: 'https://resources.cricket-australia.pulselive.com/cricket-australia/photo/2025/07/25/836eddae-4329-4542-ad17-dcd37e9d951a/Cricket-Gold-1920x1080_noBG.png',
                group: 'Sports',
                groupTags: ['sports', 'global'],
                tvgId: 'CricketGold.au@SD'
            },
            {
                id: 'sport_padel_time',
                name: 'Padel Time TV',
                url: 'https://jmp2.uk/stvp-GB4700003NV',
                logo: 'https://tvpnlogopeu.samsungcloud.tv/platform/image/sourcelogo/vc/00/02/34/GB4700003NV_20260622T064044SQUARE.png',
                group: 'Sports',
                groupTags: ['sports', 'united kingdom'],
                tvgId: 'GB4700003NV'
            },
            {
                id: 'sport_horse_country',
                name: 'Horse & Country TV',
                url: 'https://hnc-free-viewlift.amagi.tv/HNC_AUSTRALIA.m3u8',
                logo: 'https://i.imgur.com/1x6zYZr.png',
                group: 'Sports',
                groupTags: ['sports', 'netherlands'],
                tvgId: 'HorseCountryTV.uk@SD'
            },
            {
                id: 'sport_lacrosse_tv',
                name: 'Lacrosse TV',
                url: 'https://a-cdn.klowdtv.com/live2/lsn_720p/playlist.m3u8',
                logo: 'https://yt3.googleusercontent.com/ytc/AIdro_m_xSJFydxZ9QBU-85OuchjmzS0Bo0_Tukmk7to8hBfyl8=s512-c-k-c0x00ffffff-no-rj',
                group: 'Sports',
                groupTags: ['sports', 'united states'],
                tvgId: 'LacrosseTV.us@SD'
            },
            {
                id: 'sport_strongman',
                name: 'Strongman Champions League',
                url: 'https://rightsboosterltd-scl-1-us.xumo.wurl.tv/playlist.m3u8',
                logo: 'https://images-0.rakuten.tv/storage/global-live-channel/translation/artwork/30ccc088-dca7-4458-ad5a-328fef06e1ca-width200-quality90.png',
                group: 'Sports',
                groupTags: ['sports', 'global'],
                tvgId: 'StrongmanChampionsLeague.us@SD'
            }
        ];

        return verifiedStreams.map(item => this.createChannel({
            ...item,
            headers: StreamOptimizer.getRequiredHeaders(item.url),
            isSports: true
        }));
    }
}
