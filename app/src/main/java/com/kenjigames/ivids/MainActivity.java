package com.kenjigames.ivids;

import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;
import java.io.ByteArrayInputStream;
import java.util.HashSet;
import java.util.Set;

public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";
    private static final Set<String> AD_HOSTS = new HashSet<>();
    static {
        AD_HOSTS.add("doubleclick.net");
        AD_HOSTS.add("admob.com");
        AD_HOSTS.add("googlesyndication.com");
        AD_HOSTS.add("google-analytics.com");
        AD_HOSTS.add("ads.google.com");
        AD_HOSTS.add("pagead2.googlesyndication.com");
        AD_HOSTS.add("ad.doubleclick.net");
        AD_HOSTS.add("googleads.g.doubleclick.net");
        AD_HOSTS.add("pubads.g.doubleclick.net");
        AD_HOSTS.add("securepubads.g.doubleclick.net");
        AD_HOSTS.add("adservice.google.com");
        AD_HOSTS.add("app-measurement.com");
        AD_HOSTS.add("inmobi.com");
        AD_HOSTS.add("mopub.com");
        AD_HOSTS.add("unity3d.com");
        AD_HOSTS.add("applovin.com");
        AD_HOSTS.add("chartboost.com");
        AD_HOSTS.add("vungle.com");
        AD_HOSTS.add("startapp.com");
        AD_HOSTS.add("flurry.com");
        AD_HOSTS.add("adcolony.com");
        AD_HOSTS.add("ads.facebook.com");
        AD_HOSTS.add("analytics.yahoo.com");
        AD_HOSTS.add("admarvel.com");
        AD_HOSTS.add("millennialmedia.com");
        AD_HOSTS.add("supersonicads.com");
        AD_HOSTS.add("tapjoy.com");
        AD_HOSTS.add("ironsrc.com");
        AD_HOSTS.add("fyber.com");
        AD_HOSTS.add("conversantmedia.com");
        AD_HOSTS.add("criteo.com");
        AD_HOSTS.add("taboola.com");
        AD_HOSTS.add("outbrain.com");
        AD_HOSTS.add("revcontent.com");
        AD_HOSTS.add("smaato.com");
        AD_HOSTS.add("googletagservices.com");
        AD_HOSTS.add("googletagmanager.com");
        AD_HOSTS.add("connect.facebook.net");
        AD_HOSTS.add("adnxs.com");
        AD_HOSTS.add("openx.net");
        AD_HOSTS.add("rubiconproject.com");
        AD_HOSTS.add("advertising.com");
        AD_HOSTS.add("media.net");
        AD_HOSTS.add("pubmatic.com");
        AD_HOSTS.add("yieldmo.com");
        AD_HOSTS.add("sharethrough.com");
        AD_HOSTS.add("adsrvr.org");
        AD_HOSTS.add("2mdn.net");
        AD_HOSTS.add("yandex.ru");
        AD_HOSTS.add("scorecardresearch.com");
        AD_HOSTS.add("amazon-adsystem.com");
        AD_HOSTS.add("casalemedia.com");
        AD_HOSTS.add("contextweb.com");
        AD_HOSTS.add("tribalfusion.com");
        AD_HOSTS.add("quantserve.com");
        AD_HOSTS.add("mathtag.com");
        AD_HOSTS.add("bidswitch.net");
        AD_HOSTS.add("openx.com");
        AD_HOSTS.add("an.yandex.ru");
        AD_HOSTS.add("imasdk.googleapis.com");
        AD_HOSTS.add("adroll.com");
        AD_HOSTS.add("rlcdn.com");
        AD_HOSTS.add("ads.yahoo.com");
        AD_HOSTS.add("ads.twitter.com");
        AD_HOSTS.add("ads.linkedin.com");
        AD_HOSTS.add("ads.pinterest.com");
        AD_HOSTS.add("ads.snapchat.com");
        AD_HOSTS.add("ads.tiktok.com");
        AD_HOSTS.add("analytics.tiktok.com");
        AD_HOSTS.add("bat.bing.com");
        AD_HOSTS.add("ad.zaloapp.com");
        AD_HOSTS.add("ad.atdmt.com");
        AD_HOSTS.add("ad.wsod.com");
        AD_HOSTS.add("ad.watch.tv");
        AD_HOSTS.add("ad.turn.com");
        AD_HOSTS.add("ad.tradedoubler.com");
        AD_HOSTS.add("ad.tiscali.it");
        AD_HOSTS.add("ad.terra.com.br");
        AD_HOSTS.add("ad.tagdelivery.com");
        AD_HOSTS.add("ad.tagul.com");
        AD_HOSTS.add("ad.tandem.com");
        AD_HOSTS.add("ad.systran.com");
        AD_HOSTS.add("ad.sueddeutsche.de");
        AD_HOSTS.add("ad.specificclick.net");
        AD_HOSTS.add("ad.speedbit.com");
        AD_HOSTS.add("ad.simpli.fi");
        AD_HOSTS.add("ad.shop.com");
        AD_HOSTS.add("ad.seznam.cz");
        AD_HOSTS.add("ad.sensismediasmart.com.au");
        AD_HOSTS.add("ad.scanmedios.com");
        AD_HOSTS.add("ad.republika.co.id");
        AD_HOSTS.add("ad.renren.com");
        AD_HOSTS.add("ad.reduxmedia.com");
        AD_HOSTS.add("ad.rambler.ru");
        AD_HOSTS.add("ad.quikr.com");
        AD_HOSTS.add("ad.qip.ru");
        AD_HOSTS.add("ad.qq.com");
        AD_HOSTS.add("ad.primogif.com");
        AD_HOSTS.add("ad.pressboard.ca");
        AD_HOSTS.add("ad.pconline.com.cn");
        AD_HOSTS.add("ad.path.com");
        AD_HOSTS.add("ad.pandora.tv");
        AD_HOSTS.add("ad.orange.co.uk");
        AD_HOSTS.add("ad.orbitz.com");
        AD_HOSTS.add("ad.optusnet.com.au");
        AD_HOSTS.add("ad.opinionstage.com");
        AD_HOSTS.add("ad.onespot.com");
        AD_HOSTS.add("ad.onet.pl");
        AD_HOSTS.add("ad.omegle.com");
        AD_HOSTS.add("ad.nuggad.net");
        AD_HOSTS.add("ad.noos.fr");
        AD_HOSTS.add("ad.nl");
        AD_HOSTS.add("ad.netmera.com");
        AD_HOSTS.add("ad.netdna-cdn.com");
        AD_HOSTS.add("ad.nate.com");
        AD_HOSTS.add("ad.mywebsearch.com");
        AD_HOSTS.add("ad.msn.com");
        AD_HOSTS.add("ad.mirror.co.uk");
        AD_HOSTS.add("ad.mail.ru");
        AD_HOSTS.add("ad.madvertise.de");
        AD_HOSTS.add("ad.lycos.com");
        AD_HOSTS.add("ad.lgappstv.com");
        AD_HOSTS.add("ad.letv.com");
        AD_HOSTS.add("ad.lemonde.fr");
        AD_HOSTS.add("ad.lavanet.ru");
        AD_HOSTS.add("ad.lapresse.ca");
        AD_HOSTS.add("ad.joins.com");
        AD_HOSTS.add("ad.interia.pl");
        AD_HOSTS.add("ad.infoseek.co.jp");
        AD_HOSTS.add("ad.infobae.com");
        AD_HOSTS.add("ad.infobae.com");
        AD_HOSTS.add("ad.indiatimes.com");
        AD_HOSTS.add("ad.impress.co.jp");
        AD_HOSTS.add("ad.ilivid.com");
        AD_HOSTS.add("ad.ibtimes.com");
        AD_HOSTS.add("ad.hexun.com");
        AD_HOSTS.add("ad.hulu.com");
        AD_HOSTS.add("ad.haber7.com");
        AD_HOSTS.add("ad.groupon.com");
        AD_HOSTS.add("ad.globeandmail.com");
        AD_HOSTS.add("ad.giga.de");
        AD_HOSTS.add("ad.geocities.com");
        AD_HOSTS.add("ad.gawker.com");
        AD_HOSTS.add("ad.foxnetworks.com");
        AD_HOSTS.add("ad.focalink.com");
        AD_HOSTS.add("ad.flashtalking.com");
        AD_HOSTS.add("ad.findly.com");
        AD_HOSTS.add("ad.eurosport.com");
        AD_HOSTS.add("ad.eonline.com");
        AD_HOSTS.add("ad.elsevier.com");
        AD_HOSTS.add("ad.digitoday.com");
        AD_HOSTS.add("ad.digitru.st");
        AD_HOSTS.add("ad.daum.net");
        AD_HOSTS.add("ad.crwdcntrl.net");
        AD_HOSTS.add("ad.cnet.com");
        AD_HOSTS.add("ad.chosun.com");
        AD_HOSTS.add("ad.canalplus.fr");
        AD_HOSTS.add("ad.ca.msn.com");
        AD_HOSTS.add("ad.broadspring.com");
        AD_HOSTS.add("ad.bn.ee");
        AD_HOSTS.add("ad.bloomberg.com");
        AD_HOSTS.add("ad.bharatmatrimony.com");
        AD_HOSTS.add("ad.beinsports.com");
        AD_HOSTS.add("ad.baidu.com");
        AD_HOSTS.add("ad.auditude.com");
        AD_HOSTS.add("ad.au.msn.com");
        AD_HOSTS.add("ad.wsj.com");
        AD_HOSTS.add("ad.adsmart.net");
        AD_HOSTS.add("ad.adjuggler.net");
        AD_HOSTS.add("ad.adtoma.com");
        AD_HOSTS.add("ad.adserver.com");

        // Added VidSrc specific ad/tracking hosts
        AD_HOSTS.add("vidsrc.xyz");
        AD_HOSTS.add("vidplay.site");
        AD_HOSTS.add("2embed.cc");
        AD_HOSTS.add("proadblocker.xyz");
        AD_HOSTS.add("ad-delivery.net");
        AD_HOSTS.add("clickbored.com");
        AD_HOSTS.add("mmo-ads.com");
        AD_HOSTS.add("vidsrc.stream");
        AD_HOSTS.add("upstream.to");
        AD_HOSTS.add("dood.to");
        AD_HOSTS.add("fembed.com");
        AD_HOSTS.add("rabbitstream.net");
        AD_HOSTS.add("dokicloud.one");
        AD_HOSTS.add("megacloud.tv");
        AD_HOSTS.add("vizcloud.online");
        AD_HOSTS.add("vidsrc.me");
        AD_HOSTS.add("playercdn.net");
        AD_HOSTS.add("vidstreaming.io");
        AD_HOSTS.add("streamtape.com");
        AD_HOSTS.add("mixdrop.co");
        AD_HOSTS.add("gogoplay.io");

        // More general ad hosts
        AD_HOSTS.add("adswizz.com");
        AD_HOSTS.add("smartadserver.com");
        AD_HOSTS.add("indexexchange.com");
        AD_HOSTS.add("spotx.tv");
        AD_HOSTS.add("bidvertiser.com");
        AD_HOSTS.add("popads.net");
        AD_HOSTS.add("propellerads.com");
        AD_HOSTS.add("zeropark.com");
        AD_HOSTS.add("adsterra.com");
        AD_HOSTS.add("exoclick.com");
        AD_HOSTS.add("plugrush.com");
        AD_HOSTS.add("juicyads.com");
        AD_HOSTS.add("ero-advertising.com");
        AD_HOSTS.add("doublepimp.com");
        AD_HOSTS.add("ad4game.com");
        AD_HOSTS.add("adform.net");
        AD_HOSTS.add("adriver.ru");
        AD_HOSTS.add("weborama.fr");
        AD_HOSTS.add("ligatus.com");
        AD_HOSTS.add("teads.tv");
        AD_HOSTS.add("adblade.com");
        AD_HOSTS.add("disqusads.com");
        AD_HOSTS.add("liveadexchanger.com");
        AD_HOSTS.add("revjet.com");
        AD_HOSTS.add("adkernel.com");
    }

    private WebView mWebView;
    private UpdateManager mUpdateManager;

    private void simulateClick(float x, float y) {
        try {
            long duration = android.os.SystemClock.uptimeMillis();
            android.view.MotionEvent downEvent = android.view.MotionEvent.obtain(duration, duration,
                    android.view.MotionEvent.ACTION_DOWN, x, y, 0);
            android.view.MotionEvent upEvent = android.view.MotionEvent.obtain(duration, duration + 100,
                    android.view.MotionEvent.ACTION_UP, x, y, 0);
            mWebView.dispatchTouchEvent(downEvent);
            mWebView.dispatchTouchEvent(upEvent);
            downEvent.recycle();
            upEvent.recycle();
        } catch (Exception e) {
            Log.e(TAG, "Failed to simulate click", e);
        }
    }

    @Override
    public boolean dispatchKeyEvent(android.view.KeyEvent event) {
        int keyCode = event.getKeyCode();
        if (event.getAction() == android.view.KeyEvent.ACTION_DOWN) {
            if (keyCode == android.view.KeyEvent.KEYCODE_DPAD_CENTER
                    || keyCode == android.view.KeyEvent.KEYCODE_ENTER) {
                String url = mWebView.getUrl();
                if (url != null && !url.contains("file:///android_asset/")) {
                    // We are in the player iframe or external content
                    simulateClick(mWebView.getWidth() / 2f, mWebView.getHeight() / 2f);
                    return true;
                }
            }
        }
        return super.dispatchKeyEvent(event);
    }

    private static class AdBlockingWebViewClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (url != null && isAd(url.getHost())) {
                Log.d(TAG, "Blocking ad request: " + url);
                return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream("".getBytes()));
            }
            return super.shouldInterceptRequest(view, request);
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            if (url != null && (url.contains("vidsrc.net") || url.contains("vidsrc.xyz"))) {
                // Auto-click the center after a delay to simulate autoplay
                view.postDelayed(() -> {
                    if (view.getContext() instanceof MainActivity) {
                        MainActivity activity = (MainActivity) view.getContext();
                        if (!activity.isFinishing() && !activity.isDestroyed()) {
                            activity.simulateClick(view.getWidth() / 2f, view.getHeight() / 2f);
                        }
                    }
                }, 4000); // 4 seconds delay to allow buffer/loading
            }
        }

        @RequiresApi(Build.VERSION_CODES.M)
        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            super.onReceivedError(view, request, error);
            if (request.isForMainFrame()) {
                Log.e(TAG, "Error loading page: " + error.getDescription());
                // Optionally, show a custom error page
                // view.loadUrl("file:///android_asset/error.html");
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            super.onReceivedHttpError(view, request, errorResponse);
            if (request.isForMainFrame()) {
                Log.e(TAG, "HTTP error " + errorResponse.getStatusCode() + " while loading " + request.getUrl());
            }
        }

        private boolean isAd(@Nullable String host) {
            if (host == null)
                return false;
            for (String adHost : AD_HOSTS) {
                if (host.contains(adHost))
                    return true;
            }
            return false;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        mWebView = new WebView(this);
        setContentView(mWebView);

        WebSettings webSettings = mWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setAllowContentAccess(true);
        webSettings.setAllowFileAccessFromFileURLs(true);
        webSettings.setAllowUniversalAccessFromFileURLs(true);
        webSettings.setDatabaseEnabled(true);
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // Block popups
        webSettings.setJavaScriptCanOpenWindowsAutomatically(false);
        webSettings.setSupportMultipleWindows(false);

        mWebView.setWebViewClient(new AdBlockingWebViewClient());

        mUpdateManager = new UpdateManager(this, mWebView);
        mWebView.addJavascriptInterface(mUpdateManager, "AndroidUpdate");

        mWebView.setWebChromeClient(new android.webkit.WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture,
                    android.os.Message resultMsg) {
                // Return false to prevent window creation (blocks popups)
                return false;
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d("WebView", consoleMessage.message() + " -- From line "
                        + consoleMessage.lineNumber() + " of "
                        + consoleMessage.sourceId());
                return true;
            }
        });

        mWebView.loadUrl("file:///android_asset/main/gui/index.html");
    }
}
