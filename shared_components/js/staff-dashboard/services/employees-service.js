/* =====================================================
   STAFF DASHBOARD v3 — EMPLOYEES SERVICE
   Wraps the hardcoded roster from staff-dashboard-employees.js.
   Per Erik's plan-mode answer #2, data stays hardcoded for now.
   This module gives the controllers a clean API to query the data.
   ===================================================== */

// Hardcoded roster — preserved verbatim from staff-dashboard-employees.js
// Source of truth until backend migration (out of scope for this refactor).
const EMPLOYEES = [
    { firstName: "Jim",          lastName: "Mickelson",  startDate: "1977-10-31", birthday: "03-25", position: "CEO" },
    { firstName: "Erik",         lastName: "Mickelson",  startDate: "1996-12-16", birthday: "02-14", position: "Operations Manager" },
    { firstName: "Ruthie",       lastName: "Nhoung",     startDate: "1998-08-05", birthday: "01-19", position: "Production Manager" },
    { firstName: "Savy",         lastName: "Som",        startDate: "2008-04-21", birthday: "09-08", position: "Embroidery Machine Operator" },
    { firstName: "Sorphorn",     lastName: "Sorm",       startDate: "2011-04-11", birthday: "07-10", position: "Embroidery Machine Operator" },
    { firstName: "Nika",         lastName: "Lao",        startDate: "2012-07-31", birthday: "06-29", position: "Account Executive" },
    { firstName: "Taylar",       lastName: "Hanson",     startDate: "2015-04-20", birthday: "06-30", position: "Account Executive", endDate: "2025-08-29" },
    { firstName: "Bunsereytheavy", lastName: "Hoeu",     startDate: "2015-05-19", birthday: "01-01", position: "Embroidery Machine Operator" },
    { firstName: "Bradley",      lastName: "Wright",     startDate: "2017-08-10", birthday: "01-09", position: "Accounting/Purchasing/Webstores" },
    { firstName: "Steve",        lastName: "Deland",     startDate: "2017-09-28", birthday: "06-30", position: "Graphic Artist" },
    { firstName: "Kanha",        lastName: "Chhorn",     startDate: "2018-02-21", birthday: "06-11", position: "Embroidery Supervisor & Machine Operator" },
    { firstName: "Brian",        lastName: "Beardsley",  startDate: "2018-08-13", birthday: "06-29", position: "DTG Supervisor" },
    { firstName: "Sreynai",      lastName: "Meang",      startDate: "2019-12-09", birthday: "09-02", position: "Embroidery Machine Operator" },
    { firstName: "Sothea",       lastName: "Tann",       startDate: "2022-09-22", birthday: "04-23", position: "Embroidery Machine Operator" },
    { firstName: "Joseph",       lastName: "Hallowell",  startDate: "2023-04-03", birthday: "08-14", position: "DTG Operator" },
    { firstName: "Sothida",      lastName: "Khiev",      startDate: "2024-03-01", birthday: "06-29", position: "Embroidery Machine Operator" },
    { firstName: "Mikalah",      lastName: "Hede",       startDate: "2024-10-03", birthday: "04-21", position: "Shipping/Receiving Clerk" },
    { firstName: "Adriyella",    lastName: "Trujillo",   startDate: "2025-02-17", birthday: "02-10", position: "Office Assistant", endDate: "2025-11-15" },
    { firstName: "Taneisha",     lastName: "Clark",      startDate: "2025-08-12", birthday: "12-25", position: "Sales Coordinator" },
];

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let target = new Date(today.getFullYear(), start.getMonth(), start.getDate());
    if (target < today) target = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
    return Math.round((target - today) / 86_400_000);
}

function yearsOfService(startDate, asOf = new Date()) {
    const start = new Date(startDate);
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
    const d = new Date(startDate);
    if (isNaN(d.getTime())) return '';
    return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function status(employee, asOf = new Date()) {
    if (!employee.endDate) return 'active';
    const end = new Date(employee.endDate);
    if (isNaN(end.getTime())) return 'active';
    if (end < asOf) return 'former';
    return 'leaving';
}

/* =====================================================
   PUBLIC API
   ===================================================== */

export const employeesService = {
    /**
     * Full roster, decorated with computed fields.
     */
    all() {
        const today = new Date();
        return EMPLOYEES.map((e) => ({
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
