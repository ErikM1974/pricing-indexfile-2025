/**
 * Shared quote-builder typedefs (roadmap 0.6).
 *
 * Consumed via JSDoc `@type {import('../types/quote').QuoteItem}` annotations
 * in shared_components/js/builders/** — `npm run typecheck` (tsc, checkJs)
 * validates the annotations; there is NO TypeScript migration (vanilla JS
 * stays, per the roadmap ground rules).
 *
 * These types harden as tasks 0.4/0.5 extract the real modules; keep them in
 * sync with the canonical quote-item model in builders/shared/quote-model.js.
 */

/** One size cell on a line item (e.g. { size: 'L', qty: 12 }). */
export interface SizeQty {
    size: string;
    qty: number;
}

/** Canonical line item shared by EMB/SCP/DTF (roadmap 0.5). */
export interface QuoteItem {
    /** Stable row id within the quote (not the Caspio PK). */
    id: string;
    styleNumber: string;
    /** Display name — COLOR_NAME (never CATALOG_COLOR; see CLAUDE.md). */
    colorName: string;
    /** API/ShopWorks color code — CATALOG_COLOR. */
    catalogColor: string;
    description?: string;
    sizes: SizeQty[];
    /** Sum of sizes[].qty — derived, never authored. */
    totalQty: number;
    /** Method-specific decoration payload (stitches/colors/locations). */
    decoration?: Record<string, unknown>;
    unitPrice?: number;
    lineTotal?: number;
}

/** A pricing tier row (from Caspio Pricing_Tiers via /api/pricing-bundle). */
export interface TierConfig {
    tierLabel: string;
    minQty: number;
    maxQty: number | null;
    marginDenominator?: number;
}

/** One fee line resolved from Service_Codes (never hardcoded). */
export interface ServiceCodePrice {
    code: string;
    label: string;
    amount: number;
    /** True when the amount came from an offline fallback — UI must warn. */
    isFallback?: boolean;
}

/**
 * The shape QuoteCartEngine.singleItemPreview resolves with — the ONE
 * pricing result all three surfaces render from (CLAUDE.md Rule 9). The
 * canonical breakdown object formalizes in roadmap 2.3.
 */
export interface PricingResult {
    unitPrice: number;
    lineTotal: number;
    tier: string;
    ltmFee?: number;
    fees?: ServiceCodePrice[];
    warnings?: string[];
    breakdown?: Record<string, unknown>;
}

/**
 * The per-method adapter each builder implements for QuoteBuilderBase
 * (roadmap 0.4). Method-specific pricing/location/logo lives behind this
 * interface; everything else is base behavior.
 */
export interface MethodAdapter {
    /** 'emb' | 'scp' | 'dtf' */
    readonly method: string;
    getPricingService(): unknown;
    getTierConfig(): TierConfig[] | Promise<TierConfig[]>;
    getLocationModel(): unknown;
    /** Qty nudge thresholds, e.g. EMB [8,24,48,72]. */
    getNudgeTiers(): number[];
    renderMethodSpecificRow(item: QuoteItem, rowEl: HTMLElement): void;
}
