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
    'Sticker': '#ec4899', 'Emblem': '#14b8a6', 'Online Store': '#64748b', 'Other': '#9ca3af',
  };

  let modalEl = null;
  let lastData = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtNum(v) { return Math.round(Number(v) || 0).toLocaleString('en-US'); }
  function fmtDate(d) {
    if (!d) return '';
    const [y, m, day] = String(d).split('-').map(Number);
    return new Date(y, (m || 1) - 1, day || 1).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }
  function methodChip(m) {
    return `<span class="sit-chip" style="background:${METHOD_COLORS[m] || '#9ca3af'}">${esc(m)}</span>`;
  }

  // ── Line-item rows for one PO (screen) ──
  function linesTable(lines) {
    const rows = (lines || []).map(l => {
      const color = l.color ? esc(l.color) : '<span class="sit-na">color n/a</span>';
      return `<tr>
        <td class="sit-style">${esc(l.style)}</td>
        <td>${color}</td>
        <td>${esc(l.size)}</td>
        <td class="sit-num">${fmtNum(l.qtyOrdered)}</td>
        <td class="sit-num">${fmtNum(l.qtyShipped)}</td>
        <td>${esc(l.status)}</td>
      </tr>`;
    }).join('');
    return `<table class="sit-lines">
      <thead><tr><th>Style</th><th>Color</th><th>Size</th><th class="sit-num">Ord</th><th class="sit-num">Ship</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  // ── One PO card (screen) ──
  function poCard(o) {
    const wo = o.workOrder ? `WO #${esc(o.workOrder)}` : '<span class="sit-na">no WO linked</span>';
    const company = o.company || '<span class="sit-na">unmatched</span>';
    const track = o.tracking
      ? (o.trackingUrl ? `<a href="${esc(o.trackingUrl)}" target="_blank" rel="noopener">${esc(o.carrier || 'Track')} ${esc(o.tracking)}</a>` : `${esc(o.carrier)} ${esc(o.tracking)}`)
      : '';
    return `<div class="sit-card">
      <div class="sit-card-head">
        <div class="sit-card-title">
          <span class="sit-company">${company}</span>
          <span class="sit-po">PO #${esc(o.sanmarPO)}</span>
          <span class="sit-wo">${wo}</span>
          ${methodChip(o.method)}
        </div>
        <div class="sit-card-meta">
          <span>📦 ${fmtNum(o.boxes)} box${o.boxes === 1 ? '' : 'es'}</span>
          <span>🧵 ${fmtNum(o.piecesShipped)} pcs${o.piecesOrdered !== o.piecesShipped ? ` <span class="sit-muted">/ ${fmtNum(o.piecesOrdered)} ord</span>` : ''}</span>
          ${o.shipDate ? `<span class="sit-muted">shipped ${esc(o.shipDate)}${o.fromState ? ' · ' + esc(o.fromState) : ''}</span>` : ''}
          ${track ? `<span>🚚 ${track}</span>` : ''}
        </div>
      </div>
      ${linesTable(o.lines)}
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
      </div>
      <div class="sit-cards">${data.orders.map(poCard).join('')}</div>
      <p class="sit-note">${esc(data.note || '')}</p>`;
  }

  // ── Printable report (branded, print-only) ──
  function buildPrintSheet(data) {
    const old = document.getElementById('sit-print-sheet');
    if (old) old.remove();
    const t = data.totals || {};
    const poBlocks = (data.orders || []).map(o => {
      const rows = (o.lines || []).map(l => `<tr>
        <td>${esc(l.style)}</td><td>${esc(l.color || '—')}</td><td>${esc(l.size)}</td>
        <td style="text-align:right">${fmtNum(l.qtyOrdered)}</td><td style="text-align:right">${fmtNum(l.qtyShipped)}</td><td>${esc(l.status)}</td>
      </tr>`).join('');
      return `<div class="sit-ps-po">
        <div class="sit-ps-po-head">
          <b>${esc(o.company || 'Unmatched')}</b> &nbsp; PO #${esc(o.sanmarPO)}${o.workOrder ? ' · WO #' + esc(o.workOrder) : ''} · ${esc(o.method)}
          <span class="sit-ps-r">${fmtNum(o.boxes)} box(es) · ${fmtNum(o.piecesShipped)} pcs${o.carrier ? ' · ' + esc(o.carrier) + ' ' + esc(o.tracking || '') : ''}</span>
        </div>
        <table class="sit-ps-tbl">
          <thead><tr><th>Style</th><th>Color</th><th>Size</th><th style="text-align:right">Ord</th><th style="text-align:right">Ship</th><th>Status</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }).join('');

    const sheet = document.createElement('div');
    sheet.id = 'sit-print-sheet';
    sheet.innerHTML = `
      <div class="sit-ps-head">
        <div class="sit-ps-brand">Northwest Custom Apparel</div>
        <div class="sit-ps-title">Daily Inbound Report — SanMar Blanks</div>
        <div class="sit-ps-sub">Arriving ${esc(fmtDate(data.date))} &nbsp;·&nbsp; ${fmtNum(t.pos)} POs · ${fmtNum(t.workOrders)} work orders · ${fmtNum(t.boxes)} boxes · ${fmtNum(t.piecesShipped)} pieces</div>
        <div class="sit-ps-note">Arrival = SanMar ship date + ground-transit estimate to Milton, WA (no carrier ETA from SanMar).</div>
      </div>
      ${poBlocks || '<p>No shipments arriving this day.</p>'}`;
    document.body.appendChild(sheet);
    return sheet;
  }

  function printReport() {
    if (!lastData) return;
    buildPrintSheet(lastData);
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

  function setContent(html) {
    const body = modalEl.querySelector('#sit-body');
    if (body) body.innerHTML = html;
    const printBtn = modalEl.querySelector('#sit-print');
    if (printBtn) printBtn.disabled = !lastData || !(lastData.orders && lastData.orders.length);
  }

  async function load(refresh) {
    lastData = null;
    setContent('<div class="sit-loading"><i class="fas fa-spinner fa-spin"></i> Loading today’s inbound…</div>');
    try {
      const url = `${API_BASE}/api/sanmar-orders/inbound-today${refresh ? '?refresh=true' : ''}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      lastData = data;
      const dateLabel = modalEl.querySelector('#sit-date');
      if (dateLabel) dateLabel.textContent = fmtDate(data.date);
      setContent(renderBody(data));
    } catch (err) {
      // Never-Break Rule #4 — show the error, never fake data.
      setContent(`<div class="sit-error"><i class="fas fa-triangle-exclamation"></i>
        Couldn't load today’s inbound.<br><small>${esc(err.message)}</small><br>
        <button class="btn-cancel" id="sit-retry">Retry</button></div>`);
      const retry = modalEl.querySelector('#sit-retry');
      if (retry) retry.onclick = () => load(true);
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
            <h3><i class="fas fa-clipboard-list"></i> Today’s Inbound from SanMar</h3>
            <div class="sit-date-line" id="sit-date"></div>
          </div>
          <div class="sit-header-actions">
            <button class="btn-cancel" id="sit-print" title="Print or save a PDF of the whole day’s incoming items"><i class="fas fa-print"></i> Print / PDF</button>
            <button class="btn-cancel" id="sit-refresh" title="Re-pull from SanMar synced data"><i class="fas fa-rotate"></i> Refresh</button>
            <button class="sit-close" id="sit-close" aria-label="Close">&times;</button>
          </div>
        </div>
        <div id="sit-body"></div>
      </div>`;
    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) close(); });
    modalEl.querySelector('#sit-close').onclick = close;
    modalEl.querySelector('#sit-refresh').onclick = () => load(true);
    modalEl.querySelector('#sit-print').onclick = printReport;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl && modalEl.style.display !== 'none') close();
    });
  }

  function close() { if (modalEl) modalEl.style.display = 'none'; }

  window.openInboundTodayModal = function () {
    if (!modalEl) build();
    modalEl.style.display = 'flex';
    load(false);
  };
})();
