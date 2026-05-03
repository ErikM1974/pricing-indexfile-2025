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

    // TIERED stitch input state (AL/AL-CAP/DECG-FB/CTR-*)
    const isStitchInput = STITCH_INPUT_CODES.has(code);
    const defaultStitches = useMemo(() => {
      if (code === 'AL-CAP') return 5000;
      if (code === 'DECG-FB') return 25000;
      return 8000;
    }, [code]);
    const [stitchCount, setStitchCount] = useState(defaultStitches);

    // CALCULATED (RUSH) percent
    const [percent, setPercent] = useState(25);

    // HOURLY (Art) hours
    const [hours, setHours] = useState(1);

    // PASSTHROUGH amount
    const [amount, setAmount] = useState(0);

    // Phase 7 — position for additional logos (AL/AL-CAP/DECG-FB/CTR-*).
    // Drives Designs[].Locations[] in the ShopWorks push so production knows
    // where each additional logo goes. Defaults are smart per code family.
    const hasPositionInput = POSITION_INPUT_CODES.has(code);
    const [position, setPosition] = useState(() => defaultPositionFor(code));
    const positionOptions = useMemo(() => positionsFor(code), [code]);

    // Live-computed price for TIERED stitch-input cards
    const livePrice = useMemo(() => {
      if (!isStitchInput) return null;
      const tp = window.OrderFormTieredPricing;
      if (!tp) return null;
      // Use a typical 24-qty for tier resolution
      const v = tp.resolveSync(code, { stitchCount: Number(stitchCount) || 0, qty: 24 });
      return Number.isFinite(v) ? v : null;
    }, [code, stitchCount, isStitchInput]);

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
            // AL/AL-CAP/DECG-FB/CTR-*: use the typed stitchCount + livePrice
            // + position (Phase 7) so server.js can route to Designs[].Locations[]
            payload.params = {
              stitchCount: Number(stitchCount) || 0,
              unitPrice: Number.isFinite(livePrice) ? livePrice : 0,
              position: position || defaultPositionFor(code),
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
      }

      // Set DataTransfer with code so drop zones can do eligibility check
      e.dataTransfer.effectAllowed = 'copy';
      try {
        e.dataTransfer.setData('text/plain', code);
      } catch (_) {}

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
              stitchCount: Number(stitchCount) || 0,
              unitPrice: Number.isFinite(livePrice) ? livePrice : 0,
              position: position || defaultPositionFor(code),
            };
          }
          break;
        case 'CALCULATED':
          payload.params = { percent: Number(percent) || 25 }; break;
        case 'HOURLY':
          payload.params = { hours: Number(hours) || 1, unitPrice: sell }; break;
        case 'PASSTHROUGH':
          payload.params = { amount: Number(amount) || 0 }; break;
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
          priceLabel = livePrice != null ? fmt$(livePrice) : '—';
          priceSuffix = ' per piece';
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
    }

    return (
      <div
        className={cls}
        draggable={!isStandardTier && !isTouch}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
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

        {/* Stitch input for AL/AL-CAP/DECG-FB/CTR-* */}
        {isStitchInput && (
          <div className="rail-card-input-row">
            <label className="rail-card-input-label">Stitches:</label>
            <input
              className="rail-card-input rail-card-input--num"
              type="number"
              min="0"
              step="500"
              value={stitchCount}
              onChange={e => setStitchCount(e.target.value)}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
            />
          </div>
        )}

        {/* Phase 7 — Position dropdown for additional logos. Production needs
            to know where each AL/AL-CAP/DECG-FB lands. Default is smart per
            code (Hat Back for caps, Right Sleeve for garments, Full Back for
            DECG-FB). Hidden for DECG-FB since it's implicitly "Full Back". */}
        {hasPositionInput && code !== 'DECG-FB' && positionOptions.length > 0 && (
          <div className="rail-card-input-row">
            <label className="rail-card-input-label">Position:</label>
            <select
              className="rail-card-input"
              value={position}
              onChange={e => setPosition(e.target.value)}
              onClick={e => e.stopPropagation()}
              onMouseDown={e => e.stopPropagation()}
              style={{ width: 'auto', minWidth: '90px' }}
            >
              {positionOptions.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
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
})();
