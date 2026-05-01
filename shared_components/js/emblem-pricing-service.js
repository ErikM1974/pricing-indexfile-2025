/**
 * Emblem (Embroidered Patch) Pricing Service
 *
 * Mirrors the calculator at /calculators/embroidered-emblem/index.html.
 * Tries `/api/emblem-pricing` first; falls back to the inline grid below
 * when the endpoint isn't deployed yet (Caspio table migration is a
 * separate task — see /memory/order-form-plan.md).
 *
 * Pricing model:
 *   sizeKey = (width + height) / 2  → mapped up to nearest tier in 1.0-12.0
 *   qtyTier index by minimum: [25,50,100,200,300,500,1000,2000,5000,10000]
 *   basePrice = grid[sizeKey][qtyIndex]
 *   addOns: metallic +25%, velcro +25%, extraColors × 10%
 *   ltmPP = (qty < 200) ? 50/qty : 0
 *   unit = basePrice + (basePrice × addOnPct) + ltmPP
 *   orderTotal = unit × qty + (newDesign ? 100 : 0)
 */

class EmblemPricingService {
    constructor() {
        this.baseURL = window.APP_CONFIG?.API?.BASE_URL || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
        this.cachePrefix = 'emblemPricingData';
        this.cacheDuration = 60 * 60 * 1000;
    }

    // Inline base-price grid (keyed by size string, then qty-index 0-9).
    // Source: calculators/embroidered-emblem/emblem-calculator.js:20-37 (verified 2026-01).
    static INLINE_GRID = {
        '1.00': [2.20, 1.91, 1.41, 1.01, 0.86, 0.74, 0.65, 0.59, 0.54, 0.49],
        '1.50': [2.77, 2.41, 1.78, 1.27, 1.09, 0.93, 0.82, 0.74, 0.68, 0.61],
        '2.00': [3.87, 3.37, 2.49, 1.78, 1.52, 1.30, 1.14, 1.03, 0.95, 0.86],
        '2.50': [4.97, 4.32, 3.19, 2.29, 1.95, 1.67, 1.47, 1.33, 1.21, 1.10],
        '3.00': [6.07, 5.28, 3.90, 2.79, 2.38, 2.03, 1.79, 1.62, 1.48, 1.34],
        '3.50': [7.17, 6.23, 4.60, 3.30, 2.81, 2.40, 2.12, 1.91, 1.75, 1.59],
        '4.00': [8.28, 7.19, 5.31, 3.81, 3.24, 2.77, 2.44, 2.21, 2.02, 1.83],
        '4.50': [9.38, 8.15, 6.02, 4.31, 3.67, 3.14, 2.77, 2.50, 2.29, 2.08],
        '5.00': [10.48, 9.10, 6.72, 4.82, 4.10, 3.51, 3.09, 2.80, 2.56, 2.32],
        '6.00': [12.13, 10.54, 7.78, 5.58, 4.75, 4.06, 3.58, 3.24, 2.96, 2.69],
        '7.00': [14.33, 12.45, 9.19, 6.59, 5.61, 4.80, 4.23, 3.82, 3.50, 3.17],
        '8.00': [16.53, 14.36, 10.61, 7.60, 6.48, 5.54, 4.88, 4.41, 4.04, 3.66],
        '9.00': [18.73, 16.27, 12.02, 8.62, 7.34, 6.28, 5.53, 5.00, 4.57, 4.15],
        '10.00': [20.93, 18.19, 13.43, 9.63, 8.20, 7.01, 6.18, 5.59, 5.11, 4.64],
        '11.00': [23.13, 20.10, 14.84, 10.64, 9.06, 7.75, 6.83, 6.17, 5.65, 5.12],
        '12.00': [25.34, 22.01, 16.26, 11.65, 9.93, 8.49, 7.48, 6.76, 6.19, 5.61],
    };

    static QTY_TIERS = [25, 50, 100, 200, 300, 500, 1000, 2000, 5000, 10000];

    static RULES = {
        LTM_Fee:           50.00,
        LTM_Threshold:     200,    // qty < this triggers LTM
        Digitizing_Fee:    100.00,
        Metallic_Pct:      0.25,
        Velcro_Pct:        0.25,
        Extra_Color_Pct:   0.10,
    };

    async fetchPricingData(_unusedStyle, _options) {
        const cacheKey = `${this.cachePrefix}-grid`;
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;

        let grid = null, rules = null;
        try {
            const r = await fetch(`${this.baseURL}/api/emblem-pricing`);
            if (r.ok) {
                const data = await r.json();
                if (data?.grid && Object.keys(data.grid).length) grid = data.grid;
                if (data?.rules) rules = data.rules;
            }
        } catch (_) { /* network error → fallback */ }
        if (!grid) grid = EmblemPricingService.INLINE_GRID;
        if (!rules) rules = EmblemPricingService.RULES;
        const result = {
            grid,
            rules,
            qtyTiers: EmblemPricingService.QTY_TIERS,
            source: grid === EmblemPricingService.INLINE_GRID ? 'inline' : 'api',
        };
        this._saveToCache(cacheKey, result);
        return result;
    }

    /**
     * Resolve size tier key from width/height inches.
     * Matches emblem-calculator.js: avg = (w+h)/2, find smallest tier >= avg.
     */
    sizeKeyFor(width, height) {
        const avg = (Number(width) + Number(height)) / 2;
        const keys = Object.keys(EmblemPricingService.INLINE_GRID).map(parseFloat).sort((a, b) => a - b);
        const found = keys.find(k => avg <= k);
        return (found ?? keys[keys.length - 1]).toFixed(2);
    }

    qtyIndexFor(qty) {
        const t = EmblemPricingService.QTY_TIERS;
        for (let i = t.length - 1; i >= 0; i--) {
            if (qty >= t[i]) return i;
        }
        return 0; // below 25 → use the 25-qty price (caller should warn)
    }

    /**
     * Compute per-emblem unit price + breakdown for given dimensions, qty, and add-ons.
     */
    calculateUnit({ grid, rules, width, height, qty, metallicThread, velcroBacking, extraColors }) {
        if (qty <= 0) return null;
        const sizeKey = this.sizeKeyFor(width, height);
        const qtyIdx = this.qtyIndexFor(qty);
        const row = grid[sizeKey];
        if (!row || row[qtyIdx] == null) return null;
        const basePrice = Number(row[qtyIdx]);

        const r = rules || EmblemPricingService.RULES;
        let addOnPct = 0;
        if (metallicThread) addOnPct += r.Metallic_Pct ?? 0.25;
        if (velcroBacking)  addOnPct += r.Velcro_Pct ?? 0.25;
        const ec = Math.max(0, Number(extraColors) || 0);
        addOnPct += ec * (r.Extra_Color_Pct ?? 0.10);
        const addOnCost = basePrice * addOnPct;

        const ltmThreshold = r.LTM_Threshold ?? 200;
        const ltmFee       = r.LTM_Fee ?? 50;
        const ltmPP = (qty < ltmThreshold && qty > 0) ? (ltmFee / qty) : 0;

        const unit = basePrice + addOnCost + ltmPP;
        return {
            sizeKey, qtyIdx, basePrice, addOnPct, addOnCost, ltmPP,
            unit,
            qtyMin: EmblemPricingService.QTY_TIERS[qtyIdx],
        };
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

window.EmblemPricingService = EmblemPricingService;
