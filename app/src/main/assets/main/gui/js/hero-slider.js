import { Api } from '../../logic/api.js';
import { Router } from '../js/router.js';
import { Splash } from './splash.js';

/**
 * Default configuration parameters for Hero Slider rendering, transitions, and truncation.
 */
const CONFIG = {
    DEFAULT_DURATION: 10000,      // Slide transition cycle time when auto-play is enabled (ms)
    FADE_TRANSITION_TIMEOUT: 500, // Duration of slide text content fade transition (ms)
    TRUNCATE_LIMIT: 250           // Maximum character limit for overview descriptions
};

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
        // Destroy existing global slider if any to prevent memory leaks and interval conflicts
        if (window.activeHeroSlider && typeof window.activeHeroSlider.destroy === 'function') {
            try {
                window.activeHeroSlider.destroy();
            } catch (e) {
                console.error('Error destroying previous hero slider:', e);
            }
        }
        window.activeHeroSlider = this;

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
        this.duration = CONFIG.DEFAULT_DURATION;
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
        this.items.forEach((item, idx) => {
            const slide = document.createElement('div');
            slide.className = 'hero-slide';
            slide.style.width = `${100 / this.items.length}%`;
            const imageUrl = Api.getImageUrl(item.backdrop_path, Api.getRecommendedBackdropSize());
            if (idx === 0) {
                slide.style.backgroundImage = `linear-gradient(to right, rgba(5,5,5,0.7), rgba(5,5,5,0)), url(${imageUrl})`;
                slide.dataset.loaded = 'true';
            } else {
                slide.dataset.src = imageUrl;
            }
            this.track.appendChild(slide);
        });

        // Prepend track behind overlay and content
        this.container.insertBefore(this.track, this.container.firstChild);

        // Hide initial loader if present
        const loader = this.container.querySelector('.loader-center-container');
        if (loader) loader.style.display = 'none';



        // 4. Initial render to set text content
        this.render(this.currentIndex, true);

        // 5. Start auto-play
        this.startAutoPlay();

        // 6. Pause auto-play on hover
        this.onMouseEnter = () => this.stopAutoPlay();
        this.onMouseLeave = () => this.startAutoPlay();
        this.container.addEventListener('mouseenter', this.onMouseEnter);
        this.container.addEventListener('mouseleave', this.onMouseLeave);

        // 7. Add swipe handlers for mobile devices
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;

        /**
         * Event handler for the start of a touch interaction.
         * Saves the initial horizontal and vertical touch points.
         * @param {TouchEvent} e - The touch event object.
         */
        this.onTouchStart = (e) => {
            if (e.touches && e.touches.length > 0) {
                this.touchStartX = e.touches[0].clientX;
                this.touchStartY = e.touches[0].clientY;
                // Initialize touchEndX/Y with starting coordinates in case move doesn't fire
                this.touchEndX = e.touches[0].clientX;
                this.touchEndY = e.touches[0].clientY;
            }
        };

        /**
         * Event handler for touch movement.
         * Updates the current touch coordinates during dragging.
         * @param {TouchEvent} e - The touch event object.
         */
        this.onTouchMove = (e) => {
            if (e.touches && e.touches.length > 0) {
                this.touchEndX = e.touches[0].clientX;
                this.touchEndY = e.touches[0].clientY;
            }
        };

        /**
         * Event handler for the completion of a touch interaction.
         * Calculates swipe gesture direction and triggers page transitions.
         */
        this.onTouchEnd = () => {
            const diffX = this.touchEndX - this.touchStartX;
            const diffY = this.touchEndY - this.touchStartY;
            const minSwipeDistance = 50; // Minimum distance in pixels to register a swipe

            // Check if the horizontal swipe is dominant and exceeds threshold
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minSwipeDistance) {
                if (diffX > 0) {
                    this.prev();
                } else {
                    this.next();
                }
                // Restart auto-play timer after manual navigation
                this.startAutoPlay();
            }
            // Reset gesture coordinates
            this.touchStartX = 0;
            this.touchStartY = 0;
            this.touchEndX = 0;
            this.touchEndY = 0;
        };

        this.container.addEventListener('touchstart', this.onTouchStart, { passive: true });
        this.container.addEventListener('touchmove', this.onTouchMove, { passive: true });
        this.container.addEventListener('touchend', this.onTouchEnd);
    }

    /**
     * Renders the hero slide at the specified index, shifting the background and updating title/description elements.
     * This method directly modifies the DOM content of the hero section and manages the fade transition state.
     * Also lazy loads the current slide's backdrop and pre-fetches the next slide's backdrop.
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

        // Lazy load slide backdrop image if not loaded
        const slides = this.track ? this.track.querySelectorAll('.hero-slide') : [];
        const currentSlide = slides[index];
        if (currentSlide && currentSlide.dataset.loaded !== 'true' && currentSlide.dataset.src) {
            currentSlide.style.backgroundImage = `linear-gradient(to right, rgba(5,5,5,0.7), rgba(5,5,5,0)), url(${currentSlide.dataset.src})`;
            currentSlide.dataset.loaded = 'true';
        }

        // Pre-fetch the next slide to keep transitions smooth
        const nextIndex = (index + 1) % this.items.length;
        const nextSlide = slides[nextIndex];
        if (nextSlide && nextSlide.dataset.loaded !== 'true' && nextSlide.dataset.src) {
            const img = new Image();
            img.src = nextSlide.dataset.src;
            img.onload = () => {
                nextSlide.style.backgroundImage = `linear-gradient(to right, rgba(5,5,5,0.7), rgba(5,5,5,0)), url(${nextSlide.dataset.src})`;
                nextSlide.dataset.loaded = 'true';
            };
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
            if (this.descEl) this.descEl.textContent = this.truncate(item.overview || 'No description available.', CONFIG.TRUNCATE_LIMIT);
            this.updateButtonHandlers(item);
        } else {
            // Subsequent transitions - fade out content, change text, fade in
            if (content) content.classList.add('transitioning');

            setTimeout(() => {
                if (this.isDestroyed) return;

                if (this.titleEl) this.titleEl.textContent = item.title || item.name;
                if (this.descEl) this.descEl.textContent = this.truncate(item.overview || 'No description available.', CONFIG.TRUNCATE_LIMIT);
                this.updateButtonHandlers(item);

                if (content) content.classList.remove('transitioning');
            }, CONFIG.FADE_TRANSITION_TIMEOUT);
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
     * Cycles to the previous slide in sequence and updates the DOM elements.
     */
    prev() {
        if (this.isDestroyed) return;
        this.currentIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
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
        
        if (this.container) {
            if (this.onMouseEnter) this.container.removeEventListener('mouseenter', this.onMouseEnter);
            if (this.onMouseLeave) this.container.removeEventListener('mouseleave', this.onMouseLeave);
            if (this.onTouchStart) this.container.removeEventListener('touchstart', this.onTouchStart);
            if (this.onTouchMove) this.container.removeEventListener('touchmove', this.onTouchMove);
            if (this.onTouchEnd) this.container.removeEventListener('touchend', this.onTouchEnd);
        }
        if (this.track && this.track.parentNode) {
            this.track.parentNode.removeChild(this.track);
        }
        if (this.indicatorsContainer && this.indicatorsContainer.parentNode) {
            this.indicatorsContainer.parentNode.removeChild(this.indicatorsContainer);
        }
    }
}
