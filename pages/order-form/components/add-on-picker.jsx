// Order Form — Add-On Picker UI (Phase 2b, 2026-05-03).
//
// Drives window.OrderFormServiceCodes helpers from clicks. Lets reps pick
// from 31 services (Service_Codes table), collects required params, and
// adds the entry to the form's addOns state. Order-level codes singleton
// (replace + toast); per-row codes append.
//
// Drag-and-drop right rail comes in Phase 2c — same data model, different
// shell. This is the dropdown/modal version that ships fast.

(function () {
  'use strict';
  const { useState, useEffect, useMemo, useRef } = React;

  // Category buckets for the modal layout. Codes here drive the grey-out
  // logic too (Per-Cap → greyed when no cap rows; Per-Garment → greyed
  // when no garment rows).
  const SETUP_FEES        = new Set(['GRT-50', 'GRT-75', 'DD', 'DDE', 'DDT', 'DT']);
  const PER_CAP_ADDONS    = new Set(['3D-EMB', 'Laser Patch', 'AL-CAP', 'AS-CAP', 'SECC']);
  const PER_GARMENT_ADDONS= new Set(['AL', 'AS-Garm', 'SEG', 'DECG', 'DECG-FB']);
  // Anything not in the three above buckets falls into Order-Level Fees.

  const CATEGORY_ORDER = ['Setup Fees', 'Per-Cap Add-ons', 'Per-Garment Add-ons', 'Order-Level Fees'];

  // Format dollars consistently in chips and modal.
  function fmt$(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return '$' + n.toFixed(2);
  }

  // Resolve cap/flat for a row from the breakdown's per-row extras. Falls
  // back to 'flat' if breakdown isn't ready yet (most rows are flat).
  function rowCapOrFlat(row, breakdown) {
    if (!row) return 'flat';
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
    if (style && desc) return `${style} · ${desc.slice(0, 30)}`;
    return style || desc || '(unfilled row)';
  }

  // Compute the chip's display line total based on PricingMethod + params.
  function chipLineTotal(addOn, sc, breakdown) {
    if (!sc) return null;
    const method = String(sc.PricingMethod || '').toUpperCase();
    const sell = Number(sc.SellPrice) || 0;
    const qty = Number(addOn.qty) || 0;
    const subtotal = Number(breakdown?.subtotal) || 0;
    switch (method) {
      case 'FIXED':
      case 'FLAT':
        return sell * qty;
      case 'CALCULATED':
        if (sc.ServiceCode === 'RUSH') {
          const pct = Number(addOn?.params?.percent ?? 25) / 100;
          return subtotal * pct;
        }
        return null;
      case 'HOURLY': {
        const hrs = Number(addOn?.params?.hours);
        return Number.isFinite(hrs) ? sell * hrs : null;
      }
      case 'PASSTHROUGH': {
        const amt = Number(addOn?.params?.amount);
        return Number.isFinite(amt) ? amt * (qty || 1) : null;
      }
      case 'TIERED': {
        // Phase 2c: auto-resolve via window.OrderFormTieredPricing if loaded.
        // Falls back to params.unitPrice (manual override / Phase 2b path).
        const tp = window.OrderFormTieredPricing;
        let unit = null;
        if (tp?.isTiered?.(sc.ServiceCode)) {
          unit = tp.resolveSync(sc.ServiceCode, {
            qty,
            tier: tp.tierForQty(qty),
            stitchCount: Number(addOn?.params?.stitchCount) || 8000,
          });
        }
        if (unit == null) unit = Number(addOn?.params?.unitPrice);
        return Number.isFinite(unit) ? unit * qty : null;
      }
      default:
        return null;
    }
  }

  function chipSubLabel(addOn, sc) {
    if (!sc) return '';
    const method = String(sc.PricingMethod || '').toUpperCase();
    const sell = Number(sc.SellPrice) || 0;
    const qty = Number(addOn.qty) || 0;
    if (method === 'CALCULATED' && sc.ServiceCode === 'RUSH') {
      const pct = Number(addOn?.params?.percent ?? 25);
      return `${pct}% of subtotal`;
    }
    if (method === 'HOURLY') {
      return `${fmt$(sell)}/hr × ${addOn?.params?.hours || 0} hrs`;
    }
    if (method === 'PASSTHROUGH') {
      return `pass-through ${fmt$(addOn?.params?.amount || 0)}`;
    }
    if (method === 'TIERED') {
      const tp = window.OrderFormTieredPricing;
      let unit = null;
      if (tp?.isTiered?.(sc.ServiceCode)) {
        unit = tp.resolveSync(sc.ServiceCode, {
          qty,
          tier: tp.tierForQty(qty),
          stitchCount: Number(addOn?.params?.stitchCount) || 8000,
        });
      }
      if (unit == null) unit = Number(addOn?.params?.unitPrice);
      const isAuto = !!(tp?.isTiered?.(sc.ServiceCode) && Number.isFinite(unit) && !addOn?.params?.unitPriceOverride);
      return Number.isFinite(unit)
        ? `${fmt$(unit)}/ea${isAuto ? ' (auto)' : ''} × ${qty}`
        : `tiered (set price)`;
    }
    if (qty <= 1) return `${fmt$(sell)} flat`;
    return `${fmt$(sell)}/ea × ${qty}`;
  }

  // ---------------------------------------------------------------------
  // Toast — slides in top-right, auto-dismisses ~2.5s.
  // ---------------------------------------------------------------------
  function Toast({ message, onDone }) {
    useEffect(() => {
      if (!message) return;
      const t = setTimeout(onDone, 2500);
      return () => clearTimeout(t);
    }, [message]);
    if (!message) return null;
    return <div className="addon-toast" role="status">{message}</div>;
  }

  // ---------------------------------------------------------------------
  // Params dialog — inline panel inside modal after a service is picked.
  // ---------------------------------------------------------------------
  function ParamsDialog({ service, capRows, garmentRows, breakdown, onConfirm, onCancel }) {
    const code = service?.ServiceCode;
    const method = String(service?.PricingMethod || '').toUpperCase();
    const isPerCap     = PER_CAP_ADDONS.has(code);
    const isPerGarment = PER_GARMENT_ADDONS.has(code);
    const eligibleRows = isPerCap ? capRows : isPerGarment ? garmentRows : [];

    // Default state derived from method + service
    const [rowId, setRowId] = useState(eligibleRows[0]?.id || '');
    const [qty, setQty] = useState(() => {
      // Sensible default qty:
      // - per-row: that row's qty (let user override)
      // - per-piece (Monogram, Name/Number, HW-SURCHG): 1, rep enters
      // - flat order-level: 1
      if (eligibleRows.length) return rowQty(eligibleRows[0]);
      if (code === 'Monogram' || code === 'Name/Number' || code === 'HW-SURCHG') return 1;
      return 1;
    });
    const [percent, setPercent] = useState(25);
    const [hours, setHours] = useState(1);
    const [amount, setAmount] = useState(0);
    const [unitPrice, setUnitPrice] = useState(0);
    const [unitPriceOverride, setUnitPriceOverride] = useState(false);

    // Stitch count for TIERED services that use it (AL, AL-CAP, AS-Garm,
    // AS-CAP, DECG-FB, CTR-Garmt, CTR-Cap). Defaults to the form's primary
    // stitch count when available, falling back to 8000.
    const tp = window.OrderFormTieredPricing;
    const formStitchCount = Number(breakdown?.formCtx?.decoConfig?.stitchCount) || 8000;
    const [stitchCount, setStitchCount] = useState(() => {
      if (code === 'AL-CAP' || code === 'AS-CAP') return Math.max(formStitchCount, 5000);
      return Math.max(formStitchCount, 8000);
    });

    // Auto-resolve TIERED unit price when row/qty/stitch changes (unless
    // rep manually overrode). Phase 2c: replaces the manual entry from 2b.
    useEffect(() => {
      if (method !== 'TIERED' || !tp) return;
      if (unitPriceOverride) return;
      const resolved = tp.resolveSync(code, {
        qty: Number(qty) || 0,
        tier: tp.tierForQty(Number(qty) || 0),
        stitchCount: Number(stitchCount) || 8000,
      });
      if (Number.isFinite(resolved)) {
        setUnitPrice(resolved);
      } else {
        // Cache cold — kick the async fetch and re-trigger via setState.
        tp.resolve(code, {
          qty: Number(qty) || 0,
          tier: tp.tierForQty(Number(qty) || 0),
          stitchCount: Number(stitchCount) || 8000,
        }).then(v => {
          if (Number.isFinite(v) && !unitPriceOverride) setUnitPrice(v);
        });
      }
    }, [method, code, qty, stitchCount, unitPriceOverride]);

    // Update row's qty default when row changes
    function pickRow(id) {
      setRowId(id);
      const r = eligibleRows.find(rr => rr.id === id);
      if (r) setQty(rowQty(r));
    }

    // Live preview of computed line total
    const previewTotal = useMemo(() => {
      const subtotal = Number(breakdown?.subtotal) || 0;
      switch (method) {
        case 'FIXED':
        case 'FLAT':
          return (Number(service?.SellPrice) || 0) * (Number(qty) || 0);
        case 'CALCULATED':
          return code === 'RUSH' ? subtotal * (Number(percent) || 0) / 100 : null;
        case 'HOURLY':
          return (Number(service?.SellPrice) || 0) * (Number(hours) || 0);
        case 'PASSTHROUGH':
          return Number(amount) || 0;
        case 'TIERED':
          return (Number(unitPrice) || 0) * (Number(qty) || 0);
        default:
          return null;
      }
    }, [method, code, qty, percent, hours, amount, unitPrice, service, breakdown]);

    function confirm() {
      const scope = (isPerCap || isPerGarment || code === 'Monogram' || code === 'Name/Number')
        ? (rowId ? { rowId } : 'order')
        : 'order';
      const params = {};
      if (method === 'CALCULATED' && code === 'RUSH') params.percent = Number(percent) || 25;
      if (method === 'HOURLY') params.hours = Number(hours) || 0;
      if (method === 'PASSTHROUGH') params.amount = Number(amount) || 0;
      if (method === 'TIERED') {
        // Phase 2c: persist stitch count (so chip can re-resolve on row qty
        // change) AND the unit price snapshot at confirm-time. Mark whether
        // it was a manual override so the chip can show "auto" badge.
        if (tp?.isStitchAware?.(code)) params.stitchCount = Number(stitchCount) || 8000;
        params.unitPrice = Number(unitPrice) || 0;
        if (unitPriceOverride) params.unitPriceOverride = true;
      }
      const entry = { code, qty: Number(qty) || (method === 'CALCULATED' || method === 'PASSTHROUGH' ? 1 : 0), scope };
      if (Object.keys(params).length) entry.params = params;
      onConfirm(entry);
    }

    const subtotal = Number(breakdown?.subtotal) || 0;

    return (
      <div className="addon-params">
        <div className="addon-params-head">
          <strong>{service.DisplayName}</strong>
          <span className="addon-params-code">{code}</span>
        </div>

        {(isPerCap || isPerGarment) && (
          <label className="addon-params-field">
            <span>Apply to row</span>
            {eligibleRows.length > 0 ? (
              <select value={rowId} onChange={e => pickRow(e.target.value)}>
                {eligibleRows.map(r => (
                  <option key={r.id} value={r.id}>{rowLabel(r)} · {rowQty(r)} pcs</option>
                ))}
              </select>
            ) : (
              <span className="addon-params-hint">No eligible rows</span>
            )}
          </label>
        )}

        {(method === 'FIXED' || method === 'FLAT' || method === 'TIERED') && (
          <label className="addon-params-field">
            <span>Qty</span>
            <input type="number" min="0" step="1" value={qty} onChange={e => setQty(e.target.value)} />
          </label>
        )}

        {method === 'TIERED' && tp?.isStitchAware?.(code) && (
          <label className="addon-params-field">
            <span>Stitch count</span>
            <input type="number" min="0" step="500" value={stitchCount} onChange={e => setStitchCount(e.target.value)} />
            <span className="addon-params-suffix">stitches</span>
          </label>
        )}

        {method === 'TIERED' && (
          <>
            <label className="addon-params-field">
              <span>Unit price $</span>
              <input
                type="number" min="0" step="0.01" value={unitPrice}
                onChange={e => { setUnitPrice(e.target.value); setUnitPriceOverride(true); }}
              />
              {!unitPriceOverride && tp?.isTiered?.(code) && (
                <span className="addon-params-suffix" style={{color: 'var(--nwca-green-dk, #3d6230)', fontWeight: 600}}>auto</span>
              )}
              {unitPriceOverride && (
                <button
                  type="button"
                  onClick={() => setUnitPriceOverride(false)}
                  style={{fontSize: 10, padding: '2px 6px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 3, cursor: 'pointer'}}
                  title="Reset to auto-resolved price"
                >reset auto</button>
              )}
            </label>
            <div className="addon-params-hint">
              {tp?.isTiered?.(code)
                ? tp.formulaLabel(code, { qty, tier: tp.tierForQty(qty), stitchCount })
                : 'Manual price entry'}
            </div>
          </>
        )}

        {method === 'CALCULATED' && code === 'RUSH' && (
          <>
            <label className="addon-params-field">
              <span>Percent</span>
              <input type="number" min="0" max="100" step="1" value={percent} onChange={e => setPercent(e.target.value)} />
              <span className="addon-params-suffix">%</span>
            </label>
            <div className="addon-params-hint">
              {subtotal > 0
                ? `≈ ${fmt$(subtotal * (Number(percent) || 0) / 100)} on current ${fmt$(subtotal)} subtotal`
                : 'Subtotal will be computed at submit'}
            </div>
          </>
        )}

        {method === 'HOURLY' && (
          <label className="addon-params-field">
            <span>Hours</span>
            <input type="number" min="0" step="0.25" value={hours} onChange={e => setHours(e.target.value)} />
          </label>
        )}

        {method === 'PASSTHROUGH' && (
          <label className="addon-params-field">
            <span>Amount $</span>
            <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
          </label>
        )}

        <div className="addon-params-preview">
          {previewTotal != null
            ? <>Line total <strong>{fmt$(previewTotal)}</strong></>
            : <em>Set required fields…</em>}
        </div>

        <div className="addon-params-actions">
          <button type="button" className="btn sm subtle" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn sm primary" onClick={confirm}>Add to order</button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // Modal — categorized service list + grey-out + click → params dialog.
  // ---------------------------------------------------------------------
  function Modal({ services, capRows, garmentRows, breakdown, onPick, onClose, onToast }) {
    const hasCap = capRows.length > 0;
    const hasGarment = garmentRows.length > 0;

    const grouped = useMemo(() => {
      const g = { 'Setup Fees': [], 'Per-Cap Add-ons': [], 'Per-Garment Add-ons': [], 'Order-Level Fees': [] };
      (services || []).forEach(s => {
        const c = s.ServiceCode;
        if (SETUP_FEES.has(c))         g['Setup Fees'].push(s);
        else if (PER_CAP_ADDONS.has(c)) g['Per-Cap Add-ons'].push(s);
        else if (PER_GARMENT_ADDONS.has(c)) g['Per-Garment Add-ons'].push(s);
        else g['Order-Level Fees'].push(s);
      });
      return g;
    }, [services]);

    function isDisabled(s) {
      const c = s.ServiceCode;
      if (PER_CAP_ADDONS.has(c) && !hasCap) return 'Add a cap row first';
      if (PER_GARMENT_ADDONS.has(c) && !hasGarment) return 'Add a garment row first';
      return null;
    }

    function priceLabel(s) {
      const m = String(s.PricingMethod || '').toUpperCase();
      const sell = Number(s.SellPrice) || 0;
      switch (m) {
        case 'FIXED':
        case 'FLAT':
          return fmt$(sell) + ' ' + (s.PerUnit || '');
        case 'TIERED':
          return 'Tiered';
        case 'CALCULATED':
          return s.ServiceCode === 'RUSH' ? '25% of subtotal' : 'Calculated';
        case 'HOURLY':
          return fmt$(sell) + '/hr';
        case 'PASSTHROUGH':
          return 'Pass-through';
        default:
          return '';
      }
    }

    const [picked, setPicked] = useState(null);  // service object after click

    function tryPick(s) {
      const reason = isDisabled(s);
      if (reason) { onToast(reason); return; }
      setPicked(s);
    }

    return (
      <div className="addon-modal-backdrop" onClick={onClose}>
        <div className="addon-modal" onClick={e => e.stopPropagation()}>
          <div className="addon-modal-head">
            <strong>Add a fee or service</strong>
            <button type="button" className="addon-modal-close" aria-label="Close" onClick={onClose}>✕</button>
          </div>

          {!picked ? (
            <div className="addon-modal-body">
              {CATEGORY_ORDER.map(cat => (
                <div key={cat} className="addon-modal-section">
                  <div className="addon-modal-section-head">{cat}</div>
                  <div className="addon-modal-grid">
                    {grouped[cat].map(s => {
                      const reason = isDisabled(s);
                      return (
                        <button
                          key={s.ServiceCode}
                          type="button"
                          className={'addon-modal-item' + (reason ? ' disabled' : '')}
                          onClick={() => tryPick(s)}
                          title={reason || s.Notes || s.DisplayName}
                        >
                          <span className="addon-modal-item-code">{s.ServiceCode}</span>
                          <span className="addon-modal-item-name">{s.DisplayName}</span>
                          <span className="addon-modal-item-price">{priceLabel(s)}</span>
                          {reason && <span className="addon-modal-item-reason">{reason}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="addon-modal-body">
              <ParamsDialog
                service={picked}
                capRows={capRows}
                garmentRows={garmentRows}
                breakdown={breakdown}
                onConfirm={(entry) => { onPick(entry); setPicked(null); }}
                onCancel={() => setPicked(null)}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------
  // AddOnPicker — root component. Renders chip strip + button + modal.
  // ---------------------------------------------------------------------
  function AddOnPicker({ addOns = [], setAddOns, rows = [], breakdown = null }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [services, setServices] = useState([]);
    const [toast, setToast] = useState(null);
    const [loaded, setLoaded] = useState(false);

    // Fetch service codes once on mount. Also kick off TIERED pricing
    // preload (Phase 2c) so AL/AL-CAP/etc. resolve synchronously when the
    // rep opens the picker the first time. Cache TTL is 5 min.
    useEffect(() => {
      let cancelled = false;
      window.OrderFormServiceCodes?.fetch?.().then(items => {
        if (cancelled) return;
        setServices(items || []);
        setLoaded(true);
      });
      window.OrderFormTieredPricing?.preload?.();
      return () => { cancelled = true; };
    }, []);

    // Partition rows by cap vs flat for the modal's grey-out + ParamsDialog
    // row-pickers. `breakdown.byRow` is a Map; .get works on Maps and falls
    // back to plain-object access on plain objects.
    const capRows = useMemo(
      () => (rows || []).filter(r => rowCapOrFlat(r, breakdown) === 'cap' && rowQty(r) > 0),
      [rows, breakdown]
    );
    const garmentRows = useMemo(
      () => (rows || []).filter(r => rowCapOrFlat(r, breakdown) === 'flat' && rowQty(r) > 0),
      [rows, breakdown]
    );

    function handlePick(entry) {
      if (!entry?.code || !window.OrderFormServiceCodes?.addOrReplace) return;
      const result = window.OrderFormServiceCodes.addOrReplace(addOns, entry);
      setAddOns(result.next);
      if (result.replaced) {
        setToast(`Replaced existing ${entry.code}`);
      } else {
        setToast(`Added ${entry.code}`);
      }
      setModalOpen(false);
    }

    function removeAt(idx) {
      const next = (addOns || []).filter((_, i) => i !== idx);
      setAddOns(next);
    }

    // Phase 2c part 2 (drag-drop scope reassignment) — chips are draggable;
    // dropping a chip onto a row's drop zone OR the order-level drop zone
    // updates the scope without removing the chip. Per-row services dropped
    // on order-level fail with a toast; vice versa works.
    const [dragIdx, setDragIdx] = useState(null);
    const [dragOverScope, setDragOverScope] = useState(null);  // 'order' | rowId | null

    function reassignScope(idx, newScope) {
      if (idx == null) return;
      const a = addOns[idx];
      if (!a) return;
      const sc = window.OrderFormServiceCodes?.get?.(a.code);
      const isPerCap     = PER_CAP_ADDONS.has(a.code);
      const isPerGarment = PER_GARMENT_ADDONS.has(a.code);

      // Validate target. Per-cap services need a cap row; per-garment need
      // a garment row. Order-level codes (DD, GRT-50, RUSH, etc.) can drop
      // anywhere but we keep them as 'order' regardless.
      if (newScope !== 'order') {
        const targetRow = rows.find(r => r.id === newScope);
        const targetCof = rowCapOrFlat(targetRow, breakdown);
        if (isPerCap && targetCof !== 'cap')      { setToast('3D Puff / Laser / AL-CAP only on cap rows'); return; }
        if (isPerGarment && targetCof !== 'flat') { setToast('Garment add-on only on garment rows'); return; }
        if (window.OrderFormServiceCodes?.isOrderLevel?.(a.code)) {
          // Order-level codes ignore row reassignment — pin them at 'order'.
          setToast(`${a.code} is order-level (can't pin to a row)`);
          return;
        }
      }

      const next = [...addOns];
      next[idx] = { ...a, scope: newScope === 'order' ? 'order' : { rowId: newScope } };
      setAddOns(next);
      const where = newScope === 'order' ? 'order' : `row ${rowLabel(rows.find(r => r.id === newScope)).slice(0, 14)}`;
      setToast(`Moved ${a.code} → ${where}`);
    }

    // Drop zones: one for order-level, one per row. Visible during drag.
    const draggingActive = dragIdx != null;
    const orderZoneActive = draggingActive && dragOverScope === 'order';

    function onDragStart(idx, e) {
      setDragIdx(idx);
      e.dataTransfer.effectAllowed = 'move';
      // Some browsers require setData to enable dragging.
      try { e.dataTransfer.setData('text/plain', String(idx)); } catch (_) {}
    }
    function onDragEnd() { setDragIdx(null); setDragOverScope(null); }
    function onDropAt(scope, e) {
      e.preventDefault();
      reassignScope(dragIdx, scope);
      setDragIdx(null);
      setDragOverScope(null);
    }

    return (
      <div className="addon-picker">
        <div className="addon-strip">
          <button
            type="button"
            className="addon-add-btn"
            onClick={() => setModalOpen(true)}
            disabled={!loaded}
            title={loaded ? 'Add a fee or service' : 'Loading services…'}
          >
            <span className="addon-add-plus">+</span> Add fee or service
          </button>

          {(addOns || []).length === 0 ? (
            <span className="addon-strip-empty">No fees / services added yet</span>
          ) : (addOns || []).map((a, i) => {
            const sc = window.OrderFormServiceCodes?.get?.(a.code);
            const total = chipLineTotal(a, sc, breakdown);
            const sub = chipSubLabel(a, sc);
            const scopeLabel = a.scope === 'order'
              ? 'order'
              : (a.scope?.rowId ? `row ${rowLabel(rows.find(r => r.id === a.scope.rowId)).slice(0, 14)}` : '');
            return (
              <span
                key={a.id || i}
                className={'addon-chip' + (dragIdx === i ? ' addon-chip-dragging' : '')}
                title={`Drag to reassign · ${sc?.DisplayName || a.code}`}
                draggable={true}
                onDragStart={(e) => onDragStart(i, e)}
                onDragEnd={onDragEnd}
              >
                <span className="addon-chip-grip" aria-hidden>⋮⋮</span>
                <span className="addon-chip-name">{sc?.DisplayName || a.code}</span>
                <span className="addon-chip-sub">{sub}</span>
                {total != null && <span className="addon-chip-total">{fmt$(total)}</span>}
                {scopeLabel && <span className="addon-chip-scope">[{scopeLabel}]</span>}
                <button
                  type="button"
                  className="addon-chip-x"
                  onClick={() => removeAt(i)}
                  aria-label={`Remove ${a.code}`}
                >×</button>
              </span>
            );
          })}

          {/* Order-level drop zone — only visible while dragging */}
          {draggingActive && (
            <span
              className={'addon-dropzone' + (orderZoneActive ? ' addon-dropzone-active' : '')}
              onDragOver={(e) => { e.preventDefault(); setDragOverScope('order'); }}
              onDragLeave={() => setDragOverScope(null)}
              onDrop={(e) => onDropAt('order', e)}
            >
              ↳ Drop here for order-level
            </span>
          )}
        </div>

        {/* Per-row drop zones — render one for each row that has qty.
            Visible only while dragging. Validates scope eligibility on drop. */}
        {draggingActive && (capRows.length > 0 || garmentRows.length > 0) && (
          <div className="addon-row-zones">
            <span className="addon-row-zones-label">Drop to reassign:</span>
            {[...capRows, ...garmentRows].map(r => {
              const cof = rowCapOrFlat(r, breakdown);
              const a = addOns[dragIdx] || {};
              const isPerCap = PER_CAP_ADDONS.has(a.code);
              const isPerGarment = PER_GARMENT_ADDONS.has(a.code);
              const isOrderLvl = window.OrderFormServiceCodes?.isOrderLevel?.(a.code);
              const eligible = !isOrderLvl && (
                (!isPerCap && !isPerGarment) ||
                (isPerCap && cof === 'cap') ||
                (isPerGarment && cof === 'flat')
              );
              return (
                <span
                  key={r.id}
                  className={'addon-dropzone'
                    + (dragOverScope === r.id ? ' addon-dropzone-active' : '')
                    + (!eligible ? ' addon-dropzone-disabled' : '')}
                  onDragOver={(e) => { if (eligible) { e.preventDefault(); setDragOverScope(r.id); } }}
                  onDragLeave={() => setDragOverScope(null)}
                  onDrop={(e) => eligible && onDropAt(r.id, e)}
                  title={eligible ? '' : (isOrderLvl ? 'Order-level codes pin at order' : `Wrong row type (${cof})`)}
                >
                  {rowLabel(r).slice(0, 18)} · {cof === 'cap' ? '🧢' : '👕'} {rowQty(r)}
                </span>
              );
            })}
          </div>
        )}

        {modalOpen && (
          <Modal
            services={services}
            capRows={capRows}
            garmentRows={garmentRows}
            breakdown={breakdown}
            onPick={handlePick}
            onClose={() => setModalOpen(false)}
            onToast={setToast}
          />
        )}

        <Toast message={toast} onDone={() => setToast(null)} />
      </div>
    );
  }

  window.AddOnPicker = AddOnPicker;
})();
