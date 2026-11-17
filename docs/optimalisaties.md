# Optimalisatierapport (IVIDS)

Dit document bevat de geïdentificeerde optimalisatiemogelijkheden in de codebase van IVIDS om code te reduceren, redundantie te verminderen, en prestaties te verbeteren.

---

## 1. Root & Electron Config Files

### [main.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/main.js)
* **Netwerk API migratie (Performance & Security)**: `main.js` gebruikt handmatig gedefinieerde `http`/`https` GET requests met een handmatige redirect-handler (`requestUrl`).
  * *Optimalisatie*: Vervang `http`/`https` module door Electron's ingebouwde `net.request` API of gebruik de native `fetch` API. `net.request` maakt gebruik van Chromium's netwerk-stack en respecteert automatisch systeemproxy's, is veiliger en presteert beter.
* **webSecurity activering (Security/Performance)**: `webSecurity: false` is momenteel ingeschakeld.
  * *Optimalisatie*: Volg de TODO om API-requests (zoals TMDB/VidSrc) te routeren via een local proxy of `session.webRequest` API. Dit maakt het mogelijk om `webSecurity: true` te zetten en verlaagt XSS-risico's.


## 2. Front-end Library/Utility/Core JS (assets/main/gui/js/)

### [dom-recycler.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/js/dom-recycler.js)
* **CSS content-visibility Alternatief (Performance/Code-reductie)**: Gebruikt een JS `IntersectionObserver` om off-screen elementen te verbergen.
  * *Optimalisatie*: In moderne Chromium-engines kan dit gedrag (en de bijbehorende JS overhead) volledig worden vervangen door de CSS-eigenschap `content-visibility: auto` met `contain-intrinsic-size` toe te passen op lijst-items en kaarten. Dit vermindert JS execution en garbage collection.

### [lazy-loader.js](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/js/lazy-loader.js)
* **Browser-Native Image Lazy Loading**: Gebruikt een handmatige IntersectionObserver voor image lazy loading.
  * *Optimalisatie*: Gebruik de native HTML5-attribuut `loading="lazy"` voor de `<img>` elementen. Dit verlaagt JS-overhead aanzienlijk.


## 3. CSS Stylesheets (assets/main/gui/css/)

### [global.css](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/css/global.css)
* **Pixel-gebaseerde Containers (Responsiviteit & Richtlijnen)**: Verschillende containers (zoals `.error-content` en `.profiles-grid`) gebruiken absolute pixel-maxima (`width: min(680px, 94vw);`, `width: min(550px, 100%);`).
  * *Optimalisatie*: Vervang deze door percentage-gebaseerde breedtes (`%` van de viewport of parent-container) om beter aan te sluiten bij de "Pixel-Less Layout"-richtlijn.

### [global-mobile.css](file:///c:/Users/kenji/Documents/PROJECTS/IVIDS/IVIDS/app/src/main/assets/main/gui/css/global-mobile.css)
* **Eliminatie van `!important` Declaraties (Code-reductie & Specificiteit)**: Gebruikt nog enkele `!important`-regels (o.a. bij `.nav-item.active .nav-icon` en `display: none`).
  * *Optimalisatie*: Verhoog de selector-specificiteit in de CSS-hiërarchie in plaats van `!important` te gebruiken. Dit voorkomt cascading conflicten en houdt de CSS schoon en voorspelbaar.
