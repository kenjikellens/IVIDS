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
        // Skip nav-items and focus on content instead
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
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            element.focus();
        }
    },

    handleKey(e) {
        const current = document.querySelector('.focused');
        if (!current) {
            this.focusFirst();
            return;
        }

        let nextElement = null;

        switch (e.keyCode) {
            case 37: // LEFT
                nextElement = this.findNext(current, 'left');
                break;
            case 38: // UP
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
            case 8: // Backspace (PC)
                if (this.onBack) {
                    this.onBack();
                }
                break;
        }

        if (nextElement) {
            e.preventDefault();
            this.setFocus(nextElement);
        }
    },

    findNext(current, direction) {
        const rect = current.getBoundingClientRect();
        const all = Array.from(document.querySelectorAll(this.focusableSelector));

        // Filter out the current element
        const candidates = all.filter(el => el !== current);

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

            if (isValid && dist < minDistance) {
                minDistance = dist;
                bestCandidate = el;
            }
        });

        return bestCandidate;
    }
};
