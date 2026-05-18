// Order-Form Pricing — DTG (Direct-to-Garment).
//
// Phase 5d (2026-05-03) — the 9-combo dropdown migrated to à-la-carte rail
// cards. Each individual print location (LC, FF, JF, FB, JB) is now its own
// CONFIGURATOR virtual card. Drop multiple to compose a combo: LC + FB →
// effective combo "LC_FB". The underlying DTGPricingService.priceForLocationCombo
// already sums print costs across the codes in any combo string, so any
// combination works (the rep is responsible for not stacking conflicting
// front/back locations like LC+FF or FB+JB). Verified after the migration.
// LTM threshold qty < 24 (different from embroidery 7); LTM distributed via
// Math.floor((50/qty)*100)/100 to prevent customer overcharging.

(function () {
  const { useState } = React;
  const S = window.OrderFormPricingShared;

  let _svc = null;
  function svc() { return _svc ||= new window.DTGPricingService(); }

  const COMBOS = [
    { value: 'LC',     label: 'Left Chest' },
    { value: 'FF',     label: 'Full Front' },
    { value: 'JF',     label: 'Jumbo Front' },
    { value: 'FB',     label: 'Full Back' },
    { value: 'JB',     label: 'Jumbo Back' },
    { value: 'LC_FB',  label: 'Left Chest + Full Back' },
    { value: 'FF_FB',  label: 'Full Front + Full Back' },
    { value: 'JF_JB',  label: 'Jumbo Front + Jumbo Back' },
    { value: 'LC_JB',  label: 'Left Chest + Jumbo Back' },
  ];

  // Phase 5d — virtual rail cards. One per individual print location. Drop
  // multiple to compose a combo (LC + FB → "LC_FB"). All CONFIGURATOR —
  // markup baked into per-piece by priceForLocationCombo. Singletons per
  // code via ORDER_LEVEL_CODES. RailGroup splits "Front Locations" /
  // "Back Locations" so the rail visually nudges reps away from stacking
  // two front or two back picks (which is a real-world conflict — only one
  // front and/or one back per garment).
  const VIRTUAL_CARDS = [
    {
      ServiceCode: 'DTG-LC',
      DisplayName: 'Left Chest',
      ServiceType: 'DTG',
      RailGroup: 'DTG Front Locations',
      RailOrder: 10,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: 'small front print',
      IsActive: true,
      Visible: true,
      _dtgLocation: 'LC',
    },
    {
      ServiceCode: 'DTG-FF',
      DisplayName: 'Full Front',
      ServiceType: 'DTG',
      RailGroup: 'DTG Front Locations',
      RailOrder: 20,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: 'standard front print',
      IsActive: true,
      Visible: true,
      _dtgLocation: 'FF',
    },
    {
      ServiceCode: 'DTG-JF',
      DisplayName: 'Jumbo Front',
      ServiceType: 'DTG',
      RailGroup: 'DTG Front Locations',
      RailOrder: 30,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: 'oversized front print',
      IsActive: true,
      Visible: true,
      _dtgLocation: 'JF',
    },
    {
      ServiceCode: 'DTG-FB',
      DisplayName: 'Full Back',
      ServiceType: 'DTG',
      RailGroup: 'DTG Back Locations',
      RailOrder: 10,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: 'standard back print',
      IsActive: true,
      Visible: true,
      _dtgLocation: 'FB',
    },
    {
      ServiceCode: 'DTG-JB',
      DisplayName: 'Jumbo Back',
      ServiceType: 'DTG',
      RailGroup: 'DTG Back Locations',
      RailOrder: 20,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: 'oversized back print',
      IsActive: true,
      Visible: true,
      _dtgLocation: 'JB',
    },
  ];
  if (window.OrderFormServiceCodes?.registerVirtual) {
    window.OrderFormServiceCodes.registerVirtual(VIRTUAL_CARDS);
  }

  // Translate dropped DTG addOns into a single locationCombo string
  // (e.g. "LC_FB"). Order is preserved by RailOrder/code, so two reps
  // dropping the same cards produce the same combo string.
  function comboFromAddOns(addOns) {
    const codes = [];
    (addOns || []).forEach(a => {
      if (!a?.code) return;
      const sc = window.OrderFormServiceCodes?.get?.(a.code);
      if (sc?._dtgLocation) codes.push(sc._dtgLocation);
    });
    return codes.length > 0 ? codes.join('_') : null;
  }

  // DTG tier label (1-23 / 24-47 / 48-71 / 72+) for display in add-on picker
  // and similar UI surfaces. This is a thin label-only helper — the actual
  // tier ROW (including LTM_Fee, MarginDenominator) is resolved from the
  // bundle via findTierRow() below, which reads Caspio's Pricing_Tiers.
  function tierForQty(qty) {
    if (qty <= 0) return null;
    if (qty < 24) return '1-23';
    if (qty <= 47) return '24-47';
    if (qty <= 71) return '48-71';
    return '72+';
  }

  // DTG tiers come from Caspio's Pricing_Tiers table (including the 1-23
  // LTM row with LTM_Fee=50). Find the row whose [MinQuantity, MaxQuantity]
  // range contains the given qty. Returns the full tier row (incl. LTM_Fee).
  function findTierRow(tiers, qty) {
    if (!Array.isArray(tiers) || tiers.length === 0 || qty <= 0) return null;
    const match = tiers.find(t =>
      qty >= Number(t.MinQuantity) && qty <= Number(t.MaxQuantity)
    );
    if (match) return match;
    // Above the highest range — cap at the largest tier.
    const sorted = [...tiers].sort(
      (a, b) => Number(b.MaxQuantity) - Number(a.MaxQuantity)
    );
    return sorted[0] || null;
  }

  async function fetchBundleForRow(row, formCtx) {
    const isManual = !!row.manualMode && Number(row.manualCost) > 0;
    const bundleKey = isManual
      ? `manual:${Number(row.manualCost).toFixed(2)}`
      : `${String(row.style || '').toUpperCase()}:${row.colorName || row.color || ''}`;
    const fetcher = async () => {
      if (isManual) return await svc().generateManualPricingData(Number(row.manualCost));
      if (formCtx?.customerMode) { try { svc().clearManualCostOverride?.(); } catch (_) {} }
      return await svc().fetchPricingData(String(row.style || '').toUpperCase(), row.colorName || row.color || '');
    };
    return await window.OrderFormPricing.getBundle('dtg', bundleKey, fetcher);
  }

  // Resolve a single combo's per-size price by walking the bundle's costs[]
  // and sizes[] arrays. For combos like 'LC_FB', sum print costs across codes.
  // Tier (including LTM_Fee) is resolved from the bundle's Caspio Pricing_Tiers
  // rows. If the LTM tier has no DTG_Costs entries, print cost falls back to
  // the lowest non-LTM tier's costs (historical pattern, no data change needed).
  function priceForLocationCombo(bundle, combo, totalQty) {
    if (!bundle || !combo) return null;
    const codes = String(combo).split('_');
    const tiers = bundle.tiers || [];
    const tierRow = findTierRow(tiers, totalQty);
    if (!tierRow) return null;

    const marginDenom = Number(tierRow.MarginDenominator) || 0.6;
    const ltmFee = Number(tierRow.LTM_Fee || 0);
    const isLTM = ltmFee > 0;

    // Resolve the TierLabel we'll use to look up DTG_Costs rows. Default:
    // the tier's own label. If LTM tier has no rows in DTG_Costs, fall back
    // to the lowest non-LTM tier (preserves the historical "LTM uses 24-47
    // print cost + LTM fee" pattern).
    let costsTierLabel = tierRow.TierLabel;
    if (isLTM) {
      const hasCosts = (bundle.costs || []).some(c => c.TierLabel === tierRow.TierLabel);
      if (!hasCosts) {
        const nonLtm = tiers
          .filter(t => Number(t.LTM_Fee || 0) === 0)
          .sort((a, b) => Number(a.MinQuantity) - Number(b.MinQuantity));
        if (nonLtm.length) costsTierLabel = nonLtm[0].TierLabel;
      }
    }

    // Print cost: sum across all codes in the combo
    let totalPrintCost = 0;
    codes.forEach(code => {
      const costEntry = (bundle.costs || []).find(c => c.PrintLocationCode === code && c.TierLabel === costsTierLabel);
      if (costEntry) totalPrintCost += Number(costEntry.PrintCost) || 0;
    });

    // Garment selling base — use the smallest size's cost (typical convention)
    const sizes = bundle.sizes || [];
    const std = sizes.find(s => /^s$/i.test(s.size)) || sizes[0];
    const garmentCost = Number(std?.price) || 0;
    const markedUpGarment = garmentCost / marginDenom;

    // Per-size price = (markedUpGarment + totalPrintCost) rounded up to $0.50
    // + size upcharge for that size.
    const upcharges = bundle.upcharges || {};
    const out = {};
    sizes.forEach(s => {
      const baseRaw = markedUpGarment + totalPrintCost;
      const baseRounded = Math.ceil(baseRaw * 2) / 2;
      const up = Number(upcharges[s.size]) || 0;
      out[s.size] = baseRounded + up;
    });
    return { unitPriceBySize: out, tierLabel: tierRow.TierLabel, ltmFee };
  }

  function priceRow({ row, formCtx, bundle, locationCombo }) {
    const out = S.emptyRowBreakdown();
    const totalQty = Number(formCtx?.totalQty) || 0;
    if (!totalQty) return out;
    if (!bundle) { out.error = 'No DTG pricing bundle'; return out; }

    // Phase 5d — combo sourced from CONFIGURATOR addOns; falls back to
    // legacy formCtx.decoConfig.locationCombo for drafts saved before the
    // migration. If neither produces a combo, surface a guiding error so
    // the rep knows to drop a location card.
    const combo = locationCombo || formCtx?.decoConfig?.locationCombo;
    if (!combo) {
      out.error = 'Drag a DTG location from the rail (LC / FF / JF / FB / JB)';
      return out;
    }
    const priced = priceForLocationCombo(bundle, combo, totalQty);
    if (!priced) { out.error = `No DTG pricing for combo ${combo}`; return out; }
    const tier = priced.tierLabel;

    // LTM distribution — driven by Caspio's Pricing_Tiers.LTM_Fee column.
    // Currently the 1-23 tier has LTM_Fee=50; all other tiers have 0.
    // Math.floor((fee/qty)*100)/100 prevents overcharging per MEMORY.md.
    const ltmFee = Number(priced.ltmFee || 0);
    const ltmPP = (ltmFee > 0 && totalQty > 0) ? Math.floor((ltmFee / totalQty) * 100) / 100 : 0;

    Object.keys(row.sizes || {}).forEach(sizeKey => {
      const qty = Number(row.sizes[sizeKey]) || 0;
      if (!qty) return;
      const baseUnit = priced.unitPriceBySize[sizeKey];
      if (baseUnit == null) {
        out.sizeBreakdown.push({ size: sizeKey, qty, error: `No DTG price for size ${sizeKey}` });
        return;
      }
      const unit = baseUnit + ltmPP;
      out.unitPriceBySize[sizeKey] = unit;
      const lineSubtotal = unit * qty;
      out.sizeBreakdown.push({ size: sizeKey, qty, unitPrice: unit, lineSubtotal });
      out.rowSubtotal += lineSubtotal;
    });

    // Sizing metadata for display: available sizes + relative upcharges.
    const availableSizes = Object.keys(priced.unitPriceBySize || {});
    const baseSizeKey = availableSizes.find(s => /^s$/i.test(s)) || availableSizes[0];
    const basePrice = priced.unitPriceBySize?.[baseSizeKey] != null
      ? priced.unitPriceBySize[baseSizeKey] + ltmPP
      : null;
    // Scope upcharges to product's actual sizes — bundle.upcharges may list
    // global extended-size upcharges that don't apply to this product.
    const baseAbs = Number(bundle?.upcharges?.[baseSizeKey] || 0);
    const availableSet = new Set(availableSizes.map(s => String(s).toUpperCase()));
    const sizeUpcharges = {};
    Object.keys(bundle?.upcharges || {}).forEach(sz => {
      if (!availableSet.has(String(sz).toUpperCase())) return;
      const rel = Number(bundle.upcharges[sz] || 0) - baseAbs;
      if (rel > 0) sizeUpcharges[sz] = rel;
    });

    out.tier = tier;
    out.extras = {
      locationCombo: combo,
      ltmPerPiece: ltmPP,
      manualMode: !!row.manualMode,
      availableSizes,
      baseSizeKey,
      basePrice,
      sizeUpcharges,
    };
    return out;
  }

  async function aggregate({ rows, formCtx, addOns }) {
    const out = S.emptyOrderBreakdown();
    out.totalQty = S.totalQtyAcrossRows(rows);
    if (!out.totalQty) return out;

    // Phase 5d — combo resolved from CONFIGURATOR addOns once per aggregate
    // run, then passed to priceRow. Falls back to legacy decoConfig when no
    // DTG- addons are present (drafts pre-migration).
    const dtgAddOns = (addOns || []).filter(a => a?.code && a.code.startsWith('DTG-'));
    const locationCombo = dtgAddOns.length > 0
      ? comboFromAddOns(addOns)
      : (formCtx?.decoConfig?.locationCombo || null);

    const targets = (rows || []).filter(r => {
      if (!r) return false;
      const hasQty = Object.values(r.sizes || {}).some(v => Number(v) > 0);
      if (!hasQty) return false;
      return !!(r.style && r.style.trim()) || (!!r.manualMode && Number(r.manualCost) > 0);
    });

    const fetched = await Promise.all(targets.map(async (r) => {
      try { return { row: r, bundle: await fetchBundleForRow(r, formCtx) }; }
      catch (err) { return { row: r, error: err?.message || String(err) }; }
    }));

    // Resolve the aggregate tier + LTM fee from the FIRST successfully-fetched
    // bundle's Pricing_Tiers (tier definitions are shared across DTG styles).
    let resolvedTierRow = null;
    for (const f of fetched) {
      if (f.bundle && Array.isArray(f.bundle.tiers) && f.bundle.tiers.length) {
        resolvedTierRow = findTierRow(f.bundle.tiers, out.totalQty);
        if (resolvedTierRow) break;
      }
    }
    out.tier = resolvedTierRow?.TierLabel || null;
    const aggregateLtmFee = Number(resolvedTierRow?.LTM_Fee || 0);

    fetched.forEach(({ row, bundle, error }) => {
      if (error || !bundle) {
        out.errors.push({ rowId: row.id, message: error || 'No bundle' });
        out.byRow.set(row.id, { ...S.emptyRowBreakdown(), error: error || 'No bundle' });
        return;
      }
      const rb = priceRow({ row, formCtx, bundle, locationCombo });
      out.byRow.set(row.id, rb);
      out.subtotal += rb.rowSubtotal;
    });

    // LTM total = the fee from the resolved tier row (typically $50 from the
    // 1-23 row; $0 from other tiers). Distributed into per-piece pricing —
    // this field is reported separately for the breakdown display.
    if (aggregateLtmFee > 0) out.ltmTotal = aggregateLtmFee;
    out.grandTotal = out.subtotal;
    return out;
  }

  function buildNotesBlock({ formCtx, breakdown, addOns }) {
    const dtgAddOns = (addOns || []).filter(a => a?.code && a.code.startsWith('DTG-'));
    const combo = dtgAddOns.length > 0
      ? comboFromAddOns(addOns)
      : (formCtx?.decoConfig?.locationCombo || null);
    if (!combo) {
      return [
        `DTG · no locations selected`,
        `Tier ${breakdown?.tier || '?'} · ${breakdown?.totalQty || 0} pcs`,
      ].join('\n');
    }
    const label = COMBOS.find(c => c.value === combo)?.label
      || combo.split('_').map(c => COMBOS.find(x => x.value === c)?.label || c).join(' + ');
    const ltmFee = Number(breakdown?.ltmTotal || 0);
    return [
      `DTG · Location: ${combo} (${label})`,
      `Tier ${breakdown?.tier || '?'} · ${breakdown?.totalQty || 0} pcs`,
      ltmFee > 0 ? `LTM: $${ltmFee} distributed at $${(ltmFee/breakdown.totalQty).toFixed(2)}/pc (built into per-piece pricing)` : '',
    ].filter(Boolean).join('\n');
  }

  function buildDesignContext({ formCtx, addOns }) {
    const dtgAddOns = (addOns || []).filter(a => a?.code && a.code.startsWith('DTG-'));
    const combo = dtgAddOns.length > 0
      ? comboFromAddOns(addOns)
      : (formCtx?.decoConfig?.locationCombo || 'LC');
    return { designTypeId: 45, locationCombo: combo };
  }

  // Phase 5d — DTG ConfigBar shrinks to caption + hint. The 9-combo dropdown
  // moved to drag-and-drop rail cards (DTG-LC/FF/JF/FB/JB). Drop multiple
  // to compose a combo (LC + FB → LC_FB).
  function ConfigBar() {
    return (
      <div className="deco-config-strip" data-method="dtg">
        <div className="dcs-caption" aria-hidden>
          Drag DTG locations from the rail (LC / FF / JF / FB / JB) — drop one front + one back to compose combos.
        </div>
        <div className="dcs-hint">
          Min-order pricing applies under 24 pcs.
        </div>
      </div>
    );
  }

  // Phase 3 — rail filter. DTG services + universals (CDP for customer-supplied).
  function getRailServices(formCtx, customerOverrides = {}) {
    return S.filterRailServices(['DTG', 'UNIVERSAL'], customerOverrides);
  }

  window.OrderFormPricing.register('dtg', {
    method: 'dtg',
    label: 'DTG',
    // Phase 5d — verified after the addon migration. Combo derived from
    // CONFIGURATOR addOns; same priceForLocationCombo math runs unchanged.
    // Pricing parity with /pricing/dtg preserved.
    verified: true,
    betaNote: '',
    referenceUrl: '/pricing/dtg',
    // Phase 5d — defaultFormConfig is empty; combo comes from addOns. Legacy
    // drafts with locationCombo still work via aggregate fallback.
    defaultFormConfig: () => ({}),
    defaultRowConfig:  () => ({}),
    ConfigBar,
    tierForQty,
    fetchBundle: fetchBundleForRow,
    priceRow,
    aggregate,
    buildNotesBlock,
    buildDesignContext,
    getRailServices,
  });
})();
