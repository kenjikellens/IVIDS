package com.kenjigames.ivids;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class UpdateManager {
    private static final String TAG = "UpdateManager";
    private static final String GITHUB_API_URL = "https://api.github.com/repos/kenjikellens/IVIDS/releases";

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
        mExecutor.execute(() -> {
            try {
                URL url = new URL(GITHUB_API_URL);
                notifyWebUpdateStatus("connecting-api");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("Accept", "application/vnd.github.v3+json");
                // GitHub API requires a User-Agent header
                conn.setRequestProperty("User-Agent", "IVIDS-Android-App");

                if (conn.getResponseCode() == 200) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder response = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                    reader.close();

                    JSONArray releases = new JSONArray(response.toString());
                    notifyWebUpdateStatus("fetching-releases");
                    if (releases.length() == 0) {
                        Log.d(TAG, "No releases found");
                        notifyWebNoUpdateFound();
                        return;
                    }

                    // The first release in the array is the most recent (stable or pre-release)
                    JSONObject json = releases.getJSONObject(0);
                    mLatestVersion = json.getString("tag_name");

                    String currentVersion = mActivity.getPackageManager()
                            .getPackageInfo(mActivity.getPackageName(), 0).versionName;

                    Log.d(TAG, "Current version: " + currentVersion + ", Latest version: " + mLatestVersion);

                    if (isNewerVersion(currentVersion, mLatestVersion)) {
                        Log.d(TAG, "New update found: " + mLatestVersion + ". Searching for APK in main branch...");
                        notifyWebUpdateStatus("searching-apk");

                        // New logic: Fetch repo contents from main branch
                        URL contentsUrl = new URL("https://api.github.com/repos/kenjikellens/IVIDS/contents/?ref=main");
                        HttpURLConnection contentsConn = (HttpURLConnection) contentsUrl.openConnection();
                        contentsConn.setRequestMethod("GET");
                        contentsConn.setRequestProperty("Accept", "application/vnd.github.v3+json");
                        contentsConn.setRequestProperty("User-Agent", "IVIDS-Android-App");

                        if (contentsConn.getResponseCode() == 200) {
                            BufferedReader contentsReader = new BufferedReader(
                                    new InputStreamReader(contentsConn.getInputStream()));
                            StringBuilder contentsResponse = new StringBuilder();
                            String cLine;
                            while ((cLine = contentsReader.readLine()) != null) {
                                contentsResponse.append(cLine);
                            }
                            contentsReader.close();

                            JSONArray contents = new JSONArray(contentsResponse.toString());
                            mDownloadUrl = null;
                            for (int i = 0; i < contents.length(); i++) {
                                JSONObject asset = contents.getJSONObject(i);
                                String name = asset.getString("name");
                                if (name.toLowerCase().endsWith(".apk")) {
                                    mDownloadUrl = asset.getString("download_url");
                                    break;
                                }
                            }

                            if (mDownloadUrl != null) {
                                Log.d(TAG, "Found APK in main branch: " + mDownloadUrl);
                                notifyWebFoundUpdate(mLatestVersion);
                            } else {
                                Log.d(TAG, "No APK found in main branch");
                                notifyWebNoUpdateFound();
                            }
                        } else {
                            Log.e(TAG, "GitHub Contents API returned error: " + contentsConn.getResponseCode());
                            notifyWebUpdateError();
                        }
                    } else {
                        Log.d(TAG, "App is up to date");
                        notifyWebNoUpdateFound();
                    }
                } else {
                    Log.e(TAG, "GitHub API returned error: " + conn.getResponseCode());
                    notifyWebUpdateError();
                }
            } catch (Exception e) {
                Log.e(TAG, "Error checking for updates", e);
                notifyWebUpdateError();
            }
        });
    }

    private boolean isNewerVersion(String current, String latest) {
        try {
            notifyWebUpdateStatus("comparing-versions");
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
        } catch (Exception e) {
            Log.e(TAG, "Error comparing versions", e);
            // Fallback: simple string comparison if parsing fails
            return !current.equals(latest);
        }
        return false;
    }

    @JavascriptInterface
    public void downloadAndInstall() {
        if (mDownloadUrl == null) {
            Log.e(TAG, "No download URL available");
            return;
        }

        Log.d(TAG, "Starting download: " + mDownloadUrl);
        mExecutor.execute(() -> {
            try {
                URL url = new URL(mDownloadUrl);
                notifyWebUpdateStatus("downloading");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestProperty("User-Agent", "IVIDS-Android-App");
                conn.connect();

                File downloadDir = new File(mActivity.getExternalCacheDir(), "updates");
                if (!downloadDir.exists())
                    downloadDir.mkdirs();

                File apkFile = new File(downloadDir, "IVIDS-update.apk");
                if (apkFile.exists())
                    apkFile.delete();

                InputStream is = new BufferedInputStream(conn.getInputStream());
                FileOutputStream fos = new FileOutputStream(apkFile);

                byte[] data = new byte[8192];
                int count;
                while ((count = is.read(data)) != -1) {
                    fos.write(data, 0, count);
                }

                fos.flush();
                fos.close();
                is.close();

                Log.d(TAG, "Download complete: " + apkFile.getAbsolutePath());
                installApk(apkFile);
            } catch (Exception e) {
                Log.e(TAG, "Error downloading update", e);
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

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }

            mActivity.startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "Error starting installation", e);
        }
    }

    private void notifyWebFoundUpdate(String version) {
        mActivity.runOnUiThread(() -> {
            mWebView.evaluateJavascript("if(typeof onUpdateFound === 'function') onUpdateFound('" + version + "');",
                    null);
        });
    }

    private void notifyWebNoUpdateFound() {
        mActivity.runOnUiThread(() -> {
            mWebView.evaluateJavascript("if(typeof onNoUpdateFound === 'function') onNoUpdateFound();", null);
        });
    }

    private void notifyWebUpdateStatus(String statusKey) {
        mActivity.runOnUiThread(() -> {
            mWebView.evaluateJavascript("if(typeof onUpdateStatus === 'function') onUpdateStatus('" + statusKey + "');",
                    null);
        });
    }

    private void notifyWebUpdateError() {
        mActivity.runOnUiThread(() -> {
            mWebView.evaluateJavascript("if(typeof onUpdateCheckError === 'function') onUpdateCheckError();", null);
        });
    }
}
