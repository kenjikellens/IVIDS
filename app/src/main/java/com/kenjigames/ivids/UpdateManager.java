package com.kenjigames.ivids;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URI;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class UpdateManager {
    private static final String TAG = "UpdateManager";
    private static final String GITHUB_API_URL = "https://api.github.com/repos/kenjikellens/IVIDS/releases";
    private static final String REPO_APK_URL = "https://github.com/kenjikellens/IVIDS/raw/main/IVIDS.apk";

    private final Activity mActivity;
    private final WebView mWebView;
    private final ExecutorService mExecutor = Executors.newSingleThreadExecutor();

    private String mDownloadUrl = null;
    private String mLatestVersion = null;

    public UpdateManager(Activity activity, WebView webView) {
        this.mActivity = activity;
        this.mWebView = webView;
    }

    @JavascriptInterface
    public void checkForUpdates() {
        Log.d(TAG, "Checking for updates...");

        if (!isNetworkAvailable()) {
            Log.e(TAG, "No network connection available.");
            notifyWebUpdateError();
            return;
        }

        mExecutor.execute(() -> {
            HttpURLConnection conn = null;
            BufferedReader reader = null;
            try {
                URL url = URI.create(GITHUB_API_URL).toURL();
                notifyWebUpdateStatus("connecting-api");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Accept", "application/vnd.github.v3+json");
                conn.setRequestProperty("User-Agent", "IVIDS-Android-App");

                int responseCode = conn.getResponseCode();
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }

                    JSONArray releases = new JSONArray(response.toString());
                    notifyWebUpdateStatus("fetching-releases");
                    if (releases.length() == 0) {
                        Log.d(TAG, "No releases found");
                        notifyWebNoUpdateFound();
                        return;
                    }

                    JSONObject latestRelease = releases.getJSONObject(0);
                    mLatestVersion = latestRelease.getString("tag_name");

                    String currentVersion = mActivity.getPackageManager()
                            .getPackageInfo(mActivity.getPackageName(), 0).versionName;

                    Log.d(TAG, "Current version: " + currentVersion + ", Latest version: " + mLatestVersion);

                    if (isNewerVersion(currentVersion, mLatestVersion)) {
                        Log.d(TAG, "New update found: " + mLatestVersion);
                        JSONArray assets = latestRelease.getJSONArray("assets");
                        for (int i = 0; i < assets.length(); i++) {
                            JSONObject asset = assets.getJSONObject(i);
                            if (asset.getString("name").toLowerCase().endsWith(".apk")) {
                                mDownloadUrl = asset.getString("browser_download_url");
                                break;
                            }
                        }

                        if (mDownloadUrl != null) {
                            Log.d(TAG, "Found APK download URL: " + mDownloadUrl);
                            notifyWebFoundUpdate(mLatestVersion);
                        } else {
                            Log.e(TAG, "No APK found in the latest release");
                            notifyWebNoUpdateFound();
                        }
                    } else {
                        Log.d(TAG, "App is up to date");
                        notifyWebNoUpdateFound();
                    }
                } else {
                    Log.e(TAG, "GitHub API returned error: " + responseCode);
                    notifyWebUpdateError();
                }
            } catch (MalformedURLException e) {
                Log.e(TAG, "Invalid URL", e);
                notifyWebUpdateError();
            } catch (IOException e) {
                Log.e(TAG, "Error connecting to GitHub API", e);
                notifyWebUpdateError();
            } catch (JSONException e) {
                Log.e(TAG, "Error parsing JSON response", e);
                notifyWebUpdateError();
            } catch (Exception e) {
                Log.e(TAG, "An unexpected error occurred while checking for updates", e);
                notifyWebUpdateError();
            } finally {
                if (reader != null) {
                    try {
                        reader.close();
                    } catch (IOException e) {
                        Log.e(TAG, "Error closing reader", e);
                    }
                }
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    private boolean isNewerVersion(String current, String latest) {
        // ... (existing implementation is reasonably robust)
        try {
            notifyWebUpdateStatus("comparing-versions");

            // Special case: if current is "1.0", it's a legacy incorrect version
            // and should be considered older than any "v0.x.x" release.
            if ("1.0".equals(current) || "1.0.0".equals(current)) {
                return true;
            }

            // Remove 'v' prefix if present
            String c = current.startsWith("v") ? current.substring(1) : current;
            String l = latest.startsWith("v") ? latest.substring(1) : latest;

            String[] cParts = c.split("\\.");
            String[] lParts = l.split("\\.");

            int length = Math.max(cParts.length, lParts.length);
            for (int i = 0; i < length; i++) {
                int cPart = i < cParts.length ? Integer.parseInt(cParts[i].replaceAll("[^0-9]", "")) : 0;
                int lPart = i < lParts.length ? Integer.parseInt(lParts[i].replaceAll("[^0-9]", "")) : 0;

                if (lPart > cPart)
                    return true;
                if (cPart > lPart)
                    return false;
            }
        } catch (NumberFormatException e) {
            Log.e(TAG, "Error comparing versions", e);
            // Fallback: simple string comparison if parsing fails
            return !current.equals(latest);
        }
        return false;
    }

    @JavascriptInterface
    public void downloadFromRepo() {
        Log.d(TAG, "Requesting direct download from repository...");
        mDownloadUrl = REPO_APK_URL;
        downloadAndInstall();
    }

    @JavascriptInterface
    public void downloadAndInstall() {
        if (mDownloadUrl == null) {
            Log.e(TAG, "No download URL available");
            notifyWebUpdateError();
            return;
        }

        Log.d(TAG, "Starting download: " + mDownloadUrl);
        mExecutor.execute(() -> {
            HttpURLConnection conn = null;
            InputStream is = null;
            FileOutputStream fos = null;
            try {
                URL url = URI.create(mDownloadUrl).toURL();
                notifyWebUpdateStatus("downloading");

                // Follow redirects manually (GitHub redirects to CDN)
                String finalUrl = mDownloadUrl;
                int redirectCount = 0;
                final int MAX_REDIRECTS = 5;

                while (redirectCount < MAX_REDIRECTS) {
                    conn = (HttpURLConnection) URI.create(finalUrl).toURL().openConnection();
                    conn.setRequestProperty("User-Agent", "IVIDS-Android-App");
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.connect();

                    int responseCode = conn.getResponseCode();
                    Log.d(TAG, "Response code: " + responseCode + " for URL: " + finalUrl);

                    if (responseCode == HttpURLConnection.HTTP_MOVED_PERM ||
                            responseCode == HttpURLConnection.HTTP_MOVED_TEMP ||
                            responseCode == 307 || responseCode == 308) {
                        String location = conn.getHeaderField("Location");
                        if (location == null) {
                            Log.e(TAG, "Redirect with no Location header");
                            notifyWebUpdateError();
                            return;
                        }
                        Log.d(TAG, "Redirecting to: " + location);
                        finalUrl = location;
                        conn.disconnect();
                        redirectCount++;
                    } else if (responseCode == HttpURLConnection.HTTP_OK) {
                        break;
                    } else {
                        Log.e(TAG, "HTTP error: " + responseCode);
                        notifyWebUpdateError();
                        return;
                    }
                }

                if (redirectCount >= MAX_REDIRECTS) {
                    Log.e(TAG, "Too many redirects");
                    notifyWebUpdateError();
                    return;
                }

                File downloadDir = new File(mActivity.getExternalCacheDir(), "updates");
                if (!downloadDir.exists()) {
                    downloadDir.mkdirs();
                }

                File apkFile = new File(downloadDir, "IVIDS-update.apk");
                if (apkFile.exists()) {
                    apkFile.delete();
                }

                is = new BufferedInputStream(conn.getInputStream());
                fos = new FileOutputStream(apkFile);

                byte[] data = new byte[8192];
                int count;
                long total = 0;
                int fileLength = conn.getContentLength();
                while ((count = is.read(data)) != -1) {
                    total += count;
                    // publishing the progress....
                    if (fileLength > 0) {
                        final int progress = (int) (total * 100 / fileLength);
                        mActivity.runOnUiThread(() -> {
                            mWebView.evaluateJavascript(
                                    "if(typeof onUpdateProgress === 'function') onUpdateProgress(" + progress + ");",
                                    null);
                        });
                    }
                    fos.write(data, 0, count);
                }

                Log.d(TAG, "Download complete: " + apkFile.getAbsolutePath());
                installApk(apkFile);
            } catch (IOException e) {
                Log.e(TAG, "Error downloading update", e);
                notifyWebUpdateError();
            } finally {
                try {
                    if (fos != null)
                        fos.close();
                    if (is != null)
                        is.close();
                } catch (IOException e) {
                    Log.e(TAG, "Error closing streams", e);
                }
                if (conn != null) {
                    conn.disconnect();
                }
            }
        });
    }

    private void installApk(File apkFile) {
        try {
            notifyWebUpdateStatus("installing");
            Uri apkUri = FileProvider.getUriForFile(mActivity,
                    mActivity.getPackageName() + ".fileprovider", apkFile);

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            mActivity.startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error starting installation", e);
            notifyWebUpdateError();
        }
    }

    private boolean isNetworkAvailable() {
        ConnectivityManager connectivityManager = (ConnectivityManager) mActivity
                .getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null) {
            return false;
        }
        NetworkInfo activeNetworkInfo = connectivityManager.getActiveNetworkInfo();
        return activeNetworkInfo != null && activeNetworkInfo.isConnected();
    }

    public void shutdown() {
        mExecutor.shutdown();
    }

    private void notifyWebFoundUpdate(String version) {
        mActivity.runOnUiThread(() -> mWebView
                .evaluateJavascript("if(typeof onUpdateFound === 'function') onUpdateFound('" + version + "');", null));
    }

    private void notifyWebNoUpdateFound() {
        mActivity.runOnUiThread(() -> mWebView
                .evaluateJavascript("if(typeof onNoUpdateFound === 'function') onNoUpdateFound();", null));
    }

    private void notifyWebUpdateStatus(String statusKey) {
        mActivity.runOnUiThread(() -> mWebView.evaluateJavascript(
                "if(typeof onUpdateStatus === 'function') onUpdateStatus('" + statusKey + "');", null));
    }

    private void notifyWebUpdateError() {
        mActivity.runOnUiThread(() -> mWebView
                .evaluateJavascript("if(typeof onUpdateCheckError === 'function') onUpdateCheckError();", null));
    }
}
