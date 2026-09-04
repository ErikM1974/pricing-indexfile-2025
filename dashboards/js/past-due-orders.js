/**
 * past-due-orders.js — controller for dashboards/past-due-orders.html
 *
 * Every ShopWorks order that has missed its requested-ship date and is neither shipped
 * nor invoiced, grouped by sales rep. Not SanMar-specific: the SanMar Inbound board only
 * sees orders with freight arriving, which is a fraction of the shop. Blanks vendors on
 * this list include Logomark, Augusta, Richardson, Supacolor and "no PO raised yet".
 *
 * ⚠️ Same-origin fetch, NOT DashPage.fetchJson. fetchJson prefixes
 * APP_CONFIG.API.BASE_URL (the Heroku proxy), and this endpoint lives on THIS server:
 * /api/crm-proxy/ae-dashboard/due-dates-all is a requireStaff forwarder that attaches
 * the CRM secret server-side. Routing it through the proxy base would 401 — the proxy
 * side is secret-only and a browser cannot hold a secret.
 */
(function () {
    'use strict';

    var ENDPOINT = '/api/crm-proxy/ae-dashboard/due-dates-all';

    // The payload the screen is currently showing. The print sheets are built from this
    // and nothing else, so paper can never disagree with the board Erik is looking at.
    // Cleared on every failure — see load()'s catch.
    var lastData = null;
    var loading = false;
    var lastLoadedAt = 0;
    // Monotonic request token. Without it the LAST RESPONSE wins rather than the last
    // request: flip 30→90→30 quickly and a slow 90 can land after the 30 and leave the
    // board — and therefore the sheets — showing a window nobody selected.
    var loadSeq = 0;

    // A sheet is handed to a rep who then resets a due date from it. Anything older than
    // this gets re-pulled before printing, and a failed re-pull ABORTS the print — the
    // house rule is that no sheet beats a quietly stale one. Matches the 120s bound
    // sanmar-inbound-today.js uses for the same reason.
    var PRINT_FRESH_MS = 120000;

    // Where a rep heading goes when clicked (2026-09-04) — the rep's own account page,
    // the same map Company Numbers' team card uses. Reps without a page stay plain text.
    var REP_PAGES = {
        'Nika Lao':       '/dashboards/nika-crm.html',
        'Taneisha Clark': '/dashboards/taneisha-crm.html',
        'House':          '/dashboards/house-accounts.html'
    };

    // "No PO raised" is the one row whose next step is a page on this site: the Purchase
    // Request form that asks Bradley to buy the blanks. The form is a JotForm embed and
    // cannot be prefilled from the URL, so the row link carries the WO in its title.
    var PURCHASE_REQUEST_URL = '/calculators/purchasingform.html';

    // Re-read while the tab is visible (2026-09-04). Erik opens this at 8am from a tab
    // that may have sat since yesterday; the print path already re-pulls, the board did
    // not. Cache-honouring load(false): the upstream 10-minute cache governs quota.
    var REFRESH_INTERVAL_MS = 5 * 60 * 1000;

    document.addEventListener('DOMContentLoaded', function () {
        var days = document.getElementById('pdo-days');
        var refresh = document.getElementById('pdo-refresh');
        var print = document.getElementById('pdo-print');
        if (days) days.addEventListener('change', function () { load(false); });
        if (refresh) refresh.addEventListener('click', function () { load(true); });
        if (print) print.addEventListener('click', doPrint);
        load(false);

        setInterval(function () {
            if (document.visibilityState === 'visible' && !loading) load(false);
        }, REFRESH_INTERVAL_MS);
        document.addEventListener('visibilitychange', function () {
            if (document.visibilityState === 'visible' && !loading
                && Date.now() - lastLoadedAt >= REFRESH_INTERVAL_MS) load(false);
        });
    });

    function selectedDays() {
        var el = document.getElementById('pdo-days');
        return (el && el.value) || '30';
    }

    // Resolves true when this load produced the data now on screen, false otherwise
    // (failed, or superseded by a newer request). doPrint() gates on that.
    async function load(force) {
        var seq = ++loadSeq;
        var root = document.getElementById('content-root');
        if (root) { root.className = 'dash-loading'; root.textContent = 'Loading…'; }
        // While a load is in flight lastData still holds the PREVIOUS window's payload.
        // Printing now would hand a rep a sheet that disagrees with the screen behind it
        // — e.g. the 30-day list under a 60-day heading. Lock the controls until it lands.
        // (Options are left intact so the chosen rep survives the reload.)
        loading = true;
        setPrintEnabled(false);
        try {
            var url = ENDPOINT + '?days=' + encodeURIComponent(selectedDays()) + (force ? '&refresh=1' : '');
            var resp = await fetch(url, { credentials: 'same-origin' });
            if (!resp.ok) throw new Error('HTTP ' + resp.status + ' ' + (resp.statusText || ''));
            var data = await resp.json();
            if (data.error) throw new Error(data.details || data.error);
            if (seq !== loadSeq) return false;   // superseded — leave the newer load's state alone
            DashPage.hideError();
            lastData = data;
            lastLoadedAt = Date.now();
            render(data);
            fillRepPicker(data);
            return true;
        } catch (err) {
            if (seq !== loadSeq) return false;
            console.error('[past-due-orders] load failed:', err);
            // Never leave a stale or empty table looking like "nothing is late".
            if (root) { root.className = 'pdo-failed'; root.textContent = 'Could not load the past-due list — nothing is shown rather than something wrong.'; }
            setStats(null);
            // Same rule on paper as on screen: a sheet built from the PREVIOUS load would
            // hand a rep a list that is quietly out of date, which is worse than no sheet.
            lastData = null;
            lastLoadedAt = 0;
            fillRepPicker(null);
            DashPage.showError('Unable to load past-due orders (' + err.message + '). Nothing is displayed, because a blank list would read as "nothing is late". Try Refresh.');
            return false;
        } finally {
            if (seq === loadSeq) loading = false;
        }
    }

    function sumValue(rows) {
        return (rows || []).reduce(function (s, o) { return s + (Number(o.subtotal) || 0); }, 0);
    }

    function setStats(d) {
        var late = d ? (d.late || []) : [];
        var risk = d ? (d.atRisk || []) : [];
        var noPO = late.filter(function (o) { return o.blanks === 'none'; });
        put('stat-late', d ? d.counts.late : '—');
        put('stat-risk', d ? d.counts.atRisk : '—');
        put('stat-nopo', d ? noPO.length : '—');
        put('stat-ontrack', d ? d.counts.dueSoonOnTrack : '—');
        // Dollar value under each count. On-track orders are a count only upstream.
        put('stat-late-val', d ? (late.length ? money(sumValue(late)) + ' of work' : '') : '');
        put('stat-risk-val', d ? (risk.length ? money(sumValue(risk)) + ' of work' : '') : '');
        put('stat-nopo-val', d ? (noPO.length ? money(sumValue(noPO)) + ' waiting on a PO' : '') : '');
        put('stat-ontrack-val', d ? 'blanks in house' : '');
    }

    function put(id, v) {
        var el = document.getElementById(id);
        if (el) el.textContent = (v === null || v === undefined) ? '—' : String(v);
    }

    function render(d) {
        setStats(d);
        var reps = activeReps(d);
        var onBoard = (d.late || []).length + (d.atRisk || []).length;

        // Freshness is a TIME as well as a date: the upstream cache is ten minutes and this
        // tab may have been open since yesterday. "loaded 4:22 PM" is the client clock —
        // it answers "how old is what I am looking at", which the payload cannot.
        var asOf = document.getElementById('pdo-asof');
        if (asOf) {
            asOf.textContent = 'as of ' + d.today + ' · ' + d.lookbackDays + '-day window · '
                + d.ordersScanned + ' orders scanned · loaded ' + clockTime();
        }
        var summary = document.getElementById('pdo-summary');
        if (summary) {
            summary.textContent = onBoard
                ? onBoard + ' order' + (onBoard === 1 ? '' : 's') + ' on the board · '
                  + reps.length + ' rep' + (reps.length === 1 ? '' : 's') + ' · '
                : '';
        }

        var root = document.getElementById('content-root');
        if (!root) return;
        root.className = '';

        if (!reps.length) {
            root.innerHTML = '<p class="pdo-none"><i class="fas fa-check-circle"></i> '
                + 'Nothing past due or at risk in the last ' + esc(d.lookbackDays) + ' days.</p>';
            return;
        }

        var html = '';
        if (d.lateTruncated) {
            html += '<p class="pdo-trunc">Showing the first entries — ' + esc(d.lateTruncated)
                + ' more past-due orders were not returned.</p>';
        }
        reps.forEach(function (rep) {
            var g = d.byRep[rep];
            // Same rule as the printed banner: a rep with nothing late reads "2 at risk",
            // not "0 past due · 2 at risk".
            var counts = [];
            if (g.late.length) counts.push(g.late.length + ' past due');
            if (g.atRisk.length) counts.push(g.atRisk.length + ' at risk');
            var total = sumValue(g.late) + sumValue(g.atRisk);
            var page = REP_PAGES[rep];
            var name = page
                ? '<a class="pdo-rep-link" href="' + esc(page) + '" title="Open ' + esc(rep) + '’s accounts">'
                  + esc(rep) + ' <i class="fas fa-arrow-up-right-from-square" aria-hidden="true"></i></a>'
                : esc(rep);
            html += '<section class="pdo-rep">'
                + '<h3 class="pdo-rep-name">' + name
                + '<span class="pdo-rep-count">' + esc(counts.join(' · ')) + '</span>'
                + (total ? '<span class="pdo-rep-total">' + money(total) + '</span>' : '')
                + '</h3>'
                + table(g.late.concat(g.atRisk))
                + '</section>';
        });
        root.innerHTML = html;
    }

    function table(rows) {
        if (!rows.length) return '';
        // "Late · Due in": half the rows are at-risk and read "in 4d" — under a header that
        // said only LATE that looked wrong (2026-09-04).
        var h = '<div class="pdo-scroll"><table class="pdo-table"><thead><tr>'
            + '<th>WO</th><th>Customer</th><th>Due</th><th class="pdo-num">Late · Due in</th>'
            + '<th class="pdo-num">Value</th><th>Blanks</th><th>Type</th></tr></thead><tbody>';
        rows.sort(function (a, b) { return a.daysUntilDue - b.daysUntilDue; });
        rows.forEach(function (o) {
            var late = o.daysUntilDue < 0;
            h += '<tr class="' + (late ? 'pdo-late' : 'pdo-risk') + '">'
                + '<td class="pdo-wo">' + esc(o.idOrder) + '</td>'
                + '<td>' + esc(o.company) + (o.partiallyShipped ? ' <span class="pdo-partial">partially shipped</span>' : '') + '</td>'
                + '<td class="pdo-num">' + esc(o.dueDate) + '</td>'
                + '<td class="pdo-num">' + (late
                    ? '<span class="pdo-badge">' + Math.abs(o.daysUntilDue) + 'd late</span>'
                    : (o.daysUntilDue === 0 ? 'today' : 'in ' + o.daysUntilDue + 'd')) + '</td>'
                + '<td class="pdo-num">' + moneyCell(o.subtotal) + '</td>'
                + '<td class="' + (o.blanks === 'none' ? 'pdo-nopo' : '') + '">' + blanksCell(o) + '</td>'
                + '<td>' + esc(o.orderType || '') + '</td>'
                + '</tr>';
        });
        return h + '</tbody></table></div>';
    }

    // The blanks cell is the actionable one. "no PO raised" links to the Purchase Request
    // form (the next step); any other state names the vendor to chase — the printed sheet
    // always had the vendor, the screen used to hide it.
    function blanksCell(o) {
        if (o.blanks === 'none') {
            return '<a class="pdo-nopo-link" href="' + PURCHASE_REQUEST_URL + '"'
                + ' title="Raise a purchase request for WO ' + esc(o.idOrder) + ' (' + esc(o.company) + ')">'
                + 'no PO raised <i class="fas fa-cart-plus" aria-hidden="true"></i></a>';
        }
        var v = (o.vendors || []).filter(Boolean);
        return blanks(o.blanks)
            + (v.length && o.blanks !== 'received' ? '<span class="pdo-vendor">' + esc(v.join(', ')) + '</span>' : '');
    }

    // A zero subtotal renders as a dash, not an empty cell that reads like a fault.
    function moneyCell(n) {
        var m = money(n);
        return m || '<span class="pdo-dash">—</span>';
    }

    function blanks(b) {
        if (b === 'none') return 'no PO raised';
        if (b === 'ordered') return 'ordered, not in';
        if (b === 'partial') return 'partial';
        if (b === 'received') return 'received';
        return esc(b || '');
    }

    function money(n) {
        var v = Number(n) || 0;
        return v ? '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '';
    }

    function esc(s) {
        return String(s === null || s === undefined ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    // Reps who actually have something on the list. Shared by the screen and the print
    // picker so the sheets on paper are exactly the sections shown on screen.
    function activeReps(d) {
        return ((d && d.reps) || []).filter(function (r) {
            var g = d.byRep[r];
            return g && (g.late.length || g.atRisk.length);
        });
    }

    /* ====================================================================
       PRINTED REP SHEETS

       Erik prints these at 8am and hands each rep their page, so the rep can
       go into ShopWorks and reset the due date. That drives every choice below:

       - One rep per PAGE (never per section) — the stack has to be splittable.
       - The rep's name repeats inside <thead>, so a rep whose list spills onto a
         second sheet still has their name on it. An <h2> above the table would
         not repeat, which is exactly how the old printout produced an orphan
         page 3 that belonged to nobody.
       - Fixed column widths — the old printout wrapped dates into "2026-" /
         "07-31" and floated the late badge onto the wrong row.
       - Vendor and placed-date are printed here but not on screen: on paper the
         rep has no hover, no second tab, and needs to know who to chase and how
         old the job is before committing to a new date.
       ==================================================================== */

    var SHEET_ID = 'pdo-print-sheet';
    var PRINTING_CLASS = 'pdo-printing';

    async function doPrint() {
        // No data means the load failed or hasn't finished. Printing here would emit a
        // sheet that reads "all clear" — the one outcome that must never reach paper.
        // Not just the disabled button: this must hold even if something re-enables it.
        if (loading) {
            DashPage.showError('Nothing to print yet — the past-due list is still loading. Try again in a moment.');
            return;
        }
        if (!lastData) {
            DashPage.showError('Nothing to print yet — the past-due list has not loaded. Try Refresh first.');
            return;
        }

        // Erik opens this page and prints at 8am; those are not the same moment. A sheet
        // built from a list pulled 25 minutes ago still prints TODAY'S date, so nothing on
        // paper reveals its age. Re-pull first and abort the print if that fails.
        // load(false) rides the upstream 10-minute cache, so this is ~free on Caspio quota.
        if (Date.now() - lastLoadedAt > PRINT_FRESH_MS) {
            if (!(await load(false))) return;   // load() already surfaced the error
        }

        var who = document.getElementById('pdo-print-who');
        if (!buildAndPrint((who && who.value) || '')) {
            DashPage.showError('Nothing to print — no past-due or at-risk orders in this window.');
        }
    }

    // false when there was nothing to build.
    function buildAndPrint(pick) {
        if (!renderSheet(pick)) return false;
        document.body.classList.add(PRINTING_CLASS);
        window.print();
        // Some browsers never fire afterprint; without this the page would stay blank.
        setTimeout(function () {
            if (document.body.classList.contains(PRINTING_CLASS)) teardownSheet();
        }, 1500);
        return true;
    }

    function renderSheet(pick) {
        var inner = pick ? repSheet(lastData, pick, false) : buildAllRepsInner(lastData);
        if (!inner) return false;
        teardownSheet();
        var sheet = document.createElement('div');
        sheet.id = SHEET_ID;
        sheet.innerHTML = inner;
        document.body.appendChild(sheet);
        return true;
    }

    function teardownSheet() {
        document.body.classList.remove(PRINTING_CLASS);
        var s = document.getElementById(SHEET_ID);
        if (s) s.remove();
    }

    window.addEventListener('afterprint', teardownSheet);

    // Ctrl+P / File→Print must not fall back to printing the raw board. Every print rule is
    // scoped to .pdo-printing, so without this a keyboard print would emit the very 4-page
    // blob these sheets replaced. beforeprint cannot await, so it cannot re-pull — the
    // sheet stamping its own window and print time is what keeps that honest.
    window.addEventListener('beforeprint', function () {
        if (document.getElementById(SHEET_ID)) return;   // the button path already built it
        if (!lastData || loading) return;                // nothing safe to build
        var who = document.getElementById('pdo-print-who');
        if (renderSheet((who && who.value) || '')) document.body.classList.add(PRINTING_CLASS);
    });

    // Every rep, each starting a fresh page. This is the 8am default.
    function buildAllRepsInner(d) {
        return activeReps(d).map(function (rep, i) {
            return repSheet(d, rep, i > 0);
        }).join('');
    }

    // One rep's sheet. `breakBefore` starts it on a new page — false for the first rep
    // in a run (and for a single-rep print), so neither leads with a blank page.
    function repSheet(d, rep, breakBefore) {
        var g = (d.byRep || {})[rep];
        if (!g || (!g.late.length && !g.atRisk.length)) return '';

        var html = '';
        if (g.late.length) {
            html += sheetTable(d, rep, g, g.late, 'Past due', g.late.length + ' order' + (g.late.length === 1 ? '' : 's'), true);
        }
        if (g.atRisk.length) {
            // "First banner on the sheet" carries the brand block — so a rep with nothing
            // past due still gets a properly headed page rather than a bare table.
            html += sheetTable(d, rep, g, g.atRisk, 'At risk — due within 7 days, blanks not in house',
                g.atRisk.length + ' order' + (g.atRisk.length === 1 ? '' : 's'), !g.late.length);
        }
        return '<section class="pdo-ps-rep' + (breakBefore ? ' pdo-ps-brk' : '') + '">' + html + '</section>';
    }

    // The rep banner, section label and column headers all live in <thead> so the browser
    // reprints them at the top of every physical page this table spills onto.
    function sheetTable(d, rep, g, rows, label, countText, primary) {
        // "0 past due · 2 at risk" reads as a defect on the sheet of a rep who simply has
        // nothing late — drop whichever half is zero.
        var parts = [];
        if (g.late.length) parts.push(g.late.length + ' past due');
        if (g.atRisk.length) parts.push(g.atRisk.length + ' at risk');
        parts.push(esc(longDate(d.today)));

        // The window is NOT decoration. Upstream filters on the requested-ship date being
        // within `lookbackDays`, so the 8am 30-day default silently omits anything that
        // slipped more than 30 days ago — and two sheets printed from different windows are
        // otherwise identical on paper. Without this a rep reads their sheet as complete.
        var note = esc(d.lookbackDays) + '-day window &mdash; orders that slipped more than '
            + esc(d.lookbackDays) + ' days ago are not listed. Printed ' + esc(clockTime()) + '.';

        var banner = primary
            ? '<div class="pdo-ps-brand">Northwest Custom Apparel &middot; Past Due Orders</div>'
              + '<div class="pdo-ps-repname">' + esc(rep) + '</div>'
              + '<div class="pdo-ps-sub">' + parts.join(' &middot; ') + '</div>'
              + '<div class="pdo-ps-note">' + note + '</div>'
            : '<div class="pdo-ps-repname pdo-ps-repname--cont">' + esc(rep) + '</div>';

        var sorted = rows.slice().sort(function (a, b) { return a.daysUntilDue - b.daysUntilDue; });
        var total = sorted.reduce(function (sum, o) { return sum + (Number(o.subtotal) || 0); }, 0);

        // <colgroup>, not widths on the <th>. Under table-layout:fixed the browser takes
        // column widths from the FIRST ROW — which here is the colspan=8 banner, so any
        // width on the header cells is ignored and all 8 columns come out equal.
        var h = '<table class="pdo-ps-tbl">'
            + '<colgroup><col class="pdo-ps-w-wo"><col class="pdo-ps-w-cust">'
            + '<col class="pdo-ps-w-type"><col class="pdo-ps-w-date"><col class="pdo-ps-w-date">'
            + '<col class="pdo-ps-w-late"><col class="pdo-ps-w-val"><col class="pdo-ps-w-blank">'
            + '</colgroup><thead>'
            + '<tr class="pdo-ps-banner"><th colspan="8">' + banner + '</th></tr>'
            + '<tr class="pdo-ps-sect"><th colspan="8">' + esc(label)
            + '<span class="pdo-ps-sect-n">' + esc(countText) + '</span></th></tr>'
            + '<tr class="pdo-ps-cols">'
            + '<th>WO</th><th>Customer</th><th>Type</th><th>Placed</th>'
            + '<th>Due</th><th class="pdo-ps-c">Late</th>'
            + '<th class="pdo-ps-val">Value</th><th>Blanks</th>'
            + '</tr></thead><tbody>';

        sorted.forEach(function (o) {
            var late = o.daysUntilDue < 0;
            h += '<tr class="' + (late ? 'pdo-ps-late' : 'pdo-ps-risk') + '">'
                + '<td class="pdo-ps-wo">' + esc(o.idOrder) + '</td>'
                + '<td class="pdo-ps-cust">' + esc(o.company) + '</td>'
                + '<td>' + esc(o.orderType || '') + '</td>'
                + '<td class="pdo-ps-nowrap">' + esc(shortDate(o.placedDate)) + '</td>'
                + '<td class="pdo-ps-nowrap pdo-ps-due">' + esc(shortDate(o.dueDate)) + '</td>'
                + '<td class="pdo-ps-c">' + (late
                    ? '<span class="pdo-ps-badge">' + Math.abs(o.daysUntilDue) + 'd</span>'
                    : (o.daysUntilDue === 0 ? 'today' : 'in ' + o.daysUntilDue + 'd')) + '</td>'
                + '<td class="pdo-ps-val">' + money(o.subtotal) + '</td>'
                + '<td class="' + (o.blanks === 'none' ? 'pdo-ps-nopo' : '') + '">'
                + blanks(o.blanks) + vendorLine(o) + '</td>'
                + '</tr>';
        });

        h += '<tr class="pdo-ps-tot"><td colspan="6">Total &middot; ' + esc(countText) + '</td>'
            + '<td class="pdo-ps-val">' + (total ? money(total) : '') + '</td><td></td></tr>';
        return h + '</tbody></table>';
    }

    // Who to chase. Only meaningful once a PO exists — on a "no PO raised" row the job is
    // to raise one, and there is no vendor yet to name.
    function vendorLine(o) {
        if (o.blanks === 'none' || o.blanks === 'received') return '';
        var v = (o.vendors || []).filter(Boolean);
        if (!v.length) return '';
        return '<span class="pdo-ps-vendor">' + esc(v.join(', ')) + '</span>';
    }

    // 'YYYY-MM-DD' → '8/12/26'. Split by hand: new Date('2026-08-12') parses as UTC
    // midnight and prints as the 11th once the browser shifts it to Pacific.
    function shortDate(s) {
        var p = String(s || '').slice(0, 10).split('-');
        if (p.length !== 3 || !p[0]) return '';
        return Number(p[1]) + '/' + Number(p[2]) + '/' + p[0].slice(2);
    }

    // Wall-clock moment the paper was made. Deliberately the CLIENT clock, not the payload:
    // this answers "how old is the sheet in my hand", which is a printing fact, not a data one.
    function clockTime() {
        return new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    // d.today is the server's Pacific date — the same day stamp the board is computed
    // against, so the sheet is dated by the data rather than by the printer's clock.
    function longDate(s) {
        var p = String(s || '').slice(0, 10).split('-');
        if (p.length !== 3 || !p[0]) return '';
        return MONTHS[Number(p[1]) - 1] + ' ' + Number(p[2]) + ', ' + p[0];
    }

    // Rebuilt on every load so a rep who clears their list drops off the menu.
    function fillRepPicker(d) {
        var sel = document.getElementById('pdo-print-who');
        if (!sel) return;
        var reps = activeReps(d);
        var prev = sel.value;

        var opts = '<option value="">All rep sheets — one per page</option>';
        reps.forEach(function (r) {
            var g = d.byRep[r];
            var counts = [];
            if (g.late.length) counts.push(g.late.length + ' past due');
            if (g.atRisk.length) counts.push(g.atRisk.length + ' at risk');
            opts += '<option value="' + esc(r) + '">' + esc(r)
                + ' (' + esc(counts.join(' · ')) + ')</option>';
        });
        sel.innerHTML = opts;
        // Keep the rep the user had selected, unless they have nothing left to print.
        if (prev && reps.indexOf(prev) !== -1) sel.value = prev;

        setPrintEnabled(!!d && !!reps.length);
    }

    function setPrintEnabled(on) {
        var sel = document.getElementById('pdo-print-who');
        var btn = document.getElementById('pdo-print');
        if (sel) sel.disabled = !on;
        if (btn) btn.disabled = !on;
    }
})();
