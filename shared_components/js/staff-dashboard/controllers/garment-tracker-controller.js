/* =====================================================
   STAFF DASHBOARD v3 — GARMENT TRACKER CONTROLLER
   Bridge to legacy `window.StaffDashboardService` (loaded as
   plain <script> in index.html). The legacy service's
   garment-tracker logic is ~1,500 lines of complex sync +
   line-item enrichment + premium-item config. Rather than
   port everything in one go, this controller wraps the
   legacy service calls and renders results into the v3 DOM
   with v3 CSS classes.

   Future Phase 2 follow-up will replace the bridge with
   a proper port. The bridge is documented as known-debt
   in `~/.claude/plans/this-is-a-big-parsed-unicorn.md`.
   ===================================================== */

import { register } from '../core/dashboard-events.js';
import { showApiError, clearApiError } from '../core/dashboard-errors.js';
import { escapeHtml, formatRelativeTime } from '../core/dashboard-ui-utils.js';

const CONTAINER_ID  = 'garmentTrackerContent';
const DATE_RANGE_ID = 'garmentTrackerDateRange';
const STATUS_ID     = 'garmentSyncStatus';
const SYNC_BTN_SEL  = '[data-action="garment-tracker:sync"]';

const BONUS_GOAL = 500;

function svc() {
    return window.StaffDashboardService;
}

function setStatus(msg) {
    const el = document.getElementById(STATUS_ID);
    if (el) el.textContent = msg || '';
}

function renderLoading(label = 'Loading garment tracker…') {
    const c = document.getElementById(CONTAINER_ID);
    if (!c) return;
    c.innerHTML = `
        <div class="garment-tracker-loading">
            <div class="loading-spinner"></div>
            <span>${escapeHtml(label)}</span>
        </div>
    `;
}

function getFirstName(fullName) {
    return (fullName || '').split(' ')[0];
}

function renderDateRange(meta) {
    const el = document.getElementById(DATE_RANGE_ID);
    if (!el || !meta?.dateRange) return;
    const dr = meta.dateRange;
    const startMonth = new Date(dr.start + 'T00:00:00').getMonth();
    const quarter = Math.floor(startMonth / 3) + 1;
    const year = new Date(dr.start + 'T00:00:00').getFullYear();
    const fmt = (d) => svc()?.formatDateForDisplay
        ? svc().formatDateForDisplay(d)
        : new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    el.textContent = `Q${quarter} ${year} (${fmt(dr.start)} - ${fmt(dr.end)})`;
}

function renderTable(data) {
    const container = document.getElementById(CONTAINER_ID);
    if (!container || !data) return;

    const config = svc()?.GARMENT_TRACKER_CONFIG;
    if (!config) {
        container.innerHTML = '<div class="garment-tracker-loading"><span>Garment tracker config not loaded.</span></div>';
        return;
    }
    const reps = config.trackedReps || [];
    const itemGroups = config.itemGroups || [];

    renderDateRange(data.metadata);

    let html = `
        <div class="garment-tracker-table-wrapper">
            <table class="garment-tracker-table">
                <thead>
                    <tr>
                        <th class="garment-name-col" scope="col">Style</th>
                        ${reps.map((r) => `<th class="rep-col" scope="col">${escapeHtml(getFirstName(r))}</th>`).join('')}
                        <th class="total-col" scope="col">Total</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (itemGroups.length > 0) {
        itemGroups.forEach((group, groupIdx) => {
            let groupTotal = 0;
            const repQtys = reps.map((rep) => {
                let qty = 0;
                group.styles.forEach((style) => {
                    qty += data.byRep?.[rep]?.premium?.[style] || 0;
                });
                groupTotal += qty;
                return qty;
            });
            const hasData = groupTotal > 0;

            html += `
                <tr class="garment-group-row ${hasData ? '' : 'is-empty'}" data-group-idx="${groupIdx}" data-action="garment-tracker:toggle-group" title="$${group.bonus.toFixed(2)} per item · click to expand">
                    <td class="garment-name-col">
                        <span class="garment-group-toggle" aria-hidden="true"><i class="fas fa-chevron-right"></i></span>
                        <span class="garment-name">${escapeHtml(group.name)}</span>
                        <span class="garment-bonus">$${group.bonus.toFixed(2)}/ea</span>
                    </td>
                    ${reps.map((rep, idx) => `<td class="rep-col num ${repQtys[idx] > 0 ? 'has-qty' : ''}">${repQtys[idx] || '—'}</td>`).join('')}
                    <td class="total-col num ${hasData ? 'has-qty' : ''}">${groupTotal || '—'}</td>
                </tr>
            `;

            group.styles.forEach((style) => {
                const itemInfo = config.premiumItems?.find((i) => i.partNumber === style);
                const itemName = itemInfo ? itemInfo.name : style;
                let styleTotal = 0;
                const cells = reps.map((rep) => {
                    const qty = data.byRep?.[rep]?.premium?.[style] || 0;
                    styleTotal += qty;
                    return `<td class="rep-col num ${qty > 0 ? 'has-qty' : ''}">${qty || '—'}</td>`;
                }).join('');
                html += `
                    <tr class="garment-child-row garment-group-${groupIdx}" hidden>
                        <td class="garment-name-col">
                            <span class="garment-style-code">${escapeHtml(style)}</span>
                            <span class="garment-name garment-name--child">${escapeHtml(itemName)}</span>
                        </td>
                        ${cells}
                        <td class="total-col num ${styleTotal > 0 ? 'has-qty' : ''}">${styleTotal || '—'}</td>
                    </tr>
                `;
            });
        });
    }

    if (config.richardsonStyles && config.richardsonStyles.length > 0) {
        const richardsonTotal = data.totals?.richardson || 0;
        const cells = reps.map((rep) => {
            const qty = data.byRep?.[rep]?.richardson || 0;
            return `<td class="rep-col num ${qty > 0 ? 'has-qty' : ''}">${qty || '—'}</td>`;
        }).join('');
        html += `
            <tr class="richardson-row ${richardsonTotal > 0 ? '' : 'is-empty'}" title="$${config.richardsonBonus} per cap">
                <td class="garment-name-col">
                    <span class="garment-name">Richardson</span>
                    <span class="garment-bonus">SanMar Caps (112, 168…) · $${config.richardsonBonus}/ea</span>
                </td>
                ${cells}
                <td class="total-col num ${richardsonTotal > 0 ? 'has-qty' : ''}">${richardsonTotal || '—'}</td>
            </tr>
        `;
    }

    // Bonus totals row with progress to $500
    html += `
        <tr class="bonus-row">
            <th class="garment-name-col" scope="row">Bonus pace</th>
            ${reps.map((rep) => {
                const bonusTotal = data.bonusTotals?.[rep] || 0;
                const pct = Math.min((bonusTotal / BONUS_GOAL) * 100, 100);
                const reached = bonusTotal >= BONUS_GOAL;
                return `
                    <td class="rep-col bonus-cell ${reached ? 'is-goal' : ''}" title="$${BONUS_GOAL} bonus goal">
                        <div class="bonus-amount num">$${bonusTotal.toFixed(2)}</div>
                        <div class="bonus-progress" aria-label="${pct.toFixed(0)}% to bonus goal">
                            <div class="bonus-progress-fill" style="width: ${pct.toFixed(1)}%"></div>
                        </div>
                        <div class="bonus-progress-label">${reached ? '✓ Goal!' : Math.round(pct) + '%'}</div>
                    </td>
                `;
            }).join('')}
            <td class="total-col"></td>
        </tr>
    `;

    html += '</tbody></table></div>';

    const meta = data.metadata || {};
    const recordCount = meta.ordersProcessed || 0;
    const syncLabel = meta.lastSync
        ? `Last synced ${formatRelativeTime(meta.lastSync)}`
        : 'Never synced this quarter — click <i class="fas fa-cloud-download-alt"></i> to populate';
    const countLabel = recordCount > 0
        ? `${recordCount} record${recordCount === 1 ? '' : 's'}`
        : 'No qualifying orders yet';

    html += `
        <div class="garment-tracker-footer">
            <i class="fas fa-database" aria-hidden="true"></i>
            <span>${syncLabel} · ${countLabel}</span>
        </div>
    `;

    container.innerHTML = html;
}

async function loadGarmentTracker(refresh = false) {
    if (!svc() || typeof svc().loadGarmentTrackerFromTable !== 'function') {
        const c = document.getElementById(CONTAINER_ID);
        if (c) c.innerHTML = '<div class="garment-tracker-loading"><span>Garment tracker service not loaded.</span></div>';
        return;
    }
    clearApiError('garment');
    if (!refresh) renderLoading('Loading garment tracker…');
    try {
        // loadGarmentTrackerFromTable auto-awaits getGarmentTrackerConfig internally,
        // so we don't need to call it explicitly (and it isn't exported anyway).
        const data = await svc().loadGarmentTrackerFromTable();
        renderTable(data);
    } catch (err) {
        showApiError('garment', err, {
            onRetry: () => loadGarmentTracker(true),
            detail: 'Garment tracker table unreachable. Try sync to repopulate.',
        });
    }
}

async function syncGarmentTracker() {
    if (!svc() || typeof svc().syncGarmentTracker !== 'function') return;
    const syncBtn = document.querySelector(SYNC_BTN_SEL);
    if (syncBtn) {
        syncBtn.disabled = true;
        const i = syncBtn.querySelector('i');
        if (i) i.className = 'fas fa-spinner fa-spin';
    }
    setStatus('Starting sync…');
    renderLoading('Syncing from ManageOrders…');
    try {
        const count = await svc().syncGarmentTracker((msg) => {
            setStatus(msg);
            const cn = document.getElementById(CONTAINER_ID);
            if (cn) {
                const span = cn.querySelector('.garment-tracker-loading span');
                if (span) span.textContent = msg;
            }
        });
        setStatus(`Synced ${count} items`);
        await loadGarmentTracker(true);
    } catch (err) {
        setStatus('Sync failed');
        showApiError('garment', err, {
            onRetry: () => syncGarmentTracker(),
            detail: 'Sync failed mid-flight. Partial data may have been written.',
        });
    } finally {
        if (syncBtn) {
            syncBtn.disabled = false;
            const i = syncBtn.querySelector('i');
            if (i) i.className = 'fas fa-cloud-download-alt';
        }
    }
}

function toggleGroup(el) {
    const idx = el?.dataset?.groupIdx;
    if (idx == null) return;
    const children = document.querySelectorAll(`.garment-group-${idx}`);
    const toggle = el.querySelector('.garment-group-toggle');
    const expanded = el.classList.toggle('is-expanded');
    children.forEach((c) => { c.hidden = !expanded; });
    if (toggle) {
        const i = toggle.querySelector('i');
        if (i) i.style.transform = expanded ? 'rotate(90deg)' : 'rotate(0)';
    }
}

export async function initGarmentTracker() {
    return loadGarmentTracker(false);
}

register('garment-tracker:sync',         () => syncGarmentTracker());
register('garment-tracker:refresh',      () => loadGarmentTracker(true));
register('garment-tracker:toggle-group', (el) => toggleGroup(el));
