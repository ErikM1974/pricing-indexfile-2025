/* =====================================================
   STAFF DASHBOARD v3 — SALES GOAL CONTROLLER
   Drives the compact header goal chip: progress fill, % and
   "$X / $3M". Reads YTD total from a setter (called by
   team-performance-controller after the Caspio archive lands).

   2026-08-27: the pace badge / days-left countdown / projected-EOY
   code was REMOVED — the 2026-07-20 compact chip deliberately kept
   only #goalProgress/#goalCurrent/#goalPercent, so those branches
   targeted DOM ids that no longer exist anywhere and silently
   no-oped. If the pace UI ever comes back, restore the markup and
   logic together (git: this file before 2026-08-27).
   ===================================================== */

import { formatMoney, ANNUAL_GOAL } from '../core/dashboard-ui-utils.js';

const els = {
    progress: () => document.getElementById('goalProgress'),
    current:  () => document.getElementById('goalCurrent'),
    percent:  () => document.getElementById('goalPercent'),
    goalOf:   () => document.getElementById('goalOf'),
};

// The chip's [role=progressbar] track wrapping the #goalProgress fill.
function progressbarEl() {
    return els.progress()?.closest('[role="progressbar"]') || null;
}

// "$3M" — compact goal for the chip label, derived from ANNUAL_GOAL so the
// label can never disagree with the percentage math (one number, one home).
function formatGoalCompact(goal) {
    if (goal >= 1_000_000 && goal % 100_000 === 0) {
        const m = goal / 1_000_000;
        return '$' + (Number.isInteger(m) ? m : m.toFixed(1)) + 'M';
    }
    return formatMoney(goal);
}

// null = no YTD data yet (show the loading state, NOT $0).
// Set via setYtdTotal() — currently fed by team-performance-controller from the
// Caspio archive. Slightly stale (lags live by a few days) but real.
let lastYtd = null;
let ytdFailed = false;

/**
 * Update the chip with a YTD total.
 * Called by team-performance-controller once the Caspio archive lands.
 * @param {number} ytdAmount - dollars year-to-date
 * @param {object} [meta] - accepted for caller compatibility; the compact
 *   chip renders no source/staleness detail (the projected-EOY line that
 *   used it was removed with the big banner).
 */
export function setYtdTotal(ytdAmount, meta = {}) { // eslint-disable-line no-unused-vars
    lastYtd = Number(ytdAmount) || 0;
    ytdFailed = false;
    render();
}

/**
 * The YTD fetch failed. Say so on the chip instead of sitting on the loading
 * copy forever (Rule 4: a visible failure, never a silent stale/blank number).
 * Since 2026-09-03 the dashboard has no team card to carry the error state,
 * so team-performance-controller reports it here from its catch.
 */
export function setYtdUnavailable() {
    lastYtd = null;
    ytdFailed = true;
    render();
}

function render() {
    const goal = ANNUAL_GOAL;
    const banner = document.querySelector('.sales-goal-banner');

    const goalOfEl = els.goalOf();
    if (goalOfEl) goalOfEl.textContent = formatGoalCompact(goal);

    if (lastYtd == null && ytdFailed) {
        if (banner) { banner.classList.remove('is-loading'); banner.classList.add('is-unavailable'); }
        const progress = els.progress();
        if (progress) progress.style.width = '0%';
        progressbarEl()?.removeAttribute('aria-valuenow');
        const current = els.current();
        if (current) current.textContent = 'YTD unavailable';
        return;
    }
    if (banner) banner.classList.remove('is-unavailable');

    if (lastYtd == null) {
        // No real YTD data yet — friendly loading state. The .is-loading class
        // on .sales-goal-banner hides the percent paren (dashboard-v3-patch-2.css)
        // and italicizes the current-value span to carry the "Loading…" copy.
        if (banner) banner.classList.add('is-loading');
        const progress = els.progress();
        if (progress) progress.style.width = '0%';
        // An aria-valuenow-less progressbar announces as indeterminate — the
        // truthful state while loading.
        progressbarEl()?.removeAttribute('aria-valuenow');
        const current = els.current();
        if (current) current.textContent = 'Loading YTD…';
        return;
    }

    // Data has landed — drop the loading-state styling.
    if (banner) banner.classList.remove('is-loading');

    const pct = lastYtd / goal;
    const cappedPct = Math.min(pct, 1);

    const progress = els.progress();
    if (progress) progress.style.width = (cappedPct * 100).toFixed(1) + '%';
    progressbarEl()?.setAttribute('aria-valuenow', String(Math.round(cappedPct * 100)));

    const current = els.current();
    if (current) current.textContent = formatMoney(lastYtd);
    const percent = els.percent();
    if (percent) percent.textContent = (pct * 100).toFixed(0);
}

export function initSalesGoal() {
    // Initial render with whatever lastYtd is (loading state until metrics arrive)
    render();
}
