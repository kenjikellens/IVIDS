# Known Problems and Issues

This document tracks known issues, architectural discrepancies, and performance bottlenecks identified within the IVIDS application.

## 1. Documentation & Code Discrepancies
* **List vs. Grid Naming:** The documentation and code comments frequently refer to the Live TV interface as a "grid" (e.g. `spatial-nav-livetv.js`, `filterAndRenderChannels`), but the actual UI is implemented as a list layout. Comments and documentation need updating to reflect the list structure correctly.

## 2. Stream Playback & Preview Reliability
* **High Failure Rate:** Approximately 80% of preview/player streams fail to play. This is due to a combination of:
  * Expired or dead upstream source URLs in preset M3U playlists.
  * Geographic restrictions (geo-blocks) on stream CDNs.
  * User-Agent or hotlinking protections that block requests even when routed through the local proxy.
* **Dead Remote Preset Playlists (404 Upstream):** Remote M3U playlists hosted on `i.mjh.nz` (including Pluto TV, Samsung TV Plus, Plex, and Stirr) return `404 Not Found` directly from the upstream server, causing playlist fetch failures.
* **Segment & Sub-Playlist Failures:** Rewritten proxy URLs for HLS sub-playlists/segments frequently fail with `502 Bad Gateway` or `404 Not Found` due to expired authorization tokens or server drops on the upstream end.
* **Browser Playback Interruptions (`AbortError`):** Rapid navigation/zapping causes HLS `play()` calls to be interrupted by subsequent `pause()` calls, and browsers automatically suspend video-only background streams to save power.
* **Codec Support Limitations (`NotSupportedError`):** Playback attempts on certain formats trigger browser errors (`The element has no supported sources`) when HLS.js or the native media player lacks appropriate decoding codecs.

## 3. Performance Bottlenecks
* **TV Player Loading Times:** The custom TV player takes excessively long to load and start playback. The loading flow, buffer thresholds, and client-side HLS initialization need profiling and optimization to reduce time-to-first-frame.

## 4. Feature Deficiencies
* **Program Info (EPG) Failures:** Program information (EPG) and upcoming program lists have never worked correctly. XMLTV parses fail or do not line up with the active channels, resulting in "No program info available" for all streams.

## 5. WebView/APK Startup & Compatibility Crashes
* **TypeError in app.js on Boot Update Checks:**
  * **Description:** The global update callbacks in `app.js` checked the active state of `update-overlay` using `document.getElementById('update-overlay')?.style.display === 'flex'`. Since the overlay doesn't exist on boot, this evaluated `style` to `undefined` and crashed on `.display`, throwing a fatal `TypeError` synchronously. This aborted `DOMContentLoaded` execution, preventing page routing (blank/empty UI) and breaking settings button event listeners.
  * **Status:** Fixed in working copy (replaced with safe element checks).
* **TMDb API & EPG Loading Failures (Promise.prototype.finally):**
  * **Description:** The use of `Promise.prototype.finally()` for in-flight request cleanup in `api.js` and `epg-manager.js` threw a `TypeError: finally is not a function` on older Android WebViews/TV engines lacking ES2018 support. This rejected all network request promises instantly, blocking titles, posters, and EPG listings.
  * **Status:** Fixed in working copy (replaced with standard `.then()`/`.catch()` promise chaining).


