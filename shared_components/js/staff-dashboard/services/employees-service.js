/* =====================================================
   STAFF DASHBOARD v3 — EMPLOYEES SERVICE
   Roster comes from GET /api/staff/employees (requireStaff-gated,
   data in lib/staff-roster.js). It was hardcoded here until
   2026-08-27 — but everything under /shared_components/ is served
   ANONYMOUSLY (the staff gate covers only .html), which published
   every employee's name, birthday, hire date and termination date
   to the internet.

   Usage contract: call `await employeesService.load()` once (the
   celebrations controller does this in init); every other method is
   synchronous over the loaded data and returns [] before load.
   ===================================================== */

import { dashboardFetchJson } from '../core/dashboard-fetch.js';

let _roster = [];        // raw rows once loaded
let _loadPromise = null; // in-flight/settled load (cleared on failure → retryable)

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// Parse a date-only 'YYYY-MM-DD' into LOCAL components. `new Date('2011-04-11')`
// parses as UTC midnight, which local Pacific getters read back as the PREVIOUS
// day — every anniversary/start-date/years-of-service shifted a day early.
function parseLocalDate(ymd) {
    if (!ymd) return null;
    const [y, m, d] = String(ymd).split('-').map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d);
    return isNaN(date.getTime()) ? null : date;
}

/**
 * Days from today until a date occurring this year (or next, if already passed).
 */
function daysUntilMonthDay(monthDay) {
    const [m, d] = monthDay.split('-').map(Number);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let target = new Date(today.getFullYear(), m - 1, d);
    if (target < today) target = new Date(today.getFullYear() + 1, m - 1, d);
    return Math.round((target - today) / 86_400_000);
}

function daysUntilAnniversary(startDate) {
    const start = parseLocalDate(startDate);
    if (!start) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let target = new Date(today.getFullYear(), start.getMonth(), start.getDate());
    if (target < today) target = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
    return Math.round((target - today) / 86_400_000);
}

function yearsOfService(startDate, asOf = new Date()) {
    const start = parseLocalDate(startDate);
    if (!start) return 0;
    let years = asOf.getFullYear() - start.getFullYear();
    const monthDiff = asOf.getMonth() - start.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && asOf.getDate() < start.getDate())) years--;
    return years;
}

function formatBirthday(monthDay) {
    const [m, d] = monthDay.split('-').map(Number);
    return `${MONTH_NAMES[m - 1]} ${d}`;
}

function formatStartDate(startDate) {
    const d = parseLocalDate(startDate);
    if (!d) return '';
    return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function status(employee, asOf = new Date()) {
    if (!employee.endDate) return 'active';
    const end = parseLocalDate(employee.endDate);
    if (!end) return 'active';
    // The end DATE is their last day — treat them as current through that
    // whole local day.
    end.setHours(23, 59, 59, 999);
    if (end < asOf) return 'former';
    return 'leaving';
}

/* =====================================================
   PUBLIC API
   ===================================================== */

export const employeesService = {
    /**
     * Fetch the roster once (subsequent calls reuse the same promise).
     * Throws on failure — callers must surface a visible error (Rule #4).
     * A failed load clears the promise so a retry can succeed.
     */
    load() {
        if (!_loadPromise) {
            _loadPromise = dashboardFetchJson('/api/staff/employees')
                .then((rows) => {
                    if (!Array.isArray(rows)) throw new Error('unexpected roster payload');
                    _roster = rows;
                    return rows;
                })
                .catch((err) => {
                    _loadPromise = null;
                    throw err;
                });
        }
        return _loadPromise;
    },

    /**
     * Full roster, decorated with computed fields.
     * Empty until load() has resolved.
     */
    all() {
        const today = new Date();
        return _roster.map((e) => ({
            ...e,
            fullName: `${e.firstName} ${e.lastName}`,
            yearsOfService: yearsOfService(e.startDate, today),
            formattedStartDate: formatStartDate(e.startDate),
            formattedBirthday: formatBirthday(e.birthday),
            status: status(e, today),
            daysUntilBirthday: daysUntilMonthDay(e.birthday),
            daysUntilAnniversary: daysUntilAnniversary(e.startDate),
        }));
    },

    /**
     * Active employees only.
     */
    active() {
        return this.all().filter((e) => e.status === 'active');
    },

    /**
     * Upcoming birthdays in next N days, sorted ascending.
     */
    upcomingBirthdays(daysAhead = 30) {
        return this.active()
            .filter((e) => e.daysUntilBirthday >= 0 && e.daysUntilBirthday <= daysAhead)
            .sort((a, b) => a.daysUntilBirthday - b.daysUntilBirthday);
    },

    /**
     * Upcoming work anniversaries in next N days, sorted ascending.
     */
    upcomingAnniversaries(daysAhead = 30) {
        return this.active()
            .filter((e) => e.daysUntilAnniversary >= 0 && e.daysUntilAnniversary <= daysAhead)
            .sort((a, b) => a.daysUntilAnniversary - b.daysUntilAnniversary);
    },

    /**
     * Filter the roster client-side by query (matches first/last/full name + position).
     */
    search(query) {
        if (!query) return this.all();
        const q = query.toLowerCase();
        return this.all().filter((e) => (
            e.firstName.toLowerCase().includes(q) ||
            e.lastName.toLowerCase().includes(q) ||
            e.fullName.toLowerCase().includes(q) ||
            e.position.toLowerCase().includes(q)
        ));
    },
};
