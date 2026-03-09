import { Router } from '../js/router.js';
import { SpatialNav } from '../js/spatial-nav.js';

export async function init(params) {
    const video = document.getElementById('tv-video');
    const title = document.getElementById('tv-title');
    const group = document.getElementById('tv-group');
    const overlay = document.getElementById('tv-overlay');
    const loader = document.getElementById('tv-loading');

    const app = document.getElementById('app');
    if (app) app.classList.add('fullscreen-layout');

    if (params.title) title.textContent = params.title;
    if (params.group) group.textContent = params.group;

    if (params.url) {
        video.src = params.url;
        video.play().catch(e => console.error('Error playing TV:', e));
    }

    video.onloadstart = () => loader.style.display = 'flex';
    video.onplaying = () => loader.style.display = 'none';
    video.onerror = () => {
        console.error('Video error:', video.error);
        loader.style.display = 'none';
        alert('Error playing stream');
    };

    // Auto-hide overlay
    let overlayTimeout;
    const showOverlay = () => {
        overlay.classList.add('show');
        clearTimeout(overlayTimeout);
        overlayTimeout = setTimeout(() => overlay.classList.remove('show'), 4000);
    };

    window.addEventListener('keydown', showOverlay);
    showOverlay();

    document.getElementById('tv-back').onclick = () => {
        video.pause();
        video.src = '';

        Router.goBack();
    };

    SpatialNav.focusFirst();
}
