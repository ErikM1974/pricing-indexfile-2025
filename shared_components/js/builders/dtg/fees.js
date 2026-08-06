/**
 * DTG inline form — art-charge module (2026-08-06).
 *
 * THE single source for the two art-department charges on a DTG quote:
 *   GRT-50  Art setup / logo mockup & review — count × SellPrice
 *   GRT-75  Graphic design                   — hours × SellPrice (per hour)
 *
 * Same contract as effectiveShipFee(): EVERY consumer (renderSummary,
 * computePriceQuoteFromState, dtgPrintQuote, submitToShopWorks, and the save in
 * dtg-quote-page.js via getSaveQuote) reads THIS — never the DOM, never a
 * literal — so the five money sites cannot desync.
 *
 * WHY count × live rate instead of the trio's typed dollar amount: server.js's
 * /api/submit-order-form prices `addOns` from Caspio Service_Codes (FLAT →
 * qty × SellPrice) when it builds the ShopWorks LinesOE rows. A rep-typed
 * amount has no push representation, so it would have to be dropped from the
 * order — the rep would quote it and ShopWorks would never bill it. Counts
 * push losslessly: screen == PDF == saved == ShopWorks, by construction.
 *
 * Erik's Pricing=API rule: the DOLLARS always come from Caspio, so a price
 * change there reprices every open quote with no deploy. The literals below are
 * documented fallbacks used ONLY when /api/service-codes was unreachable or
 * dropped the row, and warnIfServiceCodeMissing() makes that VISIBLE.
 */
import { getServicePrice } from '../shared/service-codes.js';
import { state } from './state.js';

export const ART_SETUP_CODE = 'GRT-50';

export const DESIGN_CODE = 'GRT-75';

// Fallback-only (see file header) — never the quoted price when Caspio answers.
export const ART_SETUP_FALLBACK = 50;

export const DESIGN_FALLBACK = 75;

const r2 = (n) => Math.round(n * 100) / 100;

// Live Service_Codes rate. `inUse` gates the missing-code warning so a quote
// that isn't charging the fee never toasts about its rate (the shared helper is
// once-per-page-per-code, but a spurious first warning is still noise).
function rateFor(code, fallback, label, inUse) {
    if (inUse && typeof window !== 'undefined' && typeof window.warnIfServiceCodeMissing === 'function') {
        window.warnIfServiceCodeMissing(code, fallback, label);
    }
    return getServicePrice(code, fallback);
}

/**
 * Resolve both art charges from state.fees (counts) × the live Caspio rates.
 * Always returns a full object with numeric fields — never null — so consumers
 * can read `.total` unconditionally.
 */
export function artFeeTotals() {
    const fees = (state && state.fees) || {};
    const rawQty = Number(fees.artSetupQty);
    const rawHours = Number(fees.designHours);
    const artSetupQty = Number.isFinite(rawQty) && rawQty > 0 ? Math.floor(rawQty) : 0;
    const designHours = Number.isFinite(rawHours) && rawHours > 0 ? rawHours : 0;

    const artSetupRate = rateFor(ART_SETUP_CODE, ART_SETUP_FALLBACK, 'Art setup', artSetupQty > 0);
    const designRate = rateFor(DESIGN_CODE, DESIGN_FALLBACK, 'Graphic design', designHours > 0);

    const artCharge = artSetupQty > 0 ? r2(artSetupQty * artSetupRate) : 0;
    const graphicDesignCharge = designHours > 0 ? r2(designHours * designRate) : 0;

    return {
        artSetupQty,
        artSetupRate,
        artCharge,
        designHours,
        designRate,
        graphicDesignCharge,
        total: r2(artCharge + graphicDesignCharge),
    };
}

/**
 * The ShopWorks add-on rows for this quote's art charges. server.js resolves
 * each code against Service_Codes (both are PricingMethod FLAT → line price =
 * qty × SellPrice), so the pushed LinesOE amounts equal artFeeTotals() exactly.
 * Empty array when nothing is charged.
 */
export function artFeeAddOns() {
    const f = artFeeTotals();
    const addOns = [];
    if (f.artSetupQty > 0) addOns.push({ code: ART_SETUP_CODE, qty: f.artSetupQty });
    if (f.designHours > 0) addOns.push({ code: DESIGN_CODE, qty: f.designHours });
    return addOns;
}
