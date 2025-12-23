export const spatialNavSettings = {
    id: 'settings',
    findNext: (current, direction) => {
        const scope = document;
        const inLanguageModal = current.closest('.language-options') !== null;

        if (inLanguageModal) {
            const options = Array.from(scope.querySelectorAll('.language-option.focusable'));
            const currentIndex = options.indexOf(current);
            if (direction === 'down') {
                if (currentIndex < options.length - 1) return options[currentIndex + 1];
                return scope.querySelector('.close-modal');
            }
            if (direction === 'up' && currentIndex > 0) {
                return options[currentIndex - 1];
            }
        }

        if (current.classList.contains('close-modal') && direction === 'up') {
            const options = scope.querySelectorAll('.language-option.focusable');
            if (options.length > 0) return options[options.length - 1];
        }

        return null;
    }
};
