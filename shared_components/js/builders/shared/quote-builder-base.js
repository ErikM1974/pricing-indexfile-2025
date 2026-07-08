/**
 * QuoteBuilderBase — the ONE base for the quote builders (roadmap 0.4).
 *
 * This is the revival of the dormant quote-builder-base.js promised by the
 * 0.4 base audit (Erik-approved 2026-07-07): the class every method builder
 * drives its page through, parameterized by a MethodAdapter.
 *
 * v1 scope (single adapter — EMB): the base owns the page LIFECYCLE — hook
 * ordering, the loading overlay, the visible pricing-failure warning
 * (Erik's #1 rule), and entry focus. The EMB adapter carries its init meat
 * verbatim; as SCP/DTF adapt (rule of two), common behavior graduates from
 * the adapters up into this base (routing skeleton, autosave wiring,
 * save/print flow, totals/tax, modals).
 *
 * The MethodAdapter contract is typed in shared_components/js/types/quote.d.ts;
 * the constructor validates it at runtime so a builder that forgets a method
 * fails LOUDLY at boot, not silently at click time.
 */

/** Methods every adapter must implement (see MethodAdapter in types/quote.d.ts). */
const ADAPTER_CONTRACT = [
    'getPricingService',
    'getTierConfig',
    'getLocationModel',
    'getNudgeTiers',
    'renderMethodSpecificRow',
    // lifecycle hooks (v1)
    'setupPage',
    'initPricingAndRoute',
];

export class QuoteBuilderBase {
    /**
     * @param {import('../../types/quote').MethodAdapter & {setupPage: Function, initPricingAndRoute: Function, focusEntry?: Function}} adapter
     */
    constructor(adapter) {
        const missing = ADAPTER_CONTRACT.filter((m) => typeof adapter?.[m] !== 'function');
        if (missing.length) {
            throw new Error(`QuoteBuilderBase: adapter missing required method(s): ${missing.join(', ')}`);
        }
        this.adapter = adapter;
    }

    /** Register the page boot on DOMContentLoaded (call at bundle parse time). */
    init() {
        document.addEventListener('DOMContentLoaded', () => this.start());
    }

    /**
     * The page lifecycle. Hook order is the contract:
     *   setupPage (UI wiring that must work even if pricing is down)
     *   → initPricingAndRoute (pricing service + ?edit/?duplicate/prefill routing)
     *   → focus entry point.
     * Pricing failure is VISIBLE and non-fatal — search/UI keep working.
     */
    async start() {
        const showLoadingFn = typeof window.showLoading === 'function' ? window.showLoading : () => {};
        showLoadingFn(true);
        try {
            await this.adapter.setupPage();
        } catch (err) {
            console.error('[QuoteBuilderBase] setupPage failed:', err);
            if (typeof window.showToast === 'function') {
                window.showToast('Some page controls failed to load. Refresh if anything looks off.', 'warning', 6000);
            }
        }
        try {
            await this.adapter.initPricingAndRoute();
        } catch (err) {
            // Never a silent wrong price: pricing init failure is loud, but the
            // rest of the page (search, layout) stays usable.
            console.error('Failed to initialize pricing:', err);
            if (typeof window.showToast === 'function') {
                window.showToast('Pricing unavailable. Search still works.', 'warning');
            }
        }
        if (typeof this.adapter.focusEntry === 'function') this.adapter.focusEntry();
        showLoadingFn(false);
    }
}
