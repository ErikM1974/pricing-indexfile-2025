// Order-Form Pricing — shared utilities used by every method module.
// Plain JS (no JSX). Loaded via <script> before any method module registers.

window.OrderFormPricingShared = (function () {
  // ---------------------------------------------------------------------------
  // Number / rounding
  // ---------------------------------------------------------------------------

  function safeNumber(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  // Honor the bundle's RoundingMethod. Embroidery flat default is CeilDollar
  // (whole dollar ceiling). Cap embroidery default is HalfDollarUp ($0.50 ceiling).
  // DTG / DTF round up to the nearest $0.50.
  function roundPrice(price, rule) {
    if (!Number.isFinite(price)) return null;
    const r = (rule || '').trim();
    if (r === 'HalfDollarUp' || r === 'HalfDollarCeil') {
      if (price % 0.5 === 0) return price;
      return Math.ceil(price * 2) / 2;
    }
    if (r === 'RoundDollar') return Math.round(price);
    // Default: CeilDollar — matches embroidery quote builder default.
    return Math.ceil(price);
  }

  // ---------------------------------------------------------------------------
  // Tier resolution — every method ships its own table, but the lookup is uniform.
  //
  // Tier shape: [{ label, min, max }]. `max=Infinity` for the open-ended top tier.
  // ---------------------------------------------------------------------------

  function tierForQty(qty, tiers) {
    const q = Number(qty) || 0;
    if (q <= 0) return null;
    for (const t of tiers) {
      if (q >= t.min && q <= (t.max ?? Infinity)) return t.label;
    }
    return tiers[tiers.length - 1]?.label || null;
  }

  // Standard 5-tier embroidery / cap embroidery table.
  const EMBROIDERY_TIERS = [
    { label: '1-7',   min: 1,  max: 7,  hasLTM: true },
    { label: '8-23',  min: 8,  max: 23 },
    { label: '24-47', min: 24, max: 47 },
    { label: '48-71', min: 48, max: 71 },
    { label: '72+',   min: 72, max: Infinity },
  ];

  // ---------------------------------------------------------------------------
  // Aggregate qty across all rows on the form. Walks every key in row.sizes
  // (standard XS-4XL plus non-standard OSFA/youth/tall/5-7XL plus method-specific
  // keys like 'STK' / 'EMB' for non-garment rows).
  // ---------------------------------------------------------------------------

  function totalQtyAcrossRows(rows) {
    let q = 0;
    (rows || []).forEach(r => {
      Object.values(r?.sizes || {}).forEach(v => { q += Number(v) || 0; });
    });
    return q;
  }

  function rowQty(row) {
    let q = 0;
    Object.values(row?.sizes || {}).forEach(v => { q += Number(v) || 0; });
    return q;
  }

  // ---------------------------------------------------------------------------
  // Standard error / breakdown shapes — keeps every method's return value uniform.
  // ---------------------------------------------------------------------------

  function emptyRowBreakdown() {
    return {
      unitPriceBySize: {},
      sizeBreakdown:   [],
      rowSubtotal:     0,
      tier:            null,
      extras:          {},
      error:           null,
    };
  }

  function emptyOrderBreakdown() {
    return {
      supported:    false,
      byRow:        new Map(),
      totalQty:     0,
      tier:         null,
      subtotal:     0,
      ltmTotal:     0,    // for display only — LTM is baked into per-piece prices
      taxEstimate:  0,
      depositDue:   0,
      grandTotal:   0,
      fees:         [],
      errors:       [],
    };
  }

  // Default WA sales-tax rate. Same constant the DTG / DTF quote builders use.
  const WA_TAX_RATE = 0.101;

  function computeTaxAndDeposit(subtotal) {
    const tax     = Math.round(subtotal * WA_TAX_RATE * 100) / 100;
    const total   = subtotal + tax;
    const deposit = Math.round(total * 0.5 * 100) / 100;
    return { tax, total, deposit };
  }

  // ---------------------------------------------------------------------------
  // Phase 3 — Service Rail filter helper.
  //
  // Each method engine's getRailServices() boils down to: filter Service_Codes
  // by IsActive + Visible, then by an allowed ServiceType set, apply per-customer
  // overrides, sort by RailGroup + RailOrder. This is identical across methods
  // — only the allowed types differ — so it lives here.
  //
  // Usage from a method engine:
  //   getRailServices(formCtx, customerOverrides) {
  //     return S.filterRailServices(['EMBROIDERY','DIGITIZING','UNIVERSAL'], customerOverrides);
  //   }
  // ---------------------------------------------------------------------------
  function filterRailServices(allowedTypes, customerOverrides = {}) {
    const SC = window.OrderFormServiceCodes;
    if (!SC?.all) return [];
    const allowed = new Set((allowedTypes || []).map(t => String(t).toUpperCase()));
    const all = SC.all() || [];
    return all
      .filter(s => s.IsActive !== false && s.Visible !== false)
      .filter(s => allowed.has(String(s.ServiceType || '').toUpperCase()))
      .map(s => ({ ...s, ...(customerOverrides[s.ServiceCode] || {}) }))
      .sort((a, b) =>
        String(a.RailGroup || '').localeCompare(String(b.RailGroup || '')) ||
        (Number(a.RailOrder) || 0) - (Number(b.RailOrder) || 0)
      );
  }

  return {
    safeNumber,
    roundPrice,
    tierForQty,
    EMBROIDERY_TIERS,
    totalQtyAcrossRows,
    rowQty,
    emptyRowBreakdown,
    emptyOrderBreakdown,
    WA_TAX_RATE,
    computeTaxAndDeposit,
    filterRailServices,
  };
})();
