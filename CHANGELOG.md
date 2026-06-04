[22:19 27-05-2026] app/build.gradle.kts - Bumped versionName to v0.4.2 and incremented versionCode to 12.
[22:19 27-05-2026] package.json - Bumped version to 0.4.2.
[22:20 27-05-2026] IVIDS.apk - Placed compiled prerelease APK at workspace root directory for distribution.
[22:21 27-05-2026] IVIDS.exe - Placed compiled portable Electron Windows executable at workspace root directory for distribution.
[22:22 27-05-2026] .agents/workflows/version-and-release-update.md - Updated first step of release update workflow to mandate checking version via GitHub releases and tags.
[22:25 27-05-2026] .agents/workflows/version-and-release-update.md - Updated release step 5 to prohibit autonomous push of release commit to main.
[22:25 27-05-2026] .agents/rules/no-autonomous-github-pushes.md - Updated release exception to prohibit autonomous push of release commit to main.
[00:23 31-05-2026] app/src/main/assets/main/gui/js/spatial-nav.js - Fixed double backspace character deletion inside editable input fields by letting the browser natively handle standard backspace.
[00:26 31-05-2026] app/src/main/assets/main/gui/pages/search.html - Added clear button to the recent searches row.
[00:26 31-05-2026] app/src/main/assets/main/gui/css/global.css - Styled the recent-item chips and the clear-recents-btn button.
[00:26 31-05-2026] app/src/main/assets/main/gui/pages/search.js - Updated search debounce delay to 3000ms, cancelled search debounce on explicit action, implemented clear recents handler, and added method-level JSDoc blocks.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/ar.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/cs.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/da.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/de.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/en.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/es.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/fr.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/hi.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/id.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/it.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/ja.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/ko.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/nl.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/no.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/pl.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/pt.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/ro.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/ru.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/sv.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/tr.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/vi.json - Added clearRecents translation key.
[00:26 31-05-2026] app/src/main/assets/main/gui/lang/zh.json - Added clearRecents translation key.
[00:28 31-05-2026] app/src/main/assets/main/gui/images/trash.svg - Created trash icon SVG matching style of existing search icons.
[00:28 31-05-2026] app/src/main/assets/main/gui/pages/search.html - Relocated clear button and added trash icon to search.html.
[00:28 31-05-2026] app/src/main/assets/main/gui/css/global.css - Added styling for the trash-icon, recent-delete-btn, and adjusted chip layout padding.
[00:28 31-05-2026] app/src/main/assets/main/gui/pages/search.js - Updated recent list items to support cross-icon deletion and implemented removeRecentSearch function.
[00:29 31-05-2026] app/src/main/assets/main/gui/css/global.css - Modified active-typing styling to target the parent input-wrapper instead of inner input element when wrapped.
[20:12 03-06-2026] app/src/main/assets/main/gui/pages/search.html - Reordered DOM elements to wrap search controls in .search-container-wrapper and place recents above search bar.
[20:12 03-06-2026] app/src/main/assets/main/gui/css/global.css - Styled .search-container-wrapper to center search bar, moved actions below input, and added side gutters to results.
[20:12 03-06-2026] app/src/main/assets/main/logic/spatial-nav/spatial-nav-search.js - Updated focus routing to accommodate new vertical layout of search controls.
[20:23 03-06-2026] app/src/main/assets/main/gui/pages/search.html - Added text spans inside search and filter action buttons and applied search-action-btn class.
[20:23 03-06-2026] app/src/main/assets/main/gui/css/global.css - Added .search-action-btn class to slightly reduce the size and adjust spacing of search action buttons.
[20:44 03-06-2026] app/src/main/assets/main/gui/js/spatial-nav.js - Fixed critical bug where spatial navigation ignored page-specific overrides by properly invoking currentPageLogic.findNext.
[20:44 03-06-2026] app/src/main/assets/main/logic/spatial-nav/spatial-nav-search.js - Added visibility check for recents row to prevent spatial nav from getting stuck by returning hidden elements.
[21:50 03-06-2026] app/src/main/assets/main/gui/pages/search.js - Modified fetchResults to fetch and concatenate 2 pages (40 items) on initial load to better fill the screen.
[21:58 03-06-2026] app/src/main/assets/main/gui/pages/movies.js - Modified hero slider to consume the entire popular movies list instead of slicing, and removed the popular movies row population.
[21:58 03-06-2026] app/src/main/assets/main/gui/pages/movies.html - Removed the popular movies row container.
[21:58 03-06-2026] app/src/main/assets/main/gui/pages/series.js - Modified hero slider to consume the entire popular series list instead of slicing, and removed the popular series row population.
[21:58 03-06-2026] app/src/main/assets/main/gui/pages/series.html - Removed the popular series row container.
[23:00 03-06-2026] app/src/main/assets/main/logic/api.js - Modified fetchNetflixOriginals to fetch and combine Netflix original movies and TV series with caching.
[23:00 03-06-2026] app/src/main/assets/main/gui/pages/livetv.js - Modified Live TV source loading to be asynchronous and non-blocking, rendering skeletons immediately so page navigation is not locked.
[23:42 03-06-2026] .agents/rules/mockups.md - Created mockup creation rule file to standardize mockup creation locations and naming.
[23:44 03-06-2026] mockup/mockup_hero_indicators.html - Updated hero mockup to slide backdrops horizontally while fading content text overlay.
[23:50 03-06-2026] app/src/main/assets/main/gui/css/global.css - Added sliding track, backdrop panels, and top circular indicators CSS rules, sizing up the dots with a prominent active state.
[23:50 03-06-2026] app/src/main/assets/main/gui/js/hero-slider.js - Modified HeroSlider to build track, set slide widths dynamically, render circular dots, animate with horizontal sliding, and set autoplay duration to 12s.
[23:54 03-06-2026] app/src/main/assets/main/gui/pages/home.html - Removed the trending now row.
[23:54 03-06-2026] app/src/main/assets/main/gui/pages/home.js - Modified hero slider initialization to display all trending items (no slicing) and documented init with JSDoc.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/en.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/ar.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/cs.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/da.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/de.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/es.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/fr.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/hi.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/id.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/it.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/ja.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/ko.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/nl.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/no.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/pl.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/pt.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/ro.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/ru.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/sv.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/tr.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/vi.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/lang/zh.json - Added toast.storageFull and toast.storageFullTitle translation keys.
[14:47 04-06-2026] app/src/main/assets/main/gui/js/router.js - Added loading generation and AbortController to loadPage to prevent navigation race conditions.
[14:47 04-06-2026] app/src/main/assets/main/gui/js/error-handler.js - Removed window.onerror overwrite from init method.
[14:47 04-06-2026] app/src/main/assets/main/gui/js/hero-slider.js - Cleaned up track, dot indicators, and event listeners on destroy to prevent memory leaks.
[14:47 04-06-2026] app/src/main/assets/main/gui/js/screensaver.js - Guarded event listener registration to prevent duplicate active listeners.
[14:47 04-06-2026] app/src/main/assets/main/logic/cache-manager.js - Stored background interval reference and added destroy method.
[14:47 04-06-2026] app/src/main/assets/main/logic/playlists.js - Enforced caps of 50 playlists and 200 items, and caught QuotaExceededError to show full storage toast.
[14:47 04-06-2026] app/src/main/assets/main/logic/recentlyWatched.js - Added QuotaExceededError retry/trim mechanism and normalized ID type comparisons.
[14:47 04-06-2026] run_pc.py - Added SSRF protection checks, request body limits, and common path validation.
[14:47 04-06-2026] main.js - Added webSecurity security comment for BrowserWindow.
[14:47 04-06-2026] app/src/main/assets/main/gui/js/i18n.js - Implemented hardcoded emergency translations fallback.
[14:47 04-06-2026] app/src/main/assets/main/gui/js/splash.js - Added cleanedUp flag in dismiss() to avoid double cleanup execution.
[14:47 04-06-2026] app/src/main/assets/main/gui/js/toast.js - Sanitized toast title and message inputs via textContent to prevent HTML injection.
[14:50 04-06-2026] app/src/main/assets/main/gui/js/hero-slider.js - Increased hero slider description truncation limit to 300 characters.
[14:50 04-06-2026] app/src/main/assets/main/gui/css/global.css - Expanded hero heights to accommodate up to 4 lines of description, styled Webkit line clamp, and added mandatory class annotations.
[14:51 04-06-2026] app/src/main/assets/main/gui/css/global.css - Expanded hero-content and hero-desc max-widths to allow wider layout text.
[14:53 04-06-2026] app/src/main/assets/main/gui/css/global.css - Increased hero-content width limit to min(1100px, 90%) and hero-desc max-width to 1000px (desktop) / 850px (tablet).
[14:53 04-06-2026] app/src/main/assets/main/gui/js/hero-slider.js - Increased text truncation length limit to 450 characters to fill expanded width and updated JSDoc.
