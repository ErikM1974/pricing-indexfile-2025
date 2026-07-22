/* ============================================================
 * SanMar Today's Inbound — detailed per-PO view + printable PDF report
 * ------------------------------------------------------------
 * A drill-down companion to the "Daily Inbound" graph. Lists every SanMar
 * purchase order ARRIVING today (ship date + transit estimate), with:
 *   • PO number + the linked ShopWorks work order #
 *   • company + decoration method + carrier/tracking + box count
 *   • full line items WITH color + size (resolved from the product table)
 *   • pieces received (shipped) / ordered per work order
 * Plus a one-click "Print / Save PDF" of the whole day's incoming report.
 *
 * Data: GET {API_BASE}/api/sanmar-orders/inbound-today
 * Self-contained — reads APP_CONFIG, builds its own modal, no dependencies.
 * Exposes: window.openInboundTodayModal()
 * ============================================================ */
(function () {
  'use strict';

  const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
    || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

  const METHOD_COLORS = {
    'Embroidery': '#4cb354', 'Screen Print': '#2f6fed', 'DTG': '#f59e0b', 'DTF': '#8b5cf6',
    'Sticker': '#ec4899', 'Emblem': '#14b8a6', 'Online Store': '#64748b', 'Inksoft': '#d9622e', 'Other': '#9ca3af',
  };

  let modalEl = null;
  let lastData = null;
  let labelPrintedOn = '';
  let viewDate = null;   // ISO date currently shown (set after each load)
  let calOpen = false;   // is the calendar shown in the body?
  let calMonth = null;   // 'YYYY-MM' the calendar is showing

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtNum(v) { return Math.round(Number(v) || 0).toLocaleString('en-US'); }
  function fmtMoney(v) { return '$' + (Math.round((Number(v) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function fmtMoney0(v) { return '$' + Math.round(Number(v) || 0).toLocaleString('en-US'); }
  // Rep initials: "Taneisha Clark" → "TC", "Nika Lao" → "NL".
  function initials(name) {
    return String(name || '').trim().split(/\s+/).filter(Boolean).map(w => w[0].toUpperCase()).join('').slice(0, 3);
  }
  // Compact date for labels/cards: "2026-06-19" → "6-19-26".
  function fmtShortDate(d) {
    const s = String(d || '').slice(0, 10);
    const [y, m, day] = s.split('-').map(Number);
    if (!y) return '';
    return `${m}-${day}-${String(y).slice(-2)}`;
  }
  function todayShort() {
    const n = new Date();
    return `${n.getMonth() + 1}-${n.getDate()}-${String(n.getFullYear()).slice(-2)}`;
  }
  function fmtDate(d) {
    if (!d) return '';
    const [y, m, day] = String(d).split('-').map(Number);
    return new Date(y, (m || 1) - 1, day || 1).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  function methodChip(m) {
    return `<span class="sit-chip" style="background:${METHOD_COLORS[m] || '#9ca3af'}">${esc(m)}</span>`;
  }
  // SanMar backorder/hold badge (from order-status issues); empty when there's no issue.
  function issueBadge(issue) {
    if (!issue || (!issue.backorder && !issue.hold)) return '';
    const isBo = issue.backorder;
    const label = isBo ? 'Backorder' : 'Hold';
    const tip = `SanMar ${isBo ? 'BACKORDER' : 'HOLD'}${issue.label ? ' — ' + issue.label : ''}`;
    return `<span class="sit-issue ${isBo ? 'sit-issue--bo' : 'sit-issue--hold'}" title="${esc(tip)}">⚠ ${label}</span>`;
  }

  // ── Line-item rows for one PO (screen) ──
  function linesTable(lines) {
    const rows = (lines || []).map(l => {
      const color = l.color ? esc(l.color) : '<span class="sit-na">color n/a</span>';
      const desc = l.title ? esc(l.title) : (l.brand ? esc(l.brand) : '<span class="sit-na">—</span>');
      return `<tr>
        <td class="sit-style">${esc(l.style)}</td>
        <td class="sit-desc">${desc}</td>
        <td>${color}</td>
        <td>${esc(l.size)}</td>
        <td class="sit-num">${fmtNum(l.qtyOrdered)}</td>
        <td class="sit-num">${fmtNum(l.qtyShipped)}</td>
        <td>${esc(l.status)}</td>
        <td class="sit-num sit-cost-cell">${l.lineCost ? fmtMoney(l.lineCost) : '—'}</td>
      </tr>`;
    }).join('');
    return `<table class="sit-lines">
      <thead><tr><th>Style</th><th>Description</th><th>Color</th><th>Size</th><th class="sit-num">Ord</th><th class="sit-num">Ship</th><th>Status</th><th class="sit-num">Cost</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  // ── Per-box item table (screen) — used when live box contents are available ──
  function boxItemsTable(items) {
    const rows = (items || []).map(it => {
      const color = it.color ? esc(it.color) : '<span class="sit-na">color n/a</span>';
      const desc = it.title ? esc(it.title) : (it.brand ? esc(it.brand) : '<span class="sit-na">—</span>');
      return `<tr>
        <td class="sit-style">${esc(it.style)}</td>
        <td class="sit-desc">${desc}</td>
        <td>${color}</td>
        <td>${esc(it.size)}</td>
        <td class="sit-num">${fmtNum(it.qty)}</td>
        <td class="sit-num sit-cost-cell">${it.lineCost ? fmtMoney(it.lineCost) : '—'}</td>
      </tr>`;
    }).join('');
    return `<table class="sit-lines">
      <thead><tr><th>Style</th><th>Description</th><th>Color</th><th>Size</th><th class="sit-num">Qty</th><th class="sit-num">Cost</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  // ── One box block (screen): box # + tracking link + its exact contents ──
  function boxBlock(b, po) {
    const track = b.trackingNumber
      ? (b.trackingUrl ? `<a href="${esc(b.trackingUrl)}" target="_blank" rel="noopener">${esc(b.carrier || 'Track')} ${esc(b.trackingNumber)}</a>` : `${esc(b.carrier)} ${esc(b.trackingNumber)}`)
      : '<span class="sit-na">no tracking</span>';
    return `<div class="sit-box">
      <div class="sit-box-head"><span class="sit-box-n">📦 Box ${fmtNum(b.boxNumber)}</span><span>🚚 ${track}</span><span class="sit-muted">${fmtNum(b.pieces)} pcs</span>${b.cost ? `<span class="sit-muted">${fmtMoney(b.cost)}</span>` : ''}
        <button class="sit-label-btn" data-po="${esc(po)}" data-box="${fmtNum(b.boxNumber)}" title="Print this box's receiving label (8.5×11 PDF)">🏷 Label</button></div>
      ${boxItemsTable(b.items)}
    </div>`;
  }

  // Contents block: per-box when SanMar's live box detail is available, else the PO-level summary.
  function contentsBlock(o) {
    if (o.boxDetailAvailable && o.boxDetail && o.boxDetail.length) {
      return o.boxDetail.map(b => boxBlock(b, o.sanmarPO)).join('');
    }
    return `<div class="sit-box">
      <div class="sit-box-head"><span class="sit-muted">box contents unavailable — showing the PO line items</span>
        <button class="sit-label-btn" data-po="${esc(o.sanmarPO)}" data-box="1" title="Print a receiving label for this order (8.5×11 PDF)">🏷 Label</button></div>
      ${linesTable(o.lines)}
    </div>`;
  }

  // ── Logo thumbnail (screen) — ShopWorks design artwork, or a graceful "no logo" tile ──
  function logoTile(o) {
    return o.logoUrl
      ? `<img class="sit-logo" src="${esc(o.logoUrl)}" alt="Design ${esc(o.designNumber || '')} artwork" loading="lazy" onerror="this.outerHTML='<div class=\\'sit-logo sit-logo--off\\' title=\\'artwork unavailable\\'>🎨</div>';">`
      : `<div class="sit-logo sit-logo--off" title="No ShopWorks artwork on file for this design">🎨</div>`;
  }

  // UPS live-arrival chip — UPS's REAL delivery date when known (else nothing; the view's day is our
  // business-day estimate). Rescheduled stands out in amber so a slipped arrival is obvious.
  function upsChip(o) {
    const u = o.upsDelivery;
    if (!u || !u.date) {
      // No UPS scan yet → this day is our ship+transit ESTIMATE, not a confirmed UPS date. Mark it
      // clearly so receiving knows it may shift (the truthful arrival comes from UPS once scanned).
      return o.arrival
        ? `<span class="sit-ups sit-ups--est" title="Estimated from SanMar ship date + ground transit — UPS hasn't scanned these boxes yet, so the day may still shift">~ est. ${esc(fmtShortDate(o.arrival))}</span>`
        : '';
    }
    const cfg = {
      delivered: ['✅', 'UPS delivered', 'sit-ups--ok'],
      scheduled: ['🚚', 'UPS arriving', 'sit-ups--ok'],
      rescheduled: ['⚠️', 'UPS rescheduled →', 'sit-ups--resched'],
    }[u.type] || ['🚚', 'UPS arriving', 'sit-ups--ok'];
    return `<span class="sit-ups ${cfg[2]}" title="${esc(u.status || '')} — live delivery date from UPS">${cfg[0]} ${cfg[1]} ${esc(fmtShortDate(u.date))}</span>`;
  }

  // ── One PO card (screen) ──
  function poCard(o) {
    const wo = o.workOrder ? `#${esc(o.workOrder)}` : '<span class="sit-na">no WO</span>';
    const company = o.company || '<span class="sit-na">unmatched</span>';
    const track = o.tracking
      ? (o.trackingUrl ? `<a href="${esc(o.trackingUrl)}" target="_blank" rel="noopener">🚚 ${esc(o.carrier || 'Track')} ${esc(o.tracking)}</a>` : `🚚 ${esc(o.carrier)} ${esc(o.tracking)}`)
      : '';
    const f = (lbl, val) => val ? `<span class="sit-f"><span class="sit-fl">${lbl}</span> <b>${esc(val)}</b></span>` : '';

    // Received (counted in by receiving in ShopWorks) → collapsed, de-emphasized card: no contents
    // table, no label button, and excluded from the arriving totals — the blanks are physically here.
    if (o.received) {
      return `<div class="sit-card sit-card--received">
        <div class="sit-card-main">
          ${logoTile(o)}
          <div class="sit-card-info">
            <div class="sit-card-head">
              <div class="sit-card-title">
                <span class="sit-company">${company}</span>
                ${methodChip(o.method)}
                <span class="sit-recv" title="Counted in by receiving in ShopWorks${o.receivedDate ? ' on ' + esc(fmtShortDate(o.receivedDate)) : ''} — already here, no longer on the inbound count">✓ Received${o.receivedDate ? ' ' + esc(fmtShortDate(o.receivedDate)) : ''}</span>
              </div>
              <span class="sit-wo">WO ${wo}</span>
            </div>
            <div class="sit-card-meta">
              <span class="sit-f"><span class="sit-fl">SanMar PO</span> <b>${esc(o.sanmarPO)}</b></span>
              <span>📦 ${fmtNum(o.boxes)} box${o.boxes === 1 ? '' : 'es'}</span>
              <span>🧵 ${fmtNum(o.piecesShipped)} pcs</span>
              ${o.designNumber ? `<span class="sit-f"><span class="sit-fl">Design</span> <b>${esc(o.designNumber)}</b></span>` : ''}
              ${f('Rep', initials(o.salesRep))}
            </div>
          </div>
        </div>
      </div>`;
    }

    return `<div class="sit-card">
      <div class="sit-card-main">
        ${logoTile(o)}
        <div class="sit-card-info">
          <div class="sit-card-head">
            <div class="sit-card-title">
              <span class="sit-company">${company}</span>
              ${methodChip(o.method)}
              ${issueBadge(o.issue)}
            </div>
            <span class="sit-wo">WO ${wo}</span>
          </div>
          <div class="sit-fields">
            ${f('Due', fmtShortDate(o.dueDate))}
            ${o.designNumber ? `<span class="sit-f"><span class="sit-fl">Design</span> <b>${esc(o.designNumber)}</b>${o.designName ? ' · ' + esc(o.designName) : ''}</span>` : ''}
            ${f('Contact', o.contactName)}
            ${f('Rep', initials(o.salesRep))}
            ${f('Cust PO', o.customerPO)}
            ${f('Terms', o.terms)}
            ${f('Ordered', fmtShortDate(o.dateOrdered))}
          </div>
          <div class="sit-card-meta">
            ${upsChip(o)}
            <span class="sit-f"><span class="sit-fl">SanMar PO</span> <b>${esc(o.sanmarPO)}</b></span>
            <span>📦 ${fmtNum(o.boxes)} box${o.boxes === 1 ? '' : 'es'}</span>
            <span>🧵 ${fmtNum(o.piecesShipped)} pcs${o.piecesOrdered !== o.piecesShipped ? ` <span class="sit-muted">/ ${fmtNum(o.piecesOrdered)} ord</span>` : ''}</span>
            ${o.cost ? `<span class="sit-cost" title="Wholesale blank cost (what we paid SanMar)">💵 ${fmtMoney(o.cost)}</span>` : ''}
            ${o.shipDate ? `<span class="sit-muted">shipped ${esc(o.shipDate)}${o.fromState ? ' · ' + esc(o.fromState) : ''}</span>` : ''}
            ${track ? `<span>${track}</span>` : ''}
          </div>
        </div>
      </div>
      ${contentsBlock(o)}
    </div>`;
  }

  function renderBody(data) {
    const t = data.totals || {};
    if (!data.orders || data.orders.length === 0) {
      return `<p class="sit-empty">No SanMar shipments are estimated to arrive on ${esc(fmtDate(data.date))}.</p>`;
    }
    return `
      <div class="sit-summary">
        <div class="sit-stat"><span class="sit-stat-num">${fmtNum(t.pos)}</span><span class="sit-stat-lbl">purchase orders</span></div>
        <div class="sit-stat"><span class="sit-stat-num">${fmtNum(t.workOrders)}</span><span class="sit-stat-lbl">work orders</span></div>
        <div class="sit-stat"><span class="sit-stat-num">${fmtNum(t.boxes)}</span><span class="sit-stat-lbl">boxes</span></div>
        <div class="sit-stat"><span class="sit-stat-num">${fmtNum(t.piecesShipped)}</span><span class="sit-stat-lbl">pieces arriving</span></div>
        <div class="sit-stat sit-stat--cost"><span class="sit-stat-num">${fmtMoney0(t.cost)}</span><span class="sit-stat-lbl">blanks cost</span></div>
        ${t.received ? `<div class="sit-stat sit-stat--recv"><span class="sit-stat-num">✓ ${fmtNum(t.received)}</span><span class="sit-stat-lbl">already received</span></div>` : ''}
      </div>
      <div class="sit-cards">${data.orders.map(poCard).join('')}</div>
      <p class="sit-costnote">💵 Blank cost = SanMar wholesale (CASE_PRICE × qty) — what we pay SanMar. Final invoiced amounts can vary slightly and land ~1–2 weeks after arrival.</p>
      <p class="sit-note">${esc(data.note || '')}</p>`;
  }

  // ── Print helpers shared by every recipient profile ──
  // The printed worklist is ACTIONABLE inbound only — a received PO is physically
  // counted in already, so it drops off every printout (same rule the on-screen
  // "✓ Received" collapse uses). Never-Break Rule #4: a failed received-read leaves
  // the PO on the list, so this only ever hides blanks that are truly here.
  function activeOrders(data) { return (data && data.orders ? data.orders : []).filter(o => !o.received); }
  function sumOrders(orders) {
    return (orders || []).reduce((a, o) => ({
      pos: a.pos + 1,
      boxes: a.boxes + (Number(o.boxes) || 0),
      pieces: a.pieces + (Number(o.piecesShipped) || 0),
      cost: a.cost + (Number(o.cost) || 0),
    }), { pos: 0, boxes: 0, pieces: 0, cost: 0 });
  }
  function repKey(o) { return String((o && o.salesRep) || '').trim() || 'Unassigned / Unmatched'; }
  function byCompany(a, b) { return String(a.company || '~~~').localeCompare(String(b.company || '~~~')); }
  function dueKey(o) { return String((o && o.dueDate) || '').slice(0, 10) || '9999-99-99'; } // blank due sorts last
  function byDue(a, b) { return dueKey(a).localeCompare(dueKey(b)); }
  function byPO(a, b) { return (Number(a.sanmarPO) || 0) - (Number(b.sanmarPO) || 0) || String(a.sanmarPO || '').localeCompare(String(b.sanmarPO || '')); }
  // Production sequences by decoration method; unknown methods sort after the known ones, A→Z.
  const METHOD_SEQ = ['Embroidery', 'Screen Print', 'DTG', 'DTF', 'Sticker', 'Emblem', 'Online Store', 'Inksoft', 'Other'];
  function byMethodOrder(a, b) { const ia = METHOD_SEQ.indexOf(a), ib = METHOD_SEQ.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || String(a).localeCompare(String(b)); }
  // "Due soon" = due within a week of the report day (or already past) → highlighted for production.
  function isDueSoon(dueIso, refIso) {
    const d = String(dueIso || '').slice(0, 10), r = String(refIso || '').slice(0, 10);
    if (!d || !r) return false;
    return (new Date(d + 'T00:00:00') - new Date(r + 'T00:00:00')) / 86400000 <= 7;
  }

  // ── One PO's print block (detailed card, used by the Full + AE sheets). Extracted
  //    so reports reuse the EXACT per-PO markup (no drift). opts.showCost=false strips
  //    every cost column + Terms so AEs can hand the sheet to a customer. ──
  function poBlockHtml(o, opts) {
    const showCost = !opts || opts.showCost !== false;
    const body = (o.boxDetailAvailable && o.boxDetail && o.boxDetail.length)
      ? o.boxDetail.map(b => `
        <div class="sit-ps-box">Box ${fmtNum(b.boxNumber)} · ${esc(b.carrier)} ${esc(b.trackingNumber)} · ${fmtNum(b.pieces)} pcs${showCost && b.cost ? ' · ' + fmtMoney(b.cost) : ''}</div>
        <table class="sit-ps-tbl">
          <thead><tr><th>Style</th><th>Description</th><th>Color</th><th>Size</th><th style="text-align:right">Qty</th>${showCost ? '<th style="text-align:right">Cost</th>' : ''}</tr></thead>
          <tbody>${(b.items || []).map(it => `<tr><td>${esc(it.style)}</td><td>${esc(it.title || '')}</td><td>${esc(it.color || '—')}</td><td>${esc(it.size)}</td><td style="text-align:right">${fmtNum(it.qty)}</td>${showCost ? `<td style="text-align:right">${it.lineCost ? fmtMoney(it.lineCost) : '—'}</td>` : ''}</tr>`).join('')}</tbody>
        </table>`).join('')
      : `<table class="sit-ps-tbl">
          <thead><tr><th>Style</th><th>Description</th><th>Color</th><th>Size</th><th style="text-align:right">Ord</th><th style="text-align:right">Ship</th><th>Status</th>${showCost ? '<th style="text-align:right">Cost</th>' : ''}</tr></thead>
          <tbody>${(o.lines || []).map(l => `<tr><td>${esc(l.style)}</td><td>${esc(l.title || '')}</td><td>${esc(l.color || '—')}</td><td>${esc(l.size)}</td><td style="text-align:right">${fmtNum(l.qtyOrdered)}</td><td style="text-align:right">${fmtNum(l.qtyShipped)}</td><td>${esc(l.status)}</td>${showCost ? `<td style="text-align:right">${l.lineCost ? fmtMoney(l.lineCost) : '—'}</td>` : ''}</tr>`).join('')}</tbody>
        </table>`;
    const psLogo = o.logoUrl ? `<img class="sit-ps-logo" src="${esc(o.logoUrl)}" alt="" onerror="this.style.display='none'">` : '';
    const psFields = [
      fmtShortDate(o.dueDate) ? 'Due ' + fmtShortDate(o.dueDate) : '',
      o.designNumber ? 'Design ' + o.designNumber + (o.designName ? ' ' + o.designName : '') : '',
      o.contactName ? 'Contact ' + o.contactName : '',
      o.salesRep ? 'Rep ' + initials(o.salesRep) : '',
      o.customerPO ? 'Cust PO ' + o.customerPO : '',
      showCost && o.terms ? 'Terms ' + o.terms : '',
      o.dateOrdered ? 'Ordered ' + fmtShortDate(o.dateOrdered) : '',
    ].filter(Boolean).map(esc).join(' · ');
    return `<div class="sit-ps-po">
      <div class="sit-ps-po-head">
        ${psLogo}
        <div class="sit-ps-po-htxt">
          <div><b>${esc(o.company || 'Unmatched')}</b> &nbsp; SanMar PO #${esc(o.sanmarPO)}${o.workOrder ? ' · WO #' + esc(o.workOrder) : ''} · ${esc(o.method)}
            <span class="sit-ps-r">${fmtNum(o.boxes)} box(es) · ${fmtNum(o.piecesShipped)} pcs${showCost && o.cost ? ' · <b>' + fmtMoney(o.cost) + '</b>' : ''}${o.upsDelivery && o.upsDelivery.date ? ' · UPS ' + fmtShortDate(o.upsDelivery.date) + (o.upsDelivery.type === 'rescheduled' ? ' (resched)' : o.upsDelivery.type === 'delivered' ? ' (delivered)' : '') : ''}</span></div>
          ${psFields ? `<div class="sit-ps-fields">${psFields}</div>` : ''}
        </div>
      </div>
      ${body}
    </div>`;
  }

  // ── Group report POs by sales rep. Empty/blank rep → one "Unassigned /
  //    Unmatched" bucket that always sorts LAST (so unmatched POs — e.g. a
  //    still-unlinked SanMar PO — still print, never silently dropped). Named
  //    reps A→Z. Each group carries its own subtotal. ──
  function groupOrdersByRep(orders) {
    const UNASSIGNED = 'Unassigned / Unmatched';
    const map = new Map();
    (orders || []).forEach(o => {
      const rep = String(o.salesRep || '').trim() || UNASSIGNED;
      if (!map.has(rep)) map.set(rep, []);
      map.get(rep).push(o);
    });
    const groups = [...map.entries()].map(([repName, repOrders]) => ({
      repName,
      repInitials: repName === UNASSIGNED ? '' : initials(repName),
      orders: repOrders,
      sub: repOrders.reduce((a, o) => ({
        pos: a.pos + 1,
        boxes: a.boxes + (Number(o.boxes) || 0),
        pieces: a.pieces + (Number(o.piecesShipped) || 0),
        cost: a.cost + (Number(o.cost) || 0),
      }), { pos: 0, boxes: 0, pieces: 0, cost: 0 }),
    }));
    groups.sort((a, b) => {
      if (a.repName === UNASSIGNED) return 1;    // Unassigned always last
      if (b.repName === UNASSIGNED) return -1;
      return a.repName.localeCompare(b.repName); // reps A→Z
    });
    return groups;
  }

  // ── Branded print header shared by every recipient profile.
  //    opts: {title, recipient, subLine (HTML ok), note}. ──
  function psHeader(data, opts) {
    opts = opts || {};
    return `<div class="sit-ps-head">
      <div class="sit-ps-brand">Northwest Custom Apparel</div>
      <div class="sit-ps-title">${esc(opts.title || 'Daily Inbound Report — SanMar Blanks')}</div>
      ${opts.recipient ? `<div class="sit-ps-recipient">${esc(opts.recipient)}</div>` : ''}
      <div class="sit-ps-sub">Arriving ${esc(fmtDate(data.date))} &nbsp;·&nbsp; ${opts.subLine || ''}</div>
      ${opts.note ? `<div class="sit-ps-note">${esc(opts.note)}</div>` : ''}
    </div>`;
  }

  // ── Profile 1 · FULL report — everyone's master copy (the "entire report" Bradley,
  //    Mikalah and Ruthie all get). Continuous + company-sorted, all columns incl. cost.
  //    Per-AE splitting now lives in the AE sheets, so this stays one compact run. ──
  function buildFullInner(data) {
    const t = data.totals || {};
    const orders = activeOrders(data).slice().sort(byCompany);
    return psHeader(data, {
      title: 'Daily Inbound Report — SanMar Blanks',
      subLine: `${fmtNum(t.pos)} POs · ${fmtNum(t.workOrders)} work orders · ${fmtNum(t.boxes)} boxes · ${fmtNum(t.piecesShipped)} pieces · <b>${fmtMoney0(t.cost)} blanks cost</b>`,
      note: 'Full day, all reps. Arrival = SanMar ship date + ground-transit estimate to Milton, WA. Blank cost = SanMar wholesale (CASE_PRICE × qty).',
    }) + (orders.length ? orders.map(o => poBlockHtml(o, { showCost: true })).join('') : '<p>No shipments arriving this day.</p>');
  }

  // ── Profile 2 · one AE's personal sheet — their POs only, cost + terms stripped so it's
  //    safe to hand a customer. Header carries THEIR subtotal, not the whole day's. ──
  function aeSheetSection(data, repName, orders, asSection) {
    const s = sumOrders(orders);
    const head = `<div class="sit-ps-head">
      <div class="sit-ps-brand">Northwest Custom Apparel</div>
      <div class="sit-ps-title">Your inbound — SanMar blanks</div>
      <div class="sit-ps-recipient">${esc(repName)}${initials(repName) ? ' (' + esc(initials(repName)) + ')' : ''}</div>
      <div class="sit-ps-sub">Arriving ${esc(fmtDate(data.date))} &nbsp;·&nbsp; ${fmtNum(s.pos)} of your PO${s.pos === 1 ? '' : 's'} · ${fmtNum(s.boxes)} boxes · ${fmtNum(s.pieces)} pieces</div>
      <div class="sit-ps-note">Your customers' blanks landing today — a good moment to let them know their order is moving.</div>
    </div>`;
    const body = orders.length
      ? orders.slice().sort(byDue).map(o => poBlockHtml(o, { showCost: false })).join('')
      : '<p>No inbound assigned to you this day.</p>';
    return asSection ? `<section class="sit-ps-rep">${head}${body}</section>` : head + body;
  }
  function buildAeInner(data, repName) {
    return aeSheetSection(data, repName, activeOrders(data).filter(o => repKey(o) === repName), false);
  }

  // ── Profile 3 · ALL AE sheets in one job — every rep, one per page (page-break),
  //    each the same cost-stripped layout. Unassigned rides last so nothing drops. ──
  function buildAllAeInner(data) {
    const sections = groupOrdersByRep(activeOrders(data))
      .map(g => aeSheetSection(data, g.repName, g.orders, true)).join('');
    return sections || '<p>No shipments arriving this day.</p>';
  }

  // ── Profile 4 · RECEIVING checklist (Mikalah) — one row per BOX, company-sorted, with a
  //    tick box. The size matrix stays on each box's printed label; this is the manifest. ──
  function buildReceivingInner(data) {
    const orders = activeOrders(data).slice().sort(byCompany);
    const s = sumOrders(orders);
    const rows = orders.flatMap(o => boxesForOrder(o).map(p => {
      const b = p.box;
      const track = b.trackingNumber ? `${esc(b.carrier || '')} ${esc(b.trackingNumber)}` : '<span class="sit-rt-muted">no tracking</span>';
      // Per-box "x of N" when SanMar's box detail is available; when it isn't, a multi-box PO
      // collapses to ONE row — say "N boxes" there so the physical count still reconciles.
      const boxCell = p.boxTotal > 1
        ? `${fmtNum(p.boxNo)} of ${fmtNum(p.boxTotal)}`
        : ((Number(o.boxes) || 1) > 1 ? `${fmtNum(o.boxes)} boxes` : '1 of 1');
      return `<tr>
        <td class="sit-rt-check"></td>
        <td>${esc(o.company || 'Unmatched')}</td>
        <td>${o.workOrder ? '#' + esc(o.workOrder) : '<span class="sit-rt-muted">no WO</span>'}</td>
        <td>${esc(o.sanmarPO)}</td>
        <td class="sit-rt-c">${boxCell}</td>
        <td>${track}</td>
        <td class="sit-rt-c">${fmtNum(b.pieces || o.piecesShipped)}</td>
        <td>${esc(o.method || '')}</td>
      </tr>`;
    })).join('');
    return psHeader(data, {
      title: 'Receiving checklist — SanMar inbound',
      recipient: 'Receiving · Mikalah',
      subLine: `${fmtNum(s.pos)} orders · ${fmtNum(s.boxes)} boxes · ${fmtNum(s.pieces)} pieces to check in`,
      note: 'Tick each box as it is scanned in. The full size breakdown prints on each box’s receiving label.',
    }) + `<table class="sit-rt-tbl sit-rt-recv">
      <thead><tr><th class="sit-rt-check">✓</th><th>Company</th><th>WO</th><th>SanMar PO</th><th class="sit-rt-c">Box</th><th>Carrier / tracking</th><th class="sit-rt-c">Pcs</th><th>Type</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8">No boxes arriving this day.</td></tr>'}</tbody></table>`;
  }

  // ── Profile 5 · PRODUCTION plan (Ruthie) — grouped by decoration method, soonest-due
  //    first within each. No cost/tracking; rows due within a week are bolded. ──
  function buildProductionInner(data) {
    const orders = activeOrders(data);
    const byMethod = new Map();
    orders.forEach(o => { const m = o.method || 'Other'; if (!byMethod.has(m)) byMethod.set(m, []); byMethod.get(m).push(o); });
    const sections = [...byMethod.keys()].sort(byMethodOrder).map(m => {
      const list = byMethod.get(m).slice().sort(byDue);
      const pcs = list.reduce((a, o) => a + (Number(o.piecesShipped) || 0), 0);
      const rows = list.map(o => `<tr>
        <td class="${isDueSoon(o.dueDate, data.date) ? 'sit-rt-due-soon' : ''}">${esc(fmtShortDate(o.dueDate)) || '—'}</td>
        <td>${esc(o.company || 'Unmatched')}</td>
        <td>${o.workOrder ? '#' + esc(o.workOrder) : '<span class="sit-rt-muted">no WO</span>'}</td>
        <td>${esc(o.designNumber || '—')}${o.designName ? ' · ' + esc(o.designName) : ''}</td>
        <td class="sit-rt-c">${fmtNum(o.piecesShipped)}</td>
        <td>${esc(initials(o.salesRep))}</td>
      </tr>`).join('');
      return `<div class="sit-rt-method" style="border-left-color:${METHOD_DARK[m] || '#444'}">${esc(m)} <span class="sit-rt-method-sub">${list.length} order${list.length === 1 ? '' : 's'} · ${fmtNum(pcs)} pcs</span></div>
        <table class="sit-rt-tbl"><thead><tr><th>Due</th><th>Company</th><th>WO</th><th>Design</th><th class="sit-rt-c">Pcs</th><th>Rep</th></tr></thead><tbody>${rows}</tbody></table>`;
    }).join('');
    const s = sumOrders(orders);
    return psHeader(data, {
      title: 'Production plan — SanMar inbound',
      recipient: 'Production · Ruthie',
      subLine: `${fmtNum(s.pos)} orders · ${fmtNum(s.pieces)} pieces · grouped by method, soonest due first`,
      note: 'Blanks arriving today, ready to schedule. Bold due dates land within a week.',
    }) + (sections || '<p>No shipments arriving this day.</p>');
  }

  // ── Profile 6 · PURCHASING / PO reconcile (Bradley) — PO-sorted table with cost, terms,
  //    ordered-vs-shipped and backorder/hold flags; grand-total cost row. ──
  function buildPurchasingInner(data) {
    const orders = activeOrders(data).slice().sort(byPO);
    const rows = orders.map(o => {
      const flag = (o.issue && (o.issue.backorder || o.issue.hold)) ? `<span class="sit-rt-flag">${o.issue.backorder ? 'BACKORDER' : 'HOLD'}</span>` : '';
      const short = (Number(o.piecesShipped) || 0) !== (Number(o.piecesOrdered) || 0);
      return `<tr>
        <td>${esc(o.sanmarPO)}</td>
        <td>${o.workOrder ? '#' + esc(o.workOrder) : '<span class="sit-rt-muted">no WO</span>'}</td>
        <td>${esc(o.company || 'Unmatched')} ${flag}</td>
        <td>${esc(initials(o.salesRep))}</td>
        <td class="sit-rt-c">${fmtNum(o.piecesOrdered)}</td>
        <td class="sit-rt-c${short ? ' sit-rt-short' : ''}">${fmtNum(o.piecesShipped)}${short ? ' ✗' : ''}</td>
        <td>${esc(o.terms || '—')}</td>
        <td class="sit-rt-c sit-rt-cost">${o.cost ? fmtMoney(o.cost) : '—'}</td>
      </tr>`;
    }).join('');
    const s = sumOrders(orders);
    return psHeader(data, {
      title: 'Purchasing — SanMar PO reconcile',
      recipient: 'Purchasing · Bradley',
      subLine: `${fmtNum(s.pos)} POs · ${fmtNum(s.boxes)} boxes · ${fmtNum(s.pieces)} pieces · <b>${fmtMoney0(s.cost)} blanks cost</b>`,
      note: 'Ordered vs shipped — ✗ marks a short ship (backorder/hold flagged in red). Cost = SanMar wholesale (CASE_PRICE × qty).',
    }) + `<table class="sit-rt-tbl sit-rt-purch">
      <thead><tr><th>SanMar PO</th><th>WO</th><th>Company</th><th>Rep</th><th class="sit-rt-c">Ord</th><th class="sit-rt-c">Ship</th><th>Terms</th><th class="sit-rt-c">Cost</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="8">No POs arriving this day.</td></tr>'}
        <tr class="sit-rt-tot"><td colspan="7">TOTAL · ${fmtNum(s.pos)} PO${s.pos === 1 ? '' : 's'}</td><td class="sit-rt-c">${fmtMoney(s.cost)}</td></tr></tbody></table>`;
  }

  // ── Shared print plumbing: render a profile's inner HTML into #sit-print-sheet, then print. ──
  const PRINT_BUILDERS = {
    full: (d) => buildFullInner(d),
    ae: (d, rep) => buildAeInner(d, rep),
    allAe: (d) => buildAllAeInner(d),
    receiving: (d) => buildReceivingInner(d),
    production: (d) => buildProductionInner(d),
    purchasing: (d) => buildPurchasingInner(d),
  };
  function renderPrintSheet(innerHtml) {
    const old = document.getElementById('sit-print-sheet'); if (old) old.remove();
    const sheet = document.createElement('div');
    sheet.id = 'sit-print-sheet';
    sheet.innerHTML = innerHtml;
    document.body.appendChild(sheet);
    return sheet;
  }
  function printProfile(kind, arg) {
    if (!lastData) return;
    const builder = PRINT_BUILDERS[kind] || PRINT_BUILDERS.full;
    renderPrintSheet(builder(lastData, arg));
    document.body.classList.add('sit-printing');
    const cleanup = () => {
      document.body.classList.remove('sit-printing');
      const s = document.getElementById('sit-print-sheet'); if (s) s.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
    // Fallback cleanup if afterprint doesn't fire (some browsers)
    setTimeout(() => { if (document.body.classList.contains('sit-printing')) cleanup(); }, 1500);
  }

  // ── Per-box receiving LABEL (8.5×11 portrait, one page per box) ──
  function fmtLabelDate(d) {
    const s = String(d || '').slice(0, 10);
    const [y, m, day] = s.split('-').map(Number);
    if (!y) return '';
    return new Date(y, (m || 1) - 1, day || 1).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', '4XL', '5XL', '6XL'];
  function sizeRank(s) { const i = SIZE_ORDER.indexOf(String(s || '').toUpperCase()); return i < 0 ? 999 : i; }
  // Dark, print-legible color per method for the order-type band.
  const METHOD_DARK = { 'Embroidery': '#2e6f40', 'Screen Print': '#185fa5', 'DTG': '#854f0b', 'DTF': '#534ab7', 'Sticker': '#993556', 'Emblem': '#0f6e56', 'Online Store': '#444', 'Inksoft': '#b23b0e', 'Other': '#444' };
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
  // Resolve an order to its print-ready boxes (live box detail, or one synthesized box from PO lines).
  function boxesForOrder(order) {
    if (order.boxDetailAvailable && order.boxDetail && order.boxDetail.length) {
      const n = order.boxDetail.length;
      return order.boxDetail.map(b => ({ order, box: b, boxNo: b.boxNumber, boxTotal: n }));
    }
    const box = {
      pieces: order.piecesShipped || order.piecesOrdered || 0,
      trackingNumber: order.tracking || '', carrier: order.carrier || '',
      items: (order.lines || []).map(l => ({ style: l.style, title: l.title, color: l.color, size: l.size, qty: l.qtyShipped || l.qtyOrdered || 0 })),
    };
    return [{ order, box, boxNo: 1, boxTotal: 1 }];
  }
  function oneLabel(order, box, boxNo, boxTotal) {
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
    return `<div class="sit-label">
      <div class="sl-top">
        <div class="sl-type" style="border-left-color:${mColor}"><span class="sl-type-l">ORDER TYPE</span><span class="sl-type-name" style="color:${mColor}">${esc(method.toUpperCase())}</span></div>
        <div class="sl-woblock">
          <div class="sl-wolabel">WORK ORDER</div>
          <div class="sl-wo">#${esc(order.workOrder || '?')}</div>
          ${order.dueDate ? `<div class="sl-duedate">Due: ${esc(fmtShortDate(order.dueDate))}</div>` : ''}
          <div class="sl-ddbox"><span class="sl-ddlabel">DROP DEAD DATE</span></div>
        </div>
      </div>
      <div class="sl-company">${esc(order.company || '—')}</div>
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
      <div class="sl-foot"><span>SanMar PO ${esc(order.sanmarPO)}${box.trackingNumber ? ('&nbsp;&nbsp;·&nbsp;&nbsp;' + esc(box.carrier || '') + ' ' + esc(box.trackingNumber)) : ''}&nbsp;&nbsp;·&nbsp;&nbsp;Received by __________</span>${labelPrintedOn ? `<span class="sl-printed">Printed ${esc(labelPrintedOn)}</span>` : ''}</div>
    </div>`;
  }
  function printLabels(pairs) {
    if (!pairs || !pairs.length) return;
    labelPrintedOn = todayShort();
    const old = document.getElementById('sit-label-sheet'); if (old) old.remove();
    const sheet = document.createElement('div');
    sheet.id = 'sit-label-sheet';
    sheet.innerHTML = pairs.map(p => oneLabel(p.order, p.box, p.boxNo, p.boxTotal)).join('');
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
  function printAllLabels() {
    if (!lastData) return;
    // Received POs are already counted in — no receiving label needed.
    printLabels((lastData.orders || []).filter(o => !o.received).flatMap(boxesForOrder));
  }

  function setContent(html) {
    const body = modalEl.querySelector('#sit-body');
    if (body) body.innerHTML = html;
    const printBtn = modalEl.querySelector('#sit-print');
    if (printBtn) printBtn.disabled = !lastData || !(lastData.orders && lastData.orders.length);
  }

  // Attach a logo thumbnail URL to each order from its design number (ShopWorks design-thumbnail
  // table via the existing /api/thumbnails endpoint). Cosmetic — never blocks the report on failure.
  async function attachLogos(data) {
    try {
      const orders = data.orders || [];
      const bases = [...new Set(orders.map(o => String(o.designNumber || '').split('.')[0]).filter(Boolean))];
      if (!bases.length) return;
      const map = {};
      for (let i = 0; i < bases.length; i += 20) {
        const chunk = bases.slice(i, i + 20);
        const resp = await fetch(`${API_BASE}/api/thumbnails/by-designs?ids=${encodeURIComponent(chunk.join(','))}`);
        if (!resp.ok) continue;
        const j = await resp.json();
        const th = j.thumbnails || {};
        for (const k in th) { if (th[k] && th[k].found && th[k].imageUrl) map[k] = th[k].imageUrl; }
      }
      orders.forEach(o => { const b = String(o.designNumber || '').split('.')[0]; if (map[b]) o.logoUrl = map[b]; });
    } catch (e) { console.warn('Inbound logo fetch failed (non-blocking):', e); }
  }

  // ── Calendar (pick any day → load its inbound; same detail + box labels as today) ──
  function todayISO() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  }
  function addDaysISO(iso, n) {
    const d = new Date((iso || todayISO()) + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function monthMeta(ym) {
    const [y, m] = ym.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstDow = new Date(y, m - 1, 1).getDay();
    return {
      y, m, daysInMonth, firstDow,
      start: `${ym}-01`, end: `${ym}-${String(daysInMonth).padStart(2, '0')}`,
      label: new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    };
  }
  function updateDateUI(dateIso) {
    const lbl = modalEl && modalEl.querySelector('#sit-date');
    if (lbl) lbl.textContent = fmtDate(dateIso) + (dateIso === todayISO() ? '  ·  Today' : '');
  }
  async function fetchMonthCounts(ym) {
    const mm = monthMeta(ym);
    // Let failures propagate — a swallowed error used to render a blank, fully
    // unclickable month indistinguishable from "nothing inbound" (Never-Break
    // Rule #4). showCalendar() catches this and shows a visible error + Retry.
    const resp = await fetch(`${API_BASE}/api/sanmar-orders/daily-inbound?start=${mm.start}&end=${mm.end}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const j = await resp.json();
    const map = {};
    (j.days || []).forEach(d => { map[d.date] = { orders: d.orders, boxes: d.boxes, pieces: d.pieces, cost: d.cost || 0 }; });
    return map;
  }
  function renderCalendar(ym, counts) {
    const mm = monthMeta(ym);
    const max = Math.max(1, ...Object.values(counts).map(c => c.pieces || 0));
    const today = todayISO();
    let cells = '';
    for (let i = 0; i < mm.firstDow; i++) cells += '<div class="sit-cal-cell sit-cal-blank"></div>';
    for (let day = 1; day <= mm.daysInMonth; day++) {
      const iso = `${ym}-${String(day).padStart(2, '0')}`;
      const c = counts[iso];
      const cls = ['sit-cal-cell'];
      let style = '', chip = '', cost = '', title = '';
      if (c && (c.orders || c.pieces)) {
        const a = 0.14 + 0.74 * Math.min(1, (c.pieces || 0) / max);
        cls.push('sit-cal-has'); if (a > 0.5) cls.push('sit-cal-hot');
        style = `background:rgba(46,111,64,${a.toFixed(3)})`;
        chip = `<span class="sit-cal-chip">${fmtNum(c.orders)} PO</span>`;
        if (c.cost) cost = `<span class="sit-cal-cost">${fmtMoney0(c.cost)}</span>`;
        title = `${fmtNum(c.orders)} POs · ${fmtNum(c.boxes)} boxes · ${fmtNum(c.pieces)} pcs · ${fmtMoney(c.cost)} blanks`;
      }
      if (iso === today) cls.push('sit-cal-today');
      if (iso === viewDate) cls.push('sit-cal-sel');
      cells += `<div class="${cls.join(' ')}" ${c ? `data-caldate="${iso}"` : ''} style="${style}" title="${esc(title)}"><span class="sit-cal-dn">${day}</span>${cost}${chip}</div>`;
    }
    return `<div class="sit-cal">
      <div class="sit-cal-head">
        <button class="sit-cal-nav" data-cal="prev" aria-label="Previous month"><i class="fas fa-chevron-left"></i></button>
        <div class="sit-cal-title">${esc(mm.label)}</div>
        <button class="sit-cal-nav" data-cal="next" aria-label="Next month"><i class="fas fa-chevron-right"></i></button>
        <button class="sit-cal-todaybtn" data-cal="today">This month</button>
      </div>
      <div class="sit-cal-grid">
        ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(w => `<div class="sit-cal-wd">${w}</div>`).join('')}
        ${cells}
      </div>
      <div class="sit-cal-legend"><i class="fas fa-hand-pointer"></i> Click a day to view its inbound &amp; print box labels &nbsp;·&nbsp; shade = pieces arriving (darker = busier) &nbsp;·&nbsp; $ = wholesale blank cost</div>
    </div>`;
  }
  async function showCalendar(ym) {
    calOpen = true;
    calMonth = ym || (viewDate || todayISO()).slice(0, 7);
    setContent('<div class="sit-loading"><i class="fas fa-spinner fa-spin"></i> Loading calendar…</div>');
    let counts;
    try {
      counts = await fetchMonthCounts(calMonth);
    } catch (err) {
      if (!calOpen) return;
      // Mirror the day-view error path (load()): visible error + Retry, never a
      // silent blank month that looks like "nothing inbound".
      console.error('[SanMarInbound] Calendar month counts failed:', err);
      setContent(`<div class="sit-error"><i class="fas fa-triangle-exclamation"></i>
        Couldn't load the calendar.<br><small>${esc(err.message)}</small><br>
        <button class="btn-cancel" id="sit-cal-retry">Retry</button></div>`);
      const retry = modalEl && modalEl.querySelector('#sit-cal-retry');
      if (retry) retry.onclick = () => showCalendar(calMonth);
      return;
    }
    if (!calOpen) return;
    setContent(renderCalendar(calMonth, counts));
  }
  function calNav(dir) {
    if (dir === 'today') return showCalendar(todayISO().slice(0, 7));
    const [y, m] = calMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + (dir === 'next' ? 1 : -1), 1);
    return showCalendar(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  function toggleCalendar() {
    if (calOpen) { calOpen = false; if (lastData) setContent(renderBody(lastData)); else load(false, viewDate); }
    else showCalendar();
  }

  async function load(refresh, dateStr) {
    lastData = null;
    calOpen = false;
    setContent('<div class="sit-loading"><i class="fas fa-spinner fa-spin"></i> Loading inbound…</div>');
    try {
      const params = [];
      if (refresh) params.push('refresh=true');
      if (dateStr) params.push('date=' + encodeURIComponent(dateStr));
      const url = `${API_BASE}/api/sanmar-orders/inbound-today${params.length ? '?' + params.join('&') : ''}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      await attachLogos(data);
      lastData = data;
      viewDate = data.date;
      updateDateUI(data.date);
      setContent(renderBody(data));
    } catch (err) {
      // Never-Break Rule #4 — show the error, never fake data.
      setContent(`<div class="sit-error"><i class="fas fa-triangle-exclamation"></i>
        Couldn't load inbound.<br><small>${esc(err.message)}</small><br>
        <button class="btn-cancel" id="sit-retry">Retry</button></div>`);
      const retry = modalEl.querySelector('#sit-retry');
      if (retry) retry.onclick = () => load(true, viewDate);
    }
  }

  // ── "Print for…" dropdown: one menu item per recipient. AE rows are derived from the
  //    day's assigned reps (Unassigned/Unmatched never gets its own personal sheet). ──
  function buildPrintMenuHtml() {
    if (!lastData || !activeOrders(lastData).length) {
      return '<div class="sit-pm-empty">Nothing to print for this day.</div>';
    }
    const aeItems = groupOrdersByRep(activeOrders(lastData)).filter(g => g.repInitials).map(g =>
      `<button class="sit-pm-item" role="menuitem" data-print="ae" data-rep="${esc(g.repName)}">
        <span class="sit-pm-ini">${esc(g.repInitials)}</span>
        <span class="sit-pm-txt">${esc(g.repName)} <span class="sit-pm-count">· ${fmtNum(g.sub.pos)} PO${g.sub.pos === 1 ? '' : 's'}</span></span>
      </button>`).join('');
    return `
      <div class="sit-pm-group">Everyone · full day</div>
      <button class="sit-pm-item" role="menuitem" data-print="full"><i class="fas fa-users"></i> <span class="sit-pm-txt">Full report <span class="sit-pm-hint">— all reps</span></span></button>
      <div class="sit-pm-group">AE personal sheets · their orders only</div>
      ${aeItems || '<div class="sit-pm-empty">No AE-assigned POs today.</div>'}
      <button class="sit-pm-item sit-pm-strong" role="menuitem" data-print="allAe"><i class="fas fa-layer-group"></i> <span class="sit-pm-txt">All AE sheets <span class="sit-pm-hint">— one per page</span></span></button>
      <div class="sit-pm-group">Role sheets · full day, tailored</div>
      <button class="sit-pm-item" role="menuitem" data-print="receiving"><i class="fas fa-box"></i> <span class="sit-pm-txt">Receiving checklist <span class="sit-pm-hint">· Mikalah</span></span></button>
      <button class="sit-pm-item" role="menuitem" data-print="production"><i class="fas fa-industry"></i> <span class="sit-pm-txt">Production plan <span class="sit-pm-hint">· Ruthie · by due date</span></span></button>
      <button class="sit-pm-item" role="menuitem" data-print="purchasing"><i class="fas fa-file-invoice-dollar"></i> <span class="sit-pm-txt">Purchasing / PO reconcile <span class="sit-pm-hint">· Bradley</span></span></button>`;
  }
  function togglePrintMenu(show) {
    const menu = modalEl && modalEl.querySelector('#sit-printmenu');
    const btn = modalEl && modalEl.querySelector('#sit-print');
    if (!menu || !btn) return;
    const willShow = (show != null) ? show : menu.hidden;
    if (willShow) {
      menu.innerHTML = buildPrintMenuHtml();
      menu.hidden = false;
      btn.setAttribute('aria-expanded', 'true');
    } else {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  }

  function build() {
    modalEl = document.createElement('div');
    modalEl.className = 'modal sit-modal';
    modalEl.style.display = 'none';
    modalEl.innerHTML = `
      <div class="modal-content sit-modal-content">
        <div class="sit-header">
          <div>
            <h3><i class="fas fa-clipboard-list"></i> SanMar Inbound</h3>
            <div class="sit-datenav">
              <button class="sit-daystep" id="sit-prevday" aria-label="Previous day" title="Previous day"><i class="fas fa-chevron-left"></i></button>
              <button class="sit-datebtn" id="sit-datebtn" title="Pick a day from the calendar"><i class="fas fa-calendar-day"></i> <span class="sit-date-line" id="sit-date"></span> <i class="fas fa-caret-down sit-cal-caret"></i></button>
              <button class="sit-daystep" id="sit-nextday" aria-label="Next day" title="Next day"><i class="fas fa-chevron-right"></i></button>
              <button class="sit-todaybtn" id="sit-todaybtn" title="Jump to today’s inbound">Today</button>
            </div>
          </div>
          <div class="sit-header-actions">
            <button class="btn-cancel" id="sit-labels" title="Print a receiving label for every box today (8.5×11, one per page)"><i class="fas fa-tags"></i> Box Labels</button>
            <div class="sit-printmenu-wrap">
              <button class="btn-cancel" id="sit-print" aria-haspopup="true" aria-expanded="false" title="Print a report tailored to each person — AEs get only their orders, support staff get the full day"><i class="fas fa-print"></i> Print for… <i class="fas fa-caret-down sit-print-caret"></i></button>
              <div class="sit-printmenu" id="sit-printmenu" role="menu" hidden></div>
            </div>
            <button class="btn-cancel" id="sit-refresh" title="Re-pull from SanMar synced data"><i class="fas fa-rotate"></i> Refresh</button>
            <button class="sit-close" id="sit-close" aria-label="Close">&times;</button>
          </div>
        </div>
        <div id="sit-body"></div>
      </div>`;
    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) close(); });
    modalEl.querySelector('#sit-close').onclick = close;
    modalEl.querySelector('#sit-refresh').onclick = () => load(true, viewDate);
    // "Print for…" dropdown — toggle on the button, act on menu clicks, close on outside click.
    const printBtn = modalEl.querySelector('#sit-print');
    const printMenu = modalEl.querySelector('#sit-printmenu');
    printBtn.onclick = (e) => { e.stopPropagation(); if (printBtn.disabled) return; togglePrintMenu(); };
    printMenu.addEventListener('click', (e) => {
      const item = e.target.closest('[data-print]');
      if (!item) return;
      togglePrintMenu(false);
      printProfile(item.getAttribute('data-print'), item.getAttribute('data-rep') || undefined);
    });
    modalEl.querySelector('.sit-printmenu-wrap').addEventListener('click', (e) => e.stopPropagation());
    modalEl.addEventListener('click', () => togglePrintMenu(false));
    modalEl.querySelector('#sit-labels').onclick = printAllLabels;
    modalEl.querySelector('#sit-datebtn').onclick = toggleCalendar;
    modalEl.querySelector('#sit-prevday').onclick = () => load(false, addDaysISO(viewDate, -1));
    modalEl.querySelector('#sit-nextday').onclick = () => load(false, addDaysISO(viewDate, 1));
    modalEl.querySelector('#sit-todaybtn').onclick = () => load(false, todayISO());
    // Per-box "🏷 Label" buttons + calendar clicks (delegated; #sit-body persists across reloads).
    modalEl.querySelector('#sit-body').addEventListener('click', (e) => {
      const cell = e.target.closest('[data-caldate]');
      if (cell) { load(false, cell.getAttribute('data-caldate')); return; }
      const nav = e.target.closest('[data-cal]');
      if (nav) { calNav(nav.getAttribute('data-cal')); return; }
      const btn = e.target.closest('.sit-label-btn');
      if (!btn || !lastData) return;
      const po = btn.getAttribute('data-po');
      const boxNo = parseInt(btn.getAttribute('data-box'), 10) || 1;
      const order = (lastData.orders || []).find(o => o.sanmarPO === po);
      if (!order) return;
      const all = boxesForOrder(order);
      const pick = all.filter(p => p.boxNo === boxNo);
      printLabels(pick.length ? pick : all.slice(0, 1));
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !modalEl || modalEl.style.display === 'none') return;
      const menu = modalEl.querySelector('#sit-printmenu');
      if (menu && !menu.hidden) { togglePrintMenu(false); return; } // Esc closes the print menu first
      close();
    });
  }

  function close() { togglePrintMenu(false); if (modalEl) modalEl.style.display = 'none'; }

  window.openInboundTodayModal = function () {
    if (!modalEl) build();
    modalEl.style.display = 'flex';
    load(false);
  };

  // When opened as a dedicated SanMar Inbound view, retitle the host page so
  // receiving staff aren't disoriented by the underlying "Quote Management" header.
  function applyInboundTitle() {
    try {
      document.title = 'SanMar Inbound';
      const hdr = document.querySelector('.page-title, .header-title, h1');
      if (hdr) hdr.textContent = 'SanMar Inbound';
    } catch (e) { /* title update is non-critical */ }
  }

  // Auto-open when linked from the Staff Dashboard tile (?open=inbound-today).
  try {
    const want = new URLSearchParams(location.search).get('open') || '';
    if (/^(inbound-today|inbound|sanmar-boxes)$/i.test(want)) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { applyInboundTitle(); window.openInboundTodayModal(); });
      } else {
        applyInboundTitle();
        window.openInboundTodayModal();
      }
    }
  } catch (e) { /* no auto-open */ }
})();
