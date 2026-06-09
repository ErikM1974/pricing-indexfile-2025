// Order-Form Pricing UI — DecoConfigStrip, TotalsPanel, RowTierBadge,
// BetaChip, ManualCostPill, ManualCostPrompt.
// All small components consumed by paper-form.jsx.

const { useState: _useStateT, useEffect: _useEffectT } = React;

// ---------------------------------------------------------------------------
// BetaChip — amber, dismissible per-session. Stays hidden until next session.
// ---------------------------------------------------------------------------
function BetaChip({ method, label, referenceUrl, note }) {
  const dismissKey = `nwOrderForm.beta.${method}`;
  const [dismissed, setDismissed] = _useStateT(() => {
    try { return sessionStorage.getItem(dismissKey) === '1'; } catch (_) { return false; }
  });
  if (dismissed) return null;
  return (
    <span className="beta-chip" title={note || `Cross-check ${label} prices against the production page until verified`}>
      <span className="beta-chip-dot" aria-hidden="true">●</span>
      Beta — cross-check against{' '}
      <a className="beta-chip-link" href={referenceUrl} target="_blank" rel="noreferrer">
        {label} pricing
      </a>
      <button
        type="button"
        className="beta-chip-dismiss"
        aria-label={`Dismiss ${label} beta notice for this session`}
        onClick={(e) => {
          e.preventDefault(); e.stopPropagation();
          try { sessionStorage.setItem(dismissKey, '1'); } catch (_) {}
          setDismissed(true);
        }}
      >×</button>
    </span>
  );
}

// ---------------------------------------------------------------------------
// DecoConfigStrip — renders the active method's ConfigBar inline under the
// deco checkboxes. Hidden when no method is selected or when the registry
// doesn't have a module for the chosen method.
// ---------------------------------------------------------------------------
function DecoConfigStrip({ deco, decoConfig, setDecoConfig }) {
  if (!deco) return null;
  const reg = window.OrderFormPricing;
  if (!reg) return null;
  const mod = reg.getMethod(deco);
  if (!mod) return null;

  const Bar = mod.ConfigBar;
  return (
    <div className="deco-config-strip-wrap">
      {Bar ? (
        <Bar config={decoConfig} setConfig={setDecoConfig} />
      ) : (
        <div className="deco-config-strip" data-method={deco}>
          <div className="dcs-hint">
            {mod.label} auto-pricing wired up. Configure inputs as needed.
          </div>
        </div>
      )}
      {!mod.verified && (
        <BetaChip
          method={mod.method}
          label={mod.label}
          referenceUrl={mod.referenceUrl || '#'}
          note={mod.betaNote}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// fmt$ — currency formatter used by the totals + row breakdowns.
// ---------------------------------------------------------------------------
function fmt$(n) {
  if (!Number.isFinite(Number(n))) return '$0.00';
  return Number(n).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// ---------------------------------------------------------------------------
// LTM threshold lookup per method — for the "Min-order pricing applies under
// N pieces" callout.
// ---------------------------------------------------------------------------
function ltmThresholdFor(deco) {
  switch (deco) {
    case 'embroidery':  return { threshold: 8,   label: 'under 8 pcs' };  // <=7 = LTM
    case 'screenprint': return { threshold: 24,  label: 'under 24 pcs' };
    case 'dtg':         return { threshold: 24,  label: 'under 24 pcs' };
    case 'dtf':         return { threshold: 24,  label: 'under 24 pcs' };
    case 'emblem':      return { threshold: 200, label: 'under 200 pcs' };
    case 'sticker':     return { threshold: 50,  label: 'under 50 pcs' };
    default:            return null;
  }
}

// ---------------------------------------------------------------------------
// TotalsPanel — slim, right-aligned summary below the line-items table.
//
// Renders empty placeholders when there's nothing to total yet, so the layout
// doesn't jump around as rows are added.
// ---------------------------------------------------------------------------
function TotalsPanel({ deco, decoConfig, breakdown, customerMode }) {
  const supported = !!breakdown?.supported;
  const ltm = ltmThresholdFor(deco);
  const totalQty   = breakdown?.totalQty   || 0;
  const subtotal   = breakdown?.subtotal   || 0;
  const tax        = breakdown?.taxEstimate || 0;
  const deposit    = breakdown?.depositDue  || 0;
  const grand      = (breakdown?.grandTotal || 0) + tax;
  const tier       = breakdown?.tier;
  const errors     = breakdown?.errors || [];

  // Phase 5.2 — pulse animation on grand total when a rail card lands
  const { useState, useEffect } = React;
  const [pulseTotal, setPulseTotal] = useState(false);
  useEffect(() => {
    function onDrop() {
      setPulseTotal(true);
      setTimeout(() => setPulseTotal(false), 750);
    }
    window.addEventListener('railDropSuccess', onDrop);
    return () => window.removeEventListener('railDropSuccess', onDrop);
  }, []);

  const decoLabel = (() => {
    const m = window.OrderFormPricing?.getMethod?.(deco);
    return m?.label || (deco ? deco.charAt(0).toUpperCase() + deco.slice(1) : '');
  })();

  // Method-specific config summary line ("8,000 stitches · Left Chest")
  const cfgLine = (() => {
    if (deco === 'embroidery' && decoConfig) {
      const sc = decoConfig.stitchCount ?? 8000;
      return `${sc.toLocaleString()} stitches · ${decoConfig.primaryLocation || 'Left Chest'}`;
    }
    return '';
  })();

  return (
    <div className="totals-panel screen-only" data-supported={supported ? '1' : '0'}>
      <div className="totals-panel-head">
        {decoLabel && <span className="tp-deco">{decoLabel}</span>}
        {cfgLine && <span className="tp-cfg">· {cfgLine}</span>}
        {tier && <span className="tp-tier">· Tier {tier}</span>}
      </div>

      <div className="totals-panel-grid">
        <div className="tp-row">
          <span className="tp-lbl">Subtotal {totalQty ? <span className="tp-dim">({totalQty} pcs)</span> : null}</span>
          <span className="tp-val">{fmt$(subtotal)}</span>
        </div>
        <div className="tp-row tp-row--dim">
          <span className="tp-lbl">{breakdown?.taxLabel || 'Estimated tax'}</span>
          <span className="tp-val">{fmt$(tax)}</span>
        </div>
        <div className="tp-row tp-row--total">
          <span className="tp-lbl">Total {tax > 0 ? <span className="tp-dim">(estimated)</span> : null}</span>
          <span className={'tp-val' + (pulseTotal ? ' total-counter--pulse' : '')}>{fmt$(grand)}</span>
        </div>
        <div className="tp-row tp-row--deposit">
          <span className="tp-lbl">50% deposit due</span>
          <span className="tp-val">{fmt$(deposit)}</span>
        </div>
      </div>

      <div className="totals-panel-footnote">
        {tier === '1-7' && (
          <span className="tp-note">LTM ($50) built into per-piece pricing.</span>
        )}
        {ltm && (!tier || tier === '1-7' || tier === '8-23' || tier === '1-23' || tier === '10-23') && (
          <span className="tp-note">Min-order pricing applies {ltm.label}.</span>
        )}
        {customerMode && supported && (
          <span className="tp-note tp-note--cust">Estimated pricing — final pricing confirmed by your sales rep.</span>
        )}
        {errors.length > 0 && (
          <span className="tp-note tp-note--err">⚠ {errors.length} pricing issue{errors.length === 1 ? '' : 's'}: {errors[0]?.message || 'see console'}</span>
        )}
        {!supported && deco && (
          <span className="tp-note tp-note--dim">Auto-pricing unavailable for this method — type prices manually.</span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RowTierBadge — tiny pill displayed inline when an auto-priced row has a
// computed breakdown. Mostly informational.
// ---------------------------------------------------------------------------
function RowTierBadge({ rowBreakdown }) {
  if (!rowBreakdown || rowBreakdown.error) return null;
  const tier = rowBreakdown.tier;
  const cap  = rowBreakdown.extras?.capOrFlat;
  if (!tier) return null;
  // Only call out "· cap" — embroidery's cap-vs-flat machine routing is the
  // useful case to surface. "flat" is internal jargon (every garment is
  // flat by default) so we drop it from the badge text.
  const isCap = cap === 'cap';
  return (
    <span className="row-tier-badge" title={`Pricing tier: ${tier} pcs${isCap ? ' · cap embroidery' : ''}`}>
      Tier {tier}{isCap && <span className="row-tier-cap">CAP</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ManualCostPill — small purple chip on rows that are in manual-cost mode.
// ---------------------------------------------------------------------------
function ManualCostPill({ row, onClear }) {
  if (!row?.manualMode) return null;
  return (
    <span className="manual-cost-pill" title={`Manual blank cost: $${Number(row.manualCost).toFixed(2)}`}>
      Manual ${Number(row.manualCost).toFixed(2)}
      {onClear && (
        <button type="button" className="manual-cost-pill-clear" onClick={onClear} aria-label="Clear manual cost">×</button>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ManualCostPrompt — small inline form that opens next to a row when its
// style isn't found in SanMar (or when the rep clicks the $ icon).
// ---------------------------------------------------------------------------
function ManualCostPrompt({ row, onApply, onCancel }) {
  const [cost, setCost] = _useStateT(row.manualCost || '');
  const [itemType, setItemType] = _useStateT(() => {
    const c = row?.rowDecoConfig?.capOrFlat;
    return (c === 'cap') ? 'cap' : 'garment';
  });

  function apply() {
    const n = Number(cost);
    if (!Number.isFinite(n) || n <= 0) return;
    onApply({ manualCost: n.toFixed(2), itemType });
  }

  return (
    <div className="manual-cost-prompt" role="dialog" aria-label="Enter blank cost">
      <div className="mcp-head">
        <strong>Style not found in SanMar</strong>
        <span className="mcp-hint">Enter the blank cost so we can price the decoration.</span>
      </div>
      <div className="mcp-body">
        <div className="mcp-toggle">
          <label className={itemType === 'garment' ? 'on' : ''}>
            <input type="radio" name="mcp-type" checked={itemType === 'garment'} onChange={() => setItemType('garment')} />
            Garment
          </label>
          <label className={itemType === 'cap' ? 'on' : ''}>
            <input type="radio" name="mcp-type" checked={itemType === 'cap'} onChange={() => setItemType('cap')} />
            Cap
          </label>
        </div>
        <div className="mcp-cost">
          <span className="mcp-cost-prefix">$</span>
          <input
            className="mcp-cost-input"
            type="number" step="0.01" min="0"
            value={cost}
            placeholder="0.00"
            onChange={(e) => setCost(e.target.value.replace(/[^0-9.]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') apply(); if (e.key === 'Escape') onCancel?.(); }}
            autoFocus
          />
          <span className="mcp-cost-unit">blank cost</span>
        </div>
      </div>
      <div className="mcp-foot">
        <button type="button" className="mcp-btn mcp-btn--ghost" onClick={onCancel}>Cancel</button>
        <button type="button" className="mcp-btn mcp-btn--primary" onClick={apply} disabled={!Number(cost)}>Apply</button>
      </div>
    </div>
  );
}

Object.assign(window, {
  DecoConfigStrip, TotalsPanel, RowTierBadge,
  BetaChip, ManualCostPill, ManualCostPrompt,
  fmt$, ltmThresholdFor,
});
