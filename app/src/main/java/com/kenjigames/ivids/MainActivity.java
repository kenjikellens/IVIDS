package com.kenjigames.ivids;

import android.content.Context;
import android.graphics.Bitmap;
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
import androidx.core.view.WindowCompat;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.HashSet;
import java.util.Set;
import java.util.zip.GZIPInputStream;

/**
 * MainActivity is the primary entry point for the IVIDS Android application.
 * It initializes a full-screen WebView, configures hardware acceleration, handles permissions,
 * and sets up a custom WebChromeClient and AdBlockingWebViewClient to run the web application smoothly.
 */
@RequiresApi(Build.VERSION_CODES.LOLLIPOP)
public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";
    private static final String APP_ASSET_HOST = "appassets.androidplatform.net";
    private static final String APP_ASSET_ORIGIN = "https://" + APP_ASSET_HOST;
    private static final String APP_ASSET_PREFIX = APP_ASSET_ORIGIN + "/assets/";
    private static final String APP_INDEX_URL = APP_ASSET_PREFIX + "main/gui/index.html";
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

    /**
     * Simulates a physical touch click on the screen at the specified coordinates.
     * This is primarily used to bypass browser autoplay restrictions by forcing a simulated user interaction.
     * 
     * @param x The X coordinate of the screen to click on.
     * @param y The Y coordinate of the screen to click on.
     */
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

    /**
     * Intercepts hardware remote/keyboard key events before they are processed by the WebView.
     * If the user presses the 'ENTER' or 'DPAD_CENTER' button while in the player iframe,
     * it triggers a simulated click to ensure TV remote compatibility.
     * 
     * @param event The KeyEvent dispatched to the Activity.
     * @return true if the event was handled, otherwise returns the superclass implementation.
     */
    @Override
    public boolean dispatchKeyEvent(android.view.KeyEvent event) {
        int keyCode = event.getKeyCode();
        if (event.getAction() == android.view.KeyEvent.ACTION_DOWN) {
            if (keyCode == android.view.KeyEvent.KEYCODE_DPAD_CENTER
                    || keyCode == android.view.KeyEvent.KEYCODE_ENTER) {
                String url = mWebView.getUrl();
                if (url != null && !isLocalAppUrl(url)) {
                    // We are in the player iframe or external content
                    simulateClick(mWebView.getWidth() / 2f, mWebView.getHeight() / 2f);
                    return true;
                }
            }
        }
        return super.dispatchKeyEvent(event);
    }

    /**
     * Checks whether a WebView URL belongs to the bundled local IVIDS application assets.
     * Supports both the HTTPS appassets origin and legacy file:///android_asset URLs.
     *
     * @param url Candidate URL string from WebView state or request headers.
     * @return true if the URL targets bundled application assets.
     */
    private static boolean isLocalAppUrl(@Nullable String url) {
        return url != null && (url.startsWith(APP_ASSET_PREFIX) || url.startsWith("file:///android_asset/"));
    }

    /**
     * A custom WebViewClient that aggressively blocks known advertisement domains, serves bundled
     * asset files over HTTPS with CORS/MIME headers for ES modules, and enforces local-app & SSRF
     * guards on the /proxy endpoint.
     */
    private static class AdBlockingWebViewClient extends WebViewClient {
        private final Context mAppContext;
        private volatile String mCurrentMainFrameUrl = APP_INDEX_URL;

        /**
         * Initializes the WebViewClient with the application context for safe asset loading on WebView IO threads.
         *
         * @param context Activity or application context.
         */
        AdBlockingWebViewClient(Context context) {
            this.mAppContext = context.getApplicationContext();
        }

        /**
         * Intercepts bundled asset requests, local /proxy requests, and known ad hosts.
         * Serves local assets over https://appassets.androidplatform.net/assets/ for Chromium ES module CORS compliance
         * and enforces caller/SSRF checks on /proxy.
         *
         * @param view The WebView requesting the resource.
         * @param request The WebResourceRequest containing URL, method, and headers.
         * @return A WebResourceResponse when handled/blocked, or null to let WebView proceed normally.
         */
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (url != null && "https".equalsIgnoreCase(url.getScheme()) && APP_ASSET_HOST.equalsIgnoreCase(url.getHost())) {
                String path = url.getPath();
                if (path != null && path.startsWith("/assets/")) {
                    return handleAssetRequest(url, "/assets/");
                }
                if ("/proxy".equals(path)) {
                    if (!isLocalAppProxyCaller(request)) {
                        return buildErrorResponse(403, "Forbidden", createCorsHeaders());
                    }
                    if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
                        return new WebResourceResponse("text/plain", "UTF-8", 200, "OK", createCorsHeaders(), new ByteArrayInputStream(new byte[0]));
                    }
                    return handleStreamProxyRequest(url);
                }
            }
            if (url != null && "file".equalsIgnoreCase(url.getScheme())) {
                String path = url.getPath();
                if (path != null && path.startsWith("/android_asset/")) {
                    return handleAssetRequest(url, "/android_asset/");
                }
            }
            if (url != null && ("localhost".equalsIgnoreCase(url.getHost()) || "127.0.0.1".equals(url.getHost())) && "/proxy".equals(url.getPath())) {
                if (!isLocalAppProxyCaller(request)) {
                    return buildErrorResponse(403, "Forbidden", createCorsHeaders());
                }
                if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
                    return new WebResourceResponse("text/plain", "UTF-8", 200, "OK", createCorsHeaders(), new ByteArrayInputStream(new byte[0]));
                }
                return handleStreamProxyRequest(url);
            }
            if (url != null && isAd(url.getHost())) {
                Log.d(TAG, "Blocking ad request: " + url);
                return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream("".getBytes()));
            }
            return super.shouldInterceptRequest(view, request);
        }

        /**
         * Updates the tracked main-frame URL when navigation starts so proxy caller checks stay thread-safe.
         *
         * @param view The WebView starting page load.
         * @param url The URL being loaded in the main frame.
         * @param favicon The page favicon if available.
         */
        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            super.onPageStarted(view, url, favicon);
            mCurrentMainFrameUrl = url != null ? url : "";
        }

        /**
         * Triggered when a page finishes loading in the WebView.
         * Updates tracked main-frame URL and triggers delayed autoplay clicks on supported embed providers.
         *
         * @param view The WebView that finished loading.
         * @param url The URL of the loaded page.
         */
        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            mCurrentMainFrameUrl = url != null ? url : "";
            if (url != null && (url.contains("vidsrc") || url.contains("vidlink") || url.contains("videasy") || url.contains("embed"))) {
                // Auto-click the center after a delay to simulate autoplay
                view.postDelayed(() -> {
                    if (view.getContext() instanceof MainActivity) {
                        MainActivity activity = (MainActivity) view.getContext();
                        if (!activity.isFinishing() && !activity.isDestroyed()) {
                            activity.simulateClick(view.getWidth() / 2f, view.getHeight() / 2f);
                        }
                    }
                }, 2500); // 2.5 seconds delay to allow player initialization
            }
        }

        /**
         * Triggered when the WebView encounters a generic resource loading error.
         * Logs the error description for debugging purposes.
         * 
         * @param view The WebView that encountered the error.
         * @param request The WebResourceRequest that failed.
         * @param error The WebResourceError containing the error code and description.
         */
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

        /**
         * Triggered when the WebView receives an HTTP error (e.g., 404 Not Found, 500 Internal Server Error) 
         * while loading a resource. Logs the error status code for debugging.
         * 
         * @param view The WebView that encountered the HTTP error.
         * @param request The WebResourceRequest that failed.
         * @param errorResponse The WebResourceResponse containing the HTTP status code.
         */
        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            super.onReceivedHttpError(view, request, errorResponse);
            if (request.isForMainFrame()) {
                Log.e(TAG, "HTTP error " + errorResponse.getStatusCode() + " while loading " + request.getUrl());
            }
        }

        /**
         * Creates standard permissive CORS headers for internal proxy and bundled asset responses.
         *
         * @return Mutable header map with CORS and no-store cache headers.
         */
        private Map<String, String> createCorsHeaders() {
            Map<String, String> corsHeaders = new HashMap<>();
            corsHeaders.put("Access-Control-Allow-Origin", "*");
            corsHeaders.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
            corsHeaders.put("Access-Control-Allow-Headers", "*");
            corsHeaders.put("Cache-Control", "no-store");
            return corsHeaders;
        }

        /**
         * Builds an empty HTTP error WebResourceResponse with CORS headers.
         *
         * @param statusCode HTTP status code to return.
         * @param reasonPhrase HTTP status reason text.
         * @param headers Response headers map.
         * @return WebResourceResponse representing the error.
         */
        private WebResourceResponse buildErrorResponse(int statusCode, String reasonPhrase, Map<String, String> headers) {
            return new WebResourceResponse("text/plain", "UTF-8", statusCode, reasonPhrase, headers, new ByteArrayInputStream(new byte[0]));
        }

        /**
         * Serves bundled android_asset files over WebView interception with accurate MIME types and CORS headers.
         * Rejects path traversal segments so ES module imports function safely over the HTTPS appassets origin.
         *
         * @param assetUri Requested asset URI.
         * @param prefix Path prefix to strip before opening the relative APK asset path.
         * @return WebResourceResponse containing asset stream or 403/404 response.
         */
        private WebResourceResponse handleAssetRequest(Uri assetUri, String prefix) {
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");

            String rawPath = assetUri.getPath();
            if (rawPath == null || !rawPath.startsWith(prefix)) {
                return buildErrorResponse(403, "Forbidden", headers);
            }
            String assetPath = rawPath.substring(prefix.length());
            if (assetPath.isEmpty() || assetPath.contains("\\") || assetPath.contains("\0") || rawPath.contains("..")) {
                return buildErrorResponse(403, "Forbidden", headers);
            }
            String[] segments = assetPath.split("/", -1);
            for (String segment : segments) {
                if (segment.isEmpty() || ".".equals(segment) || "..".equals(segment)) {
                    return buildErrorResponse(403, "Forbidden", headers);
                }
            }

            try {
                InputStream is = mAppContext.getAssets().open(assetPath);
                String mimeType = getAssetMimeType(assetPath);
                String encoding = isTextMimeType(mimeType) ? "UTF-8" : null;
                return new WebResourceResponse(mimeType, encoding, 200, "OK", headers, is);
            } catch (IOException e) {
                return buildErrorResponse(404, "Not Found", headers);
            }
        }

        /**
         * Maps bundled asset file extensions to accurate MIME types required by Chromium ES module loading.
         *
         * @param assetPath Normalized relative path within Android assets.
         * @return MIME type string.
         */
        private String getAssetMimeType(String assetPath) {
            String lower = assetPath.toLowerCase(Locale.ROOT);
            if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
            if (lower.endsWith(".css")) return "text/css";
            if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
            if (lower.endsWith(".json")) return "application/json";
            if (lower.endsWith(".svg")) return "image/svg+xml";
            if (lower.endsWith(".png")) return "image/png";
            if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
            if (lower.endsWith(".webp")) return "image/webp";
            if (lower.endsWith(".gif")) return "image/gif";
            if (lower.endsWith(".ico")) return "image/x-icon";
            if (lower.endsWith(".woff2")) return "font/woff2";
            if (lower.endsWith(".woff")) return "font/woff";
            if (lower.endsWith(".ttf")) return "font/ttf";
            if (lower.endsWith(".otf")) return "font/otf";
            if (lower.endsWith(".xml")) return "application/xml";
            if (lower.endsWith(".m3u") || lower.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
            if (lower.endsWith(".txt")) return "text/plain";
            return "application/octet-stream";
        }

        /**
         * Determines whether a MIME type represents UTF-8 text content rather than binary asset bytes.
         *
         * @param mimeType MIME type string.
         * @return true for text/script/markup MIME types, false for binary formats.
         */
        private boolean isTextMimeType(String mimeType) {
            return mimeType.startsWith("text/")
                    || "application/javascript".equals(mimeType)
                    || "application/json".equals(mimeType)
                    || "image/svg+xml".equals(mimeType)
                    || "application/xml".equals(mimeType)
                    || "application/vnd.apple.mpegurl".equals(mimeType);
        }

        /**
         * Verifies that a /proxy request originates from the bundled local app rather than external pages or iframes.
         *
         * @param request Intercepted WebResourceRequest targeting /proxy.
         * @return true if main frame and request headers match the local application origin.
         */
        private boolean isLocalAppProxyCaller(WebResourceRequest request) {
            if (request.isForMainFrame()) {
                return false;
            }
            String mainUrl = mCurrentMainFrameUrl;
            if (!isLocalAppUrl(mainUrl)) {
                return false;
            }
            Map<String, String> reqHeaders = request.getRequestHeaders();
            if (reqHeaders == null) {
                return false;
            }
            boolean hasTrustedReferer = false;
            boolean hasTrustedOrigin = false;
            boolean isSameOriginFetchSite = false;
            for (Map.Entry<String, String> entry : reqHeaders.entrySet()) {
                if (entry.getKey() == null || entry.getValue() == null) continue;
                String keyLower = entry.getKey().toLowerCase(Locale.ROOT);
                String val = entry.getValue().trim();
                if (val.isEmpty()) continue;
                if ("referer".equals(keyLower)) {
                    if (!val.startsWith(APP_ASSET_ORIGIN + "/") && !val.startsWith("file:///android_asset/")) {
                        return false;
                    }
                    hasTrustedReferer = true;
                }
                if ("sec-fetch-dest".equals(keyLower)) {
                    String destLower = val.toLowerCase(Locale.ROOT);
                    if ("document".equals(destLower) || "iframe".equals(destLower)) {
                        return false;
                    }
                }
                if ("sec-fetch-site".equals(keyLower)) {
                    String siteLower = val.toLowerCase(Locale.ROOT);
                    if ("cross-site".equals(siteLower) || "none".equals(siteLower)) {
                        return false;
                    }
                    if ("same-origin".equals(siteLower)) {
                        isSameOriginFetchSite = true;
                    }
                }
                if ("origin".equals(keyLower)) {
                    if (!APP_ASSET_ORIGIN.equalsIgnoreCase(val) && !"null".equalsIgnoreCase(val) && !val.startsWith("file://")) {
                        return false;
                    }
                    if (APP_ASSET_ORIGIN.equalsIgnoreCase(val)) {
                        hasTrustedOrigin = true;
                    }
                }
            }
            return hasTrustedReferer || hasTrustedOrigin || isSameOriginFetchSite;
        }

        /**
         * Validates that a proxy target URL uses http/https and does not resolve to loopback, link-local/metadata,
         * unspecified (0.0.0.0/8), or multicast addresses while preserving private LAN IPTV access.
         *
         * @param rawUrl Candidate upstream URL.
         * @return true if safe to connect, false otherwise (fails closed on DNS errors).
         */
        private boolean isSafeProxyUrl(String rawUrl) {
            if (rawUrl == null || rawUrl.trim().isEmpty()) {
                return false;
            }
            try {
                URI uri = new URI(rawUrl.trim());
                String scheme = uri.getScheme();
                if (scheme == null || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))) {
                    return false;
                }
                String host = uri.getHost();
                if (host == null || host.trim().isEmpty()) {
                    return false;
                }
                String hostLower = host.trim().toLowerCase(Locale.ROOT);
                if (hostLower.startsWith("[") && hostLower.endsWith("]")) {
                    hostLower = hostLower.substring(1, hostLower.length() - 1);
                }
                if ("localhost".equals(hostLower)
                        || hostLower.endsWith(".localhost")
                        || "0.0.0.0".equals(hostLower)
                        || "metadata".equals(hostLower)
                        || "metadata.google.internal".equals(hostLower)) {
                    return false;
                }

                InetAddress[] addresses = InetAddress.getAllByName(hostLower);
                if (addresses == null || addresses.length == 0) {
                    return false;
                }
                for (InetAddress addr : addresses) {
                    if (addr.isAnyLocalAddress()
                            || addr.isLoopbackAddress()
                            || addr.isLinkLocalAddress()
                            || addr.isMulticastAddress()) {
                        return false;
                    }
                    byte[] rawBytes = addr.getAddress();
                    if (rawBytes.length == 4) {
                        int b0 = rawBytes[0] & 0xFF;
                        int b1 = rawBytes[1] & 0xFF;
                        if (b0 == 127 || b0 == 0 || (b0 == 169 && b1 == 254)) {
                            return false;
                        }
                    }
                }
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /**
         * Native Android stream proxy handler for http://localhost/proxy?url=... requests.
         * Bypasses WebView CORS restrictions, enforces SSRF protections across redirects, uses strict TLS hostname verification,
         * and rewrites .m3u8 manifest sub-links for seamless Live TV playback in the APK.
         *
         * @param proxyUri Intercepted proxy URI containing target 'url' and optional header params.
         * @return WebResourceResponse with permissive CORS headers.
         */
        private WebResourceResponse handleStreamProxyRequest(Uri proxyUri) {
            Map<String, String> corsHeaders = createCorsHeaders();

            String targetUrl = proxyUri.getQueryParameter("url");
            if (targetUrl == null || targetUrl.isEmpty()) {
                return buildErrorResponse(400, "Bad Request", corsHeaders);
            }
            if (!isSafeProxyUrl(targetUrl)) {
                return buildErrorResponse(403, "Forbidden", corsHeaders);
            }

            String referer = proxyUri.getQueryParameter("referer");
            String origin = proxyUri.getQueryParameter("origin");
            String userAgent = proxyUri.getQueryParameter("user-agent");

            String chromeUa = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
            String vlcUa = "VLC/3.0.20 LibVLC/3.0.20";
            String lowerUrl = targetUrl.toLowerCase(Locale.ROOT);
            boolean isRawIptv = lowerUrl.matches("^https?://\\d+\\.\\d+\\.\\d+\\.\\d+.*") || lowerUrl.contains(":8008/") || lowerUrl.contains(":8080/") || lowerUrl.contains("/play/");

            String targetOrigin = null;
            try {
                URI parsed = new URI(targetUrl);
                if (parsed.getScheme() != null && parsed.getAuthority() != null) {
                    targetOrigin = parsed.getScheme() + "://" + parsed.getAuthority();
                }
            } catch (Exception ignored) {}

            String firstUa = (userAgent != null && !userAgent.isEmpty()) ? userAgent : (isRawIptv ? vlcUa : chromeUa);
            String[][] profiles = new String[][] {
                { firstUa, referer, origin },
                { vlcUa, null, null },
                { chromeUa, targetOrigin != null ? targetOrigin + "/" : referer, targetOrigin != null ? targetOrigin : origin }
            };

            HttpURLConnection conn = null;
            String winningUa = firstUa;
            String winningRef = referer;
            String winningOrig = origin;
            int statusCode = 502;
            boolean blockedRedirectSsrf = false;

            for (String[] prof : profiles) {
                try {
                    String currentUrl = targetUrl;
                    boolean completedNonRedirect = false;
                    for (int hop = 0; hop < 5; hop++) {
                        if (!isSafeProxyUrl(currentUrl)) {
                            blockedRedirectSsrf = true;
                            break;
                        }
                        URL u = new URL(currentUrl);
                        conn = (HttpURLConnection) u.openConnection();
                        conn.setInstanceFollowRedirects(false);
                        conn.setConnectTimeout(3000);
                        conn.setReadTimeout(4500);
                        conn.setRequestProperty("Connection", "keep-alive");
                        conn.setRequestProperty("User-Agent", prof[0]);
                        if (prof[1] != null && !prof[1].isEmpty()) conn.setRequestProperty("Referer", prof[1]);
                        if (prof[2] != null && !prof[2].isEmpty()) conn.setRequestProperty("Origin", prof[2]);
                        conn.setRequestProperty("Accept", "*/*");

                        statusCode = conn.getResponseCode();
                        if (statusCode == 301 || statusCode == 302 || statusCode == 303 || statusCode == 307 || statusCode == 308) {
                            String location = conn.getHeaderField("Location");
                            conn.disconnect();
                            conn = null;
                            if (location == null || location.isEmpty()) break;
                            String nextUrl = new URI(currentUrl).resolve(location).toString();
                            if (!isSafeProxyUrl(nextUrl)) {
                                blockedRedirectSsrf = true;
                                break;
                            }
                            currentUrl = nextUrl;
                            continue;
                        }
                        completedNonRedirect = true;
                        break;
                    }
                    if (blockedRedirectSsrf) {
                        if (conn != null) {
                            conn.disconnect();
                            conn = null;
                        }
                        break;
                    }
                    if (!completedNonRedirect || conn == null) {
                        if (conn != null) {
                            conn.disconnect();
                            conn = null;
                        }
                        continue;
                    }
                    if (statusCode == 401 || statusCode == 403 || statusCode == 406) {
                        conn.disconnect();
                        conn = null;
                        continue;
                    }
                    targetUrl = currentUrl;
                    lowerUrl = targetUrl.toLowerCase(Locale.ROOT);
                    winningUa = prof[0];
                    winningRef = prof[1];
                    winningOrig = prof[2];
                    break;
                } catch (Exception e) {
                    if (conn != null) {
                        conn.disconnect();
                        conn = null;
                    }
                }
            }

            if (blockedRedirectSsrf) {
                return buildErrorResponse(403, "Forbidden", corsHeaders);
            }

            if (conn == null || statusCode >= 400) {
                if (conn != null) conn.disconnect();
                return buildErrorResponse(statusCode >= 400 ? statusCode : 502, "Upstream Error", corsHeaders);
            }

            try {
                String contentType = conn.getContentType();
                if (contentType == null || contentType.isEmpty()) {
                    contentType = "application/octet-stream";
                }
                String contentEncoding = conn.getContentEncoding();
                boolean isGzipEncoded = (contentEncoding != null && contentEncoding.toLowerCase().contains("gzip"))
                        || lowerUrl.endsWith(".gz");
                boolean isM3u8 = lowerUrl.contains(".m3u8") || contentType.toLowerCase().contains("mpegurl");
                InputStream rawStream = isGzipEncoded ? new GZIPInputStream(conn.getInputStream()) : conn.getInputStream();
                if (isM3u8) {
                    StringBuilder sb = new StringBuilder();
                    try (BufferedReader reader = new BufferedReader(new InputStreamReader(rawStream, StandardCharsets.UTF_8))) {
                        String line;
                        StringBuilder extra = new StringBuilder();
                        if (winningRef != null && !winningRef.isEmpty()) extra.append("&referer=").append(URLEncoder.encode(winningRef, "UTF-8"));
                        if (winningOrig != null && !winningOrig.isEmpty()) extra.append("&origin=").append(URLEncoder.encode(winningOrig, "UTF-8"));
                        if (winningUa != null && !winningUa.isEmpty()) extra.append("&user-agent=").append(URLEncoder.encode(winningUa, "UTF-8"));
                        String suffix = extra.toString();
                        URI baseUri = new URI(targetUrl);

                        while ((line = reader.readLine()) != null) {
                            String trimmed = line.trim();
                            if (trimmed.isEmpty()) {
                                continue;
                            }
                            if (trimmed.startsWith("#")) {
                                if (trimmed.contains("URI=\"")) {
                                    int uStart = trimmed.indexOf("URI=\"") + 5;
                                    int uEnd = trimmed.indexOf("\"", uStart);
                                    if (uEnd > uStart) {
                                        String rawUri = trimmed.substring(uStart, uEnd);
                                        String resolvedUri = (rawUri.startsWith("http://") || rawUri.startsWith("https://"))
                                                ? rawUri
                                                : baseUri.resolve(rawUri).toString();
                                        String proxiedUri = APP_ASSET_ORIGIN + "/proxy?url=" + URLEncoder.encode(resolvedUri, "UTF-8") + suffix;
                                        trimmed = trimmed.substring(0, uStart) + proxiedUri + trimmed.substring(uEnd);
                                    }
                                }
                                sb.append(trimmed).append("\n");
                            } else {
                                String resolved = (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
                                        ? trimmed
                                        : baseUri.resolve(trimmed).toString();
                                sb.append(APP_ASSET_ORIGIN + "/proxy?url=")
                                  .append(URLEncoder.encode(resolved, "UTF-8"))
                                  .append(suffix)
                                  .append("\n");
                            }
                        }
                    } finally {
                        conn.disconnect();
                    }
                    byte[] bodyBytes = sb.toString().getBytes(StandardCharsets.UTF_8);
                    return new WebResourceResponse("application/vnd.apple.mpegurl", "UTF-8", 200, "OK", corsHeaders, new ByteArrayInputStream(bodyBytes));
                } else {
                    String cleanMime = isGzipEncoded && lowerUrl.endsWith(".xml.gz")
                            ? "application/xml"
                            : contentType.split(";")[0].trim();
                    return new WebResourceResponse(cleanMime, null, 200, "OK", corsHeaders, rawStream);
                }
            } catch (Exception e) {
                conn.disconnect();
                return new WebResourceResponse("text/plain", "UTF-8", 502, "Proxy Error", corsHeaders, new ByteArrayInputStream(new byte[0]));
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

    /**
         * Called when the Activity is first created.
         * Instantiates the WebView, configures advanced WebSettings (like DOM Storage, JavaScript, and Mixed Content),
         * binds the custom WebView clients, connects the JavaScript-to-Java UpdateManager interface, 
         * and loads the local HTML index file.
         * 
         * @param savedInstanceState A Bundle containing the activity's previously frozen state, if there was one.
         */
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        mWebView = new WebView(this);
        setContentView(mWebView);

        // Enable edge-to-edge layout so Chromium viewport-fit=cover and CSS env(safe-area-inset-*) handle system bars natively
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Enable hardware acceleration for the WebView to optimize core usage and rendering performance
        mWebView.setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null);

        WebSettings webSettings = mWebView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(false);
        webSettings.setAllowContentAccess(true);
        webSettings.setAllowFileAccessFromFileURLs(false);
        webSettings.setAllowUniversalAccessFromFileURLs(false);
        webSettings.setDatabaseEnabled(true);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        webSettings.setMediaPlaybackRequiresUserGesture(false);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        String defaultUa = webSettings.getUserAgentString();
        if (defaultUa != null) {
            webSettings.setUserAgentString(defaultUa.replace("; wv", "").replace("Version/4.0 ", ""));
        }

        // Block popups
        webSettings.setJavaScriptCanOpenWindowsAutomatically(false);
        webSettings.setSupportMultipleWindows(false);

        mWebView.setWebViewClient(new AdBlockingWebViewClient(this));

        mUpdateManager = new UpdateManager(this, mWebView);
        mWebView.addJavascriptInterface(mUpdateManager, "AndroidUpdate");
        mWebView.addJavascriptInterface(new SettingsBridge(this), "AndroidSettings");

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

        // Intercept physical back button presses (gesture or remote keys) and forward the action 
        // to the WebView's unified SpatialNav.back() handler to close active modals or navigate back.
        getOnBackPressedDispatcher().addCallback(this, new androidx.activity.OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (mWebView != null) {
                    mWebView.evaluateJavascript("if (window.SpatialNav && typeof window.SpatialNav.back === 'function') { window.SpatialNav.back(); }", null);
                }
            }
        });

        mWebView.loadUrl(APP_INDEX_URL);
    }



    /**
     * Called when device configuration (e.g. orientation or screen size) changes.
     * Prevents activity destruction/recreation and retains active WebView state.
     * 
     * @param newConfig The new device configuration.
     */
    @Override
    public void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        Log.d("MainActivity", "Configuration changed (orientation/size update)");
    }

    /**
     * Called when the activity resumes.
     * Triggers JS callback to inform web application of activity resume.
     */
    @Override
    protected void onResume() {
        super.onResume();
        if (mWebView != null) {
            mWebView.evaluateJavascript(
                "if(typeof window.onAppResume === 'function') window.onAppResume();",
                null
            );
        }
    }

    /**
     * Called when the activity is being destroyed.
     * Shuts down the update manager executor threads to prevent memory leaks.
     */
    @Override
    protected void onDestroy() {
        if (mUpdateManager != null) {
            mUpdateManager.shutdown();
        }
        super.onDestroy();
    }
}
