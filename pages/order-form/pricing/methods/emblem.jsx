// Order-Form Pricing — Embroidered Emblems / Patches.
//
// Beta chip until verified against /calculators/embroidered-emblem/index.html.
// Wraps EmblemPricingService.
//
// MVP convention: emblems are single-qty rows. The rep enters qty in any size
// cell on the row; the module sums across cells and uses form-wide dimensions
// + add-ons from decoConfig.

(function () {
  const S = window.OrderFormPricingShared;

  let _svc = null;
  function svc() { return _svc ||= new window.EmblemPricingService(); }

  async function fetchBundleForRow(_row, _formCtx) {
    const fetcher = async () => await svc().fetchPricingData();
    return await window.OrderFormPricing.getBundle('emblem', 'all', fetcher);
  }

  function priceRow({ row, formCtx, bundle }) {
    const out = S.emptyRowBreakdown();
    const totalQty = Number(formCtx?.totalQty) || 0;
    if (!totalQty) return out;
    if (!bundle) { out.error = 'No emblem pricing'; return out; }
    if (totalQty < 25) {
      out.error = 'Emblem minimum is 25 pieces';
      return out;
    }

    const cfg = formCtx?.decoConfig || {};
    const calc = svc().calculateUnit({
      grid:  bundle.grid,
      rules: bundle.rules,
      width:  Number(cfg.width)  || 0,
      height: Number(cfg.height) || 0,
      qty:    totalQty,
      metallicThread: !!cfg.metallicThread,
      velcroBacking:  !!cfg.velcroBacking,
      extraColors:    Number(cfg.extraColors) || 0,
    });
    if (!calc) { out.error = 'Invalid emblem dimensions or qty'; return out; }
    const unit = Number(calc.unit.toFixed(2));

    Object.keys(row.sizes || {}).forEach(sizeKey => {
      const qty = Number(row.sizes[sizeKey]) || 0;
      if (!qty) return;
      out.unitPriceBySize[sizeKey] = unit;
      const lineSubtotal = unit * qty;
      out.sizeBreakdown.push({ size: sizeKey, qty, unitPrice: unit, lineSubtotal });
      out.rowSubtotal += lineSubtotal;
    });

    out.tier = `${calc.qtyMin}+`;
    out.extras = {
      sizeKey: calc.sizeKey,
      basePrice: calc.basePrice,
      addOnPct: calc.addOnPct,
      addOnCost: calc.addOnCost,
      ltmPP: calc.ltmPP,
      newDesign: !!cfg.newDesign,
    };
    return out;
  }

  async function aggregate({ rows, formCtx }) {
    const out = S.emptyOrderBreakdown();
    out.totalQty = S.totalQtyAcrossRows(rows);
    if (!out.totalQty) return out;

    let bundle = null;
    try { bundle = await fetchBundleForRow(null, formCtx); }
    catch (err) { out.errors.push({ message: err?.message || String(err) }); }

    const targets = (rows || []).filter(r => {
      if (!r) return false;
      const hasQty = Object.values(r.sizes || {}).some(v => Number(v) > 0);
      return hasQty;
    });

    targets.forEach(row => {
      if (!bundle) {
        out.byRow.set(row.id, { ...S.emptyRowBreakdown(), error: 'No bundle' });
        return;
      }
      const rb = priceRow({ row, formCtx, bundle });
      out.byRow.set(row.id, rb);
      out.subtotal += rb.rowSubtotal;
      if (!out.tier) out.tier = rb.tier;
    });

    // One-time digitizing fee for new designs
    if (formCtx?.decoConfig?.newDesign && bundle?.rules) {
      const fee = bundle.rules.Digitizing_Fee || 100;
      out.fees = [{ label: 'Emblem digitizing — new design', amount: fee }];
      out.subtotal += fee;
    }

    if (out.totalQty < 200 && out.totalQty > 0) out.ltmTotal = 50;
    out.grandTotal = out.subtotal;
    return out;
  }

  function buildNotesBlock({ formCtx, breakdown }) {
    const cfg = formCtx?.decoConfig || {};
    const dims = `${Number(cfg.width || 0).toFixed(2)}" × ${Number(cfg.height || 0).toFixed(2)}"`;
    const addOns = [
      cfg.metallicThread ? 'metallic thread (+25%)' : '',
      cfg.velcroBacking  ? 'velcro backing (+25%)' : '',
      Number(cfg.extraColors) > 0 ? `${cfg.extraColors} extra color${cfg.extraColors > 1 ? 's' : ''} (+${Number(cfg.extraColors) * 10}%)` : '',
    ].filter(Boolean).join(', ') || 'none';
    const lines = [
      `EMBLEMS · ${dims}`,
      `${breakdown?.totalQty || 0} pcs · Add-ons: ${addOns}`,
    ];
    if (cfg.newDesign) lines.push('New design — $100 digitizing fee included');
    if ((breakdown?.totalQty || 0) < 200) lines.push(`LTM: $50 distributed at $${(50/Math.max(1, breakdown?.totalQty || 1)).toFixed(2)}/pc (built into per-piece pricing)`);
    return lines.join('\n');
  }

  function buildDesignContext() {
    return { designTypeId: 3, method: 'emblem' };
  }

  function ConfigBar({ config, setConfig }) {
    return (
      <div className="deco-config-strip" data-method="emblem">
        <div className="dcs-field">
          <label className="dcs-lbl">Width "</label>
          <input
            className="dcs-input dcs-input--num" type="number" min="1" max="12" step="0.5"
            value={config.width ?? 3}
            onChange={(e) => setConfig({ ...config, width: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="dcs-field">
          <label className="dcs-lbl">Height "</label>
          <input
            className="dcs-input dcs-input--num" type="number" min="1" max="12" step="0.5"
            value={config.height ?? 3}
            onChange={(e) => setConfig({ ...config, height: Number(e.target.value) || 0 })}
          />
        </div>
        <label className="dcs-checkbox">
          <input type="checkbox" checked={!!config.metallicThread}
            onChange={(e) => setConfig({ ...config, metallicThread: e.target.checked })} />
          <span>Metallic thread (+25%)</span>
        </label>
        <label className="dcs-checkbox">
          <input type="checkbox" checked={!!config.velcroBacking}
            onChange={(e) => setConfig({ ...config, velcroBacking: e.target.checked })} />
          <span>Velcro backing (+25%)</span>
        </label>
        <div className="dcs-field">
          <label className="dcs-lbl">Extra colors</label>
          <input
            className="dcs-input dcs-input--num" type="number" min="0" max="14" step="1"
            value={config.extraColors ?? 0}
            onChange={(e) => setConfig({ ...config, extraColors: Number(e.target.value) || 0 })}
          />
          <span className="dcs-hint-inline">+10% each</span>
        </div>
        <label className="dcs-checkbox">
          <input type="checkbox" checked={!!config.newDesign}
            onChange={(e) => setConfig({ ...config, newDesign: e.target.checked })} />
          <span>New design ($100 digitizing)</span>
        </label>
        <div className="dcs-hint">
          Min 25 pcs · LTM under 200 pcs · Volume tiers at 25/50/100/200/300/500/1K/2K/5K/10K
        </div>
      </div>
    );
  }

  window.OrderFormPricing.register('emblem', {
    method: 'emblem',
    label: 'Emblems',
    verified: false,
    betaNote: 'Cross-check totals against /calculators/embroidered-emblem/ before sending to ShopWorks',
    referenceUrl: '/calculators/embroidered-emblem/',
    defaultFormConfig: () => ({ width: 3, height: 3, metallicThread: false, velcroBacking: false, extraColors: 0, newDesign: false }),
    defaultRowConfig:  () => ({}),
    ConfigBar,
    tierForQty: () => null,
    fetchBundle: fetchBundleForRow,
    priceRow,
    aggregate,
    buildNotesBlock,
    buildDesignContext,
  });
})();
