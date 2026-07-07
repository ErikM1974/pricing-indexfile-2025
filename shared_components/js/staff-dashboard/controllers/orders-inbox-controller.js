/* =====================================================
   STAFF DASHBOARD v3 — Orders Inbox + Money Collected +
   Sample Follow-ups (2026-07-06, replaces the retired
   announcements zone)

   Three widgets, one data philosophy: show what came in
   and what needs a human — never a silent failure.

   • Orders Inbox — quote_sessions from the last 7 days:
     paid web orders (SAM/CAP/DTG/3DT storefronts), quotes
     Accepted but unpaid, and PUSH FAILURES (money taken,
     ShopWorks entry missing) pinned loudly on top.
   • Money Collected — Order_Payments ledger (every Stripe
     payment: quote deposits/balances, storefronts, samples).
   • Sample Follow-ups — sample orders (PO prefix SAMPLE- or
     SAM) from ManageOrders, last 30 days, minus customers who
     ordered something else since → a rep call list.
   ===================================================== */

import { endpoints, apiBaseUrl } from '../core/dashboard-endpoints.js';
import { dashboardFetchJson } from '../core/dashboard-fetch.js';
import { events } from '../core/dashboard-events.js';
import { escapeHtml, formatMoney, formatShortDate, formatRelativeTime } from '../core/dashboard-ui-utils.js';

/* ── Shared helpers ─────────────────────────────────── */

const STOREFRONT_PREFIXES = ['SAM', 'CAP', 'DTG', '3DT', 'TDT', 'CTS'];

function ymdDaysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
}

function prefixOf(quoteID) {
    const m = String(quoteID || '').match(/^([A-Z]+)/);
    return m ? m[1] : '';
}

function quoteLink(quoteID) {
    return `/quote/${encodeURIComponent(quoteID)}`;
}

function errorCard(slotId, title, detail) {
    const slot = document.getElementById(slotId);
    if (!slot) return;
    slot.innerHTML = `
        <div class="inbox-error" role="alert">
            <i class="fas fa-triangle-exclamation" aria-hidden="true"></i>
            <div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(detail)}</p></div>
        </div>`;
}

function emptyRow(text) {
    return `<li class="inbox-empty">${escapeHtml(text)}</li>`;
}

/* ── Orders Inbox ───────────────────────────────────── */

async function loadOrdersInbox() {
    const paidList = document.getElementById('inboxPaidList');
    const acceptedList = document.getElementById('inboxAcceptedList');
    const alerts = document.getElementById('ordersInboxAlerts');
    if (!paidList || !acceptedList) return;
    paidList.setAttribute('aria-busy', 'true');
    acceptedList.setAttribute('aria-busy', 'true');

    let rows;
    try {
        // 30-day createdAfter window (proxy-side WHERE): UpdatedAt isn't
        // maintained on quote_sessions, so a quote accepted THIS week may have
        // been created weeks ago — fetch wide, filter narrow client-side.
        rows = await dashboardFetchJson(
            `${apiBaseUrl}/quote_sessions?createdAfter=${ymdDaysAgo(30)}&refresh=true`);
    } catch (err) {
        console.error('[OrdersInbox] load failed:', err);
        errorCard('ordersInboxAlerts', 'Couldn’t load the orders inbox',
            'quote_sessions is unavailable right now. Retry from the refresh button.');
        paidList.setAttribute('aria-busy', 'false');
        acceptedList.setAttribute('aria-busy', 'false');
        return;
    }
    const sessions = Array.isArray(rows) ? rows : (rows?.data || []);

    const sevenDaysAgo = ymdDaysAgo(7);
    const failures = [];
    const paid = [];
    const accepted = [];
    for (const s of sessions) {
        const status = String(s.Status || '');
        const pfx = prefixOf(s.QuoteID);
        const createdDay = String(s.CreatedAt || '').slice(0, 10);
        if (status.includes('ShopWorks Failed')) {
            failures.push(s);   // any age in window — money is sitting uncaptured in ShopWorks
        } else if ((status === 'Processed' || status === 'Payment Confirmed')
                   && STOREFRONT_PREFIXES.includes(pfx)
                   && createdDay >= sevenDaysAgo) {
            paid.push(s);
        } else if (status === 'Accepted') {
            accepted.push(s);   // full 30-day window — acceptance can lag creation
        }
    }

    // Push failures are the loudest thing on the dashboard: money is in
    // Stripe but no ShopWorks order exists until a human enters it.
    if (alerts) {
        alerts.innerHTML = failures.length
            ? `<div class="inbox-failure" role="alert">
                   <i class="fas fa-circle-exclamation" aria-hidden="true"></i>
                   <div>
                       <strong>${failures.length} paid order${failures.length === 1 ? '' : 's'} FAILED the ShopWorks push — manual entry needed</strong>
                       <ul>${failures.map((s) => `
                           <li><a href="${quoteLink(s.QuoteID)}" target="_blank" rel="noopener">${escapeHtml(s.QuoteID)}</a>
                               — ${escapeHtml(s.CompanyName || s.CustomerName || 'unknown')}
                               (${formatMoney((parseFloat(s.TotalAmount) || 0) + (parseFloat(s.TaxAmount) || 0))})</li>`).join('')}
                       </ul>
                   </div>
               </div>`
            : '';
    }

    const orderRow = (s) => {
        const pfx = prefixOf(s.QuoteID);
        const total = (parseFloat(s.TotalAmount) || 0) + (parseFloat(s.TaxAmount) || 0);
        return `
            <li>
                <a class="inbox-row" href="${quoteLink(s.QuoteID)}" target="_blank" rel="noopener">
                    <span class="inbox-chip inbox-chip--${escapeHtml(pfx.toLowerCase())}">${escapeHtml(pfx)}</span>
                    <span class="inbox-row-main">
                        <span class="inbox-row-title">${escapeHtml(s.CompanyName || s.CustomerName || s.QuoteID)}</span>
                        <span class="inbox-row-sub">${escapeHtml(s.QuoteID)} · ${escapeHtml(formatRelativeTime(s.CreatedAt))}</span>
                    </span>
                    <span class="inbox-row-amount">${formatMoney(total)}</span>
                </a>
            </li>`;
    };

    paidList.innerHTML = paid.length
        ? paid.slice(0, 8).map(orderRow).join('')
        : emptyRow('No paid web orders in the last 7 days.');
    acceptedList.innerHTML = accepted.length
        ? accepted.slice(0, 8).map(orderRow).join('')
        : emptyRow('No accepted-but-unpaid quotes right now.');
    paidList.setAttribute('aria-busy', 'false');
    acceptedList.setAttribute('aria-busy', 'false');
}

export function initOrdersInbox() {
    events.register('orders-inbox:refresh', () => loadOrdersInbox());
    loadOrdersInbox();
}

/* ── Money Collected ────────────────────────────────── */

const KIND_LABELS = {
    deposit: 'Deposit', balance: 'Balance',
    'samples-order': 'Samples', order: 'Order', refund: 'Refund',
};

function entryVal(e, ...keys) {
    for (const k of keys) {
        if (e[k] !== undefined && e[k] !== null && e[k] !== '') return e[k];
    }
    return '';
}

async function loadMoneyCollected() {
    const list = document.getElementById('payRecentList');
    if (!list) return;
    let data;
    try {
        // Same-origin staff forwarder (the proxy's ledger route is CRM-secret
        // gated — payer emails are PII; same airtight pattern as /api/mo/*)
        data = await dashboardFetchJson(new URL('/api/staff/payments/recent?limit=200', window.location.origin).toString());
    } catch (err) {
        console.error('[MoneyCollected] load failed:', err);
        list.innerHTML = emptyRow('Payments ledger unavailable right now.');
        list.setAttribute('aria-busy', 'false');
        return;
    }
    const entries = (data && (data.entries || data.data)) || [];

    const now = new Date();
    const startOf = (daysBack) => { const d = new Date(now); d.setDate(d.getDate() - daysBack); return d; };
    const todayYmd = now.toISOString().slice(0, 10);
    let today = 0, week = 0, month = 0;
    for (const e of entries) {
        const amount = parseFloat(entryVal(e, 'amount', 'Amount')) || 0;
        const createdRaw = entryVal(e, 'created', 'Created', 'createdAt');
        const created = createdRaw ? (window.CaspioDate ? window.CaspioDate.parse(createdRaw) : new Date(createdRaw)) : null;
        if (!created || isNaN(created)) continue;
        if (created >= startOf(30)) month += amount;
        if (created >= startOf(7)) week += amount;
        if (created.toISOString ? createdRaw.slice(0, 10) === todayYmd : false) today += amount;
    }
    const put = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = formatMoney(v); };
    put('payToday', today);
    put('payWeek', week);
    put('payMonth', month);

    list.innerHTML = entries.length
        ? entries.slice(0, 8).map((e) => {
            const kind = String(entryVal(e, 'type', 'Type') || '').toLowerCase();
            const quoteID = entryVal(e, 'quoteID', 'QuoteID');
            return `
                <li>
                    <a class="inbox-row" href="${quoteLink(quoteID)}" target="_blank" rel="noopener">
                        <span class="inbox-chip inbox-chip--pay">${escapeHtml(KIND_LABELS[kind] || kind || 'Payment')}</span>
                        <span class="inbox-row-main">
                            <span class="inbox-row-title">${escapeHtml(entryVal(e, 'companyName', 'Company_Name') || entryVal(e, 'customerName', 'Customer_Name') || quoteID)}</span>
                            <span class="inbox-row-sub">${escapeHtml(quoteID)} · ${escapeHtml(entryVal(e, 'payerEmail', 'Payer_Email'))}</span>
                        </span>
                        <span class="inbox-row-amount">${formatMoney(parseFloat(entryVal(e, 'amount', 'Amount')) || 0)}</span>
                    </a>
                </li>`;
        }).join('')
        : emptyRow('No online payments recorded yet.');
    list.setAttribute('aria-busy', 'false');
}

export function initMoneyCollected() {
    loadMoneyCollected();
}

/* ── Sample Follow-ups ──────────────────────────────── */

function orderPo(o) {
    return String(o.CustomerPurchaseOrder || o.customerPurchaseOrder || o.CustomerPO || o.cust_PO || '').toUpperCase();
}

function isSampleOrder(o) {
    const po = orderPo(o);
    return po.startsWith('SAMPLE-') || po.startsWith('SAM');
}

function customerKey(o) {
    // Company name is the most reliably-populated identity on MO orders
    return String(o.CustomerName || '').trim().toLowerCase();
}

async function loadSamplePipeline() {
    const list = document.getElementById('samplePipelineList');
    if (!list) return;
    let orders;
    try {
        const url = new URL(endpoints.manageOrders(), window.location.origin);
        url.searchParams.set('date_Invoiced_start', ymdDaysAgo(60));
        url.searchParams.set('date_Invoiced_end', new Date().toISOString().slice(0, 10));
        const data = await dashboardFetchJson(url.toString());
        orders = data.result || [];
    } catch (err) {
        console.error('[SamplePipeline] load failed:', err);
        errorCard('samplePipelineAlerts', 'Couldn’t load sample orders',
            'ManageOrders is unavailable right now — the call list will populate when it recovers.');
        list.innerHTML = '';
        list.setAttribute('aria-busy', 'false');
        return;
    }

    const cutoff30 = ymdDaysAgo(30);
    const samples = [];
    const orderedSince = new Map(); // customerKey → latest non-sample order date
    for (const o of orders) {
        const day = String(o.date_Invoiced || '').slice(0, 10);
        if (isSampleOrder(o)) {
            if (day >= cutoff30) samples.push(o);
        } else {
            const k = customerKey(o);
            if (k && (!orderedSince.has(k) || orderedSince.get(k) < day)) orderedSince.set(k, day);
        }
    }

    // Call list = sampled in the last 30 days, no non-sample order on/after it
    const followUps = samples.filter((s) => {
        const k = customerKey(s);
        const sampleDay = String(s.date_Invoiced || '').slice(0, 10);
        const laterOrder = k && orderedSince.get(k);
        return !(laterOrder && laterOrder >= sampleDay);
    }).sort((a, b) => String(b.date_Invoiced).localeCompare(String(a.date_Invoiced)));

    list.innerHTML = followUps.length
        ? followUps.slice(0, 10).map((s) => `
            <li class="pipeline-row">
                <span class="inbox-chip ${orderPo(s).startsWith('SAM') && !orderPo(s).startsWith('SAMPLE-') ? 'inbox-chip--pay' : 'inbox-chip--free'}">
                    ${orderPo(s).startsWith('SAMPLE-') ? 'FREE' : 'PAID'}
                </span>
                <span class="inbox-row-main">
                    <span class="inbox-row-title">${escapeHtml(s.CustomerName || s.Contact_Name || 'Unknown customer')}</span>
                    <span class="inbox-row-sub">${escapeHtml(s.Contact_Name || '')} · sampled ${escapeHtml(formatShortDate(s.date_Invoiced))} · ${escapeHtml(s.CustomerServiceRep || 'House')}</span>
                </span>
                <span class="inbox-row-amount">${formatMoney(parseFloat(s.cur_SubTotal) || 0)}</span>
            </li>`).join('')
        : emptyRow('Nobody waiting — every sampled customer has since ordered (or no samples in 30 days).');
    list.setAttribute('aria-busy', 'false');
}

export function initSamplePipeline() {
    loadSamplePipeline();
}
