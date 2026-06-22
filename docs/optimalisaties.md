# Optimalisatierapport (IVIDS)

Dit document bevat de geïdentificeerde optimalisatiemogelijkheden in de codebase van IVIDS om code te reduceren, redundantie te verminderen, en prestaties te verbeteren.

---

## 1. Root & Electron Config Files

### [main.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/main.js)
* **Netwerk API migratie (Performance & Security)**: `main.js` gebruikt handmatig gedefinieerde `http`/`https` GET requests met een handmatige redirect-handler (`requestUrl`).
  * *Optimalisatie*: Vervang `http`/`https` module door Electron's ingebouwde `net.request` API of gebruik de native `fetch` API. `net.request` maakt gebruik van Chromium's netwerk-stack en respecteert automatisch systeemproxy's, is veiliger en presteert beter.
* **webSecurity activering (Security/Performance)**: `webSecurity: false` is momenteel ingeschakeld.
  * *Optimalisatie*: Volg de TODO om API-requests (zoals TMDB/VidSrc) te routeren via een local proxy of `session.webRequest` API. Dit maakt het mogelijk om `webSecurity: true` te zetten en verlaagt XSS-risico's.

### [preload.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/preload.js)
* Geen significante optimalisaties gevonden. De file is al erg beknopt en maakt correct gebruik van `contextBridge` en `ipcRenderer`.

### [update-version.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/update-version.js)
* Geen prestatieoptimalisaties nodig; dit is een simpel build/release script dat sequentieel draait en weinig resources verbruikt.

### [run_pc.py](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/run_pc.py)
* Geen openstaande optimalisaties. De CORS-proxy streamt direct chunks naar de cliënt voor niet-manifest/gzip bronnen en verifieert de gzip-status via magische bytes.

### [scan_broken_channels.py](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/scan_broken_channels.py)
* Geen openstaande optimalisaties. Connectie-pooling via requests.Session is geïmplementeerd en zenders worden direct via ranged GET-aanroepen geverifieerd.


## 2. Core Logic (assets/main/logic/)

### [account-helper.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/logic/account-helper.js)
* Geen openstaande optimalisaties. In-memory caching van het actieve account is geïmplementeerd.

### [api.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/logic/api.js)
* Geen openstaande optimalisaties. De redundante storage queries zijn opgelost door de caching in `account-helper.js`.

### [crypto.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/logic/crypto.js)
* Geen openstaande optimalisaties. PBKDF2-operaties zijn gereduceerd tot O(1) door gebruikers te registreren en op te zoeken onder hun gehashte e-mailadres via Firebase PUT. `bytesToHex` is micro-geoptimaliseerd met een vooraf berekende LUT.

### [m3u-parser.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/logic/m3u-parser.js)
* Geen openstaande optimalisaties. Retry-logica met exponentiële back-off is geïmplementeerd om tijdelijke netwerkfouten op te vangen.

### [migration.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/logic/migration.js), [playlists.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/logic/playlists.js), [recentlyWatched.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/logic/recentlyWatched.js)
* Geen kritieke prestatie- of redundantieproblemen. `playlists.js` en `recentlyWatched.js` maken al correct gebruik van in-memory caching (`_playlistsCache` en `_recentlyWatchedCache`).


## 3. Front-end Library/Utility/Core JS (assets/main/gui/js/)

### [dom-recycler.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/dom-recycler.js)
* **CSS content-visibility Alternatief (Performance/Code-reductie)**: Gebruikt een JS `IntersectionObserver` om off-screen elementen te verbergen.
  * *Optimalisatie*: In moderne Chromium-engines kan dit gedrag (en de bijbehorende JS overhead) volledig worden vervangen door de CSS-eigenschap `content-visibility: auto` met `contain-intrinsic-size` toe te passen op lijst-items en kaarten. Dit vermindert JS execution en garbage collection.

### [i18n.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/i18n.js) & [language-manager.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/logic/language-manager.js)
* **Architecturale Redundantie (Code-reductie)**: Er zijn twee aparte i18n-systemen aanwezig. `language-manager.js` (statishe JS imports) en `i18n.js` (dynamische fetch-requests van JSON).
  * *Optimalisatie*: Consolideer deze twee systemen tot één enkele vertaalmanager (bij voorkeur `i18n.js` vanwege de dynamische laadmogelijkheid om bundelgrootte te beperken) en verwijder de andere.

### [skeleton-renderer.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/skeleton-renderer.js)
* **Event Delegation voor Error Cards (Performance/Geheugen)**: Voegt een `onclick` handler toe aan elke individuele skeleton card in een error-rij. Dit leidt tot $N$ listener-toewijzingen en eventuele memory leaks.
  * *Optimalisatie*: Gebruik Event Delegation door één enkele click listener toe te voegen aan de parent container (`rowPosters`) en te controleren of het geklikte element een error card is.

### [error-handler.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/error-handler.js)
* **Redundante DOM Vervanging**: Gebruikt `replaceChild` met een kloon van de retry-knop om oude listeners te verwijderen.
  * *Optimalisatie*: In plaats van een DOM-node te klonen en te vervangen, kan simpelweg `retryBtn.onclick = ...` worden overschreven. Dit voorkomt onnodige layout-invalidaties en repaint-overhead.

### [lazy-loader.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/lazy-loader.js)
* **Browser-Native Image Lazy Loading**: Gebruikt een handmatige IntersectionObserver voor image lazy loading.
  * *Optimalisatie*: Gebruik de native HTML5-attribuut `loading="lazy"` voor de `<img>` elementen. Dit verlaagt JS-overhead aanzienlijk.

### Overige bestanden ([app.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/app.js), [hero-slider.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/hero-slider.js), [router.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/router.js), [screensaver.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/screensaver.js), [splash.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/splash.js), [toast.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/toast.js), [update-prompt.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/update-prompt.js), [updater.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/updater.js))
* Geen significante prestatie- of redundantieoptimalisaties geïdentificeerd. Deze files zijn al geoptimaliseerd (bijv. `router.js` met prefetch- en caching-logica, en `screensaver.js` met throttled activiteitsdetectie).


## 4. Components & Page Logic

### [livetv.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/livetv.js)
* **Redundante Settings/Config-loading (Performance/Code-reductie)**: De methode `loadMergedSettings()` laadt handmatig `ivids-settings` en de user namespaced settings en voegt deze samen.
  * *Optimalisatie*: Vervang dit door een aanroep naar `Api.getPlayerConfig()`. Dit voorkomt code-duplicatie en vermindert schijf I/O via localStorage.
* **updateStoredChannelStatus Disk I/O (Performance)**: Deze methode voert bij elke aanroep (bijv. zappen of streamfout) een `getItem`, filter, `JSON.parse` en `setItem` uit op `localStorage`. Dit is traag.
  * *Optimalisatie*: Houd de cache in-memory (`statusCache` map) en schrijf deze debounced weg naar `localStorage` (bijv. 1-2 seconden na de laatste zapping-actie) in plaats van synchroon bij elke wijziging.

### [playlist-details.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/playlist-details.js)
* **DOM-recreatie via Klonen (Performance)**: Gebruikt `cloneNode(true)` en `replaceChild` op `confirmBtn` en `cancelBtn` in `openEditPlaylistModal` en `showConfirmationModal` om oude event listeners te wissen.
  * *Optimalisatie*: Overschrijf simpelweg de `.onclick` property (`btn.onclick = ...`). Dit voorkomt onnodige DOM-mutaties, style recalculations en reflows.

### Overige pagina's ([sidebar.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/components/sidebar/sidebar.js), [account.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/account.js), [browse.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/browse.js), [details.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/details.js), [login.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/login.js), [player.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/player.js), [playlists.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/playlists.js), [search.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/search.js), [settings.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/settings.js), [tv-player.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/tv-player.js))
* Geen significante prestatie- of redundantieoptimalisaties gevonden. Bestanden zoals `search.js` maken al correct gebruik van query-caching (`cachedCountryItems`) en `settings.js`/`tv-player.js` ruimen event listeners netjes op.


## 5. CSS Stylesheets (assets/main/gui/css/)

### [global.css](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/css/global.css)
* **Hover en Focus Animatie Schaling (Performance & Stijlrichtlijnen)**: De klasse `.focusable-card:hover`, `.focusable-card:focus`, `.focusable-card.focused` maakt gebruik van `transform: scale(1.04);`. Dit veroorzaakt layout-herberekeningen en extra compositor-overhead in de browser en schendt de richtlijnen voor animaties.
  * *Optimalisatie*: Vervang de schaling door een statische, dikkere witte rand (`border-width: 4px;` of een witte outline/border) om verplaatsing en schaling op focus/hover te vermijden en de GPU-belasting te verminderen.
* **Pixel-gebaseerde Containers (Responsiviteit & Richtlijnen)**: Verschillende containers (zoals `.error-content` en `.profiles-grid`) gebruiken absolute pixel-maxima (`width: min(680px, 94vw);`, `width: min(550px, 100%);`).
  * *Optimalisatie*: Vervang deze door percentage-gebaseerde breedtes (`%` van de viewport of parent-container) om beter aan te sluiten bij de "Pixel-Less Layout"-richtlijn.

### [global-mobile.css](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/css/global-mobile.css)
* **Eliminatie van `!important` Declaraties (Code-reductie & Specificiteit)**: Gebruikt `!important` voor `.nav-item.active` en `.nav-item.active .nav-icon`.
  * *Optimalisatie*: Verhoog de selector-specificiteit in de CSS-hiërarchie in plaats van `!important` te gebruiken. Dit voorkomt cascading conflicten en houdt de CSS schoon en voorspelbaar.

### [loader.css](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/css/loader.css)
* **Centreren zonder Transform (Performance)**: `.poster-loader` gebruikt `transform: translate(-50%, -50%);` voor centrering.
  * *Optimalisatie*: Gebruik flexbox of grid layout (`display: grid; place-items: center;`) op de parent-container om elementen te centreren zonder extra render-instructies via transforms.





