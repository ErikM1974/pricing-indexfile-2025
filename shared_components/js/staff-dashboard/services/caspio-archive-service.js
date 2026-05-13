/* =====================================================
   STAFF DASHBOARD v3 — CASPIO ARCHIVE SERVICE
   Reads per-rep YTD totals from the Caspio archive
   (via /caspio/daily-sales-by-rep/ytd?year=N).
   Single source of truth for archived per-rep YTD data.
   ===================================================== */

import { dashboardFetchJson } from '../core/dashboard-fetch.js';
import { endpoints }          from '../core/dashboard-endpoints.js';
import { store }              from '../core/dashboard-store.js';

/**
 * Fetch archived YTD totals for a year.
 * Returns { success, year, reps: [...], lastArchivedDate, totalRevenue, totalOrders }.
 * Throws DashboardApiError on failure (Rule #4).
 */
export async function fetchYtdPerRep(year = new Date().getFullYear(), { refresh = false } = {}) {
    const cacheKey = `ytdPerRep:${year}`;
    if (!refresh) {
        const cached = store.get('metricsCache');
        if (cached?.kind === cacheKey) return cached.payload;
    }
    const url = endpoints.dailySalesByRepYTD(year);
    const data = await dashboardFetchJson(url);
    store.set('metricsCache', { kind: cacheKey, payload: data });
    return data;
}

export const caspioArchiveService = { fetchYtdPerRep };
