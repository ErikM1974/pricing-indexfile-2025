// Order Form Service Rail — main ServiceRail component (Phase 3c, 2026-05-03).
//
// Sticky left-side panel that renders the active deco method's available
// services as draggable cards organized into 5 sections. Drives the
// drag-and-drop flow:
//
//   1. Rep clicks/grabs a card → setDragPayload({ service, qty, scope, params })
//   2. Each line-item row + the order-level zone become drop targets that
//      validate eligibility against the dragged service's scope
//   3. On drop → addOrReplace via window.OrderFormServiceCodes, mutate addOns
//   4. Card payload includes qty (auto-filled from row qty for per-row codes)
//      and unitPrice (already resolved by the card)
//
// Method-aware filtering is delegated to each pricing engine's
// getRailServices() implementation. When the rep changes the deco method,
// the rail re-renders with that method's service set.

(function () {
  'use strict';
  const { useState, useEffect, useMemo } = React;

  // Order rendered for the section list. RailGroup column drives membership;
  // this controls the visual order of sections.
  const SECTION_ORDER = [
    'Stitch Surcharges',
    'Cap Extras',
    'Garment Extras',
    'Setup Fees',
    'Order Fees',
    'Other',
  ];

  /**
   * @param {Object} props
   * @param {string} props.deco                active deco method ('embroidery', 'screenprint', etc.)
   * @param {Array} props.rows                 line item rows
   * @param {Object} props.breakdown           pricing breakdown (for cap/flat detection)
   * @param {Array} props.addOns               current addOns array
   * @param {Function} props.setAddOns         setter
   * @param {string|number} [props.customerId] for per-customer auto-suggest (Phase 4)
   */
  function ServiceRail({ deco, rows, breakdown, addOns, setAddOns, customerId }) {
    const [services, setServices] = useState([]);
    const [customerOverrides, setCustomerOverrides] = useState({});
    const [dragPayload, setDragPayload] = useState(null); // { service, qty, scope, params }
    const [selectedCard, setSelectedCard] = useState(null); // mobile tap-to-select

    // Detect touch device (no hover capability) — switches to tap-tap UX
    const isTouch = useMemo(() =>
      typeof window !== 'undefined' && window.matchMedia?.('(hover: none)')?.matches,
    []);

    // Load services from the active method's engine. Re-run when method
    // changes or when addOns mutate (so suggested badges can refresh).
    useEffect(() => {
      let cancelled = false;
      (async () => {
        const SC = window.OrderFormServiceCodes;
        if (!SC) return;
        // Make sure the cache is warm before asking the engine
        await SC.fetch();
        // Also pre-warm tiered-pricing for any TIERED card to render live prices
        if (window.OrderFormTieredPricing?.preload) {
          window.OrderFormTieredPricing.preload();
        }
        if (cancelled) return;

        const reg = window.OrderFormPricing;
        const engine = reg?.getMethod?.(deco);
        if (!engine?.getRailServices) { setServices([]); return; }
        setServices(engine.getRailServices({ rows, breakdown }, customerOverrides));
      })();
      return () => { cancelled = true; };
    }, [deco, customerOverrides]);

    // Customer overrides (Phase 4 — wired but no-op when no Accounts table)
    useEffect(() => {
      if (!customerId) { setCustomerOverrides({}); return; }
      const SC = window.OrderFormServiceCodes;
      if (!SC?.getCustomerOverrides) return;
      SC.getCustomerOverrides(customerId).then(o => setCustomerOverrides(o || {}));
    }, [customerId]);

    // Group services by RailGroup
    const grouped = useMemo(() => {
      const SC = window.OrderFormServiceCodes;
      return SC?.groupedByRailGroup?.(services) || { Other: services };
    }, [services]);

    // Cap vs flat detection per row (lifted from add-on-picker.jsx pattern).
    // Used to validate drop-zone eligibility.
    function rowKindFor(row) {
      const rb = breakdown?.byRow?.get?.(row.id) || breakdown?.byRow?.[row.id];
      return rb?.extras?.capOrFlat || 'flat';
    }

    function rowQty(row) {
      if (!row?.sizes) return 0;
      let total = 0;
      for (const k of Object.keys(row.sizes)) total += Number(row.sizes[k]) || 0;
      return total;
    }

    function rowLabel(row) {
      const style = (row?.style || '').trim();
      const desc = (row?.desc || '').trim();
      if (style) return `${style} · ${desc.slice(0, 18)}`;
      return desc.slice(0, 24) || '(unnamed)';
    }

    // Filter rows that have qty > 0 — those are valid drop targets
    const eligibleRows = useMemo(() =>
      (rows || []).filter(r => rowQty(r) > 0),
    [rows]);

    function onDragStart(payload) {
      setDragPayload(payload);
      setSelectedCard(null); // clear tap-selection if drag starts
      // Phase 3e — broadcast drag state to the form's row renderer so rows
      // can show inline drop overlays.
      window.__railDragPayload = payload;
      document.body.classList.add('rail-dragging');
      window.dispatchEvent(new CustomEvent('railDragStart', { detail: payload }));
    }

    // Phase 3f — tap-to-select for touch devices.
    // Tap a card → enters "selected" state (matches drag payload). Rows pick
    // it up via the same window.__railDragPayload + railDragStart event the
    // desktop drag uses. Tap a row → places. Tap empty → cancels.
    function onTapCard(payload) {
      if (selectedCard && selectedCard.service.PK_ID === payload.service.PK_ID) {
        // Tap same card again → cancel selection
        setSelectedCard(null);
        window.__railDragPayload = null;
        document.body.classList.remove('rail-dragging');
        window.dispatchEvent(new CustomEvent('railDragEnd'));
        return;
      }
      setSelectedCard(payload);
      window.__railDragPayload = payload;
      document.body.classList.add('rail-dragging');
      window.dispatchEvent(new CustomEvent('railDragStart', { detail: payload }));
    }
    function onDragEnd() {
      setDragPayload(null);
      window.__railDragPayload = null;
      document.body.classList.remove('rail-dragging');
      window.dispatchEvent(new CustomEvent('railDragEnd'));
    }

    /**
     * onDrop handler — wires the dragged card into addOns state.
     * scope='order' for order-level, otherwise rowId is set.
     */
    function handleDrop({ zoneType, rowId, rowKind }) {
      // Read payload from local state OR window global (when called from
      // paper-form's row drop handlers).
      const payload = dragPayload || window.__railDragPayload;
      if (!payload) return;
      const { service, params } = payload;
      const code = service.ServiceCode;
      const SC = window.OrderFormServiceCodes;

      // Determine qty from scope
      let qty = 1;
      let scope;
      if (zoneType === 'row') {
        const r = (rows || []).find(x => x.id === rowId);
        qty = r ? rowQty(r) : 1;
        scope = { rowId };
      } else {
        qty = 1;
        scope = 'order';
      }

      const entry = {
        code,
        qty,
        scope,
        params: { ...params },
      };

      const result = SC?.addOrReplace?.(addOns || [], entry);
      if (result) {
        setAddOns(result.next);
        // Phase 3e — drop bounce signal: dispatch event that paper-form's
        // row + the new chip can listen to for animation
        window.dispatchEvent(new CustomEvent('railDropSuccess', {
          detail: { code, scope, rowId, ts: Date.now() },
        }));
      }
      setDragPayload(null);
      window.__railDragPayload = null;
      document.body.classList.remove('rail-dragging');
    }

    // Expose drop handler globally so paper-form's row drop zones can call it.
    // Re-bound on every render so the closure captures the latest addOns/setAddOns.
    useEffect(() => {
      window.__railHandleDrop = handleDrop;
      return () => {
        // Don't null on unmount — another instance may have remounted by then
      };
    });

    // Empty state — no method selected, or method has no services
    if (!deco) {
      return (
        <div className="of-rail rail-empty-wrap">
          <div className="rail-empty">Select a decoration method to see services</div>
        </div>
      );
    }
    if (services.length === 0) {
      return (
        <div className="of-rail rail-empty-wrap">
          <div className="rail-head">
            <h3 className="rail-title">Services</h3>
            <span className="rail-method-badge">{deco}</span>
          </div>
          <div className="rail-empty">No services configured for this method</div>
        </div>
      );
    }

    const RailCard = window.OrderFormRailCard;
    const RailSection = window.OrderFormRailSection;
    const DropZone = window.OrderFormDropZone;

    return (
      <div className="of-rail">
        <div className="rail-head">
          <h3 className="rail-title">Drag services →</h3>
          <span className="rail-method-badge">{deco}</span>
        </div>

        {/* Render each section in canonical order; skip empty groups */}
        {SECTION_ORDER.map(name => {
          const list = grouped[name] || [];
          if (!list.length) return null;
          return (
            <RailSection key={name} name={name} count={list.length}>
              {list.map(s => (
                <RailCard
                  key={`${s.PK_ID}-${s.Tier || ''}`}
                  service={s}
                  dragging={dragPayload && dragPayload.service.PK_ID === s.PK_ID}
                  selected={selectedCard && selectedCard.service.PK_ID === s.PK_ID}
                  isTouch={isTouch}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onTap={onTapCard}
                />
              ))}
            </RailSection>
          );
        })}

        {/* Order-level drop zone — visible when dragging an order-eligible card */}
        {dragPayload && (
          <DropZone
            zoneType="order"
            dragging={{ code: dragPayload.service.ServiceCode }}
            onDrop={handleDrop}
          />
        )}

        {/* Per-row drop zones — visible only while dragging */}
        {dragPayload && eligibleRows.length > 0 && (
          <div className="rail-row-zones" style={{ marginTop: 12 }}>
            <div style={{ fontSize: 10, color: '#868e96', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 4 }}>
              Or drop on a row:
            </div>
            {eligibleRows.map(r => {
              const kind = rowKindFor(r);
              const label = `${rowLabel(r)} · ${kind === 'cap' ? '🧢' : '👕'} ${rowQty(r)}`;
              return (
                <DropZone
                  key={r.id}
                  zoneType="row"
                  rowId={r.id}
                  rowKind={kind}
                  label={label}
                  dragging={{ code: dragPayload.service.ServiceCode }}
                  onDrop={handleDrop}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  window.OrderFormServiceRail = ServiceRail;
})();
