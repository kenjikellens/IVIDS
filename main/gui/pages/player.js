<<<<<<< HEAD
import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';

export function init(params) {
    if (!params || !params.id) {
        Router.loadPage('home');
        return;
    }

    // Hide header if present
    const header = document.getElementById('header');
    if (header) header.style.display = 'none';

    const container = document.getElementById('video-container');
    // Ensure container fills viewport and is fixed
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100vw";
    container.style.height = "100vh";
    container.style.background = "#000";
    container.style.overflow = "hidden";

    const url = Api.getVideoUrl(params.id, params.type);

    // Remove any existing iframe
    const oldIframe = document.getElementById('player-iframe');
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.allow = "autoplay; fullscreen";
    iframe.allowFullscreen = true;
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.width = "100vw";
    iframe.style.height = "100vh";
    iframe.style.border = "none";
    iframe.style.background = "#000";
    iframe.id = "player-iframe";
    iframe.style.zIndex = "1";

    container.appendChild(iframe);

    // Handle Back Button
    document.getElementById('player-back').onclick = () => {
        // Restore header when leaving player
        if (header) header.style.display = '';
        Router.loadPage('details', { id: params.id, type: params.type });
    };
}

// Optionally, restore header if user navigates away from player by other means
window.addEventListener('popstate', () => {
    const header = document.getElementById('header');
    if (header) header.style.display = '';
});
=======
import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';

export function init(params) {
    if (!params || !params.id) {
        Router.loadPage('home');
        return;
    }

    // Hide header if present
    const header = document.getElementById('header');
    if (header) header.style.display = 'none';

    const container = document.getElementById('video-container');
    // Ensure container fills viewport and is fixed
    container.style.position = "fixed";
    container.style.top = "0";
    container.style.left = "0";
    container.style.width = "100vw";
    container.style.height = "100vh";
    container.style.background = "#000";
    container.style.overflow = "hidden";

    const url = Api.getVideoUrl(params.id, params.type);

    // Remove any existing iframe
    const oldIframe = document.getElementById('player-iframe');
    if (oldIframe) oldIframe.remove();

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.allow = "autoplay; fullscreen";
    iframe.allowFullscreen = true;
    iframe.style.position = "absolute";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.width = "100vw";
    iframe.style.height = "100vh";
    iframe.style.border = "none";
    iframe.style.background = "#000";
    iframe.id = "player-iframe";
    iframe.style.zIndex = "1";

    container.appendChild(iframe);

    // Handle Back Button
    document.getElementById('player-back').onclick = () => {
        // Restore header when leaving player
        if (header) header.style.display = '';
        Router.loadPage('details', { id: params.id, type: params.type });
    };
}

// Optionally, restore header if user navigates away from player by other means
window.addEventListener('popstate', () => {
    const header = document.getElementById('header');
    if (header) header.style.display = '';
});
>>>>>>> 9cb739138d9b59ab65cad410bc39d6c60fb358f3
