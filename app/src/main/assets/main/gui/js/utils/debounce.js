/**
 * Simple debounce utility.
 * Delays execution of func until 'wait' milliseconds have passed since the last call.
 */
export function debounce(func, wait) {
    let timeout;
    const debounced = function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };

    debounced.cancel = () => {
        clearTimeout(timeout);
    };

    return debounced;
}
