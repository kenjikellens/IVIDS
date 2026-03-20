# Logic: Live TV & M3U Processing

The Live TV module (`m3u-parser.js`) allows users to integrate their own IPTV playlists into the IVIDS interface.

## 📄 M3U Parser Implementation

The parser is a custom-built, lightweight string processor that converts raw `.m3u` files into structured JSON objects.

### Parsing Logic
1.  **Tag Identification**: Scans for `#EXTINF:` tags to begin a channel definition.
2.  **Metadata Extraction**: Extracts `tvg-logo` (channel icon) and `group-title` (category) using regex.
3.  **Name Normalization**: Sanitizes names by splitting at the last comma (the standard M3U format).
4.  **Unique ID Generation**: Generates persistent hash-based IDs (`btoa(url)`) for every stream, ensuring that "Favorites" or "Recently Watched" links survive playlist updates.

---

## 🏗️ Live TV Architecture

### UI Flow
- **Settings**: Users input a remote M3U URL.
- **Bootloader**: On app start, the URL is fetched and parsed. Channels are categorized by `group-title`.
- **Live TV Page**: Renders a categorized view with side-scrolling rows for each group (Sports, Movies, Local, etc.).

### Stream Playback
Channels are treated as a specialized `media_type: 'live'`.
- Unlike VOD content, Live streams are played directly via the native browser HLS/Dash player without external provider redirection.
- **Error Handling**: Standard video event listeners handle stream drops or restricted geo-locations.
