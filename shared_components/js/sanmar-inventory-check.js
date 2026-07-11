// SanMar nationwide inventory check (window.OrderFormInventory).
//
// Shared by all 4 quote builders' per-size stock badges (EMB/SCP/DTF via
// inventory-badges.js, DTG via catalog-search.js/form-core.js). Originally
// built for the Order Form (app retired 2026-07-11, file moved here from
// pages/order-form/inventory/) — the legacy global name is kept because
// every consumer references window.OrderFormInventory.
//
// Replaces the older multi-SKU fan-out against /api/manageorders/inventorylevels
// (NWCA local warehouse, color filter silently ignored, hardcoded Size01-06
// mapping) with a single call to /api/sanmar/inventory/{style}?color=X — the
// endpoint already used by calculator-inventory.js + the product page.
//
// Why the switch (verified live 2026-05-01):
//   - The MO endpoint ignores PartColor → all colors return identical numbers.
//   - The MO endpoint Size01-06 mapping is wrong for extended PNs (Size05 of
//     PC61_2X means "2XL stock for that variant", not "XL stock").
//   - The SanMar endpoint honors color server-side, returns ALL sizes in one
//     response with REAL size labels (S, M, L, XL, 2XL, 3XL, 4XL, 5XL, 6XL,
//     XXL, S/M, L/XL, OSFA, …) — no suffix mapping needed at all.
//   - PC61 Fiery Red: MO endpoint says 0 / SanMar endpoint says 33,419. Erik's
//     test caught this discrepancy.
//
// The endpoint expects CATALOG_COLOR (e.g. "Deep Marine"), not COLOR_NAME. The
// form stores `row.catalogColor` after a color pick. Falls back to colorName
// for legacy drafts; if both empty, returns "unknown" (graceful — no badges).
//
// Caching: 5-minute Map cache keyed by `style::catalogColor` so quickly
// switching back-and-forth between two colors doesn't re-hit the API.

(function () {
  const BASE_URL = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
  const CACHE_TTL_MS = 5 * 60 * 1000;
  const cache = new Map();

  /**
   * Fetch per-size inventory for a row.
   * @param {string} style          The base style number (e.g. PC61, NE1000, 112)
   * @param {string} catalogColor   SanMar CATALOG_COLOR (e.g. "Deep Marine", "Fiery Red")
   * @param {string[]} _sizesNeeded  Ignored — endpoint returns all sizes for the color.
   *                                 Kept for backward-compat with the old wrapper signature.
   * @returns {Promise<{bySize, status, grandTotal, cacheAge}>}
   */
  async function getInventoryForRow(style, catalogColor, _sizesNeeded) {
    const styleU = String(style || '').trim().toUpperCase();
    const colorU = String(catalogColor || '').trim();
    if (!styleU || !colorU) {
      return { bySize: {}, status: 'unknown', grandTotal: 0, cacheAge: '' };
    }

    const cacheKey = `${styleU}::${colorU}`;
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.t) < CACHE_TTL_MS) {
      return cached.data;
    }

    const url = `${BASE_URL}/api/sanmar/inventory/${encodeURIComponent(styleU)}?color=${encodeURIComponent(colorU)}`;
    try {
      const r = await fetch(url);
      if (!r.ok) {
        // 404 = style/color combo doesn't exist at SanMar — gracefully unknown.
        if (r.status === 404) {
          const result = { bySize: {}, status: 'unknown', grandTotal: 0, cacheAge: '' };
          cache.set(cacheKey, { t: Date.now(), data: result });
          return result;
        }
        return { bySize: {}, status: 'error', grandTotal: 0, cacheAge: '' };
      }
      const data = await r.json();
      const bySize = {};
      (data.inventory || []).forEach(s => {
        const sz = String(s.size || '').trim();
        if (!sz) return;
        bySize[sz] = Number(s.totalQty) || 0;
      });

      // Mirror size-name aliases so the form's render code can look up either
      // name and find the data. The Caspio pricing bundle for ladies styles
      // (L500, L420, …) uses '2XL' as the size key, but the SanMar inventory
      // API for those same styles returns 'XXL'. Without this mirror, the
      // form's standard 2XL column hits an undefined bySize['2XL'] and the
      // badge never renders. Conditional — only mirrors when one key is set
      // and the other isn't, so a (hypothetical) product that genuinely
      // returns both keys with different counts won't be silently merged.
      const ALIAS_PAIRS = [['2XL', 'XXL']];
      for (const [a, b] of ALIAS_PAIRS) {
        if (bySize[a] != null && bySize[b] == null) bySize[b] = bySize[a];
        if (bySize[b] != null && bySize[a] == null) bySize[a] = bySize[b];
      }

      const result = {
        bySize,
        status: 'ok',
        grandTotal: Number(data.grandTotal) || 0,
        cacheAge: 'live',
      };
      cache.set(cacheKey, { t: Date.now(), data: result });
      return result;
    } catch (err) {
      console.warn('[OrderFormInventory] Fetch failed for', styleU, colorU, err);
      return { bySize: {}, status: 'error', grandTotal: 0, cacheAge: '' };
    }
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
