/**
 * DtfAdapter — the DTF method adapter for QuoteBuilderBase (roadmap 0.4).
 *
 * Carries the DTF page's composition-root init VERBATIM (moved from the
 * monolith's DOMContentLoaded listener, D2 2026-07-08). DTF's listener is
 * instantiate-THEN-wire (the class constructor does the page init and edit
 * routing internally), so to keep the order byte-identical the whole body
 * lives in initPricingAndRoute and setupPage is a documented no-op — the
 * real split lands when the constructor's init is unpacked (post-0.4).
 */
/* global closeExtendedSizePopup, updateDtfPushButtonState, SafetyStripeRecs, ArtworkUpload, CustomerDesignCombobox,
   loadServiceCodePrices, getServicePrice, showToast */
import { DTFQuoteBuilder } from './quote-builder-class.js';
import { loadServiceCodePrices } from '../shared/service-codes.js';

export class DtfAdapter {
    // ── MethodAdapter contract (typed in types/quote.d.ts) ────────────────
    /** 'dtf' */
    method = 'dtf';

    /** The live pricing authority (DTFPricingService on the instance). */
    getPricingService() {
        return window.dtfQuoteBuilder ? window.dtfQuoteBuilder.pricingCalculator : null;
    }

    /**
     * DTF tiers live on the instance's pricing calculator (getTierData) —
     * expose what it has; consumed when the base drives tier display (0.5+).
     */
    getTierConfig() {
        const b = window.dtfQuoteBuilder;
        return (b && b.pricingCalculator && (b.pricingCalculator.tiers || b.pricingCalculator.pricingData || null)) || null;
    }

    /** Transfer-location model (9 locations; conflict zones enforced by the class). */
    getLocationModel() {
        const b = window.dtfQuoteBuilder;
        return b ? { selected: b.selectedLocations } : { selected: [] };
    }

    /** DTF quantity nudge thresholds (see MEMORY nudge tiers). */
    getNudgeTiers() {
        return [10, 24, 48, 72];
    }

    /**
     * Row rendering hook — not yet driven by the base (lands when the 0.5
     * quote-model row render replaces per-builder DOM building). DTF rows
     * are built by dtf-quote-page.js (classic) + the class.
     */
    renderMethodSpecificRow(_item, _rowEl) {
        /* intentionally empty until the base drives row rendering (0.5) */
    }

    // ── Lifecycle hook 1 — deliberate no-op (see file JSDoc: DTF's init is
    //    instantiate-then-wire; reordering it would change behavior). ──────
    async setupPage() {
        /* all wiring rides initPricingAndRoute verbatim */
    }

    // ── Lifecycle hook 2: the ENTIRE monolith listener body, verbatim ─────
    async initPricingAndRoute() {
        window.dtfQuoteBuilder = new DTFQuoteBuilder();

        // Recommended safety apparel — curated hi-vis garment cross-sell (2026-06-28).
        // DTF doesn't offer safety stripes, so this is a plain garment cross-sell.
        if (window.SafetyStripeRecs) {
            SafetyStripeRecs.render('dtf-safety-recs', {
                variant: 'builder', audience: 'staff', collapsible: true,
                title: 'Safety apparel top sellers',
                subtitle: 'Popular hi-vis garments — click Add, then enter quantities',
                onAdd: function (style, color) {
                    try {
                        window.dtfQuoteBuilder.addProductFromQuote({ styleNumber: style, color: (color && (color.color_name || color.catalog_color)) || '', sizeBreakdown: {} });
                        if (typeof showToast === 'function') showToast('Added ' + style + ' — enter quantities', 'success');
                    } catch (e) { console.error('[DTF] safety-rec add failed:', e); }
                }
            });
        }

        // Load Caspio Service_Codes (GRT-75 design rate) so fees come from the API,
        // not a hardcoded 75 (Erik's Pricing=API rule). Fire-and-forget — getServicePrice()
        // returns the documented fallback until it resolves, then we re-price. (2026-06-09)
        if (typeof loadServiceCodePrices === 'function') {
            loadServiceCodePrices().then(() => {
                try { window.dtfQuoteBuilder.updatePricing(); } catch (_) {}
                // [2026-06-11] sync the static "$75/hr" labels with the live GRT-75
                // rate — the math was already API-driven, but a Caspio rate change
                // left the on-screen labels contradicting the charged totals
                try {
                    const rate = getServicePrice('GRT-75', 75);
                    const rateLabel = document.getElementById('design-rate-label');
                    if (rateLabel) rateLabel.textContent = String(rate);
                    const rateLabelSidebar = document.getElementById('design-rate-label-sidebar');
                    if (rateLabelSidebar) rateLabelSidebar.textContent = String(rate);
                } catch (_) {}
            });
        }

        // Phase 9 (2026-05-23) → Phase 11.3 (2026-05-24) — rich-mode artwork upload.
        // Adds design name input + per-file placement dropdown so the push payload
        // can carry Designs[{name, Locations[{Location, ImageURL}]}] when the rep
        // is creating a brand-new design (no existing #). Mirrors DTG's pattern
        // in dtg-inline-form.js:2814-2864.
        if (typeof ArtworkUpload !== 'undefined') {
            try {
                window._dtfArtwork = ArtworkUpload.attach({
                    mountSelector: '#dtf-artwork-mount',
                    designName: {
                        enabled: true,
                        label: 'Design name (required when uploading new artwork)',
                        placeholder: 'e.g. Acme Corp Logo',
                    },
                    placements: [
                        { code: 'Left Chest',   label: 'Left Chest' },
                        { code: 'Right Chest',  label: 'Right Chest' },
                        { code: 'Full Front',   label: 'Full Front' },
                        { code: 'Full Back',    label: 'Full Back' },
                        { code: 'Center Front', label: 'Center Front' },
                        { code: 'Center Back',  label: 'Center Back' },
                        { code: 'Back of Neck', label: 'Back of Neck' },
                        { code: 'Left Sleeve',  label: 'Left Sleeve' },
                        { code: 'Right Sleeve', label: 'Right Sleeve' },
                    ],
                    defaultPlacement: 'Left Chest',
                });
                console.log('[DTF] Artwork upload widget mounted (rich mode)');
            } catch (e) {
                console.error('[DTF] Artwork widget mount failed:', e);
            }
        }

        // Phase 11.1 (2026-05-24) — customer-aware design lookup.
        // Wraps #design-number input with autocomplete fetching from
        // proxy /api/designs/by-customer?method=dtf.
        if (typeof CustomerDesignCombobox !== 'undefined') {
            try {
                const designInput = document.getElementById('design-number');
                if (designInput) {
                    window._dtfDesignCombobox = CustomerDesignCombobox.attach(designInput, {
                        method: 'dtf',
                        getCustomerId: () => {
                            const v = /** @type {HTMLInputElement|null} */ (document.getElementById('customer-number'))?.value?.trim();
                            const n = parseInt(v, 10);
                            return Number.isFinite(n) && n > 0 ? n : null;
                        },
                        onPick: (design) => {
                            console.log('[DTF] Design picked:', design.idDesign, design.designName);
                        },
                    });
                    // Refresh combobox when customer number changes
                    const custInput = document.getElementById('customer-number');
                    if (custInput) {
                        custInput.addEventListener('change', () => {
                            if (window._dtfDesignCombobox) window._dtfDesignCombobox.refresh();
                        });
                    }
                    console.log('[DTF] Design combobox mounted');
                }
            } catch (e) {
                console.error('[DTF] Design combobox mount failed:', e);
            }
        }

        // ── Migrated from dtf-quote-page.js DOMContentLoaded (Batch 4.3) ──
        // Runs AFTER construction + wiring (deterministic — the old deferred
        // setTimeout raced the async init). Keyboard shortcuts + the always-
        // visible Push button/readiness render.
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                const sizePopup = document.getElementById('extended-size-popup');
                if (sizePopup && !sizePopup.classList.contains('hidden')) {
                    e.preventDefault();
                    if (typeof closeExtendedSizePopup === 'function') closeExtendedSizePopup();
                    return;
                }
            }
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (window.dtfQuoteBuilder) window.dtfQuoteBuilder.saveAndGetLink();
            }
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                if (window.dtfQuoteBuilder) window.dtfQuoteBuilder.printQuote();
            }
        });
        if (typeof updateDtfPushButtonState === 'function') updateDtfPushButtonState();
    }
}
