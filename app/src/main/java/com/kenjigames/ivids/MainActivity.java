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
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import java.io.ByteArrayInputStream;

/**
 * MainActivity is the primary entry point for the IVIDS Android application.
 * Initializes the full-screen WebView, forwards hardware remote/Back events, and delegates
 * asset serving, ad filtering, and stream proxying to dedicated helper classes.
 */
@RequiresApi(Build.VERSION_CODES.LOLLIPOP)
public class MainActivity extends AppCompatActivity {

    private static final String TAG = "MainActivity";
    private WebView mWebView;
    private UpdateManager mUpdateManager;

    /**
     * Simulates a physical touch click on the screen at the specified coordinates.
     * Primarily used to bypass browser autoplay restrictions on third-party embed iframes.
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
     * Intercepts hardware remote and keyboard events before WebView processing.
     * Forwards KEYCODE_BACK and KEYCODE_ESCAPE directly to SpatialNav.back() so TV remotes and iframes cannot swallow Back.
     *
     * @param event The KeyEvent dispatched to the Activity.
     * @return true if handled, otherwise delegates to superclass.
     */
    @Override
    public boolean dispatchKeyEvent(android.view.KeyEvent event) {
        int keyCode = event.getKeyCode();
        if (keyCode == android.view.KeyEvent.KEYCODE_BACK || keyCode == android.view.KeyEvent.KEYCODE_ESCAPE) {
            if (event.getAction() == android.view.KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) {
                triggerWebViewBack();
            }
            return true;
        }
        if (event.getAction() == android.view.KeyEvent.ACTION_DOWN) {
            if (keyCode == android.view.KeyEvent.KEYCODE_DPAD_CENTER
                    || keyCode == android.view.KeyEvent.KEYCODE_ENTER) {
                String url = mWebView.getUrl();
                if (url != null && !LocalAssetHandler.isAppAssetUrl(url)) {
                    simulateClick(mWebView.getWidth() / 2f, mWebView.getHeight() / 2f);
                    return true;
                }
            }
        }
        return super.dispatchKeyEvent(event);
    }

    /**
     * Forwards hardware Back, Escape, and Android gesture back events directly to the WebView SpatialNav.back() handler.
     * Ensures TV remotes and embedded player iframes cannot swallow back navigation before JavaScript handles it.
     */
    private void triggerWebViewBack() {
        if (mWebView != null) {
            mWebView.evaluateJavascript(
                    "if (window.SpatialNav && typeof window.SpatialNav.back === 'function') { window.SpatialNav.back(); }",
                    null
            );
        }
    }

    /**
     * Custom WebViewClient coordinating bundled asset delivery, /proxy stream requests, and known ad host blocking.
     */
    private static class AdBlockingWebViewClient extends WebViewClient {
        private final LocalAssetHandler mAssetHandler;
        private volatile String mCurrentMainFrameUrl = LocalAssetHandler.APP_ASSET_BASE_URL + "main/gui/index.html";

        /**
         * Initializes the WebViewClient with a LocalAssetHandler bound to application context.
         *
         * @param context Activity or application context.
         */
        AdBlockingWebViewClient(Context context) {
            this.mAssetHandler = new LocalAssetHandler(context);
        }

        /**
         * Intercepts bundled asset requests over appassets/file URLs, /proxy stream requests, and known ad hosts.
         *
         * @param view The WebView requesting the resource.
         * @param request The WebResourceRequest containing URL, method, and headers.
         * @return A WebResourceResponse when handled/blocked, or null to let WebView proceed normally.
         */
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if (LocalAssetHandler.isAssetRequest(url)) {
                return mAssetHandler.handleAssetRequest(url);
            }
            if (AndroidStreamProxy.isProxyRequest(url)) {
                if (!AndroidStreamProxy.isLocalAppProxyCaller(request, mCurrentMainFrameUrl)) {
                    return LocalAssetHandler.buildErrorResponse(403, "Forbidden", AndroidStreamProxy.createCorsHeaders());
                }
                if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
                    return new WebResourceResponse("text/plain", "UTF-8", 200, "OK",
                            AndroidStreamProxy.createCorsHeaders(), new ByteArrayInputStream(new byte[0]));
                }
                return AndroidStreamProxy.handleRequest(request);
            }
            if (url != null && AdHostFilter.isAdHost(url.getHost())) {
                Log.d(TAG, "Blocking ad request: " + url);
                return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
            }
            return super.shouldInterceptRequest(view, request);
        }

        @Override
        public void onPageStarted(WebView view, String url, Bitmap favicon) {
            super.onPageStarted(view, url, favicon);
            mCurrentMainFrameUrl = url != null ? url : "";
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            super.onPageFinished(view, url);
            mCurrentMainFrameUrl = url != null ? url : "";
            if (url != null && (url.contains("vidsrc") || url.contains("vidlink") || url.contains("videasy") || url.contains("embed"))) {
                view.postDelayed(() -> {
                    if (view.getContext() instanceof MainActivity) {
                        MainActivity activity = (MainActivity) view.getContext();
                        if (!activity.isFinishing() && !activity.isDestroyed()) {
                            activity.simulateClick(view.getWidth() / 2f, view.getHeight() / 2f);
                        }
                    }
                }, 2500);
            }
        }

        @RequiresApi(Build.VERSION_CODES.M)
        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            super.onReceivedError(view, request, error);
            if (request.isForMainFrame()) {
                Log.e(TAG, "Error loading page: " + error.getDescription());
            }
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            super.onReceivedHttpError(view, request, errorResponse);
            if (request.isForMainFrame()) {
                Log.e(TAG, "HTTP error " + errorResponse.getStatusCode() + " while loading " + request.getUrl());
            }
        }
    }

    /**
     * Initializes the WebView, edge-to-edge window insets, JS bridges, Back dispatcher, and local SPA entry URL.
     *
     * @param savedInstanceState Previously frozen activity state, if any.
     */
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        mWebView = new WebView(this);
        setContentView(mWebView);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
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

        getOnBackPressedDispatcher().addCallback(this, new androidx.activity.OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                triggerWebViewBack();
            }
        });

        mWebView.loadUrl(LocalAssetHandler.APP_ASSET_BASE_URL + "main/gui/index.html");
    }

    @Override
    public void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        Log.d("MainActivity", "Configuration changed (orientation/size update)");
    }

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

    @Override
    protected void onDestroy() {
        if (mUpdateManager != null) {
            mUpdateManager.shutdown();
        }
        super.onDestroy();
    }
}
