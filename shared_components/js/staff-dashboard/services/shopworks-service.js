/* =====================================================
   STAFF DASHBOARD v3 — SHOPWORKS SERVICE
   Wraps ManageOrders endpoints. Single source of truth for
   /manageorders/orders + /manageorders/lineitems calls.

   This refactor scope (v3 first cut):
   - Revenue (period total, order count, AOV)
   - Year-over-year comparison
   - Per-day sparkline data

   Out of scope (still in legacy staff-dashboard-service.js,
   to be ported in a follow-up phase): team performance hybrid,
   garment tracker line-item enrichment.
   ===================================================== */

import { dashboardFetchJson } from '../core/dashboard-fetch.js';
import { endpoints }          from '../core/dashboard-endpoints.js';
import { store }              from '../core/dashboard-store.js';

/* =====================================================
   Date helpers
   ===================================================== */
function formatYmd(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function getDateRange(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    return { start: formatYmd(start), end: formatYmd(end) };
}

function getLastYearRangeForDays(days) {
    const now = new Date();
    const currentEnd = new Date(now);
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - days);
    const lyStart = new Date(currentStart);
    lyStart.setFullYear(lyStart.getFullYear() - 1);
    const lyEnd = new Date(currentEnd);
    lyEnd.setFullYear(lyEnd.getFullYear() - 1);
    return { start: formatYmd(lyStart), end: formatYmd(lyEnd) };
}

function getYTDRange(year = new Date().getFullYear()) {
    return { start: `${year}-01-01`, end: formatYmd(new Date()) };
}

/* =====================================================
   Order normalization
   ===================================================== */
function totalsFromOrders(orders) {
    let revenue = 0;
    for (const o of orders) {
        revenue += parseFloat(o.cur_SubTotal) || 0;
    }
    return {
        revenue,
        orderCount: orders.length,
        aov: orders.length > 0 ? revenue / orders.length : 0,
    };
}

function bucketByDay(orders, startYmd, endYmd) {
    // Build a sequential list of days from start..end
    const start = new Date(startYmd + 'T00:00:00');
    const end = new Date(endYmd + 'T00:00:00');
    const days = [];
    const cursor = new Date(start);
    while (cursor <= end) {
        days.push({ ymd: formatYmd(cursor), revenue: 0 });
        cursor.setDate(cursor.getDate() + 1);
    }
    const idx = new Map(days.map((d, i) => [d.ymd, i]));
    for (const o of orders) {
        const d = (o.date_Invoiced || '').slice(0, 10);
        const i = idx.get(d);
        if (i != null) {
            days[i].revenue += parseFloat(o.cur_SubTotal) || 0;
        }
    }
    return days;
}

/* =====================================================
   Public API
   ===================================================== */

/**
 * Fetch ManageOrders orders for a date range.
 * Returns the normalized order array (may be empty).
 * Throws DashboardApiError on failure.
 */
export async function fetchOrders(startYmd, endYmd, { refresh = false } = {}) {
    // endpoints.manageOrders() is a RELATIVE path since the 2026-07-05 /api/mo
    // repointing — new URL() needs the origin base or it throws Invalid URL
    // (this was the "Couldn't load revenue" break on the dashboard).
    const url = new URL(endpoints.manageOrders(), window.location.origin);
    url.searchParams.set('date_Invoiced_start', startYmd);
    url.searchParams.set('date_Invoiced_end', endYmd);
    if (refresh) url.searchParams.set('refresh', 'true');
    const data = await dashboardFetchJson(url.toString());
    return data.result || [];
}

/**
 * Load revenue + sparkline for a window of N days.
 * Caches results for 5 minutes (per-window cache key).
 */
export async function loadRevenueWindow(days = 7, { refresh = false } = {}) {
    const cached = !refresh && store.get('metricsCache');
    if (cached && cached.days === days) {
        return cached.payload;
    }

    const range = getDateRange(days);
    const orders = await fetchOrders(range.start, range.end, { refresh });
    const totals = totalsFromOrders(orders);
    const sparkline = bucketByDay(orders, range.start, range.end);

    const payload = {
        days,
        range,
        totals,
        sparkline,
        fetchedAt: Date.now(),
    };

    store.set('metricsCache', { days, payload });
    return payload;
}

/**
 * Load year-over-year comparison.
 * Returns null lastYear if comparison fetch fails (logged).
 */
export async function loadYearOverYear(days = 7, { refresh = false } = {}) {
    const cur = await loadRevenueWindow(days, { refresh });
    const lastYearRange = getLastYearRangeForDays(days);

    let lastYearTotals = null;
    try {
        const lastYearOrders = await fetchOrders(lastYearRange.start, lastYearRange.end);
        lastYearTotals = totalsFromOrders(lastYearOrders);
    } catch (err) {
        console.warn('[shopworks] YoY fetch failed:', err.message);
    }

    let revenueGrowth = null;
    if (lastYearTotals && lastYearTotals.revenue > 0) {
        revenueGrowth = ((cur.totals.revenue - lastYearTotals.revenue) / lastYearTotals.revenue) * 100;
    }

    return {
        current: cur,
        lastYear: lastYearTotals ? { range: lastYearRange, totals: lastYearTotals } : null,
        revenueGrowth,
    };
}

/**
 * Load YTD total for the sales-goal banner.
 * Capped at 60-day window (legacy behavior — full YTD requires
 * caspio-archive-service which lands in a follow-up phase).
 */
export async function loadYtdSubset(days = 60) {
    const range = getDateRange(days);
    const orders = await fetchOrders(range.start, range.end);
    return totalsFromOrders(orders);
}

export const shopworksService = {
    fetchOrders,
    loadRevenueWindow,
    loadYearOverYear,
    loadYtdSubset,
    getDateRange,
    getYTDRange,
};
