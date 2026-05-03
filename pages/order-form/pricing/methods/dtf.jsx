// Order-Form Pricing — DTF (Direct-to-Film transfer).
//
// Beta chip until verified against /pricing/dtf. Wraps DTFPricingService.
// Form-wide config: 3 location slots (Front/Back/Sleeve) each with size
// (None / Small 5×5 / Medium 9×12 / Large 12×16.5).

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

  function priceRow({ row, formCtx, bundle }) {
    const out = S.emptyRowBreakdown();
    const totalQty = Number(formCtx?.totalQty) || 0;
    if (!totalQty) return out;
    if (totalQty < 10) {
      out.error = 'DTF minimum order is 10 pieces';
      return out;
    }
    if (!bundle) { out.error = 'No DTF pricing bundle'; return out; }

    const cfg = formCtx?.decoConfig || {};
    const slots = [
      { key: 'front',  size: cfg.front  || 'none' },
      { key: 'back',   size: cfg.back   || 'none' },
      { key: 'sleeve', size: cfg.sleeve || 'none' },
    ].filter(s => s.size !== 'none');
    if (slots.length === 0) {
      out.error = 'Pick at least one location size';
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

  async function aggregate({ rows, formCtx }) {
    const out = S.emptyOrderBreakdown();
    out.totalQty = S.totalQtyAcrossRows(rows);
    if (!out.totalQty) return out;
    out.tier = tierForQty(out.totalQty);

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
      const rb = priceRow({ row, formCtx, bundle });
      out.byRow.set(row.id, rb);
      out.subtotal += rb.rowSubtotal;
    });

    if (out.tier === '10-23') out.ltmTotal = 50;
    out.grandTotal = out.subtotal;
    return out;
  }

  function buildNotesBlock({ formCtx, breakdown }) {
    const cfg = formCtx?.decoConfig || {};
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

  function LocationSizePicker({ label, value, onChange }) {
    return (
      <div className="dcs-field">
        <label className="dcs-lbl">{label}</label>
        <select className="dcs-input" value={value || 'none'} onChange={(e) => onChange(e.target.value)}>
          {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  function ConfigBar({ config, setConfig }) {
    return (
      <div className="deco-config-strip" data-method="dtf">
        <LocationSizePicker label="Front"  value={config.front  || 'none'} onChange={(v) => setConfig({ ...config, front: v })} />
        <LocationSizePicker label="Back"   value={config.back   || 'none'} onChange={(v) => setConfig({ ...config, back: v })} />
        <LocationSizePicker label="Sleeve" value={config.sleeve || 'none'} onChange={(v) => setConfig({ ...config, sleeve: v })} />
        <div className="dcs-hint">
          Minimum order: 10 pcs · LTM applies under 24 pcs · Each location adds labor + freight cost
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
    verified: false,
    betaNote: 'Cross-check totals against /pricing/dtf before sending to ShopWorks',
    referenceUrl: '/pricing/dtf',
    defaultFormConfig: () => ({ front: 'medium', back: 'none', sleeve: 'none' }),
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
