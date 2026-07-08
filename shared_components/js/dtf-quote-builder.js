/**
 * DTF Quote Builder - Excel-Style Layout
 * Two-column layout with sidebar location selection and product table
 *
 * Features:
 * - 9 transfer locations with conflict zone enforcement
 * - Excel-style product table with inline editing
 * - Real-time pricing in sidebar
 * - 100% API-driven pricing
 */

// API response cache (prevent 429 rate limit errors on extended size lookups)
const sizeDetectionCache = new Map(); // key: "style-color" → extended sizes array

// Unsaved-changes flag read by the shared hasUnsavedChanges()/setupBeforeUnloadGuard()
// in quote-builder-utils.js (EMB/SCP pattern — top-level `let` so the shared functions
// see the same binding). Mirrored by DTFQuoteBuilder.markAsUnsaved/markAsSaved. (2026-06-10)
let hasChanges = false;

// ============================================================
// class DTFQuoteBuilder — MOVED to builders/dtf/quote-builder-class.js
// (D1, 2026-07-08). Bridged as window.DTFQuoteBuilder by the builders/dtf
// bundle at parse time, before the DOMContentLoaded init below runs.
// ============================================================

// Global instance
let dtfQuoteBuilder;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    dtfQuoteBuilder = new DTFQuoteBuilder();
    window.dtfQuoteBuilder = dtfQuoteBuilder;

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
            try { dtfQuoteBuilder.updatePricing(); } catch (_) {}
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
                        const v = document.getElementById('customer-number')?.value?.trim();
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
});

// copyToClipboard/copyQuoteToClipboard/printQuote — MOVED to builders/dtf/output.js (D1, 2026-07-08).

// =====================================================
// Push to ShopWorks (Phase 8 — 2026-05-23)
// =====================================================
// Mirrors the EMB pushToShopWorks() pattern. The saved quote is transformed
// server-side (caspio-pricing-proxy/lib/dtf-push-transformer.js) into a
// ManageOrders order: garment lines + ship-to + shipping/discount/rush/art
// charges, linked to the real ShopWorks customer (from the quote's customer #).
//
// OnSite integration IDs (id_OrderType / id_DesignType) live in
// caspio-pricing-proxy/config/manageorders-dtf-config.js.

let _dtfPushQuoteId = null;

// showDtfPushButton/updateDtfPushButtonState — MOVED to builders/dtf/push.js (D1, 2026-07-08).

// One-click Push: auto-SAVE first (silent — no share modal), then open the review/confirm preview.
// Button is gated by the checklist; proxy PushedToShopWorks 409 guards against a duplicate order.
let _dtfPushInFlight = false;
// ============================================================
// PUSH TO SHOPWORKS (one-click save+push, preview/confirm) — MOVED to
// builders/dtf/push.js (D1, 2026-07-08). _dtfPushQuoteId/_dtfPushInFlight
// state stays HERE (cross-module lexical globals) until D2 state.js.
// ============================================================

// updatePricing reprice-pill wrap — MOVED into builders/dtf/quote-builder-class.js tail (D1, 2026-07-08).

// applyRushPercent — MOVED to builders/dtf/output.js (D1, 2026-07-08).
