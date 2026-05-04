// Order-Form Pricing — Screen Print.
//
// Phase 5c (2026-05-03) — color steppers + white-underbase checkbox migrated
// to drag-and-drop rail cards. Each location (Front/Back/Sleeve) is now a
// CONFIGURATOR virtual card with a `colorCount` param edited inline on the
// row sub-row. White underbase is a separate toggle card. Pricing math
// unchanged (still wraps ScreenPrintPricingService) — we just translate the
// dropped addOns back into the engine's expected `{frontColors, backColors,
// sleeveColors, whiteUnderbase}` shape before running aggregate. Verified
// after the migration.

(function () {
  const { useState } = React;
  const S = window.OrderFormPricingShared;

  let _svc = null;
  function svc() { return _svc ||= new window.ScreenPrintPricingService(); }

  // Phase 5c — virtual rail cards. Front/Back/Sleeve each carry a colorCount
  // param (default 1) edited inline. UNDERBASE is a boolean toggle (drop =
  // on, ✕ = off). All four are CONFIGURATOR — markup baked into per-piece
  // by the existing pricing service, no separate line items.
  const VIRTUAL_CARDS = [
    {
      ServiceCode: 'SP-FRONT',
      DisplayName: 'Front Print',
      ServiceType: 'SCREENPRINT',
      RailGroup: 'SP Locations',
      RailOrder: 10,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: 'colors per location',
      IsActive: true,
      Visible: true,
      _spLocation: 'front',
      _defaultColorCount: 1,
      _hasColorCountInput: true,
    },
    {
      ServiceCode: 'SP-BACK',
      DisplayName: 'Back Print',
      ServiceType: 'SCREENPRINT',
      RailGroup: 'SP Locations',
      RailOrder: 20,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: 'colors per location',
      IsActive: true,
      Visible: true,
      _spLocation: 'back',
      _defaultColorCount: 1,
      _hasColorCountInput: true,
    },
    {
      ServiceCode: 'SP-SLEEVE',
      DisplayName: 'Sleeve Print',
      ServiceType: 'SCREENPRINT',
      RailGroup: 'SP Locations',
      RailOrder: 30,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: 'colors per location',
      IsActive: true,
      Visible: true,
      _spLocation: 'sleeve',
      _defaultColorCount: 1,
      _hasColorCountInput: true,
    },
    {
      ServiceCode: 'SP-UNDERBASE',
      DisplayName: 'White Underbase',
      ServiceType: 'SCREENPRINT',
      RailGroup: 'SP Extras',
      RailOrder: 10,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: '+1 effective front color',
      IsActive: true,
      Visible: true,
      _spLocation: 'underbase',
    },
  ];
  if (window.OrderFormServiceCodes?.registerVirtual) {
    window.OrderFormServiceCodes.registerVirtual(VIRTUAL_CARDS);
  }

  // Translate SP addOns into the {frontColors, backColors, sleeveColors,
  // whiteUnderbase} shape the existing pricing math expects. Drops with no
  // colorCount fall back to _defaultColorCount → 1.
  function configFromAddOns(addOns) {
    const out = { frontColors: 0, backColors: 0, sleeveColors: 0, whiteUnderbase: false };
    (addOns || []).forEach(a => {
      if (!a?.code) return;
      const sc = window.OrderFormServiceCodes?.get?.(a.code);
      const loc = sc?._spLocation;
      if (loc === 'underbase') {
        out.whiteUnderbase = true;
        return;
      }
      if (loc === 'front' || loc === 'back' || loc === 'sleeve') {
        const colors = Math.max(1, Math.min(6, Number(a?.params?.colorCount) || sc?._defaultColorCount || 1));
        out[`${loc}Colors`] = colors;
      }
    });
    return out;
  }

  // Bundle is the same as flat embroidery — call svc.fetchPricingData(style)
  // OR generateManualPricingData(blankCost) for manual mode.
  async function fetchBundleForRow(row, formCtx) {
    const isManual = !!row.manualMode && Number(row.manualCost) > 0;
    const bundleKey = isManual
      ? `manual:${Number(row.manualCost).toFixed(2)}`
      : String(row.style || '').toUpperCase();
    const fetcher = async () => {
      if (isManual) return await svc().generateManualPricingData(Number(row.manualCost));
      if (formCtx?.customerMode) { try { svc().clearManualCostOverride?.(); } catch (_) {} }
      return await svc().fetchPricingData(String(row.style || '').toUpperCase());
    };
    return await window.OrderFormPricing.getBundle('screenprint', bundleKey, fetcher);
  }

  // Tier resolution from the bundle's tierData (varies per style).
  // tierData: { '24-36': {MinQuantity, MaxQuantity, ...}, '37-71': {...}, ... }
  function tierForQtyFromBundle(qty, bundle) {
    const tiers = bundle?.tierData || {};
    for (const [label, t] of Object.entries(tiers)) {
      const min = Number(t.MinQuantity) || 0;
      const max = Number(t.MaxQuantity) || Infinity;
      if (qty >= min && qty <= max) return label;
    }
    // Below the lowest tier → use the lowest (LTM territory)
    const sorted = Object.entries(tiers).sort((a, b) => Number(a[1].MinQuantity) - Number(b[1].MinQuantity));
    return sorted[0]?.[0] || null;
  }

  // Total active locations = front + back + sleeves (with > 0 colors).
  function activeLocations(decoConfig) {
    const cfg = decoConfig || {};
    return {
      front:  Number(cfg.frontColors  || 0),
      back:   Number(cfg.backColors   || 0),
      sleeve: Number(cfg.sleeveColors || 0),
      whiteUnderbase: !!cfg.whiteUnderbase,
    };
  }

  function priceRow({ row, formCtx, bundle, spConfig }) {
    const out = S.emptyRowBreakdown();
    const totalQty = Number(formCtx?.totalQty) || 0;
    if (!totalQty) return out;
    if (!bundle?.primaryLocationPricing) { out.error = 'No SP pricing bundle'; return out; }

    const tier = tierForQtyFromBundle(totalQty, bundle);
    if (!tier) { out.error = `No SP tier for qty ${totalQty}`; return out; }

    // Phase 5c — config sourced from CONFIGURATOR addOns; falls back to
    // formCtx.decoConfig for legacy drafts saved before the migration.
    const loc = activeLocations(spConfig || formCtx?.decoConfig);
    if (loc.front === 0 && loc.back === 0 && loc.sleeve === 0) {
      out.error = 'Drag at least one SP location from the rail (Front / Back / Sleeve)';
      return out;
    }
    // Effective front colors: white underbase counts as +1 (same convention as quote builder)
    const frontEffective = loc.front > 0 ? loc.front + (loc.whiteUnderbase ? 1 : 0) : 0;
    const frontKey = String(frontEffective);

    // Find primary tier row
    const primaryTiers = bundle.primaryLocationPricing[frontKey]?.tiers || [];
    const primaryRow = primaryTiers.find(t => totalQty >= t.minQty && totalQty <= (t.maxQty ?? Infinity)) || primaryTiers[0];
    if (!primaryRow) { out.error = `No SP primary pricing for ${frontEffective} colors at qty ${totalQty}`; return out; }

    // Per-size primary print price + LTM (if any)
    const ltmFee = Number(primaryRow.ltmFee) || 0;
    const ltmPP = (ltmFee > 0 && totalQty > 0) ? ltmFee / totalQty : 0;

    // Additional location flat per-piece (back + sleeve combined into one accumulator)
    let addPP = 0;
    [
      { count: loc.back, key: 'back' },
      { count: loc.sleeve, key: 'sleeve' },
    ].forEach(({ count }) => {
      if (count <= 0) return;
      const addTiers = bundle.additionalLocationPricing?.[String(count)]?.tiers || [];
      const addRow = addTiers.find(t => totalQty >= t.minQty && totalQty <= (t.maxQty ?? Infinity)) || addTiers[0];
      if (addRow) addPP += Number(addRow.pricePerPiece) || 0;
    });

    Object.keys(row.sizes || {}).forEach(sizeKey => {
      const qty = Number(row.sizes[sizeKey]) || 0;
      if (!qty) return;
      const primaryUnit = primaryRow.prices?.[sizeKey];
      if (primaryUnit == null) {
        out.sizeBreakdown.push({ size: sizeKey, qty, error: `No SP price for size ${sizeKey}` });
        return;
      }
      const unit = primaryUnit + addPP + ltmPP;
      const unitRounded = Math.ceil(unit * 2) / 2;  // SP uses HalfDollarUp (matches production)
      out.unitPriceBySize[sizeKey] = unitRounded;
      const lineSubtotal = unitRounded * qty;
      out.sizeBreakdown.push({ size: sizeKey, qty, unitPrice: unitRounded, lineSubtotal });
      out.rowSubtotal += lineSubtotal;
    });

    // Sizing metadata: SP `primaryRow.prices` is per-size, so we derive the
    // available sizes + upcharges by diffing each size's price from the base
    // (S or first-listed) size.
    const availableSizes = Object.keys(primaryRow.prices || {});
    const baseSizeKey = availableSizes.find(s => /^s$/i.test(s)) || availableSizes[0];
    const baseRawPrice = Number(primaryRow.prices?.[baseSizeKey]) || 0;
    const basePrice = Math.ceil((baseRawPrice + addPP + ltmPP) * 2) / 2;
    const sizeUpcharges = {};
    availableSizes.forEach(sz => {
      const rel = Number(primaryRow.prices[sz]) - baseRawPrice;
      if (rel > 0) sizeUpcharges[sz] = rel;
    });

    out.tier = tier;
    out.extras = {
      frontColors: loc.front,
      backColors: loc.back,
      sleeveColors: loc.sleeve,
      whiteUnderbase: loc.whiteUnderbase,
      ltmPerPiece: ltmPP,
      additionalPerPiece: addPP,
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

    // Phase 5c — resolve {frontColors, backColors, sleeveColors,
    // whiteUnderbase} from CONFIGURATOR addOns once per aggregate. Falls
    // back to legacy decoConfig when no SP- addons are present.
    const spAddOns = (addOns || []).filter(a => a?.code && a.code.startsWith('SP-'));
    const spConfig = spAddOns.length > 0
      ? configFromAddOns(addOns)
      : (formCtx?.decoConfig || {});

    const targets = (rows || []).filter(r => {
      if (!r) return false;
      const hasQty = Object.values(r.sizes || {}).some(v => Number(v) > 0);
      if (!hasQty) return false;
      const hasStyle = !!(r.style && r.style.trim());
      const hasManual = !!r.manualMode && Number(r.manualCost) > 0;
      return hasStyle || hasManual;
    });

    const fetched = await Promise.all(targets.map(async (r) => {
      try { return { row: r, bundle: await fetchBundleForRow(r, formCtx) }; }
      catch (err) { return { row: r, error: err?.message || String(err) }; }
    }));

    fetched.forEach(({ row, bundle, error }) => {
      if (error || !bundle) {
        out.errors.push({ rowId: row.id, message: error || 'No bundle' });
        out.byRow.set(row.id, { ...S.emptyRowBreakdown(), error: error || 'No bundle' });
        return;
      }
      const rb = priceRow({ row, formCtx, bundle, spConfig });
      out.byRow.set(row.id, rb);
      out.subtotal += rb.rowSubtotal;
      if (!out.tier) out.tier = rb.tier;
    });

    out.grandTotal = out.subtotal;
    return out;
  }

  function buildNotesBlock({ formCtx, breakdown, addOns }) {
    const spAddOns = (addOns || []).filter(a => a?.code && a.code.startsWith('SP-'));
    const cfg = spAddOns.length > 0 ? configFromAddOns(addOns) : (formCtx?.decoConfig || {});
    const front = Number(cfg.frontColors || 0);
    const back  = Number(cfg.backColors || 0);
    const sleeve = Number(cfg.sleeveColors || 0);
    const ub = cfg.whiteUnderbase ? ' + white underbase' : '';
    const parts = [];
    if (front > 0) parts.push(`Front: ${front}c${ub}`);
    if (back > 0)  parts.push(`Back: ${back}c`);
    if (sleeve > 0) parts.push(`Sleeve: ${sleeve}c`);
    return [
      `SCREEN PRINT · ${parts.length ? parts.join(' · ') : 'no locations selected'}`,
      `Tier ${breakdown?.tier || '?'} · ${breakdown?.totalQty || 0} pcs`,
    ].join('\n');
  }

  function buildDesignContext({ formCtx }) {
    return { designTypeId: 3, primaryLocation: 'Front', method: 'screenprint' };
  }

  // Phase 5c — SP ConfigBar shrinks to caption + hint. The 3 color steppers
  // and the white-underbase checkbox moved to drag-and-drop rail cards
  // (SP-FRONT/BACK/SLEEVE/UNDERBASE). Each location card carries a
  // colorCount param edited inline on the row sub-row.
  function ConfigBar() {
    return (
      <div className="deco-config-strip" data-method="screenprint">
        <div className="dcs-caption" aria-hidden>
          Drag SP locations from the rail (Front / Back / Sleeve) — set color count inline.
          Drop White Underbase if needed.
        </div>
        <div className="dcs-hint">
          Each location with colors {'>'} 0 counts as a print location.
        </div>
      </div>
    );
  }

  // Phase 3 — rail filter. Screen print services + universals.
  function getRailServices(formCtx, customerOverrides = {}) {
    return S.filterRailServices(['SCREENPRINT', 'UNIVERSAL'], customerOverrides);
  }

  window.OrderFormPricing.register('screenprint', {
    method: 'screenprint',
    label: 'Screen Print',
    // Phase 5c — verified after the addon migration. Color counts +
    // underbase resolved from CONFIGURATOR addOns; pricing math
    // (ScreenPrintPricingService primary + additional location lookups)
    // unchanged. Pricing parity with /pricing/screen-print preserved.
    verified: true,
    betaNote: '',
    referenceUrl: '/pricing/screen-print',
    // Phase 5c — defaults empty; locations come from addOns. Legacy drafts
    // with frontColors/etc. fields still work via aggregate fallback.
    defaultFormConfig: () => ({}),
    defaultRowConfig:  () => ({}),
    ConfigBar,
    tierForQty: () => null, // tier resolution requires a bundle — shown by aggregate
    fetchBundle: fetchBundleForRow,
    priceRow,
    aggregate,
    buildNotesBlock,
    buildDesignContext,
    getRailServices,
  });
})();
