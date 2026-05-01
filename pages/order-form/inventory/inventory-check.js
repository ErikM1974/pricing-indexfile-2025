// Order Form — SanMar inventory check.
//
// Wraps ManageOrdersInventoryService with the order-form's specific needs:
//   1. Multi-SKU fan-out — base PN gives Size01-06 = XS-2XL; extended sizes
//      (3XL/4XL/OSFA/fitted/W×L) need separate queries with the suffixed PN.
//      Each suffixed PN has a single size, so its `totalStock` IS that size's
//      inventory regardless of which Size0N column it occupies in ShopWorks.
//   2. Color resolution — endpoint requires CATALOG_COLOR. We trust the
//      row's `catalogColor` first, fall back to `colorName`, treat both
//      missing as "unknown" (graceful — no badge, no block).
//   3. Result shape: { bySize: { 'S': 3229, '2XL': 145, 'OSFA': 12, '?'.. },
//      cacheAge, status: 'ok' | 'unknown' | 'error' }.
//
// Caching: leverages the service's built-in 5-min Map cache per
// (partNumber, color) — same fan-out across many rows costs nothing after
// the first.

(function () {
  let _svc = null;
  function svc() {
    if (!_svc) _svc = new window.ManageOrdersInventoryService();
    return _svc;
  }

  // Sizes the BASE PN's Size01-06 mapping covers natively.
  const BASE_PN_SIZES = new Set(['XS', 'S', 'M', 'L', 'XL', '2XL']);

  /**
   * Fetch per-size inventory for a row.
   * @param {string} style - the rep-typed style (e.g. PC61, NE1000, 112)
   * @param {string} catalogColor - SanMar API color value (e.g. AthMar)
   * @param {string[]} sizesNeeded - which sizes the form has columns for
   * @returns {Promise<{ bySize: Object, cacheAge: string, status: string }>}
   */
  async function getInventoryForRow(style, catalogColor, sizesNeeded) {
    const styleU = String(style || '').trim().toUpperCase();
    const colorU = String(catalogColor || '').trim();
    const sizes = (sizesNeeded || []).map(s => String(s).toUpperCase());
    if (!styleU || !colorU || !sizes.length) {
      return { bySize: {}, cacheAge: '', status: 'unknown' };
    }

    const bySize = {};
    let cacheAge = '';
    let anyOk = false;
    let anyError = false;

    // Helper: assign inventory val to a size, but never overwrite a non-zero
    // value with zero (defensive against partial fetches).
    const assign = (sz, val) => {
      const n = Number(val) || 0;
      if (bySize[sz] == null) bySize[sz] = n;
      else if (n > 0) bySize[sz] = n;
    };

    // 1) Base PN — gives XS/S/M/L/XL/2XL via the service's hard-coded
    //    Size01-06 mapping. Only fetch if the row needs any of those sizes.
    const wantsBaseSizes = sizes.some(s => BASE_PN_SIZES.has(s));
    if (wantsBaseSizes) {
      try {
        const base = await svc().checkInventory(styleU, colorU);
        if (base?.sizeBreakdown) {
          anyOk = true;
          if (base.cacheAge) cacheAge = base.cacheAge;
          Object.entries(base.sizeBreakdown).forEach(([sz, n]) => {
            if (sizes.includes(sz)) assign(sz, n);
          });
        }
      } catch (e) {
        anyError = true;
      }
    }

    // 2) Extended / non-standard sizes — query each suffixed PN. The
    //    suffixed PN has a single size variant, so its `totalStock` IS the
    //    inventory for that size (regardless of which Size0N slot ShopWorks
    //    uses internally for that PN).
    const extras = sizes.filter(s => !BASE_PN_SIZES.has(s));
    if (extras.length > 0) {
      const suffixFn = window.orderFormSizeSuffix || ((p, s) => `${p}_${s}`);
      const fanOut = extras.map(async (sz) => {
        const pn = suffixFn(styleU, sz);
        if (pn === styleU) return; // S/M/L/XL go to base; no suffix produced
        try {
          const r = await svc().checkInventory(pn, colorU);
          if (r?.sizeBreakdown != null || r?.totalStock != null) {
            anyOk = true;
            if (r.cacheAge && !cacheAge) cacheAge = r.cacheAge;
            assign(sz, r.totalStock);
          }
        } catch (e) { anyError = true; }
      });
      await Promise.all(fanOut);
    }

    // Status:
    //   ok      — at least one query succeeded and we have data for some sizes
    //   unknown — no data found / nothing to query — graceful: no badges, no block
    //   error   — all queries failed (e.g. network down) — graceful too
    let status = 'unknown';
    if (anyOk) status = 'ok';
    else if (anyError) status = 'error';

    return { bySize, cacheAge, status };
  }

  // Render-friendly classifier — returns 'good' | 'low' | 'over' | 'oos' | 'unknown'.
  function classifyInventory(qty, available) {
    const q = Number(qty) || 0;
    const a = Number(available);
    if (!Number.isFinite(a)) return 'unknown';
    if (a === 0) return 'oos';
    if (q > a) return 'over';
    if (q > 0 && q > a * 0.8) return 'low';
    return 'good';
  }

  window.OrderFormInventory = { getInventoryForRow, classifyInventory };
})();
