export const Screensaver = {
    timeout: 1 * 60 * 1000, // 1 minutes
    timer: null,
    overlay: null,
    isActive: false,

    init() {
        this.createOverlay();
        this.startTimer();
        this.addEventListeners();
    },

    createOverlay() {
        if (!document.getElementById('screensaver-overlay')) {
            this.overlay = document.createElement('div');
            this.overlay.id = 'screensaver-overlay';
            document.body.appendChild(this.overlay);
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

    addEventListeners() {
        const events = ['keydown', 'mousemove', 'mousedown', 'touchstart', 'click', 'wheel'];

        // Throttled reset to avoid performance hit on mousemove
        let lastReset = 0;
        const throttleDelay = 1000; // 1 second

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
    }
};
