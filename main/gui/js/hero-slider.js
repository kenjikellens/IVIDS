import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';

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
        this.container.addEventListener('mouseenter', () => this.stopAutoPlay());
        this.container.addEventListener('mouseleave', () => this.startAutoPlay());
    }

    render(index) {
        const item = this.items[index];
        if (!item) return;

        // Preload image
        const imageUrl = Api.getImageUrl(item.backdrop_path);
        const img = new Image();
        img.src = imageUrl;

        img.onload = () => {
            // Apply transition to background
            this.container.style.transition = 'background-image 1s ease-in-out';
            this.container.style.backgroundImage = `linear-gradient(to right, rgba(0,0,0,0.9), rgba(0,0,0,0.3)), url(${imageUrl})`;

            // Update Content with fade effect
            this.updateContent(item);
        };
    }

    updateContent(item) {
        const elements = [this.titleEl, this.descEl];

        // Fade out
        elements.forEach(el => {
            if (el) {
                el.style.transition = 'opacity 0.5s ease';
                el.style.opacity = 0;
            }
        });

        setTimeout(() => {
            // Update text
            if (this.titleEl) this.titleEl.textContent = item.title || item.name;
            if (this.descEl) this.descEl.textContent = this.truncate(item.overview || 'No description available.', 150);

            // Update buttons
            if (this.playBtn) {
                this.playBtn.onclick = () => Router.loadPage('player', { id: item.id, type: item.media_type || (item.name ? 'tv' : 'movie') });
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
        this.interval = setInterval(() => {
            this.next();
        }, this.duration);
    }

    stopAutoPlay() {
        if (this.interval) clearInterval(this.interval);
    }

    next() {
        this.currentIndex = (this.currentIndex + 1) % this.items.length;
        this.render(this.currentIndex);
    }

    truncate(str, n) {
        return (str && str.length > n) ? str.substr(0, n - 1) + '...' : str;
    }
}
