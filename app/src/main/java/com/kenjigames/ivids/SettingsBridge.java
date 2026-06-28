package com.kenjigames.ivids;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import android.webkit.JavascriptInterface;
import org.json.JSONObject;
import java.util.Map;

/**
 * SettingsBridge is a Native-to-JavaScript bridge class that exposes Android SharedPreferences
 * to the WebView. This allows web applications to store preferences securely and persistently
 * in a way that survives application updates.
 */
public class SettingsBridge {
    private static final String TAG = "SettingsBridge";
    private static final String PREFS_NAME = "ivids_settings";
    private final SharedPreferences mPrefs;

    /**
     * Constructs a SettingsBridge instance.
     *
     * @param context The application context used to obtain SharedPreferences.
     */
    public SettingsBridge(Context context) {
        this.mPrefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    /**
     * Retrieves a stored string value from SharedPreferences for a given key.
     *
     * @param key The key associated with the preference.
     * @return The retrieved string value, or null if the key does not exist.
     */
    @JavascriptInterface
    public String getString(String key) {
        try {
            return mPrefs.getString(key, null);
        } catch (Exception e) {
            Log.e(TAG, "Error reading from SharedPreferences for key: " + key, e);
            return null;
        }
    }

    /**
     * Stores a string value in SharedPreferences for a given key.
     *
     * @param key   The key to associate the preference with.
     * @param value The string value to store.
     */
    @JavascriptInterface
    public void setString(String key, String value) {
        try {
            mPrefs.edit().putString(key, value).apply();
        } catch (Exception e) {
            Log.e(TAG, "Error writing to SharedPreferences for key: " + key, e);
        }
    }

    /**
     * Removes a stored preference from SharedPreferences for a given key.
     *
     * @param key The key of the preference to remove.
     */
    @JavascriptInterface
    public void remove(String key) {
        try {
            mPrefs.edit().remove(key).apply();
        } catch (Exception e) {
            Log.e(TAG, "Error removing from SharedPreferences for key: " + key, e);
        }
    }

    /**
     * Retrieves all stored preferences as a JSON string representation.
     *
     * @return A JSON formatted string containing all preference key-value pairs.
     */
    @JavascriptInterface
    public String getAll() {
        try {
            Map<String, ?> allEntries = mPrefs.getAll();
            JSONObject jsonObject = new JSONObject();
            for (Map.Entry<String, ?> entry : allEntries.entrySet()) {
                jsonObject.put(entry.getKey(), entry.getValue());
            }
            return jsonObject.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error retrieving all entries from SharedPreferences", e);
            return "{}";
        }
    }
}
