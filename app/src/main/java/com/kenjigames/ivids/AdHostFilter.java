package com.kenjigames.ivids;

import androidx.annotation.Nullable;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Domain-suffix ad host filter for WebView request interception.
 * Performs O(labels) exact and parent-suffix lookups to avoid false positives from substring matching.
 */
public final class AdHostFilter {

    private static final Set<String> AD_HOSTS = Collections.unmodifiableSet(new HashSet<>(Arrays.asList(
            "doubleclick.net", "admob.com", "googlesyndication.com", "google-analytics.com",
            "ads.google.com", "pagead2.googlesyndication.com", "ad.doubleclick.net",
            "googleads.g.doubleclick.net", "pubads.g.doubleclick.net", "securepubads.g.doubleclick.net",
            "adservice.google.com", "app-measurement.com", "inmobi.com", "mopub.com",
            "unity3d.com", "applovin.com", "chartboost.com", "vungle.com", "startapp.com",
            "flurry.com", "adcolony.com", "ads.facebook.com", "analytics.yahoo.com",
            "admarvel.com", "millennialmedia.com", "supersonicads.com", "tapjoy.com",
            "ironsrc.com", "fyber.com", "conversantmedia.com", "criteo.com", "taboola.com",
            "outbrain.com", "revcontent.com", "smaato.com", "googletagservices.com",
            "googletagmanager.com", "connect.facebook.net", "adnxs.com", "openx.net",
            "rubiconproject.com", "advertising.com", "media.net", "pubmatic.com",
            "yieldmo.com", "sharethrough.com", "adsrvr.org", "2mdn.net", "yandex.ru",
            "scorecardresearch.com", "amazon-adsystem.com", "casalemedia.com", "contextweb.com",
            "tribalfusion.com", "quantserve.com", "mathtag.com", "bidswitch.net", "openx.com",
            "an.yandex.ru", "imasdk.googleapis.com", "adroll.com", "rlcdn.com",
            "ads.yahoo.com", "ads.twitter.com", "ads.linkedin.com", "ads.pinterest.com",
            "ads.snapchat.com", "ads.tiktok.com", "analytics.tiktok.com", "bat.bing.com",
            "ad.zaloapp.com", "ad.atdmt.com", "ad.wsod.com", "ad.watch.tv", "ad.turn.com",
            "ad.tradedoubler.com", "ad.tiscali.it", "ad.terra.com.br", "ad.tagdelivery.com",
            "ad.tagul.com", "ad.tandem.com", "ad.systran.com", "ad.sueddeutsche.de",
            "ad.specificclick.net", "ad.speedbit.com", "ad.simpli.fi", "ad.shop.com",
            "ad.seznam.cz", "ad.sensismediasmart.com.au", "ad.scanmedios.com", "ad.republika.co.id",
            "ad.renren.com", "ad.reduxmedia.com", "ad.rambler.ru", "ad.quikr.com", "ad.qip.ru",
            "ad.qq.com", "ad.primogif.com", "ad.pressboard.ca", "ad.pconline.com.cn",
            "ad.path.com", "ad.pandora.tv", "ad.orange.co.uk", "ad.orbitz.com",
            "ad.optusnet.com.au", "ad.opinionstage.com", "ad.onespot.com", "ad.onet.pl",
            "ad.omegle.com", "ad.nuggad.net", "ad.noos.fr", "ad.nl", "ad.netmera.com",
            "ad.netdna-cdn.com", "ad.nate.com", "ad.mywebsearch.com", "ad.msn.com",
            "ad.mirror.co.uk", "ad.mail.ru", "ad.madvertise.de", "ad.lycos.com",
            "ad.lgappstv.com", "ad.letv.com", "ad.lemonde.fr", "ad.lavanet.ru",
            "ad.lapresse.ca", "ad.joins.com", "ad.interia.pl", "ad.infoseek.co.jp",
            "ad.infobae.com", "ad.indiatimes.com", "ad.impress.co.jp", "ad.ilivid.com",
            "ad.ibtimes.com", "ad.hexun.com", "ad.hulu.com", "ad.haber7.com",
            "ad.groupon.com", "ad.globeandmail.com", "ad.giga.de", "ad.geocities.com",
            "ad.gawker.com", "ad.foxnetworks.com", "ad.focalink.com", "ad.flashtalking.com",
            "ad.findly.com", "ad.eurosport.com", "ad.eonline.com", "ad.elsevier.com",
            "ad.digitoday.com", "ad.digitru.st", "ad.daum.net", "ad.crwdcntrl.net",
            "ad.cnet.com", "ad.chosun.com", "ad.canalplus.fr", "ad.ca.msn.com",
            "ad.broadspring.com", "ad.bn.ee", "ad.bloomberg.com", "ad.bharatmatrimony.com",
            "ad.beinsports.com", "ad.baidu.com", "ad.auditude.com", "ad.au.msn.com",
            "ad.wsj.com", "ad.adsmart.net", "ad.adjuggler.net", "ad.adtoma.com",
            "ad.adserver.com", "vidsrc.xyz", "vidplay.site", "2embed.cc", "proadblocker.xyz",
            "ad-delivery.net", "clickbored.com", "mmo-ads.com", "vidsrc.stream",
            "upstream.to", "dood.to", "fembed.com", "rabbitstream.net", "dokicloud.one",
            "megacloud.tv", "vizcloud.online", "vidsrc.me", "playercdn.net", "vidstreaming.io",
            "streamtape.com", "mixdrop.co", "gogoplay.io", "adswizz.com", "smartadserver.com",
            "indexexchange.com", "spotx.tv", "bidvertiser.com", "popads.net",
            "propellerads.com", "zeropark.com", "adsterra.com", "exoclick.com",
            "plugrush.com", "juicyads.com", "ero-advertising.com", "doublepimp.com",
            "ad4game.com", "adform.net", "adriver.ru", "weborama.fr", "ligatus.com",
            "teads.tv", "adblade.com", "disqusads.com", "liveadexchanger.com",
            "revjet.com", "adkernel.com"
    )));

    private AdHostFilter() {}

    /**
     * Checks whether the given hostname or any of its parent domain suffixes is in AD_HOSTS.
     * Prevents false-positive blocks (such as blocking download.nl because ad.nl is listed).
     *
     * @param host Candidate request hostname.
     * @return true if the host or a parent domain matches the blocklist.
     */
    public static boolean isAdHost(@Nullable String host) {
        if (host == null || host.isEmpty()) {
            return false;
        }
        String candidate = host.toLowerCase(Locale.ROOT);
        while (!candidate.isEmpty()) {
            if (AD_HOSTS.contains(candidate)) {
                return true;
            }
            int dot = candidate.indexOf('.');
            if (dot < 0 || dot + 1 >= candidate.length()) {
                break;
            }
            candidate = candidate.substring(dot + 1);
        }
        return false;
    }
}
