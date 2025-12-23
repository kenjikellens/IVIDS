export class Splash {
    static init() {
        this.minTimeElapsed = false;
        this.contentLoaded = false;
        this.isDismissed = false;
        this.splashElement = document.getElementById('splash-screen');
        this.loaderContainer = document.querySelector('.splash-loader-container');
        this.logoElement = document.querySelector('.splash-logo');

        if (!this.splashElement) {
            console.error('Splash: #splash-screen element not found.');
            return;
        }

        // Start minimum timer (3 seconds)
        setTimeout(() => {
            console.log('Splash: 3s elapsed. Forcing dismissal as requested.');
            this.dismiss();
        }, 3000);

        // Start maximum safety timer (60 seconds)
        setTimeout(() => {
            if (!this.isDismissed) {
                console.warn('Splash: Maximum time (60s) reached. Forcing dismissal.');
                this.dismiss();
            }
        }, 60000);
    }

    static signalContentLoaded() {
        if (this.contentLoaded) return; // Only signal once
        console.log('Splash: Content (hero) loaded signal received.');
        this.contentLoaded = true;
        this.checkReady();
    }

    static checkReady() {
        if (this.minTimeElapsed && this.contentLoaded && !this.isDismissed) {
            this.dismiss();
        }
    }

    static dismiss() {
        if (this.isDismissed || !this.splashElement) return;
        this.isDismissed = true;

        console.log('Splash: Dismissing splash screen.');

        // Add hidden class to trigger CSS transition
        this.splashElement.classList.add('hidden');

        // Remove from DOM or just hide after transition
        setTimeout(() => {
            this.splashElement.style.display = 'none';
        }, 1000); // Slightly longer than CSS transition offset
    }
}
