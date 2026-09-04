/* =====================================================
   STAFF DASHBOARD v3 — COMPANY GOAL SERVICE (2026-09-04)

   The annual sales goal used by the header goal chip ("$X / $3M") and the
   Company Numbers team card. It used to be a JavaScript constant
   (ANNUAL_GOAL = 3_000_000 in dashboard-ui-utils.js), which meant a deploy
   every January. It now lives in Caspio Service_Codes as the row
   `CO-ANNUAL-GOAL` (SellPrice = the goal in dollars) so Erik edits the number
   in Caspio and every surface follows — no deploy.

   Read through the same-origin staff relay /api/staff/service-codes (SAML
   cookie → server → proxy → Caspio).

   Fallback policy (CLAUDE.md "Pricing = API, never hardcoded"): a hardcoded
   number is allowed ONLY as a fallback when the API is unreachable, and it
   MUST surface a visible warning. So when the row cannot be read this resolves
   with the built-in default AND `source: 'fallback'`, and every caller renders
   a warning next to the number. It never throws and never hides the fallback.
   ===================================================== */

import { dashboardFetchJson } from '../core/dashboard-fetch.js';

export const GOAL_CODE = 'CO-ANNUAL-GOAL';

// Built-in default — shown ONLY with a visible warning (see above).
export const FALLBACK_GOAL = 3_000_000;

let inflight = null;

/**
 * Resolve the annual goal. Cached for the life of the page on success — the
 * goal changes once a year. A fallback result is NOT cached, so the next
 * caller (or the 5-minute tick) asks Caspio again.
 * @returns {Promise<{goal:number, source:'caspio'|'fallback', error?:string}>}
 */
export function fetchAnnualGoal() {
    if (!inflight) {
        inflight = dashboardFetchJson(`/api/staff/service-codes?code=${encodeURIComponent(GOAL_CODE)}`)
            .then((json) => {
                const rows = Array.isArray(json?.data) ? json.data : [];
                const row = rows.find((r) => r.ServiceCode === GOAL_CODE && r.IsActive !== false);
                const goal = Number(row?.SellPrice);
                if (!row || !Number.isFinite(goal) || goal <= 0) {
                    throw new Error(`Service_Codes row ${GOAL_CODE} is missing, inactive, or has no SellPrice`);
                }
                return { goal, source: 'caspio' };
            })
            .catch((err) => {
                console.error('[company-goal] falling back to the built-in goal:', err);
                inflight = null; // do not cache a fallback
                return { goal: FALLBACK_GOAL, source: 'fallback', error: err?.message || String(err) };
            });
    }
    return inflight;
}

/**
 * "$3M" for a round goal, "$2,750,000" otherwise — one formatter so the chip
 * label can never disagree with the percentage math.
 */
export function formatGoalCompact(goal) {
    if (goal >= 1_000_000 && goal % 100_000 === 0) {
        const m = goal / 1_000_000;
        return '$' + (Number.isInteger(m) ? m : m.toFixed(1)) + 'M';
    }
    return '$' + Math.round(goal).toLocaleString('en-US');
}

/** The one warning sentence every surface shows when the fallback is in use. */
export function fallbackWarning() {
    return `Goal is the built-in default — the Caspio Service_Codes row ${GOAL_CODE} could not be read.`;
}

export const companyGoalService = { fetchAnnualGoal, formatGoalCompact, fallbackWarning, GOAL_CODE, FALLBACK_GOAL };
