package com.kenjigames.ivids;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceResponse;
import androidx.annotation.Nullable;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Serves bundled Android assets over https://appassets.androidplatform.net/assets/ and legacy file:///android_asset/.
 * Maps ES module and asset file extensions to Chromium-compliant MIME types and CORS headers.
 */
public final class LocalAssetHandler {

    public static final String APP_ASSET_HOST = "appassets.androidplatform.net";
    public static final String APP_ASSET_BASE_URL = "https://" + APP_ASSET_HOST + "/assets/";

    private final Context mAppContext;

    /**
     * Initializes the LocalAssetHandler using the application context to read bundled assets safely on IO threads.
     *
     * @param context Activity or application context.
     */
    public LocalAssetHandler(Context context) {
        this.mAppContext = context.getApplicationContext();
    }

    /**
     * Checks whether a URL belongs to the bundled application asset origin or legacy android_asset path.
     * Used by key event routing and proxy caller validation to distinguish app pages from external embeds.
     *
     * @param url Candidate URL string.
     * @return true if the URL targets bundled application assets.
     */
    public static boolean isAppAssetUrl(@Nullable String url) {
        return url != null && (url.startsWith(APP_ASSET_BASE_URL) || url.startsWith("file:///android_asset/"));
    }

    /**
     * Checks whether an intercepted request URI targets bundled application assets.
     *
     * @param uri Request URI from WebResourceRequest.
     * @return true if the URI should be handled by handleAssetRequest.
     */
    public static boolean isAssetRequest(@Nullable Uri uri) {
        if (uri == null) return false;
        String path = uri.getPath();
        if (path == null) return false;
        if ("https".equalsIgnoreCase(uri.getScheme()) && APP_ASSET_HOST.equalsIgnoreCase(uri.getHost())) {
            return path.startsWith("/assets/");
        }
        return "file".equalsIgnoreCase(uri.getScheme()) && path.startsWith("/android_asset/");
    }

    /**
     * Opens the requested asset stream and returns a WebResourceResponse with MIME type and CORS headers.
     * Rejects path traversal attempts with HTTP 403 and missing files with HTTP 404.
     *
     * @param assetUri Intercepted asset URI.
     * @return WebResourceResponse containing asset stream or 403/404 response.
     */
    public WebResourceResponse handleAssetRequest(Uri assetUri) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Access-Control-Allow-Origin", "*");

        String rawPath = assetUri.getPath();
        String assetPath;
        if (rawPath != null && rawPath.startsWith("/assets/")) {
            assetPath = rawPath.substring("/assets/".length());
        } else if (rawPath != null && rawPath.startsWith("/android_asset/")) {
            assetPath = rawPath.substring("/android_asset/".length());
        } else {
            return buildErrorResponse(403, "Forbidden", headers);
        }

        if (assetPath.isEmpty() || assetPath.contains("\\") || assetPath.contains("\0") || rawPath.contains("..")) {
            return buildErrorResponse(403, "Forbidden", headers);
        }
        for (String segment : assetPath.split("/", -1)) {
            if (segment.isEmpty() || ".".equals(segment) || "..".equals(segment)) {
                return buildErrorResponse(403, "Forbidden", headers);
            }
        }

        try {
            InputStream is = mAppContext.getAssets().open(assetPath);
            String mimeType = getAssetMimeType(assetPath);
            String encoding = isTextMimeType(mimeType) ? "UTF-8" : null;
            // Allow WebView memory/disk caching for static bundled assets while keeping HTML fresh.
            if ("text/html".equals(mimeType)) {
                headers.put("Cache-Control", "no-cache");
            } else {
                headers.put("Cache-Control", "public, max-age=31536000, immutable");
            }
            return new WebResourceResponse(mimeType, encoding, 200, "OK", headers, is);
        } catch (IOException e) {
            return buildErrorResponse(404, "Not Found", headers);
        }
    }

    /**
     * Builds an empty error WebResourceResponse with the specified HTTP status code and headers.
     *
     * @param statusCode HTTP status code (e.g. 403, 404).
     * @param reasonPhrase Short HTTP reason string.
     * @param headers Response headers map.
     * @return Error WebResourceResponse.
     */
    public static WebResourceResponse buildErrorResponse(int statusCode, String reasonPhrase, Map<String, String> headers) {
        return new WebResourceResponse(
                "text/plain",
                "UTF-8",
                statusCode,
                reasonPhrase,
                headers,
                new ByteArrayInputStream(new byte[0])
        );
    }

    private static String getAssetMimeType(String assetPath) {
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

    private static boolean isTextMimeType(String mimeType) {
        return mimeType.startsWith("text/")
                || "application/javascript".equals(mimeType)
                || "application/json".equals(mimeType)
                || "image/svg+xml".equals(mimeType)
                || "application/xml".equals(mimeType)
                || "application/vnd.apple.mpegurl".equals(mimeType);
    }
}
