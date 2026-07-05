/**
 * art-aging-widget.js — "Art Requests Needing Attention" card for Staff Dashboard v3
 *
 * Shows counts of OPEN art requests bucketed by how long they've sat in their
 * current status (>7 days = red, 3–7 days = yellow) plus the 5 oldest, each
 * linking to the request detail page (/art-request/{ID_Design} — same URL the
 * Steve gallery opens).
 *
 * Design notes:
 *  - "Age in current status" proxy = Date_Updated (falls back to Date_Created).
 *    ArtRequests has no per-status-change timestamp; Date_Updated is the
 *    closest available signal ("nothing has happened to this record in N days").
 *  - Status semantics mirror art-hub-steve-gallery.js normalizeStatus():
 *    Submitted / In Progress / Awaiting Approval / Revision Requested are OPEN;
 *    Approved / Completed are closed; unknown/blank collapses to Submitted
 *    (the hub's "nothing vanishes" catch-all). Is_On_Hold requests are excluded —
 *    they're intentionally paused and don't need attention.
 *  - Caspio timestamps are naive Pacific wall-clock — parsed via
 *    window.CaspioDate.parse (caspio-date-utils.js is loaded by index.html).
 *  - Lazy: waits for DOMContentLoaded, then defers the fetch to idle time so
 *    the hub's own controllers always win the network/CPU race. Any failure is
 *    contained to this card and shows a visible "couldn't load — retry" state
 *    (Erik's #1 rule: never silent).
 *
 * Read-only widget — performs GETs only, never writes status/Revision_Count.
 */
(function () {
    'use strict';

    // APP_CONFIG.API.BASE_URL already ends in '/api' — the fallback must too, so
    // callers below append '/artrequests' (NOT '/api/artrequests', which would
    // double up to '/api/api/...' → 404).
    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api';

    // Same "new status system" cutoff the Steve gallery/kanban use — pre-cutoff
    // records are on the legacy status vocabulary and would flood the red bucket.
    var DATE_CUTOFF = '2026-03-15';
    var RED_DAYS = 7;      // strictly more than this = red
    var YELLOW_DAYS = 3;   // this or more (up to RED_DAYS) = yellow
    var LIST_MAX = 5;

    var loading = false;

    // ── Helpers ────────────────────────────────────────────────────────────
    function escapeHtml(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    // Mirrors art-hub-steve-gallery.js normalizeStatus() — keep in sync.
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
        if (lower === 'approved') return 'Approved';
        if (lower.indexOf('revision') !== -1) return 'Revision Requested';
        return 'Submitted';
    }

    function isOpenStatus(status) {
        return status !== 'Completed' && status !== 'Approved';
    }

    // Caspio timestamps are naive Pacific — CaspioDate.parse handles the offset.
    // Fallback to native Date only if the util somehow isn't loaded.
    function parseCaspioDate(s) {
        if (!s) return null;
        if (window.CaspioDate && typeof window.CaspioDate.parse === 'function') {
            return window.CaspioDate.parse(s);
        }
        var d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
    }

    function daysSince(dateStr) {
        var d = parseCaspioDate(dateStr);
        if (!d) return null;
        var diff = Date.now() - d.getTime();
        if (diff < 0) return 0;
        return Math.floor(diff / 86400000);
    }

    // ── Fetch ──────────────────────────────────────────────────────────────
    function fetchOpenRequests() {
        // orderBy ASC so if the 500-row cap ever truncates, we keep the OLDEST
        // records — the ones this widget exists to surface.
        var base = API_BASE + '/artrequests?orderBy=Date_Created ASC&limit=500&dateCreatedFrom=' + DATE_CUTOFF;
        var selectFields = 'ID_Design,CompanyName,Status,Date_Created,Date_Updated,Is_On_Hold';
        // Graceful degradation if a field is missing on this install (same
        // 500-fallback pattern as art-hub-steve-gallery.js fetchRequests()).
        var selectFallback = 'ID_Design,CompanyName,Status,Date_Created';

        return fetch(base + '&select=' + selectFields)
            .then(function (resp) {
                if (resp.status === 500) {
                    return fetch(base + '&select=' + selectFallback)
                        .then(function (r2) {
                            if (!r2.ok) throw new Error('API ' + r2.status);
                            return r2.json();
                        });
                }
                if (!resp.ok) throw new Error('API ' + resp.status);
                return resp.json();
            });
    }

    // ── Render ─────────────────────────────────────────────────────────────
    function bodyEl() { return document.getElementById('artAgingBody'); }

    function chipHtml(count, label, color) {
        return '<div style="flex:1;min-width:90px;text-align:center;padding:10px 8px;border-radius:8px;background:' + color + '1a;border:1px solid ' + color + '55;">' +
            '<div class="num" style="font-size:1.5rem;font-weight:700;color:' + color + ';">' + count + '</div>' +
            '<div style="font-size:.72rem;opacity:.8;">' + escapeHtml(label) + '</div>' +
        '</div>';
    }

    function render(items) {
        var el = bodyEl();
        if (!el) return;

        // Bucket by age-in-current-status.
        var red = [], yellow = [], fresh = 0;
        items.forEach(function (it) {
            if (it.days == null) { fresh++; return; }
            if (it.days > RED_DAYS) red.push(it);
            else if (it.days >= YELLOW_DAYS) yellow.push(it);
            else fresh++;
        });

        var attention = red.concat(yellow).sort(function (a, b) { return b.days - a.days; });

        var html = '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
            chipHtml(red.length, '&gt; 7 days', '#ef4444') +
            chipHtml(yellow.length, '3–7 days', '#f59e0b') +
            chipHtml(fresh, 'Under 3 days', '#22c55e') +
        '</div>';

        if (attention.length === 0) {
            html += '<div class="metrics-date-range" style="text-align:center;padding:8px 0;">' +
                '✅ All caught up — no open request has sat more than ' + YELLOW_DAYS + ' days.</div>';
        } else {
            html += '<div style="display:flex;flex-direction:column;gap:6px;">';
            attention.slice(0, LIST_MAX).forEach(function (it) {
                var color = it.days > RED_DAYS ? '#ef4444' : '#f59e0b';
                html += '<a href="/art-request/' + encodeURIComponent(it.id) + '" target="_blank" rel="noopener"' +
                    ' style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;text-decoration:none;color:inherit;background:rgba(127,127,127,.08);border-left:3px solid ' + color + ';"' +
                    ' title="Open art request #' + escapeHtml(it.id) + '">' +
                    '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;font-size:.85rem;">' + escapeHtml(it.company) + '</span>' +
                    '<span style="font-size:.72rem;opacity:.75;white-space:nowrap;">' + escapeHtml(it.status) + '</span>' +
                    '<span class="num" style="font-size:.78rem;font-weight:700;color:' + color + ';white-space:nowrap;">' + it.days + 'd</span>' +
                '</a>';
            });
            html += '</div>';
            if (attention.length > LIST_MAX) {
                html += '<div class="metrics-date-range" style="margin-top:8px;">+ ' + (attention.length - LIST_MAX) +
                    ' more — see <a href="/dashboards/art-hub-steve.html" style="color:inherit;">Steve’s Queue</a></div>';
            }
        }

        el.innerHTML = html;
    }

    function renderError(message) {
        var el = bodyEl();
        if (!el) return;
        el.innerHTML = '';
        var wrap = document.createElement('div');
        wrap.style.cssText = 'text-align:center;padding:10px 0;';
        var msg = document.createElement('div');
        msg.style.cssText = 'font-size:.82rem;color:#ef4444;margin-bottom:8px;';
        msg.textContent = '⚠ Couldn’t load art requests' + (message ? ' (' + message + ')' : '') + '.';
        var retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'refresh-btn';
        retry.textContent = 'Retry';
        retry.style.cssText = 'width:auto;padding:4px 14px;font-size:.8rem;';
        retry.addEventListener('click', load);
        wrap.appendChild(msg);
        wrap.appendChild(retry);
        el.appendChild(wrap);
    }

    // ── Load ───────────────────────────────────────────────────────────────
    function load() {
        if (loading) return;
        var el = bodyEl();
        if (!el) return; // card not on this page — do nothing
        loading = true;
        el.innerHTML = '<div class="metrics-date-range">Loading art requests…</div>';

        fetchOpenRequests()
            .then(function (data) {
                loading = false;
                var rows = Array.isArray(data) ? data : [];
                var items = [];
                rows.forEach(function (r) {
                    if (r.Is_On_Hold) return;                       // paused — not "needing attention"
                    var status = normalizeStatus(r.Status);
                    if (!isOpenStatus(status)) return;              // Approved/Completed are done
                    var days = daysSince(r.Date_Updated || r.Date_Created);
                    items.push({
                        id: String(r.ID_Design || ''),
                        company: r.CompanyName || 'Unknown',
                        status: status,
                        days: days
                    });
                });
                render(items);
            })
            .catch(function (err) {
                loading = false;
                console.error('[ArtAgingWidget] load failed:', err);
                renderError(err && err.message);
            });
    }

    function scheduleLoad() {
        // Defer to idle so the hub's own zones always render/fetch first.
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(load, { timeout: 3000 });
        } else {
            setTimeout(load, 600);
        }
        var refreshBtn = document.getElementById('artAgingRefresh');
        if (refreshBtn) refreshBtn.addEventListener('click', load);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', scheduleLoad);
    } else {
        scheduleLoad();
    }
})();
