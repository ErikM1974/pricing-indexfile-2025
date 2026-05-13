/* =====================================================
   STAFF DASHBOARD v3 — METRICS CONTROLLER (Phase 4.4)
   Owns the revenue card + Team Performance card.
   Replaces metric-rendering portions of staff-dashboard-init.js.

   v3 first cut:
   - Revenue: period total, sparkline, AOV, order count, YoY badge
   - Team performance: stub message (full hybrid YTD is follow-up)
   ===================================================== */

import { register } from '../core/dashboard-events.js';
import { showApiError, clearApiError } from '../core/dashboard-errors.js';
import { store } from '../core/dashboard-store.js';
import {
    formatMoney, formatMoneyCents, formatPercent,
    formatDateRange, sparklineSvg, escapeHtml,
} from '../core/dashboard-ui-utils.js';
import { shopworksService } from '../services/shopworks-service.js';
// Note: setYtdTotal intentionally NOT imported in v3 first cut.
// The 60-day subset would mislead the banner's pace + projection math
// (Rule #4 — no silent misleading data). Real full-year YTD lands when
// caspio-archive-service ports in the follow-up phase.

const els = {
    revenueValue:  () => document.getElementById('ytdRevenue'),
    revenueTitle:  () => document.getElementById('revenueTitle'),
    dateRange:     () => document.getElementById('dateRangeDisplay'),
    growthBadge:   () => document.getElementById('ytdGrowth'),
    comparison:    () => document.getElementById('comparisonLabel'),
    sparkline:     () => document.getElementById('revenueSparkline'),
    statRow:       () => document.getElementById('revenueStats'),
    rangeButtons:  () => document.querySelectorAll('.date-range-btn'),
};

let currentDays = 7;

function setActiveRangeButton(days) {
    els.rangeButtons().forEach((btn) => {
        btn.classList.toggle('active', Number(btn.dataset.days) === days);
        btn.setAttribute('aria-pressed', Number(btn.dataset.days) === days ? 'true' : 'false');
    });
}

function renderRevenue(payload, yoy) {
    const { totals, range } = payload;
    const valueEl = els.revenueValue();
    if (valueEl) valueEl.textContent = formatMoney(totals.revenue);

    const titleEl = els.revenueTitle();
    if (titleEl) {
        const label = currentDays === 7 ? 'Last 7 Days'
            : currentDays === 30 ? 'Last 30 Days'
            : currentDays === 60 ? 'Last 60 Days'
            : `Last ${currentDays} Days`;
        titleEl.textContent = `Revenue: ${label}`;
    }

    const dateEl = els.dateRange();
    if (dateEl) dateEl.textContent = formatDateRange(range.start, range.end);

    const sparkEl = els.sparkline();
    if (sparkEl) {
        const values = (payload.sparkline || []).map((d) => d.revenue);
        sparkEl.innerHTML = sparklineSvg(values, { width: 220, height: 32, stroke: 'var(--accent)' });
        sparkEl.setAttribute('title', `Daily revenue, ${values.length} days`);
    }

    const statRow = els.statRow();
    if (statRow) {
        const aov = formatMoneyCents(totals.aov);
        const orderCount = totals.orderCount.toLocaleString('en-US');
        statRow.innerHTML = `
            <div class="stat"><span class="stat-num">${orderCount}</span> <span class="stat-label">orders</span></div>
            <div class="stat-divider" aria-hidden="true"></div>
            <div class="stat"><span class="stat-num">${aov}</span> <span class="stat-label">AOV</span></div>
        `;
    }

    // YoY badge
    const growth = yoy?.revenueGrowth;
    const badge = els.growthBadge();
    const compEl = els.comparison();
    if (badge) {
        if (growth == null) {
            badge.className = 'metrics-comparison-badge';
            badge.innerHTML = `<i class="fas fa-minus"></i> --`;
        } else if (growth >= 0) {
            badge.className = 'metrics-comparison-badge positive';
            badge.innerHTML = `<i class="fas fa-arrow-up"></i> ${growth.toFixed(1)}%`;
        } else {
            badge.className = 'metrics-comparison-badge negative';
            badge.innerHTML = `<i class="fas fa-arrow-down"></i> ${Math.abs(growth).toFixed(1)}%`;
        }
    }
    if (compEl) compEl.textContent = currentDays >= 30 ? 'vs. last year' : 'vs. last year (same days)';
}

async function loadRevenue(refresh = false) {
    clearApiError('revenue');
    const valueEl = els.revenueValue();
    if (valueEl && !refresh) {
        valueEl.innerHTML = '<span class="skeleton skeleton-value"></span>';
    }
    try {
        const yoy = await shopworksService.loadYearOverYear(currentDays, { refresh });
        renderRevenue(yoy.current, yoy);
        // Sales-goal YTD push deferred — see import note above. Banner stays at "—"
        // for current/pace/projection until the full hybrid YTD service ports in.
    } catch (err) {
        showApiError('revenue', err, {
            onRetry: () => loadRevenue(true),
            detail: 'ShopWorks revenue is unavailable. The proxy may be slow or down.',
        });
    }
}

function setRange(days) {
    currentDays = days;
    setActiveRangeButton(days);
    // Persist preference into Tweaks store so it sticks
    const tweaks = store.get('tweaks') || {};
    tweaks.defaultRevenuePeriod = days;
    store.set('tweaks', tweaks);
    loadRevenue(false);
}

export async function initMetrics() {
    // Restore default revenue period from Tweaks (Phase 4.7)
    const tweaks = store.get('tweaks') || {};
    if ([7, 30, 60, 90].includes(tweaks.defaultRevenuePeriod)) {
        currentDays = tweaks.defaultRevenuePeriod;
    }
    setActiveRangeButton(currentDays);
    // Note: #salesTeamList is owned by team-performance-controller.
    // It renders its own "Loading team performance…" spinner before the rep cards land.
    await loadRevenue(false);
}

// Event handlers
register('metrics:set-range', (el) => {
    const days = Number(el.dataset.days);
    if (!days) return;
    setRange(days);
});

register('metrics:refresh', () => loadRevenue(true));
