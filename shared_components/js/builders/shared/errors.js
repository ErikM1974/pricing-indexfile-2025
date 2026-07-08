/**
 * Shared builder error handling (roadmap 1.15) — makes Erik's #1 rule
 * ("never a silent wrong price") STRUCTURAL instead of conventional.
 *
 * One code path for every builder failure surface:
 *   - showErrorBanner(msg)            persistent red strip (role="alert") — hard
 *                                     failures: pricing init dead, save failed.
 *   - showFallbackPricingWarning(l)   persistent amber pill (role="status") that
 *                                     ACCUMULATES which prices are estimates —
 *                                     the "visible warning badge" the hardcoded-
 *                                     fallback rule requires. Toasts vanish in
 *                                     5s; this stays until the page reloads with
 *                                     live pricing.
 *   - safeExecute(fn, opts)           wrap an API call: failures are ALWAYS
 *                                     surfaced (banner + console), never
 *                                     swallowed into a silent fallback.
 *   - assertPriceOrThrow(v, ctx)      guard money math: a non-finite/negative
 *                                     price throws loudly instead of rippling
 *                                     NaN into a customer total.
 *
 * Classic scripts (quote-builder-utils.js, DTG page) reach the two display
 * helpers through the window bridges each builder's index.js re-exports,
 * behind typeof guards — pages without a bundle keep their toast-only path.
 *
 * Styling lives in quote-builder-common.css (.qb-error-banner /
 * .qb-fallback-badge) — shared by all 4 builders (Rule 8).
 */

/** Error thrown by assertPriceOrThrow — lets catch sites distinguish money-math guards. */
export class PricingError extends Error {
    /** @param {string} message @param {any} [value] */
    constructor(message, value) {
        super(message);
        this.name = 'PricingError';
        this.value = value;
    }
}

/** @returns {boolean} true when a real DOM is available (jsdom/node-tests guard) */
function hasDom() {
    return typeof document !== 'undefined' && !!document.body;
}

/**
 * Persistent top-of-page error banner. Reuses one element; repeated calls
 * update the text. Dismissible, role="alert" (a11y 1.8: hard failures are
 * assertive). Text is set via textContent — never innerHTML.
 * @param {string} message
 * @param {{id?: string}} [opts] custom element id when a page needs two banners
 * @returns {HTMLElement|null} the banner element (null without a DOM)
 */
export function showErrorBanner(message, opts = {}) {
    console.error('[QuoteBuilder]', message);
    if (!hasDom()) return null;
    const id = opts.id || 'qb-error-banner';
    let banner = document.getElementById(id);
    if (!banner) {
        banner = document.createElement('div');
        banner.id = id;
        banner.className = 'qb-error-banner';
        banner.setAttribute('role', 'alert');
        const text = document.createElement('span');
        text.className = 'qb-error-banner-text';
        banner.appendChild(text);
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'qb-error-banner-close';
        close.setAttribute('aria-label', 'Dismiss error message');
        close.textContent = '×';
        close.addEventListener('click', () => banner.remove());
        banner.appendChild(close);
        document.body.prepend(banner);
    }
    const textEl = banner.querySelector('.qb-error-banner-text');
    if (textEl) textEl.textContent = message;
    return banner;
}

/** Remove the error banner (call when the failing operation later succeeds). */
export function hideErrorBanner(id = 'qb-error-banner') {
    if (!hasDom()) return;
    const banner = document.getElementById(id);
    if (banner) banner.remove();
}

/** Labels currently shown in the fallback badge (module state, per page load). */
const _fallbackLabels = new Set();

/**
 * Persistent amber "estimated pricing in use" badge (Rule: a hardcoded
 * fallback price MUST carry a visible warning). Accumulates labels —
 * "service prices", "digitizing rate" — and stays until reload; safe to call
 * from hot paths (idempotent per label).
 * @param {string} label what fell back, e.g. 'service prices'
 * @returns {HTMLElement|null} the badge element (null without a DOM)
 */
export function showFallbackPricingWarning(label) {
    const known = _fallbackLabels.has(label);
    _fallbackLabels.add(label);
    if (!hasDom()) return null;
    let badge = document.getElementById('qb-fallback-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'qb-fallback-badge';
        badge.className = 'qb-fallback-badge';
        badge.setAttribute('role', 'status');
        document.body.appendChild(badge);
    } else if (known) {
        return badge; // hot-path exit: label already displayed
    }
    badge.textContent = `⚠ Estimated pricing in use: ${[..._fallbackLabels].join(', ')} — live rates unavailable. Verify before sending.`;
    return badge;
}

/** @returns {string[]} labels currently flagged as fallback (for tests/debug) */
export function fallbackPricingLabels() {
    return [..._fallbackLabels];
}

/**
 * Run an operation with LOUD failure semantics. On throw: console.error +
 * showErrorBanner(userMessage), then rethrow (default) or return `fallback`
 * — but even the fallback path has already surfaced the banner, so a silent
 * wrong result is impossible by construction.
 * @template T
 * @param {() => T | Promise<T>} fn
 * @param {{userMessage: string, rethrow?: boolean, fallback?: T, bannerId?: string}} opts
 * @returns {Promise<T>}
 */
export async function safeExecute(fn, opts) {
    const { userMessage, rethrow = true, fallback, bannerId } = opts || {};
    try {
        return await fn();
    } catch (err) {
        console.error('[QuoteBuilder] safeExecute failure:', err);
        showErrorBanner(userMessage || 'Something failed. Refresh and try again.', { id: bannerId });
        if (rethrow) throw err;
        return fallback;
    }
}

/**
 * Money-math guard: prices must be finite and >= 0 ($0.00 lines are legal;
 * NaN/undefined/negative are corruption and must stop the calculation).
 * @param {any} value
 * @param {string} [context] included in the error for debuggability
 * @returns {number} the validated price
 */
export function assertPriceOrThrow(value, context = 'price') {
    const n = typeof value === 'number' ? value : parseFloat(value);
    if (!Number.isFinite(n) || n < 0) {
        throw new PricingError(`Invalid ${context}: ${String(value)} — refusing to render a wrong price`, value);
    }
    return n;
}
