/* ============================================================
 * Box-label template — the ONE 8.5×11 per-box label renderer
 * ------------------------------------------------------------
 * Renders a print-ready box label from an order record in the shape the proxy's
 * shared assembly returns (GET /api/sanmar-orders/inbound-today rows and
 * GET /api/sanmar-orders/label-data/:id — identical by construction).
 *
 * Used by BOTH label surfaces:
 *   • dashboards/js/sanmar-inbound-today.js — receiving labels for the day's arrivals
 *   • pages/js/box-labels.js               — the repack station (Print-in-Box Labels)
 * Extracted 2026-08-04 because the two surfaces had separate renderers and the
 * RUSH flag reached one but not the other. Add label fields HERE, never fork.
 *
 * Styles: shared_components/css/box-label-print.css (#sit-label-sheet / .sit-label /
 * .sl-*) — load it on every page that loads this file.
 *
 * API (window.BoxLabelTemplate):
 *   renderLabel(order, box, boxNo, boxTotal, opts) → HTML string for ONE label.
 *     order: proxy order record (workOrder, company, method, dueDate, rush,
 *            productionDays, pastDue, followOnShipment, designNumber/Name,
 *            contactName, salesRep, customerPO, terms, dateOrdered, sanmarPO,
 *            logoUrl?, received?, receivedDate?)
 *     box:   { items:[{style,title,color,size,qty}], trackingNumber?, carrier? }
 *     opts:  { printedOn?: 'M-D-YY',            // footer "Printed" stamp
 *              repackedBy?: 'Name',             // repack station credit line
 *              qr?: { dataUrl, hint? } }        // deep-link QR (top row)
 *   printSheet(labelsHtml) → builds #sit-label-sheet, print dialog, cleans up.
 *   rushText(order) / followOnText(order) → the shared badge wording.
 *   METHOD_DARK — print-legible color per decoration method.
 *   buildMatrix(items) → { rows, cols } size pivot (exposed for tests).
 * ============================================================ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtNum(v) { return Math.round(Number(v) || 0).toLocaleString('en-US'); }
  // Rep initials: "Taneisha Clark" → "TC", "Nika Lao" → "NL".
  function initials(name) {
    return String(name || '').trim().split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join('').slice(0, 3);
  }
  // Compact date for labels: "2026-06-19" → "6-19-26".
  function fmtShortDate(d) {
    const s = String(d || '').slice(0, 10);
    const [y, m, day] = s.split('-').map(Number);
    if (!y) return '';
    return `${m}-${day}-${String(y).slice(-2)}`;
  }

  // Dark, print-legible color per method for the order-type band.
  const METHOD_DARK = { 'Embroidery': '#2e6f40', 'Screen Print': '#185fa5', 'DTG': '#854f0b', 'DTF': '#534ab7', 'Sticker': '#993556', 'Emblem': '#0f6e56', 'Online Store': '#444', 'Inksoft': '#b23b0e', 'Other': '#444' };

  // RUSH badge wording (Erik 2026-08-04). Three or fewer WORKING days between these blanks
  // landing and the due date — weekends and company holidays already excluded by the API,
  // using the same calendar as the arrival estimate. `pastDue` means the due date is on or
  // before the arrival day, which is worse than a rush and says so.
  // Deliberately loud: this is the one thing on the label that changes what production does
  // first, and it has to survive being read on a printout across the room.
  function rushText(o) {
    if (!o || !o.rush) return '';
    const d = o.productionDays;
    if (o.pastDue) return d === 0 ? 'PAST DUE — due the day it lands' : `PAST DUE by ${Math.abs(d)} working day${Math.abs(d) === 1 ? '' : 's'}`;
    return `RUSH — ${d} working day${d === 1 ? '' : 's'} to due date`;
  }
  // Follow-on shipment — this PO was already counted in by receiving, but SanMar shipped
  // ANOTHER carton after that date, so these pieces are still genuinely inbound.
  function followOnText(o) {
    if (!o || !o.followOnShipment) return '';
    return 'FOLLOW-ON — PO counted in' + (o.receivedDate ? ' ' + fmtShortDate(o.receivedDate) : '') + ', this carton shipped after';
  }

  const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', '4XL', '5XL', '6XL'];
  function sizeRank(s) { const i = SIZE_ORDER.indexOf(String(s || '').toUpperCase()); return i < 0 ? 999 : i; }

  // Pivot a box's flat items into a size matrix: one row per style+color, dynamic size columns
  // (standard sizes XS..6XL first, then any others like OSFA/pant sizes/NB appended).
  function buildMatrix(items) {
    const rows = new Map(); const sizes = new Set();
    for (const it of (items || [])) {
      const key = (it.style || '') + '|' + (it.color || '');
      let r = rows.get(key);
      if (!r) { r = { style: it.style || '', title: it.title || '', color: it.color || '', q: {}, total: 0 }; rows.set(key, r); }
      const sz = it.size || '—';
      r.q[sz] = (r.q[sz] || 0) + (it.qty || 0);
      r.total += (it.qty || 0);
      sizes.add(sz);
    }
    const cols = [...sizes].sort((a, b) => { const ra = sizeRank(a), rb = sizeRank(b); return ra !== rb ? ra - rb : String(a).localeCompare(String(b)); });
    return { rows: [...rows.values()], cols };
  }

  function renderLabel(order, box, boxNo, boxTotal, opts) {
    opts = opts || {};
    const method = order.method || 'Other';
    const mColor = METHOD_DARK[method] || '#444';
    const mx = buildMatrix(box.items);
    const dense = (mx.rows.length > 14 || mx.cols.length > 9) ? ' sl-mx--dense' : '';
    const head = `<tr><th>Style</th><th>Description</th><th>Color</th>${mx.cols.map(c => `<th class="sl-c">${esc(c)}</th>`).join('')}<th class="sl-c">Tot</th></tr>`;
    const body = mx.rows.map(r => `<tr><td class="sl-style">${esc(r.style)}</td><td>${esc(r.title)}</td><td>${esc(r.color || '—')}</td>${mx.cols.map(c => { const q = r.q[c] || 0; return `<td class="sl-c${q ? '' : ' sl-z'}">${q ? fmtNum(q) : '·'}</td>`; }).join('')}<td class="sl-c sl-rt">${fmtNum(r.total)}</td></tr>`).join('');
    const colTot = mx.cols.map(c => mx.rows.reduce((t, r) => t + (r.q[c] || 0), 0));
    const grand = colTot.reduce((a, b) => a + b, 0);
    const totalRow = `<tr class="sl-tot"><td colspan="3">TOTAL</td>${colTot.map(t => `<td class="sl-c">${fmtNum(t)}</td>`).join('')}<td class="sl-c">${fmtNum(grand)}</td></tr>`;
    const logo = order.logoUrl
      ? `<img class="sl-logo-img" src="${esc(order.logoUrl)}" alt="Design ${esc(order.designNumber || '')} artwork" onerror="this.outerHTML='<span class=\\'sl-logo-none\\'>artwork unavailable</span>';">`
      : `<span class="sl-logo-none">No artwork on file</span>`;
    const qr = opts.qr && opts.qr.dataUrl
      ? `<div class="sl-qr"><img src="${esc(opts.qr.dataUrl)}" alt="QR">${opts.qr.hint ? `<span>${esc(opts.qr.hint)}</span>` : ''}</div>`
      : '';
    const footCredit = opts.repackedBy
      ? `Repacked by ${esc(opts.repackedBy)}&nbsp;&nbsp;·&nbsp;&nbsp;Received by __________`
      : 'Received by __________';
    return `<div class="sit-label">
      <div class="sl-top">
        <div class="sl-type" style="border-left-color:${mColor}"><span class="sl-type-l">ORDER TYPE</span><span class="sl-type-name" style="color:${mColor}">${esc(method.toUpperCase())}</span></div>
        ${qr}
        <div class="sl-woblock">
          <div class="sl-wolabel">WORK ORDER</div>
          <div class="sl-wo">#${esc(order.workOrder || '?')}</div>
          ${order.dueDate ? `<div class="sl-duedate">Due: ${esc(fmtShortDate(order.dueDate))}</div>` : ''}
          ${rushText(order) ? `<div class="sl-rush">⚡ ${esc(rushText(order))}</div>` : ''}
          <div class="sl-ddbox"><span class="sl-ddlabel">DROP DEAD DATE</span></div>
        </div>
      </div>
      <div class="sl-company">${esc(order.company || '—')}</div>
      ${order.followOnShipment ? `<div class="sl-followon">${esc(followOnText(order))}</div>` : ''}
      <div class="sl-contact">
        <span class="sl-cname">${esc(order.contactName || '')}</span>
        <span class="sl-cright">${order.salesRep ? `<span class="sl-rep">REP: ${esc(initials(order.salesRep))}</span>` : ''}${order.dateOrdered ? `<span class="sl-ord">Ordered: ${esc(fmtShortDate(order.dateOrdered))}</span>` : ''}</span>
      </div>
      ${order.customerPO ? `<div class="sl-custpo">Cust PO: ${esc(order.customerPO)}</div>` : ''}
      <div class="sl-meta">
        <div class="sl-mb"><span class="sl-l">DESIGN #</span><span class="sl-v">${esc(order.designNumber || '—')}</span>${order.designName ? `<span class="sl-dn">${esc(order.designName)}</span>` : ''}</div>
        <div class="sl-mb sl-mb--ctr"><span class="sl-l">BOX</span><span class="sl-v">${fmtNum(boxNo)} of ${fmtNum(boxTotal)}</span></div>
      </div>
      <div class="sl-meta sl-meta--manual">
        <div class="sl-mb sl-fill" style="flex:1.7">
          <span class="sl-l">SHIP METHOD <span class="sl-hint">— circle one</span></span>
          <span class="sl-ship"><b>PICKUP</b><b>SHIP</b><span class="sl-other">Other ______</span></span>
          ${order.terms ? `<span class="sl-terms">Terms: ${esc(order.terms)}</span>` : ''}
        </div>
        <div class="sl-mb sl-logo">${logo}</div>
      </div>
      <table class="sl-mx${dense}"><thead>${head}</thead><tbody>${body}${totalRow}</tbody></table>
      <div class="sl-foot"><span>SanMar PO ${esc(order.sanmarPO)}${box.trackingNumber ? ('&nbsp;&nbsp;·&nbsp;&nbsp;' + esc(box.carrier || '') + ' ' + esc(box.trackingNumber)) : ''}&nbsp;&nbsp;·&nbsp;&nbsp;${footCredit}</span>${opts.printedOn ? `<span class="sl-printed">Printed ${esc(opts.printedOn)}</span>` : ''}</div>
    </div>`;
  }

  // Build the print sheet, invoke the OS print dialog, clean up after. The
  // body class + #sit-label-sheet isolation lives in box-label-print.css.
  function printSheet(labelsHtml) {
    if (!labelsHtml) return;
    const old = document.getElementById('sit-label-sheet'); if (old) old.remove();
    const sheet = document.createElement('div');
    sheet.id = 'sit-label-sheet';
    sheet.innerHTML = labelsHtml;
    document.body.appendChild(sheet);
    document.body.classList.add('sit-label-printing');
    const cleanup = () => {
      document.body.classList.remove('sit-label-printing');
      const s = document.getElementById('sit-label-sheet'); if (s) s.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    setTimeout(() => { if (document.body.classList.contains('sit-label-printing')) cleanup(); }, 1500);
  }

  window.BoxLabelTemplate = { renderLabel, printSheet, rushText, followOnText, METHOD_DARK, buildMatrix };
})();
