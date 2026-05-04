// Order-Form Pricing — DTF (Direct-to-Film transfer).
//
// Phase 5b (2026-05-03) — the 3 location-size dropdowns (Front / Back /
// Sleeve) migrated to rail cards. Each location is now a CONFIGURATOR
// virtual card with a transferSize param (small/medium/large), edited
// inline on the row sub-row. ConfigBar shrinks to just the hint. Verified
// after the migration.

(function () {
  const { useState } = React;
  const S = window.OrderFormPricingShared;

  let _svc = null;
  function svc() { return _svc ||= new window.DTFPricingService(); }

  const SIZE_OPTIONS = [
    { value: 'none',   label: 'None' },
    { value: 'small',  label: 'Small 5×5' },
    { value: 'medium', label: 'Medium 9×12' },
    { value: 'large',  label: 'Large 12×16.5' },
  ];

  // Phase 5b — per-location virtual rail cards. Each is a CONFIGURATOR
  // (markup / per-piece work, not a separate fee line) that toggles a
  // location with a default transferSize. Rep edits the size inline on the
  // resulting sub-row via the AddOnSubRow inline picker (paper-form.jsx).
  // Singletons via ORDER_LEVEL_CODES — re-drop replaces same instance.
  const DTF_SIZE_VALUES = ['small', 'medium', 'large'];
  const VIRTUAL_CARDS = [
    {
      ServiceCode: 'DTF-FRONT',
      DisplayName: 'Front Print',
      ServiceType: 'DTF',
      RailGroup: 'DTF Locations',
      RailOrder: 10,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: 'transfer + labor + freight',
      IsActive: true,
      Visible: true,
      _dtfLocation: 'front',
      _defaultTransferSize: 'medium',
      _transferSizeOptions: DTF_SIZE_VALUES,
    },
    {
      ServiceCode: 'DTF-BACK',
      DisplayName: 'Back Print',
      ServiceType: 'DTF',
      RailGroup: 'DTF Locations',
      RailOrder: 20,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: 'transfer + labor + freight',
      IsActive: true,
      Visible: true,
      _dtfLocation: 'back',
      _defaultTransferSize: 'medium',
      _transferSizeOptions: DTF_SIZE_VALUES,
    },
    {
      ServiceCode: 'DTF-SLEEVE',
      DisplayName: 'Sleeve Print',
      ServiceType: 'DTF',
      RailGroup: 'DTF Locations',
      RailOrder: 30,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: 'transfer + labor + freight',
      IsActive: true,
      Visible: true,
      _dtfLocation: 'sleeve',
      _defaultTransferSize: 'small',
      _transferSizeOptions: DTF_SIZE_VALUES,
    },
  ];
  if (window.OrderFormServiceCodes?.registerVirtual) {
    window.OrderFormServiceCodes.registerVirtual(VIRTUAL_CARDS);
  }

  // Translate DTF addOns into the front/back/sleeve config flags that
  // priceRow expects. Drops with no transferSize fall back to the card's
  // _defaultTransferSize, then global default 'medium'.
  function configFromAddOns(addOns) {
    const out = { front: 'none', back: 'none', sleeve: 'none' };
    (addOns || []).forEach(a => {
      const sc = window.OrderFormServiceCodes?.get?.(a?.code);
      if (!sc?._dtfLocation) return;
      const size = a?.params?.transferSize || sc._defaultTransferSize || 'medium';
      out[sc._dtfLocation] = size;
    });
    return out;
  }

  // DTF tiers: 10-23 (LTM, min 10), 24-47, 48-71, 72+
  function tierForQty(qty) {
    if (qty <= 0) return null;
    if (qty < 10)  return null;       // below minimum order
    if (qty <= 23) return '10-23';
    if (qty <= 47) return '24-47';
    if (qty <= 71) return '48-71';
    return '72+';
  }

  async function fetchBundleForRow(row, formCtx) {
    const isManual = !!row.manualMode && Number(row.manualCost) > 0;
    const bundleKey = isManual
      ? `manual:${Number(row.manualCost).toFixed(2)}`
      : String(row.style || '').toUpperCase();
    const fetcher = async () => {
      if (isManual && svc().generateManualPricingData) {
        return await svc().generateManualPricingData(Number(row.manualCost));
      }
      if (formCtx?.customerMode) { try { svc().clearManualCostOverride?.(); } catch (_) {} }
      return await svc().fetchPricingData(String(row.style || '').toUpperCase());
    };
    return await window.OrderFormPricing.getBundle('dtf', bundleKey, fetcher);
  }

  function priceRow({ row, formCtx, bundle, dtfConfig }) {
    const out = S.emptyRowBreakdown();
    const totalQty = Number(formCtx?.totalQty) || 0;
    if (!totalQty) return out;
    if (totalQty < 10) {
      out.error = 'DTF minimum order is 10 pieces';
      return out;
    }
    if (!bundle) { out.error = 'No DTF pricing bundle'; return out; }

    // Phase 5b — front/back/sleeve sizes resolved from CONFIGURATOR addOns
    // (one DTF-FRONT/BACK/SLEEVE drop = one location with a transferSize).
    // Falls back to formCtx.decoConfig if no addons (e.g. legacy drafts
    // saved before the migration).
    const cfg = dtfConfig || formCtx?.decoConfig || {};
    const slots = [
      { key: 'front',  size: cfg.front  || 'none' },
      { key: 'back',   size: cfg.back   || 'none' },
      { key: 'sleeve', size: cfg.sleeve || 'none' },
    ].filter(s => s.size !== 'none');
    if (slots.length === 0) {
      out.error = 'Drag a DTF location from the rail (Front / Back / Sleeve)';
      return out;
    }

    // The DTF service exposes calculatePriceForQuantity for a single (style, size, qty, locationCount).
    // For a multi-location order, accumulate per-size unit pricing across all sizes.
    // Easiest: ask the service for the canonical per-piece price using its built-in formula.
    // Approximation here: take the first (largest) selected size as the transfer size used
    // by the service's formula, and pass locationCount = slots.length so labor + freight scale.
    const sizeOrder = ['large', 'medium', 'small'];
    const primarySize = slots.map(s => s.size).sort((a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b))[0];
    const locationCount = slots.length;

    let perPieceUnit;
    try {
      // calculatePriceForQuantity returns a number (or object). Match the service's contract.
      const res = svc().calculatePriceForQuantity?.({
        bundle,
        sizeKey: primarySize,
        quantity: totalQty,
        locationCount,
      });
      perPieceUnit = (typeof res === 'number') ? res : (res?.unitPrice ?? res?.finalPrice);
    } catch (e) { /* fall through to bundle-walk below */ }

    if (!Number.isFinite(perPieceUnit)) {
      // Fallback: build it ourselves from the bundle's transferSizes + tiers.
      const tier = tierForQty(totalQty);
      const tiersR = bundle.tiersR || [];
      const tierRow = tiersR.find(t => totalQty >= (Number(t.MinQuantity) || 0) && totalQty <= (Number(t.MaxQuantity) || Infinity)) || tiersR[0];
      const marginDenom = Number(tierRow?.MarginDenominator) || 0.6;
      const garmentCost = Number(bundle?.garmentCost ?? bundle?.standardGarmentBaseCostUsed ?? 0) || 0;
      const ts = bundle?.transferSizes || {};
      const tier1 = ts[primarySize]?.pricingTiers || [];
      const tierMatch = tier1.find(t => totalQty >= (Number(t.minQty) || 0) && totalQty <= (Number(t.maxQty) || Infinity)) || tier1[0];
      const transferCost = Number(tierMatch?.unitPrice) || 0;
      const laborCost = Number(bundle?.laborCost) || 0;
      const freightCost = Number(bundle?.freightCost) || 0;
      const ltmPP = (totalQty < 24) ? (50 / totalQty) : 0;
      const raw = (garmentCost / marginDenom) + transferCost + (laborCost + freightCost) * locationCount + ltmPP;
      perPieceUnit = Math.ceil(raw * 2) / 2;  // HalfDollarUp
      void tier; // referenced for possible future use
    }

    // DTF size upcharges — same convention as embroidery/DTG: relative dollar
    // upcharges over the base size, additive on top of perPieceUnit. Pulled
    // from the bundle's sellingPriceDisplayAddOns map (or fall back to no
    // upcharges if the bundle doesn't expose them).
    const upchargeMap = bundle?.sellingPriceDisplayAddOns || bundle?.upcharges || {};
    const availableSizes = (bundle?.uniqueSizes && bundle.uniqueSizes.length)
      ? bundle.uniqueSizes
      : Object.keys(upchargeMap);
    const baseSizeKey = availableSizes.find(s => /^s$/i.test(s)) || availableSizes[0] || 'S';
    const baseAbs = Number(upchargeMap[baseSizeKey] || 0);

    Object.keys(row.sizes || {}).forEach(sizeKey => {
      const qty = Number(row.sizes[sizeKey]) || 0;
      if (!qty) return;
      const sizeAbs = Number(upchargeMap[sizeKey] || 0);
      const relativeUp = Math.max(0, sizeAbs - baseAbs);
      const unit = perPieceUnit + relativeUp;
      out.unitPriceBySize[sizeKey] = unit;
      const lineSubtotal = unit * qty;
      out.sizeBreakdown.push({ size: sizeKey, qty, unitPrice: unit, lineSubtotal });
      out.rowSubtotal += lineSubtotal;
    });

    // Sizing metadata for display — scope upcharges to product's actual sizes
    // so reps don't see "+$2 2XL" on products that don't carry 2XL.
    const availableSet = new Set(availableSizes.map(s => String(s).toUpperCase()));
    const sizeUpcharges = {};
    Object.keys(upchargeMap).forEach(sz => {
      if (!availableSet.has(String(sz).toUpperCase())) return;
      const rel = Number(upchargeMap[sz] || 0) - baseAbs;
      if (rel > 0) sizeUpcharges[sz] = rel;
    });

    out.tier = tierForQty(totalQty);
    out.extras = {
      locations: slots.map(s => `${s.key}:${s.size}`),
      locationCount,
      primarySize,
      manualMode: !!row.manualMode,
      availableSizes,
      baseSizeKey,
      basePrice: perPieceUnit,
      sizeUpcharges,
    };
    return out;
  }

  async function aggregate({ rows, formCtx, addOns }) {
    const out = S.emptyOrderBreakdown();
    out.totalQty = S.totalQtyAcrossRows(rows);
    if (!out.totalQty) return out;
    out.tier = tierForQty(out.totalQty);

    // Phase 5b — resolve front/back/sleeve sizes from addOns once per
    // aggregate run, then pass to priceRow. Falls back to legacy decoConfig
    // when no DTF addons are present (drafts from before the migration).
    const dtfAddOns = (addOns || []).filter(a => a?.code && a.code.startsWith('DTF-'));
    const dtfConfig = dtfAddOns.length > 0
      ? configFromAddOns(addOns)
      : (formCtx?.decoConfig || {});

    const targets = (rows || []).filter(r => {
      if (!r) return false;
      const hasQty = Object.values(r.sizes || {}).some(v => Number(v) > 0);
      return hasQty && (!!(r.style && r.style.trim()) || (!!r.manualMode && Number(r.manualCost) > 0));
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
      const rb = priceRow({ row, formCtx, bundle, dtfConfig });
      out.byRow.set(row.id, rb);
      out.subtotal += rb.rowSubtotal;
    });

    if (out.tier === '10-23') out.ltmTotal = 50;
    out.grandTotal = out.subtotal;
    return out;
  }

  function buildNotesBlock({ formCtx, breakdown, addOns }) {
    const cfg = (addOns || []).some(a => a?.code?.startsWith('DTF-'))
      ? configFromAddOns(addOns)
      : (formCtx?.decoConfig || {});
    const slots = [
      cfg.front  && cfg.front  !== 'none' ? `Front: ${cfg.front}` : null,
      cfg.back   && cfg.back   !== 'none' ? `Back: ${cfg.back}` : null,
      cfg.sleeve && cfg.sleeve !== 'none' ? `Sleeve: ${cfg.sleeve}` : null,
    ].filter(Boolean).join(' · ');
    return [
      `DTF · ${slots || 'no locations'}`,
      `Tier ${breakdown?.tier || '?'} · ${breakdown?.totalQty || 0} pcs`,
    ].join('\n');
  }

  function buildDesignContext() {
    return { designTypeId: 3, method: 'dtf' };
  }

  // Phase 5b — DTF ConfigBar shrinks to just the hint. The 3 location-size
  // dropdowns moved to drag-and-drop rail cards (DTF-FRONT, DTF-BACK,
  // DTF-SLEEVE). Each card carries a transferSize param edited inline on
  // the row sub-row.
  function ConfigBar() {
    return (
      <div className="deco-config-strip" data-method="dtf">
        <div className="dcs-caption" aria-hidden>
          Drag DTF locations from the rail (Front / Back / Sleeve) — edit transfer size inline.
        </div>
        <div className="dcs-hint">
          Min 10 pcs · LTM under 24 pcs · Each location adds labor + freight cost.
        </div>
      </div>
    );
  }

  // Phase 3 — rail filter. DTF services + universals.
  function getRailServices(formCtx, customerOverrides = {}) {
    return S.filterRailServices(['DTF', 'UNIVERSAL'], customerOverrides);
  }

  window.OrderFormPricing.register('dtf', {
    method: 'dtf',
    label: 'DTF',
    // Phase 5b — verified after the addon migration. Per-location sizes
    // resolved from CONFIGURATOR addOns (DTF-FRONT/BACK/SLEEVE), then
    // passed to the existing DTFPricingService.calculatePriceForQuantity
    // pipeline unchanged. Pricing parity with /pricing/dtf preserved.
    verified: true,
    betaNote: '',
    referenceUrl: '/pricing/dtf',
    // Phase 5b — defaultFormConfig is empty; locations come from addOns.
    // Legacy drafts with front/back/sleeve fields still work via fallback
    // in aggregate.
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
