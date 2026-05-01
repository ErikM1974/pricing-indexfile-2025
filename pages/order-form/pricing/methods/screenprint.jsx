// Order-Form Pricing — Screen Print.
//
// Beta chip until verified against /pricing/screen-print. Wraps
// ScreenPrintPricingService — same engine the production page and quote
// builder use. Form-wide config: front colors + back colors + sleeve colors,
// each 0-6, with optional white underbase per location.

(function () {
  const { useState } = React;
  const S = window.OrderFormPricingShared;

  let _svc = null;
  function svc() { return _svc ||= new window.ScreenPrintPricingService(); }

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

  function priceRow({ row, formCtx, bundle }) {
    const out = S.emptyRowBreakdown();
    const totalQty = Number(formCtx?.totalQty) || 0;
    if (!totalQty) return out;
    if (!bundle?.primaryLocationPricing) { out.error = 'No SP pricing bundle'; return out; }

    const tier = tierForQtyFromBundle(totalQty, bundle);
    if (!tier) { out.error = `No SP tier for qty ${totalQty}`; return out; }

    const loc = activeLocations(formCtx?.decoConfig);
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

  async function aggregate({ rows, formCtx }) {
    const out = S.emptyOrderBreakdown();
    out.totalQty = S.totalQtyAcrossRows(rows);
    if (!out.totalQty) return out;

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
      const rb = priceRow({ row, formCtx, bundle });
      out.byRow.set(row.id, rb);
      out.subtotal += rb.rowSubtotal;
      if (!out.tier) out.tier = rb.tier;
    });

    out.grandTotal = out.subtotal;
    return out;
  }

  function buildNotesBlock({ formCtx, breakdown }) {
    const cfg = formCtx?.decoConfig || {};
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

  // ConfigBar — front/back/sleeve color steppers with white underbase
  function ColorStepper({ label, value, onChange }) {
    const v = Math.max(0, Math.min(6, Number(value) || 0));
    return (
      <div className="dcs-field">
        <label className="dcs-lbl">{label}</label>
        <button type="button" className="dcs-btn" onClick={() => onChange(Math.max(0, v - 1))} aria-label={`Decrease ${label}`}>−</button>
        <input className="dcs-input dcs-input--num" type="number" min="0" max="6" value={v} onChange={(e) => onChange(Math.max(0, Math.min(6, Number(e.target.value) || 0)))} />
        <button type="button" className="dcs-btn" onClick={() => onChange(Math.min(6, v + 1))} aria-label={`Increase ${label}`}>+</button>
      </div>
    );
  }

  function ConfigBar({ config, setConfig }) {
    const front = config.frontColors ?? 1;
    const back  = config.backColors ?? 0;
    const sleeve = config.sleeveColors ?? 0;
    const ub = !!config.whiteUnderbase;
    return (
      <div className="deco-config-strip" data-method="screenprint">
        <ColorStepper label="Front colors" value={front} onChange={(v) => setConfig({ ...config, frontColors: v })} />
        <ColorStepper label="Back colors"  value={back}  onChange={(v) => setConfig({ ...config, backColors: v })} />
        <ColorStepper label="Sleeve colors" value={sleeve} onChange={(v) => setConfig({ ...config, sleeveColors: v })} />
        <label className="dcs-checkbox">
          <input type="checkbox" checked={ub} onChange={(e) => setConfig({ ...config, whiteUnderbase: e.target.checked })} />
          <span>White underbase (front)</span>
        </label>
        <div className="dcs-hint">
          Each location with colors {'>'} 0 counts as a print location · v2: per-row config
        </div>
      </div>
    );
  }

  window.OrderFormPricing.register('screenprint', {
    method: 'screenprint',
    label: 'Screen Print',
    verified: false,
    betaNote: 'Cross-check totals against /pricing/screen-print before sending to ShopWorks',
    referenceUrl: '/pricing/screen-print',
    defaultFormConfig: () => ({ frontColors: 1, backColors: 0, sleeveColors: 0, whiteUnderbase: false }),
    defaultRowConfig:  () => ({}),
    ConfigBar,
    tierForQty: () => null, // tier resolution requires a bundle — shown by aggregate
    fetchBundle: fetchBundleForRow,
    priceRow,
    aggregate,
    buildNotesBlock,
    buildDesignContext,
  });
})();
