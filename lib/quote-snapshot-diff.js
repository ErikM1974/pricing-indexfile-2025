'use strict';

/**
 * Quote ShopWorks-snapshot diff (Erik 2026-05-22 — SW edit audit trail).
 *
 * Extracted from server.js (2026-06-26) so it can be unit-tested without booting
 * the Express app. `diffSnapshots(oldSnap, newSnap)` compares the previous
 * ShopWorks_Snapshot against a freshly-pulled one and returns one change record
 * per changed field; the sync-from-shopworks handler turns those into
 * Quote_Change_Log rows, which power the "edited in ShopWorks" banner on
 * pages/js/quote-view.js. Sync is ONE-WAY (ShopWorks → quote_sessions).
 */

// Order-header fields we watch for changes. Skip timestamps that churn freely
// (like date_LastModified). Field name → { changeType, severity }.
const WATCHED_ORDER_FIELDS = {
  cur_SubTotal:       { type: 'financial', severity: 'info' },
  cur_SalesTaxTotal:  { type: 'financial', severity: 'info' },
  cur_Shipping:       { type: 'financial', severity: 'info' },
  cur_TotalInvoice:   { type: 'financial', severity: 'warning' },
  cur_Payments:       { type: 'financial', severity: 'info' },
  cur_Balance:        { type: 'financial', severity: 'info' },
  sts_ArtDone:        { type: 'status',    severity: 'info' },
  sts_Purchased:      { type: 'status',    severity: 'info' },
  sts_Received:       { type: 'status',    severity: 'info' },
  sts_Produced:       { type: 'status',    severity: 'info' },
  sts_Shipped:        { type: 'status',    severity: 'info' },
  sts_Invoiced:       { type: 'status',    severity: 'info' },
  sts_Paid:           { type: 'status',    severity: 'info' },
  date_RequestedToShip:{type: 'shipping',  severity: 'warning' },
  date_DropDead:      { type: 'shipping',  severity: 'warning' },
  CustomerServiceRep: { type: 'customer',  severity: 'info' },
  id_DesignType:      { type: 'design',    severity: 'info' },
  id_Design:          { type: 'design',    severity: 'info' },
  DesignName:         { type: 'design',    severity: 'info' },
};

// Normalize a value for comparison — null/undefined/'' all become null.
// Numeric strings → numbers. Other values pass through.
function normalizeForDiff(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return null;
    // Try numeric coercion for things like "0", "67.50"
    const n = Number(trimmed);
    if (Number.isFinite(n) && String(n) === trimmed) return n;
    return trimmed;
  }
  return v;
}

// MO /lineitems Size0N columns are positional quantity buckets:
//   Size01=S  Size02=M  Size03=L  Size04=XL  Size05=2XL  Size06=catch-all(3XL+/OSFA/…)
// Used to detect a per-size redistribution (e.g. swap an S for an M) that leaves
// LineQuantity + LineUnitPrice unchanged and would otherwise slip past the diff.
const SIZE_COL_LABELS = ['S', 'M', 'L', 'XL', '2XL', '3XL+'];
function sizeColsOf(li) {
  const cols = [];
  for (let i = 1; i <= 6; i++) cols.push(Number(li && li[`Size0${i}`]) || 0);
  return {
    key: cols.join(','),  // canonical equality key, e.g. "0,2,1,1,0,0"
    label: cols.map((q, i) => (q > 0 ? `${SIZE_COL_LABELS[i]}:${q}` : null)).filter(Boolean).join(' ') || '(none)',
  };
}

/**
 * Diff two snapshots and return an array of change records.
 * @param {Object|null} oldSnap  Previous snapshot (from quote_sessions.ShopWorks_Snapshot)
 * @param {Object} newSnap       Fresh snapshot from MO
 * @returns {Array<{field, oldValue, newValue, type, severity}>}
 */
function diffSnapshots(oldSnap, newSnap) {
  const changes = [];
  if (!oldSnap || !newSnap) return changes;
  const oldOrder = oldSnap.order || {};
  const newOrder = newSnap.order || {};

  // 1. Order-header field diffs
  for (const [field, meta] of Object.entries(WATCHED_ORDER_FIELDS)) {
    const o = normalizeForDiff(oldOrder[field]);
    const n = normalizeForDiff(newOrder[field]);
    if (o !== n) {
      changes.push({
        field,
        oldValue: o,
        newValue: n,
        type: meta.type,
        severity: meta.severity,
      });
    }
  }

  // 2. Line item diffs — match by PartNumber+PartColor.
  // For each NEW line, find matching OLD line and compare LineUnitPrice/LineQuantity.
  // Unmatched OLD lines → "removed". Unmatched NEW lines → "added".
  const oldLines = Array.isArray(oldSnap.lineItems) ? oldSnap.lineItems : [];
  const newLines = Array.isArray(newSnap.lineItems) ? newSnap.lineItems : [];
  const keyOf = (li) => `${(li.PartNumber || '').trim()}|${(li.PartColor || '').trim()}`;
  const oldByKey = new Map(oldLines.map(li => [keyOf(li), li]));
  const newByKey = new Map(newLines.map(li => [keyOf(li), li]));

  for (const [key, nLine] of newByKey) {
    const oLine = oldByKey.get(key);
    if (!oLine) {
      // Added
      changes.push({
        field: `LineItem[${key}]`,
        oldValue: null,
        newValue: `${nLine.PartNumber} ${nLine.PartColor} qty=${nLine.LineQuantity} @ $${nLine.LineUnitPrice}`,
        type: 'line_item',
        severity: 'warning',
      });
    } else {
      // Compare unit price + quantity
      const oPrice = normalizeForDiff(oLine.LineUnitPrice);
      const nPrice = normalizeForDiff(nLine.LineUnitPrice);
      if (oPrice !== nPrice) {
        changes.push({
          field: `LineUnitPrice[${key}]`,
          oldValue: oPrice,
          newValue: nPrice,
          type: 'line_item',
          severity: 'warning',
        });
      }
      const oQty = normalizeForDiff(oLine.LineQuantity);
      const nQty = normalizeForDiff(nLine.LineQuantity);
      if (oQty !== nQty) {
        changes.push({
          field: `LineQuantity[${key}]`,
          oldValue: oQty,
          newValue: nQty,
          type: 'line_item',
          severity: 'warning',
        });
      }
      // Per-size redistribution (Erik 2026-06-26): a swap like S→M keeps both
      // LineQuantity and LineUnitPrice constant, so the two checks above miss it
      // even though the customer-facing size breakdown changed. Compare the
      // positional Size01..Size06 columns and emit one row when they differ.
      const oSizes = sizeColsOf(oLine);
      const nSizes = sizeColsOf(nLine);
      if (oSizes.key !== nSizes.key) {
        changes.push({
          field: `LineSizes[${key}]`,
          oldValue: oSizes.label,
          newValue: nSizes.label,
          type: 'line_item',
          severity: 'warning',
        });
      }
    }
  }
  for (const [key, oLine] of oldByKey) {
    if (!newByKey.has(key)) {
      changes.push({
        field: `LineItem[${key}]`,
        oldValue: `${oLine.PartNumber} ${oLine.PartColor} qty=${oLine.LineQuantity} @ $${oLine.LineUnitPrice}`,
        newValue: null,
        type: 'line_item',
        severity: 'critical',
      });
    }
  }

  return changes;
}

module.exports = { WATCHED_ORDER_FIELDS, normalizeForDiff, sizeColsOf, diffSnapshots, SIZE_COL_LABELS };
