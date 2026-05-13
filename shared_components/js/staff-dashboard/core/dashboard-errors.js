/* =====================================================
   STAFF DASHBOARD v3 — CENTRALIZED ERROR UI
   Replaces 4 different inline error renderers
   (init.js:300, 983, 1538 + the partial-data warning at :323).

   Usage:
     import { showApiError, clearApiError } from './dashboard-errors.js';
     showApiError('metrics', err, { onRetry: () => loadMetrics(true) });
   ===================================================== */

import { DashboardApiError } from './dashboard-fetch.js';
import { escapeHtml } from './dashboard-ui-utils.js';

/**
 * Per-area config: where to render the error, what to call it.
 * Containers are looked up by ID at error-time (not module-load),
 * so DOM that arrives late still works.
 */
const ERROR_AREAS = {
    metrics:   { containerId: 'salesTeamList',         label: 'team performance' },
    revenue:   { containerId: 'ytdRevenue',            label: 'revenue' },
    garment:   { containerId: 'garmentTrackerContent', label: 'garment tracker' },
    ytdGoal:   { containerId: 'goalProgress',          label: 'YTD progress' },
    gapReport: { containerId: 'gapReportBody',         label: 'gap report' },
    production:{ containerId: 'production-predictor-grid', label: 'production turnaround' },
    announcements: { containerId: 'announcementsList',  label: 'announcements' },
};

/**
 * Render an error state in the named area.
 *
 * @param {string} area - one of ERROR_AREAS keys
 * @param {Error|DashboardApiError} error - the error to display
 * @param {object} [opts]
 * @param {function} [opts.onRetry] - if provided, renders a Retry button
 * @param {string} [opts.detail] - optional detail line below the main message
 * @param {boolean} [opts.partial=false] - amber warning instead of red error (data is shown but incomplete)
 */
export function showApiError(area, error, opts = {}) {
    const cfg = ERROR_AREAS[area];
    if (!cfg) {
        console.error(`[dashboard-errors] Unknown area: "${area}"`);
        return;
    }

    const container = document.getElementById(cfg.containerId);
    if (!container) {
        console.warn(`[dashboard-errors] Container "${cfg.containerId}" for area "${area}" not found in DOM`);
        return;
    }

    // Console log with consistent prefix for filtering
    console.error(`[dashboard:${area}]`, error);

    const isPartial = opts.partial === true;
    const status = error?.status;
    const baseMsg = error instanceof DashboardApiError
        ? `${cfg.label} unavailable (${status || 'error'})`
        : `Couldn't load ${cfg.label}`;

    const detail = opts.detail
        ? `<div class="dashboard-error__detail">${escapeHtml(opts.detail)}</div>`
        : '';

    const errorMsg = error?.message
        ? `<div class="dashboard-error__cause">${escapeHtml(error.message)}</div>`
        : '';

    const retryBtn = opts.onRetry
        ? `<button type="button" class="dashboard-error__retry" data-action="dashboard-error:retry" data-area="${escapeHtml(area)}"><i class="fas fa-rotate-right"></i> Retry</button>`
        : '';

    container.innerHTML = `
        <div class="dashboard-error ${isPartial ? 'dashboard-error--partial' : 'dashboard-error--bad'}" role="alert">
            <div class="dashboard-error__icon">
                <i class="fas ${isPartial ? 'fa-triangle-exclamation' : 'fa-circle-exclamation'}"></i>
            </div>
            <div class="dashboard-error__body">
                <div class="dashboard-error__title">${escapeHtml(baseMsg)}</div>
                ${detail}
                ${errorMsg}
            </div>
            ${retryBtn}
        </div>
    `;

    // One-shot retry binding via the delegator
    if (opts.onRetry) {
        retryHandlers.set(area, opts.onRetry);
    }
}

/**
 * Clear the error state in the named area (caller will re-render fresh data).
 */
export function clearApiError(area) {
    const cfg = ERROR_AREAS[area];
    if (!cfg) return;
    const container = document.getElementById(cfg.containerId);
    if (container) container.innerHTML = '';
    retryHandlers.delete(area);
}

/* =====================================================
   Retry button — one-shot handlers stored per area,
   wired through the global event delegator.
   ===================================================== */
const retryHandlers = new Map();

import { register } from './dashboard-events.js';

register('dashboard-error:retry', (el) => {
    const area = el.dataset.area;
    const handler = retryHandlers.get(area);
    if (handler) {
        retryHandlers.delete(area);
        handler();
    }
});

export const ERROR_AREA_KEYS = Object.freeze(Object.keys(ERROR_AREAS));
