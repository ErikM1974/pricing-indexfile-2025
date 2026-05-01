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
  function orderFormSizeSuffix(partNumber, size) {
    if (!partNumber || !size) return partNumber || '';
    const base = String(partNumber).trim();
    const s = String(size).trim().toUpperCase();
    if (s === '2XL' || s === 'XXL') return `${base}_2X`;
    if (['XS','3XL','4XL','5XL','6XL','7XL','LT','XLT','2XLT','3XLT','4XLT','OSFA','YS','YM','YL','YXL'].includes(s)) {
      return `${base}_${s}`;
    }
    return base; // S, M, L, XL → base SKU
  }

  // Browser: expose as a global. Node (server.js): export as a module.
  if (typeof window !== 'undefined') {
    window.orderFormSizeSuffix = orderFormSizeSuffix;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { orderFormSizeSuffix };
  }
})();
