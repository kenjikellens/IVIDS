/**
 * @file ripple.js
 * Universal Material Design Ink Ripple Engine for IVIDS.
 * Provides instant touch coordinate ripples on mobile and centered ripples for TV/Remote navigation.
 */

export class RippleEffect {
    static _initialized = false;
    static _activeWave = null;
    static _startX = 0;
    static _startY = 0;
    static _touchSlop = 10;

    /**
     * Initializes the universal ink ripple listener on the document.
     * Uses delegated pointer and scroll listeners for zero-overhead event handling.
     */
    static init() {
        if (this._initialized) return;
        this._initialized = true;

        document.addEventListener('pointerdown', (e) => this.handlePointerDown(e), { passive: true });
        document.addEventListener('pointermove', (e) => this.handlePointerMove(e), { passive: true });
        document.addEventListener('pointerup', () => this.handlePointerUp(), { passive: true });
        document.addEventListener('pointercancel', () => this.handlePointerCancel(), { passive: true });
        window.addEventListener('scroll', () => this.cancelActiveRipple(), { capture: true, passive: true });
    }

    /**
     * Resolves the interactive ripple target from an event target.
     * Checks for .universal-onclick first, then falls back to any standard interactive element.
     * @param {EventTarget} el - The clicked or touched DOM node.
     * @returns {HTMLElement|null} The resolved ripple container or null.
     */
    static findTarget(el) {
        if (!el || typeof el.closest !== 'function') return null;

        let target = el.closest('.universal-onclick');
        if (!target) {
            target = el.closest('.btn, .card, .chip, .nav-item, .tab-btn, .setting-item, .language-card, .disney-episode-item, .disney-extra-item, button, [role="button"]');
        }

        if (!target) return null;
        if (target.disabled || target.getAttribute('aria-disabled') === 'true') return null;
        if (target.classList.contains('form-toggle')) return null;

        return target;
    }

    /**
     * Handles pointer down contact and initiates the expanding ripple circle.
     * @param {PointerEvent} e - The native pointerdown event.
     */
    static handlePointerDown(e) {
        // Only react to primary pointer contact (left click or touch)
        if (e.button !== undefined && e.button !== 0) return;

        const target = this.findTarget(e.target);
        if (!target) return;

        this._startX = e.clientX;
        this._startY = e.clientY;

        this.createRipple(target, e.clientX, e.clientY);
    }

    /**
     * Cancels an ongoing ripple if the finger moves beyond standard touch slop (scrolling/swiping).
     * @param {PointerEvent} e - The native pointermove event.
     */
    static handlePointerMove(e) {
        if (!this._activeWave) return;
        const dist = Math.hypot(e.clientX - this._startX, e.clientY - this._startY);
        if (dist > this._touchSlop) {
            this.cancelActiveRipple();
        }
    }

    /**
     * Clears reference to active wave when pointer release occurs.
     */
    static handlePointerUp() {
        this._activeWave = null;
    }

    /**
     * Cancels ongoing ripple when touch interaction is canceled by the OS.
     */
    static handlePointerCancel() {
        this.cancelActiveRipple();
    }

    /**
     * Smoothly fades out and removes the active ripple wave if a scroll or gesture is detected.
     */
    static cancelActiveRipple() {
        if (!this._activeWave) return;
        const wave = this._activeWave;
        this._activeWave = null;
        wave.style.transition = 'opacity 120ms ease-out';
        wave.style.opacity = '0';
        setTimeout(() => {
            if (wave.parentElement) wave.parentElement.removeChild(wave);
        }, 130);
    }

    /**
     * Spawns an expanding Material Design ink ripple circle on the specified target element.
     * Calculates contact coordinates or defaults to element center for remote control D-pad actions.
     * @param {HTMLElement} target - The interactive container element.
     * @param {number|null} [clientX] - Screen X coordinate of the contact point.
     * @param {number|null} [clientY] - Screen Y coordinate of the contact point.
     */
    static createRipple(target, clientX = null, clientY = null) {
        if (!target) return;

        // Prevent double ripples when D-pad action fires synthetic click events
        const now = Date.now();
        if (target._lastRippleTime && (now - target._lastRippleTime < 320)) {
            return;
        }
        target._lastRippleTime = now;

        // Ensure container class is present
        if (!target.classList.contains('universal-onclick')) {
            target.classList.add('universal-onclick');
        }

        const rect = target.getBoundingClientRect();
        let x, y;

        // Remote control / D-pad Enter or programmatic click: origin at exact element center
        if (clientX == null || clientY == null || (clientX === 0 && clientY === 0)) {
            x = rect.width / 2;
            y = rect.height / 2;
        } else {
            x = clientX - rect.left;
            y = clientY - rect.top;
        }

        // Calculate radius to encompass the furthest corner of the element
        const radius = Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));
        const diameter = radius * 2;

        const wave = document.createElement('span');
        wave.className = 'ripple-wave';
        wave.style.width = `${diameter}px`;
        wave.style.height = `${diameter}px`;
        wave.style.left = `${x - radius}px`;
        wave.style.top = `${y - radius}px`;

        this._activeWave = wave;
        target.appendChild(wave);

        // Remove wave upon animation completion
        const cleanup = () => {
            if (wave.parentElement) wave.parentElement.removeChild(wave);
            if (this._activeWave === wave) this._activeWave = null;
        };

        wave.addEventListener('animationend', cleanup, { once: true });
        setTimeout(cleanup, 500); // Safety fallback
    }
}

// Expose globally for legacy modules, native bridges, and spatial navigation engine
if (typeof window !== 'undefined') {
    window.RippleEffect = RippleEffect;
}
