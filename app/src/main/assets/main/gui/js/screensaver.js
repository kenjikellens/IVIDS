/**
 * Configuration options for the screensaver behavior.
 */
const CONFIG = {
    INACTIVITY_TIMEOUT: 10 * 60 * 1000, // Inactivity timeout duration (ms)
    THROTTLE_DELAY: 2000                // Throttle delay for checking activity (ms)
};

export const Screensaver = {
    timeout: CONFIG.INACTIVITY_TIMEOUT,
    timer: null,
    overlay: null,
    _listenersAttached: false,

    /**
     * Initializes the screensaver overlay, starts the inactivity timer, and sets up event listeners.
     */
    init() {
        try {
            this.createOverlay();
            this.startTimer();
            this.addEventListeners();
        } catch (e) {
            console.error('Error initializing screensaver:', e);
        }
    },

    createOverlay() {
        if (!document.getElementById('screensaver-overlay')) {
            this.overlay = document.createElement('div');
            this.overlay.id = 'screensaver-overlay';
            if (document.body) {
                document.body.appendChild(this.overlay);
            }
        } else {
            this.overlay = document.getElementById('screensaver-overlay');
        }
    },

    startTimer() {
        this.clearTimer();
        this.timer = setTimeout(() => {
            this.show();
        }, this.timeout);
    },

    clearTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    },

    resetTimer() {
        if (this.isActive) {
            this.hide();
        }
        this.startTimer();
    },

    show() {
        if (this.overlay) {
            this.overlay.classList.add('active');
            this.isActive = true;
        }
    },

    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
            this.isActive = false;
        }
    },

    /**
     * Registers global input event listeners to reset the screensaver timer, ensuring they are only added once.
     */
    addEventListeners() {
        if (this._listenersAttached) return;

        const events = ['keydown', 'mousemove', 'mousedown', 'touchstart', 'click', 'wheel'];

        // Throttled reset to avoid performance hit on mousemove
        let lastReset = 0;
        const throttleDelay = CONFIG.THROTTLE_DELAY;

        const handleActivity = () => {
            const now = Date.now();
            if (now - lastReset > throttleDelay || this.isActive) {
                this.resetTimer();
                lastReset = now;
            }
        };

        events.forEach(event => {
            window.addEventListener(event, handleActivity, { passive: true });
        });

        this._listenersAttached = true;
    }
};
