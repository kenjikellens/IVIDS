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
        const rect = current.getBoundingClientRect();
        const all = Array.from(document.querySelectorAll(this.focusableSelector));

        // Filter out the current element
        let candidates = all.filter(el => el !== current);

        // Navigation hierarchy: prevent direct jump from content to navbar
        // Content rows → Hero section → Navbar
        if (direction === 'up') {
            const currentInContent = current.closest('.row-posters') !== null;
            const currentInHero = current.closest('.hero') !== null;

            // If navigating UP from content sections, block navbar elements
            // This forces navigation to stop at hero section first
            if (currentInContent) {
                candidates = candidates.filter(el => !el.closest('.navbar'));
            }
            // If in hero or navbar, allow navigation anywhere (no filtering)
        }

        let bestCandidate = null;
        let minDistance = Infinity;

        candidates.forEach(el => {
            const elRect = el.getBoundingClientRect();

            // Check if the element is in the correct direction
            let isValid = false;
            let dist = Infinity;

            switch (direction) {
                case 'left':
                    if (elRect.right <= rect.left) {
                        isValid = true;
                        // Weight vertical distance more to prefer items in same row
                        dist = Math.abs(elRect.right - rect.left) + Math.abs(elRect.top - rect.top) * 2;
                    }
                    break;
                case 'right':
                    if (elRect.left >= rect.right) {
                        isValid = true;
                        dist = Math.abs(elRect.left - rect.right) + Math.abs(elRect.top - rect.top) * 2;
                    }
                    break;
                case 'up':
                    if (elRect.bottom <= rect.top) {
                        isValid = true;
                        dist = Math.abs(elRect.bottom - rect.top) + Math.abs(elRect.left - rect.left) * 0.5;
                    }
                    break;
                case 'down':
                    if (elRect.top >= rect.bottom) {
                        isValid = true;
                        dist = Math.abs(elRect.top - rect.bottom) + Math.abs(elRect.left - rect.left) * 0.5;
                    }
                    break;
            }

            if (isValid) {
                // Prioritize content over navbar when navigating from content
                if (el.closest('.navbar') && !current.closest('.navbar')) {
                    dist += 10000;
                }

                if (dist < minDistance) {
                    minDistance = dist;
                    bestCandidate = el;
                }
            }
        });

        return bestCandidate;
    }
};
