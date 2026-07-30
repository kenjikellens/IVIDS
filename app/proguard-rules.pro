# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep JavaScript Interface methods for WebView bridge (UpdateManager, etc.)
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.kenjigames.ivids.** { *; }
-keepclassmembers class com.kenjigames.ivids.** { *; }