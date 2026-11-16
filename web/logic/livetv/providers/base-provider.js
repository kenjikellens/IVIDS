/**
 * BaseStreamProvider Abstract Strategy
 * =====================================
 * Establishes the contract and common lifecycle for all IPTV stream providers.
 * Enforces timeout boundaries, safe network execution, and Channel model normalization.
 */

import { Channel } from '../core/channel.js';

export class BaseStreamProvider {
    /**
     * Initializes the base provider.
     * 
     * @param {string} id - Unique provider key.
     * @param {string} name - Human-readable provider name.
     * @param {Object} [options] - Configuration options.
     */
    constructor(id, name, options = {}) {
        if (new.target === BaseStreamProvider) {
            throw new TypeError('Cannot construct BaseStreamProvider instances directly (abstract class).');
        }
        this.id = id;
        this.name = name;
        this.category = options.category || 'General';
        this.priority = typeof options.priority === 'number' ? options.priority : 50;
        this.enabled = options.enabled !== false;
        this.timeoutMs = options.timeoutMs || 30000;
    }

    /**
     * Abstract method to fetch and return an array of Channel instances.
     * 
     * @returns {Promise<Array<Channel>>} List of resolved channels.
     */
    async fetchChannels() {
        throw new Error(`fetchChannels() must be implemented by concrete subclass ${this.constructor.name}`);
    }

    /**
     * Helper to instantiate a normalized Channel object with provider defaults.
     * 
     * @param {Object} rawData - Channel attributes.
     * @returns {Channel} Standardized Channel entity.
     */
    createChannel(rawData = {}) {
        return new Channel({
            ...rawData,
            sourceName: this.name,
            sourcePriority: this.priority
        });
    }

    /**
     * Performs a fetch request guarded by an AbortController timeout.
     * 
     * @param {string} url - Target URL.
     * @param {Object} [fetchOptions] - Fetch configuration.
     * @returns {Promise<Response>} Network response.
     */
    async fetchWithTimeout(url, fetchOptions = {}) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort(new Error(`Request timed out after ${this.timeoutMs}ms`));
        }, this.timeoutMs);
        try {
            const response = await fetch(url, {
                ...fetchOptions,
                signal: controller.signal
            });
            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }
}
