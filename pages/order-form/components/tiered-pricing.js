// Order Form — TIERED Add-On Price Resolver (Phase 2c, 2026-05-03).
//
// Resolves prices for the 9 TIERED services in the Service_Codes table by
// hitting the same Caspio-backed APIs the customer-facing calculators use.
// Same APIs → identical prices to the dollar (verification target in 2d).
//
// API map (all from caspio-pricing-proxy):
//   /api/al-pricing       → AL, AL-CAP, AS-Garm, AS-CAP (+ shared base/upcharge data)
//   /api/decg-pricing     → DECG, DECC, DECG-FB
//   /api/contract-pricing → CTR-Garmt, CTR-Cap (Ruthie's contract jobs)
//
// All three responses cache 5 min in-memory. They change rarely (only when
// Erik edits the Caspio tables) so a stale read for ≤ 5 min is fine.
//
// FORMULAS (verified against the live API responses 2026-05-03):
//
//   AL Garment       = al.garments.basePrices[tier] + (max(0, stitches - 8000) / 1000) × al.garments.perThousandUpcharge
//   AL Cap           = al.caps.basePrices[tier]     + (max(0, stitches - 5000) / 1000) × al.caps.perThousandUpcharge
//   AS-Garm          = (max(0, stitches - 8000) / 1000) × al.garments.perThousandUpcharge   [JUST the stitch delta]
//   AS-CAP           = (max(0, stitches - 5000) / 1000) × al.caps.perThousandUpcharge       [JUST the stitch delta]
//   DECG Garment     = decg.garments.basePrices[tier]
//   DECC Cap         = decg.caps.basePrices[tier]
//   DECG-FB          = decg.fullBack.ratesPerThousand[tier] × max(stitches, 25000) / 1000
//   CTR-Garmt        = contract.garments.perThousandRates[tier] × stitches / 1000
//   CTR-Cap          = contract.caps.perThousandRates[tier] × stitches / 1000
//
// All return per-PIECE prices. Total line value = unit × qty.

(function () {
  'use strict';

  const API_BASE = window.APP_CONFIG?.API?.BASE_URL
    || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

  const CACHE_TTL_MS = 5 * 60 * 1000;
  const _cache = {};       // { url: { ts, data } }
  const _inFlight = {};    // { url: Promise<data> }

  async function fetchCached(url) {
    const hit = _cache[url];
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;
    if (_inFlight[url]) return _inFlight[url];

    _inFlight[url] = (async () => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data = await r.json();
        _cache[url] = { ts: Date.now(), data };
        return data;
      } catch (err) {
        console.error('[OrderForm] tiered-pricing fetch failed:', url, err);
        return null;
      } finally {
        delete _inFlight[url];
      }
    })();
    return _inFlight[url];
  }

  function fetchAlPricing()       { return fetchCached(`${API_BASE}/api/al-pricing`); }
  function fetchDecgPricing()     { return fetchCached(`${API_BASE}/api/decg-pricing`); }
  function fetchContractPricing() { return fetchCached(`${API_BASE}/api/contract-pricing`); }

  /**
   * Pre-warm all three caches. Call on form load so subsequent picker clicks
   * resolve synchronously.
   */
  async function preload() {
    await Promise.all([fetchAlPricing(), fetchDecgPricing(), fetchContractPricing()]);
  }

  /**
   * Map qty → tier label per the 5-tier embroidery schema.
   *   1-7, 8-23, 24-47, 48-71, 72+
   */
  function tierForQty(qty) {
    const q = Number(qty) || 0;
    if (q <= 7) return '1-7';
    if (q <= 23) return '8-23';
    if (q <= 47) return '24-47';
    if (q <= 71) return '48-71';
    return '72+';
  }

  /**
   * Resolve a TIERED service's per-piece sell price.
   *
   * Returns null if:
   * - The relevant API hasn't been preloaded (cache cold)
   * - The tier is missing from the table
   * - The code isn't a known TIERED service
   *
   * Sync-only: caller is responsible for ensuring the cache is warm
   * (call preload() on form load). If a cold fetch is needed, the picker
   * UI shows "loading..." and re-renders when the fetch resolves.
   *
   * @param {string} code         service code (AL, AL-CAP, AS-Garm, etc.)
   * @param {Object} ctx          { tier, stitchCount, capOrFlat }
   * @returns {number|null}       per-piece price
   */
  function resolveSync(code, ctx = {}) {
    const tier = ctx.tier || tierForQty(ctx.qty || 0);
    const stitchCount = Number(ctx.stitchCount) || 8000;

    // AL family — uses /api/al-pricing
    if (code === 'AL' || code === 'AL-CAP' || code === 'AS-Garm' || code === 'AS-CAP') {
      const data = _cache[`${API_BASE}/api/al-pricing`]?.data;
      if (!data) return null;
      const isCap = (code === 'AL-CAP' || code === 'AS-CAP');
      const block = isCap ? data.caps : data.garments;
      if (!block) return null;
      const baseStitches = block.baseStitches || (isCap ? 5000 : 8000);
      const upcharge = block.perThousandUpcharge || (isCap ? 1.00 : 1.25);
      const extra = Math.max(0, stitchCount - baseStitches);
      const stitchDelta = (extra / 1000) * upcharge;

      if (code === 'AS-Garm' || code === 'AS-CAP') {
        // Just the stitch surcharge — no base logo cost.
        return Number(stitchDelta.toFixed(2));
      }
      // AL or AL-CAP — base logo + stitch delta.
      const tierBase = block.basePrices?.[tier];
      if (tierBase == null) return null;
      return Number((tierBase + stitchDelta).toFixed(2));
    }

    // DECG family — uses /api/decg-pricing
    if (code === 'DECG' || code === 'DECC' || code === 'DECG-FB') {
      const data = _cache[`${API_BASE}/api/decg-pricing`]?.data;
      if (!data) return null;
      if (code === 'DECG') {
        const v = data.garments?.basePrices?.[tier];
        return v == null ? null : Number(v);
      }
      if (code === 'DECC') {
        const v = data.caps?.basePrices?.[tier];
        return v == null ? null : Number(v);
      }
      if (code === 'DECG-FB') {
        const rate = data.fullBack?.ratesPerThousand?.[tier];
        if (rate == null) return null;
        const minStitches = data.fullBack?.minStitches || 25000;
        const billable = Math.max(stitchCount, minStitches);
        return Number((rate * billable / 1000).toFixed(2));
      }
    }

    // Contract family — uses /api/contract-pricing
    if (code === 'CTR-Garmt' || code === 'CTR-Cap') {
      const data = _cache[`${API_BASE}/api/contract-pricing`]?.data;
      if (!data) return null;
      const block = code === 'CTR-Cap' ? data.caps : data.garments;
      const rate = block?.perThousandRates?.[tier];
      if (rate == null) return null;
      return Number((rate * stitchCount / 1000).toFixed(2));
    }

    return null;
  }

  /**
   * Async variant — preloads if needed, then resolves.
   */
  async function resolve(code, ctx = {}) {
    // Preload the right endpoint based on code family.
    if (code === 'AL' || code === 'AL-CAP' || code === 'AS-Garm' || code === 'AS-CAP') {
      await fetchAlPricing();
    } else if (code === 'DECG' || code === 'DECC' || code === 'DECG-FB') {
      await fetchDecgPricing();
    } else if (code === 'CTR-Garmt' || code === 'CTR-Cap') {
      await fetchContractPricing();
    }
    return resolveSync(code, ctx);
  }

  /**
   * Get a human-readable formula label for a TIERED code (for the params
   * dialog "Auto-resolved: $X" preview).
   */
  function formulaLabel(code, ctx = {}) {
    const tier = ctx.tier || tierForQty(ctx.qty || 0);
    const stitches = Number(ctx.stitchCount) || 8000;
    switch (code) {
      case 'AL':       return `Base ${tier} + ${stitches > 8000 ? `${stitches - 8000} extra stitches` : 'no extras'}`;
      case 'AL-CAP':   return `Cap base ${tier} + ${stitches > 5000 ? `${stitches - 5000} extra stitches` : 'no extras'}`;
      case 'AS-Garm':  return `Garment stitch surcharge — ${Math.max(0, stitches - 8000)} above 8K`;
      case 'AS-CAP':   return `Cap stitch surcharge — ${Math.max(0, stitches - 5000)} above 5K`;
      case 'DECG':     return `Garment supplied · tier ${tier}`;
      case 'DECC':     return `Cap supplied · tier ${tier}`;
      case 'DECG-FB':  return `Full back · tier ${tier} · ${Math.max(stitches, 25000)} stitches`;
      case 'CTR-Garmt':return `Contract garments · tier ${tier} · ${stitches} stitches`;
      case 'CTR-Cap':  return `Contract caps · tier ${tier} · ${stitches} stitches`;
      default:         return '';
    }
  }

  // Codes that consume stitchCount in their formula. Picker uses this to
  // decide whether to show the stitch input.
  const STITCH_AWARE = new Set([
    'AL', 'AL-CAP', 'AS-Garm', 'AS-CAP', 'DECG-FB', 'CTR-Garmt', 'CTR-Cap',
  ]);

  // Codes that only need a tier (no stitchCount input). Show simpler UI.
  const TIER_ONLY = new Set(['DECG', 'DECC']);

  function isTiered(code) {
    return STITCH_AWARE.has(code) || TIER_ONLY.has(code);
  }

  function isStitchAware(code) {
    return STITCH_AWARE.has(code);
  }

  window.OrderFormTieredPricing = {
    preload,
    resolve,
    resolveSync,
    formulaLabel,
    tierForQty,
    isTiered,
    isStitchAware,
    fetchAlPricing,
    fetchDecgPricing,
    fetchContractPricing,
  };
})();
