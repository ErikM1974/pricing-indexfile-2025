// Order Form — Service_Codes client (Phase 2a, 2026-05-03).
//
// Single-source-of-truth fetch for NWCA fees/services from Caspio's
// Service_Codes table (31 rows, exposed at /api/service-codes).
//
// Same data the Embroidery Quote Builder + Service Price Reference page
// use — keeps Order Form add-on prices identical to those calculators by
// construction.
//
// Pricing methods (per ServiceCodes.PricingMethod):
//   FIXED       → SellPrice as-is (DD $100, 3D-EMB $5, Laser Patch $5, ...)
//   FLAT        → SellPrice as-is, qty=1 typical (GRT-50 $50, SPSU $30)
//   TIERED      → SellPrice is $0 here; real price lives in /api/al-pricing,
//                 /api/decg-pricing, or /api/pricing-bundle?method=EMB. Phase 2c.
//   CALCULATED  → formula on order subtotal (RUSH = 25%). Phase 2c.
//   PASSTHROUGH → rep-supplied amount (Freight, Pallet, Discount). Phase 2c.
//   HOURLY      → rate × hours (Art $75/hr × N hours). Phase 2c.
//
// Phase 2a only resolves FIXED + FLAT in the submit path. Other methods
// log a warning and skip — UI guards in 2b will prevent reps from picking
// them until 2c lands.

(function () {
  'use strict';

  const API_BASE = window.APP_CONFIG?.API?.BASE_URL
    || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
  const ENDPOINT = `${API_BASE}/api/service-codes`;
  const CACHE_KEY = 'orderForm.serviceCodes.v1';
  const CACHE_TTL_MS = 60 * 60 * 1000;  // 1h — service prices change rarely

  let _inFlight = null;
  let _cached = null;

  // Read sessionStorage cache on first load (survives within the form session).
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.ts && Date.now() - parsed.ts < CACHE_TTL_MS && Array.isArray(parsed.items)) {
        _cached = parsed.items;
      }
    }
  } catch (_) { /* ignore — first-load cache miss is fine */ }

  /**
   * Fetch all Service_Codes from Caspio. Cached 1h in sessionStorage.
   * Concurrent calls dedupe via in-flight promise.
   * @returns {Promise<Array>} array of service code objects, or [] on fetch failure
   */
  async function fetchServiceCodes() {
    if (_cached) return _cached;
    if (_inFlight) return _inFlight;

    _inFlight = (async () => {
      try {
        const r = await fetch(ENDPOINT);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        const items = Array.isArray(json?.data) ? json.data
          : Array.isArray(json) ? json : [];
        _cached = items;
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
        } catch (_) { /* quota exceeded — fine, in-memory cache still hot */ }
        return items;
      } catch (err) {
        console.error('[OrderForm] service-codes fetch failed:', err);
        return [];
      } finally {
        _inFlight = null;
      }
    })();
    return _inFlight;
  }

  /**
   * Synchronous lookup — returns the service code record, or null if not loaded.
   * Use after a `fetchServiceCodes()` await, OR on subsequent calls once the
   * cache is warm.
   * @param {string} code
   * @returns {Object|null}
   */
  function get(code) {
    if (!_cached || !code) return null;
    return _cached.find(s => s.ServiceCode === code) || null;
  }

  /**
   * Resolve the current sell price for an add-on entry.
   * Phase 2a supports FIXED + FLAT only. Other methods return null
   * (caller should skip the line item or warn).
   *
   * @param {Object} addOn          { code, qty, scope, params? }
   * @param {Object} options        { subtotal, capQty, garmentQty, capTier, garmentTier }
   * @returns {number|null}         per-unit sell price, or null if can't resolve
   */
  function resolvedPrice(addOn, options = {}) {
    const sc = get(addOn?.code);
    if (!sc) return null;
    const method = String(sc.PricingMethod || '').toUpperCase();
    const base = Number(sc.SellPrice) || 0;

    switch (method) {
      case 'FIXED':
      case 'FLAT':
        // SellPrice is the per-unit value. Qty multiplier handled by caller.
        return base;

      case 'TIERED':
        // Phase 2c: lookup /api/al-pricing or /api/pricing-bundle by tier+stitchCount.
        // Until then, refuse silently — UI will gate these out.
        return null;

      case 'CALCULATED':
        // RUSH = subtotal * 0.25 (or addOn.params.percent if rep overrode).
        if (sc.ServiceCode === 'RUSH' && Number(options.subtotal) > 0) {
          const pct = Number(addOn?.params?.percent ?? 25) / 100;
          return Number(options.subtotal) * pct;
        }
        return null;

      case 'PASSTHROUGH':
        // Freight / Pallet / Discount / CDP — rep enters the dollar amount.
        const passAmount = Number(addOn?.params?.amount);
        return Number.isFinite(passAmount) ? passAmount : null;

      case 'HOURLY':
        // Art — rate × hours.
        const hrs = Number(addOn?.params?.hours);
        return Number.isFinite(hrs) ? base * hrs : null;

      default:
        return null;
    }
  }

  /**
   * Whether an add-on is allowed for a row's product type.
   * Used by the picker UI to grey out cap-only options on tee rows etc.
   *
   * @param {string} code           service code
   * @param {string} capOrFlat      'cap' | 'flat'
   * @returns {boolean}
   */
  function appliesTo(code, capOrFlat) {
    const sc = get(code);
    if (!sc) return true;  // unknown → don't gate

    // Hard product-type rules from Service_Codes.DisplayName / ServiceCode
    // (Service_Codes itself doesn't have a capOrFlat column; we infer.)
    const capOnly  = ['3D-EMB', 'Laser Patch', 'AL-CAP', 'AS-CAP', 'DECC', 'CTR-Cap', 'SECC'];
    const flatOnly = ['SEG', 'AL', 'AS-Garm', 'DECG', 'DECG-FB', 'CTR-Garmt'];

    if (capOnly.includes(code))  return capOrFlat === 'cap';
    if (flatOnly.includes(code)) return capOrFlat === 'flat';
    return true;  // applies to any product type (fees, digitizing, etc.)
  }

  /**
   * Order-level vs row-scoped add-on classification.
   * Order-level codes are singletons (one per order — adding twice replaces).
   * Row-scoped codes can attach to multiple rows independently.
   */
  const ORDER_LEVEL_CODES = new Set([
    'DD', 'DDE', 'DDT',          // digitizing — one per design / one per order
    'GRT-50', 'GRT-75',          // setup fees — one per order
    'RUSH',                      // rush — order-wide
    'Discount',                  // order discount
    'Freight',                   // shipping
    'Pallet',                    // pallet change
    'Art',                       // art charges (hourly, but order-level by convention)
    'DT',                        // design transfer
    'SPSU', 'SPRESET',           // screen print one-time fees
  ]);

  function isOrderLevel(code) {
    return ORDER_LEVEL_CODES.has(code);
  }

  /**
   * Generate a stable add-on instance ID for keyed React render.
   */
  function newAddOnId() {
    return `addon-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  /**
   * Add (or replace) an add-on, enforcing order-level singleton rule.
   * Per Erik's Phase 2 product call (b): order-level codes replace the existing
   * one and surface a "1 already added" toast (toast wired in 2b UI).
   *
   * @param {Array} list    current addOns array
   * @param {Object} entry  new add-on entry (without id)
   * @returns {{ next, replaced }} updated list + whether a replace happened
   */
  function addOrReplace(list, entry) {
    const incoming = { id: newAddOnId(), ...entry };
    if (isOrderLevel(entry.code)) {
      const existingIdx = (list || []).findIndex(a => a.code === entry.code && a.scope === 'order');
      if (existingIdx >= 0) {
        const next = [...list];
        next[existingIdx] = { ...incoming, id: list[existingIdx].id };  // preserve old id for stable React keys
        return { next, replaced: true };
      }
    }
    return { next: [...(list || []), incoming], replaced: false };
  }

  /**
   * Public API exposed via window.OrderFormServiceCodes
   */
  window.OrderFormServiceCodes = {
    fetch: fetchServiceCodes,
    get,
    resolvedPrice,
    appliesTo,
    isOrderLevel,
    newAddOnId,
    addOrReplace,
    // Cached items getter for direct iteration in UI
    all: () => _cached ? [..._cached] : [],
  };
})();
