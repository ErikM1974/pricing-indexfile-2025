// Order-Form Pricing — DTG (Direct-to-Garment).
//
// Beta chip until verified against /pricing/dtg. Wraps DTGPricingService.
// Form-wide config: a single location combo code (LC, FF, JF, FB, JB, LC_FB, FF_FB, JF_JB, LC_JB).
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

  // DTG tiers: 24-47, 48-71, 72+. Anything under 24 is LTM territory and
  // distributes the $50 fee per piece via floor((50/qty)*100)/100.
  function tierForQty(qty) {
    if (qty <= 0) return null;
    if (qty < 24) return '1-23';
    if (qty <= 47) return '24-47';
    if (qty <= 71) return '48-71';
    return '72+';
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

  // Resolve a single combo's per-tier per-size price by walking the bundle's
  // costs[] (PrintLocationCode -> per-tier PrintCost) and the sizes[] array.
  // For combos like 'LC_FB', sum print costs across the codes.
  function priceForLocationCombo(bundle, combo, tier, totalQty) {
    if (!bundle || !combo) return null;
    const codes = String(combo).split('_');
    const tiers   = bundle.tiers || [];
    const tierRow = tiers.find(t => {
      const min = Number(t.MinQuantity) || 0;
      const max = Number(t.MaxQuantity) || Infinity;
      // For LTM (qty<24), use the lowest paid tier (24-47) as the basis.
      const effectiveQty = totalQty < 24 ? Math.max(totalQty, min) : totalQty;
      return effectiveQty >= min && effectiveQty <= max;
    }) || tiers[0];
    if (!tierRow) return null;
    const marginDenom = Number(tierRow.MarginDenominator) || 0.6;
    const tierLabel = tierRow.TierLabel;

    // Print cost: sum across all codes in the combo
    let totalPrintCost = 0;
    codes.forEach(code => {
      const costEntry = (bundle.costs || []).find(c => c.PrintLocationCode === code && c.TierLabel === tierLabel);
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
    return { unitPriceBySize: out, tierLabel };
  }

  function priceRow({ row, formCtx, bundle }) {
    const out = S.emptyRowBreakdown();
    const totalQty = Number(formCtx?.totalQty) || 0;
    if (!totalQty) return out;
    if (!bundle) { out.error = 'No DTG pricing bundle'; return out; }

    const combo = formCtx?.decoConfig?.locationCombo || 'LC';
    const tier = tierForQty(totalQty);
    const priced = priceForLocationCombo(bundle, combo, tier, totalQty);
    if (!priced) { out.error = `No DTG pricing for combo ${combo}`; return out; }

    // LTM distribution — DTG convention: floor((50/qty)*100)/100 (prevents overcharging)
    const ltmPP = (totalQty < 24 && totalQty > 0) ? Math.floor((50 / totalQty) * 100) / 100 : 0;

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

    out.tier = tier;
    out.extras = {
      locationCombo: combo,
      ltmPerPiece: ltmPP,
      manualMode: !!row.manualMode,
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
      if (!hasQty) return false;
      return !!(r.style && r.style.trim()) || (!!r.manualMode && Number(r.manualCost) > 0);
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

    if (out.tier === '1-23') out.ltmTotal = 50;
    out.grandTotal = out.subtotal;
    return out;
  }

  function buildNotesBlock({ formCtx, breakdown }) {
    const cfg = formCtx?.decoConfig || {};
    const combo = cfg.locationCombo || 'LC';
    const label = COMBOS.find(c => c.value === combo)?.label || combo;
    return [
      `DTG · Location: ${combo} (${label})`,
      `Tier ${breakdown?.tier || '?'} · ${breakdown?.totalQty || 0} pcs`,
      breakdown?.tier === '1-23' ? `LTM: $50 distributed at $${(50/breakdown.totalQty).toFixed(2)}/pc (built into per-piece pricing)` : '',
    ].filter(Boolean).join('\n');
  }

  function buildDesignContext({ formCtx }) {
    return { designTypeId: 45, locationCombo: formCtx?.decoConfig?.locationCombo || 'LC' };
  }

  function ConfigBar({ config, setConfig }) {
    const combo = config.locationCombo || 'LC';
    return (
      <div className="deco-config-strip" data-method="dtg">
        <div className="dcs-field">
          <label className="dcs-lbl">Location combo</label>
          <select className="dcs-input" value={combo} onChange={(e) => setConfig({ ...config, locationCombo: e.target.value })}>
            {COMBOS.map(c => <option key={c.value} value={c.value}>{c.value} — {c.label}</option>)}
          </select>
        </div>
        <div className="dcs-hint">
          Min-order pricing applies under 24 pcs · v2: per-row location override
        </div>
      </div>
    );
  }

  window.OrderFormPricing.register('dtg', {
    method: 'dtg',
    label: 'DTG',
    verified: false,
    betaNote: 'Cross-check totals against /pricing/dtg before sending to ShopWorks',
    referenceUrl: '/pricing/dtg',
    defaultFormConfig: () => ({ locationCombo: 'LC' }),
    defaultRowConfig:  () => ({}),
    ConfigBar,
    tierForQty,
    fetchBundle: fetchBundleForRow,
    priceRow,
    aggregate,
    buildNotesBlock,
    buildDesignContext,
  });
})();
