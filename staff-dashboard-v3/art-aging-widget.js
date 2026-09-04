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

    // Same-origin requireStaff relay (2026-08-27) — the SAML session cookie
    // authenticates the request; the server forwards to the proxy's
    // /api/artrequests with the CRM secret. This widget used to call the
    // public proxy base directly (obscurity, not auth).
    var API_BASE = '/api/staff';

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

    // Styling lives in dashboards/css/company-numbers.css (.aa-*) — this widget
    // used to build inline styles with hardcoded hex colours (Rule 3 in spirit,
    // and it ignored the theme tokens). tone = 'red' | 'amber' | 'green'.
    function chipHtml(count, label, tone) {
        return '<div class="aa-chip aa-chip--' + tone + '">' +
            '<div class="aa-chip-num num">' + count + '</div>' +
            '<div class="aa-chip-label">' + escapeHtml(label) + '</div>' +
        '</div>';
    }

    // Tell the page (Company Numbers stamps) how the load went. The result is
    // also kept on window.ArtAgingWidget.last because this classic script often
    // finishes its first load BEFORE the page's module entry (still fetching its
    // import graph) has registered the listener.
    function announce(ok) {
        var detail = { ok: !!ok, at: Date.now() };
        if (window.ArtAgingWidget) window.ArtAgingWidget.last = detail;
        try {
            document.dispatchEvent(new CustomEvent('art-aging:loaded', { detail: detail }));
        } catch (e) { /* ancient browsers — the card still rendered */ }
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

        var html = '<div class="aa-chips">' +
            chipHtml(red.length, '> 7 days', 'red') +
            chipHtml(yellow.length, '3–7 days', 'amber') +
            chipHtml(fresh, 'Under 3 days', 'green') +
        '</div>';

        if (attention.length === 0) {
            html += '<div class="metrics-date-range aa-clear">' +
                '✅ All caught up — no open request has sat more than ' + YELLOW_DAYS + ' days.</div>';
        } else {
            html += '<div class="aa-list">';
            attention.slice(0, LIST_MAX).forEach(function (it) {
                var tone = it.days > RED_DAYS ? 'red' : 'amber';
                html += '<a class="aa-row aa-row--' + tone + '" href="/art-request/' + encodeURIComponent(it.id) + '" target="_blank" rel="noopener"' +
                    ' title="Open art request #' + escapeHtml(it.id) + '">' +
                    '<span class="aa-company">' + escapeHtml(it.company) + '</span>' +
                    '<span class="aa-status">' + escapeHtml(it.status) + '</span>' +
                    '<span class="aa-days num">' + it.days + 'd</span>' +
                '</a>';
            });
            html += '</div>';
            if (attention.length > LIST_MAX) {
                html += '<div class="metrics-date-range aa-more">+ ' + (attention.length - LIST_MAX) +
                    ' more — see <a href="/dashboards/art-hub-steve.html">Steve’s Queue</a></div>';
            }
        }

        el.innerHTML = html;
    }

    function renderError(message) {
        var el = bodyEl();
        if (!el) return;
        el.innerHTML = '';
        var wrap = document.createElement('div');
        wrap.className = 'aa-error';
        var msg = document.createElement('div');
        msg.className = 'aa-error-msg';
        msg.textContent = '⚠ Couldn’t load art requests' + (message ? ' (' + message + ')' : '') + '.';
        var retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'refresh-btn aa-retry';
        retry.textContent = 'Retry';
        retry.addEventListener('click', load);
        wrap.appendChild(msg);
        wrap.appendChild(retry);
        el.appendChild(wrap);
    }

    // ── Load ───────────────────────────────────────────────────────────────
    // Returns a promise (resolves true/false) so the page's 5-minute tick can
    // stamp the card; the widget still schedules its own first load.
    function load() {
        var el = bodyEl();
        if (loading || !el) return Promise.resolve(false); // in flight, or card not on this page
        loading = true;
        el.innerHTML = '<div class="metrics-date-range">Loading art requests…</div>';

        return fetchOpenRequests()
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
                announce(true);
                return true;
            })
            .catch(function (err) {
                loading = false;
                console.error('[ArtAgingWidget] load failed:', err);
                renderError(err && err.message);
                announce(false);
                return false;
            });
    }

    // Company Numbers calls load() on its 5-minute tick and reads `last` at boot.
    window.ArtAgingWidget = { load: load, last: null };

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
