export const SpatialNav = {
    focusableSelector: '.focusable',

    init(onBack) {
        this.onBack = onBack;
        window.addEventListener('keydown', (e) => this.handleKey(e));
        // Initial focus
        this.focusFirst();
    },

    focusFirst() {
        const elements = document.querySelectorAll(this.focusableSelector);

        // Priority 1: Hero play buttons (home, movies, series, details)
        const heroButtons = ['hero-play', 'hero-play-movies', 'hero-play-series', 'details-play'];
        for (const id of heroButtons) {
            const heroBtn = document.getElementById(id);
            if (heroBtn) {
                this.setFocus(heroBtn);
                return;
            }
        }

        // Priority 2: Search button (search page)
        const searchBtn = document.getElementById('search-btn');
        if (searchBtn) {
            this.setFocus(searchBtn);
            return;
        }

        // Priority 3: Playlists button in header (playlists page)
        const playlistNavBtn = document.querySelector('[data-route="playlists"]');
        if (playlistNavBtn && document.getElementById('playlists-grid')) {
            this.setFocus(playlistNavBtn);
            return;
        }

        // Priority 4: First setting on settings page
        const languageSelect = document.getElementById('language-select');
        if (languageSelect) {
            this.setFocus(languageSelect);
            return;
        }

        // Priority 5: Other content elements (skip nav-items)
        const contentElements = Array.from(elements).filter(el => !el.classList.contains('nav-item'));
        if (contentElements.length > 0) {
            this.setFocus(contentElements[0]);
        }
    },

    setFocus(element) {
        const current = document.querySelector('.focused');
        if (current) {
            current.classList.remove('focused');
        }
        if (element) {
            element.classList.add('focused');

            // If focusing a hero element, scroll the main view to the top
            // to ensure the full hero section and header are visible
            if (element.closest('.hero')) {
                const mainView = document.getElementById('main-view');
                if (mainView) {
                    mainView.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } else {
                element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }

            element.focus();
        }
    },

    refocus() {
        const current = document.querySelector('.focused');
        if (!current || !document.body.contains(current)) {
            this.focusFirst();
        } else {
            current.focus();

            // If refocusing a hero element, scroll the main view to the top
            if (current.closest('.hero')) {
                const mainView = document.getElementById('main-view');
                if (mainView) {
                    mainView.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } else {
                current.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        }
    },

    handleKey(e) {
        const current = document.querySelector('.focused');

        // Map modern key names to legacy keyCode values for older TV remotes
        const KEY_MAP = {
            ArrowLeft: 37,
            ArrowUp: 38,
            ArrowRight: 39,
            ArrowDown: 40,
            Enter: 13,
            Escape: 8,
            Back: 10009 // some TVs send "Back" as a string
        };
        const keyCode = e.keyCode || KEY_MAP[e.key];

        // Always prevent default scrolling for arrow keys
        if (keyCode >= 37 && keyCode <= 40) {
            e.preventDefault();
        }

        if (!current) {
            this.focusFirst();
            return;
        }

        let nextElement = null;

        switch (keyCode) {
            case 37: // LEFT
                nextElement = this.findNext(current, 'left');
                break;
            case 38: // UP
                // Special handling for Hero buttons:
                // If we are in the hero section and the page is scrolled down,
                // scroll to top FIRST, and do not move focus.
                if (current.closest('.hero')) {
                    const mainView = document.getElementById('main-view');
                    if (mainView && mainView.scrollTop > 0) {
                        mainView.scrollTo({ top: 0, behavior: 'smooth' });
                        return; // Stop here, don't move focus yet
                    }
                }
                nextElement = this.findNext(current, 'up');
                break;
            case 39: // RIGHT
                nextElement = this.findNext(current, 'right');
                break;
            case 40: // DOWN
                nextElement = this.findNext(current, 'down');
                break;
            case 13: // ENTER
                // Don't trigger click if we're in an input or textarea
                if (current.tagName !== 'INPUT' && current.tagName !== 'TEXTAREA') {
                    current.click();
                }
                break;
            case 10009: // RETURN / BACK (Tizen)
            case 8: // Backspace (PC) / Escape
                if (this.onBack) {
                    this.onBack();
                }
                break;
        }

        if (nextElement) {
            this.setFocus(nextElement);
        }
    },

    findNext(current, direction) {
        // --- Search Page Overrides ---
        if (current.id === 'search-input') {
            if (direction === 'right') return document.getElementById('search-btn');
            if (direction === 'left') return document.querySelector('.nav-item[data-route="search"]');
            if (direction === 'down') return document.getElementById('year-filter');
        }
        if (current.id === 'search-btn') {
            if (direction === 'left') return document.getElementById('search-input');
            if (direction === 'right') return document.getElementById('view-toggle-btn');
        }
        if (current.id === 'view-toggle-btn') {
            if (direction === 'left') return document.getElementById('search-btn');
        }

        // Filter Row Horizontal Chain: Sort By <-> Year <-> Type <-> Genres <-> Age Rating

        if (current.id === 'sort-by') {
            if (direction === 'right') return document.getElementById('year-filter');
            if (direction === 'up') return document.getElementById('search-input');
        }

        if (current.id === 'year-filter') {
            if (direction === 'up') return document.getElementById('search-input');
            if (direction === 'left') return document.getElementById('sort-by');
            if (direction === 'right') return document.querySelector('input[value="movie"]').parentElement;
        }

        // Type Filter (Movie)
        const movieLabel = document.querySelector('input[value="movie"]')?.parentElement;
        if (movieLabel && current === movieLabel) {
            if (direction === 'left') return document.getElementById('year-filter');
            if (direction === 'up') return document.getElementById('search-input');
        }

        // Type Filter (Series)
        const seriesLabel = document.querySelector('input[value="tv"]')?.parentElement;
        if (seriesLabel && current === seriesLabel) {
            if (direction === 'right') return document.getElementById('genre-select-btn');
            if (direction === 'up') return document.getElementById('search-input');
        }

        // Genre Button
        if (current.id === 'genre-select-btn') {
            if (direction === 'left') return seriesLabel;
            if (direction === 'right') return document.querySelector('#cert-filters .filter-checkbox');
            if (direction === 'up') return document.getElementById('search-input');
        }

        // Age Rating (First item)
        const firstCert = document.querySelector('#cert-filters .filter-checkbox');
        if (firstCert && current === firstCert) {
            if (direction === 'left') return document.getElementById('genre-select-btn');
            if (direction === 'up') return document.getElementById('search-input');
        }
        // -----------------------------


        const rect = current.getBoundingClientRect();
        const center = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
        const all = Array.from(document.querySelectorAll(this.focusableSelector));

        // Filter out the current element
        let candidates = all.filter(el => el !== current);

        // Navigation hierarchy: prevent direct jump from content to navbar
        // Content rows → Hero section → Navbar
        if (direction === 'up') {
            const currentInContent = current.closest('.row-posters') !== null;

            // If navigating UP from content sections, block navbar elements
            // This forces navigation to stop at hero section first
            if (currentInContent) {
                candidates = candidates.filter(el => !el.closest('.navbar'));
            }
            // If in hero or navbar, allow navigation anywhere (no filtering)
        } else if (direction === 'right') {
            // Prevent jumping from content back to sidebar (which is on the left)
            const currentInNavbar = current.closest('.navbar') !== null;
            if (!currentInNavbar) {
                candidates = candidates.filter(el => !el.closest('.navbar'));
            }
        }

        let bestCandidate = null;
        let minDistance = Infinity;

        // Container prioritization
        const currentNavbar = current.closest('.navbar');
        const currentList = current.closest('.playlists-grid, .row-posters, .playlist-items-container, .search-box');

        candidates.forEach(el => {
            const elRect = el.getBoundingClientRect();
            const elCenter = {
                x: elRect.left + elRect.width / 2,
                y: elRect.top + elRect.height / 2
            };

            const dx = elCenter.x - center.x;
            const dy = elCenter.y - center.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            let isValid = false;

            // Relaxed Cone Check
            // Vertical: Allow wider angle (1.5x width) to handle gaps/misalignments
            // Horizontal: Keep stricter (2x height) to stay in rows
            switch (direction) {
                case 'left':
                    if (dx < 0 && Math.abs(dy) < Math.abs(dx) * 2) isValid = true;
                    break;
                case 'right':
                    if (dx > 0 && Math.abs(dy) < Math.abs(dx) * 2) isValid = true;
                    break;
                case 'up':
                    if (dy < 0 && Math.abs(dx) < Math.abs(dy) * 1.5) isValid = true;
                    break;
                case 'down':
                    if (dy > 0 && Math.abs(dx) < Math.abs(dy) * 1.5) isValid = true;
                    break;
            }

            if (isValid) {
                let weightedDist = dist;

                // Priority 1: Stay in same navbar
                if (currentNavbar && el.closest('.navbar') === currentNavbar) {
                    weightedDist *= 0.5; // Strongly prefer staying in navbar
                }
                // Priority 2: Stay in same list/grid or search box
                else if (currentList && el.closest('.playlists-grid, .row-posters, .playlist-items-container, .search-box') === currentList) {
                    weightedDist *= 0.5; // Increased priority (was 0.8) to keep focus in containers
                }
                // Penalty: Crossing from content to navbar (handled by filter above for Right, but good for general)
                else if (el.closest('.navbar') && !currentNavbar) {
                    weightedDist += 1000;
                }

                if (weightedDist < minDistance) {
                    minDistance = weightedDist;
                    bestCandidate = el;
                }
            }
        });

        return bestCandidate;
    }
};
