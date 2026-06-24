/* ============================================================
 * SanMar Daily Inbound — dashboard graph modal
 * ------------------------------------------------------------
 * Shows how many blank PIECES / BOXES / ORDERS are arriving from
 * SanMar each day, broken down by decoration method (DTG/EMB/SCP/…).
 *
 * Data: GET {API_BASE}/api/sanmar-orders/daily-inbound
 *   "Arriving" = SanMar's ACTUAL ship date + a per-warehouse ground-transit
 *   estimate to Milton, WA. SanMar's API returns NO delivery date, so this is
 *   the honest forward-looking signal (and only shipped POs appear).
 *
 * Self-contained: reads APP_CONFIG for the proxy base URL, builds its own
 * modal + a dependency-free SVG stacked bar chart. Exposes one global:
 *   window.openDailyInboundModal()
 * ============================================================ */
(function () {
  'use strict';

  const API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
    || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

  // Method → color. Order mirrors the proxy's METHOD_ORDER (stack/legend order).
  const METHOD_COLORS = {
    'Embroidery': '#4cb354',
    'Screen Print': '#2f6fed',
    'DTG': '#f59e0b',
    'DTF': '#8b5cf6',
    'Sticker': '#ec4899',
    'Emblem': '#14b8a6',
    'Online Store': '#64748b',
    'Other': '#9ca3af',
  };
  const FALLBACK_COLOR = '#9ca3af';

  let modalEl = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // 'YYYY-MM-DD' → Date (local, no TZ shift)
  function parseISO(d) {
    const [y, m, day] = String(d).split('-').map(Number);
    return new Date(y, (m || 1) - 1, day || 1);
  }
  function fmtShort(d) {
    const dt = parseISO(d);
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
  }
  function fmtDay(d) {
    const dt = parseISO(d);
    return dt.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
  }
  function addDays(iso, n) {
    const dt = parseISO(iso);
    dt.setDate(dt.getDate() + n);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  }

  // Build a continuous daily timeline across the window and map data onto it.
  function buildTimeline(data) {
    const byDate = new Map((data.days || []).map(d => [d.date, d]));
    const start = data.windowStart;
    const end = data.windowEnd;
    const out = [];
    let cur = start;
    let guard = 0;
    while (cur <= end && guard++ < 120) {
      out.push(byDate.get(cur) || { date: cur, pieces: 0, boxes: 0, orders: 0, byMethod: {} });
      cur = addDays(cur, 1);
    }
    return out;
  }

  function renderChart(data) {
    const methods = (data.methods && data.methods.length) ? data.methods : ['Other'];
    const timeline = buildTimeline(data);
    const maxPieces = Math.max(1, ...timeline.map(d => d.pieces));

    // SVG geometry (viewBox scales to container width).
    const W = 760, H = 340;
    const mL = 46, mR = 14, mT = 14, mB = 64;
    const innerW = W - mL - mR;
    const innerH = H - mT - mB;
    const n = timeline.length;
    const band = innerW / Math.max(1, n);
    const barW = Math.max(4, Math.min(34, band * 0.64));
    const y = v => mT + innerH - (v / maxPieces) * innerH;

    // Y gridlines / ticks (≈4 steps, rounded).
    const step = niceStep(maxPieces / 4);
    const ticks = [];
    for (let t = 0; t <= maxPieces + 0.5; t += step) ticks.push(t);

    let svg = `<svg class="di-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Daily inbound pieces by method">`;

    // gridlines + y labels
    for (const t of ticks) {
      const yy = y(t);
      svg += `<line x1="${mL}" y1="${yy.toFixed(1)}" x2="${W - mR}" y2="${yy.toFixed(1)}" class="di-grid"/>`;
      svg += `<text x="${mL - 6}" y="${(yy + 3.5).toFixed(1)}" class="di-ylabel">${fmtNum(t)}</text>`;
    }

    // "today" marker
    const todayIdx = timeline.findIndex(d => d.date === data.today);
    if (todayIdx >= 0) {
      const tx = mL + band * todayIdx + band / 2;
      svg += `<line x1="${tx.toFixed(1)}" y1="${mT}" x2="${tx.toFixed(1)}" y2="${mT + innerH}" class="di-today"/>`;
      svg += `<text x="${tx.toFixed(1)}" y="${mT + innerH + 34}" class="di-todaylabel" text-anchor="middle">Today</text>`;
    }

    // bars (stacked by method)
    const labelEvery = n > 16 ? 2 : 1;
    timeline.forEach((d, i) => {
      const cx = mL + band * i + band / 2;
      const x = cx - barW / 2;
      let yTop = mT + innerH;
      for (const m of methods) {
        const bm = d.byMethod && d.byMethod[m];
        const val = bm ? bm.pieces : 0;
        if (val > 0) {
          const h = (val / maxPieces) * innerH;
          yTop -= h;
          const tip = `${fmtShort(d.date)} — ${esc(m)}: ${fmtNum(val)} pcs, ${bm.boxes} box${bm.boxes === 1 ? '' : 'es'}, ${bm.orders} order${bm.orders === 1 ? '' : 's'}`;
          svg += `<rect x="${x.toFixed(1)}" y="${yTop.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${METHOD_COLORS[m] || FALLBACK_COLOR}"><title>${tip}</title></rect>`;
        }
      }
      // day total above the bar
      if (d.pieces > 0) {
        svg += `<text x="${cx.toFixed(1)}" y="${(yTop - 4).toFixed(1)}" class="di-total" text-anchor="middle">${fmtNum(d.pieces)}</text>`;
      }
      // x label
      if (i % labelEvery === 0) {
        svg += `<text x="${cx.toFixed(1)}" y="${mT + innerH + 16}" class="di-xlabel" text-anchor="middle">${esc(fmtDay(d.date))}</text>`;
      }
    });

    svg += `<line x1="${mL}" y1="${mT + innerH}" x2="${W - mR}" y2="${mT + innerH}" class="di-axis"/>`;
    svg += `</svg>`;
    return svg;
  }

  function niceStep(raw) {
    if (raw <= 1) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const base = raw / pow;
    const mult = base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10;
    return mult * pow;
  }
  function fmtNum(v) { return Math.round(v).toLocaleString('en-US'); }

  function renderLegend(methods) {
    return (methods || []).map(m =>
      `<span class="di-legend-item"><span class="di-swatch" style="background:${METHOD_COLORS[m] || FALLBACK_COLOR}"></span>${esc(m)}</span>`
    ).join('');
  }

  function renderTable(data) {
    const rows = (data.days || []).filter(d => d.pieces > 0).map(d => {
      const methods = Object.keys(d.byMethod || {})
        .sort((a, b) => (d.byMethod[b].pieces - d.byMethod[a].pieces))
        .map(m => `${esc(m)} ${fmtNum(d.byMethod[m].pieces)}`).join(', ');
      return `<tr>
        <td>${esc(fmtShort(d.date))}</td>
        <td class="di-num">${fmtNum(d.pieces)}</td>
        <td class="di-num">${d.boxes}</td>
        <td class="di-num">${d.orders}</td>
        <td class="di-methods">${methods}</td>
      </tr>`;
    }).join('');
    if (!rows) return '<p class="di-empty">No shipments are arriving in this window.</p>';
    return `<table class="di-table">
      <thead><tr><th>Arriving</th><th class="di-num">Pieces</th><th class="di-num">Boxes</th><th class="di-num">Orders</th><th>By method</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  function renderBody(data) {
    const t = data.totals || { pieces: 0, boxes: 0, orders: 0 };
    const pending = (data.pending && data.pending.orders) || 0;
    return `
      <div class="di-summary">
        <div class="di-stat"><span class="di-stat-num">${fmtNum(t.pieces)}</span><span class="di-stat-lbl">pieces arriving</span></div>
        <div class="di-stat"><span class="di-stat-num">${fmtNum(t.boxes)}</span><span class="di-stat-lbl">boxes</span></div>
        <div class="di-stat"><span class="di-stat-num">${fmtNum(t.orders)}</span><span class="di-stat-lbl">orders</span></div>
        <div class="di-stat di-stat--muted"><span class="di-stat-num">${fmtNum(pending)}</span><span class="di-stat-lbl">confirmed, not yet shipped</span></div>
      </div>
      <div class="di-legend">${renderLegend(data.methods)}</div>
      <div class="di-chart">${renderChart(data)}</div>
      <p class="di-note">${esc(data.note || '')} Window ${esc(fmtDay(data.windowStart))}–${esc(fmtDay(data.windowEnd))}.</p>
      <div class="di-tablewrap">${renderTable(data)}</div>`;
  }

  function setContent(html) {
    const body = modalEl.querySelector('#di-body');
    if (body) body.innerHTML = html;
  }

  async function load(refresh) {
    setContent('<div class="di-loading"><i class="fas fa-spinner fa-spin"></i> Loading SanMar inbound…</div>');
    try {
      const url = `${API_BASE}/api/sanmar-orders/daily-inbound?past=3&future=21${refresh ? '&refresh=true' : ''}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      setContent(renderBody(data));
    } catch (err) {
      // Never-Break Rule #4 — show the error, never fake data.
      setContent(`<div class="di-error"><i class="fas fa-triangle-exclamation"></i>
        Couldn't load SanMar inbound data.<br><small>${esc(err.message)}</small><br>
        <button class="btn-cancel" id="di-retry">Retry</button></div>`);
      const retry = modalEl.querySelector('#di-retry');
      if (retry) retry.onclick = () => load(true);
    }
  }

  function build() {
    modalEl = document.createElement('div');
    modalEl.className = 'modal di-modal';
    modalEl.style.display = 'none';
    modalEl.innerHTML = `
      <div class="modal-content di-modal-content">
        <div class="di-header">
          <h3><i class="fas fa-truck-ramp-box"></i> Daily Inbound from SanMar</h3>
          <div class="di-header-actions">
            <button class="btn-cancel" id="di-refresh" title="Re-pull from the synced SanMar data"><i class="fas fa-rotate"></i> Refresh</button>
            <button class="di-close" id="di-close" aria-label="Close">&times;</button>
          </div>
        </div>
        <div id="di-body"></div>
      </div>`;
    document.body.appendChild(modalEl);

    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) close(); });
    modalEl.querySelector('#di-close').onclick = close;
    modalEl.querySelector('#di-refresh').onclick = () => load(true);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl && modalEl.style.display !== 'none') close();
    });
  }

  function close() { if (modalEl) modalEl.style.display = 'none'; }

  window.openDailyInboundModal = function () {
    if (!modalEl) build();
    modalEl.style.display = 'flex';
    load(false);
  };
})();
