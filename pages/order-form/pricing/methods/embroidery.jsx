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
  // Tier / LTM come from the row's CATEGORY-SPECIFIC qty bucket — caps and
  // garments tier independently per the embroidery quote builder rule
  // (CLAUDE.md "Mixed Quote Tier Separation"). The aggregate() function
  // pre-computes `formCtx._embCapQty` and `formCtx._embGarmentQty`; this
  // function picks the right bucket based on `capOrFlat`. Falls back to
  // form-wide totalQty if the buckets aren't present (back-compat path,
  // shouldn't happen in production).
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
    // Use category-specific qty for tier + LTM. capOrFlat='cap' → only count
    // other caps; 'flat' → only count garments. NEVER combine — caps and
    // garments are separate quantity discount streams.
    const capQty = Number(formCtx?._embCapQty);
    const garmentQty = Number(formCtx?._embGarmentQty);
    const haveBuckets = Number.isFinite(capQty) || Number.isFinite(garmentQty);
    const effectiveQty = haveBuckets
      ? (capOrFlat === 'cap' ? (capQty || 0) : (garmentQty || 0))
      : (Number(formCtx?.totalQty) || 0);
    if (!effectiveQty) {
      // Sizing-only preview: form needs availableSizes to render the grid.
      if (sizingPreview) out.extras = sizingPreview;
      return out;
    }
    if (!bundle?.pricing) { out.error = 'No pricing bundle'; return out; }

    const tier = S.tierForQty(effectiveQty, S.EMBROIDERY_TIERS);
    if (!tier) { out.error = `No tier for qty ${effectiveQty}`; return out; }
    if (!bundle.pricing[tier]) { out.error = `No pricing for tier ${tier}`; return out; }

    // LTM is per-CATEGORY too: 5 garments + 3 caps under the tier-1-7 threshold
    // both get $50 LTM distributed within their own bucket. Matches the
    // embroidery quote builder rule (CLAUDE.md sync rule).
    const ltmPP   = (tier === '1-7' && effectiveQty > 0) ? (50 / effectiveQty) : 0;
    // Rounding rule: prefer the Caspio-supplied rule (in production both cap +
    // flat services pull it from the EmbroideryRules table, so the surfaces
    // agree). Fallback HARMONIZED with embroidery-quote-pricing.js — both cap
    // and flat default to HalfDollarUp (matches Quote Builder's roundCapPrice +
    // roundPrice behavior). Previously the fallback used CeilDollar for flat
    // garments, which produced a $0.50/piece divergence vs Quote Builder when
    // Caspio was silent on rules. Fixed 2026-05-03.
    const rule    = bundle?.apiData?.rulesR?.RoundingMethod
                  || bundle?.rulesData?.RoundingMethod
                  || 'HalfDollarUp';

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
    // Scope upcharges to sizes the product actually offers. The bundle's
    // sellingPriceDisplayAddOns map is global (lists upcharges for every
    // possible extended size — 2XL/3XL/4XL/2XLT/XXL/etc.) regardless of
    // what the picked product carries. Without this filter, PC61Y (youth,
    // S-XL only) would show a misleading "+$2 2XL" chip even though youth
    // doesn't have 2XL.
    const baseAbs = Number(bundle.sellingPriceDisplayAddOns?.[baseSizeKey] || 0);
    const availableSet = new Set(availableSizes.map(s => String(s).toUpperCase()));
    const sizeUpcharges = {};
    Object.keys(bundle.sellingPriceDisplayAddOns || {}).forEach(sz => {
      if (!availableSet.has(String(sz).toUpperCase())) return;
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

    // Partition rows into caps vs garments and tally each bucket separately.
    // CLAUDE.md "Mixed Quote Tier Separation" rule: caps and garments cannot
    // share a quantity discount tier. priceRow() consumes these via formCtx.
    let capQty = 0, garmentQty = 0;
    fetched.forEach(({ row, capOrFlat: cof, error }) => {
      if (error || !cof) return;
      const rq = S.rowQty(row);
      if (cof === 'cap') capQty += rq;
      else garmentQty += rq;
    });
    formCtx._embCapQty = capQty;
    formCtx._embGarmentQty = garmentQty;
    out.capQty = capQty;
    out.garmentQty = garmentQty;
    out.capTier = capQty > 0 ? S.tierForQty(capQty, S.EMBROIDERY_TIERS) : null;
    out.garmentTier = garmentQty > 0 ? S.tierForQty(garmentQty, S.EMBROIDERY_TIERS) : null;

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
    // Each category that lands in tier 1-7 carries its own $50 LTM, so a
    // mixed order with 5 garments + 3 caps shows $100 total LTM.
    let ltmTotal = 0;
    if (out.garmentTier === '1-7') ltmTotal += 50;
    if (out.capTier === '1-7') ltmTotal += 50;
    out.ltmTotal = ltmTotal;

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

    // Caps and garments tier independently. When the order has both, show
    // both tiers + qtys. When only one category, show that one.
    const capQty = Number(breakdown?.capQty) || 0;
    const garmentQty = Number(breakdown?.garmentQty) || 0;
    const capTier = breakdown?.capTier || null;
    const garmentTier = breakdown?.garmentTier || null;

    const tierLines = [];
    if (garmentQty > 0) {
      const ltm = garmentTier === '1-7'
        ? `(LTM $50 distributed across ${garmentQty} garments)` : '';
      tierLines.push(`Garments — Tier ${garmentTier || '?'} · ${garmentQty} pcs ${ltm}`.trim());
    }
    if (capQty > 0) {
      const ltm = capTier === '1-7'
        ? `(LTM $50 distributed across ${capQty} caps)` : '';
      tierLines.push(`Caps — Tier ${capTier || '?'} · ${capQty} pcs ${ltm}`.trim());
    }
    // Fallback for unexpected shape (no buckets populated): use the
    // legacy single-tier line so we never push an empty notes block.
    if (tierLines.length === 0) {
      const tier = breakdown?.tier || '?';
      const qty  = breakdown?.totalQty || 0;
      tierLines.push(`Tier ${tier} · ${qty} pcs`);
    }
    return [
      `EMBROIDERY · ${stitch.toLocaleString()} stitches · ${loc}`,
      ...tierLines,
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
  // Stitch surcharge tier classifier — mirrors the canonical NWCA policy
  // stored in Caspio Embroidery_Costs (rows ItemType='AS-Cap'/'AS-Garm').
  //
  //   ≤ 10,000 stitches → Standard tier ($0, included in base price)
  //   ≤ 15,000          → Mid tier (+$4 per piece)
  //   ≤ 25,000          → Large tier (+$10 per piece)
  //   > 25,000          → Full Back territory (use Quote Builder for DECG-FB)
  //
  // Same scale for caps and garments (Erik confirmed 2026-05-03). Same
  // formula as Quote Builder's getStitchSurcharge() (embroidery-quote-pricing.js:814).
  // ---------------------------------------------------------------------------
  function classifyStitchTier(stitchCount) {
    const n = Number(stitchCount) || 0;
    if (n <= 10000) return { tier: 'Standard', surcharge: 0,  level: 'ok',  hint: 'Included in base price' };
    if (n <= 15000) return { tier: 'Mid',      surcharge: 4,  level: 'mid', hint: 'Add AS-CAP / AS-Garm' };
    if (n <= 25000) return { tier: 'Large',    surcharge: 10, level: 'lg',  hint: 'Add AS-CAP / AS-Garm' };
    return { tier: 'Full Back', surcharge: null, level: 'fb',  hint: 'Use Quote Builder for DECG-FB pricing' };
  }

  // Apply the current tier as AS-CAP (per cap row) and AS-Garm (per garment row)
  // add-on entries. Removes any existing AS surcharge entries first so re-apply
  // after a stitch-count change replaces (not stacks).
  function applyStitchSurchargeFromConfig(stitchCount) {
    const app = window.OrderFormApp;
    if (!app) { console.warn('[embroidery] OrderFormApp not exposed yet'); return; }
    const { rows, breakdown, addOns, setAddOns } = app;
    const tierInfo = classifyStitchTier(stitchCount);
    if (tierInfo.level === 'ok' || tierInfo.level === 'fb') return;

    // Strip prior AS-CAP/AS-Garm entries — re-apply with current tier
    const cleaned = (addOns || []).filter(a => a.code !== 'AS-CAP' && a.code !== 'AS-Garm');

    const mkId = () => 'addon_' + Math.random().toString(36).slice(2, 10);
    const newEntries = [];
    (rows || []).forEach(r => {
      const rb = breakdown?.byRow?.get?.(r.id) || breakdown?.byRow?.[r.id];
      const cof = rb?.extras?.capOrFlat;
      const rowQty = Object.values(r?.sizes || {}).reduce((s, v) => s + (Number(v) || 0), 0);
      if (rowQty <= 0 || (cof !== 'cap' && cof !== 'flat')) return;
      newEntries.push({
        id: mkId(),
        code: cof === 'cap' ? 'AS-CAP' : 'AS-Garm',
        qty: rowQty,
        scope: { rowId: r.id },
        params: { stitchCount: Number(stitchCount), unitPrice: tierInfo.surcharge },
      });
    });
    if (newEntries.length === 0) {
      // No qualifying rows — alert the rep so they can add rows first
      console.warn('[embroidery] No cap/garment rows with qty>0 to attach surcharge to');
      return;
    }
    setAddOns([...cleaned, ...newEntries]);
  }

  // ---------------------------------------------------------------------------
  // ConfigBar — renders inline under the deco checkboxes when Embroidery is on.
  // Includes the smart tier indicator + one-click Apply button when surcharge
  // is needed.
  // ---------------------------------------------------------------------------
  function ConfigBar({ config, setConfig }) {
    const stitch = config.stitchCount ?? 8000;
    const loc    = config.primaryLocation ?? 'Left Chest';
    const tierInfo = classifyStitchTier(stitch);

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

        {/* Smart tier indicator. Always visible — green at low stitches gives
            positive feedback that no surcharge is needed; amber/orange at
            higher stitches shows exactly what to add and offers a one-click
            Apply. The math is canonical NWCA flat-tier policy (Caspio
            Embroidery_Costs AS-Cap/AS-Garm rows) — same as Quote Builder. */}
        <div className={`dcs-tier dcs-tier--${tierInfo.level}`} role="status">
          {tierInfo.level === 'ok' && (
            <>
              <span className="dcs-tier-badge">✓ Standard tier</span>
              <span className="dcs-tier-text">{stitch.toLocaleString()} stitches · {tierInfo.hint}</span>
            </>
          )}
          {(tierInfo.level === 'mid' || tierInfo.level === 'lg') && (
            <>
              <span className="dcs-tier-badge">⚠ {tierInfo.tier} tier</span>
              <span className="dcs-tier-text">
                {stitch.toLocaleString()} stitches · <strong>+${tierInfo.surcharge} per piece</strong> surcharge needed
              </span>
              <button
                type="button"
                className="dcs-tier-apply"
                onClick={() => applyStitchSurchargeFromConfig(stitch)}
                title="Adds AS-CAP per cap row + AS-Garm per garment row at the matching tier price. Re-click after changing stitch count to refresh."
              >
                Apply +${tierInfo.surcharge}/pc surcharge
              </button>
            </>
          )}
          {tierInfo.level === 'fb' && (
            <>
              <span className="dcs-tier-badge">🔴 Full Back</span>
              <span className="dcs-tier-text">
                {stitch.toLocaleString()} stitches · use <a href="/quote-builders/embroidery-quote-builder.html" target="_blank" rel="noopener">Quote Builder</a> for DECG-FB pricing (above 25K is full-back coverage)
              </span>
            </>
          )}
        </div>

        <div className="dcs-hint">
          ≤10K Standard ($0) · ≤15K Mid (+$4) · ≤25K Large (+$10) · &gt;25K Full Back · Cap vs flat auto-detected per row
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
