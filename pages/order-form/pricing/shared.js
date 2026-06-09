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

  // Default WA sales-tax rate (Milton seller location). Same constant the DTG /
  // DTF quote builders use as the in-WA / pickup default.
  const WA_TAX_RATE = 0.101;
  const DEPOSIT_RATE = 0.5;   // 50% deposit due

  // Resolve the EFFECTIVE sales-tax rate + GL account from the customer + ship
  // context. Mirrors dtg-inline-form.js recomputeTaxRate() (WA destination-based
  // sourcing, WAC 458-20-145/193) so the Order Form agrees with the quote builders:
  //   wholesale / reseller → 0%  (GL 2203)
  //   tax-exempt customer  → 0%  (GL 2204)
  //   out of WA state      → 0%  (GL 2202)
  //   in WA / unknown      → ship.taxRate (DOR destination lookup, a DECIMAL set
  //                          upstream) else WA default 0.101 (GL 2200.101 Wash:10.1%)
  // NEVER a flat 10.1% for everyone (the old bug over-taxed exempt/out-of-state
  // customers on the customer-facing total/deposit).
  function resolveTaxContext(info, ship) {
    info = info || {};
    ship = ship || {};
    // "10.1" not "10.10", "8.8" not "8.80", "10.35" kept — strip trailing zeros.
    const fmtPct = (r) => String(parseFloat((r * 100).toFixed(2)));
    if (info.isWholesale) {
      return { rate: 0, exempt: true, label: 'Wholesale / reseller — no tax', account: '2203', accountName: 'Wholesale Sales (WA reseller permit)' };
    }
    if (info.isTaxExempt) {
      return { rate: 0, exempt: true, label: 'Tax exempt — no tax', account: '2204', accountName: 'Tax Exempt' };
    }
    const destState = String(ship.state || info.state || '').toUpperCase();
    if (destState && destState !== 'WA') {
      return { rate: 0, exempt: true, label: 'Out of state — no tax', account: '2202', accountName: 'Out of State Sales' };
    }
    // In WA (or unknown → assume WA, the conservative taxable default). Use a
    // destination rate resolved upstream (DOR lookup → ship.taxRate, decimal)
    // when present, else the Milton 10.1% default.
    const lookedUp = Number(ship.taxRate);
    const rate = (Number.isFinite(lookedUp) && lookedUp > 0) ? lookedUp : WA_TAX_RATE;
    return {
      rate,
      exempt: false,
      label: `WA Sales Tax (${fmtPct(rate)}%)`,
      account: ship.taxAccount || '2200.101',
      accountName: ship.taxAccountName || `Wash:${fmtPct(rate)}%`,
    };
  }

  // Compute tax + 50% deposit from a resolved tax context. taxCtx.rate is the
  // EFFECTIVE decimal rate (0 for exempt/wholesale/out-of-state). Back-compat:
  // a missing taxCtx falls back to the WA default (old single-arg callers).
  function computeTaxAndDeposit(subtotal, taxCtx) {
    const rate = (taxCtx && Number.isFinite(Number(taxCtx.rate))) ? Number(taxCtx.rate) : WA_TAX_RATE;
    const tax     = Math.round(subtotal * rate * 100) / 100;
    const total   = subtotal + tax;
    const deposit = Math.round(total * DEPOSIT_RATE * 100) / 100;
    return { tax, total, deposit, rate };
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

  // ---------------------------------------------------------------------------
  // Phase 4e (2026-05-03) — single source of truth for addon line-total math.
  //
  // Mirrors the per-method routing inside add-on-picker.jsx#chipLineTotal +
  // paper-form.jsx#AddOnSubRow. Used by both the display layer (so a sub-row
  // shows the correct total) and the registry's priceForm rollup (so the
  // breakdown.subtotal includes addons before tax/deposit). Keeping ONE
  // function ensures the row's total cell, the totals panel, the AddOnSubRow,
  // and the ShopWorks push all agree on the same number.
  //
  // The `breakdown` argument is needed only for RUSH (CALCULATED) which is a
  // percentage of subtotal. For non-RUSH addons, breakdown is unused.
  // ---------------------------------------------------------------------------
  function addOnLineTotal(addOn, sc, breakdown) {
    if (!addOn || !sc) return 0;
    const method = String(sc.PricingMethod || '').toUpperCase();
    const sell = Number(sc.SellPrice) || 0;
    const qty = Number(addOn.qty) || 0;
    const params = addOn.params || {};
    const code = addOn.code;

    if (method === 'TIERED') {
      // AS-CAP/AS-Garm tier rows ship with frozen tier+unitPrice from rail-card
      if (Number.isFinite(Number(params.unitPrice)) && (code === 'AS-CAP' || code === 'AS-Garm')) {
        return Number(params.unitPrice) * qty;
      }
      const tp = window.OrderFormTieredPricing;
      let unit = 0;
      if (tp?.isTiered?.(code)) {
        const sync = tp.resolveSync(code, {
          qty,
          tier: tp.tierForQty(qty),
          stitchCount: Number(params.stitchCount) || 8000,
        });
        if (Number.isFinite(sync)) unit = Number(sync);
      }
      if (!unit && Number.isFinite(Number(params.unitPrice))) unit = Number(params.unitPrice);
      return unit * qty;
    }
    if (method === 'FIXED' || method === 'FLAT') {
      return sell * qty;
    }
    if (method === 'CALCULATED' && code === 'RUSH') {
      const pct = Number(params.percent ?? 25) / 100;
      // RUSH bills on the subtotal SNAPSHOTTED before RUSH was added back in
      // (set by applyAddOnsToBreakdown). Falls back to subtotal pre-Phase-4e.
      const base = Number(breakdown?.subtotalForRush ?? breakdown?.subtotal) || 0;
      return base * pct;
    }
    if (method === 'HOURLY') {
      const hrs = Number(params.hours) || 0;
      return sell * hrs;
    }
    if (method === 'PASSTHROUGH') {
      const amt = Number(params.amount) || 0;
      return amt * Math.max(qty, 1);
    }
    // Phase 5a — CONFIGURATOR addons (emblem METALLIC/VELCRO/etc.) toggle
    // an internal flag in the method's aggregate(); the markup is baked
    // into the per-piece price, so the addon itself contributes $0 to the
    // separate-line-item total. The sub-row UI shows "+25% per piece"
    // text instead of a dollar value.
    if (method === 'CONFIGURATOR') return 0;
    return 0;
  }

  // ---------------------------------------------------------------------------
  // Phase 4e — apply per-row + order-level addOns to a breakdown produced by
  // a method's aggregate(). Mutates `breakdown` in place:
  //   - For row-scoped addOns: adds to byRow[rowId].rowSubtotal AND breakdown.subtotal
  //   - For order-level addOns: adds to breakdown.subtotal only
  //
  // RUSH (CALCULATED, percentage-of-subtotal) is processed LAST so it sees
  // the post-rollup subtotal and bills accurately on the full job. PASSTHROUGH
  // addons (Discount, Freight, Pallet) compute before RUSH so the discount
  // reduces what RUSH bills against — matches NWCA convention.
  //
  // Idempotent: calling twice should NOT double-count; we mark with a flag.
  // ---------------------------------------------------------------------------
  function applyAddOnsToBreakdown(breakdown, addOns) {
    if (!breakdown || breakdown._addOnsApplied) return;
    if (!Array.isArray(addOns) || addOns.length === 0) {
      breakdown._addOnsApplied = true;
      return;
    }
    const SC = window.OrderFormServiceCodes;
    if (!SC) { breakdown._addOnsApplied = true; return; }

    const rushQueue = [];
    for (const a of addOns) {
      if (!a?.code) continue;
      if (a.code === 'RUSH') { rushQueue.push(a); continue; }
      const sc = SC.get?.(a.code);
      if (!sc) continue;
      const lineTotal = addOnLineTotal(a, sc, breakdown) || 0;
      if (a.scope && typeof a.scope === 'object' && a.scope.rowId) {
        const rb = breakdown.byRow?.get?.(a.scope.rowId)
                || (breakdown.byRow && breakdown.byRow[a.scope.rowId]);
        if (rb) rb.rowSubtotal = (rb.rowSubtotal || 0) + lineTotal;
      }
      breakdown.subtotal = (breakdown.subtotal || 0) + lineTotal;
    }
    // RUSH last — uses the post-rollup, pre-RUSH subtotal so it bills on the
    // full base+addons amount. Snapshot lives on breakdown.subtotalForRush so
    // the display layer can recompute the same value (otherwise display would
    // see breakdown.subtotal already including RUSH and double-count it).
    breakdown.subtotalForRush = breakdown.subtotal || 0;
    for (const a of rushQueue) {
      const sc = SC.get?.(a.code);
      if (!sc) continue;
      const lineTotal = addOnLineTotal(a, sc, breakdown) || 0;
      breakdown.subtotal = (breakdown.subtotal || 0) + lineTotal;
    }
    breakdown.grandTotal = breakdown.subtotal;
    breakdown._addOnsApplied = true;
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
    resolveTaxContext,
    computeTaxAndDeposit,
    filterRailServices,
    addOnLineTotal,
    applyAddOnsToBreakdown,
  };
})();
