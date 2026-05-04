// Order Form Service Rail — RailCard component (Phase 3c, 2026-05-03).
//
// One draggable card per Service_Codes row. Renders differently based on
// PricingMethod:
//
//   FIXED       → static price label, drag triggers
//   FLAT        → same as FIXED (qty=1 typical)
//   TIERED      → inline stitch input + live-resolved price (AL, AL-CAP,
//                 DECG-FB, CTR-Garmt, CTR-Cap). Plus the special tier-card
//                 mode (AS-CAP/AS-Garm Standard/Mid/Large — dragged whole)
//   CALCULATED  → percent display (RUSH 25% default)
//   HOURLY      → hours input (Art $75/hr × N)
//   PASSTHROUGH → amount input (Freight, Pallet, Discount, CDP)
//
// The card emits onDragStart with a payload that ServiceRail consumes:
//   { service, qty, scope, params: { stitchCount?, percent?, hours?, amount?, unitPrice? } }
//
// Standard tier cards (AS-CAP/AS-Garm Tier='Standard', SellPrice=$0) are
// rendered as informational chips — the rep doesn't need to drag $0 onto
// anything. They show "INCLUDED" badge instead of a drag handle.

(function () {
  'use strict';
  const { useState, useMemo, useEffect } = React;

  // PricingMethod variants that need an inline stitch input on the card.
  const STITCH_INPUT_CODES = new Set([
    'AL', 'AL-CAP', 'DECG-FB', 'CTR-Garmt', 'CTR-Cap',
  ]);

  // Phase 7 — codes that represent ADDITIONAL LOGOS (separate from primary).
  // Each gets a position dropdown so production knows where to embroider.
  // The position flows into ShopWorks Designs[].Locations[] + LinesOE
  // DisplayAsDescription on submit.
  const POSITION_INPUT_CODES = new Set([
    'AL', 'AL-CAP', 'DECG-FB', 'CTR-Garmt', 'CTR-Cap',
  ]);

  // Position options per code family. AL = additional GARMENT logo, AL-CAP =
  // additional CAP logo, DECG-FB = full back (implicit position).
  const GARMENT_POSITIONS = [
    'Right Sleeve', 'Left Sleeve', 'Right Chest', 'Center Chest',
    'Back Yoke', 'Hood', 'Right Pocket', 'Left Pocket', 'Custom',
  ];
  const CAP_POSITIONS = [
    'Hat Back', 'Hat Side (Left)', 'Hat Side (Right)', 'Visor', 'Crown', 'Custom',
  ];
  function positionsFor(code) {
    if (code === 'AL-CAP' || code === 'CTR-Cap') return CAP_POSITIONS;
    if (code === 'AL' || code === 'CTR-Garmt') return GARMENT_POSITIONS;
    if (code === 'DECG-FB') return ['Full Back'];
    return [];
  }
  function defaultPositionFor(code) {
    if (code === 'AL-CAP' || code === 'CTR-Cap') return 'Hat Back';
    if (code === 'DECG-FB') return 'Full Back';
    return 'Right Sleeve';  // AL / CTR-Garmt default
  }

  // Code → group accent class. Looked up from RailGroup column at render time.
  function groupClassFor(group) {
    const g = String(group || '').toLowerCase();
    if (g.includes('stitch')) return 'rail-card--stitch';
    if (g.includes('cap'))    return 'rail-card--cap';
    if (g.includes('garment'))return 'rail-card--garment';
    if (g.includes('setup'))  return 'rail-card--setup';
    if (g.includes('order'))  return 'rail-card--order';
    return '';
  }

  function fmt$(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return '$0';
    if (v === Math.floor(v)) return `$${v}`;
    return `$${v.toFixed(2)}`;
  }

  /**
   * @param {Object} props
   * @param {Object} props.service       Service_Codes row
   * @param {Function} props.onDragStart fired with payload { service, qty, scope, params }
   * @param {Function} props.onDragEnd
   * @param {Function} [props.onTap]     mobile tap-to-select handler (Phase 3f)
   * @param {boolean} [props.suggested]  per-customer auto-suggest hint (Phase 4 only)
   * @param {boolean} [props.dragging]   true when this card is currently being dragged
   * @param {boolean} [props.selected]   true when card is tap-selected on touch (Phase 3f)
   * @param {boolean} [props.isTouch]    true on touch devices (no hover capability)
   */
  function RailCard({ service, onDragStart, onDragEnd, onTap, suggested, dragging, selected, isTouch, nudge }) {
    const code = service.ServiceCode;
    const tier = service.Tier || '';
    const method = String(service.PricingMethod || '').toUpperCase();
    const sell = Number(service.SellPrice) || 0;
    const isStandardTier = (tier === 'Standard');

    // TIERED stitch input state (AL/AL-CAP/DECG-FB/CTR-*).
    // Phase 4d (2026-05-03) — the on-card stitch INPUT was removed. The card
    // now drags with a sensible default stitch count, and the rep edits
    // inline on the row sub-row (paper-form.jsx#AddOnSubRow). The default
    // value still drives the card's displayed "from $X/pc" price hint.
    const isStitchInput = STITCH_INPUT_CODES.has(code);
    const defaultStitches = useMemo(() => {
      if (code === 'AL-CAP') return 5000;
      if (code === 'DECG-FB') return 25000;
      return 8000;
    }, [code]);

    // CALCULATED (RUSH) percent
    const [percent, setPercent] = useState(25);

    // HOURLY (Art) hours
    const [hours, setHours] = useState(1);

    // PASSTHROUGH amount
    const [amount, setAmount] = useState(0);

    // Phase 7 — position for additional logos (AL/AL-CAP/DECG-FB/CTR-*).
    // Drives Designs[].Locations[] in the ShopWorks push so production knows
    // where each additional logo goes. Phase 4d removed the on-card position
    // dropdown — drop with default position, edit inline on the sub-row.
    const hasPositionInput = POSITION_INPUT_CODES.has(code);

    // Live-computed price for TIERED stitch-input cards. Computed at the
    // default stitch count (the card no longer takes user input here);
    // becomes a "from $X/pc" hint that helps reps gauge cost before dropping.
    //
    // Phase 4d (2026-05-03) — added `liveTick` so the price reactively
    // recomputes once tieredPricing.preload() resolves. Pre-Phase-4d the
    // on-card stitch input's state change masked this race; with the input
    // gone, we need an explicit trigger.
    const [liveTick, setLiveTick] = useState(0);
    useEffect(() => {
      if (!isStitchInput) return;
      const tp = window.OrderFormTieredPricing;
      if (!tp?.preload) return;
      let cancelled = false;
      tp.preload().then(() => {
        if (!cancelled) setLiveTick(t => t + 1);
      }).catch(() => {});
      return () => { cancelled = true; };
    }, [isStitchInput]);
    const livePrice = useMemo(() => {
      if (!isStitchInput) return null;
      const tp = window.OrderFormTieredPricing;
      if (!tp) return null;
      // Use a typical 24-qty for tier resolution
      const v = tp.resolveSync(code, { stitchCount: defaultStitches, qty: 24 });
      return Number.isFinite(v) ? v : null;
    }, [code, defaultStitches, isStitchInput, liveTick]);

    // Phase 6a (2026-05-03) — build a custom drag preview ghost. Replaces
    // the browser's default snapshot of the entire `.rail-card` element
    // with a compact pill ("AL-CAP · Additional Logo Cap"). The ghost is
    // attached for the OS drag image, then auto-removed from the DOM after
    // the OS has captured it. Position offset (-12, -12) puts the cursor
    // near the top-left of the pill so the rep can clearly see what they
    // grabbed without it obscuring the drop target underneath.
    function buildDragGhost(displayCode, displayLabel) {
      const ghost = document.createElement('div');
      ghost.className = 'rail-drag-ghost';
      ghost.setAttribute('aria-hidden', 'true');
      const codeEl = document.createElement('span');
      codeEl.className = 'rail-drag-ghost-code';
      codeEl.textContent = displayCode;
      const labelEl = document.createElement('span');
      labelEl.className = 'rail-drag-ghost-label';
      labelEl.textContent = displayLabel;
      ghost.appendChild(codeEl);
      ghost.appendChild(labelEl);
      // Off-screen so the user never sees the placeholder DOM node — only
      // the OS drag image rendered FROM it.
      ghost.style.position = 'fixed';
      ghost.style.top = '-9999px';
      ghost.style.left = '-9999px';
      document.body.appendChild(ghost);
      // Auto-cleanup after the OS finishes capturing (a single tick is
      // plenty — the drag image is a static snapshot, not a live element).
      setTimeout(() => {
        if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
      }, 0);
      return ghost;
    }

    // Drag start handler — builds the payload that ServiceRail consumes
    function handleDragStart(e) {
      if (isStandardTier) { e.preventDefault(); return; } // can't drag $0 included tier

      const payload = { service: { ...service }, qty: 0, scope: null, params: {} };

      // Different methods package differently
      switch (method) {
        case 'FIXED':
        case 'FLAT':
          payload.params = { unitPrice: sell };
          break;
        case 'TIERED':
          // For AS-CAP/AS-Garm tier rows: SellPrice IS the resolved price
          if (tier && (code === 'AS-CAP' || code === 'AS-Garm')) {
            payload.params = { tier, unitPrice: sell };
          } else {
            // AL/AL-CAP/DECG-FB/CTR-*: drop with sensible defaults — rep
            // edits stitch count + position inline on the row sub-row
            // (paper-form.jsx#AddOnSubRow). Phase 4d removed the on-card
            // inputs in favor of post-drop inline editing.
            payload.params = {
              stitchCount: defaultStitches,
              unitPrice: Number.isFinite(livePrice) ? livePrice : 0,
              position: defaultPositionFor(code),
            };
          }
          break;
        case 'CALCULATED':
          payload.params = { percent: Number(percent) || 25 };
          break;
        case 'HOURLY':
          payload.params = { hours: Number(hours) || 1, unitPrice: sell };
          break;
        case 'PASSTHROUGH':
          payload.params = { amount: Number(amount) || 0 };
          break;
        case 'CONFIGURATOR':
          // Phase 5a — emblem METALLIC/VELCRO/EXTRA-COLOR cards. Drop just
          // toggles a flag (or adds a count) inside the method's aggregate.
          // No params needed beyond the code itself.
          payload.params = {};
          break;
      }

      // Set DataTransfer with code so drop zones can do eligibility check
      e.dataTransfer.effectAllowed = 'copy';
      try {
        e.dataTransfer.setData('text/plain', code);
      } catch (_) {}

      // Phase 6a — custom drag image. Tier cards include their tier in the
      // code chip ("AS-CAP MID"); other cards just show the code.
      try {
        const ghostCode = tier && (code === 'AS-CAP' || code === 'AS-Garm')
          ? `${code} ${tier}`
          : code;
        const ghost = buildDragGhost(ghostCode, service.DisplayName || code);
        e.dataTransfer.setDragImage(ghost, 12, 12);
      } catch (_) { /* setDragImage unsupported — fall back to default */ }

      onDragStart && onDragStart(payload);
    }

    function handleDragEnd() {
      onDragEnd && onDragEnd();
    }

    // Phase 3f — build payload for tap-to-select (same shape as drag).
    // Reuses the same per-method packaging logic as handleDragStart.
    function buildPayload() {
      if (isStandardTier) return null;
      const payload = { service: { ...service }, qty: 0, scope: null, params: {} };
      switch (method) {
        case 'FIXED':
        case 'FLAT':
          payload.params = { unitPrice: sell }; break;
        case 'TIERED':
          if (tier && (code === 'AS-CAP' || code === 'AS-Garm')) {
            payload.params = { tier, unitPrice: sell };
          } else {
            payload.params = {
              stitchCount: defaultStitches,
              unitPrice: Number.isFinite(livePrice) ? livePrice : 0,
              position: defaultPositionFor(code),
            };
          }
          break;
        case 'CALCULATED':
          payload.params = { percent: Number(percent) || 25 }; break;
        case 'HOURLY':
          payload.params = { hours: Number(hours) || 1, unitPrice: sell }; break;
        case 'PASSTHROUGH':
          payload.params = { amount: Number(amount) || 0 }; break;
        case 'CONFIGURATOR':
          payload.params = {}; break;
      }
      return payload;
    }

    function handleClick(e) {
      // Only handle tap on touch devices — desktop relies on drag
      if (!isTouch) return;
      // Don't trigger when clicking inputs inside the card
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') return;
      const payload = buildPayload();
      if (payload && onTap) onTap(payload);
    }

    // Phase 6e (2026-05-03) — keyboard activation. Tab focuses the card,
    // Enter/Space selects it (same path as touch tap), Escape cancels the
    // selection. Skip when the focus is inside an input on the card so
    // typing into a stitch/percent/hours input doesn't accidentally trigger.
    function handleKeyDown(e) {
      if (isStandardTier) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const payload = buildPayload();
        if (payload && onTap) onTap(payload);
      } else if (e.key === 'Escape' && selected) {
        e.preventDefault();
        // Re-fire onTap with the same card → service-rail's onTapCard
        // toggles off when called twice with the same PK_ID, so this acts
        // as a deselect.
        const payload = buildPayload();
        if (payload && onTap) onTap(payload);
      }
    }

    const groupCls = groupClassFor(service.RailGroup);
    const tierCls = isStandardTier ? 'rail-card--standard'
                  : tier === 'Mid' ? 'rail-card--mid'
                  : tier === 'Large' ? 'rail-card--large'
                  : '';

    const cls = [
      'rail-card',
      groupCls,
      tierCls,
      dragging ? 'dragging' : '',
      suggested ? 'rail-card--suggested' : '',
      selected ? 'rail-card--selected' : '',
      nudge ? 'rail-card--nudge' : '',
    ].filter(Boolean).join(' ');

    // Phase 5.3 — ShopWorks PartNumber preview text. Shows the exact value
    // that will land in LinesOE on submit. Useful for transparency + training.
    const swPartNumber = code; // ShopWorks PartNumber == ServiceCode
    const swDisplayName = service.DisplayName || code;

    // Title (display name, falls back to code)
    const title = service.DisplayName || code;

    // Price label varies by method
    let priceLabel = '';
    let priceSuffix = '';
    switch (method) {
      case 'FIXED':
        priceLabel = fmt$(sell);
        priceSuffix = service.PerUnit ? ` ${service.PerUnit}` : '';
        break;
      case 'FLAT':
        priceLabel = fmt$(sell);
        priceSuffix = ' per order';
        break;
      case 'TIERED':
        if (tier && (code === 'AS-CAP' || code === 'AS-Garm')) {
          priceLabel = isStandardTier ? '$0' : `+${fmt$(sell)}`;
          priceSuffix = ' per piece';
        } else {
          // Phase 4d — show "from $X/pc · {default}K" since the rep can no
          // longer set stitches on the card. Makes it clear the displayed
          // price is a baseline that will adjust based on inline edits.
          if (livePrice != null) {
            priceLabel = `from ${fmt$(livePrice)}`;
            const defK = Math.round(defaultStitches / 1000);
            priceSuffix = `/pc · default ${defK}K stitches`;
          } else {
            priceLabel = '—';
            priceSuffix = ' per piece';
          }
        }
        break;
      case 'CALCULATED':
        priceLabel = `${percent}%`;
        priceSuffix = ' of subtotal';
        break;
      case 'HOURLY':
        priceLabel = `${fmt$(sell)}/hr × ${hours}h`;
        priceSuffix = ` = ${fmt$(sell * hours)}`;
        break;
      case 'PASSTHROUGH':
        priceLabel = amount ? fmt$(amount) : '$0';
        priceSuffix = ' (rep enters)';
        break;
      case 'CONFIGURATOR':
        // Phase 5a — show the % markup hint (e.g. "+25% per piece") instead
        // of a dollar amount. The markup is baked into the row's per-piece
        // price by the method's aggregate, not a separate line item.
        priceLabel = service.PerUnit || 'configurator';
        priceSuffix = '';
        break;
    }

    return (
      <div
        className={cls}
        draggable={!isStandardTier && !isTouch}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={isStandardTier ? -1 : 0}
        role="button"
        aria-label={isStandardTier
          ? `${title} — included, no action needed`
          : `${title} — press Enter to select, then Tab to a row and press Enter again to place`}
        aria-pressed={selected ? true : undefined}
        title={isStandardTier
          ? `Standard tier — included in base price, no surcharge needed. Drag Mid or Large for higher stitch counts.`
          : isTouch
            ? `Tap to select, then tap a row`
            : `Drag onto ${groupCls.includes('cap') ? 'a cap row' : groupCls.includes('garment') ? 'a garment row' : 'the order'}`}
      >
        {/* Phase 5.3 — ShopWorks part preview tooltip on hover */}
        {!isStandardTier && (
          <div className="rail-card-sw-preview">
            <span className="rail-card-sw-preview-label">ShopWorks:</span>
            {swPartNumber} · {swDisplayName.slice(0, 32)}
          </div>
        )}
        <div className="rail-card-head">
          <span className="rail-card-code">{code}{tier ? ` ${tier}` : ''}</span>
          {!isStandardTier && <span className="rail-card-grip" aria-hidden>⋮⋮</span>}
          {isStandardTier && <span className="rail-card--included-badge">INCLUDED</span>}
        </div>
        <div className="rail-card-name">{title}</div>
        {!isStandardTier && (
          <div className="rail-card-price">
            {priceLabel}<span className="rail-card-price--suffix">{priceSuffix}</span>
          </div>
        )}
        {isStandardTier && (
          <span className="rail-card--standard-hint">
            ✓ No surcharge — included in base price
          </span>
        )}

        {/* Phase 4d (2026-05-03) — on-card stitch + position inputs were
            REMOVED. Cards drop with sensible defaults (e.g. AL-CAP @ 5K
            stitches at Hat Back); the rep edits both fields inline on the
            row sub-row (paper-form.jsx#AddOnSubRow). Single edit surface,
            less rail-card chrome. */}
        {isStitchInput && (
          <div className="rail-card-edit-hint" aria-hidden>
            edit stitches + position after drop
          </div>
        )}

        {/* RUSH percent input */}
        {method === 'CALCULATED' && code === 'RUSH' && (
          <div className="rail-card-input-row">
            <label className="rail-card-input-label">Percent:</label>
            <input
              className="rail-card-input rail-card-input--num"
              type="number"
              min="0"
              max="100"
              step="5"
              value={percent}
              onChange={e => setPercent(e.target.value)}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
            />
            <span style={{ fontSize: 10, color: '#868e96' }}>%</span>
          </div>
        )}

        {/* Art hours input */}
        {method === 'HOURLY' && (
          <div className="rail-card-input-row">
            <label className="rail-card-input-label">Hours:</label>
            <input
              className="rail-card-input rail-card-input--num"
              type="number"
              min="0"
              step="0.5"
              value={hours}
              onChange={e => setHours(e.target.value)}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
            />
          </div>
        )}

        {/* PASSTHROUGH amount input */}
        {method === 'PASSTHROUGH' && (
          <div className="rail-card-input-row">
            <label className="rail-card-input-label">$:</label>
            <input
              className="rail-card-input rail-card-input--num"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    );
  }

  window.OrderFormRailCard = RailCard;
  // Phase 4c (2026-05-03) — export the position/stitch helpers so the row
  // sub-row UI in paper-form.jsx can use the same data without duplication.
  // Single source of truth for "which codes are stitchable / positionable
  // and what positions they accept" lives here.
  window.OrderFormRailCardHelpers = {
    STITCH_INPUT_CODES,
    POSITION_INPUT_CODES,
    GARMENT_POSITIONS,
    CAP_POSITIONS,
    positionsFor,
    defaultPositionFor,
  };
})();
