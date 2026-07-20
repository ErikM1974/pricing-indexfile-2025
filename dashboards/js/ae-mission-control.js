/* ae-mission-control.js — AE Mission Control (per-AE cockpit) controller.
 *
 * Identity: GET /api/crm-session/me (greeting + admin detection only).
 * Data:     GET /api/crm-proxy/ae-dashboard/summary — ONE aggregate call; the
 *           server derives the rep from the SAML session (admin may ?viewAs=).
 * Actions:  kit request → /api/crm-proxy/marketing-shipments (POST)
 *           one-click outreach → /api/crm-proxy/lead-outreach (preview + send)
 *           SanMar inbound → window.openInboundTodayModal() (sanmar-inbound-today.js)
 *           art toasts → GET {API_BASE}/api/art-notifications polling (45s)
 *
 * Failures are always VISIBLE (per-panel error blocks + DashPage.showError) —
 * never a silently empty cockpit.
 */
(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';
    var POLL_INTERVAL_MS = 45000;

    // Session email → rep CRM page (mirrors the role gates in server.js).
    var ACCOUNTS_PAGE = {
        'taneisha@nwcustomapparel.com': '/dashboards/taneisha-crm.html',
        'nika@nwcustomapparel.com': '/dashboards/nika-crm.html',
    };
    // QuoteID prefix → builder (for "open in builder" on stale quotes).
    var PREFIX_BUILDER = {
        EMB: '/quote-builders/embroidery-quote-builder.html',
        EMBC: '/quote-builders/embroidery-quote-builder.html',
        CEMB: '/quote-builders/embroidery-quote-builder.html',
        SPC: '/quote-builders/screenprint-quote-builder.html',
        SSC: '/quote-builders/screenprint-quote-builder.html',
        DTF: '/quote-builders/dtf-quote-builder.html',
        DTG: '/quote-builders/dtg-quote-builder.html',
    };
    var OUTREACH_TEMPLATES = [
        { key: 'intro', label: 'Introduction', icon: 'fa-handshake' },
        { key: 'quote-followup', label: 'Quote follow-up', icon: 'fa-file-invoice-dollar' },
        { key: 'checking-in', label: 'Checking in', icon: 'fa-comment-dots' },
        { key: 'won-thanks', label: 'Thanks — welcome aboard', icon: 'fa-circle-check' },
    ];

    var state = {
        me: null,          // /api/crm-session/me payload
        isAdmin: false,
        viewAs: '',        // admin-only override email ('' = own)
        rep: null,         // summary.rep {email, fullName, firstName}
        summary: null,
        lastNotifTime: Number(sessionStorage.getItem('aemcNotifLastSeen')) || Date.now(),
    };

    // ---------- utils ----------
    function esc(v) {
        return String(v == null ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function money0(v) {
        if (v == null) return '—';
        return '$' + Math.round(Number(v) || 0).toLocaleString('en-US');
    }
    function money2(v) {
        return '$' + (Math.round((Number(v) || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtWhen(iso) {
        var s = String(iso == null ? '' : iso);
        var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T12:00:00' : s);
        if (isNaN(d.getTime())) return esc(s);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    function el(id) { return document.getElementById(id); }
    function sameOriginJson(path, options) {
        return fetch(path, options).then(function (resp) {
            return resp.json().catch(function () { return {}; }).then(function (body) {
                if (!resp.ok) throw new Error(body.error || body.message || ('HTTP ' + resp.status));
                return body;
            });
        });
    }
    function greetingWord() {
        var h = new Date().getHours();
        return h < 12 ? 'Good morning' : (h < 17 ? 'Good afternoon' : 'Good evening');
    }
    function leadLink(submissionId) {
        // #hash, never ?x= (query params get mangled in emailed links; house rule).
        return '/dashboards/lead.html#' + encodeURIComponent(submissionId);
    }
    function builderFor(quoteId) {
        var m = String(quoteId || '').match(/^([A-Z]+)/);
        return (m && PREFIX_BUILDER[m[1]]) || null;
    }

    // ---------- boot ----------
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        sameOriginJson('/api/crm-session/me').then(function (me) {
            if (!me.authenticated) {
                window.location.href = '/auth/saml/login?next=' + encodeURIComponent('/dashboards/ae-mission-control.html');
                return;
            }
            state.me = me;
            state.isAdmin = (me.permissions || []).indexOf('admin') !== -1;
            if (state.isAdmin) {
                el('aemc-viewas').hidden = false;
                // Default the admin view to Taneisha (admins have no cockpit of
                // their own unless they carry sales data).
                state.viewAs = 'taneisha@nwcustomapparel.com';
            }
            wireHeader();
            wireKitModal();
            loadSummary(false);
            loadInbound();
            pollArtNotifications();
            setInterval(pollArtNotifications, POLL_INTERVAL_MS);
        }).catch(function (err) {
            DashPage.showError('Could not confirm your login: ' + err.message);
        });
    }

    function wireHeader() {
        el('aemc-refresh').addEventListener('click', function () { loadSummary(true); });
        Array.prototype.forEach.call(document.querySelectorAll('.aemc-viewas-btn'), function (btn) {
            btn.addEventListener('click', function () {
                state.viewAs = btn.getAttribute('data-rep');
                loadSummary(false);
            });
        });
    }

    // ---------- summary ----------
    function summaryUrl(refresh) {
        var params = [];
        if (state.isAdmin && state.viewAs) params.push('viewAs=' + encodeURIComponent(state.viewAs));
        if (refresh) params.push('refresh=1');
        return '/api/crm-proxy/ae-dashboard/summary' + (params.length ? '?' + params.join('&') : '');
    }

    function loadSummary(refresh) {
        DashPage.hideError();
        el('aemc-greeting').textContent = 'Loading your day…';
        sameOriginJson(summaryUrl(refresh)).then(function (data) {
            state.summary = data;
            state.rep = data.rep;
            render(data);
            loadGrowth();
            loadPurchasing();
            loadDueDates();
            loadDataQuality();
        }).catch(function (err) {
            DashPage.showError('Could not load your dashboard: ' + err.message + ' — refresh to retry.');
            el('aemc-greeting').textContent = 'Your data could not be loaded.';
            ['aemc-queue', 'panel-leads', 'panel-quotes', 'panel-art', 'panel-orders'].forEach(function (id) {
                el(id).innerHTML = '<div class="aemc-panel-error">Not loaded — ' + esc(err.message) + '</div>';
            });
        });
    }

    function render(data) {
        var rep = data.rep || {};
        el('aemc-greeting').textContent = greetingWord() + ', ' + (rep.firstName || 'there') + ' — here’s your day.';
        var updatedBits = ['Updated ' + new Date(data.generatedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })];
        if (data.cacheHit) updatedBits.push('cached');
        if (data.kpis && data.kpis.salesAsOf) updatedBits.push('sales archived through ' + fmtWhen(data.kpis.salesAsOf));
        el('aemc-updated').textContent = updatedBits.join(' · ');

        // view-as pill active state
        if (state.isAdmin) {
            Array.prototype.forEach.call(document.querySelectorAll('.aemc-viewas-btn'), function (btn) {
                btn.classList.toggle('is-active', btn.getAttribute('data-rep') === (rep.email || ''));
            });
        }

        // "My Accounts" link only when a rep CRM page exists for this rep
        var acctLink = el('aemc-accounts-link');
        if (ACCOUNTS_PAGE[rep.email]) { acctLink.href = ACCOUNTS_PAGE[rep.email]; acctLink.hidden = false; }
        else acctLink.hidden = true;

        // "My Finished Photos" → library pre-filtered to this rep's accounts.
        // #hash, never ?x= (house rule); fullName matches Sales_Reps_2026.CustomerServiceRep.
        var photosLink = el('aemc-photos-link');
        if (photosLink) {
            photosLink.href = '/dashboards/finished-photos-library.html' +
                (rep.fullName ? '#rep=' + encodeURIComponent(rep.fullName) : '');
        }

        renderKpis(data);
        renderQueue(data);
        renderBonus(data);
        renderPanels(data);

        if (data.errors) {
            var failed = Object.keys(data.errors).join(', ');
            DashPage.showError('Some sections could not load (' + failed + '). The rest of the page is live — refresh to retry.');
        }
    }

    function renderKpis(data) {
        var k = data.kpis || {};
        el('kpi-ytd').textContent = money0(k.ytdSales);
        el('kpi-mtd').textContent = money0(k.mtdSales);
        el('kpi-quotes').textContent = (k.openQuoteCount == null) ? '—'
            : k.openQuoteCount + ' · ' + money0(k.openQuoteValue);
        el('kpi-quotes-label').textContent = 'Open Quotes (90d)';
        el('kpi-commission').textContent = money0(k.commissionQtd);
        el('kpi-commission-label').textContent = 'Bonus Earned' + (k.commissionQuarter ? ' (' + k.commissionQuarter + ')' : '');
        el('kpi-winrate').textContent = (k.leadWinRate == null) ? '—' : k.leadWinRate + '%';

        var badge = el('aemc-art-badge');
        var awaiting = data.counts && data.counts.art ? data.counts.art.awaitingApproval : 0;
        badge.hidden = !awaiting;
        badge.textContent = awaiting || '';
    }

    // ---------- action queue ----------
    function queueItem(cls, mainHtml, metaText, actionsHtml) {
        return '<li class="aemc-queue-item aemc-queue-item--' + cls + '">' + mainHtml +
            (metaText ? '<span class="aemc-queue-meta">' + esc(metaText) + '</span>' : '') +
            '<span class="aemc-queue-actions">' + (actionsHtml || '') + '</span></li>';
    }
    function leadQueueItem(cls, lead, metaText) {
        var actions = '<a class="aemc-mini-btn" href="' + leadLink(lead.submissionId) + '"><i class="fas fa-up-right-from-square"></i> Open</a>';
        if (lead.email) {
            actions += '<button type="button" class="aemc-mini-btn aemc-email-btn" data-lead="' + esc(JSON.stringify(lead)) + '"><i class="fas fa-envelope"></i> Email</button>';
        }
        var main = '<a class="aemc-queue-main" href="' + leadLink(lead.submissionId) + '">' +
            esc(lead.company || lead.contactName || '(no name)') + '</a>';
        return queueItem(cls, main, metaText, actions);
    }
    function section(title, itemsHtml) {
        if (!itemsHtml) return '';
        return '<div><h3 class="aemc-queue-section-title">' + title + '</h3><ul class="aemc-queue-list">' + itemsHtml + '</ul></div>';
    }

    function renderQueue(data) {
        var q = data.actionQueue || {};
        var total = 0;
        var html = '';

        var overdue = (q.overdueLeads || []).map(function (l) {
            return leadQueueItem('overdue', l, 'Follow-up was due ' + fmtWhen(l.dueDate) + (l.daysOverdue ? ' — ' + l.daysOverdue + 'd overdue' : ''));
        }).join('');
        total += (q.overdueLeads || []).length;
        html += section('🔴 Overdue follow-ups', overdue);

        var dueToday = (q.dueTodayLeads || []).map(function (l) {
            return leadQueueItem('today', l, 'Follow-up due today');
        }).join('');
        total += (q.dueTodayLeads || []).length;
        html += section('🟢 Due today', dueToday);

        var fresh = (q.newUntouchedLeads || []).map(function (l) {
            return leadQueueItem('new', l, 'New ' + fmtWhen(l.submittedAt) + ' — no follow-up set' + (l.leadValue ? ' · est. ' + money0(l.leadValue) : ''));
        }).join('');
        total += (q.newUntouchedLeads || []).length;
        html += section('🔵 New & untouched leads', fresh);

        var quotes = (q.staleQuotes || []).map(function (qt) {
            var builder = builderFor(qt.quoteId);
            var actions = builder
                ? '<a class="aemc-mini-btn" href="' + builder + '?duplicate=' + encodeURIComponent(qt.quoteId) + '"><i class="fas fa-copy"></i> Reopen</a>'
                : '<a class="aemc-mini-btn" href="/dashboards/quote-management.html"><i class="fas fa-up-right-from-square"></i> Find</a>';
            var main = '<span class="aemc-queue-main">' + esc(qt.quoteId) + ' — ' + esc(qt.companyName || qt.customerName || '') + '</span>';
            return queueItem('quote', main, money0(qt.totalAmount) + ' · quiet since ' + fmtWhen(qt.updatedAt || qt.createdAt), actions);
        }).join('');
        total += (q.staleQuotes || []).length;
        html += section('🟠 Quotes needing a follow-up', quotes);

        var art = (q.artAwaitingApproval || []).map(function (a) {
            var main = '<a class="aemc-queue-main" href="/dashboards/ae-dashboard.html">#' + esc(a.idDesign) + ' — ' + esc(a.companyName || '') + '</a>';
            return queueItem('art', main, 'Awaiting your approval' + (a.dueDate ? ' · due ' + fmtWhen(a.dueDate) : ''),
                '<a class="aemc-mini-btn" href="/dashboards/ae-dashboard.html"><i class="fas fa-eye"></i> Review</a>');
        }).join('');
        total += (q.artAwaitingApproval || []).length;
        html += section('🟣 Artwork awaiting your approval', art);

        var kits = (q.kitsPending || []).map(function (k) {
            var main = k.submissionId
                ? '<a class="aemc-queue-main" href="' + leadLink(k.submissionId) + '">' + esc(k.company || k.recipientName || k.shipmentId) + '</a>'
                : '<span class="aemc-queue-main">' + esc(k.company || k.recipientName || k.shipmentId) + '</span>';
            return queueItem('kit', main, k.shipmentId + ' · ' + k.status + ' since ' + fmtWhen(k.createdAt),
                '<a class="aemc-mini-btn" href="/dashboards/marketing-shipments.html"><i class="fas fa-truck"></i> Queue</a>');
        }).join('');
        // kits are informational (Mikalah's court) — not counted in "needs you"
        html += section('📦 Kits in Mikalah’s queue', kits);

        el('aemc-queue-count').textContent = total ? (total + ' item' + (total === 1 ? '' : 's') + ' need attention') : '';
        el('aemc-queue').innerHTML = html ||
            '<div class="aemc-queue-empty"><i class="fas fa-circle-check"></i>You’re all caught up — nothing needs you right now.</div>';

        Array.prototype.forEach.call(el('aemc-queue').querySelectorAll('.aemc-email-btn'), function (btn) {
            btn.addEventListener('click', function () {
                try { openOutreachModal(JSON.parse(btn.getAttribute('data-lead'))); }
                catch (e) { DashPage.showError('Could not open the email panel for this lead.'); }
            });
        });
    }

    // ---------- bonus & commission (Commission_Payouts = payroll of record) ----------
    var BONUS_DASHBOARD_BASE = 'https://inksoft-transform-8a3dc4e38097.herokuapp.com/commissions';
    var BONUS_DASHBOARD_PATH = {
        'taneisha@nwcustomapparel.com': '/taneisha',
        'nika@nwcustomapparel.com': '/nika',
    };

    function bonusRowsHtml(rows) {
        if (!rows.length) return '<div class="aemc-empty">No bonus rows recorded yet this quarter.</div>';
        return '<ul class="aemc-rows">' + rows.map(function (r) {
            var chipCls = r.status === 'Paid' ? ' aemc-status--paid' : ' aemc-status--pending';
            // Show the "on $base @ rate%" caption ONLY when it IS the math
            // (base × rate = amount, e.g. Win-Back). Online Store rows store
            // total revenue + a nominal 1% while the amount comes from composite
            // baseline/new-store math — captioning those invites reps to
            // multiply in their head and think they were shorted.
            var captionIsExact = r.base > 0 && r.rate > 0 && Math.abs(r.base * r.rate - r.amount) <= 0.02;
            return '<li class="aemc-row">' +
                '<span class="aemc-row-main">' + esc(r.type) + '</span>' +
                (captionIsExact ? '<span class="aemc-row-meta">on ' + money0(r.base) + ' @ ' + Math.round(r.rate * 1000) / 10 + '%</span>' : '') +
                '<span class="aemc-status' + chipCls + '">' + esc(r.status || '') + '</span>' +
                '<span class="aemc-row-right"><span class="aemc-money">' + money2(r.amount) + '</span></span>' +
                '</li>';
        }).join('') + '</ul>';
    }

    function renderBonus(data) {
        var b = data.bonus;
        var prevBox = el('aemc-bonus-prev'), curBox = el('aemc-bonus-cur');
        if (data.errors && data.errors.payouts) {
            prevBox.innerHTML = curBox.innerHTML =
                '<div class="aemc-panel-error">Bonus data failed to load (' + esc(data.errors.payouts) + '). Refresh to retry.</div>';
            return;
        }
        if (!b) { prevBox.innerHTML = curBox.innerHTML = '<div class="aemc-empty">No bonus data.</div>'; return; }

        // rep-specific link to the full Flask bonus dashboard
        var link = el('aemc-bonus-link');
        var rep = data.rep || {};
        link.href = BONUS_DASHBOARD_BASE + (BONUS_DASHBOARD_PATH[rep.email] || '');

        if (b.previousQuarter) {
            el('aemc-bonus-prev-title').textContent = b.previousQuarter + ' ' + b.year + ' payout';
            var when;
            if (b.previous.allPaid) {
                var pc = b.previous.rows[0] && (b.previous.rows[0].paycheckDate || b.previous.rows[0].paidDate);
                when = 'Paid' + (pc ? ' — paycheck ' + fmtWhen(pc) : '');
            } else if (b.previous.rows.length) {
                when = 'Pending payroll — lands on your next paycheck';
            } else {
                when = '';
            }
            prevBox.innerHTML =
                '<div class="aemc-bonus-total">' + money2(b.previous.total) + '</div>' +
                (when ? '<div class="aemc-bonus-when">' + esc(when) + '</div>' : '') +
                bonusRowsHtml(b.previous.rows);
        } else {
            el('aemc-bonus-prev-title').textContent = 'Last quarter payout';
            prevBox.innerHTML = '<div class="aemc-empty">First quarter of the year — no prior payout.</div>';
        }

        el('aemc-bonus-cur-title').textContent = b.currentQuarter + ' ' + b.year + ' earned so far';
        curBox.innerHTML =
            '<div class="aemc-bonus-total">' + money2(b.current.total) + '</div>' +
            '<div class="aemc-bonus-when">Accrues as orders invoice — refreshed daily</div>' +
            bonusRowsHtml(b.current.rows);

        el('aemc-bonus-foot').textContent = 'Paid so far in ' + b.year + ': ' +
            money2(b.paidYtd) + ' · Components: Online Store commission, Garment Spiffs, Win-Back Bounty (5%). Annual retention/growth/new-business bonuses are calculated in December.';
    }

    // ---------- work panels ----------
    function panelError(id, key, data) {
        if (data.errors && data.errors[key]) {
            el(id).innerHTML = '<div class="aemc-panel-error">This section failed to load (' + esc(data.errors[key]) + '). Refresh to retry.</div>';
            return true;
        }
        return false;
    }
    function rows(items, mapFn, emptyText) {
        if (!items || !items.length) return '<div class="aemc-empty">' + esc(emptyText) + '</div>';
        return '<ul class="aemc-rows">' + items.map(mapFn).join('') + '</ul>';
    }

    function renderPanels(data) {
        var p = data.panels || {};

        if (!panelError('panel-leads', 'leads', data)) {
            el('panel-leads').innerHTML = rows(p.leads, function (l) {
                return '<li class="aemc-row">' +
                    '<a class="aemc-row-main" href="' + leadLink(l.submissionId) + '">' + esc(l.company || l.contactName || '(no name)') + '</a>' +
                    '<span class="aemc-status">' + esc(l.status) + '</span>' +
                    '<span class="aemc-row-right">' + fmtWhen(l.submittedAt) + (l.leadValue ? ' · <span class="aemc-money">' + money0(l.leadValue) + '</span>' : '') + '</span>' +
                    '</li>';
            }, 'No active leads assigned to you.');
        }

        if (!panelError('panel-quotes', 'quotes', data)) {
            el('panel-quotes').innerHTML = rows(p.quotes, function (q) {
                var builder = builderFor(q.quoteId);
                var main = builder
                    ? '<a class="aemc-row-main" href="' + builder + '?duplicate=' + encodeURIComponent(q.quoteId) + '" title="Reopen in the builder">' + esc(q.quoteId) + '</a>'
                    : '<span class="aemc-row-main">' + esc(q.quoteId) + '</span>';
                return '<li class="aemc-row">' + main +
                    '<span class="aemc-row-meta">' + esc(q.companyName || q.customerName || '') + '</span>' +
                    '<span class="aemc-status">' + esc(q.status || '') + '</span>' +
                    '<span class="aemc-row-right"><span class="aemc-money">' + money0(q.totalAmount) + '</span> · ' + fmtWhen(q.createdAt) + '</span>' +
                    '</li>';
            }, 'No quotes with your name on them in the last 90 days. (Quotes count when you’re picked as sales rep in the builder.)');
        }

        if (!panelError('panel-art', 'art', data)) {
            el('panel-art').innerHTML = rows(p.art, function (a) {
                return '<li class="aemc-row">' +
                    '<a class="aemc-row-main" href="/dashboards/ae-dashboard.html">#' + esc(a.idDesign) + '</a>' +
                    '<span class="aemc-row-meta">' + esc(a.companyName || '') + '</span>' +
                    '<span class="aemc-status">' + esc(a.status || '') + '</span>' +
                    '<span class="aemc-row-right">' + (a.dueDate ? 'due ' + fmtWhen(a.dueDate) : fmtWhen(a.dateCreated)) + '</span>' +
                    '</li>';
            }, 'No open art requests under your name.');
        }

        if (!panelError('panel-orders', 'orders', data)) {
            var counts = data.counts && data.counts.orders;
            el('panel-orders-sub').textContent = counts
                ? '(' + counts.orders30 + ' invoiced in 30d · ' + money0(data.orders30Total) + ')' : '';
            el('panel-orders').innerHTML = rows(p.orders, function (o) {
                return '<li class="aemc-row">' +
                    '<span class="aemc-row-main">#' + esc(o.idOrder) + '</span>' +
                    '<span class="aemc-row-meta">' + esc(o.companyName || '') + '</span>' +
                    (o.shipped ? '<span class="aemc-status">Shipped</span>' : '') +
                    '<span class="aemc-row-right"><span class="aemc-money">' + money0(o.subtotal) + '</span> · ' + fmtWhen(o.invoicedDate) + '</span>' +
                    '</li>';
            }, 'No orders invoiced to your customers in the last 30 days.');
        }
    }

    // ---------- purchasing tracker (requests to Bradley × ShopWorks POs) ----------
    var PURCH_LABEL = {
        sent: 'Sent to Bradley', ordered: 'Ordered', partial: 'Partially received',
        received: 'Received', invoiced: 'Invoiced', shipped: 'Shipped',
    };

    function loadPurchasing() {
        var params = (state.isAdmin && state.viewAs) ? '?viewAs=' + encodeURIComponent(state.viewAs) : '';
        sameOriginJson('/api/crm-proxy/ae-dashboard/purchasing' + params).then(function (p) {
            var c = p.counts || {};
            var waiting = (c.sent || 0);
            el('aemc-purch-sub').textContent = p.submissionCount
                ? '(' + p.submissionCount + ' request' + (p.submissionCount === 1 ? '' : 's') + ' in ' + p.windowDays + 'd' + (waiting ? ' · ' + waiting + ' not yet ordered' : '') + ')'
                : '';
            if (!p.items || !p.items.length) {
                el('aemc-purch').innerHTML = '<div class="aemc-empty">No purchase requests sent to Bradley in the last ' + p.windowDays + ' days.</div>';
                return;
            }
            el('aemc-purch').innerHTML = '<ul class="aemc-rows">' + p.items.map(function (m) {
                return (m.orders || []).map(function (o) {
                    var meta = [];
                    if (o.orderedDate) meta.push('ordered ' + fmtWhen(o.orderedDate) + (o.vendors && o.vendors.length ? ' (' + o.vendors.join(', ') + ')' : ''));
                    if (o.receivedDate) meta.push('received ' + fmtWhen(o.receivedDate));
                    if (!o.orderedDate && m.submittedAt) meta.push('sent ' + fmtWhen(m.submittedAt));
                    if (m.bradleyPo) meta.push('PO# ' + m.bradleyPo);
                    return '<li class="aemc-row">' +
                        '<span class="aemc-row-main">WO #' + esc(o.orderNumber) + (o.company ? ' — ' + esc(o.company) : '') + '</span>' +
                        '<span class="aemc-purch-chip aemc-purch--' + esc(o.status) + '">' + esc(PURCH_LABEL[o.status] || o.status) + '</span>' +
                        '<span class="aemc-row-right"><span class="aemc-row-meta">' + esc(meta.join(' · ')) + '</span></span>' +
                        '</li>';
                }).join('');
            }).join('') + '</ul>' +
                (p.truncated ? '<p class="aemc-hint">…and ' + p.truncated + ' older request' + (p.truncated === 1 ? '' : 's') + ' in the form inbox.</p>' : '');
        }).catch(function (err) {
            el('aemc-purch').innerHTML = '<div class="aemc-panel-error">Purchasing tracker failed to load (' + esc(err.message) + '). Refresh to retry.</div>';
        });
    }

    // ---------- order due dates (unshipped orders vs requested-ship date × blanks POs) ----------
    var DUE_BLANKS_LABEL = {
        none: 'Blanks not purchased', ordered: 'Blanks ordered',
        partial: 'Partially received', received: 'Blanks received',
    };
    // blanks status → the purchasing chip class that carries the same meaning
    var DUE_BLANKS_CHIP = { none: 'sent', ordered: 'ordered', partial: 'partial', received: 'received' };

    function dueRow(o) {
        var flagText = o.flag === 'late'
            ? 'Late ' + Math.abs(o.daysUntilDue) + 'd'
            : (o.daysUntilDue === 0 ? 'Due TODAY' : 'Due in ' + o.daysUntilDue + 'd');
        var meta = ['due ' + fmtWhen(o.dueDate)];
        if (o.vendors && o.vendors.length) meta.push(o.vendors.join(', '));
        if (o.subtotal) meta.push(money0(o.subtotal));
        if (o.invoiced) meta.push('invoiced');
        return '<li class="aemc-row">' +
            '<span class="aemc-row-main">WO #' + esc(o.idOrder) + (o.company ? ' — ' + esc(o.company) : '') + '</span>' +
            '<span class="aemc-due-flag aemc-due-flag--' + (o.flag === 'late' ? 'late' : 'risk') + '">' + esc(flagText) + '</span>' +
            '<span class="aemc-purch-chip aemc-purch--' + esc(DUE_BLANKS_CHIP[o.blanks] || 'sent') + '">' + esc(DUE_BLANKS_LABEL[o.blanks] || o.blanks) + '</span>' +
            '<span class="aemc-row-right"><span class="aemc-row-meta">' + esc(meta.join(' · ')) + '</span></span>' +
            '</li>';
    }

    function loadDueDates() {
        var params = (state.isAdmin && state.viewAs) ? '?viewAs=' + encodeURIComponent(state.viewAs) : '';
        sameOriginJson('/api/crm-proxy/ae-dashboard/due-dates' + params).then(function (d) {
            var c = d.counts || {};
            var bits = [];
            if (c.late) bits.push(c.late + ' late');
            if (c.atRisk) bits.push(c.atRisk + ' at risk');
            el('aemc-due-sub').textContent = bits.length ? '(' + bits.join(' · ') + ')' : '';
            if (!(d.late || []).length && !(d.atRisk || []).length) {
                el('aemc-due').innerHTML = '<div class="aemc-empty">Nothing is late and nothing due in the next ' +
                    (d.dueSoonDays || 7) + ' days is waiting on blanks' +
                    (c.dueSoonOnTrack ? ' — ' + c.dueSoonOnTrack + ' order' + (c.dueSoonOnTrack === 1 ? '' : 's') + ' due soon already have goods in house' : '') + '.</div>';
                return;
            }
            var html = '';
            if ((d.late || []).length) {
                html += '<h3 class="aemc-queue-section-title">🔴 Past due — not shipped</h3><ul class="aemc-rows">' +
                    d.late.map(dueRow).join('') + '</ul>' +
                    (d.lateTruncated ? '<p class="aemc-hint">…and ' + d.lateTruncated + ' more past-due order' + (d.lateTruncated === 1 ? '' : 's') + '.</p>' : '');
            }
            if ((d.atRisk || []).length) {
                html += '<h3 class="aemc-queue-section-title">🟠 Due soon — blanks not in house</h3><ul class="aemc-rows">' +
                    d.atRisk.map(dueRow).join('') + '</ul>' +
                    (d.atRiskTruncated ? '<p class="aemc-hint">…and ' + d.atRiskTruncated + ' more at-risk order' + (d.atRiskTruncated === 1 ? '' : 's') + '.</p>' : '');
            }
            if (c.dueSoonOnTrack) {
                html += '<p class="aemc-hint">' + c.dueSoonOnTrack + ' other order' + (c.dueSoonOnTrack === 1 ? '' : 's') + ' due in the next ' +
                    (d.dueSoonDays || 7) + ' days already have blanks in house — on track.</p>';
            }
            el('aemc-due').innerHTML = html;
        }).catch(function (err) {
            el('aemc-due').innerHTML = '<div class="aemc-panel-error">Order due dates failed to load (' + esc(err.message) + '). Refresh to retry.</div>';
        });
    }

    // ---------- growth radar ("Money on the Table") ----------
    function loadGrowth() {
        var params = (state.isAdmin && state.viewAs) ? '?viewAs=' + encodeURIComponent(state.viewAs) : '';
        var acct = el('aemc-growth-accounts-link');
        if (state.rep && ACCOUNTS_PAGE[state.rep.email]) { acct.href = ACCOUNTS_PAGE[state.rep.email]; acct.hidden = false; }
        sameOriginJson('/api/crm-proxy/ae-dashboard/growth' + params).then(function (g) {
            el('aemc-growth-sub').textContent = g.flaggedCount
                ? '(' + g.flaggedCount + ' account' + (g.flaggedCount === 1 ? '' : 's') + ' · ~' + money0(g.potentialTotal) + ' in reach)'
                : '';
            if (!g.items || !g.items.length) {
                el('aemc-growth').innerHTML = '<div class="aemc-empty">Nothing overdue against its own rhythm right now — every active account is on schedule. Check back tomorrow.</div>';
                return;
            }
            el('aemc-growth').innerHTML = '<ul class="aemc-rows">' + g.items.map(function (it) {
                var chips = (it.reasons || []).map(function (r) {
                    return '<span class="aemc-growth-reason aemc-growth-reason--' + esc(r.type) + '">' + esc(r.text) + '</span>';
                }).join(' ');
                return '<li class="aemc-row">' +
                    '<span class="aemc-row-main">' + esc(it.company) + '</span>' +
                    chips +
                    '<span class="aemc-row-right"><span class="aemc-money aemc-growth-total">~' + money0(it.estValue) + '</span><br>' +
                    '<span class="aemc-row-meta">last order ' + fmtWhen(it.lastOrderDate) + ' · avg ' + money0(it.avgOrderValue) + '</span></span>' +
                    '</li>';
            }).join('') + '</ul>' +
                (g.truncated ? '<p class="aemc-hint">…and ' + g.truncated + ' more flagged — work these first, then refresh tomorrow.</p>' : '');
        }).catch(function (err) {
            el('aemc-growth').innerHTML = '<div class="aemc-panel-error">Growth radar failed to load (' + esc(err.message) + '). Refresh to retry.</div>';
        });
    }

    // ---------- data-quality radar (ShopWorks entries missing essentials) ----------
    function dqChips(issues) {
        return (issues || []).map(function (i) {
            return '<span class="aemc-dq-chip aemc-dq-chip--' + (i.severity === 'err' ? 'err' : 'warn') + '">' + esc(i.text) + '</span>';
        }).join(' ');
    }

    function loadDataQuality() {
        var params = (state.isAdmin && state.viewAs) ? '?viewAs=' + encodeURIComponent(state.viewAs) : '';
        sameOriginJson('/api/crm-proxy/ae-dashboard/data-quality' + params).then(function (d) {
            var c = d.counts || {};
            el('aemc-dq-sub').textContent = (c.ordersFlagged || c.customersFlagged)
                ? '(' + (c.ordersFlagged || 0) + ' order' + (c.ordersFlagged === 1 ? '' : 's') + ' · ' +
                  (c.customersFlagged || 0) + ' customer' + (c.customersFlagged === 1 ? '' : 's') + ' need attention)'
                : '';
            if (!(d.orders || []).length && !(d.customers || []).length) {
                el('aemc-dq').innerHTML = '<div class="aemc-empty">Clean sweep — every order you entered in the last ' +
                    (d.windowDays || 30) + ' days has contact, ship-to, terms, ship date, and tax filled in. Nice work.</div>';
                return;
            }
            var html = '';
            if ((d.orders || []).length) {
                html += '<h3 class="aemc-queue-section-title">Orders missing fields</h3><ul class="aemc-rows">' +
                    d.orders.map(function (o) {
                        var stage = o.shipped ? 'Shipped' : (o.invoiced ? 'Invoiced' : 'Open');
                        return '<li class="aemc-row">' +
                            '<span class="aemc-row-main">WO #' + esc(o.idOrder) + (o.company ? ' — ' + esc(o.company) : '') + '</span>' +
                            dqChips(o.issues) +
                            '<span class="aemc-row-right"><span class="aemc-row-meta">entered ' + fmtWhen(o.placedDate) + ' · ' + esc(stage) + '</span></span>' +
                            '</li>';
                    }).join('') + '</ul>' +
                    (d.ordersTruncated ? '<p class="aemc-hint">…and ' + d.ordersTruncated + ' more flagged order' + (d.ordersTruncated === 1 ? '' : 's') + '.</p>' : '');
            }
            if ((d.customers || []).length) {
                html += '<h3 class="aemc-queue-section-title">Customer records needing updates</h3><ul class="aemc-rows">' +
                    d.customers.map(function (cu) {
                        return '<li class="aemc-row">' +
                            '<span class="aemc-row-main">' + esc(cu.company) + '</span>' +
                            dqChips(cu.issues) +
                            '<span class="aemc-row-right"><span class="aemc-row-meta">Cust #' + esc(cu.idCustomer) + '</span></span>' +
                            '</li>';
                    }).join('') + '</ul>' +
                    (d.customersTruncated ? '<p class="aemc-hint">…and ' + d.customersTruncated + ' more customer' + (d.customersTruncated === 1 ? '' : 's') + '.</p>' : '');
            }
            el('aemc-dq').innerHTML = html;
        }).catch(function (err) {
            el('aemc-dq').innerHTML = '<div class="aemc-panel-error">Missing-info check failed to load (' + esc(err.message) + '). Refresh to retry.</div>';
        });
    }

    // ---------- SanMar inbound (company-wide fetch, rep rows highlighted) ----------
    function loadInbound() {
        el('aemc-inbound-open').addEventListener('click', function () {
            if (typeof window.openInboundTodayModal === 'function') window.openInboundTodayModal();
        });
        DashPage.fetchJson('/api/sanmar-orders/inbound-today').then(function (data) {
            var orders = (data.orders || []).filter(function (o) { return !o.received; });
            var mineName = state.rep && state.rep.fullName;
            var mine = mineName ? orders.filter(function (o) { return String(o.salesRep || '').trim() === mineName; }) : [];
            el('aemc-inbound-sub').textContent = orders.length
                ? '(' + orders.length + ' PO' + (orders.length === 1 ? '' : 's') + ' company-wide · ' + mine.length + ' yours)'
                : '';
            if (!orders.length) {
                el('aemc-inbound').innerHTML = '<div class="aemc-empty">No SanMar shipments due today.</div>';
                return;
            }
            if (!mine.length) {
                el('aemc-inbound').innerHTML = '<div class="aemc-empty">Nothing arriving today is tied to your customers. Use “Full view” for the whole building.</div>';
                return;
            }
            el('aemc-inbound').innerHTML = '<ul class="aemc-rows">' + mine.map(function (o) {
                return '<li class="aemc-row">' +
                    '<span class="aemc-row-main">PO ' + esc(o.sanmarPO || '') + '</span>' +
                    '<span class="aemc-row-meta">' + esc(o.company || '') + (o.workOrder ? ' · WO ' + esc(o.workOrder) : '') + '</span>' +
                    '<span class="aemc-row-right">' + (o.boxes ? o.boxes + ' boxes · ' : '') + (o.piecesShipped ? o.piecesShipped + ' pcs' : '') + '</span>' +
                    '</li>';
            }).join('') + '</ul>';
        }).catch(function (err) {
            el('aemc-inbound').innerHTML = '<div class="aemc-panel-error">Inbound lookup failed (' + esc(err.message) + ').</div>';
        });
    }

    // ---------- sample-kit modal ----------
    function kitFetch(path, options) {
        return sameOriginJson('/api/crm-proxy/marketing-shipments' + (path || ''), options);
    }

    function wireKitModal() {
        el('aemc-kit-btn').addEventListener('click', openKitModal);
        el('aemc-kit-close').addEventListener('click', closeKitModal);
        el('aemc-kit-overlay').addEventListener('click', closeKitModal);
        el('aemc-kit-send').addEventListener('click', sendKit);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { closeKitModal(); closeOutreachModal(); }
        });
    }
    function openKitModal() {
        el('aemc-kit-overlay').hidden = false;
        el('aemc-kit-modal').hidden = false;
        el('aemc-kit-status').textContent = '';
        var box = el('aemc-kit-items');
        box.innerHTML = '<span class="aemc-muted">Loading kit items…</span>';
        kitFetch('/items').then(function (body) {
            var items = body.items || [];
            if (!items.length) { box.innerHTML = '<span class="aemc-muted">No kit items configured. Add rows to Marketing_Kit_Items in Caspio.</span>'; return; }
            box.innerHTML = items.map(function (it) {
                return '<label class="aemc-kit-item">' +
                    '<input type="checkbox" class="aemc-kit-cb" data-code="' + esc(it.Item_Code) + '" data-label="' + esc(it.Label) + '">' +
                    '<span class="aemc-kit-item-label">' + esc(it.Label) + '</span>' +
                    '<input type="number" class="aemc-kit-qty" min="1" value="1" aria-label="Quantity">' +
                    '</label>';
            }).join('');
        }).catch(function (err) {
            box.innerHTML = '<span class="aemc-muted">Could not load kit items (' + esc(err.message) + ').</span>';
        });
    }
    function closeKitModal() {
        el('aemc-kit-overlay').hidden = true;
        el('aemc-kit-modal').hidden = true;
    }
    function sendKit() {
        var statusEl = el('aemc-kit-status');
        var picked = Array.prototype.slice.call(document.querySelectorAll('.aemc-kit-cb:checked')).map(function (cb) {
            var row = cb.closest('.aemc-kit-item');
            var qtyEl = row ? row.querySelector('.aemc-kit-qty') : null;
            return { code: cb.getAttribute('data-code'), label: cb.getAttribute('data-label'), qty: qtyEl ? Number(qtyEl.value) || 1 : 1 };
        });
        if (!picked.length) { statusEl.textContent = 'Pick at least one item.'; return; }
        var v = function (id) { return el(id).value.trim(); };
        if (!v('aemc-kit-addr1') || !v('aemc-kit-city') || !v('aemc-kit-state') || !v('aemc-kit-zip')) {
            statusEl.textContent = 'Street, city, state, and ZIP are required.';
            return;
        }
        if (!v('aemc-kit-recipient') && !v('aemc-kit-company')) {
            statusEl.textContent = 'Recipient name or company is required.';
            return;
        }
        var sendBtn = el('aemc-kit-send');
        sendBtn.disabled = true;
        statusEl.textContent = 'Sending…';
        kitFetch('', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                submissionId: '',
                salesRep: (state.rep && state.rep.fullName) || '',
                recipientName: v('aemc-kit-recipient'),
                company: v('aemc-kit-company'),
                address1: v('aemc-kit-addr1'),
                address2: v('aemc-kit-addr2'),
                city: v('aemc-kit-city'),
                state: v('aemc-kit-state'),
                zip: v('aemc-kit-zip'),
                phone: v('aemc-kit-phone'),
                email: v('aemc-kit-email'),
                notes: v('aemc-kit-notes'),
                items: picked,
            }),
        }).then(function (r) {
            statusEl.textContent = 'Sent to shipping — ' + (r.shipmentId || 'queued') + '. Mikalah has it.';
            sendBtn.disabled = false;
            setTimeout(closeKitModal, 2200);
            loadSummary(false); // pick up the new kit row in the queue section
        }).catch(function (err) {
            sendBtn.disabled = false;
            statusEl.textContent = '';
            DashPage.showError('Kit request NOT saved: ' + err.message);
        });
    }

    // ---------- outreach modal ----------
    function outreachFetch(payload) {
        return sameOriginJson('/api/crm-proxy/lead-outreach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }
    function outreachBody(lead, tpl, preview) {
        return {
            submissionId: lead.submissionId,
            template: tpl.key,
            preview: !!preview,
            lead: { contactName: lead.contactName || '', email: lead.email || '', company: lead.company || '' },
            aeName: (state.rep && state.rep.fullName) || 'Northwest Custom Apparel',
            aeEmail: (state.rep && state.rep.email) || '',
        };
    }
    function openOutreachModal(lead) {
        el('aemc-outreach-overlay').hidden = false;
        el('aemc-outreach-modal').hidden = false;
        el('aemc-outreach-lead').textContent = (lead.company || '') + ' — ' + (lead.contactName || '') + ' <' + lead.email + '>';
        el('aemc-outreach-preview').innerHTML = '';
        el('aemc-outreach-btns').innerHTML = OUTREACH_TEMPLATES.map(function (t, i) {
            return '<button type="button" class="dash-btn" data-tpl="' + i + '"><i class="fas ' + t.icon + '"></i> ' + t.label + '</button>';
        }).join('');
        Array.prototype.forEach.call(el('aemc-outreach-btns').querySelectorAll('[data-tpl]'), function (b) {
            b.addEventListener('click', function () {
                previewOutreach(lead, OUTREACH_TEMPLATES[parseInt(b.getAttribute('data-tpl'), 10)]);
            });
        });
        el('aemc-outreach-close').onclick = closeOutreachModal;
        el('aemc-outreach-overlay').onclick = closeOutreachModal;
    }
    function closeOutreachModal() {
        el('aemc-outreach-overlay').hidden = true;
        el('aemc-outreach-modal').hidden = true;
    }
    function previewOutreach(lead, tpl) {
        var box = el('aemc-outreach-preview');
        box.innerHTML = '<span class="aemc-muted">Building preview…</span>';
        outreachFetch(outreachBody(lead, tpl, true)).then(function (p) {
            box.innerHTML =
                '<div class="aemc-outreach-subject">' + esc(p.subject || '') + '</div>' +
                // bodyHtml is our server-side template output — lead values are
                // HTML-escaped in lead-outreach-templates.js (jest-locked).
                '<div class="aemc-outreach-body">' + (p.bodyHtml || '') + '</div>' +
                '<div class="aemc-modal-actions">' +
                '<button type="button" id="aemc-outreach-send" class="dash-btn dash-btn--primary"><i class="fas fa-paper-plane"></i> Send to ' + esc(lead.email) + '</button>' +
                '<span id="aemc-outreach-note" class="aemc-muted"></span>' +
                '</div>';
            el('aemc-outreach-send').addEventListener('click', function () {
                var btn = this;
                btn.disabled = true;
                el('aemc-outreach-note').textContent = 'Sending…';
                outreachFetch(outreachBody(lead, tpl, false)).then(function (r) {
                    box.innerHTML = '<div class="aemc-outreach-sent"><i class="fas fa-circle-check"></i> Sent “' +
                        esc(r.label || tpl.label) + '” to ' + esc(r.to || lead.email) + '</div>';
                }).catch(function (err) {
                    btn.disabled = false;
                    el('aemc-outreach-note').textContent = '';
                    var timedOut = err.name === 'AbortError' || /abort|timed?\s*out|timeout/i.test(err.message || '');
                    if (timedOut) {
                        DashPage.showError('The send timed out before the server confirmed — the email MAY have gone out. Check the lead’s timeline before resending so ' + lead.email + ' isn’t emailed twice.');
                    } else {
                        DashPage.showError('Email NOT sent: ' + err.message);
                    }
                });
            });
        }).catch(function (err) {
            box.innerHTML = '<span class="aemc-muted">Preview failed (' + esc(err.message) + ').</span>';
        });
    }

    // ---------- art notification toasts ----------
    function pollArtNotifications() {
        if (document.hidden || !API_BASE) return;
        fetch(API_BASE + '/api/art-notifications?since=' + state.lastNotifTime).then(function (resp) {
            if (!resp.ok) return null;
            return resp.json();
        }).then(function (data) {
            if (!data || !data.notifications || !data.notifications.length) return;
            data.notifications.forEach(showToast);
            state.lastNotifTime = data.serverTime || Date.now();
            sessionStorage.setItem('aemcNotifLastSeen', String(state.lastNotifTime));
        }).catch(function () { /* polling is best-effort; the badge re-syncs on refresh */ });
    }
    function showToast(n) {
        var host = document.querySelector('.aemc-toasts');
        if (!host) {
            host = document.createElement('div');
            host.className = 'aemc-toasts';
            document.body.appendChild(host);
        }
        var t = document.createElement('div');
        t.className = 'aemc-toast';
        t.textContent = n.message || ('Art update: ' + (n.type || 'notification'));
        host.appendChild(t);
        setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 8000);
    }
})();
