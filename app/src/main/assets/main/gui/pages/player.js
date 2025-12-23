import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { addToRecentlyWatched } from '../../logic/recentlyWatched.js';
import { createLoaderElement } from '../js/loader.js';
import { ErrorHandler } from '../js/error-handler.js';

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

        // Check for next episode if it's a TV show
        if (params.type === 'tv' && params.season && params.episode) {
            checkForNextEpisode(params.id, parseInt(params.season), parseInt(params.episode));
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
            ErrorHandler.show('Failed to load player. Video container missing.', () => Router.loadPage('home'));
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
            url = Api.getVideoUrl(params.id, params.type, params.season, params.episode);
        } catch (urlError) {
            console.error('Error generating video URL:', urlError);
            ErrorHandler.show('Failed to generate video URL.', () => init(params));
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
            iframe.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
            iframe.allowFullscreen = true;

            // Add sandbox attribute to block ads and popups
            // We allow:
            // - scripts: to run the player
            // - same-origin: to allow the player to access its own resources
            // - forms: for player controls
            // - pointer-lock: for video controls
            // - top-navigation: to allow some players to redirect back
            // We EXCLUDE 'allow-popups' and 'allow-modals' to block ads.
            // iframe.setAttribute('sandbox', 'allow-forms allow-pointer-lock allow-same-origin allow-scripts allow-top-navigation');

            iframe.style.position = "absolute";
            iframe.style.top = "0";
            iframe.style.left = "0";
            iframe.style.width = "100vw";
            iframe.style.height = "100vh";
            iframe.style.border = "none";
            iframe.style.background = "#000";
            iframe.id = "player-iframe";
            iframe.className = "focusable";
            iframe.tabIndex = 0;
            iframe.style.zIndex = "1";

            // Remove loader
            if (loader) loader.remove();

            container.appendChild(iframe);
        } catch (iframeError) {
            console.error('Error creating/appending iframe:', iframeError);
            ErrorHandler.show('Failed to initialize video player.', () => init(params));
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
                        Router.goBack();
                    } catch (backError) {
                        console.error('Error handling back button:', backError);
                    }
                };
            }
        } catch (btnError) {
            console.error('Error setting up back button:', btnError);
        }
    } catch (error) {
        console.error('Critical error in player.init:', error);
        ErrorHandler.show('An error occurred while loading the player.');
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

async function checkForNextEpisode(seriesId, currentSeason, currentEpisode) {
    try {
        const nextBtnContainer = document.getElementById('next-episode-container');
        const nextBtn = document.getElementById('player-next');

        if (!nextBtnContainer || !nextBtn) return;

        // 1. Try to find next episode in current season
        // We need season details to know how many episodes are in the season
        const seasonDetails = await Api.getSeasonDetails(seriesId, currentSeason);

        if (seasonDetails && seasonDetails.episodes) {
            const nextEpisode = seasonDetails.episodes.find(e => e.episode_number === currentEpisode + 1);

            if (nextEpisode) {
                // Next episode exists in this season
                showNextButton(seriesId, currentSeason, currentEpisode + 1);
                return;
            }
        }

        // 2. If not in current season, check if there is a next season
        // We need series details to know about seasons
        const seriesDetails = await Api.getDetails(seriesId, 'tv');
        if (seriesDetails && seriesDetails.seasons) {
            const nextSeason = seriesDetails.seasons.find(s => s.season_number === currentSeason + 1);
            if (nextSeason) {
                // Next season exists, assume episode 1 exists
                showNextButton(seriesId, currentSeason + 1, 1);
            }
        }

    } catch (error) {
        console.error('Error checking for next episode:', error);
    }
}

function showNextButton(seriesId, nextSeason, nextEpisode) {
    const container = document.getElementById('next-episode-container');
    const btn = document.getElementById('player-next');

    if (container && btn) {
        container.style.display = 'block';
        btn.onclick = () => {
            // Reload player with new episode
            Router.loadPage('player', {
                id: seriesId,
                type: 'tv',
                season: nextSeason,
                episode: nextEpisode
            });
        };
    }
}