// Order-Form Pricing — Die-Cut Stickers.
//
// Phase 5b (2026-05-03) — newArtwork checkbox migrated to a rail card
// (STK-NEW-ART, FIXED $50). The sticker SIZE stays in ConfigBar (it's an
// inherent product property, not an extra). Verified after the migration.
//
// MVP convention: stickers are single-qty rows (no size grid). The rep enters
// the qty in any size cell on the row; the module sums across all cells and
// uses the form-wide sticker size from decoConfig.

(function () {
  const S = window.OrderFormPricingShared;

  let _svc = null;
  function svc() { return _svc ||= new window.StickerPricingService(); }

  const SIZES = ['2x2', '3x3', '4x4', '5x5'];

  // Phase 5b — virtual rail card. STK-NEW-ART is a real $50 fee (FIXED) so
  // it bills as its own line item via the shared addOn rollup — no special
  // CONFIGURATOR handling needed. Singleton enforcement via ORDER_LEVEL_CODES
  // means dropping again replaces the same instance instead of stacking.
  const VIRTUAL_CARDS = [
    {
      ServiceCode: 'STK-NEW-ART',
      DisplayName: 'New Artwork Setup',
      ServiceType: 'STICKER',
      RailGroup: 'Sticker Extras',
      RailOrder: 10,
      PricingMethod: 'FIXED',
      SellPrice: 50,
      PerUnit: 'one-time',
      IsActive: true,
      Visible: true,
    },
  ];
  if (window.OrderFormServiceCodes?.registerVirtual) {
    window.OrderFormServiceCodes.registerVirtual(VIRTUAL_CARDS);
  }

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

    // Phase 5b — STK-NEW-ART ($50 setup) is now an addon — handled by the
    // shared registry rollup (applyAddOnsToBreakdown). Inline newArtwork
    // fee logic was removed; the addon flows into the order-level subtotal
    // automatically via the FIXED-method path.

    out.grandTotal = out.subtotal;
    return out;
  }

  function buildNotesBlock({ formCtx, breakdown, addOns }) {
    const cfg = formCtx?.decoConfig || {};
    const hasNewArt = (addOns || []).some(a => a?.code === 'STK-NEW-ART');
    const lines = [
      `STICKERS · ${cfg.size || '3x3'}`,
      `${breakdown?.totalQty || 0} pcs`,
    ];
    if (hasNewArt) lines.push('New artwork — $50 setup fee (separate line item)');
    return lines.join('\n');
  }

  function buildDesignContext() {
    return { designTypeId: 3, method: 'sticker' };
  }

  // Phase 5b — sticker ConfigBar now holds only the inherent product
  // property (size). New-artwork setup fee moved to drag-and-drop rail card.
  function ConfigBar({ config, setConfig }) {
    const size = config.size || '3x3';
    return (
      <div className="deco-config-strip" data-method="sticker">
        <div className="dcs-caption" aria-hidden>
          Sticker size — drag the New Artwork setup card from the rail if needed.
        </div>
        <div className="dcs-field">
          <label className="dcs-lbl">Sticker size</label>
          <select className="dcs-input" value={size} onChange={(e) => setConfig({ ...config, size: e.target.value })}>
            {SIZES.map(s => <option key={s} value={s}>{s}"</option>)}
          </select>
        </div>
        <div className="dcs-hint">
          Min 50 pcs · Tiers at 50 / 100 / 200 (best value) / 300 / 500 / 1K / 2K / 3K / 5K / 10K
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
    // Phase 5b — verified after the addon migration. STK-NEW-ART now a
    // FIXED $50 addon billed via the shared rollup; per-piece sticker math
    // (StickerPricingService.pricePerSticker) unchanged.
    verified: true,
    betaNote: '',
    referenceUrl: '/calculators/sticker-manual-pricing.html',
    defaultFormConfig: () => ({ size: '3x3' }),
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
