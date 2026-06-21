/**
 * Configuration options for the splash screen timings and durations.
 */
const CONFIG = {
    MIN_DURATION: 250,         // Minimum duration splash screen is shown (ms)
    SLOW_LOAD_TIMEOUT: 10000,   // Time before showing warning feedback for slow loading (ms)
    MAX_DURATION: 60000,       // Max duration before forcing dismissal of the splash (ms)
    TRANSITION_FALLBACK: 400   // Fallback timeout in case CSS transitionend event fails to fire (ms)
};

export class Splash {
    /**
     * Initializes the splash screen timers and loading state tracking.
     * Sets up minimum display duration, warning notifications, and fallback limits.
     */
    static init() {
        // Prevent double initialization
        if (this.isInitialized) return;
        this.isInitialized = true;

        this.minTimeElapsed = false;
        this.contentLoaded = false;
        this.isDismissed = false;
        this.splashElement = document.getElementById('splash-screen');

        if (!this.splashElement) {
            console.warn('Splash: #splash-screen element not found.');
            return;
        }

        // 1. Min wait timer, kept short so the app lands on Home quickly.
        setTimeout(() => {
            console.log('Splash: minimum duration reached.');
            this.minTimeElapsed = true;
            this.checkReady();
        }, CONFIG.MIN_DURATION);

        // 2. Slow load feedback
        setTimeout(async () => {
            if (!this.contentLoaded && !this.isDismissed) {
                console.log('Splash: Load is taking longer than usual...');
                try {
                    const { NetworkStatusOverlay } = await import('./toast.js');
                    NetworkStatusOverlay.show('slow');
                } catch (e) {
                    console.error('Splash: Failed to load NetworkStatusOverlay', e);
                }
            }
        }, CONFIG.SLOW_LOAD_TIMEOUT);

        // 3. Max wait timer - Force dismissal
        setTimeout(async () => {
            if (!this.isDismissed) {
                console.warn('Splash: max duration reached. Forcing dismissal.');
                this.dismiss();

                try {
                    const { ErrorHandler } = await import('./error-handler.js');
                    ErrorHandler.show(
                        window.i18n.t('error.initError'),
                        () => window.location.reload(),
                        window.i18n.t('error.title')
                    );
                } catch (e) {
                    console.error('Splash: Failed to load ErrorHandler', e);
                }
            }
        }, CONFIG.MAX_DURATION);
    }

    static signalContentLoaded() {
        if (this.contentLoaded) return;
        console.log('Splash: Content ready signal received.');
        this.contentLoaded = true;
        this.checkReady();
    }

    static checkReady() {
        if (this.minTimeElapsed && this.contentLoaded && !this.isDismissed) {
            this.dismiss();
        }
    }

    static showFeedback(message) {
        if (this.isDismissed || !this.splashElement) return;
        let feedbackEl = this.splashElement.querySelector('.splash-feedback');
        if (!feedbackEl) {
            feedbackEl = document.createElement('div');
            feedbackEl.className = 'splash-feedback';
            feedbackEl.style.cssText = 'position:absolute; bottom:15%; color:rgba(255,255,255,0.5); font-size:14px; animation: fadeIn 1s ease;';
            this.splashElement.appendChild(feedbackEl);
        }
        feedbackEl.textContent = message;
    }

    /**
     * Dismisses the splash screen overlay using a CSS transition with a fallback timeout.
     * Triggers any pending background update check prompts once the splash is hidden.
     */
    static dismiss() {
        if (this.isDismissed || !this.splashElement) return;
        this.isDismissed = true;

        console.log('Splash: Dismissing splash screen.');

        // Add hidden class to trigger CSS transition
        this.splashElement.classList.add('hidden');

        // Robust cleanup: use transitionend with a fallback timeout
        let cleanedUp = false;
        const cleanup = () => {
            if (cleanedUp) return;
            cleanedUp = true;

            this.splashElement.style.display = 'none';
            this.splashElement.removeEventListener('transitionend', cleanup);

            // Explanation: If an update was discovered in the background during splash,
            // render the prompt now that the landing page is fully interactive and visible.
            if (window.pendingUpdateVersion) {
                console.log('Splash: Triggering cached update prompt for version:', window.pendingUpdateVersion);
                const version = window.pendingUpdateVersion;
                window.pendingUpdateVersion = null;
                import('./update-prompt.js').then(({ UpdatePrompt }) => {
                    UpdatePrompt.show(version);
                }).catch(err => console.error('Splash: Failed to load update prompt module', err));
            }
        };

        this.splashElement.addEventListener('transitionend', cleanup);

        // Fallback timeout in case transitionend doesn't fire (e.g. if element is hidden immediately)
        setTimeout(cleanup, CONFIG.TRANSITION_FALLBACK);
    }
}
