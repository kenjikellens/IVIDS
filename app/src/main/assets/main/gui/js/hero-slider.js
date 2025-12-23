import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { Splash } from './splash.js';

export class HeroSlider {
    constructor(items, config) {
        this.items = items.filter(item => item.backdrop_path);
        this.config = config;
        // config = { containerId, titleId, descId, playBtnId, detailsBtnId }

        this.container = document.getElementById(config.containerId);
        this.titleEl = document.getElementById(config.titleId);
        this.descEl = document.getElementById(config.descId);
        this.playBtn = document.getElementById(config.playBtnId);
        this.detailsBtn = document.getElementById(config.detailsBtnId);

        this.currentIndex = 0;
        this.interval = null;
        this.duration = 8000; // 8 seconds
        this.isDestroyed = false;

        if (!this.container || this.items.length === 0) {
            console.warn('HeroSlider: Container not found or no items with backdrops.');
            return;
        }

        this.init();
    }

    init() {
        // Initial render
        this.render(this.currentIndex);

        // Start auto-play
        this.startAutoPlay();

        // Pause on hover
        if (this.container) {
            this.container.addEventListener('mouseenter', () => this.stopAutoPlay());
            this.container.addEventListener('mouseleave', () => this.startAutoPlay());
        }
    }

    render(index) {
        if (this.isDestroyed) return;

        const item = this.items[index];
        if (!item) return;

        // Preload image
        const imageUrl = Api.getImageUrl(item.backdrop_path);
        const img = new Image();
        img.src = imageUrl;

        img.onload = () => {
            if (this.isDestroyed) return;
            // Apply transition to background
            if (this.container) {
                this.container.style.transition = 'background-image 1s ease-in-out';
                this.container.style.backgroundImage = `linear-gradient(to right, rgba(0,0,0,0.9), rgba(0,0,0,0.3)), url(${imageUrl})`;
            }

            // Hide loader container on first load
            if (this.container) {
                const loader = this.container.querySelector('.loader-center-container');
                if (loader) {
                    loader.style.display = 'none';
                }
            }

            // Signal Splash that first hero is loaded
            Splash.signalContentLoaded();

            // Update Content with fade effect
            this.updateContent(item);
        };

        img.onerror = () => {
            console.warn(`HeroSlider: Failed to load image for ${item.title || item.name}`);

            // Still signal splash so it's not stuck forever
            Splash.signalContentLoaded();

            // Try next item immediately
            if (!this.isDestroyed) {
                this.next();
            }
        };
    }

    updateContent(item) {
        if (this.isDestroyed) return;

        const elements = [this.titleEl, this.descEl];

        // Fade out
        elements.forEach(el => {
            if (el) {
                el.style.transition = 'opacity 0.5s ease';
                el.style.opacity = 0;
            }
        });

        setTimeout(() => {
            if (this.isDestroyed) return;

            // Update text
            if (this.titleEl) this.titleEl.textContent = item.title || item.name;
            if (this.descEl) this.descEl.textContent = this.truncate(item.overview || 'No description available.', 150);

            // Update buttons
            if (this.playBtn) {
                this.playBtn.onclick = () => Router.loadPage('details', { id: item.id, type: item.media_type || (item.name ? 'tv' : 'movie') });
            }
            if (this.detailsBtn) {
                this.detailsBtn.onclick = () => Router.loadPage('details', { id: item.id, type: item.media_type || (item.name ? 'tv' : 'movie') });
            }

            // Fade in
            elements.forEach(el => {
                if (el) el.style.opacity = 1;
            });
        }, 500);
    }

    startAutoPlay() {
        this.stopAutoPlay();
        if (this.isDestroyed) return;

        this.interval = setInterval(() => {
            this.next();
        }, this.duration);
    }

    stopAutoPlay() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    next() {
        if (this.isDestroyed) return;
        this.currentIndex = (this.currentIndex + 1) % this.items.length;
        this.render(this.currentIndex);
    }

    truncate(str, n) {
        return (str && str.length > n) ? str.substr(0, n - 1) + '...' : str;
    }

    destroy() {
        this.isDestroyed = true;
        this.stopAutoPlay();
        // Remove event listeners if needed (though they are on container which might be removed anyway)
    }
}
