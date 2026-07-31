# Logic: Live TV & M3U Processing

The Live TV module (`m3u-parser.js` and `livetv.js`) allows users to integrate custom IPTV playlists into the IVIDS interface with full D-pad TV control and channel status persistence.

---

## 📄 M3U Playlist Parsing (`m3u-parser.js`)

The parser is a lightweight, line-by-line processor that parses raw `.m3u` / `.m3u8` files into structured JSON channel objects:

1. **Tag Scanning**: Identifies `#EXTINF:` header tags.
2. **Metadata Extraction**: Extracts `tvg-logo` (channel logo), `group-title` (category), and `tvg-name`.
3. **Unique ID Hashing**: Generates persistent hash-based channel IDs (`btoa(url)`) ensuring favorites and recent zaps survive playlist reloads.

---

## 🛠️ Live TV Architecture & Persistence

### 1. Channel Grouping & Navigation
Channels are grouped by `group-title` (e.g. Sports, News, Entertainment) and rendered as horizontal browsing rows compatible with `SpatialNav`.

### 2. Broken Channel Reporting API (`/api/broken-channels`)
When a stream fails to load or returns HTTP errors during playback:
- The app sends a POST payload to `/api/broken-channels` (handled in [run_pc.py](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/run_pc.py#L185-L186)).
- Appends the failed channel URL to `app/src/main/assets/main/logic/livetv/broken-channels.json` without duplicates, allowing automated channel health auditing.

### 3. Adaptive HLS Playback (`tv-player.js`)
- Integrated with `Hls.js` for adaptive bitrate streaming.
- Implements auto-retry mechanisms for dropped network frames and geo-restricted IPTV feeds.

---

*Single Source of Truth v0.4.5*
