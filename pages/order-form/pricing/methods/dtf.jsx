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

    // ------------------------------------------------------------------
    // Per-piece pricing — uses the SAME DTFPricingService the /pricing/dtf
    // builder uses, so prices match exactly. The garment base cost (the
    // blank) comes from the bundle's sizes[] (standard-size MAX_CASE_PRICE)
    // in live mode, or the rep-typed manualCost in manual mode — NEVER a
    // silent $0 fallback (a wrong-low price is worse than an error).
    // ------------------------------------------------------------------
    const locationCount = slots.length;
    const sizeKeys = slots.map(s => s.size);           // one transfer size per location

    // Garment base cost (blank). bundle.raw.sizes is the proxy's garment
    // MAX_CASE_PRICE per size (now populated for DTF too — see the pricing.js
    // styleQueryStart fix). Use the standard (S / first) size as the base,
    // mirroring the builder's product.baseCost.
    const sizesArr = Array.isArray(bundle?.raw?.sizes) ? bundle.raw.sizes : [];
    // Garment base = the MINIMUM size price — matches the builder exactly
    // (dtf-quote-page.js:644 → Math.min(...blankBundle.sizes.map(s => s.price))).
    const minSizePrice = sizesArr.length
      ? Math.min(...sizesArr.map(s => Number(s.price) || Infinity))
      : 0;
    const baseGarmentCost = (row.manualMode && Number(row.manualCost) > 0)
      ? Number(row.manualCost)
      : (Number.isFinite(minSizePrice) ? minSizePrice : 0);
    if (!(baseGarmentCost > 0)) {
      out.error = 'DTF garment cost unavailable for this style — enter a blank cost manually';
      return out;
    }

    // Canonical formula (positional args — the service signature is
    // calculatePriceForQuantity(garmentCost, data, sizeKeys, quantity)).
    // NO silent fallback: surface any pricing error instead of under-billing.
    let calc;
    try {
      calc = svc().calculatePriceForQuantity(baseGarmentCost, bundle, sizeKeys, totalQty);
    } catch (e) {
      out.error = `DTF pricing error: ${e?.message || e}`;
      return out;
    }
    if (!calc || !Number.isFinite(calc.subtotalBeforeRounding)) {
      out.error = 'DTF pricing unavailable for this quantity';
      return out;
    }

    // Size upcharges (Standard_Size_Upcharges → sellingPriceDisplayAddOns).
    // Added AFTER the margin division and rounded WITH the unit, exactly like
    // the builder: applyRounding(garmentCost/margin + upcharge + transfer +
    // labor + freight + ltmPerUnit). subtotalBeforeRounding already holds
    // everything except the upcharge, so adding it pre-round matches.
    const sellingAddOns = bundle?.raw?.sellingPriceDisplayAddOns || {};
    const upFor = (sz) => Number(sellingAddOns[String(sz).toUpperCase()] || 0);
    const roundHalfUp = (n) => Math.ceil(n * 2) / 2;          // DTF = HalfDollarCeil_Final
    const baseFinal = roundHalfUp(calc.subtotalBeforeRounding);

    const availableSizes = sizesArr.length ? sizesArr.map(s => s.size) : Object.keys(sellingAddOns);
    const baseSizeKey = availableSizes.find(s => /^s$/i.test(s)) || availableSizes[0] || 'S';

    Object.keys(row.sizes || {}).forEach(sizeKey => {
      const qty = Number(row.sizes[sizeKey]) || 0;
      if (!qty) return;
      const up = upFor(sizeKey);
      const unit = up > 0 ? roundHalfUp(calc.subtotalBeforeRounding + up) : baseFinal;
      out.unitPriceBySize[sizeKey] = unit;
      const lineSubtotal = unit * qty;
      out.sizeBreakdown.push({ size: sizeKey, qty, unitPrice: unit, lineSubtotal });
      out.rowSubtotal += lineSubtotal;
    });

    // Display upcharges scoped to the product's actual sizes.
    const availableSet = new Set(availableSizes.map(s => String(s).toUpperCase()));
    const sizeUpcharges = {};
    Object.keys(sellingAddOns).forEach(sz => {
      if (!availableSet.has(String(sz).toUpperCase())) return;
      const rel = Number(sellingAddOns[sz] || 0);
      if (rel > 0) sizeUpcharges[sz] = rel;
    });

    out.tier = calc.tierLabel || tierForQty(totalQty);
    out.ltmFee = Number(calc.ltmFee) || 0;     // API LTM_Fee (50 @ 10-23, else 0) — used by aggregate display total
    out.extras = {
      locations: slots.map(s => `${s.key}:${s.size}`),
      locationCount,
      primarySize: sizeKeys[0],
      manualMode: !!row.manualMode,
      availableSizes,
      baseSizeKey,
      basePrice: baseFinal,
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

    let resolvedLtmFee = 0;
    fetched.forEach(({ row, bundle, error }) => {
      if (error || !bundle) {
        out.errors.push({ rowId: row.id, message: error || 'No bundle' });
        out.byRow.set(row.id, { ...S.emptyRowBreakdown(), error: error || 'No bundle' });
        return;
      }
      const rb = priceRow({ row, formCtx, bundle, dtfConfig });
      out.byRow.set(row.id, rb);
      out.subtotal += rb.rowSubtotal;
      if (Number(rb.ltmFee) > 0) resolvedLtmFee = Number(rb.ltmFee);
    });

    // LTM total for the display breakdown — the resolved tier's Caspio LTM_Fee
    // (50 @ 10-23, 0 otherwise), NOT a hardcoded literal. Baked into per-piece.
    out.ltmTotal = resolvedLtmFee;
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
