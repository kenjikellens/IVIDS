# Optimalisatierapport (IVIDS)

Dit document bevat de geïdentificeerde optimalisatiemogelijkheden in de codebase van IVIDS om code te reduceren, redundantie te verminderen, en prestaties te verbeteren.

---

## 1. Root & Electron Config Files

### [main.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/main.js)
* **Netwerk API migratie (Performance & Security)**: `main.js` gebruikt handmatig gedefinieerde `http`/`https` GET requests met een handmatige redirect-handler (`requestUrl`).
  * *Optimalisatie*: Vervang `http`/`https` module door Electron's ingebouwde `net.request` API of gebruik de native `fetch` API. `net.request` maakt gebruik van Chromium's netwerk-stack en respecteert automatisch systeemproxy's, is veiliger en presteert beter.
* **webSecurity activering (Security/Performance)**: `webSecurity: false` is momenteel ingeschakeld.
  * *Optimalisatie*: Volg de TODO om API-requests (zoals TMDB/VidSrc) te routeren via een local proxy of `session.webRequest` API. Dit maakt het mogelijk om `webSecurity: true` te zetten en verlaagt XSS-risico's.


## 2. Front-end Library/Utility/Core JS (assets/main/gui/js/)

### [dom-recycler.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/dom-recycler.js)
* **CSS content-visibility Alternatief (Performance/Code-reductie)**: Gebruikt een JS `IntersectionObserver` om off-screen elementen te verbergen.
  * *Optimalisatie*: In moderne Chromium-engines kan dit gedrag (en de bijbehorende JS overhead) volledig worden vervangen door de CSS-eigenschap `content-visibility: auto` met `contain-intrinsic-size` toe te passen op lijst-items en kaarten. Dit vermindert JS execution en garbage collection.

### [i18n.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/i18n.js) & [language-manager.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/logic/language-manager.js)
* **Architecturale Redundantie (Code-reductie)**: Er zijn twee aparte i18n-systemen aanwezig. `language-manager.js` (statishe JS imports) en `i18n.js` (dynamische fetch-requests van JSON).
  * *Optimalisatie*: Consolideer deze twee systemen tot één enkele vertaalmanager (bij voorkeur `i18n.js` vanwege de dynamische laadmogelijkheid om bundelgrootte te beperken) en verwijder de andere.

### [lazy-loader.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/js/lazy-loader.js)
* **Browser-Native Image Lazy Loading**: Gebruikt een handmatige IntersectionObserver voor image lazy loading.
  * *Optimalisatie*: Gebruik de native HTML5-attribuut `loading="lazy"` voor de `<img>` elementen. Dit verlaagt JS-overhead aanzienlijk.


## 3. Components & Page Logic

### [livetv.js](file:///c:/Users/kenji/AndroidStudioProjects/IVIDS/app/src/main/assets/main/gui/pages/livetv.js)
* **Redundante Settings/Config-loading (Performance/Code-reductie)**: De methode `loadMergedSettings()` laadt handmatig `ivids-settings` en de user namespaced settings en voegt deze samen.
  * *Optimalisatie*: Vervang dit door een aanroep naar `Api.getPlayerConfig()`. Dit voorkomt code-duplicatie en vermindert schijf I/O via localStorage.
* **updateStoredChannelStatus Disk I/O (Performance)**: Deze methode voert bij elke aanroep (bijv. zappen of streamfout) een `getItem`, filter, `JSON.parse` en `setItem` uit op `localStorage`. Dit is traag.
  * *Optimalisatie*: Houd de cache in-memory (`statusCache` map) en schrijf deze debounced weg naar `localStorage` (bijv. 1-2 seconden na de laatste zapping-actie) in plaats van synchroon bij elke wijziging.


## 4. CSS Stylesheets (assets/main/gui/css/)

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
