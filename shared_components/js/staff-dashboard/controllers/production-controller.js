/* =====================================================
   STAFF DASHBOARD v3 — PRODUCTION DUE CONTROLLER (rebuilt 2026-09-04)

   The "Production Due" card on Company Numbers: LIVE unshipped ShopWorks
   orders that have missed their requested-ship date or are due within the
   next 7 days, with the blanks status that explains most of the lateness.

   Until 2026-09-04 this file rendered the "Production Turnaround" predictor
   from a STATIC stats file (production-schedule-stats.js — completions
   through Nov 2025, compiled Jan 2026). Production logging stopped in May
   2026, so a ten-month-old estimate was not decision-grade; the static files
   were retired with that card.

   Data: /api/crm-proxy/ae-dashboard/due-dates-all?days=30 — the same
   requireStaff forwarder the Past Due Orders report reads (ORDER_ODBC mirror
   + PurchaseOrders join, built in the proxy's buildDueDates). Payload:
   { today, lookbackDays, ordersScanned, counts:{late, atRisk, dueSoonOnTrack},
     late:[…], atRisk:[…], reps:[…], byRep:{…} } — items carry idOrder,
   company, rep, dueDate, daysUntilDue, blanks, subtotal, orderType.

   Rule 4: a failed read renders the visible error + Retry (showApiError),
   never a remembered list — a blank board would read as "nothing is late".
   ===================================================== */

import { dashboardFetchJson } from '../core/dashboard-fetch.js';
import { showApiError, clearApiError } from '../core/dashboard-errors.js';
import { escapeHtml, formatMoney } from '../core/dashboard-ui-utils.js';

const ENDPOINT = '/api/crm-proxy/ae-dashboard/due-dates-all?days=30';
const LIST_MAX = 6;

const el = (id) => document.getElementById(id);
const put = (id, v) => { const n = el(id); if (n) n.textContent = (v == null) ? '—' : String(v); };

function blanksText(b) {
    if (b === 'none') return 'no PO raised';
    if (b === 'ordered') return 'blanks ordered, not in';
    if (b === 'partial') return 'blanks partial';
    if (b === 'received') return 'blanks in';
    return '';
}

function dueText(o) {
    const d = Number(o.daysUntilDue);
    if (d < 0) return `${Math.abs(d)}d late`;
    if (d === 0) return 'due today';
    return `due in ${d}d`;
}

function renderProduction(d) {
    const late = Array.isArray(d.late) ? d.late : [];
    const atRisk = Array.isArray(d.atRisk) ? d.atRisk : [];
    const counts = d.counts || {};

    put('production-late', counts.late ?? late.length);
    put('production-risk', counts.atRisk ?? atRisk.length);
    put('production-nopo', late.filter((o) => o.blanks === 'none').length);
    put('production-ontrack', counts.dueSoonOnTrack);

    const asOf = el('production-asof');
    if (asOf) {
        asOf.textContent = `ShopWorks as of ${d.today || 'today'} · ${Number(d.ordersScanned || 0).toLocaleString('en-US')} orders scanned` +
            (d.lateTruncated ? ` · ${d.lateTruncated} more past-due not returned` : '');
    }

    const list = el('production-due-list');
    if (!list) return;
    const rows = late.concat(atRisk).sort((a, b) => Number(a.daysUntilDue) - Number(b.daysUntilDue));
    if (!rows.length) {
        list.innerHTML = '<div class="production-empty">✅ Nothing past due or at risk — every unshipped order due this week has its blanks in.</div>';
        return;
    }
    list.innerHTML = rows.slice(0, LIST_MAX).map((o) => {
        const isLate = Number(o.daysUntilDue) < 0;
        return `
            <div class="cn-due-row ${isLate ? 'cn-due-row--late' : 'cn-due-row--risk'}">
                <span class="cn-due-wo num">WO ${escapeHtml(o.idOrder)}</span>
                <span class="cn-due-main">
                    <span class="cn-due-company">${escapeHtml(o.company || '')}</span>
                    <span class="cn-due-sub">${escapeHtml(o.rep || '')}${o.orderType ? ' · ' + escapeHtml(o.orderType) : ''}${o.partiallyShipped ? ' · partially shipped' : ''}</span>
                </span>
                <span class="cn-due-blanks ${o.blanks === 'none' ? 'cn-due-blanks--nopo' : ''}">${escapeHtml(blanksText(o.blanks))}</span>
                <span class="cn-due-when num">${escapeHtml(dueText(o))}</span>
                <span class="cn-due-value num">${o.subtotal ? escapeHtml(formatMoney(o.subtotal)) : ''}</span>
            </div>`;
    }).join('') + (rows.length > LIST_MAX
        ? `<div class="cn-due-more">+ ${rows.length - LIST_MAX} more — <a href="/dashboards/past-due-orders.html">full list by rep</a></div>`
        : '');
}

async function loadProduction(refresh = false) {
    clearApiError('production');
    const list = el('production-due-list');
    if (list && !refresh) list.innerHTML = '<div class="production-empty">Loading due dates…</div>';
    try {
        const d = await dashboardFetchJson(ENDPOINT + (refresh ? '&refresh=1' : ''));
        if (d?.error) throw new Error(d.details || d.error);
        renderProduction(d);
        return d;
    } catch (err) {
        showApiError('production', err, {
            onRetry: () => loadProduction(true),
            detail: 'ShopWorks due dates are unavailable (ORDER_ODBC mirror). Nothing is shown rather than a stale list — a blank board would read as "nothing is late".',
        });
        return null;
    }
}

export function initProduction() {
    return loadProduction(false);
}

/** Company Numbers tick / header Refresh (force bypasses the proxy's 10-minute cache). */
export function refreshProduction(force = false) {
    return loadProduction(!!force);
}
