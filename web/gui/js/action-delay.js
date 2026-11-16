/**
 * @file action-delay.js
 * Universal Button & Navigation Response Delay Engine for IVIDS.
 * Adds a configurable delay (0ms, 100ms, 250ms, 500ms) after button presses,
 * allowing visual ink ripple and press feedback to render before actions/navigation execute.
 */
import { PersistentStorage } from '../../logic/persistent-storage.js';

export class ActionDelayManager {
    static _instance = null;

    /**
     * Retrieves the singleton instance of the ActionDelayManager.
     * @returns {ActionDelayManager} The active manager instance.
     */
    static getInstance() {
        if (!this._instance) {
            this._instance = new ActionDelayManager();
        }
        return this._instance;
    }

    /**
     * Initializes the delay manager singleton and attaches document click capture listeners.
     */
    static init() {
        return this.getInstance();
    }

    constructor() {
        this.delay = this.loadDelay();
        this.isDispatching = false;
        this.activeTimer = null;
        this.init();
    }

    /**
     * Loads the saved delay setting from persistent storage (default: 100ms).
     * @returns {number} The response delay in milliseconds.
     */
    loadDelay() {
        try {
            const raw = PersistentStorage.getItem('ivids-settings');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.delayAction !== undefined) {
                    const num = parseInt(parsed.delayAction, 10);
                    if (!isNaN(num) && [0, 100, 250, 500].includes(num)) {
                        return num;
                    }
                }
            }
        } catch (e) {
            console.error('Error loading delayAction setting:', e);
        }
        return 100;
    }

    /**
     * Updates and caches the active response delay in milliseconds.
     * @param {number|string} newDelay - The new delay in milliseconds.
     */
    setDelay(newDelay) {
        const num = parseInt(newDelay, 10);
        this.delay = (!isNaN(num) && [0, 100, 250, 500].includes(num)) ? num : 100;
    }

    /**
     * Returns the active delay duration in milliseconds.
     * @returns {number} Delay in ms.
     */
    getDelay() {
        return this.delay;
    }

    /**
     * Attaches global capturing click event listener to the document.
     */
    init() {
        document.addEventListener('click', (e) => this.handleClickCapture(e), true);
    }

    /**
     * Identifies whether the click target belongs to an interactive element eligible for delay.
     * Skips text inputs, textareas, and form switches to keep typing and toggles instant.
     * @param {EventTarget} target - Event target node.
     * @returns {HTMLElement|null} The resolved interactive container or null.
     */
    findInteractiveTarget(target) {
        if (!target || typeof target.closest !== 'function') return null;

        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.closest('.form-toggle, input, textarea')) {
            return null;
        }

        return target.closest('button, a, .btn, .card, .clickable, .nav-item, .setting-item, .language-card, .chip, [role="button"]');
    }

    /**
     * Captures click events in the capture phase, applying the configured delay before execution.
     * @param {MouseEvent} e - The native click event.
     */
    handleClickCapture(e) {
        if (this.isDispatching || e._actionDelayed) {
            return;
        }

        if (this.delay <= 0) {
            return;
        }

        const interactive = this.findInteractiveTarget(e.target);
        if (!interactive) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        if (this.activeTimer) {
            clearTimeout(this.activeTimer);
            this.activeTimer = null;
        }

        const target = e.target;
        this.activeTimer = setTimeout(() => {
            this.activeTimer = null;
            this.isDispatching = true;
            try {
                if (typeof interactive.click === 'function') {
                    interactive.click();
                } else if (typeof target.click === 'function') {
                    target.click();
                } else {
                    const syntheticEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window,
                        detail: e.detail
                    });
                    syntheticEvent._actionDelayed = true;
                    target.dispatchEvent(syntheticEvent);
                }
            } finally {
                this.isDispatching = false;
            }
        }, this.delay);
    }
}

if (typeof window !== 'undefined') {
    window.ActionDelayManager = ActionDelayManager;
}
