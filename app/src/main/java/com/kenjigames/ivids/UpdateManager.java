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

/**
 * UpdateManager handles the automatic OTA (Over-The-Air) update checking and installation process.
 * It interacts with the GitHub API to find the latest releases, compares version tags,
 * downloads the new APK securely via HTTP, and initiates the Android package installation intent.
 * It acts as a bridge between the WebView (JavaScript) and native Android code.
 */
public class UpdateManager {
    private static final String TAG = "UpdateManager";
    private static final String GITHUB_API_URL = "https://api.github.com/repos/kenjikellens/IVIDS/releases";
    private static final String REPO_APK_URL = "https://github.com/kenjikellens/IVIDS/raw/main/IVIDS.apk";

    private final Activity mActivity;
    private final WebView mWebView;
    private final ExecutorService mExecutor = Executors.newSingleThreadExecutor();

    private String mDownloadUrl = null;
    private String mLatestVersion = null;

    /**
     * Constructs a new UpdateManager instance.
     * 
     * @param activity The main activity context used for accessing system services and starting intents.
     * @param webView The WebView instance used to send JavaScript callbacks regarding the update progress.
     */
    public UpdateManager(Activity activity, WebView webView) {
        this.mActivity = activity;
        this.mWebView = webView;
    }

    /**
     * Checks the GitHub releases API for newer app versions and downloads the matching TV or Mobile APK.
     * This method runs in a background thread and updates the WebView status callbacks via javascript.
     */
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
                        
                        boolean isTv = false;
                        android.app.UiModeManager uiModeManager = (android.app.UiModeManager) mActivity.getSystemService(Context.UI_MODE_SERVICE);
                        if (uiModeManager != null) {
                            isTv = uiModeManager.getCurrentModeType() == android.content.res.Configuration.UI_MODE_TYPE_TELEVISION;
                        }
                        String targetKeyword = isTv ? "tv" : "mobile";
                        Log.d(TAG, "Device target UI mode television is: " + isTv + ", seeking keyword: " + targetKeyword);

                        JSONArray assets = latestRelease.getJSONArray("assets");
                        String fallbackApkUrl = null;
                        
                        for (int i = 0; i < assets.length(); i++) {
                            JSONObject asset = assets.getJSONObject(i);
                            String assetName = asset.getString("name").toLowerCase();
                            if (assetName.endsWith(".apk")) {
                                String downloadUrl = asset.getString("browser_download_url");
                                if (assetName.contains(targetKeyword)) {
                                    mDownloadUrl = downloadUrl;
                                    Log.d(TAG, "Selected asset matched target keyword '" + targetKeyword + "': " + assetName);
                                    break;
                                }
                                if (fallbackApkUrl == null) {
                                    fallbackApkUrl = downloadUrl;
                                }
                            }
                        }

                        if (mDownloadUrl == null) {
                            mDownloadUrl = fallbackApkUrl;
                            if (mDownloadUrl != null) {
                                Log.d(TAG, "No asset matched target keyword '" + targetKeyword + "', falling back to: " + mDownloadUrl);
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

    /**
     * Compares the current installed app version against the latest version tag from GitHub.
     * Handles semantic versioning comparison (e.g., v1.0.1 vs v1.0.2).
     * 
     * @param current The current app version name (e.g., "1.0.0").
     * @param latest The latest release tag from GitHub (e.g., "v1.0.1").
     * @return true if the latest version is newer than the current version, false otherwise.
     */
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

    /**
     * Retrieves the current app version name from the Android package manager or returns the default version.
     * This method is exposed to JavaScript to allow version checks and updates.
     * 
     * @return The installed version name string (e.g., "v0.4.1").
     */
    @JavascriptInterface
    public String getCurrentVersion() {
        try {
            return mActivity.getPackageManager()
                    .getPackageInfo(mActivity.getPackageName(), 0).versionName;
        } catch (Exception e) {
            Log.e(TAG, "Error getting package version name", e);
            return "v0.4.1";
        }
    }

    /**
     * Initiates a direct forced download of the APK from the repository's raw URL.
     * This method is exposed to JavaScript via the @JavascriptInterface annotation.
     */
    @JavascriptInterface
    public void downloadFromRepo() {
        Log.d(TAG, "Requesting direct download from repository...");
        mDownloadUrl = REPO_APK_URL;
        downloadAndInstall();
    }

    /**
     * Directs the native downloader to download and install a package from a custom URL.
     * This method is exposed to JavaScript via the @JavascriptInterface annotation.
     * 
     * @param url The custom HTTP/HTTPS download link to the APK file.
     */
    @JavascriptInterface
    public void downloadAndInstallForUrl(String url) {
        Log.d(TAG, "Requesting custom download URL: " + url);
        mDownloadUrl = url;
        downloadAndInstall();
    }

    /**
     * Begins the background download of the latest APK file.
     * Automatically handles HTTP redirects, writes the stream to the device's external cache directory,
     * and publishes progress updates back to the WebView interface.
     * This method is exposed to JavaScript via the @JavascriptInterface annotation.
     */
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

    /**
     * Triggers the Android system package installer to install the downloaded APK.
     * Uses FileProvider to securely grant the installer read access to the downloaded file.
     * 
     * @param apkFile The File object pointing to the downloaded APK in the cache directory.
     */
    private void installApk(File apkFile) {
        try {
            notifyWebUpdateStatus("installing");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!mActivity.getPackageManager().canRequestPackageInstalls()) {
                    Log.d(TAG, "Requesting install unknown apps permission...");
                    Intent settingsIntent = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    settingsIntent.setData(Uri.parse("package:" + mActivity.getPackageName()));
                    mActivity.startActivity(settingsIntent);
                    notifyWebUpdateError();
                    return;
                }
            }

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

    /**
     * Checks if the device currently has an active network connection (Wi-Fi or Cellular).
     * 
     * @return true if a network connection is available, false otherwise.
     */
    private boolean isNetworkAvailable() {
        ConnectivityManager connectivityManager = (ConnectivityManager) mActivity
                .getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null) {
            return false;
        }
        NetworkInfo activeNetworkInfo = connectivityManager.getActiveNetworkInfo();
        return activeNetworkInfo != null && activeNetworkInfo.isConnected();
    }

    /**
     * Closes/exits the Android application by finishing the main activity on the UI thread.
     * Accessible to JavaScript running in the WebView via the AndroidUpdate interface.
     */
    @JavascriptInterface
    public void exitApp() {
        Log.d(TAG, "exitApp: exiting application");
        mActivity.runOnUiThread(() -> {
            if (!mActivity.isFinishing() && !mActivity.isDestroyed()) {
                mActivity.finish();
            }
        });
    }

    /**
     * Shuts down the background executor service.
     * Should be called when the activity is destroyed to prevent memory leaks.
     */
    public void shutdown() {
        mExecutor.shutdown();
    }

    /**
     * Sends a JavaScript callback to the WebView notifying that a new update is available.
     * 
     * @param version The version string of the new update.
     */
    private void notifyWebFoundUpdate(String version) {
        mActivity.runOnUiThread(() -> mWebView
                .evaluateJavascript("if(typeof onUpdateFound === 'function') onUpdateFound('" + version + "');", null));
    }

    /**
     * Sends a JavaScript callback to the WebView notifying that no new updates were found.
     */
    private void notifyWebNoUpdateFound() {
        mActivity.runOnUiThread(() -> mWebView
                .evaluateJavascript("if(typeof onNoUpdateFound === 'function') onNoUpdateFound();", null));
    }

    /**
     * Sends a JavaScript callback to the WebView to update the UI on the current stage of the update process.
     * 
     * @param statusKey A string representing the current status (e.g., "downloading", "installing").
     */
    private void notifyWebUpdateStatus(String statusKey) {
        mActivity.runOnUiThread(() -> mWebView.evaluateJavascript(
                "if(typeof onUpdateStatus === 'function') onUpdateStatus('" + statusKey + "');", null));
    }

    /**
     * Sends a JavaScript callback to the WebView notifying that an error occurred during the update process.
     */
    private void notifyWebUpdateError() {
        mActivity.runOnUiThread(() -> mWebView
                .evaluateJavascript("if(typeof onUpdateCheckError === 'function') onUpdateCheckError();", null));
    }
}
