// Order Form — ShopWorks part-number size suffix.
//
// Single source of truth for how a base style code (e.g. "PC61") maps to the
// per-size ShopWorks part number (e.g. "PC61_2X"). Loaded by both the order
// form (browser, via <script>) and server.js (Node, via require) so the
// frontend's breakdown row + the backend's MO push always agree.
//
// Mapping verified against the 15,152-row ShopWorks product CSV
// (2026-04, captured during the v1 order form ship). Do NOT edit without
// re-verifying — this controls how line items route in ShopWorks.
//
//   2XL / XXL  → _2X            (short form; covers 2,123 unisex products)
//   XS, 3XL, 4XL, 5XL, 6XL, 7XL → _<size>  (full token)
//   LT, XLT, 2XLT, 3XLT, 4XLT   → _<size>  (tall variants)
//   OSFA                        → _OSFA
//   YS, YM, YL, YXL             → _<size>  (youth)
//   S, M, L, XL                 → no suffix (base SKU)
//
// Lowercase / mixed-case sizes are upcased before lookup. Empty sizes return
// the base unchanged. The function is stateless and safe to call repeatedly.

(function () {
  // Standard sizes that map to the base SKU with no suffix.
  const BASE_SKU_SIZES = new Set(['S', 'M', 'L', 'XL']);
  // Sizes that map to a literal `_<size>` suffix (verified against the CSV).
  const LITERAL_SUFFIX_SIZES = new Set([
    'XS', '3XL', '4XL', '5XL', '6XL', '7XL',
    'LT', 'XLT', '2XLT', '3XLT', '4XLT',
    'OSFA',
    'YS', 'YM', 'YL', 'YXL',
  ]);

  function orderFormSizeSuffix(partNumber, size) {
    if (!partNumber || !size) return partNumber || '';
    const base = String(partNumber).trim();
    const s = String(size).trim().toUpperCase();
    if (BASE_SKU_SIZES.has(s)) return base;             // S, M, L, XL → base SKU
    if (s === '2XL' || s === 'XXL') return `${base}_2X`;
    if (LITERAL_SUFFIX_SIZES.has(s)) return `${base}_${s}`;
    // Fitted / custom sizes (NE1000 S/M, M/L, L/XL · fitted exact 7 1/8 ·
    // hat sizes 6 7/8 etc.) — sanitize: replace runs of slash/space with a
    // single underscore. The breakdown row in the order form surfaces the
    // exact PN being pushed so anomalies are easy to spot. If ShopWorks
    // uses a different convention for any of these, change this fallback.
    const sanitized = s.replace(/[\s\/\\\-]+/g, '_').replace(/^_+|_+$/g, '');
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
