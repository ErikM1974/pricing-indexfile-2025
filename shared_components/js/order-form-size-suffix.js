// Order Form — ShopWorks part-number size suffix.
//
// Single source of truth for how a base style code (e.g. "PC61") maps to the
// per-size ShopWorks part number (e.g. "PC61_2X"). Loaded by both the order
// form (browser, via <script>) and server.js (Node, via require) so the
// frontend's breakdown row + the SanMar inventory check always agree.
//
// **Where this is used:**
//   - Frontend breakdown row preview — show the rep what SKU will land in MO
//   - SanMar inventory check (ManageOrders /inventorylevels) — needs suffixed PN
//   - Inventory fan-out for extended sizes (PC61 + PC61_2X + PC61_3X + ...)
//   NOT used for MO PUSH — server.js sends the BASE part number + plain size
//   and ShopWorks's Size Translation Table appends the per-style modifier.
//
// **Suffix format = ManageOrders inventory database convention** (verified
// 2026-05-01 against /api/manageorders/inventorylevels):
//   - PC61_2X (NOT PC61_2XL) — inventory DB uses SHORT form for 2XL+
//   - PC61_3X, PC61_4X, PC61_5X — same short pattern
//   - PC61Y_XS, 112_OSFA — full token for these
//   - NE1000_S/M, NE1000_L/XL — slash preserved literally
//
// **NOTE on the SanMar Integration Pricelist file** (`Sanmar Integration Only
// Pricelist - 04-07-26.xlsx`, 14,775 SKUs): that file lists products as
// `PC61_2XL`, `PC61_3XL`, etc. (full uppercase). However the live
// ManageOrders inventory database uses short form (`PC61_2X`, `PC61_3X`).
// We match the inventory DB because that's what we query — if ShopWorks's
// Size Translation Table on the order-form integration produces `_2XL`
// instead, the breakdown-row preview will mismatch but the order itself
// will still land correctly (server.js sends base PN + plain size; the
// translation table handles the suffix on its side).
//
// Mapping (matches inventory DB):
//   S, M, L, XL                    → no suffix (base SKU)
//   2XL / XXL                      → _2X
//   3XL                            → _3X
//   4XL                            → _4X
//   5XL                            → _5X
//   6XL                            → _6X
//   7XL                            → _7X
//   XS                             → _XS
//   2XS, XXS                       → _2XS, _XXS  (extended-small ladies/junior)
//   LT, XLT, 2XLT, 3XLT, 4XLT      → _<size>  (tall variants — TLJ754 etc.)
//   OSFA                           → _OSFA
//   YS, YM, YL, YXL                → _<size>  (youth)
//   S/M, M/L, L/XL, 2/3X           → _<size>  (caps fitted — slash preserved)
//   3232, 3434, etc.               → _<size>  (W×L pant numeric — passthrough)
//
// Lowercase / mixed-case sizes are upcased before lookup. Empty sizes return
// the base unchanged. The function is stateless and safe to call repeatedly.

(function () {
  // Standard sizes that map to the base SKU with no suffix.
  const BASE_SKU_SIZES = new Set(['S', 'M', 'L', 'XL']);
  // 2XL/XXL collapse to short form `_2X` to match the ManageOrders inventory
  // database. (XXL exists for ladies styles but the inventory DB still
  // accepts the short form.)
  const SHORT_FORM_2XL = new Set(['2XL', 'XXL']);
  // Sizes that map to a literal `_<size>` suffix.
  const LITERAL_SUFFIX_SIZES = new Set([
    'XS', '3XL', '4XL', '5XL', '6XL', '7XL',
    '2XS', 'XXS',
    'LT', 'XLT', '2XLT', '3XLT', '4XLT',
    'OSFA',
    'YS', 'YM', 'YL', 'YXL',
    'S/M', 'M/L', 'L/XL', '2/3X',  // caps fitted — slash is part of the SKU
  ]);
  // Inventory DB uses short form for extended sizes too: 3XL → _3X, 4XL → _4X.
  const SHORTEN_TO_X = new Set(['3XL', '4XL', '5XL', '6XL', '7XL']);

  function orderFormSizeSuffix(partNumber, size) {
    if (!partNumber || !size) return partNumber || '';
    const base = String(partNumber).trim();
    const s = String(size).trim().toUpperCase();
    if (BASE_SKU_SIZES.has(s)) return base;             // S, M, L, XL → base SKU
    if (SHORT_FORM_2XL.has(s)) return `${base}_2X`;     // 2XL/XXL → _2X
    if (SHORTEN_TO_X.has(s)) return `${base}_${s.replace('XL', 'X')}`;  // 3XL→_3X, etc.
    if (LITERAL_SUFFIX_SIZES.has(s)) return `${base}_${s}`;
    // Pants W×L numeric (3232, 3434, etc.) — pass through.
    if (/^\d{4}$/.test(s)) return `${base}_${s}`;
    // Fallback for unrecognized sizes (junior fitted exact 7-1/8, hat sizes
    // like "6 7/8", or anything we missed): collapse internal whitespace
    // only — preserve slashes since most slash-bearing SKUs are kept literal.
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
