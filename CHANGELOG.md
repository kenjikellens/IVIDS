[22:07 21-05-2026] app/src/main/assets/main/gui/pages/livetv.html - Removed the main central loader overlay.
[22:07 21-05-2026] app/src/main/assets/main/gui/pages/livetv.js - Injected channel skeleton elements with nested mini spinners inside the channel list during load.
[22:07 21-05-2026] app/src/main/assets/main/gui/css/loader.css - Styled the channel loading skeleton UI and its mini-conic sweep spinner.
[22:08 21-05-2026] app/src/main/assets/main/gui/pages/livetv.js - Restored channel card layout to only logo and name and nested skeleton spinner inside the logo placeholder.
[22:08 21-05-2026] app/src/main/assets/main/gui/css/loader.css - Removed margins from skeleton mini spinner and cleaned up unused classes.
[22:10 21-05-2026] app/src/main/assets/main/gui/css/global.css - Redefined focus-ring and focus-ring-strong variables to be thin white borders without green outer glows.
[22:25 21-05-2026] app/src/main/assets/main/gui/css/global.css - Unified filter dropdown and search input styling heights, reduced border radii to 4px, and aligned layouts to 30%/68% columns.
[22:28 21-05-2026] app/src/main/assets/main/gui/css/global.css - Redefined focus-ring variable to 3px to generalize the white outline hover/focus highlight.
[22:42 21-05-2026] app/src/main/assets/main/gui/css/global.css - Changed the global hover/focus border style to 4px solid white.
[22:43 21-05-2026] app/src/main/assets/main/gui/css/global.css - Fixed hover layout shifts by combining border-color and box-shadow for a 4px visual outline.
[22:45 21-05-2026] app/src/main/assets/main/gui/css/global.css - Removed raw button and input focus outline to prevent double borders.
[22:47 21-05-2026] app/src/main/assets/main/gui/css/global.css - Suppressed focus/hover borders on elements nested inside input and select wrappers.
[22:49 21-05-2026] app/src/main/assets/main/gui/css/global.css - Suppressed focus/hover borders/shadows on child inputs and buttons inside wrappers to fix double borders.
[22:52 21-05-2026] app/src/main/assets/main/gui/pages/livetv.html - Removed search counter badge markup from top bar search box.
[22:52 21-05-2026] app/src/main/assets/main/gui/pages/livetv.js - Removed search counter text update code from filterAndRenderChannels function.
[22:52 21-05-2026] app/src/main/assets/main/gui/css/global.css - Deleted unused search-counter-badge styling selectors.
[22:58 21-05-2026] app/src/main/assets/main/gui/pages/livetv.html - Replaced the channel metadata preview card with a livestream video player preview.
[22:58 21-05-2026] app/src/main/assets/main/gui/css/global.css - Added video preview container and loading overlay styles, and removed old preview card CSS.
[22:58 21-05-2026] app/src/main/assets/main/gui/pages/livetv.js - Integrated debounced livestream preview loading and added routing hooks for player cleanup.
[22:59 21-05-2026] app/src/main/assets/main/gui/css/player.css - Updated server buttons focus/hover states to eliminate layout shifts.
[22:59 21-05-2026] app/src/main/assets/main/gui/pages/livetv.js - Refactored router loadPage/goBack wrappers to restore both hooks simultaneously during transition.
[23:02 21-05-2026] app/src/main/assets/main/gui/css/global.css - Replaced preview layout with 60% player and 40% clean, scrollable TV-friendly program timeline list.
[23:10 21-05-2026] app/src/main/assets/main/gui/css/global.css - Modified tv-overlay and tv-loading classes to resolve z-index and click blocking issues in the player page.
[23:10 21-05-2026] app/src/main/assets/main/gui/index.html - Updated fetch polyfill to route all requests via XHR on file:// protocol, including required JSDoc documentation.
[16:59 22-05-2026] run_pc.py - Implemented transparent gzip decompression in the proxy server for XMLTV guides.
[16:59 22-05-2026] app/src/main/assets/main/logic/livetv/epg-manager.js - Added dynamic XMLTV source routing and timeline date shifting for stale EPG listings.
[17:13 22-05-2026] app/src/main/assets/main/logic/livetv/broken-channels.json - Created persistent broken channels database file (empty initial array).
[17:13 22-05-2026] run_pc.py - Added GET/POST /api/broken-channels endpoints for reading and appending to the broken channels database file.
[17:13 22-05-2026] app/src/main/assets/main/gui/pages/livetv.js - Restored missing LIVE_TV_STATUS_KEY constant, added brokenChannelsSet and persistent DB loading/writing, fixed skeleton UI to include status dot, implemented chunked rendering (batch 30) with IntersectionObserver, added background stream verification queue with 5 concurrent workers, added animated offline channel removal with focus management.
[17:15 22-05-2026] scan_broken_channels.py - Created standalone CLI scanner that fetches all M3U playlists, tests every stream URL, and writes broken URLs to broken-channels.json.
[18:03 22-05-2026] scan_broken_channels.py - Added working-channels.json database support, skipped already scanned items, added --recheck option, and configured UTF-8 console output.
[18:03 22-05-2026] app/src/main/assets/main/logic/livetv/sources.js - Added IPTV Italia, YanG Gather, and MyIPTV Global alternative M3U playlist preset sources.
[19:00 22-05-2026] app/src/main/assets/main/gui/pages/livetv.html - Removed Settings button and settings modal elements to completely remove broken channel settings config.
[19:00 22-05-2026] app/src/main/assets/main/gui/pages/livetv.js - Removed hideBroken variable and settings-related functions/logic, ensuring broken channels are always excluded from load/scan, and added JSDoc documentation to all modified functions.
[19:03 22-05-2026] app/src/main/assets/main/gui/pages/livetv.js - Removed persistBrokenChannel call from updateChannelStatus and deleted persistBrokenChannel helper function to prevent auto-blacklisting channels.
[19:03 22-05-2026] app/src/main/assets/main/logic/livetv/broken-channels.json - Reset polluted database to empty array to allow valid channels to display.
[19:12 22-05-2026] app/src/main/assets/main/gui/pages/livetv.js - Removed background verification scanner logic and stopped dynamic removal of offline channel cards from the DOM.

