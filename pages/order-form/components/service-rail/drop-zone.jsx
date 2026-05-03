// Order Form Service Rail — DropZone component (Phase 3c, 2026-05-03).
//
// Renders a single drop target (per-row OR order-level). Validates that
// the currently-dragged service is eligible for THIS zone — green/eligible
// styling for valid drops, red/ineligible for invalid (e.g. dragging an
// AS-CAP onto a garment row).
//
// Eligibility rules:
//   - Cap-scoped service (3D-EMB, AL-CAP, AS-CAP, etc.) → cap rows only
//   - Garment-scoped service (AL, AS-Garm, DECG, DECG-FB, etc.) → flat rows only
//   - Order-level (RUSH, GRT-50, etc.) → only the order-level zone
//   - Universal/no-scope → any zone
//
// The actual drop handler lives in the parent ServiceRail component;
// DropZone just emits onDrop with the zone identifier.

(function () {
  'use strict';

  // Code → scope mapping. Mirrors the picker's existing rules
  // (add-on-picker.jsx PER_CAP_ADDONS / PER_GARMENT_ADDONS sets) so behavior
  // stays consistent with the dropdown picker until that's fully sunsetted.
  const CAP_SCOPED = new Set([
    '3D-EMB', 'Laser Patch', 'AL-CAP', 'AS-CAP', 'DECC', 'CTR-Cap', 'SECC',
  ]);
  const GARMENT_SCOPED = new Set([
    'AL', 'AS-Garm', 'SEG', 'DECG', 'DECG-FB', 'CTR-Garmt', 'CDP',
  ]);

  // Returns 'cap' | 'flat' | 'any' for a service code.
  function scopeOf(code) {
    if (CAP_SCOPED.has(code)) return 'cap';
    if (GARMENT_SCOPED.has(code)) return 'flat';
    return 'any';
  }

  /**
   * @param {Object} props
   * @param {string} props.zoneType    'row' | 'order'
   * @param {string} [props.rowId]     row id when zoneType='row'
   * @param {string} [props.rowKind]   'cap' | 'flat' (when zoneType='row')
   * @param {string} [props.label]     display text (e.g. row name + qty)
   * @param {Object} [props.dragging]  current drag payload { code, scope } or null
   * @param {Function} props.onDrop    fired when a card is dropped here
   */
  function DropZone({ zoneType, rowId, rowKind, label, dragging, onDrop }) {
    const { useState } = React;
    const [hover, setHover] = useState(false);

    // Determine eligibility based on the dragging payload
    let eligible = true;
    if (dragging) {
      const sc = scopeOf(dragging.code);
      if (zoneType === 'order') {
        // Order zone: only allow service that's order-level OR has any scope.
        // Per-row services (3D-EMB, AS-CAP, etc.) need a row, not the order.
        const SC = window.OrderFormServiceCodes;
        const isOrderLvl = SC?.isOrderLevel?.(dragging.code) || false;
        eligible = isOrderLvl || sc === 'any';
      } else {
        // Row zone: scope must match
        if (sc === 'cap') eligible = (rowKind === 'cap');
        else if (sc === 'flat') eligible = (rowKind === 'flat');
        else eligible = true;
      }
    }

    function handleDragOver(e) {
      if (!dragging || !eligible) return;
      e.preventDefault();
      setHover(true);
    }
    function handleDragLeave() {
      setHover(false);
    }
    function handleDrop(e) {
      e.preventDefault();
      setHover(false);
      if (!dragging || !eligible) return;
      onDrop({ zoneType, rowId, rowKind });
    }

    const cls = [
      'rail-drop-zone',
      dragging ? 'rail-drop-zone--active' : '',
      eligible ? 'rail-drop-zone--eligible' : 'rail-drop-zone--ineligible',
      hover && eligible ? 'rail-drop-zone--hover' : '',
      zoneType === 'order' ? 'rail-order-zone' : '',
      hover && zoneType === 'order' ? 'rail-order-zone--hover' : '',
    ].filter(Boolean).join(' ');

    return (
      <div
        className={cls}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {label || (zoneType === 'order' ? '↳ Drop here for order-level' : `Drop on ${rowKind || 'row'}`)}
      </div>
    );
  }

  // Expose globally for service-rail.jsx to import.
  window.OrderFormDropZone = DropZone;
  window.OrderFormDropZone_scopeOf = scopeOf;
})();
