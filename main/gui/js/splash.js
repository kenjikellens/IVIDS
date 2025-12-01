export class Splash {
    static init() {
        this.minTimeElapsed = false;
        this.contentLoaded = false;
        this.splashElement = document.getElementById('splash-screen');
        this.loaderContainer = document.querySelector('.splash-loader-container');
        this.logoElement = document.querySelector('.splash-logo');

        // Start minimum timer (2 seconds)
        setTimeout(() => {
            this.minTimeElapsed = true;
            this.checkReady();
        }, 2000);
    }

    static signalContentLoaded() {
        this.contentLoaded = true;
        this.checkReady();
    }

    static checkReady() {
        if (this.minTimeElapsed && this.contentLoaded) {
            this.playExitAnimation();
        }
    }

    static playExitAnimation() {
        if (!this.splashElement || !this.loaderContainer || !this.logoElement) return;

        // 1. Hide Loader
        this.loaderContainer.classList.add('hidden');

        // 2. Show Logo after a short delay
        setTimeout(() => {
            this.logoElement.classList.add('visible');

            // 3. Fade out entire splash screen after logo has been shown
            setTimeout(() => {
                this.splashElement.classList.add('hidden');

                // Optional: Remove from DOM after transition to free up resources
                setTimeout(() => {
                    this.splashElement.style.display = 'none';
                }, 800); // Match CSS transition duration
            }, 1500); // How long the logo stays visible
        }, 500); // Delay before logo appears
    }
}
