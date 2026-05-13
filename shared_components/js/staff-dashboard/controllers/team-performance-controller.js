/* =====================================================
   STAFF DASHBOARD v3 — TEAM PERFORMANCE CONTROLLER
   Renders per-rep YTD revenue cards using the Caspio archive.

   v3 first cut: archive-only (covers Jan 1 → ~60 days ago).
   Live "last 60 days" top-up + full hybrid logic in follow-up phase.

   Display: rep cards sorted by personal pace (Phase 4.4 polish):
   pacing = rep_revenue / (rep_share_last_year × $3M).
   For now we sort by absolute revenue (simplest correct sort)
   and show the personal-pace badge if last-year share is known.
   ===================================================== */

import { register } from '../core/dashboard-events.js';
import { showApiError, clearApiError } from '../core/dashboard-errors.js';
import { escapeHtml, formatMoney, ANNUAL_GOAL } from '../core/dashboard-ui-utils.js';
import { caspioArchiveService } from '../services/caspio-archive-service.js';
import { setYtdTotal } from './sales-goal-controller.js';

const REP_NAME_ALIASES = {
    'ruth nhoung': 'Ruthie Nhoung',
    'ruthie nhoung': 'Ruthie Nhoung',
    'ruth nhong': 'Ruthie Nhoung',
    'ruth': 'Ruthie Nhoung',
    'ruthie': 'Ruthie Nhoung',
    'house': 'House',
    'unknown': 'Unassigned',
};

const HOUSE_REPS = new Set([
    'jim mickelson', 'dyonii quitugua', 'erik mickelson', 'adriyella trujillo',
    'house-legacy', 'house legacy', // consolidate stale archive aliases
]);

function normalizeRepName(name) {
    if (!name) return 'Unassigned';
    const k = name.trim().replace(/\s+/g, ' ').toLowerCase();
    if (HOUSE_REPS.has(k)) return 'House';
    return REP_NAME_ALIASES[k] || name.trim();
}

function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function consolidateReps(rawReps) {
    // Group by normalized name (handles "House" + alias variants).
    // API field shape: { name, totalRevenue, totalOrders }
    const map = new Map();
    for (const r of rawReps || []) {
        const name = normalizeRepName(r.name || r.repName);
        const revenue = Number(r.totalRevenue || r.revenue || 0);
        const orders  = Number(r.totalOrders || r.orderCount || r.orders || 0);
        if (!map.has(name)) {
            map.set(name, { name, revenue: 0, orders: 0, sources: [] });
        }
        const slot = map.get(name);
        slot.revenue += revenue;
        slot.orders  += orders;
        if (r.name && r.name !== name) slot.sources.push(r.name);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

function renderTeam(payload) {
    const container = document.getElementById('salesTeamList');
    const dateRangeEl = document.getElementById('teamDateRange');
    if (!container) return;

    if (!payload?.reps?.length) {
        container.innerHTML = `
            <div class="rep-empty">
                <i class="fas fa-circle-info" aria-hidden="true"></i>
                No archived 2026 sales yet — once the daily archive cron runs, reps will appear here.
            </div>
        `;
        return;
    }

    const reps = consolidateReps(payload.reps);
    const total = reps.reduce((s, r) => s + r.revenue, 0) || 1;

    if (dateRangeEl) {
        const archived = payload.lastArchivedDate
            ? `Archive through ${payload.lastArchivedDate}`
            : `Year-to-date · ${payload.year}`;
        dateRangeEl.textContent = archived;
    }

    container.innerHTML = reps.map((r) => {
        const pct = (r.revenue / total) * 100;
        const goalShare = (r.revenue / ANNUAL_GOAL) * 100;
        const houseSubtitle = r.name === 'House' && r.sources.length
            ? `<div class="rep-subtitle">${escapeHtml(r.sources.slice(0, 4).join(', '))}</div>`
            : '';
        return `
            <div class="rep-card">
                <div class="rep-info">
                    <div class="rep-avatar">${escapeHtml(getInitials(r.name))}</div>
                    <div class="rep-name-group">
                        <span class="rep-name">${escapeHtml(r.name)}</span>
                        ${houseSubtitle}
                    </div>
                </div>
                <div class="rep-progress" title="${pct.toFixed(1)}% of team total">
                    <div class="rep-progress-bar" style="width: ${pct.toFixed(1)}%"></div>
                </div>
                <div class="rep-stats">
                    <div class="rep-revenue">${escapeHtml(formatMoney(r.revenue))}</div>
                    <div class="rep-orders num">${r.orders.toLocaleString('en-US')} orders · ${goalShare.toFixed(1)}% of goal</div>
                </div>
            </div>
        `;
    }).join('');
}

async function loadTeam(refresh = false) {
    clearApiError('metrics');
    const container = document.getElementById('salesTeamList');
    if (container && !refresh) {
        container.innerHTML = '<div class="rep-loading"><div class="loading-spinner"></div><span>Loading team performance…</span></div>';
    }
    try {
        const payload = await caspioArchiveService.fetchYtdPerRep(new Date().getFullYear(), { refresh });
        renderTeam(payload);
        // Push the archive's total revenue to the sales-goal banner — this is real
        // YTD (archive runs daily). It's slightly stale (live last few days not yet
        // archived), but vastly better than the "—" placeholder.
        if (payload?.totalRevenue != null) {
            setYtdTotal(payload.totalRevenue, { source: 'archive', archivedThrough: payload.lastArchivedDate });
        }
        return payload;
    } catch (err) {
        showApiError('metrics', err, {
            onRetry: () => loadTeam(true),
            detail: 'YTD per-rep archive is unreachable. The daily archive cron may have stalled.',
        });
        return null;
    }
}

export async function initTeamPerformance() {
    return loadTeam(false);
}

register('team-performance:refresh', () => loadTeam(true));
