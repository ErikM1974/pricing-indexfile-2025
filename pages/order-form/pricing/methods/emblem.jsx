// Order-Form Pricing — Embroidered Emblems / Patches.
//
// Phase 5a (2026-05-03) — emblem extras (metallic thread, velcro backing,
// extra colors, new-design digitizing) migrated from ConfigBar checkboxes
// to drag-and-drop rail cards. Cards are method-local "virtual" entries
// registered with OrderFormServiceCodes.registerVirtual — they participate
// in all rail / addOns plumbing exactly like Caspio rows. The emblem
// aggregate() translates dropped addOns back into internal flags before
// calling EmblemPricingService.calculateUnit, so existing pricing math
// (25% metallic, 25% velcro, 10% per extra color baked into the per-piece
// price) stays unchanged. Verified after the migration.

(function () {
  const S = window.OrderFormPricingShared;

  let _svc = null;
  function svc() { return _svc ||= new window.EmblemPricingService(); }

  // Phase 5a — method-local rail cards. Registered with
  // OrderFormServiceCodes.registerVirtual so the rail filter discovers them
  // alongside Caspio entries. PricingMethod='CONFIGURATOR' marks the
  // metallic/velcro/extra-color cards as percentage configurators (no
  // separate line item — markup baked into per-piece price). NEW-DESIGN is
  // a regular FIXED $100 fee so it bills as its own line item.
  const VIRTUAL_CARDS = [
    {
      ServiceCode: 'EMB-METALLIC',
      DisplayName: 'Metallic Thread',
      ServiceType: 'EMBLEM',
      RailGroup: 'Emblem Extras',
      RailOrder: 10,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: '+25% per piece',
      IsActive: true,
      Visible: true,
      _emblemFlag: 'metallicThread',
    },
    {
      ServiceCode: 'EMB-VELCRO',
      DisplayName: 'Velcro Backing',
      ServiceType: 'EMBLEM',
      RailGroup: 'Emblem Extras',
      RailOrder: 20,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: '+25% per piece',
      IsActive: true,
      Visible: true,
      _emblemFlag: 'velcroBacking',
    },
    {
      ServiceCode: 'EMB-COLOR',
      DisplayName: 'Extra Color',
      ServiceType: 'EMBLEM',
      RailGroup: 'Emblem Extras',
      RailOrder: 30,
      PricingMethod: 'CONFIGURATOR',
      SellPrice: 0,
      PerUnit: '+10% per piece',
      IsActive: true,
      Visible: true,
      _emblemFlag: 'extraColors',
      _emblemCountable: true,  // drop multiple times → +10% × N
    },
    {
      ServiceCode: 'EMB-NEW-DESIGN',
      DisplayName: 'New Design Digitizing',
      ServiceType: 'EMBLEM',
      RailGroup: 'Emblem Extras',
      RailOrder: 40,
      PricingMethod: 'FIXED',
      SellPrice: 100,
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
    return await window.OrderFormPricing.getBundle('emblem', 'all', fetcher);
  }

  // Phase 5a — translate dropped addOns into the per-piece pricing flags
  // EmblemPricingService.calculateUnit expects. CONFIGURATOR cards toggle
  // boolean flags (metallicThread/velcroBacking) or count occurrences
  // (extraColors). NEW-DESIGN is a real FIXED $100 fee — handled by the
  // shared addOn rollup in registry.js, NOT here.
  function flagsFromAddOns(addOns) {
    const flags = { metallicThread: false, velcroBacking: false, extraColors: 0 };
    (addOns || []).forEach(a => {
      if (!a?.code) return;
      if (a.code === 'EMB-METALLIC') flags.metallicThread = true;
      else if (a.code === 'EMB-VELCRO') flags.velcroBacking = true;
      else if (a.code === 'EMB-COLOR')   flags.extraColors += 1;
    });
    return flags;
  }

  function priceRow({ row, formCtx, bundle, addOnFlags }) {
    const out = S.emptyRowBreakdown();
    const totalQty = Number(formCtx?.totalQty) || 0;
    if (!totalQty) return out;
    if (!bundle) { out.error = 'No emblem pricing'; return out; }
    if (totalQty < 25) {
      out.error = 'Emblem minimum is 25 pieces';
      return out;
    }

    const cfg = formCtx?.decoConfig || {};
    const flags = addOnFlags || { metallicThread: false, velcroBacking: false, extraColors: 0 };
    const calc = svc().calculateUnit({
      grid:  bundle.grid,
      rules: bundle.rules,
      width:  Number(cfg.width)  || 0,
      height: Number(cfg.height) || 0,
      qty:    totalQty,
      metallicThread: !!flags.metallicThread,
      velcroBacking:  !!flags.velcroBacking,
      extraColors:    Number(flags.extraColors) || 0,
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
      flags,
    };
    return out;
  }

  async function aggregate({ rows, formCtx, addOns }) {
    const out = S.emptyOrderBreakdown();
    out.totalQty = S.totalQtyAcrossRows(rows);
    if (!out.totalQty) return out;

    let bundle = null;
    try { bundle = await fetchBundleForRow(null, formCtx); }
    catch (err) { out.errors.push({ message: err?.message || String(err) }); }

    // Phase 5a — derive per-piece pricing flags from CONFIGURATOR addOns.
    // Single source of truth — flagsFromAddOns walks the array once and
    // priceRow gets the resolved values.
    const addOnFlags = flagsFromAddOns(addOns);

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
      const rb = priceRow({ row, formCtx, bundle, addOnFlags });
      out.byRow.set(row.id, rb);
      out.subtotal += rb.rowSubtotal;
      if (!out.tier) out.tier = rb.tier;
    });

    // EMB-NEW-DESIGN ($100 digitizing) is now an addon — handled by the
    // shared registry rollup (applyAddOnsToBreakdown). Inline newDesign
    // fee logic was removed; the addon flows into the order-level subtotal
    // automatically.

    if (out.totalQty < 200 && out.totalQty > 0) out.ltmTotal = 50;
    out.grandTotal = out.subtotal;
    return out;
  }

  function buildNotesBlock({ formCtx, breakdown, addOns }) {
    const cfg = formCtx?.decoConfig || {};
    const dims = `${Number(cfg.width || 0).toFixed(2)}" × ${Number(cfg.height || 0).toFixed(2)}"`;
    // Phase 5a — addons resolve from the addOns array, not decoConfig flags
    const flags = flagsFromAddOns(addOns);
    const hasNewDesign = (addOns || []).some(a => a?.code === 'EMB-NEW-DESIGN');
    const extras = [
      flags.metallicThread ? 'metallic thread (+25%)' : '',
      flags.velcroBacking  ? 'velcro backing (+25%)' : '',
      flags.extraColors > 0 ? `${flags.extraColors} extra color${flags.extraColors > 1 ? 's' : ''} (+${flags.extraColors * 10}%)` : '',
    ].filter(Boolean).join(', ') || 'none';
    const lines = [
      `EMBLEMS · ${dims}`,
      `${breakdown?.totalQty || 0} pcs · Markups: ${extras}`,
    ];
    if (hasNewDesign) lines.push('New design — $100 digitizing fee (separate line item)');
    if ((breakdown?.totalQty || 0) < 200) lines.push(`LTM: $50 distributed at $${(50/Math.max(1, breakdown?.totalQty || 1)).toFixed(2)}/pc (built into per-piece pricing)`);
    return lines.join('\n');
  }

  function buildDesignContext() {
    return { designTypeId: 3, method: 'emblem' };
  }

  // Phase 5a — ConfigBar now holds only the inherent emblem properties
  // (width × height). Add-ons (metallic, velcro, extra colors, new design)
  // moved to drag-and-drop rail cards. Same pattern as embroidery's
  // Phase 4d cleanup — single edit surface, fewer chrome.
  function ConfigBar({ config, setConfig }) {
    return (
      <div className="deco-config-strip" data-method="emblem">
        <div className="dcs-caption" aria-hidden>
          Emblem dimensions — drag extras (metallic, velcro, etc.) from the rail.
        </div>
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
        <div className="dcs-hint">
          Min 25 pcs · LTM under 200 pcs · Tiers at 25/50/100/200/300/500/1K/2K/5K/10K
        </div>
      </div>
    );
  }

  // Phase 3 — rail filter. Emblem services + universals.
  function getRailServices(formCtx, customerOverrides = {}) {
    return S.filterRailServices(['EMBLEM', 'UNIVERSAL'], customerOverrides);
  }

  window.OrderFormPricing.register('emblem', {
    method: 'emblem',
    label: 'Emblems',
    // Phase 5a (2026-05-03) — verified after the addon migration. Pricing
    // math is unchanged (still wraps EmblemPricingService.calculateUnit
    // with the same flags), only the input surface moved from ConfigBar
    // checkboxes to rail cards. Per-piece + total parity with
    // /calculators/embroidered-emblem/ confirmed during testing.
    verified: true,
    betaNote: '',
    referenceUrl: '/calculators/embroidered-emblem/',
    defaultFormConfig: () => ({ width: 3, height: 3 }),
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
