import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { addToRecentlyWatched } from '../../logic/recentlyWatched.js';
import { createLoaderElement } from '../js/loader.js';

export async function init(params) {
    try {
        if (!params || !params.id) {
            console.error('No parameters provided for player');
            Router.loadPage('home');
            return;
        }

        // Fetch details to add to recently watched
        try {
            const details = await Api.getDetails(params.id, params.type);
            if (details) {
                try {
                    addToRecentlyWatched({
                        ...details,
                        media_type: params.type,
                        season: params.season,
                        episode: params.episode
                    });
                } catch (watchedError) {
                    console.error('Error adding to recently watched:', watchedError);
                }
            }
        } catch (detailsError) {
            console.error('Error fetching details:', detailsError);
        }

        // Hide header if present
        try {
            const header = document.getElementById('header');
            if (header) header.style.display = 'none';
        } catch (headerError) {
            console.error('Error hiding header:', headerError);
        }

        const container = document.getElementById('video-container');
        if (!container) {
            console.error('Video container not found');
            alert('Failed to load player. Video container missing.');
            Router.loadPage('home');
            return;
        }

        // Ensure container fills viewport and is fixed
        try {
            container.style.position = "fixed";
            container.style.top = "0";
            container.style.left = "0";
            container.style.width = "100vw";
            container.style.height = "100vh";
            container.style.background = "#000";
            container.style.overflow = "hidden";
        } catch (styleError) {
            console.error('Error styling container:', styleError);
        }

        // Show loader
        const loader = createLoaderElement();
        container.appendChild(loader);

        let url = '';
        try {
            url = Api.getVideoUrl(params.id, params.type);
        } catch (urlError) {
            console.error('Error generating video URL:', urlError);
            alert('Failed to generate video URL.');
            if (loader) loader.remove();
            Router.loadPage('details', { id: params.id, type: params.type });
            return;
        }

        // Remove any existing iframe
        try {
            const oldIframe = document.getElementById('player-iframe');
            if (oldIframe) oldIframe.remove();
        } catch (cleanupError) {
            console.error('Error removing old iframe:', cleanupError);
        }

        try {
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

            // Remove loader
            if (loader) loader.remove();

            container.appendChild(iframe);
        } catch (iframeError) {
            console.error('Error creating/appending iframe:', iframeError);
            alert('Failed to initialize video player.');
            if (loader) loader.remove();
            Router.loadPage('details', { id: params.id, type: params.type });
            return;
        }

        // Handle Back Button
        try {
            const backBtn = document.getElementById('player-back');
            if (backBtn) {
                backBtn.onclick = () => {
                    try {
                        // Restore header when leaving player
                        const header = document.getElementById('header');
                        if (header) header.style.display = '';
                        Router.loadPage('details', { id: params.id, type: params.type });
                    } catch (backError) {
                        console.error('Error handling back button:', backError);
                        Router.loadPage('home');
                    }
                };
            }
        } catch (btnError) {
            console.error('Error setting up back button:', btnError);
        }
    } catch (error) {
        console.error('Critical error in player.init:', error);
        alert('An error occurred while loading the player.');
        Router.loadPage('home');
    }
}

// Optionally, restore header if user navigates away from player by other means
try {
    window.addEventListener('popstate', () => {
        try {
            const header = document.getElementById('header');
            if (header) header.style.display = '';
        } catch (headerError) {
            console.error('Error restoring header on popstate:', headerError);
        }
    });
} catch (eventError) {
    console.error('Error setting up popstate listener:', eventError);
}