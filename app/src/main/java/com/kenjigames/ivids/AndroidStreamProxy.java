package com.kenjigames.ivids;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import androidx.annotation.Nullable;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.FilterInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.InetAddress;
import java.net.SocketTimeoutException;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.GZIPInputStream;

/**
 * Native Android stream proxy handling /proxy?url=... requests with SSRF protection, caller validation,
 * HTTP Range/206 forwarding for MP4 seeking, bounded DNS/dead-host caching, and same-origin M3U8 rewriting.
 */
public final class AndroidStreamProxy {

    private static final String CHROME_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    private static final String VLC_UA = "VLC/3.0.20 LibVLC/3.0.20";
    private static final long DNS_CACHE_TTL_MS = 60_000L;
    private static final long DEAD_HOST_TTL_MS = 300_000L;
    private static final int MAX_HOST_CACHE_ENTRIES = 256;

    private static final ConcurrentHashMap<String, CacheEntry> SAFE_DNS_CACHE = new ConcurrentHashMap<>();
    private static final ConcurrentHashMap<String, Long> DEAD_HOST_CACHE = new ConcurrentHashMap<>();

    private static final class CacheEntry {
        final boolean safe;
        final long expiresAt;

        CacheEntry(boolean safe, long expiresAt) {
            this.safe = safe;
            this.expiresAt = expiresAt;
        }
    }

    private AndroidStreamProxy() {}

    /**
     * Checks whether a WebResourceRequest targets the local /proxy endpoint on localhost, 127.0.0.1, or appassets host.
     *
     * @param url Intercepted request URI.
     * @return true if this is a local /proxy request.
     */
    public static boolean isProxyRequest(@Nullable Uri url) {
        if (url == null || !"/proxy".equals(url.getPath())) {
            return false;
        }
        String host = url.getHost();
        return "localhost".equalsIgnoreCase(host)
                || "127.0.0.1".equals(host)
                || LocalAssetHandler.APP_ASSET_HOST.equalsIgnoreCase(host);
    }

    /**
     * Builds permissive CORS and Range-exposed headers for proxy responses.
     *
     * @return Mutable response header map.
     */
    public static Map<String, String> createCorsHeaders() {
        Map<String, String> corsHeaders = new HashMap<>();
        corsHeaders.put("Access-Control-Allow-Origin", "*");
        corsHeaders.put("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        corsHeaders.put("Access-Control-Allow-Headers", "*");
        corsHeaders.put("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
        corsHeaders.put("Cache-Control", "no-store");
        return corsHeaders;
    }

    /**
     * Verifies that a /proxy request originates from the bundled application asset origin rather than third-party pages.
     *
     * @param request Intercepted WebResourceRequest targeting /proxy.
     * @param mainFrameUrl Tracked main-frame URL in the WebView.
     * @return true if main frame and caller headers match the trusted application origin.
     */
    public static boolean isLocalAppProxyCaller(WebResourceRequest request, @Nullable String mainFrameUrl) {
        if (request.isForMainFrame() || !LocalAssetHandler.isAppAssetUrl(mainFrameUrl)) {
            return false;
        }
        Map<String, String> reqHeaders = request.getRequestHeaders();
        if (reqHeaders == null) {
            return false;
        }
        boolean hasTrustedCallerHeader = false;
        for (Map.Entry<String, String> entry : reqHeaders.entrySet()) {
            if (entry.getKey() == null || entry.getValue() == null) continue;
            String keyLower = entry.getKey().toLowerCase(Locale.ROOT);
            String val = entry.getValue().trim();
            if (val.isEmpty()) continue;
            if ("referer".equals(keyLower)) {
                if (!LocalAssetHandler.isAppAssetUrl(val)) {
                    return false;
                }
                hasTrustedCallerHeader = true;
            }
            if ("sec-fetch-dest".equals(keyLower)) {
                String destLower = val.toLowerCase(Locale.ROOT);
                if ("document".equals(destLower) || "iframe".equals(destLower)) {
                    return false;
                }
            }
            if ("origin".equals(keyLower)) {
                if (("https://" + LocalAssetHandler.APP_ASSET_HOST).equalsIgnoreCase(val)) {
                    hasTrustedCallerHeader = true;
                } else if (!"null".equalsIgnoreCase(val) && !val.startsWith("file://")) {
                    return false;
                }
            }
        }
        return hasTrustedCallerHeader;
    }

    /**
     * Validates that a proxy target URL uses http/https and does not resolve to loopback, link-local,
     * CGNAT (100.64.0.0/10), unspecified, or multicast addresses while preserving LAN IPTV access.
     *
     * @param rawUrl Candidate upstream URL.
     * @return true if safe to connect, false otherwise.
     */
    public static boolean isSafeProxyUrl(@Nullable String rawUrl) {
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

            Boolean cachedSafe = getCachedDnsSafety(hostLower);
            if (cachedSafe != null) {
                return cachedSafe;
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
                    // Reject 127.0.0.0/8, 0.0.0.0/8, 169.254.0.0/16 (link-local), and 100.64.0.0/10 (CGNAT)
                    if (b0 == 127 || b0 == 0 || (b0 == 169 && b1 == 254) || (b0 == 100 && b1 >= 64 && b1 <= 127)) {
                        return false;
                    }
                }
            }
            cacheDnsSafety(hostLower, true);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Stores a bounded 60-second SSRF DNS validation decision so HLS segments skip repeated blocking lookups.
     *
     * @param hostLower - Normalized lowercase hostname.
     * @param safe - Whether resolved addresses passed SSRF validation.
     */
    private static void cacheDnsSafety(String hostLower, boolean safe) {
        if (SAFE_DNS_CACHE.size() >= MAX_HOST_CACHE_ENTRIES) {
            SAFE_DNS_CACHE.clear();
        }
        SAFE_DNS_CACHE.put(hostLower, new CacheEntry(safe, System.currentTimeMillis() + DNS_CACHE_TTL_MS));
    }

    /**
     * Checks cached SSRF DNS validation result within the 60-second TTL, pruning expired entries.
     *
     * @param hostLower - Normalized lowercase hostname.
     * @return Boolean cached decision, or null on cache miss/expiration.
     */
    @Nullable
    private static Boolean getCachedDnsSafety(String hostLower) {
        CacheEntry entry = SAFE_DNS_CACHE.get(hostLower);
        if (entry == null) return null;
        if (System.currentTimeMillis() > entry.expiresAt) {
            SAFE_DNS_CACHE.remove(hostLower, entry);
            return null;
        }
        return entry.safe;
    }

    /**
     * Checks whether a host recently failed with DNS/connect/timeout errors so WebView threads aren't stalled.
     *
     * @param hostLower - Normalized lowercase hostname.
     * @return true if still inside the 5-minute negative cache window.
     */
    private static boolean isDeadHost(@Nullable String hostLower) {
        if (hostLower == null || hostLower.isEmpty()) return false;
        Long expiresAt = DEAD_HOST_CACHE.get(hostLower);
        if (expiresAt == null) return false;
        if (System.currentTimeMillis() > expiresAt) {
            DEAD_HOST_CACHE.remove(hostLower, expiresAt);
            return false;
        }
        return true;
    }

    /**
     * Marks an unreachable hostname in the bounded negative host cache for 5 minutes.
     *
     * @param hostLower - Normalized lowercase hostname.
     */
    private static void markDeadHost(@Nullable String hostLower) {
        if (hostLower == null || hostLower.isEmpty()) return;
        if (DEAD_HOST_CACHE.size() >= MAX_HOST_CACHE_ENTRIES) {
            DEAD_HOST_CACHE.clear();
        }
        DEAD_HOST_CACHE.put(hostLower, System.currentTimeMillis() + DEAD_HOST_TTL_MS);
    }

    /**
     * Extracts a lowercase normalized hostname from a raw URL string for host caching.
     *
     * @param rawUrl - Candidate target URL.
     * @return Lowercase hostname or null if unparseable.
     */
    @Nullable
    private static String extractHostLower(@Nullable String rawUrl) {
        if (rawUrl == null || rawUrl.isEmpty()) return null;
        try {
            String host = new URI(rawUrl.trim()).getHost();
            return host != null ? host.trim().toLowerCase(Locale.ROOT) : null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Executes an intercepted /proxy request, forwarding Range headers and preserving 206 Partial Content
     * for video seeking while rewriting M3U8 manifest links to same-origin /proxy?url=.
     *
     * @param request Intercepted WebResourceRequest.
     * @return WebResourceResponse backed by upstream stream or rewritten M3U8 payload.
     */
    public static WebResourceResponse handleRequest(WebResourceRequest request) {
        Map<String, String> corsHeaders = createCorsHeaders();
        Uri proxyUri = request.getUrl();
        String targetUrl = proxyUri.getQueryParameter("url");
        if (targetUrl == null || targetUrl.isEmpty()) {
            return LocalAssetHandler.buildErrorResponse(400, "Bad Request", corsHeaders);
        }
        if (!isSafeProxyUrl(targetUrl)) {
            return LocalAssetHandler.buildErrorResponse(403, "Forbidden", corsHeaders);
        }
        String initialHostLower = extractHostLower(targetUrl);
        if (isDeadHost(initialHostLower)) {
            return LocalAssetHandler.buildErrorResponse(502, "Host Unreachable", corsHeaders);
        }

        String referer = proxyUri.getQueryParameter("referer");
        String origin = proxyUri.getQueryParameter("origin");
        String userAgent = proxyUri.getQueryParameter("user-agent");
        String incomingRange = extractIncomingHeader(request, "Range");

        String lowerUrl = targetUrl.toLowerCase(Locale.ROOT);
        boolean isRawIptv = lowerUrl.matches("^https?://\\d+\\.\\d+\\.\\d+\\.\\d+.*")
                || lowerUrl.contains(":8008/")
                || lowerUrl.contains(":8080/")
                || lowerUrl.contains("/play/");

        String targetOrigin = extractOrigin(targetUrl);
        String firstUa = (userAgent != null && !userAgent.isEmpty()) ? userAgent : (isRawIptv ? VLC_UA : CHROME_UA);
        String[][] profiles = new String[][] {
            { firstUa, referer, origin },
            { VLC_UA, null, null },
            { CHROME_UA, targetOrigin != null ? targetOrigin + "/" : referer, targetOrigin != null ? targetOrigin : origin }
        };

        HttpURLConnection conn = null;
        String winningUa = firstUa;
        String winningRef = referer;
        String winningOrig = origin;
        int statusCode = 502;
        boolean blockedRedirectSsrf = false;
        boolean sawConnectionFailure = false;

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
                    if (incomingRange != null && !incomingRange.isEmpty()) conn.setRequestProperty("Range", incomingRange);
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
                    if (conn != null) { conn.disconnect(); conn = null; }
                    break;
                }
                if (!completedNonRedirect || conn == null) {
                    if (conn != null) { conn.disconnect(); conn = null; }
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
                sawConnectionFailure = false;
                break;
            } catch (UnknownHostException | ConnectException | SocketTimeoutException netEx) {
                sawConnectionFailure = true;
                if (conn != null) { conn.disconnect(); conn = null; }
                // Unreachable/timed-out host cannot be fixed by retrying alternate User-Agent profiles
                break;
            } catch (Exception e) {
                if (conn != null) { conn.disconnect(); conn = null; }
            }
        }

        if (blockedRedirectSsrf) {
            return LocalAssetHandler.buildErrorResponse(403, "Forbidden", corsHeaders);
        }
        if (conn == null || statusCode >= 400) {
            if (conn != null) conn.disconnect();
            if (conn == null && sawConnectionFailure) {
                markDeadHost(initialHostLower);
            }
            return LocalAssetHandler.buildErrorResponse(statusCode >= 400 ? statusCode : 502, "Upstream Error", corsHeaders);
        }

        return buildProxyWebResponse(conn, targetUrl, lowerUrl, statusCode, winningUa, winningRef, winningOrig, corsHeaders);
    }

    private static WebResourceResponse buildProxyWebResponse(
            HttpURLConnection conn,
            String targetUrl,
            String lowerUrl,
            int statusCode,
            String winningUa,
            String winningRef,
            String winningOrig,
            Map<String, String> corsHeaders) {
        try {
            String contentType = conn.getContentType();
            if (contentType == null || contentType.isEmpty()) {
                contentType = "application/octet-stream";
            }
            String contentEncoding = conn.getContentEncoding();
            boolean isGzipEncoded = (contentEncoding != null && contentEncoding.toLowerCase(Locale.ROOT).contains("gzip"))
                    || lowerUrl.endsWith(".gz");
            boolean isM3u8 = lowerUrl.contains(".m3u8") || contentType.toLowerCase(Locale.ROOT).contains("mpegurl");
            InputStream rawStream = isGzipEncoded ? new GZIPInputStream(conn.getInputStream()) : conn.getInputStream();

            if (isM3u8 && statusCode != 206) {
                byte[] bodyBytes = rewriteM3u8Manifest(conn, rawStream, targetUrl, winningRef, winningOrig, winningUa);
                return new WebResourceResponse("application/vnd.apple.mpegurl", "UTF-8", 200, "OK", corsHeaders, new ByteArrayInputStream(bodyBytes));
            }

            String cleanMime = isGzipEncoded && lowerUrl.endsWith(".xml.gz")
                    ? "application/xml"
                    : contentType.split(";")[0].trim();

            if (!isGzipEncoded) {
                String contentLength = conn.getHeaderField("Content-Length");
                if (contentLength != null && !contentLength.isEmpty()) {
                    corsHeaders.put("Content-Length", contentLength);
                }
            }
            String contentRange = conn.getHeaderField("Content-Range");
            if (contentRange != null && !contentRange.isEmpty()) {
                corsHeaders.put("Content-Range", contentRange);
            }
            String acceptRanges = conn.getHeaderField("Accept-Ranges");
            if ((acceptRanges != null && !acceptRanges.isEmpty()) || contentRange != null || cleanMime.startsWith("video/")) {
                corsHeaders.put("Accept-Ranges", (acceptRanges != null && !acceptRanges.isEmpty()) ? acceptRanges : "bytes");
            }

            String reason = statusCode == 206 ? "Partial Content" : "OK";
            final HttpURLConnection activeConn = conn;
            InputStream closingStream = new FilterInputStream(rawStream) {
                @Override
                public void close() throws IOException {
                    try {
                        super.close();
                    } finally {
                        activeConn.disconnect();
                    }
                }
            };
            return new WebResourceResponse(cleanMime, null, statusCode, reason, corsHeaders, closingStream);
        } catch (Exception e) {
            conn.disconnect();
            return LocalAssetHandler.buildErrorResponse(502, "Proxy Error", corsHeaders);
        }
    }

    private static byte[] rewriteM3u8Manifest(
            HttpURLConnection conn,
            InputStream rawStream,
            String targetUrl,
            String winningRef,
            String winningOrig,
            String winningUa) throws Exception {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(rawStream, StandardCharsets.UTF_8))) {
            StringBuilder extra = new StringBuilder();
            if (winningRef != null && !winningRef.isEmpty()) extra.append("&referer=").append(URLEncoder.encode(winningRef, "UTF-8"));
            if (winningOrig != null && !winningOrig.isEmpty()) extra.append("&origin=").append(URLEncoder.encode(winningOrig, "UTF-8"));
            if (winningUa != null && !winningUa.isEmpty()) extra.append("&user-agent=").append(URLEncoder.encode(winningUa, "UTF-8"));
            String suffix = extra.toString();
            URI baseUri = new URI(targetUrl);

            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.trim();
                if (trimmed.isEmpty()) continue;
                if (trimmed.startsWith("#")) {
                    if (trimmed.contains("URI=\"")) {
                        int uStart = trimmed.indexOf("URI=\"") + 5;
                        int uEnd = trimmed.indexOf("\"", uStart);
                        if (uEnd > uStart) {
                            String rawUri = trimmed.substring(uStart, uEnd);
                            String resolvedUri = (rawUri.startsWith("http://") || rawUri.startsWith("https://"))
                                    ? rawUri
                                    : baseUri.resolve(rawUri).toString();
                            String proxiedUri = "/proxy?url=" + URLEncoder.encode(resolvedUri, "UTF-8") + suffix;
                            trimmed = trimmed.substring(0, uStart) + proxiedUri + trimmed.substring(uEnd);
                        }
                    }
                    sb.append(trimmed).append("\n");
                } else {
                    String resolved = (trimmed.startsWith("http://") || trimmed.startsWith("https://"))
                            ? trimmed
                            : baseUri.resolve(trimmed).toString();
                    sb.append("/proxy?url=")
                      .append(URLEncoder.encode(resolved, "UTF-8"))
                      .append(suffix)
                      .append("\n");
                }
            }
        } finally {
            conn.disconnect();
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    @Nullable
    private static String extractIncomingHeader(WebResourceRequest request, String headerName) {
        Map<String, String> headers = request.getRequestHeaders();
        if (headers == null) return null;
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            if (entry.getKey() != null && headerName.equalsIgnoreCase(entry.getKey())) {
                return entry.getValue();
            }
        }
        return null;
    }

    @Nullable
    private static String extractOrigin(String rawUrl) {
        try {
            URI parsed = new URI(rawUrl);
            if (parsed.getScheme() != null && parsed.getAuthority() != null) {
                return parsed.getScheme() + "://" + parsed.getAuthority();
            }
        } catch (Exception ignored) {}
        return null;
    }
}
