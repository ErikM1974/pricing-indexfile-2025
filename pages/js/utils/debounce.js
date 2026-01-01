/**
 * Debounce utility - Prevents excessive function calls
 *
 * Features:
 * - Delays function execution until user stops typing/clicking
 * - Cancels previous pending calls
 * - Configurable delay
 * - Support for leading and trailing edge execution
 *
 * Solves the problem: API spam on rapid input changes
 * Result: Smooth user experience + reduced API calls
 *
 * Usage:
 *   const debouncedSearch = debounce((value) => {
 *       fetchResults(value);
 *   }, 300);
 *
 *   input.addEventListener('input', (e) => debouncedSearch(e.target.value));
 */

/**
 * Create a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay (default: 300ms)
 * @param {Object} options - Options object
 * @param {boolean} options.leading - Invoke on the leading edge of the timeout (default: false)
 * @param {boolean} options.trailing - Invoke on the trailing edge of the timeout (default: true)
 * @returns {Function} The debounced function
 */
function debounce(func, wait = 300, options = {}) {
    const { leading = false, trailing = true } = options;

    let timeoutId = null;
    let lastArgs = null;
    let lastThis = null;
    let lastCallTime = null;
    let lastInvokeTime = 0;

    function invokeFunc(time) {
        const args = lastArgs;
        const thisArg = lastThis;

        lastArgs = lastThis = null;
        lastInvokeTime = time;

        return func.apply(thisArg, args);
    }

    function leadingEdge(time) {
        // Reset any `maxWait` timer
        lastInvokeTime = time;

        // Start the timer for the trailing edge
        timeoutId = setTimeout(timerExpired, wait);

        // Invoke the leading edge
        return leading ? invokeFunc(time) : undefined;
    }

    function remainingWait(time) {
        const timeSinceLastCall = time - lastCallTime;
        const timeSinceLastInvoke = time - lastInvokeTime;
        const timeWaiting = wait - timeSinceLastCall;

        return timeWaiting;
    }

    function shouldInvoke(time) {
        const timeSinceLastCall = time - lastCallTime;
        const timeSinceLastInvoke = time - lastInvokeTime;

        // Either this is the first call, activity has stopped and we're at the
        // trailing edge, or the system time has gone backwards
        return (
            lastCallTime === null ||
            timeSinceLastCall >= wait ||
            timeSinceLastCall < 0
        );
    }

    function timerExpired() {
        const time = Date.now();
        if (shouldInvoke(time)) {
            return trailingEdge(time);
        }
        // Restart the timer
        timeoutId = setTimeout(timerExpired, remainingWait(time));
    }

    function trailingEdge(time) {
        timeoutId = null;

        // Only invoke if we have `lastArgs` which means `func` has been
        // debounced at least once
        if (trailing && lastArgs) {
            return invokeFunc(time);
        }
        lastArgs = lastThis = null;
        return undefined;
    }

    function cancel() {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        lastInvokeTime = 0;
        lastArgs = lastCallTime = lastThis = timeoutId = null;
    }

    function flush() {
        return timeoutId === null ? undefined : trailingEdge(Date.now());
    }

    function pending() {
        return timeoutId !== null;
    }

    function debounced(...args) {
        const time = Date.now();
        const isInvoking = shouldInvoke(time);

        lastArgs = args;
        lastThis = this;
        lastCallTime = time;

        if (isInvoking) {
            if (timeoutId === null) {
                return leadingEdge(lastCallTime);
            }
        }
        if (timeoutId === null) {
            timeoutId = setTimeout(timerExpired, wait);
        }
        return undefined;
    }

    debounced.cancel = cancel;
    debounced.flush = flush;
    debounced.pending = pending;

    return debounced;
}

/**
 * Create a throttled function that only invokes func at most once per every wait milliseconds
 *
 * @param {Function} func - The function to throttle
 * @param {number} wait - The number of milliseconds to throttle invocations to
 * @returns {Function} The throttled function
 */
function throttle(func, wait = 300) {
    return debounce(func, wait, {
        leading: true,
        trailing: false
    });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { debounce, throttle };
}

// Make available globally for browser
if (typeof window !== 'undefined') {
    window.debounce = debounce;
    window.throttle = throttle;
}
