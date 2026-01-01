export class Splash {
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

        // 1. Min wait timer (3 seconds)
        setTimeout(() => {
            console.log('Splash: 3s min duration reached.');
            this.minTimeElapsed = true;
            this.checkReady();
        }, 3000);

        // 2. Slow load feedback (10 seconds)
        setTimeout(() => {
            if (!this.contentLoaded && !this.isDismissed) {
                console.log('Splash: Load is taking longer than usual...');
                this.showFeedback(window.i18n.t('splash.loadingStatus'));
            }
        }, 10000);

        // 3. Max wait timer (60 seconds) - Force dismissal
        setTimeout(async () => {
            if (!this.isDismissed) {
                console.warn('Splash: 60s max duration reached. Forcing dismissal.');
                this.dismiss();

                // If it reached 1 minute without load, we might be offline
                if (!window.navigator.onLine) {
                    try {
                        const { Toast } = await import('./toast.js');
                        Toast.show(window.i18n.t('splash.slowConnection'), {
                            title: window.i18n.t('toast.slowConnectionTitle'),
                            type: 'warning',
                            position: 'top-right',
                            duration: 0
                        });
                    } catch (e) { }
                }
            }
        }, 60000);
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

    static dismiss() {
        if (this.isDismissed || !this.splashElement) return;
        this.isDismissed = true;

        console.log('Splash: Dismissing splash screen.');

        // Add hidden class to trigger CSS transition
        this.splashElement.classList.add('hidden');

        // Robust cleanup: use transitionend with a fallback timeout
        const cleanup = () => {
            this.splashElement.style.display = 'none';
            this.splashElement.removeEventListener('transitionend', cleanup);
        };

        this.splashElement.addEventListener('transitionend', cleanup);

        // Fallback timeout in case transitionend doesn't fire (e.g. if element is hidden immediately)
        setTimeout(cleanup, 1000);
    }
}
