/**
 * DtgAdapter — the DTG method adapter for QuoteBuilderBase (follow-up F1,
 * 2026-07-09). DTG keeps its deliberate inline-form UX — this changes WIRING
 * only: the form-core boot that used to self-run on import now rides the
 * shared base lifecycle, so DTG gets the same loud-pricing-failure banner as
 * the trio and joins adapter-contract.test.js.
 *
 * Like DTF, the composition root (form-core's init) interleaves page wiring
 * with ?edit/?duplicate routing via early returns, so the WHOLE init rides
 * initPricingAndRoute verbatim and setupPage is a documented no-op — the
 * real split lands if init is ever unpacked.
 */
import { loadServiceCodePrices } from '../shared/service-codes.js';
import { init } from './form-core.js';
import { renderSummary } from './pricing.js';
import { dtgIF, state } from './state.js';

export class DtgAdapter {
    // ── MethodAdapter contract (typed in types/quote.d.ts) ────────────────
    /** 'dtg' */
    method = 'dtg';

    /** The DTG pricing authority — the canonical-delegating service class
     *  (classic script dtg-pricing-service.js → DTGCanonicalPricing). */
    getPricingService() {
        return (typeof window !== 'undefined' && window.DTGPricingService) || null;
    }

    /** Last-fetched tier rows (cached on dtgIF by pricing.js updateLivePrices). */
    getTierConfig() {
        return dtgIF._allTiers || null;
    }

    /** DTG location model: one front code + optional back code on THE state. */
    getLocationModel() {
        return { front: state.front, back: state.back };
    }

    /** DTG quantity nudge thresholds (see MEMORY nudge tiers). */
    getNudgeTiers() {
        return [12, 24, 48, 72];
    }

    /**
     * Row rendering hook — not yet driven by the base (lands when the 0.5
     * quote-model row render replaces per-builder DOM building).
     */
    renderMethodSpecificRow(_item, _rowEl) {
        /* intentionally empty until the base drives row rendering (0.5) */
    }

    // ── Lifecycle hook 1 ──────────────────────────────────────────────────
    // Still a no-op for WIRING (see file JSDoc: init interleaves wiring and
    // routing; reordering it would change behavior). It does own one thing:
    // loading Caspio Service_Codes for the GRT-50 / GRT-75 art charges, so those
    // dollars come from the API and not the documented fallbacks (Erik's
    // Pricing=API rule). Fire-and-forget, exactly like the SCP adapter —
    // artFeeTotals() returns the fallback rate until it resolves, and the
    // renderSummary() below repaints the rates + totals the moment it does.
    async setupPage() {
        /* all wiring rides initPricingAndRoute verbatim */
        if (typeof loadServiceCodePrices === 'function') {
            loadServiceCodePrices()
                .then(() => { try { renderSummary(); } catch (_) { /* form not painted yet — init's own render covers it */ } })
                .catch(() => { /* loadServiceCodePrices already toasts + badges on failure */ });
        }
    }

    // ── Lifecycle hook 2: form-core's init, verbatim call ─────────────────
    async initPricingAndRoute() {
        init();
    }
}
