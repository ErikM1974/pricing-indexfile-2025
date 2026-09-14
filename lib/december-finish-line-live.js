'use strict';

const YEAR = 2026;
// Agreed plan exclusions. Exclude only detailed operational rows; historical
// daily aggregates have no order IDs and cannot be independently re-audited here.
const EXCLUDED_ORDERS = new Set(['133856', '138925']);
function day(value) { return /^\d{4}-\d{2}-\d{2}/.test(String(value || '')) ? String(value).slice(0, 10) : null; }
function cents(value) {
    if (value === null || value === '' || value === undefined || !Number.isFinite(Number(value))) throw new Error('A source returned an invalid money value');
    return Math.round(Number(value) * 100);
}
function count(value) {
    if (value === null || value === '' || value === undefined || !Number.isInteger(Number(value)) || Number(value) < 0) throw new Error('A source returned an invalid count');
    return Number(value);
}
function orderSubtotalCents(row) {
    if (row.cur_SubTotal !== null && row.cur_SubTotal !== undefined && row.cur_SubTotal !== '') return cents(row.cur_SubTotal);
    // ShopWorks emits null for zero-merchandise/freight-only invoices. Accept
    // zero only when the independent invoice total equals tax plus shipping;
    // a missing amount on an ordinary invoice still blocks the current total.
    const total = cents(row.cur_TotalInvoice), tax = cents(row.cur_SalesTaxTotal);
    const shipping = row.cur_Shipping === null ? 0 : cents(row.cur_Shipping);
    if (total === tax + shipping) return 0;
    throw new Error('An order is missing its merchandise subtotal');
}
function pacificDay(now) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
function windowFor(now) {
    const today = pacificDay(now);
    const end = today < `${YEAR}-12-31` ? today : `${YEAR}-12-31`;
    const cutoff = new Date(today + 'T12:00:00Z');
    cutoff.setUTCDate(cutoff.getUTCDate() - 59);
    const start = cutoff.toISOString().slice(0, 10) < `${YEAR}-01-01` ? `${YEAR}-01-01` : cutoff.toISOString().slice(0, 10);
    return { year: YEAR, today, end, start, hasRecentWindow: start <= end };
}
function uniqueOrders(data) {
    if (!data || data.stale || !Array.isArray(data.result) || (data.count !== undefined && Number(data.count) !== data.result.length)) throw new Error('ShopWorks returned incomplete or stale orders');
    const seen = new Map();
    for (const row of data.result) {
        const raw = String(row.id_Order ?? '').trim();
        if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) <= 0) throw new Error('ShopWorks returned an order without an ID');
        const id = String(Number(raw)), normalized = { ...row, id_Order: id };
        if (seen.has(id) && JSON.stringify(seen.get(id)) !== JSON.stringify(normalized)) throw new Error('ShopWorks returned conflicting copies of an order');
        seen.set(id, normalized);
    }
    return [...seen.values()];
}
function repName(value) { return String(value || 'Unassigned').trim() || 'Unassigned'; }

function summarizeSales(archive, invoices, assignments, window, baseline) {
    if (!archive || archive.success !== true || !Array.isArray(archive.days)) throw new Error('The sales archive could not be read');
    const days = new Map();
    const add = (date, rep, revenueCents, orders) => {
        const key = date + '|' + rep;
        const current = days.get(key) || { date, rep, revenueCents: 0, orders: 0 };
        current.revenueCents += revenueCents; current.orders += orders;
        days.set(key, current);
    };
    let lastArchivedSalesDate = null;
    const archiveKeys = new Set();
    for (const row of archive.days) {
        const date = day(row.date);
        if (!date || !date.startsWith(`${YEAR}-`) || date > window.end || !Array.isArray(row.reps)) throw new Error('Invalid sales archive date');
        if (!lastArchivedSalesDate || date > lastArchivedSalesDate) lastArchivedSalesDate = date;
        for (const rep of row.reps) {
            const name = repName(rep.name), key = date + '|' + name;
            if (archiveKeys.has(key)) throw new Error('Duplicate daily sales rows');
            archiveKeys.add(key);
            const amount = cents(rep.revenue), orders = count(rep.orderCount);
            // Replace the entire recent interval; do not add live invoices on
            // top of already archived invoices. This captures changed/voided rows.
            if (!window.hasRecentWindow || date < window.start) add(date, name, amount, orders);
        }
    }
    if (window.hasRecentWindow && window.start > `${YEAR}-01-01` && (!lastArchivedSalesDate || lastArchivedSalesDate < window.start)) throw new Error('Historical sales coverage is unavailable');
    const reps = new Map();
    if (assignments) {
        if (assignments.success !== true || !Array.isArray(assignments.records)) throw new Error('Rep assignments could not be read');
        for (const row of assignments.records) {
            const id = String(row.ID_Customer ?? '').trim(), name = repName(row.CustomerServiceRep);
            if (reps.has(id) && reps.get(id) !== name) throw new Error('Conflicting customer rep assignments');
            reps.set(id, name);
        }
    }
    let lastLiveInvoiceDate = null;
    if (window.hasRecentWindow) {
        for (const row of uniqueOrders(invoices)) {
            const date = day(row.date_Invoiced);
            if (!date || date < window.start || date > window.end || String(row.sts_Invoiced) !== '1') throw new Error('Invoice response contains an unexpected date or status');
            if (EXCLUDED_ORDERS.has(String(row.id_Order))) continue;
            if (!lastLiveInvoiceDate || date > lastLiveInvoiceDate) lastLiveInvoiceDate = date;
            add(date, reps.get(String(row.id_Customer)) || 'Unassigned', orderSubtotalCents(row), 1);
        }
    }
    const months = Array.from({ length: 12 }, (_, index) => ({ month: `${YEAR}-${String(index + 1).padStart(2, '0')}`, revenueCents: 0, orders: 0 }));
    const byRep = new Map();
    let revenueCents = 0, orders = 0, baselineSalesCents = 0;
    for (const row of days.values()) {
        revenueCents += row.revenueCents; orders += row.orders;
        const month = months[Number(row.date.slice(5, 7)) - 1];
        month.revenueCents += row.revenueCents; month.orders += row.orders;
        const rep = byRep.get(row.rep) || { name: row.rep, revenueCents: 0, orders: 0 };
        rep.revenueCents += row.revenueCents; rep.orders += row.orders;
        byRep.set(row.rep, rep);
        if (baseline && row.date <= baseline.asOf) baselineSalesCents += row.revenueCents;
    }
    return { revenueCents, orders, months, reps: assignments ? [...byRep.values()].sort((a, b) => b.revenueCents - a.revenueCents) : null,
        lastArchivedSalesDate, lastLiveInvoiceDate,
        comparison: baseline ? { asOf: baseline.asOf, financialNetSalesCents: baseline.netSalesCents, operationalSalesCents: baselineSalesCents, differenceCents: baselineSalesCents - baseline.netSalesCents } : null };
}

function summarizeWorkload(data, window) {
    let orders = 0, subtotalCents = 0;
    for (const row of uniqueOrders(data)) {
        const date = day(row.date_Ordered);
        if (!date || date < window.start || date > window.end) throw new Error('Recent orders returned an unexpected date');
        if (EXCLUDED_ORDERS.has(String(row.id_Order)) || String(row.sts_Invoiced) !== '0') continue;
        orders++; subtotalCents += orderSubtotalCents(row);
    }
    return { orders, subtotalCents, start: window.start, end: window.end };
}

function createLiveService({ baseUrl, secret, fetch, clock = () => new Date() }) {
    let cached, pending;
    async function read(endpoint) {
        if (!secret) throw new Error('Live data connection is not configured');
        const response = await fetch(baseUrl + '/api/' + endpoint, { headers: { 'X-CRM-API-Secret': secret }, signal: AbortSignal.timeout(25000) });
        if (!response.ok) throw new Error('A source is unavailable');
        const data = await response.json();
        if (data.stale === true) throw new Error('A source returned stale data');
        return data;
    }
    async function refresh(baseline) {
        const now = clock(), window = windowFor(now);
        const requests = [
            read(`caspio/daily-sales-by-rep?start=${YEAR}-01-01&end=${window.end}`),
            window.hasRecentWindow ? read(`manageorders/orders?date_Invoiced_start=${window.start}&date_Invoiced_end=${window.end}&refresh=true`) : Promise.resolve(null),
            read('sales-reps-2026'), read('service-codes?code=CO-ANNUAL-GOAL'),
            window.hasRecentWindow ? read(`manageorders/orders?date_Ordered_start=${window.start}&date_Ordered_end=${window.end}&refresh=true`) : Promise.resolve(null),
        ];
        const results = await Promise.allSettled(requests);
        const value = index => { if (results[index].status === 'rejected') throw results[index].reason; return results[index].value; };
        const errors = [];
        let sales = null, goalCents = null, workload = null;
        try { sales = summarizeSales(value(0), value(1), results[2].status === 'fulfilled' ? value(2) : null, window, baseline); }
        catch { errors.push('Sales could not be refreshed. Historical and recent invoices must both be available before a year-to-date total is shown.'); }
        if (results[2].status === 'rejected') errors.push('The sales rep breakdown is unavailable. Company totals still include every rep and unassigned customer.');
        try {
            const data = value(3);
            const rows = (Array.isArray(data.data) ? data.data : []).filter(row => row.ServiceCode === 'CO-ANNUAL-GOAL' && (row.IsActive === true || row.IsActive === 1 || row.IsActive === 'Yes'));
            if (rows.length !== 1 || cents(rows[0].SellPrice) <= 0) throw new Error('Missing configured sales goal');
            goalCents = cents(rows[0].SellPrice);
        } catch { errors.push('The company sales goal is unavailable. No substitute goal is being used.'); }
        if (window.hasRecentWindow) {
            try { workload = summarizeWorkload(value(4), window); }
            catch { errors.push('Recent uninvoiced work could not be refreshed.'); }
        }
        const result = { retrievedAt: clock().toISOString(), window, sales, goalCents, workload, errors,
            coverageNote: 'ShopWorks invoiced subtotals include signed credits and exclude tax and shipping. Recent invoices replace the matching archive dates. Earlier dates come from the daily sales archive, which does not expose a completeness watermark. Latest sales date is not a last-sync confirmation.',
            financialNote: 'The saved accounting, payroll and receivables baseline remains dated. Operational sales do not recalculate profit. Recent uninvoiced work is a 60-day order window, not the complete company backlog or accounts receivable.' };
        cached = { result, time: now.getTime() };
        return result;
    }
    return {
        async get({ force = false, baseline = null } = {}) {
            if (!force && cached && clock().getTime() - cached.time < 300000 && !cached.result.errors.length) return cached.result;
            if (!pending) pending = refresh(baseline).finally(() => { pending = null; });
            return pending;
        },
    };
}

module.exports = { cents, day, orderSubtotalCents, windowFor, summarizeSales, summarizeWorkload, createLiveService };
