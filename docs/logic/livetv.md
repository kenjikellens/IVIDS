# Logic: Live TV, M3U & Xtream Processing

The Live TV subsystem under `app/src/main/assets/main/logic/livetv/` (`core/live-stream-engine.js`, `core/stream-optimizer.js`, `epg-manager.js`, `xtream-api.js`, `providers/m3u-provider.js`) integrates custom M3U and Xtream Codes IPTV playlists into `livetv.js` and `tv-player.js`.

---

## 📄 M3U & Xtream Parsing (`providers/m3u-provider.js`, `xtream-api.js`)

The parser processes raw `.m3u` / `.m3u8` playlists and Xtream Codes APIs into structured channel objects:

1. **Tag Scanning**: Identifies `#EXTINF:` header tags and custom `#EXTVLCOPT:` / `#EXTGRP:` metadata.
2. **Metadata Extraction**: Extracts `tvg-logo` (channel logo), `group-title` (category), `tvg-id`, and `tvg-name`.
3. **Unique ID Hashing**: Generates persistent channel IDs ensuring favorites and recent zaps survive playlist reloads.

---

## 🛠️ Live TV Architecture & Stream Routing

### 1. Channel Grouping & EPG (`epg-manager.js`)
Channels are grouped by `group-title` (e.g. Sports, News, Entertainment) and rendered as horizontal browsing rows compatible with `SpatialNav`, paired with XMLTV/EPG program info.

### 2. Stream Optimization & Proxy Routing (`stream-optimizer.js`, `live-stream-engine.js`)
- Plain `http://` and raw-IP IPTV streams route proxy-first via same-origin `/proxy?url=...` on both PC (`run_pc.py`) and Android WebView (`https://appassets.androidplatform.net` intercepted in `MainActivity.java`).
- Broken channel reports are routed to `/api/broken-channels` in [run_pc.py](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/run_pc.py) and tracked in `app/src/main/assets/main/logic/livetv/broken-channels.json`.

### 3. Adaptive HLS Playback (`tv-player.js`)
- Integrated with `hls.js` for adaptive bitrate streaming.
- Implements auto-retry mechanisms, watchdog timers, and fallback endpoint switching for dropped network frames.

---

*Single Source of Truth v0.6.4*
