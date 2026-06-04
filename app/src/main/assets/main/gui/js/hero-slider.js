import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { Splash } from './splash.js';

/**
 * Helper class that sets up and manages the home/movies/series hero slider.
 * Handles background sliding transition tracks, indicator dots, auto-play, and content fades.
 */
export class HeroSlider {
    /**
     * Constructs a HeroSlider instance.
     * @param {Array<Object>} items - Array of movie/series items to populate.
     * @param {Object} config - Configuration mapping container, title, description, and button IDs.
     */
    constructor(items, config) {
        // Filter out items without backdrop_path
        this.items = items.filter(item => item.backdrop_path);
        this.config = config;

        this.container = document.getElementById(config.containerId);
        this.titleEl = document.getElementById(config.titleId);
        this.descEl = document.getElementById(config.descId);
        this.playBtn = document.getElementById(config.playBtnId);
        this.detailsBtn = document.getElementById(config.detailsBtnId);

        this.currentIndex = 0;
        this.interval = null;
        this.duration = 12000; // 12 seconds
        this.isDestroyed = false;

        if (!this.container || this.items.length === 0) {
            console.warn('HeroSlider: Container not found or no items with backdrops.');
            return;
        }

        this.init();
    }

    /**
     * Initializes the slider layout, constructs the background track/slide elements,
     * builds indicator dots, sets up event listeners, and starts auto-play.
     */
    init() {
        // 1. Create slides track
        this.track = document.createElement('div');
        this.track.className = 'hero-slides-track';
        this.track.style.width = `${this.items.length * 100}%`;

        // 2. Add slide backdrop images
        this.items.forEach(item => {
            const slide = document.createElement('div');
            slide.className = 'hero-slide';
            slide.style.width = `${100 / this.items.length}%`;
            const imageUrl = Api.getImageUrl(item.backdrop_path, Api.getRecommendedBackdropSize());
            slide.style.backgroundImage = `linear-gradient(to right, rgba(5,5,5,0.7), rgba(5,5,5,0)), url(${imageUrl})`;
            this.track.appendChild(slide);
        });

        // Prepend track behind overlay and content
        this.container.insertBefore(this.track, this.container.firstChild);

        // Hide initial loader if present
        const loader = this.container.querySelector('.loader-center-container');
        if (loader) loader.style.display = 'none';

        // 3. Create indicators container and circular dots
        this.indicatorsContainer = document.createElement('div');
        this.indicatorsContainer.className = 'hero-indicators';

        this.items.forEach((_, idx) => {
            const dot = document.createElement('div');
            dot.className = 'hero-indicator-dot';
            if (idx === this.currentIndex) dot.classList.add('active');
            
            // Allow manual dot clicks to change slide
            dot.onclick = () => {
                this.goTo(idx);
                this.startAutoPlay(); // Restart timer on manual interaction
            };
            this.indicatorsContainer.appendChild(dot);
        });

        this.container.appendChild(this.indicatorsContainer);

        // 4. Initial render to set text content
        this.render(this.currentIndex, true);

        // 5. Start auto-play
        this.startAutoPlay();

        // 6. Pause auto-play on hover
        this.onMouseEnter = () => this.stopAutoPlay();
        this.onMouseLeave = () => this.startAutoPlay();
        this.container.addEventListener('mouseenter', this.onMouseEnter);
        this.container.addEventListener('mouseleave', this.onMouseLeave);
    }

    /**
     * Renders the hero slide at the specified index, shifting the background and updating title/description elements.
     * This method directly modifies the DOM content of the hero section and manages the fade transition state.
     * @param {number} index - Index of slide to render.
     * @param {boolean} [isInitial=false] - True if this is the first render, skipping animation.
     */
    render(index, isInitial = false) {
        if (this.isDestroyed) return;

        const item = this.items[index];
        if (!item) return;

        // Shift background track horizontally
        if (this.track) {
            this.track.style.left = `-${index * 100}%`;
        }

        // Highlight matching circular dot indicator
        if (this.indicatorsContainer) {
            const dots = this.indicatorsContainer.querySelectorAll('.hero-indicator-dot');
            dots.forEach((dot, idx) => {
                if (idx === index) {
                    dot.classList.add('active');
                } else {
                    dot.classList.remove('active');
                }
            });
        }

        // Get content box text parent
        const content = this.container ? this.container.querySelector('.hero-content') : null;

        if (isInitial) {
            // Initial render - set text content instantly without fade out
            if (this.titleEl) this.titleEl.textContent = item.title || item.name;
            if (this.descEl) this.descEl.textContent = this.truncate(item.overview || 'No description available.', 450);
            this.updateButtonHandlers(item);
            Splash.signalContentLoaded();
        } else {
            // Subsequent transitions - fade out content, change text, fade in
            if (content) content.classList.add('transitioning');

            setTimeout(() => {
                if (this.isDestroyed) return;

                if (this.titleEl) this.titleEl.textContent = item.title || item.name;
                if (this.descEl) this.descEl.textContent = this.truncate(item.overview || 'No description available.', 450);
                this.updateButtonHandlers(item);

                if (content) content.classList.remove('transitioning');
            }, 300);
        }
    }

    /**
     * Updates click event handlers for play and details buttons for the current item.
     * @param {Object} item - Current slide movie or series details object.
     */
    updateButtonHandlers(item) {
        const type = item.media_type || (item.name ? 'tv' : 'movie');
        if (this.playBtn) {
            this.playBtn.onclick = () => Router.loadPage('details', { id: item.id, type });
        }
        if (this.detailsBtn) {
            this.detailsBtn.onclick = () => Router.loadPage('details', { id: item.id, type });
        }
    }

    /**
     * Triggers auto-play interval to cycle through slides automatically.
     */
    startAutoPlay() {
        this.stopAutoPlay();
        if (this.isDestroyed) return;

        this.interval = setInterval(() => {
            this.next();
        }, this.duration);
    }

    /**
     * Stops the auto-play timer.
     */
    stopAutoPlay() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    /**
     * Cycles to the next slide in sequence.
     */
    next() {
        if (this.isDestroyed) return;
        this.currentIndex = (this.currentIndex + 1) % this.items.length;
        this.render(this.currentIndex);
    }

    /**
     * Manually navigates to a specific slide index.
     * @param {number} index - Target slide index.
     */
    goTo(index) {
        if (this.isDestroyed) return;
        this.currentIndex = index;
        this.render(this.currentIndex);
    }

    /**
     * Truncates long overview descriptions with trailing ellipsis.
     * @param {string} str - Target string to truncate.
     * @param {number} n - Character limit.
     */
    truncate(str, n) {
        return (str && str.length > n) ? str.substr(0, n - 1) + '...' : str;
    }

    /**
     * Releases timers, cleans up event listeners, and marks slider as destroyed.
     */
    destroy() {
        this.isDestroyed = true;
        this.stopAutoPlay();
        
        if (this.container && this.onMouseEnter && this.onMouseLeave) {
            this.container.removeEventListener('mouseenter', this.onMouseEnter);
            this.container.removeEventListener('mouseleave', this.onMouseLeave);
        }
        if (this.track && this.track.parentNode) {
            this.track.parentNode.removeChild(this.track);
        }
        if (this.indicatorsContainer && this.indicatorsContainer.parentNode) {
            this.indicatorsContainer.parentNode.removeChild(this.indicatorsContainer);
        }
    }
}
