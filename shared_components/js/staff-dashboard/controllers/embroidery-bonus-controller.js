/* =====================================================
   STAFF DASHBOARD v3 — Q3 TEAM PUSH STRIP

   🔒 THIS CARD SHOWS NO COMPENSATION. The staff dashboard is opened by every
   employee, so per-rep bonus dollars do not belong here — they live on each
   rep's own Mission Control page. This strip renders only the company-wide
   Q3 number and the shared targets: a goal everyone can rally around, with
   nobody's pay on screen.

   It calls /api/crm-proxy/embroidery-bonus/team, which forces scope=team
   server-side. Even if this file were changed to ask for more, the endpoint
   returns an empty `reps` object on that route — the privacy boundary is in
   the backend, not in this render.

   Replaced the Garment Tracker card (2026-07-25). Every number, including the
   targets, comes from the API — never a hardcoded constant.
   ===================================================== */

import { register } from '../core/dashboard-events.js';
import { showApiError, clearApiError } from '../core/dashboard-errors.js';
import { escapeHtml } from '../core/dashboard-ui-utils.js';
import { endpoints } from '../core/dashboard-endpoints.js';

const CONTAINER_ID  = 'embroideryBonusContent';
const DATE_RANGE_ID = 'embroideryBonusDateRange';

const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');

function renderLoading(label = 'Loading Q3 team goal…') {
    const c = document.getElementById(CONTAINER_ID);
    if (!c) return;
    c.innerHTML = `
        <div class="embroidery-bonus-loading">
            <div class="loading-spinner"></div>
            <span>${escapeHtml(label)}</span>
        </div>
    `;
}

function renderDateRange(data) {
    const el = document.getElementById(DATE_RANGE_ID);
    if (!el || !data?.dateRange) return;
    const fmt = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    el.textContent = `${data.quarter} ${data.year} (${fmt(data.dateRange.start)} – ${fmt(data.dateRange.end)})`;
}

function renderStrip(data) {
    const container = document.getElementById(CONTAINER_ID);
    if (!container || !data) return;
    renderDateRange(data);

    const k = data.teamKicker || {};
    const tiers = (k.tiers || []).slice().sort((a, b) => a.target - b.target);
    if (!tiers.length) {
        container.innerHTML = '<div class="embroidery-bonus-loading"><span>No Q3 target configured yet.</span></div>';
        return;
    }
    const top = tiers[tiers.length - 1];
    const pct = Math.max(0, Math.min((k.companyRevenue / top.target) * 100, 100));
    const reached = tiers.filter((t) => k.companyRevenue >= t.target).length;

    // The backend's fallback message is payroll-flavoured ("verify before paying") because it
    // also serves the per-rep surfaces. This card has no payroll on it, so say the thing that
    // is actually true here: the TARGET may be stale.
    const warn = data.configSource === 'fallback'
        ? `<div class="eb-warning" role="alert">
               <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
               <span>Q3 targets could not be read from Caspio — showing built-in defaults,
               which may not match the current plan.</span>
           </div>`
        : '';

    const headline = k.next
        ? `${money(k.amountToNext)} to go`
        : 'Top target cleared — outstanding.';

    container.innerHTML = `
        ${warn}
        <div class="eb-team">
            <div class="eb-team-head">
                <div>
                    <div class="eb-team-value num">${money(k.companyRevenue)}</div>
                    <div class="eb-team-label">invoiced so far this quarter, company-wide</div>
                </div>
                <div class="eb-team-goal">
                    <div class="eb-team-goal-value num ${reached ? 'is-hit' : ''}">${escapeHtml(headline)}</div>
                    <div class="eb-team-label">${k.next ? `to reach ${money(k.next.target)}` : ''}</div>
                </div>
            </div>

            <div class="eb-ladder-track eb-team-track">
                <div class="eb-ladder-fill ${reached ? 'is-reached' : ''}" style="width:${pct.toFixed(1)}%"></div>
                ${tiers.map((t) => {
                    const at = Math.min((t.target / top.target) * 100, 100);
                    const hit = k.companyRevenue >= t.target;
                    return `<span class="eb-ladder-mark ${hit ? 'is-hit' : ''}" style="left:${at.toFixed(1)}%" title="${money(t.target)}"></span>`;
                }).join('')}
            </div>
            <div class="eb-team-scale">
                ${tiers.map((t) => {
                    const hit = k.companyRevenue >= t.target;
                    return `<span class="eb-team-tier ${hit ? 'is-hit' : ''}">${hit ? '✓ ' : ''}${money(t.target)}</span>`;
                }).join('')}
            </div>

            <p class="eb-team-note">
                Every order counts &mdash; every method, every rep. Clearing
                <strong>${money(top.target)}</strong> this quarter is what keeps the
                $3M year in reach.
            </p>
        </div>
    `;
}

export async function loadEmbroideryBonus(refresh = false) {
    clearApiError('embroidery-bonus');
    if (!refresh) renderLoading();
    try {
        const resp = await fetch(endpoints.embroideryBonusTeam(), { credentials: 'same-origin' });
        if (!resp.ok) throw new Error(`Q3 team goal failed: ${resp.status}`);
        const data = await resp.json();
        if (data.success === false) throw new Error(data.error || 'Q3 team goal unavailable');
        renderStrip(data);
    } catch (err) {
        // Never fall back to a stale number — a wrong goal is worse than an error.
        showApiError('embroidery-bonus', err, {
            onRetry: () => loadEmbroideryBonus(true),
            detail: 'Q3 team goal unavailable. Not shown rather than shown stale.',
        });
    }
}

export async function initEmbroideryBonus() {
    return loadEmbroideryBonus(false);
}

register('embroidery-bonus:refresh', () => loadEmbroideryBonus(true));
