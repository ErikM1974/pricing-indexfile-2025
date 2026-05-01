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
    // Each row: [Size, Quantity, TotalPrice, PricePerSticker].
    static INLINE_GRID = [
        // 2x2
        { Size: '2x2', Quantity: 50,    TotalPrice: 87.00,   PricePerSticker: 1.74 },
        { Size: '2x2', Quantity: 100,   TotalPrice: 104.00,  PricePerSticker: 1.04 },
        { Size: '2x2', Quantity: 200,   TotalPrice: 140.00,  PricePerSticker: 0.70, IsBestValue: true },
        { Size: '2x2', Quantity: 300,   TotalPrice: 186.00,  PricePerSticker: 0.62 },
        { Size: '2x2', Quantity: 500,   TotalPrice: 234.00,  PricePerSticker: 0.47 },
        { Size: '2x2', Quantity: 1000,  TotalPrice: 408.00,  PricePerSticker: 0.41 },
        { Size: '2x2', Quantity: 2000,  TotalPrice: 654.00,  PricePerSticker: 0.33 },
        { Size: '2x2', Quantity: 3000,  TotalPrice: 874.00,  PricePerSticker: 0.29 },
        { Size: '2x2', Quantity: 5000,  TotalPrice: 1275.00, PricePerSticker: 0.26 },
        { Size: '2x2', Quantity: 10000, TotalPrice: 2158.00, PricePerSticker: 0.22 },
        // 3x3
        { Size: '3x3', Quantity: 50,    TotalPrice: 128.00,  PricePerSticker: 2.56 },
        { Size: '3x3', Quantity: 100,   TotalPrice: 124.00,  PricePerSticker: 1.24 },
        { Size: '3x3', Quantity: 200,   TotalPrice: 234.00,  PricePerSticker: 1.17, IsBestValue: true },
        { Size: '3x3', Quantity: 300,   TotalPrice: 296.00,  PricePerSticker: 0.99 },
        { Size: '3x3', Quantity: 500,   TotalPrice: 406.00,  PricePerSticker: 0.81 },
        { Size: '3x3', Quantity: 1000,  TotalPrice: 656.00,  PricePerSticker: 0.66 },
        { Size: '3x3', Quantity: 2000,  TotalPrice: 1089.00, PricePerSticker: 0.54 },
        { Size: '3x3', Quantity: 3000,  TotalPrice: 1482.00, PricePerSticker: 0.49 },
        { Size: '3x3', Quantity: 5000,  TotalPrice: 2199.00, PricePerSticker: 0.44 },
        { Size: '3x3', Quantity: 10000, TotalPrice: 3790.00, PricePerSticker: 0.38 },
        // 4x4
        { Size: '4x4', Quantity: 50,    TotalPrice: 153.00,  PricePerSticker: 3.06 },
        { Size: '4x4', Quantity: 100,   TotalPrice: 212.00,  PricePerSticker: 2.12 },
        { Size: '4x4', Quantity: 200,   TotalPrice: 294.00,  PricePerSticker: 1.47, IsBestValue: true },
        { Size: '4x4', Quantity: 300,   TotalPrice: 378.00,  PricePerSticker: 1.26 },
        { Size: '4x4', Quantity: 500,   TotalPrice: 544.00,  PricePerSticker: 1.09 },
        { Size: '4x4', Quantity: 1000,  TotalPrice: 962.00,  PricePerSticker: 0.96 },
        { Size: '4x4', Quantity: 2000,  TotalPrice: 1630.00, PricePerSticker: 0.82 },
        { Size: '4x4', Quantity: 3000,  TotalPrice: 2236.00, PricePerSticker: 0.75 },
        { Size: '4x4', Quantity: 5000,  TotalPrice: 3346.00, PricePerSticker: 0.67 },
        { Size: '4x4', Quantity: 10000, TotalPrice: 5846.00, PricePerSticker: 0.58 },
        // 5x5
        { Size: '5x5', Quantity: 50,    TotalPrice: 183.00,  PricePerSticker: 3.66 },
        { Size: '5x5', Quantity: 100,   TotalPrice: 266.00,  PricePerSticker: 2.66 },
        { Size: '5x5', Quantity: 200,   TotalPrice: 412.00,  PricePerSticker: 2.06, IsBestValue: true },
        { Size: '5x5', Quantity: 300,   TotalPrice: 536.00,  PricePerSticker: 1.79 },
        { Size: '5x5', Quantity: 500,   TotalPrice: 784.00,  PricePerSticker: 1.57 },
        { Size: '5x5', Quantity: 1000,  TotalPrice: 1322.00, PricePerSticker: 1.32 },
        { Size: '5x5', Quantity: 2000,  TotalPrice: 2266.00, PricePerSticker: 1.13 },
        { Size: '5x5', Quantity: 3000,  TotalPrice: 3123.00, PricePerSticker: 1.04 },
        { Size: '5x5', Quantity: 5000,  TotalPrice: 4694.00, PricePerSticker: 0.94 },
        { Size: '5x5', Quantity: 10000, TotalPrice: 8892.00, PricePerSticker: 0.89 },
    ];

    static SETUP_FEE = 50.00;  // one-time digitizing/artwork fee for new designs

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
