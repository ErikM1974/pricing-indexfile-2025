/* =====================================================
   STAFF DASHBOARD v3 — SALES GOAL CONTROLLER (Phase 4.1)
   Compressed 56px pill with pace + days remaining + projected EOY.
   Reads YTD total from a setter (called by metrics-controller after
   the YTD fetch lands).
   ===================================================== */

import { formatMoney, daysRemainingInYear, dayOfYear, ANNUAL_GOAL } from '../core/dashboard-ui-utils.js';

const els = {
    progress:    () => document.getElementById('goalProgress'),
    current:     () => document.getElementById('goalCurrent'),
    percent:     () => document.getElementById('goalPercent'),
    pace:        () => document.getElementById('goalPace'),
    daysLeft:    () => document.getElementById('goalDaysLeft'),
    projectedEoy:() => document.getElementById('goalProjectedEoy'),
};

// null = no YTD data yet (show "—" placeholders, NOT $0 + bogus pace).
// Set via setYtdTotal() — currently fed by team-performance-controller from the
// Caspio archive. Slightly stale (lags live by a few days) but real.
let lastYtd = null;
let lastYtdMeta = null; // { source, archivedThrough }

/**
 * Update the banner with a YTD total.
 * Called by team-performance-controller once the Caspio archive lands.
 * @param {number} ytdAmount - dollars year-to-date
 * @param {object} [meta]
 * @param {string} [meta.source] - "archive" | "hybrid" | "live"
 * @param {string} [meta.archivedThrough] - YYYY-MM-DD if from archive
 */
export function setYtdTotal(ytdAmount, meta = {}) {
    lastYtd = Number(ytdAmount) || 0;
    lastYtdMeta = meta;
    render();
}

function render() {
    const goal = ANNUAL_GOAL;
    const daysLeft = daysRemainingInYear();
    const banner = document.querySelector('.sales-goal-banner');

    // Days-left countdown is data-independent — always render.
    const daysEl = els.daysLeft();
    if (daysEl) daysEl.textContent = `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`;

    if (lastYtd == null) {
        // No real YTD data yet — show a friendly loading state instead of
        // "—" + "(—%)" which reads as broken when the YTD fetch fails or is
        // in-flight. The .is-loading class on .sales-goal-banner hides the
        // .sales-goal-percent paren entirely (CSS in dashboard-v3-patch-2.css)
        // and italicizes .sales-goal-current to carry the "Loading…" copy.
        if (banner) banner.classList.add('is-loading');
        const progress = els.progress();
        if (progress) progress.style.width = '0%';
        const current = els.current();
        if (current) current.textContent = 'Loading YTD…';
        const paceEl = els.pace();
        if (paceEl) {
            paceEl.className = 'sales-goal-pace';
            paceEl.innerHTML = '<span aria-hidden="true">⏳</span> Loading YTD…';
        }
        const projEl = els.projectedEoy();
        if (projEl) projEl.textContent = 'Projected EOY —';
        return;
    }

    // Data has landed — drop the loading-state styling.
    if (banner) banner.classList.remove('is-loading');

    const ytd = lastYtd;
    const pct = ytd / goal;
    const cappedPct = Math.min(pct, 1);

    const elapsed = dayOfYear();
    const totalDays = isLeapYear(new Date().getFullYear()) ? 366 : 365;
    const expectedToday = (elapsed / totalDays) * goal;
    const paceRatio = expectedToday > 0 ? ytd / expectedToday : 0;
    const projected = elapsed > 0 ? (ytd / elapsed) * totalDays : 0;

    const progress = els.progress();
    if (progress) progress.style.width = (cappedPct * 100).toFixed(1) + '%';

    const current = els.current();
    if (current) current.textContent = formatMoney(ytd);
    const percent = els.percent();
    if (percent) percent.textContent = (pct * 100).toFixed(0);

    const paceEl = els.pace();
    if (paceEl) {
        const pacePct = (paceRatio - 1) * 100;
        const behindPct = Math.abs(pacePct).toFixed(0);
        let cls, icon, label;
        if (paceRatio >= 1) { cls = 'is-ahead'; icon = '✅'; label = `+${pacePct.toFixed(0)}% ahead`; }
        else if (paceRatio >= 0.9) { cls = 'is-warning'; icon = '⚠️'; label = `${behindPct}% behind`; }
        else { cls = 'is-behind'; icon = '🔻'; label = `${behindPct}% behind`; }
        paceEl.className = `sales-goal-pace ${cls}`;
        paceEl.innerHTML = `<span aria-hidden="true">${icon}</span> ${label}`;
    }

    const projEl = els.projectedEoy();
    if (projEl) {
        const stale = lastYtdMeta?.source === 'archive' && lastYtdMeta?.archivedThrough
            ? ` · archive thru ${lastYtdMeta.archivedThrough}` : '';
        projEl.textContent = `Projected EOY ${formatMoney(projected)}${stale}`;
    }
}

function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

export function initSalesGoal() {
    // Initial render with whatever lastYtd is (0 until metrics arrive)
    render();
}
