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
[20:10 22-05-2026] run_pc.py - Added $WEBAPIS stub route, served static JS webapis file, removed Referer header from proxy requests to fix 403 hotlink blocks, and implemented clean path extraction to support cache-busting query strings.
[20:10 22-05-2026] app/src/main/assets/main/gui/pages/livetv.js - Implemented normalizeUrl URL helper, normalized channel URL checks when loading and filtering channels, added cache-busting parameter to broken-channel DB fetches, and proxied all remote playlist URL requests.
[20:10 22-05-2026] app/src/main/assets/main/logic/livetv/sources.js - Corrected Sports category playlist filename and updated Junguler radio playlist source URL.
[20:10 22-05-2026] app/src/main/assets/main/logic/livetv/broken-channels.json - Updated database of broken channel URLs.
[20:10 22-05-2026] app/src/main/assets/main/logic/livetv/working-channels.json - Updated database of working channel URLs.
[20:10 22-05-2026] app/src/main/assets/main/logic/spatial-nav/spatial-nav-profiles.js - Created spatial navigation stub for the profiles page.
[20:10 22-05-2026] app/src/main/assets/main/logic/spatial-nav/spatial-nav-livetv.js - Created spatial navigation stub for the Live TV page.
[20:10 22-05-2026] app/src/main/assets/main/logic/spatial-nav/spatial-nav-tv-player.js - Created spatial navigation stub for the TV player page.
[20:18 22-05-2026] docs/problems.md - Created and updated document to track known UI/player problems, naming discrepancies, remote playlist 404s, proxy gateway errors, and codec/browser play interrupts.
[21:24 22-05-2026] app/src/main/assets/main/logic/livetv/epg-manager.js - Added gzip decompression via DecompressionStream for .gz XMLTV guide URLs so EPG data parses correctly.
[21:40 22-05-2026] app/src/main/assets/main/gui/pages/livetv.js - Implemented search input debouncing, DocumentFragment batch insertion, and logo lazy-loading to optimize channel list performance.
[21:45 22-05-2026] app/src/main/assets/main/gui/pages/livetv.js - Refactored playlist loading to fetch in parallel, pre-computed search/filter keys, and replaced sentinel IntersectionObserver with container scroll and focus pagination triggers.
[23:05 22-05-2026] run_pc.py - Added 2-hour Cache-Control header for M3U playlist proxy requests and prevented end_headers from overriding it.
[23:05 22-05-2026] app/src/main/assets/main/logic/m3u-parser.js - Optimized attribute parsing using indexOf/substring index lookups and added a 4-second fetch timeout using AbortController.
[23:05 22-05-2026] app/src/main/assets/main/gui/pages/livetv.js - Implemented in-memory channel caching to bypass redundant fetching on subsequent page visits.
[23:05 22-05-2026] app/src/main/assets/main/logic/livetv/sources.js - Removed redundant duplicate global_by_category and global_by_country preset M3U sources.
[23:53 22-05-2026] app/src/main/assets/main/logic/api.js - Updated streaming servers list to active providers and adjusted auto-migration rules.
[23:53 22-05-2026] app/src/main/assets/main/gui/pages/settings.js - Adjusted settings load and migration logic to skip blocking active VidSrc.to domains.
[23:53 22-05-2026] app/src/main/assets/main/gui/pages/player.html - Restructured the media player page with a structured TV-friendly HUD overlay and a spinner loading screen.
[23:53 22-05-2026] app/src/main/assets/main/gui/css/player.css - Styled the cinematic player HUD, spinner loader, and thick white button highlights using percentage layouts.
[23:53 22-05-2026] app/src/main/assets/main/gui/pages/player.js - Programmed dynamic TMDB metadata rendering, episode lookup, HUD activity fade, and focus trap mitigation.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/ar.json - Localized Arabic player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/cs.json - Localized Czech player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/da.json - Localized Danish player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/de.json - Localized German player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/en.json - Localized English player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/es.json - Localized Spanish player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/fr.json - Localized French player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/hi.json - Localized Hindi player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/id.json - Localized Indonesian player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/it.json - Localized Italian player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/ja.json - Localized Japanese player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/ko.json - Localized Korean player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/nl.json - Localized Dutch player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/no.json - Localized Norwegian player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/pl.json - Localized Polish player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/pt.json - Localized Portuguese player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/ro.json - Localized Romanian player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/ru.json - Localized Russian player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/sv.json - Localized Swedish player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/tr.json - Localized Turkish player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/vi.json - Localized Vietnamese player status title, status message, and loading text key strings.
[23:53 22-05-2026] app/src/main/assets/main/gui/lang/zh.json - Localized Chinese player status title, status message, and loading text key strings.
[23:54 22-05-2026] app/src/main/assets/main/gui/css/global.css - Hid sidebar/bottom navigation bar in fullscreen layout, and appended player page layout and HUD styling rules.
[00:10 23-05-2026] app/src/main/assets/main/gui/css/global.css - Fixed corrupt focus styles and synchronized layout rules for bottom panel grid slots.
[00:10 23-05-2026] app/src/main/assets/main/gui/pages/player.js - Programmed player cleanups, keydown back interception, click exit redirection, and active server focus targeting.
[00:26 23-05-2026] app/src/main/assets/main/gui/css/global.css - Added standard property 'background-clip' for CSS gradient compatibility and resolved trailing properties.
[14:02 23-05-2026] app/build.gradle.kts - Bumped versionName to v0.4.0 and incremented versionCode to 10.
[14:02 23-05-2026] gradle.properties - Updated org.gradle.java.home to JDK 21 to resolve Android Studio JBR compilation errors.
[14:02 23-05-2026] package.json - Bumped version to 0.4.0 to match target release.
[14:02 23-05-2026] IVIDS.apk - Placed compiled prerelease APK at workspace root directory for distribution.
[14:02 23-05-2026] IVIDS.exe - Placed compiled portable Electron Windows executable at workspace root directory for distribution.

