# Known Problems and Issues

This document tracks known issues, architectural discrepancies, and performance bottlenecks identified within the IVIDS application.

## 1. Stream Playback & Preview Reliability
* **High Failure Rate:** Approximately 80% of preview/player streams fail to play. This is due to a combination of:
  * Expired or dead upstream source URLs in preset M3U playlists.
  * Geographic restrictions (geo-blocks) on stream CDNs.
  * User-Agent or hotlinking protections that block requests even when routed through the local proxy.
* **Segment & Sub-Playlist Failures:** Rewritten proxy URLs for HLS sub-playlists/segments frequently fail with `502 Bad Gateway` or `404 Not Found` due to expired authorization tokens or server drops on the upstream end.
* **Browser Playback Interruptions (`AbortError`):** Rapid navigation/zapping causes HLS `play()` calls to be interrupted by subsequent `pause()` calls, and browsers automatically suspend video-only background streams to save power.
* **Codec Support Limitations (`NotSupportedError`):** Playback attempts on certain formats trigger browser errors (`The element has no supported sources`) when HLS.js or the native media player lacks appropriate decoding codecs.


