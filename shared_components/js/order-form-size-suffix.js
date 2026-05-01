// Order Form — ShopWorks part-number size suffix.
//
// Single source of truth for how a base style code (e.g. "PC61") maps to the
// per-size ShopWorks part number (e.g. "PC61_2XL"). Loaded by both the order
// form (browser, via <script>) and server.js (Node, via require) so the
// frontend's breakdown row + the backend's inventory check always agree.
//
// **Where this is used (after 2026-05-01 fix):**
//   - Frontend breakdown row preview — show the rep what SKU will land in MO
//   - SanMar inventory check (ManageOrders /inventorylevels) — needs suffixed PN
//   - Inventory fan-out for extended sizes (PC61 + PC61_2XL + PC61_3XL + ...)
//   NOT used for MO PUSH — server.js sends the BASE part number + plain size
//   and ShopWorks's Size Translation Table appends the per-style modifier.
//
// **Mapping verified against `Sanmar Integration Only Pricelist - 04-07-26.xlsx`
// (14,775-row authoritative ShopWorks integration product list, 2026-05-01).**
// Top suffix counts: _3XL (2399) · _XS (2254) · _2XL (2095) · _4XL (2090) ·
// _OSFA (768) · _XXL (556 ladies) · _5XL (170) · _6XL (101) · _LT/_XLT/etc.
// (87 each tall) · _S/M, _L/XL, _M/L (caps) · _2XS, _XXS (extended small) ·
// _3232, _3434 etc. (W×L pant numeric).
//
//   S, M, L, XL                    → no suffix (base SKU)
//   2XL                            → _2XL  (NOT _2X — verified in 2026-05-01 file)
//   XXL                            → _XXL  (used by some ladies styles instead of 2XL)
//   XS, 3XL, 4XL, 5XL, 6XL, 7XL    → _<size>
//   LT, XLT, 2XLT, 3XLT, 4XLT      → _<size>  (tall variants — TLJ754 etc.)
//   OSFA                           → _OSFA
//   YS, YM, YL, YXL                → _<size>  (youth)
//   2XS, XXS                       → _<size>  (extended-small ladies/junior)
//   S/M, M/L, L/XL, 2/3X           → _<size>  (caps fitted — slash preserved)
//   3232, 3434, etc.               → _<size>  (W×L pant numeric — passthrough)
//
// **KNOWN LIMITATION**: Ladies styles (L500, L420, etc. — 556 SKUs) use
// `_XXL` for 2XL in ShopWorks, but the form's standard size grid uses `2XL`
// as a fixed column header. Calling `orderFormSizeSuffix('L500', '2XL')`
// returns `L500_2XL`, which doesn't match SanMar's `L500_XXL`. This causes
// inventory misses + display mismatch ON LADIES STYLES ONLY. The MO push is
// unaffected (sends base PN; ShopWorks resolves per-product). To fully fix,
// the form would need to detect ladies styles from the Caspio bundle and
// either rename the column to `XXL` for that row OR add a per-style override
// here. Tracked as a v2 follow-up.
//
// Lowercase / mixed-case sizes are upcased before lookup. Empty sizes return
// the base unchanged. The function is stateless and safe to call repeatedly.

(function () {
  // Standard sizes that map to the base SKU with no suffix.
  const BASE_SKU_SIZES = new Set(['S', 'M', 'L', 'XL']);
  // Sizes that map to a literal `_<size>` suffix (verified against the
  // 2026-05-01 SanMar Integration Only Pricelist).
  const LITERAL_SUFFIX_SIZES = new Set([
    'XS', '2XL', 'XXL', '3XL', '4XL', '5XL', '6XL', '7XL',
    '2XS', 'XXS',
    'LT', 'XLT', '2XLT', '3XLT', '4XLT',
    'OSFA',
    'YS', 'YM', 'YL', 'YXL',
    'S/M', 'M/L', 'L/XL', '2/3X',  // caps fitted — slash is part of the SKU
  ]);

  function orderFormSizeSuffix(partNumber, size) {
    if (!partNumber || !size) return partNumber || '';
    const base = String(partNumber).trim();
    const s = String(size).trim().toUpperCase();
    if (BASE_SKU_SIZES.has(s)) return base;             // S, M, L, XL → base SKU
    if (LITERAL_SUFFIX_SIZES.has(s)) return `${base}_${s}`;
    // Pants W×L numeric (3232, 3434, etc.) — pass through. The integration
    // file lists 71 of these for PT20 alone; they're already formatted right.
    if (/^\d{4}$/.test(s)) return `${base}_${s}`;
    // Fallback for unrecognized sizes (junior fitted exact 7-1/8, hat sizes
    // like "6 7/8", or anything we missed): collapse internal whitespace
    // only — preserve slashes since most slash-bearing SKUs in the file
    // (S/M, L/XL, etc.) are kept literal. The breakdown row surfaces the
    // exact PN being pushed so anomalies are easy to spot.
    const sanitized = s.replace(/\s+/g, '').replace(/^_+|_+$/g, '');
    return sanitized ? `${base}_${sanitized}` : base;
  }

  // Browser: expose as a global. Node (server.js): export as a module.
  if (typeof window !== 'undefined') {
    window.orderFormSizeSuffix = orderFormSizeSuffix;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { orderFormSizeSuffix };
  }
})();
