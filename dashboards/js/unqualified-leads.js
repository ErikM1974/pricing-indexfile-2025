/**
 * unqualified-leads.js — controller for dashboards/unqualified-leads.html
 *
 * Review page for the leads Claude tagged Lead_Category='spam' | 'unqualified'.
 * These stay Status='Archived' (off the main board) and never count in the
 * win-rate. Data comes from the SAME-ORIGIN session-gated form-submissions
 * forwarder with the ?category= filter (proxy Lead_Category). NO POLLING —
 * loads on open + Refresh + tab switch. Every rendered value is escaped.
 */
(function () {
    'use strict';

    var state = { cat: 'spam', search: '', cache: {} };

    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function fmtDay(iso) {
        var s = String(iso || '');
        var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s);
        return isNaN(d.getTime()) ? esc(s.slice(0, 10)) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    document.addEventListener('DOMContentLoaded', function () {
        document.getElementById('btn-refresh').addEventListener('click', function () {
            state.cache = {}; load(state.cat);
        });
        document.getElementById('btn-rescan').addEventListener('click', rescan);
        document.getElementById('uq-search').addEventListener('input', function () {
            state.search = this.value.trim().toLowerCase(); render();
        });
        Array.prototype.forEach.call(document.querySelectorAll('.uq-tab'), function (t) {
            t.addEventListener('click', function () {
                Array.prototype.forEach.call(document.querySelectorAll('.uq-tab'), function (x) { x.classList.remove('is-active'); });
                t.classList.add('is-active');
                state.cat = t.getAttribute('data-cat');
                document.getElementById('section-title').textContent = state.cat === 'spam' ? 'Spam' : 'Unqualified';
                document.getElementById('spam-note').style.display = state.cat === 'spam' ? '' : 'none';
                load(state.cat);
            });
        });
        // preload both counts for the badges
        load('spam');
        prefetchCount('unqualified');
    });

    function prefetchCount(cat) {
        if (state.cache[cat]) return;
        fetchCat(cat).then(function (rows) { state.cache[cat] = rows; setBadge(cat, rows.length); }).catch(function () {});
    }

    function setBadge(cat, n) { document.getElementById('badge-' + cat).textContent = n; }

    // "Rescan with Claude" — POST to the classifier; it categorizes any new,
    // uncategorized leads (spam/unqualified auto-archive here, qualified stay on
    // the board). Then reload so freshly-caught spam/unqualified appear.
    function rescan() {
        var btn = document.getElementById('btn-rescan');
        var orig = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Scanning…';
        DashPage.hideError();
        fetch('/api/crm-proxy/lead-classify/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
            .then(function (resp) {
                return resp.json().catch(function () { return {}; }).then(function (b) {
                    if (!resp.ok) throw new Error((b && b.error) || ('HTTP ' + resp.status));
                    return b;
                });
            })
            .then(function (r) {
                state.cache = {};
                load('spam'); prefetchCount('unqualified');
                var added = (r.spam || 0) + (r.unqualified || 0);
                DashPage.showError((r.classified || 0) === 0
                    ? 'No new leads to categorize — everything is already sorted.'
                    : 'Claude categorized ' + r.classified + ' new lead' + (r.classified === 1 ? '' : 's') + ': ' +
                        (r.spam || 0) + ' spam, ' + (r.unqualified || 0) + ' unqualified, ' + (r.qualified || 0) + ' qualified' +
                        (added ? ' (' + added + ' moved off the board).' : '.'),
                    'info');
            })
            .catch(function (err) {
                DashPage.showError('Rescan failed: ' + err.message +
                    (/503/.test(err.message) ? ' — the ANTHROPIC_API_KEY may not be set on the proxy.' : ''));
            })
            .finally(function () { btn.disabled = false; btn.innerHTML = orig; });
    }

    function fetchCat(cat) {
        return fetch('/api/crm-proxy/form-submissions?category=' + encodeURIComponent(cat) + '&limit=2000')
            .then(function (resp) {
                return resp.json().catch(function () { return {}; }).then(function (b) {
                    if (!resp.ok) throw new Error((b && b.error) || ('HTTP ' + resp.status));
                    return (b.submissions || []).sort(function (a, c) {
                        return String(c.Submitted_At || '').localeCompare(String(a.Submitted_At || ''));
                    });
                });
            });
    }

    function load(cat) {
        DashPage.hideError();
        document.getElementById('uq-tbody').innerHTML = '<tr><td colspan="5" class="uq-empty dash-loading">Loading…</td></tr>';
        if (state.cache[cat]) { setBadge(cat, state.cache[cat].length); render(); return; }
        fetchCat(cat).then(function (rows) {
            state.cache[cat] = rows;
            setBadge(cat, rows.length);
            render();
        }).catch(function (err) {
            console.error('[unqualified] load failed:', err);
            DashPage.showError('Unable to load ' + cat + ' leads (' + err.message + '). Refresh to retry.');
            document.getElementById('uq-tbody').innerHTML = '<tr><td colspan="5" class="uq-empty"><i class="fas fa-triangle-exclamation"></i> Unavailable.</td></tr>';
        });
    }

    function render() {
        var rows = state.cache[state.cat] || [];
        if (state.search) {
            rows = rows.filter(function (l) {
                return [l.Company, l.Contact_Name, l.Email, l.Summary].join(' ').toLowerCase().indexOf(state.search) !== -1;
            });
        }
        document.getElementById('list-count').textContent = rows.length + (state.search ? ' matching' : '') + ' lead' + (rows.length === 1 ? '' : 's');
        var body = document.getElementById('uq-tbody');
        if (!rows.length) {
            body.innerHTML = '<tr><td colspan="5" class="uq-empty">Nothing here.</td></tr>';
            return;
        }
        body.innerHTML = rows.map(function (l) {
            return '<tr>' +
                '<td class="uq-when">' + fmtDay(l.Submitted_At) + '</td>' +
                '<td>' + esc(l.Company || '—') + '</td>' +
                '<td>' + esc(l.Contact_Name || '—') + '</td>' +
                '<td class="uq-email">' + esc(l.Email || '') + '</td>' +
                '<td class="uq-summary">' + esc((l.Summary || '').slice(0, 140)) + '</td>' +
                '</tr>';
        }).join('');
    }
})();
