// Order-Form Pricing — Embroidery (flat + cap, auto-detect).
//
// Verified=true (no Beta chip). MVP: single 8K-stitch logo at one primary
// location. Wraps the existing EmbroideryPricingService and
// CapEmbroideryPricingService — same code path that powers /pricing/embroidery
// and /pricing/cap-embroidery, so prices are guaranteed to match.
//
// LTM ($50 distributed into per-piece) for tier 1-7, "builtin" mode — matches
// embroidery quote builder default (embroidery-quote-pricing.js:683).

(function () {
  const { useState } = React;
  const S = window.OrderFormPricingShared;

  // Lazy singleton services — instantiated on first use.
  let _embSvc = null, _capSvc = null;
  function embSvc() { return _embSvc ||= new window.EmbroideryPricingService(); }
  function capSvc() { return _capSvc ||= new window.CapEmbroideryPricingService(); }

  const PRIMARY_LOCATIONS = [
    'Left Chest', 'Right Chest', 'Center Chest',
    'Left Sleeve', 'Right Sleeve',
    'Hat Front', 'Hat Back', 'Hat Side',
    'Back Yoke',
  ];

  // ---------------------------------------------------------------------------
  // Cap vs flat detection (per row).
  //   1. Per-row override (rowDecoConfig.capOrFlat = 'cap' | 'flat') wins.
  //   2. ProductCategoryFilter.isFlatHeadwear()  → 'flat' (beanies → flat machine)
  //   3. ProductCategoryFilter.isStructuredCap() → 'cap'
  //   4. All sizes used are OSFA → 'cap'
  //   5. Otherwise → 'flat'
  // ---------------------------------------------------------------------------
  function detectCapOrFlat(row) {
    const override = row?.rowDecoConfig?.capOrFlat;
    if (override === 'cap' || override === 'flat') return override;
    const product = {
      label: row?.desc || '',
      value: row?.style || '',
      PRODUCT_TITLE: row?.desc || '',
    };
    const F = window.ProductCategoryFilter;
    if (F?.isFlatHeadwear(product)) return 'flat';
    if (F?.isStructuredCap(product)) return 'cap';
    const sizeKeys = Object.keys(row?.sizes || {}).filter(k => Number(row.sizes[k]) > 0);
    if (sizeKeys.length && sizeKeys.every(k => k === 'OSFA')) return 'cap';
    return 'flat';
  }

  // ---------------------------------------------------------------------------
  // Bundle fetch — routed via the registry's cache.
  // Manual mode → service.generateManualPricingData(blankCost)
  // Live mode  → service.fetchPricingData(style)
  // ---------------------------------------------------------------------------
  async function fetchBundleForRow(row, formCtx) {
    const capOrFlat = detectCapOrFlat(row);
    const svc = (capOrFlat === 'cap') ? capSvc() : embSvc();
    const isManual = !!row.manualMode && Number(row.manualCost) > 0;

    const bundleKey = isManual
      ? `manual:${capOrFlat}:${Number(row.manualCost).toFixed(2)}`
      : `${capOrFlat}:${String(row.style || '').toUpperCase()}`;

    const fetcher = async () => {
      if (isManual) return await svc.generateManualPricingData(Number(row.manualCost));
      // In customer mode, never let URL ?manualCost leak through.
      if (formCtx?.customerMode) {
        try { svc.clearManualCostOverride?.(); } catch (_) {}
      }
      return await svc.fetchPricingData(String(row.style || '').toUpperCase());
    };

    const bundle = await window.OrderFormPricing.getBundle('embroidery', bundleKey, fetcher);
    return { bundle, capOrFlat };
  }

  // ---------------------------------------------------------------------------
  // Pure per-row pricing.
  // tier / ltmPP come from formCtx.totalQty (form-wide aggregate).
  //
  // Even when qty=0 (rep just typed a style, hasn't filled qty yet) we still
  // populate `extras.availableSizes` + `capOrFlat` so the form's size grid
  // can morph to the right shape (e.g. OSFA-only for Richardson 112) the
  // moment a style resolves. Otherwise the rep would face a chicken-and-egg
  // problem: no qty → no breakdown → no availableSizes → grid can't morph.
  // ---------------------------------------------------------------------------
  function priceRow({ row, formCtx, bundle, capOrFlat }) {
    const out = S.emptyRowBreakdown();
    const sizingPreview = bundle?.uniqueSizes && bundle.uniqueSizes.length
      ? { availableSizes: bundle.uniqueSizes, capOrFlat, manualMode: !!row.manualMode }
      : null;
    const totalQty = Number(formCtx?.totalQty) || 0;
    if (!totalQty) {
      // Sizing-only preview: form needs availableSizes to render the grid.
      if (sizingPreview) out.extras = sizingPreview;
      return out;
    }
    if (!bundle?.pricing) { out.error = 'No pricing bundle'; return out; }

    const tier = S.tierForQty(totalQty, S.EMBROIDERY_TIERS);
    if (!tier) { out.error = `No tier for qty ${totalQty}`; return out; }
    if (!bundle.pricing[tier]) { out.error = `No pricing for tier ${tier}`; return out; }

    const ltmPP   = (tier === '1-7' && totalQty > 0) ? (50 / totalQty) : 0;
    const rule    = bundle?.apiData?.rulesR?.RoundingMethod
                  || bundle?.rulesData?.RoundingMethod
                  || (capOrFlat === 'cap' ? 'HalfDollarUp' : 'CeilDollar');

    Object.keys(row.sizes || {}).forEach(sizeKey => {
      const qty = Number(row.sizes[sizeKey]) || 0;
      if (!qty) return;
      const baseForSize = bundle.pricing[tier][sizeKey];
      if (baseForSize == null) {
        out.sizeBreakdown.push({ size: sizeKey, qty, error: `No price for size ${sizeKey} (${capOrFlat})` });
        return;
      }
      const unit = S.roundPrice(baseForSize + ltmPP, rule);
      out.unitPriceBySize[sizeKey] = unit;
      const lineSubtotal = unit * qty;
      out.sizeBreakdown.push({ size: sizeKey, qty, unitPrice: unit, lineSubtotal });
      out.rowSubtotal += lineSubtotal;
    });

    // Sizing metadata for display: which sizes this product comes in, and the
    // relative upcharges so the UI can render "+$2 2XL · +$3 3XL". Base price
    // is the standard (S or first sortOrder) tier price — the headline.
    const availableSizes = (bundle.uniqueSizes && bundle.uniqueSizes.length)
      ? bundle.uniqueSizes
      : Object.keys(bundle.pricing?.[tier] || {});
    const baseSizeKey = availableSizes.find(s => /^s$/i.test(s)) || availableSizes[0];
    const basePrice = bundle.pricing?.[tier]?.[baseSizeKey] != null
      ? S.roundPrice(bundle.pricing[tier][baseSizeKey] + ltmPP, rule)
      : null;
    const baseAbs = Number(bundle.sellingPriceDisplayAddOns?.[baseSizeKey] || 0);
    const sizeUpcharges = {};
    Object.keys(bundle.sellingPriceDisplayAddOns || {}).forEach(sz => {
      const rel = Number(bundle.sellingPriceDisplayAddOns[sz] || 0) - baseAbs;
      if (rel > 0) sizeUpcharges[sz] = rel;
    });

    out.tier   = tier;
    out.extras = {
      capOrFlat,
      ltmPerPiece: ltmPP,
      stitchCount: formCtx?.decoConfig?.stitchCount || 8000,
      primaryLocation: formCtx?.decoConfig?.primaryLocation || 'Left Chest',
      manualMode: !!row.manualMode,
      manualCost: row.manualMode ? Number(row.manualCost) || 0 : 0,
      // Display metadata for the price-cell breakdown chip + size-picker filter
      availableSizes,
      baseSizeKey,
      basePrice,
      sizeUpcharges,    // { size: relative_upcharge_dollars }
    };
    return out;
  }

  // ---------------------------------------------------------------------------
  // Order-level aggregate.
  // ---------------------------------------------------------------------------
  async function aggregate({ rows, formCtx }) {
    const out = S.emptyOrderBreakdown();
    out.totalQty = S.totalQtyAcrossRows(rows);
    // No early-exit when totalQty=0 — we still need to resolve bundles for
    // rows with style only, so the form can publish availableSizes/capOrFlat
    // to the UI and morph the size grid (e.g. OSFA-only for Richardson 112).
    if (out.totalQty) out.tier = S.tierForQty(out.totalQty, S.EMBROIDERY_TIERS);

    // Fetch all bundles in parallel — registry-level cache means second call
    // for the same (capOrFlat, style) is instant.
    //
    // Targets include rows with style+manualMode REGARDLESS of qty so the form
    // can publish availableSizes + capOrFlat to the UI even before the rep
    // enters a qty. priceRow() returns a sizing-only preview (rowSubtotal=0)
    // for those rows; the breakdown row UI suppresses itself when subtotal=0.
    const targets = (rows || []).filter(r => {
      if (!r) return false;
      const hasStyle = !!(r.style && r.style.trim());
      const hasManual = !!r.manualMode && Number(r.manualCost) > 0;
      return hasStyle || hasManual;
    });

    const fetched = await Promise.all(targets.map(async (r) => {
      try { return { row: r, ...(await fetchBundleForRow(r, formCtx)) }; }
      catch (err) { return { row: r, error: err?.message || String(err) }; }
    }));

    fetched.forEach(({ row, bundle, capOrFlat, error }) => {
      if (error || !bundle) {
        out.errors.push({ rowId: row.id, message: error || 'No bundle' });
        out.byRow.set(row.id, { ...S.emptyRowBreakdown(), error: error || 'No bundle' });
        return;
      }
      const rb = priceRow({ row, formCtx, bundle, capOrFlat });
      out.byRow.set(row.id, rb);
      out.subtotal += rb.rowSubtotal;
    });

    // LTM total (for display only) — already baked into per-piece prices.
    if (out.tier === '1-7') out.ltmTotal = 50;

    out.grandTotal = out.subtotal; // tax/deposit added by registry
    return out;
  }

  // ---------------------------------------------------------------------------
  // Notes block + design context for ManageOrders push.
  // ---------------------------------------------------------------------------
  function buildNotesBlock({ formCtx, breakdown }) {
    const cfg = formCtx?.decoConfig || {};
    const stitch = cfg.stitchCount || 8000;
    const loc    = cfg.primaryLocation || 'Left Chest';
    const tier   = breakdown?.tier || '?';
    const qty    = breakdown?.totalQty || 0;
    const ltmLine = breakdown?.tier === '1-7'
      ? `LTM: $50 distributed across ${qty} pieces (built into per-piece pricing)`
      : 'No LTM';
    return [
      `EMBROIDERY · ${stitch.toLocaleString()} stitches · ${loc}`,
      `Tier ${tier} · ${qty} pcs · ${ltmLine}`,
    ].join('\n');
  }

  function buildDesignContext({ formCtx }) {
    const cfg = formCtx?.decoConfig || {};
    return {
      designTypeId: 3,
      primaryLocation: cfg.primaryLocation || 'Left Chest',
      stitchCount: cfg.stitchCount || 8000,
    };
  }

  // ---------------------------------------------------------------------------
  // ConfigBar — renders inline under the deco checkboxes when Embroidery is on.
  // ---------------------------------------------------------------------------
  function ConfigBar({ config, setConfig }) {
    const stitch = config.stitchCount ?? 8000;
    const loc    = config.primaryLocation ?? 'Left Chest';
    return (
      <div className="deco-config-strip emb-config" data-method="embroidery">
        <div className="dcs-field">
          <label className="dcs-lbl">Stitches</label>
          <input
            className="dcs-input dcs-input--num"
            type="number" min="0" step="500"
            value={stitch}
            onChange={(e) => setConfig({ ...config, stitchCount: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="dcs-field">
          <label className="dcs-lbl">Primary location</label>
          <select
            className="dcs-input"
            value={loc}
            onChange={(e) => setConfig({ ...config, primaryLocation: e.target.value })}
          >
            {PRIMARY_LOCATIONS.map(L => <option key={L} value={L}>{L}</option>)}
          </select>
        </div>
        <div className="dcs-hint">
          8,000 stitches included · Cap vs flat auto-detected per product · v2: per-row stitch + extra-stitch surcharge + multiple logos
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Register
  // ---------------------------------------------------------------------------
  window.OrderFormPricing.register('embroidery', {
    method: 'embroidery',
    label: 'Embroidery',
    verified: true,
    betaNote: '',
    referenceUrl: '/pricing/embroidery',
    defaultFormConfig: () => ({ stitchCount: 8000, primaryLocation: 'Left Chest' }),
    defaultRowConfig:  () => ({ capOrFlat: 'auto' }),
    ConfigBar,
    tierForQty: (qty) => S.tierForQty(qty, S.EMBROIDERY_TIERS),
    fetchBundle: fetchBundleForRow,
    priceRow,
    aggregate,
    buildNotesBlock,
    buildDesignContext,
  });
})();
