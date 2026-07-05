/**
 * art-search.js — Cross-tool art request search (#17, 2026-07-05).
 * URL: /pages/art-search.html (staff utility)
 *
 * One input searching ArtRequests three ways via the proxy's structured,
 * server-sanitized GET /api/artrequests params (src/routes/art.js — reqInt +
 * escWhere run SERVER-side; this file never concatenates raw input into a
 * q.where clause):
 *   • all digits  → ?id_design=N          (exact, any age)
 *   • text        → ?companyName=term     (LIKE '%term%', any age)
 *   • text        → recent-window fetch, client-filtered on Full_Name_Contact
 *                   + CompanyName (contact name has no server filter param —
 *                   same client-filter approach as art-ae.js searchTerm)
 *
 * Staff gate: client-side StaffAuthHelper (the pages/quote-audit.js pattern —
 * /pages is a public static mount; dashboards use the server-side
 * gateStaffHtml/Staff_Page_Access gate instead).
 *
 * Results link to /art-request/:designId (server.js route → art-request-detail).
 * normalizeStatus mirrors art-ae.js so null/blank/typo'd statuses never vanish.
 */
(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // Minimal field set for the results table (Caspio 500s on unknown q.select
    // fields, so keep this to long-standing columns only).
    var SELECT_FIELDS = 'PK_ID,ID_Design,CompanyName,Full_Name_Contact,Status,Date_Created,Sales_Rep';

    // Recent-window size for the client-side contact-name filter. The proxy
    // caps limit at 1000; Date_Created DESC means this is "the most recent
    // 500 requests" — company search still covers ALL history server-side.
    var RECENT_LIMIT = 500;

    var els = {};
    var lastTerm = '';
    var searchSeq = 0;
    var recentCache = null; // Promise for the recent-window fetch (reused per page load)

    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Mirrors art-ae.js normalizeStatus — handles Caspio dropdown objects and
    // maps null/blank → 'Submitted' so nothing renders as an empty cell.
    function normalizeStatus(raw) {
        if (!raw || raw === '') return 'Submitted';
        var s = String(raw).trim();
        if (typeof raw === 'object') {
            var vals = Object.values(raw);
            s = vals.length > 0 ? String(vals[0]).trim() : 'Submitted';
        }
        var lower = s.toLowerCase();
        if (lower === 'submitted' || lower === '') return 'Submitted';
        if (lower === 'in progress') return 'In Progress';
        if (lower === 'awaiting approval') return 'Awaiting Approval';
        if (lower === 'completed' || lower === 'complete') return 'Completed';
        if (lower.indexOf('revision') !== -1) return 'Revision Requested';
        return s;
    }

    function statusClass(status) {
        switch (status) {
            case 'Completed': return 'ars-status--done';
            case 'Approved': return 'ars-status--done';
            case 'Awaiting Approval': return 'ars-status--review';
            case 'Revision Requested': return 'ars-status--revision';
            case 'In Progress': return 'ars-status--progress';
            default: return 'ars-status--submitted';
        }
    }

    function formatDate(raw) {
        if (!raw) return '';
        // Caspio Pacific wall-clock timestamps — use CaspioDate.parse when the
        // helper is loaded; never append 'Z' (memory/caspio_pacific_timestamps.md).
        var d = (window.CaspioDate && window.CaspioDate.parse)
            ? window.CaspioDate.parse(raw)
            : new Date(raw);
        if (!d || isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function show(which) {
        // which: 'loading' | 'error' | 'empty' | 'results' | 'idle'
        els.loading.style.display = which === 'loading' ? 'flex' : 'none';
        els.error.style.display = which === 'error' ? 'block' : 'none';
        els.empty.style.display = which === 'empty' ? 'block' : 'none';
        els.results.style.display = which === 'results' ? 'block' : 'none';
    }

    function fetchJson(url) {
        return fetch(url).then(function (r) {
            if (!r.ok) throw new Error('API returned ' + r.status);
            return r.json();
        }).then(function (data) {
            return Array.isArray(data) ? data : [];
        });
    }

    /** Exact design-ID search — proxy validates the int server-side (reqInt). */
    function searchByDesignId(digits) {
        var url = API_BASE + '/api/artrequests?id_design=' + encodeURIComponent(digits)
            + '&select=' + encodeURIComponent(SELECT_FIELDS) + '&limit=25';
        return fetchJson(url);
    }

    /** Company LIKE search — the proxy escWhere-escapes the term server-side. */
    function searchByCompany(term) {
        var url = API_BASE + '/api/artrequests?companyName=' + encodeURIComponent(term)
            + '&select=' + encodeURIComponent(SELECT_FIELDS) + '&limit=200';
        return fetchJson(url);
    }

    /** Recent window for the client-side contact-name filter (fetched once). */
    function fetchRecentWindow() {
        if (!recentCache) {
            var url = API_BASE + '/api/artrequests?select=' + encodeURIComponent(SELECT_FIELDS)
                + '&limit=' + RECENT_LIMIT;
            recentCache = fetchJson(url).catch(function (err) {
                recentCache = null; // let a retry re-fetch
                throw err;
            });
        }
        return recentCache;
    }

    function runSearch(term) {
        term = String(term || '').trim();
        lastTerm = term;
        if (!term) {
            show('idle');
            return;
        }

        var seq = ++searchSeq;
        show('loading');

        var work;
        if (/^\d+$/.test(term)) {
            work = searchByDesignId(term);
        } else {
            var lower = term.toLowerCase();
            // Company search covers all history server-side; the recent window
            // adds contact-name (and recent-company) matches client-side.
            work = Promise.all([
                searchByCompany(term),
                fetchRecentWindow().catch(function (err) {
                    // Partial degradation is VISIBLE, never silent: the company
                    // results still render, with a console warning for staff.
                    console.warn('[art-search] recent-window fetch failed (contact-name matches unavailable):', err.message);
                    return [];
                })
            ]).then(function (parts) {
                var companyHits = parts[0];
                var recentHits = parts[1].filter(function (r) {
                    var contact = String(r.Full_Name_Contact || '').toLowerCase();
                    var company = String(r.CompanyName || '').toLowerCase();
                    return contact.indexOf(lower) !== -1 || company.indexOf(lower) !== -1;
                });
                // Merge + dedupe by PK_ID (company hits first — full-history set)
                var seen = {};
                var merged = [];
                companyHits.concat(recentHits).forEach(function (r) {
                    var key = String(r.PK_ID);
                    if (seen[key]) return;
                    seen[key] = true;
                    merged.push(r);
                });
                return merged;
            });
        }

        work.then(function (records) {
            if (seq !== searchSeq) return; // a newer search superseded this one
            renderResults(term, records);
        }).catch(function (err) {
            if (seq !== searchSeq) return;
            console.error('[art-search] search failed:', err);
            $('ars-error-msg').textContent = ' ' + (err.message || 'Unknown error')
                + ' — nothing was loaded. Try again, or check the proxy status.';
            show('error');
        });
    }

    function renderResults(term, records) {
        if (!records.length) {
            $('ars-empty-detail').textContent = /^\d+$/.test(term)
                ? 'No art request has design ID ' + term + '. Double-check the number, or try the company name.'
                : 'No company matched "' + term + '" in any request, and no customer name matched in the '
                    + RECENT_LIMIT + ' most recent requests.';
            show('empty');
            return;
        }

        // Newest first (same naive Date sort art-ae.js uses for Date_Created)
        records.sort(function (a, b) {
            return new Date(b.Date_Created || 0) - new Date(a.Date_Created || 0);
        });

        var rows = records.map(function (r) {
            var status = normalizeStatus(r.Status);
            // Detail link only when ID_Design is a clean number — the
            // /art-request/:designId route 400s anything non-numeric.
            var designId = String(r.ID_Design == null ? '' : r.ID_Design).trim();
            var hasLink = /^\d+(\.\d+)?$/.test(designId);
            var designCell = hasLink
                ? '<a class="ars-design-link" href="/art-request/' + encodeURIComponent(designId) + '" target="_blank" rel="noopener">'
                    + escapeHtml(designId) + '</a>'
                : escapeHtml(designId || '—');
            return '<tr>'
                + '<td class="ars-col-design">' + designCell + '</td>'
                + '<td>' + escapeHtml(r.CompanyName || '—') + '</td>'
                + '<td>' + escapeHtml(r.Full_Name_Contact || '—') + '</td>'
                + '<td><span class="ars-status ' + statusClass(status) + '">' + escapeHtml(status) + '</span></td>'
                + '<td class="ars-col-date">' + escapeHtml(formatDate(r.Date_Created) || '—') + '</td>'
                + '<td class="ars-col-open">' + (hasLink
                    ? '<a class="ars-btn ars-btn-secondary ars-btn-sm" href="/art-request/' + encodeURIComponent(designId)
                        + '" target="_blank" rel="noopener">Open &rarr;</a>'
                    : '')
                + '</td>'
                + '</tr>';
        }).join('');

        $('ars-tbody').innerHTML = rows;
        $('ars-results-count').textContent = records.length + ' request' + (records.length === 1 ? '' : 's')
            + ' matching "' + term + '"';
        show('results');
    }

    function init() {
        // Staff gate — same pattern as pages/js/quote-audit.js: no session, no data.
        if (typeof StaffAuthHelper === 'undefined' || !StaffAuthHelper.isLoggedIn()) {
            $('auth-gate').style.display = 'flex';
            return;
        }

        els = {
            loading: $('ars-loading'),
            error: $('ars-error'),
            empty: $('ars-empty'),
            results: $('ars-results')
        };

        $('ars-content').style.display = 'block';

        $('ars-form').addEventListener('submit', function (e) {
            e.preventDefault();
            runSearch($('ars-input').value);
        });
        $('ars-retry-btn').addEventListener('click', function () {
            runSearch(lastTerm || $('ars-input').value);
        });

        // Deep-link support: /pages/art-search.html?q=term
        try {
            var q = new URLSearchParams(window.location.search).get('q');
            if (q) {
                $('ars-input').value = q;
                runSearch(q);
            }
        } catch (e) { /* no deep-link — idle state */ }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
