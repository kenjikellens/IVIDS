# SPA Router & Page Lifecycle

The Router (`router.js`) manages a complete lifecycle for every page transition in the IVIDS Single Page Application.

## Router Architecture
```javascript
export const Router = {
    currentPage: null,     // Current page name (e.g., 'home', 'search')
    params: {},            // Parameters passed to the page (e.g., { id: 123 })
    history: [],           // Stack of previous pages for back navigation
    isLoading: false       // Prevents double-loading during transitions
};
```

## Page Loading Sequence (7 Steps)
1. **History Management**: Push current page to history stack.
2. **CSS Injection**: Update `<link id="page-css">` with cache-busting.
3. **HTML Fetch**: Fetch template using XHR polyfill (for `file://` support).
4. **Module Import**: Dynamically import the page logic (`pages/[name].js`).
5. **Spatial Nav Logic**: Load page-specific focus overrides.
6. **i18n Application**: Apply translations to the new DOM.
7. **Focus Reset**: Focus the first element and save the route.

## XHR Polyfill (Fetch Override)
Critical for Smart TVs loading via the `file://` protocol where standard `fetch()` is restricted for local files.
```javascript
window.fetch = function(url, options) {
    if (url.startsWith('lang/') || url.startsWith('pages/') || url.startsWith('components/')) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.onload = () => resolve({
                ok: true,
                json: () => Promise.resolve(JSON.parse(xhr.responseText)),
                text: () => Promise.resolve(xhr.responseText)
            });
            xhr.onerror = () => reject(new Error('Local fetch failed'));
            xhr.open('GET', url);
            xhr.send();
        });
    }
    return originalFetch(url, options);
};
```
