/**
 * Sticker Pricing Service
 *
 * Mirrors the static pricing table at /calculators/sticker-manual-pricing.html.
 * Tries `/api/sticker-pricing` first; falls back to the inline pricing grid
 * below when the endpoint isn't deployed yet (Caspio table migration is a
 * separate task — see /memory/order-form-plan.md "NEW Caspio tables required").
 *
 * Once `Sticker_Pricing` (Caspio) and the backend route are live, the inline
 * fallback can be deleted with no other code changes — the order-form module
 * uses fetchPricingData() exclusively.
 */

class StickerPricingService {
    constructor() {
        this.baseURL = window.APP_CONFIG?.API?.BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.cachePrefix = 'stickerPricingData';
        this.cacheDuration = 60 * 60 * 1000; // 1h — prices don't change often
    }

    // --- Inline fallback grid ----------------------------------------------
    // Source: /calculators/sticker-manual-pricing.html (verified 2026-01).
    // KEEP IN SYNC with caspio-pricing-proxy/src/routes/sticker-pricing.js INLINE_GRID.
    // PartNumber follows STK-{SIZE}-{QTY} (e.g. STK-3X3-1000). 6x6 row added 2026-05-15
    // (extrapolated from 3x3/4x4/5x5 curve; qty=10000 capped at $12,000).
    static INLINE_GRID = [
        { PartNumber: 'STK-2X2-50',    Size: '2x2', Quantity: 50,    TotalPrice: 87.00,    PricePerSticker: 1.74 },
        { PartNumber: 'STK-2X2-100',   Size: '2x2', Quantity: 100,   TotalPrice: 104.00,   PricePerSticker: 1.04 },
        { PartNumber: 'STK-2X2-200',   Size: '2x2', Quantity: 200,   TotalPrice: 140.00,   PricePerSticker: 0.70, IsBestValue: true },
        { PartNumber: 'STK-2X2-300',   Size: '2x2', Quantity: 300,   TotalPrice: 186.00,   PricePerSticker: 0.62 },
        { PartNumber: 'STK-2X2-500',   Size: '2x2', Quantity: 500,   TotalPrice: 234.00,   PricePerSticker: 0.47 },
        { PartNumber: 'STK-2X2-1000',  Size: '2x2', Quantity: 1000,  TotalPrice: 408.00,   PricePerSticker: 0.41 },
        { PartNumber: 'STK-2X2-2000',  Size: '2x2', Quantity: 2000,  TotalPrice: 654.00,   PricePerSticker: 0.33 },
        { PartNumber: 'STK-2X2-3000',  Size: '2x2', Quantity: 3000,  TotalPrice: 874.00,   PricePerSticker: 0.29 },
        { PartNumber: 'STK-2X2-5000',  Size: '2x2', Quantity: 5000,  TotalPrice: 1275.00,  PricePerSticker: 0.26 },
        { PartNumber: 'STK-2X2-10000', Size: '2x2', Quantity: 10000, TotalPrice: 2158.00,  PricePerSticker: 0.22 },
        { PartNumber: 'STK-3X3-50',    Size: '3x3', Quantity: 50,    TotalPrice: 98.00,    PricePerSticker: 1.96 },  // 2026-05-29: was 128.00/2.56 (cost more than 100-qty)
        { PartNumber: 'STK-3X3-100',   Size: '3x3', Quantity: 100,   TotalPrice: 124.00,   PricePerSticker: 1.24 },
        { PartNumber: 'STK-3X3-200',   Size: '3x3', Quantity: 200,   TotalPrice: 234.00,   PricePerSticker: 1.17, IsBestValue: true },
        { PartNumber: 'STK-3X3-300',   Size: '3x3', Quantity: 300,   TotalPrice: 296.00,   PricePerSticker: 0.99 },
        { PartNumber: 'STK-3X3-500',   Size: '3x3', Quantity: 500,   TotalPrice: 406.00,   PricePerSticker: 0.81 },
        { PartNumber: 'STK-3X3-1000',  Size: '3x3', Quantity: 1000,  TotalPrice: 656.00,   PricePerSticker: 0.66 },
        { PartNumber: 'STK-3X3-2000',  Size: '3x3', Quantity: 2000,  TotalPrice: 1089.00,  PricePerSticker: 0.54 },
        { PartNumber: 'STK-3X3-3000',  Size: '3x3', Quantity: 3000,  TotalPrice: 1482.00,  PricePerSticker: 0.49 },
        { PartNumber: 'STK-3X3-5000',  Size: '3x3', Quantity: 5000,  TotalPrice: 2199.00,  PricePerSticker: 0.44 },
        { PartNumber: 'STK-3X3-10000', Size: '3x3', Quantity: 10000, TotalPrice: 3790.00,  PricePerSticker: 0.38 },
        { PartNumber: 'STK-4X4-50',    Size: '4x4', Quantity: 50,    TotalPrice: 153.00,   PricePerSticker: 3.06 },
        { PartNumber: 'STK-4X4-100',   Size: '4x4', Quantity: 100,   TotalPrice: 212.00,   PricePerSticker: 2.12 },
        { PartNumber: 'STK-4X4-200',   Size: '4x4', Quantity: 200,   TotalPrice: 294.00,   PricePerSticker: 1.47, IsBestValue: true },
        { PartNumber: 'STK-4X4-300',   Size: '4x4', Quantity: 300,   TotalPrice: 378.00,   PricePerSticker: 1.26 },
        { PartNumber: 'STK-4X4-500',   Size: '4x4', Quantity: 500,   TotalPrice: 544.00,   PricePerSticker: 1.09 },
        { PartNumber: 'STK-4X4-1000',  Size: '4x4', Quantity: 1000,  TotalPrice: 962.00,   PricePerSticker: 0.96 },
        { PartNumber: 'STK-4X4-2000',  Size: '4x4', Quantity: 2000,  TotalPrice: 1630.00,  PricePerSticker: 0.82 },
        { PartNumber: 'STK-4X4-3000',  Size: '4x4', Quantity: 3000,  TotalPrice: 2236.00,  PricePerSticker: 0.75 },
        { PartNumber: 'STK-4X4-5000',  Size: '4x4', Quantity: 5000,  TotalPrice: 3346.00,  PricePerSticker: 0.67 },
        { PartNumber: 'STK-4X4-10000', Size: '4x4', Quantity: 10000, TotalPrice: 5846.00,  PricePerSticker: 0.58 },
        { PartNumber: 'STK-5X5-50',    Size: '5x5', Quantity: 50,    TotalPrice: 183.00,   PricePerSticker: 3.66 },
        { PartNumber: 'STK-5X5-100',   Size: '5x5', Quantity: 100,   TotalPrice: 266.00,   PricePerSticker: 2.66 },
        { PartNumber: 'STK-5X5-200',   Size: '5x5', Quantity: 200,   TotalPrice: 412.00,   PricePerSticker: 2.06, IsBestValue: true },
        { PartNumber: 'STK-5X5-300',   Size: '5x5', Quantity: 300,   TotalPrice: 536.00,   PricePerSticker: 1.79 },
        { PartNumber: 'STK-5X5-500',   Size: '5x5', Quantity: 500,   TotalPrice: 784.00,   PricePerSticker: 1.57 },
        { PartNumber: 'STK-5X5-1000',  Size: '5x5', Quantity: 1000,  TotalPrice: 1322.00,  PricePerSticker: 1.32 },
        { PartNumber: 'STK-5X5-2000',  Size: '5x5', Quantity: 2000,  TotalPrice: 2266.00,  PricePerSticker: 1.13 },
        { PartNumber: 'STK-5X5-3000',  Size: '5x5', Quantity: 3000,  TotalPrice: 3123.00,  PricePerSticker: 1.04 },
        { PartNumber: 'STK-5X5-5000',  Size: '5x5', Quantity: 5000,  TotalPrice: 4694.00,  PricePerSticker: 0.94 },
        { PartNumber: 'STK-5X5-10000', Size: '5x5', Quantity: 10000, TotalPrice: 8892.00,  PricePerSticker: 0.89 },
        { PartNumber: 'STK-6X6-50',    Size: '6x6', Quantity: 50,    TotalPrice: 218.00,   PricePerSticker: 4.36 },
        { PartNumber: 'STK-6X6-100',   Size: '6x6', Quantity: 100,   TotalPrice: 383.00,   PricePerSticker: 3.83 },  // 2026-05-29: was 286.00/2.86 (under-extrapolated; made 200-qty cost less/pc)
        { PartNumber: 'STK-6X6-200',   Size: '6x6', Quantity: 200,   TotalPrice: 588.00,   PricePerSticker: 2.94, IsBestValue: true },
        { PartNumber: 'STK-6X6-300',   Size: '6x6', Quantity: 300,   TotalPrice: 774.00,   PricePerSticker: 2.58 },
        { PartNumber: 'STK-6X6-500',   Size: '6x6', Quantity: 500,   TotalPrice: 1125.00,  PricePerSticker: 2.25 },
        { PartNumber: 'STK-6X6-1000',  Size: '6x6', Quantity: 1000,  TotalPrice: 1740.00,  PricePerSticker: 1.74 },
        { PartNumber: 'STK-6X6-2000',  Size: '6x6', Quantity: 2000,  TotalPrice: 2940.00,  PricePerSticker: 1.47 },
        { PartNumber: 'STK-6X6-3000',  Size: '6x6', Quantity: 3000,  TotalPrice: 4080.00,  PricePerSticker: 1.36 },
        { PartNumber: 'STK-6X6-5000',  Size: '6x6', Quantity: 5000,  TotalPrice: 6250.00,  PricePerSticker: 1.25 },
        { PartNumber: 'STK-6X6-10000', Size: '6x6', Quantity: 10000, TotalPrice: 12000.00, PricePerSticker: 1.20 },
    ];

    static SETUP_FEE = 50.00;  // one-time digitizing/artwork fee for new designs (PartNumber GRT-50)

    /**
     * Fetch the full grid. Returns { grid: [...rows], setupFee }.
     * Tries the API first; falls back to the inline grid on 404 / network err.
     */
    async fetchPricingData(_unusedStyle, _options) {
        const cacheKey = `${this.cachePrefix}-grid`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        let grid = null;
        try {
            const r = await fetch(`${this.baseURL}/api/sticker-pricing`);
            if (r.ok) {
                const data = await r.json();
                if (Array.isArray(data?.grid) && data.grid.length) grid = data.grid;
            }
        } catch (_) { /* network error → fallback */ }
        if (!grid) {
            grid = StickerPricingService.INLINE_GRID;
        }
        const result = { grid, setupFee: StickerPricingService.SETUP_FEE, source: grid === StickerPricingService.INLINE_GRID ? 'inline' : 'api' };
        this._saveToCache(cacheKey, result);
        return result;
    }

    /**
     * Look up unit price for a given (size, qty). Quantity rounds DOWN to the
     * nearest published tier (e.g. 250 → 200). Below the minimum tier (50)
     * uses the 50-qty price as the floor.
     *
     * IMPORTANT: when qty matches a published tier exactly, return
     * TotalPrice / qty (full precision) — NOT the published PricePerSticker,
     * which is truncated to 2 decimals and would lose pennies on the order
     * total. e.g. 4x4 × 1000 → published per-sticker $0.96 (truncated from
     * $0.962); the order total $962.00 only reconciles when we use the
     * TotalPrice ratio.
     */
    pricePerSticker(grid, size, qty) {
        const rows = (grid || []).filter(r => r.Size === size).sort((a, b) => a.Quantity - b.Quantity);
        if (rows.length === 0) return null;
        if (qty < rows[0].Quantity) return rows[0].TotalPrice / rows[0].Quantity;
        let match = rows[0];
        for (const r of rows) {
            if (r.Quantity <= qty) match = r;
            else break;
        }
        // Exact-tier match → use TotalPrice / Quantity for full precision.
        // Off-tier (e.g. qty 750 → match 500) → also use the matched tier's
        // ratio so the order total tracks cleanly to a published total.
        return match.TotalPrice / match.Quantity;
    }

    _getFromCache(key) {
        try {
            const raw = sessionStorage.getItem(key);
            if (!raw) return null;
            const obj = JSON.parse(raw);
            if (Date.now() - obj.t > this.cacheDuration) return null;
            return obj.v;
        } catch (_) { return null; }
    }
    _saveToCache(key, value) {
        try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value })); }
        catch (_) {}
    }
}

window.StickerPricingService = StickerPricingService;
