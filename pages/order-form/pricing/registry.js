// Order-Form Pricing — method registry + dispatcher.
//
// Each method module (embroidery, screenprint, dtg, dtf, sticker, emblem) calls
// window.OrderFormPricing.register(key, module) when its <script> tag executes.
// The order-form React app then calls .priceForm({ rows, formCtx }) and the
// registry routes to the right module's aggregate() function.
//
// Plain JS — no JSX. Loaded before any method module.

window.OrderFormPricing = (function () {
  const _methods = new Map();

  // Bundle cache: key = `${methodKey}:${bundleKey}`. bundleKey is method-specific
  // (style number for SanMar lookups, 'manual:<cost>:<itemType>' for manual mode,
  // or the empty string for methods that don't need a per-style bundle like
  // stickers / emblems). 5-min TTL — same as the underlying pricing services.
  const _bundleCache = new Map();
  const BUNDLE_TTL_MS = 5 * 60 * 1000;

  function register(key, mod) {
    if (!key || !mod) return;
    if (typeof mod.aggregate !== 'function') {
      console.warn('[OrderFormPricing] method', key, 'missing aggregate()');
      return;
    }
    _methods.set(key, mod);
    console.log('[OrderFormPricing] registered:', key, mod.verified ? '(verified)' : '(beta)');
  }

  function getMethod(key) { return _methods.get(key) || null; }
  function hasMethod(key) { return _methods.has(key); }
  function listMethods() { return Array.from(_methods.keys()); }

  // Cached bundle accessor — method modules call this instead of hitting their
  // service directly so the cache is shared across rows on the same form.
  async function getBundle(methodKey, bundleKey, fetcher) {
    const k = `${methodKey}:${bundleKey || ''}`;
    const hit = _bundleCache.get(k);
    if (hit && (Date.now() - hit.t) < BUNDLE_TTL_MS) return hit.v;
    const v = await fetcher();
    _bundleCache.set(k, { v, t: Date.now() });
    return v;
  }

  function clearBundleCache() { _bundleCache.clear(); }

  // ---------------------------------------------------------------------------
  // Customer-mode guard for manualCost URL leak.
  //
  // All five existing pricing services accept ?manualCost=XX from the URL,
  // which would let a customer viewing a share-link override blank costs.
  // Before pricing on a customer-mode form, clear every service's session
  // override and ignore the URL param entirely.
  // ---------------------------------------------------------------------------

  function applyCustomerModeGuards(formCtx) {
    if (!formCtx?.customerMode) return;
    try {
      sessionStorage.removeItem('manualCostOverride');
    } catch (_) { /* private mode etc. */ }
    // Instances may not exist yet (services are lazily instantiated by modules);
    // each method module's fetchBundle() is responsible for *not reading* the
    // URL param when customerMode is true. The session-storage clear above
    // covers the persistent path; the URL path is method-module responsibility.
  }

  // ---------------------------------------------------------------------------
  // Single dispatcher entry point. Returns an OrderBreakdown (see shared.js).
  // ---------------------------------------------------------------------------

  async function priceForm({ rows, formCtx }) {
    const empty = window.OrderFormPricingShared.emptyOrderBreakdown();
    if (!formCtx?.deco) return empty;
    const m = _methods.get(formCtx.deco);
    if (!m) return empty;
    applyCustomerModeGuards(formCtx);
    try {
      const result = await m.aggregate({ rows, formCtx });
      // Tax / deposit derive from subtotal — every method gets these for free.
      const td = window.OrderFormPricingShared.computeTaxAndDeposit(result.subtotal || 0);
      result.taxEstimate = td.tax;
      result.depositDue  = td.deposit;
      result.supported   = true;
      return result;
    } catch (err) {
      console.error('[OrderFormPricing] aggregate failed for', formCtx.deco, err);
      return { ...empty, errors: [{ message: err?.message || String(err) }] };
    }
  }

  return {
    register, getMethod, hasMethod, listMethods,
    getBundle, clearBundleCache,
    priceForm,
  };
})();
