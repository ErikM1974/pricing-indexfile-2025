/**
 * lib/page-access.js — who may open a gated staff page.
 *
 * Extracted from server.js 2026-07-28 so the rule can be jest-locked (same move
 * lib/cors-allowlist.js made). server.js keeps the plumbing — session lookup,
 * the Staff_Page_Access fetch + cache, the 403 page — and calls in here for the
 * decision.
 *
 * The decision, in order:
 *   1. A rule naming PEOPLE and no roles is an EXCLUSIVE allowlist — only those
 *      people, admin included. It is the only way to restrict a page below "any
 *      admin", and it's what makes payroll.html Erik-only (2026-07-27).
 *      ⚠ You CAN lock yourself out of such a page — keep your own email on it.
 *   2. admin sees everything else.
 *   3. No rule at all → any logged-in staff, EXCEPT the Administration pages
 *      (ADMIN_DEFAULT_PAGES), which fall back to admin-only.
 *   4. Otherwise → role in Allowed_Roles, or email in Allowed_Emails.
 *
 * Why step 3 exists: the default for an unlisted page is "any logged-in staff".
 * That's right for the ordinary staff pages, but it silently exposed the whole
 * Administration menu — a page shipped without someone remembering to add a
 * Caspio row was open to everyone, and nothing in the code said so. Inverting
 * the default for this one set means forgetting a row leaves a page CLOSED.
 *
 * The Caspio table still wins: add a Staff_Page_Access row in Access Admin (e.g.
 * sanmar-payables.html → accountant) and that row governs, with no deploy. This
 * is only the fallback for when there is no row.
 */

// KEEP IN SYNC with the Admin panel (data-section="admin" ... <!-- END ADMIN -->) of
// staff-dashboard-v3/index.html.
// tests/unit/admin-page-access.test.js fails if these two drift apart.
// Root-served pages are listed by the filename the gate matches on (the last path
// segment), not by where they live on disk.
const ADMIN_DEFAULT_PAGES = new Set([
    // Money & Payroll
    'sanmar-payables.html', 'payroll.html', 'commission-structure.html',
    // Volume Quote (2026-09-02): Erik's one-time price for large orders — carries the
    // machine-hour cost model and margin figures, so admin-only like the Analysis pages.
    'volume-quote.html',
    // Marketing & Content
    'blog-editor.html', 'seo-strategy.html',
    // Access & Policy
    'access-admin.html', 'policy-migration.html', 'drive-access.html',
    // Integrations & Data
    'bandit-integration.html', 'sanmar-ftp-integration.html', 'sanmar-shopworks-converter.html',
    'sanmar-vendor-portal.html', 'universal-records-admin.html',
    // Served from /tools (gateStaffHtml covers that prefix too) — the gate matches on
    // the last path segment, so it is listed by filename like the root-served pages.
    'custom-tees-calibrate.html',
    // Analysis — internal cost/margin studies. Admin-only because these pages carry
    // revenue, blank cost and realization figures for the whole company.
    'pricing-analysis.html',
    // Company Numbers (2026-09-03): the eight live report widgets that left the staff
    // dashboard — company revenue, per-rep YTD, Stripe payments. Admin-only like the
    // other Analysis pages; widen with a Staff_Page_Access row (no deploy).
    'company-numbers.html',
    // Contract Break-Even (2026-09-02): the contract price grid re-costed from the VOL-* cost
    // model — hour rate, order cost, machine minutes. Admin-only like the other Analysis pages.
    'contract-break-even.html',
    // System & API Reference
    'api-usage.html', 'caspio-api-reference.html', 'table-usage-audit.html',
    'manageorders-api-reference.html', 'sanmar-api-reference.html', 'shopworks-odbc-reference.html',
]);

function splitList(value) {
    return String(value || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
}

/** True when an unlisted page should default to admin-only. */
function isAdminDefaultPage(pageKey) {
    return ADMIN_DEFAULT_PAGES.has(String(pageKey || '').toLowerCase());
}

/**
 * @param {{permissions?: string[], email?: string}} crmUser  the verified session user
 * @param {{Allowed_Roles?: string, Allowed_Emails?: string}} [rule] Staff_Page_Access row, if any
 * @param {string} [pageKey] the *.html filename being requested
 * @returns {boolean}
 */
function userMayAccessPage(crmUser, rule, pageKey) {
    const userPerms = ((crmUser && crmUser.permissions) || []).map((p) => String(p).toLowerCase());
    const userEmail = String((crmUser && crmUser.email) || '').toLowerCase();
    const roles = splitList(rule && rule.Allowed_Roles);
    const emails = splitList(rule && rule.Allowed_Emails);

    if (rule && emails.length && !roles.length) return emails.includes(userEmail);
    if (userPerms.includes('admin')) return true;
    if (!rule) return !isAdminDefaultPage(pageKey);
    return roles.some((r) => userPerms.includes(r)) || emails.includes(userEmail);
}

module.exports = { ADMIN_DEFAULT_PAGES, isAdminDefaultPage, userMayAccessPage };
