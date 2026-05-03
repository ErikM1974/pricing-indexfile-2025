// Order-Form Pricing — Die-Cut Stickers.
//
// Beta chip until verified against /calculators/sticker-manual-pricing.html.
// Wraps StickerPricingService — uses /api/sticker-pricing when available,
// falls back to inline grid otherwise.
//
// MVP convention: stickers are single-qty rows (no size grid). The rep enters
// the qty in any size cell on the row; the module sums across all cells and
// uses the form-wide sticker size from decoConfig.

(function () {
  const S = window.OrderFormPricingShared;

  let _svc = null;
  function svc() { return _svc ||= new window.StickerPricingService(); }

  const SIZES = ['2x2', '3x3', '4x4', '5x5'];

  async function fetchBundleForRow(_row, _formCtx) {
    const fetcher = async () => await svc().fetchPricingData();
    return await window.OrderFormPricing.getBundle('sticker', 'all', fetcher);
  }

  function priceRow({ row, formCtx, bundle }) {
    const out = S.emptyRowBreakdown();
    const totalQty = Number(formCtx?.totalQty) || 0;
    if (!totalQty) return out;
    if (!bundle?.grid) { out.error = 'No sticker pricing'; return out; }
    if (totalQty < 50) {
      out.error = 'Sticker minimum is 50 pieces';
      return out;
    }

    const size = formCtx?.decoConfig?.size || '3x3';
    const unit = svc().pricePerSticker(bundle.grid, size, totalQty);
    if (unit == null) { out.error = `No price for sticker size ${size}`; return out; }

    // Walk row.sizes and apply the same unit to each entry.
    Object.keys(row.sizes || {}).forEach(sizeKey => {
      const qty = Number(row.sizes[sizeKey]) || 0;
      if (!qty) return;
      out.unitPriceBySize[sizeKey] = unit;
      const lineSubtotal = unit * qty;
      out.sizeBreakdown.push({ size: sizeKey, qty, unitPrice: unit, lineSubtotal });
      out.rowSubtotal += lineSubtotal;
    });

    // Sticker tier label = qty tier matched
    const tierMatch = bundle.grid
      .filter(g => g.Size === size)
      .sort((a, b) => a.Quantity - b.Quantity)
      .reduce((acc, g) => g.Quantity <= totalQty ? g : acc, null);
    out.tier = tierMatch ? `${tierMatch.Quantity}+` : null;
    out.extras = {
      stickerSize: size,
      newArtwork: !!formCtx?.decoConfig?.newArtwork,
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
      return hasQty;
    });

    let bundle = null;
    try { bundle = await fetchBundleForRow(null, formCtx); }
    catch (err) { out.errors.push({ message: err?.message || String(err) }); }

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

    // One-time setup fee for new artwork
    if (formCtx?.decoConfig?.newArtwork) {
      const fee = bundle?.setupFee || 50;
      out.fees = [{ label: 'Sticker setup / new artwork', amount: fee }];
      out.subtotal += fee;
    }

    out.grandTotal = out.subtotal;
    return out;
  }

  function buildNotesBlock({ formCtx, breakdown }) {
    const cfg = formCtx?.decoConfig || {};
    const lines = [
      `STICKERS · ${cfg.size || '3x3'}`,
      `${breakdown?.totalQty || 0} pcs`,
    ];
    if (cfg.newArtwork) lines.push('New artwork — $50 setup fee included');
    return lines.join('\n');
  }

  function buildDesignContext() {
    return { designTypeId: 3, method: 'sticker' };
  }

  function ConfigBar({ config, setConfig }) {
    const size = config.size || '3x3';
    return (
      <div className="deco-config-strip" data-method="sticker">
        <div className="dcs-field">
          <label className="dcs-lbl">Sticker size</label>
          <select className="dcs-input" value={size} onChange={(e) => setConfig({ ...config, size: e.target.value })}>
            {SIZES.map(s => <option key={s} value={s}>{s}"</option>)}
          </select>
        </div>
        <label className="dcs-checkbox">
          <input
            type="checkbox"
            checked={!!config.newArtwork}
            onChange={(e) => setConfig({ ...config, newArtwork: e.target.checked })}
          />
          <span>New artwork (+$50 setup)</span>
        </label>
        <div className="dcs-hint">
          Min 50 pcs · Volume tiers at 50 / 100 / 200 (best value) / 300 / 500 / 1K / 2K / 3K / 5K / 10K
        </div>
      </div>
    );
  }

  // Phase 3 — rail filter. Sticker services + universals.
  function getRailServices(formCtx, customerOverrides = {}) {
    return S.filterRailServices(['STICKER', 'UNIVERSAL'], customerOverrides);
  }

  window.OrderFormPricing.register('sticker', {
    method: 'sticker',
    label: 'Stickers',
    verified: false,
    betaNote: 'Cross-check totals against /calculators/sticker-manual-pricing.html before sending to ShopWorks',
    referenceUrl: '/calculators/sticker-manual-pricing.html',
    defaultFormConfig: () => ({ size: '3x3', newArtwork: false }),
    defaultRowConfig:  () => ({}),
    ConfigBar,
    tierForQty: () => null,
    fetchBundle: fetchBundleForRow,
    priceRow,
    aggregate,
    buildNotesBlock,
    buildDesignContext,
    getRailServices,
  });
})();
