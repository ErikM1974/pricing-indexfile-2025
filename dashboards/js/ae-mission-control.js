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

        // --- tabs / motion ---
        tab: 'today',      // mirror of tabs.current(); DashTabs owns the truth
        reduceMotion: false,

        // --- The One Thing candidate pools, filled in by each loader as it resolves ---
        dueLate: null,
        almostThere: null,
        winBack: null,
        growthItems: null,

        // --- diff-line inputs (annotations on live values, never a stale substitute) ---
        bonusTotal: 0,
        queueCount: 0,
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
    // ONE query-string builder for every rep-scoped endpoint. Was copy-pasted six times,
    // which is how `refresh` came to be threaded through exactly one of them.
    // viewAs is only ever sent by an admin — the server ignores it otherwise, but there's no
    // reason to put another rep's email on a rep's own request.
    function qs(refresh) {
        var p = [];
        if (state.isAdmin && state.viewAs) p.push('viewAs=' + encodeURIComponent(state.viewAs));
        if (refresh) p.push('refresh=1');
        return p.length ? '?' + p.join('&') : '';
    }

    // ---------- request memo (one fetch, many consumers) ----------
    // Holds PROMISES, not payloads. Two cards fed by one endpoint share a single request,
    // and a rejection is shared too — so both render their own visible error rather than one
    // silently showing nothing. Deliberately NOT a payload cache: with no resolved value
    // retained there is no way for stale data to be painted as if it were fresh (Rule 4).
    // resetData() reassigns rather than mutating, so an in-flight request whose promise has
    // been dropped can still resolve harmlessly into the old object.
    var inflight = {};
    function dataOnce(key, fetcher) {
        if (!inflight[key]) inflight[key] = fetcher();
        return inflight[key];
    }
    function resetData() { inflight = {}; }
    function leadLink(submissionId) {
        // #hash, never ?x= (query params get mangled in emailed links; house rule).
        return '/dashboards/lead.html#' + encodeURIComponent(submissionId);
    }
    function builderFor(quoteId) {
        var m = String(quoteId || '').match(/^([A-Z]+)/);
        return (m && PREFIX_BUILDER[m[1]]) || null;
    }

    // ---------- progressive disclosure (keeps long cards short) ----------
    // Render every item, but collapse rows past `visible` behind a "Show N
    // more" toggle. renderItem(item, isHidden) must add the aemc-row--collapsed
    // class to its <li> when isHidden is true. One delegated handler (wired in
    // init) expands/collapses the list that precedes the clicked button.
    function expandableRows(items, renderItem, opts) {
        opts = opts || {};
        var visible = opts.visible || 5;
        var noun = opts.noun || 'row';
        var lis = items.map(function (it, i) { return renderItem(it, i >= visible); }).join('');
        var html = '<ul class="aemc-rows">' + lis + '</ul>';
        if (items.length > visible) {
            var more = items.length - visible;
            html += '<button type="button" class="aemc-more-toggle" aria-expanded="false" data-more="' + more +
                '" data-noun="' + esc(noun) + '"><i class="fas fa-chevron-down"></i> Show ' + more + ' more ' +
                esc(noun) + (more === 1 ? '' : 's') + '</button>';
        }
        return html;
    }

    function wireExpandToggles() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('.aemc-more-toggle');
            if (!btn) return;
            var ul = btn.previousElementSibling;
            while (ul && !(ul.classList && ul.classList.contains('aemc-rows'))) ul = ul.previousElementSibling;
            if (!ul) return;
            var expanded = ul.classList.toggle('is-expanded');
            btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            if (expanded) {
                btn.innerHTML = '<i class="fas fa-chevron-up"></i> Show less';
            } else {
                var n = btn.getAttribute('data-more'), noun = btn.getAttribute('data-noun') || 'row';
                btn.innerHTML = '<i class="fas fa-chevron-down"></i> Show ' + n + ' more ' + noun + (n === '1' ? '' : 's');
            }
        });
    }

    // ---------- whole-card collapse (declutter the page) ----------
    // Secondary cards marked .aemc-collapsible collapse to just their header
    // (title + summary count) on header click. State persists per-card in
    // localStorage so each rep keeps the layout they like. The action queue and
    // KPI zones are never collapsible.
    function wireCardCollapse() {
        var KEY = 'aemcCollapsed';
        var state_ = {};
        try { state_ = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { state_ = {}; }
        Array.prototype.forEach.call(document.querySelectorAll('.dash-card.aemc-collapsible'), function (card) {
            var header = card.querySelector(':scope > .dash-card-header');
            if (header && !header.querySelector('.aemc-collapse-caret')) {
                var caret = document.createElement('i');
                caret.className = 'fas fa-chevron-up aemc-collapse-caret';
                caret.setAttribute('aria-hidden', 'true');
                header.appendChild(caret);
            }
            var key = card.getAttribute('data-collapse-key');
            if (key && state_[key]) card.classList.add('is-collapsed');
        });
        document.addEventListener('click', function (e) {
            if (e.target.closest('a, button, input, select, textarea')) return; // let controls act
            var header = e.target.closest('.dash-card.aemc-collapsible > .dash-card-header');
            if (!header) return;
            var card = header.parentElement;
            var collapsed = card.classList.toggle('is-collapsed');
            var key = card.getAttribute('data-collapse-key');
            if (key) { state_[key] = collapsed; try { localStorage.setItem(KEY, JSON.stringify(state_)); } catch (e2) { /* private mode */ } }
        });
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
            // Read once. The count-up (rAF) and the confetti (canvas) are invisible to the
            // stylesheet's prefers-reduced-motion block, so they have to be gated in JS.
            state.reduceMotion = !!(window.matchMedia &&
                window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            if (state.isAdmin) {
                el('aemc-viewas').hidden = false;
                // Default the admin view to Taneisha (admins have no cockpit of
                // their own unless they carry sales data).
                state.viewAs = 'taneisha@nwcustomapparel.com';
            }
            wireHeader();
            wireKitModal();
            wireExpandToggles();
            migrateLayout();        // BEFORE wireCardCollapse — see the comment in there
            wireCardCollapse();
            wireBonusExplainer();
            wireCondensedSpine();
            initTabs();             // reads #tab=, switches visually, mounts nothing yet
            loadSummary(false);
            loadInbound();
            pollArtNotifications();
            setInterval(pollArtNotifications, POLL_INTERVAL_MS);
        }).catch(function (err) {
            DashPage.showError('Could not confirm your login: ' + err.message);
        });
    }

    // ---------- tabs ----------
    // Registry of function REFERENCES, so every loadX/renderX body below is untouched by the
    // move to tabs. `loaders` fetch on a tab's FIRST activation; `renderers` re-run from the
    // already-in-hand summary whenever it changes (rep switch, Refresh).
    //
    // Only Today's four loaders fire on boot. Before tabs the page fired nine requests up
    // front for sixteen cards and grew with every card added; now Money/My Book/Pipeline/Wins
    // cost nothing until opened. That also cuts concurrent pressure on the 15s global fetch
    // timeout from nine parallel Caspio-backed calls to five.
    var TABS = [
        {
            id: 'today',
            loaders: [loadDueDates, loadDataQuality, loadPurchasing],
            renderers: [renderQueue, renderOneThing],
        },
        {
            id: 'money',
            loaders: [loadEarnedAccounts, loadTargets],
            renderers: [renderBonus, renderMoneyKpis],
        },
        {
            id: 'book',
            loaders: [loadGrowth],
            renderers: [],
        },
        {
            id: 'pipeline',
            loaders: [],                       // 100% summary-fed — a genuinely free tab
            renderers: [renderPanels, renderPipelineKpis],
        },
        {
            id: 'wins',
            loaders: [loadPhotos],
            renderers: [renderRecords, renderWonBack],
        },
    ];
    // Painted regardless of which tab is open, because the spine is always on screen.
    var SPINE_LOADERS = [loadBonusHero];

    var tabs = null;

    function tabById(id) {
        for (var i = 0; i < TABS.length; i++) if (TABS[i].id === id) return TABS[i];
        return null;
    }

    function initTabs() {
        tabs = window.DashTabs.create({
            tablist: '#mc-tablist',
            tabSelector: '.mc-tab',
            hashKey: 'tab',
            defaultTab: 'today',
            activateDelay: 250,
            focusPanelOnDeepLink: true,
            onActivate: function (id, isFirst) {
                state.tab = id;
                if (isFirst) mountTab(id, false);
            },
        });
        if (!tabs) {                            // router failed to build — never a blank page
            DashPage.showError('The tab bar failed to initialise. Reload the page.');
            Array.prototype.forEach.call(document.querySelectorAll('.mc-panel'), function (p) { p.hidden = false; });
            return;
        }
        state.tab = tabs.current();
    }

    // Fire a tab's loaders, and re-run its renderers if the summary is already in hand.
    function mountTab(id, refresh) {
        var t = tabById(id);
        if (!t) return;
        t.loaders.forEach(function (fn) { fn(refresh); });
        if (state.summary) t.renderers.forEach(function (fn) { fn(state.summary); });
    }

    // Re-render every tab the rep has already opened. This one function is what makes rep
    // switching and Refresh correct without a special case per card: unopened tabs stay
    // unmounted and pick up the new data on their first activation.
    function renderMountedTabs(data) {
        TABS.forEach(function (t) {
            if (tabs && tabs.isMounted(t.id)) t.renderers.forEach(function (fn) { fn(data); });
        });
    }

    // Tabs replace whole-card collapse as the decluttering mechanism, so the five cards that
    // were only collapsible because the page was 3,400px tall lose the affordance (their
    // markup no longer carries .aemc-collapsible). Both reps have been collapsing cards since
    // 2026-07-20 though, and that state lives in their browsers — without this reset a rep who
    // collapsed six cards would open the new Today tab to a stack of empty headers and
    // reasonably conclude the redesign is broken. Idempotent, silent, runs once.
    function migrateLayout() {
        var LAYOUT_VERSION = '2';
        try {
            if (localStorage.getItem('aemcLayoutVersion') !== LAYOUT_VERSION) {
                localStorage.removeItem('aemcCollapsed');
                localStorage.setItem('aemcLayoutVersion', LAYOUT_VERSION);
            }
        } catch (e) { /* private mode — nothing to migrate */ }
    }

    function wireHeader() {
        el('aemc-refresh').addEventListener('click', refreshAll);
        Array.prototype.forEach.call(document.querySelectorAll('.aemc-viewas-btn'), function (btn) {
            btn.addEventListener('click', function () { switchRep(btn.getAttribute('data-rep')); });
        });
        // Wired ONCE, here, not inside loadInbound() — that function re-runs on every rep
        // switch and Refresh, and a listener added there stacks up silently.
        var inboundBtn = el('aemc-inbound-open');
        if (inboundBtn) {
            inboundBtn.addEventListener('click', function () {
                if (typeof window.openInboundTodayModal === 'function') window.openInboundTodayModal();
            });
        }
    }

    // Admin view-as. ONE entry point, because the previous version set state.viewAs and
    // called loadSummary() — which re-ran the six summary-driven loaders but NOT
    // loadInbound(), so the SanMar card kept showing the previous rep's rows under the new
    // rep's name until a full page reload. Dropping every memo means anything rep-scoped
    // refetches, whether or not it hangs off the summary.
    function switchRep(email) {
        if (!email || email === state.viewAs) return;
        state.viewAs = email;
        resetData();
        loadSummary(false);
        loadInbound();
    }

    // Refresh has to mean refresh. It used to send ?refresh=1 to the summary only, so the
    // other six cards re-rendered from server cache and the button looked like it worked.
    // Now: drop every memo (including rejected ones, so a failed card gets a real retry),
    // then re-request everything with the bypass. The summary endpoint throttles refresh
    // server-side at 30s, so the button stays disabled a beat past resolve — otherwise an
    // instant re-enable invites a second click that provably does nothing.
    function refreshAll() {
        var btn = el('aemc-refresh');
        var icon = btn.querySelector('i');
        btn.disabled = true;
        if (icon) icon.classList.add('fa-spin');
        DashPage.hideError();
        resetData();
        var done = function () {
            setTimeout(function () {
                btn.disabled = false;
                if (icon) icon.classList.remove('fa-spin');
            }, 2500);
        };
        Promise.all([
            loadSummary(true).catch(function () { /* loadSummary renders its own error */ }),
            loadInbound().catch(function () { /* card renders its own error */ }),
        ]).then(done, done);
    }

    // ---------- summary ----------
    // Returns its promise so refreshAll() can track completion for the button state.
    function loadSummary(refresh) {
        DashPage.hideError();
        el('aemc-greeting').textContent = 'Loading your day…';
        return sameOriginJson('/api/crm-proxy/ae-dashboard/summary' + qs(refresh)).then(function (data) {
            state.summary = data;
            state.rep = data.rep;
            render(data);
            // The spine is always on screen, so its loader always runs. Everything else is
            // per-tab: the active tab mounts now, the rest on first open. `refresh` threads
            // all the way into each request — before, only the summary got the bypass.
            SPINE_LOADERS.forEach(function (fn) { fn(refresh); });
            mountTab(state.tab, refresh);
            if (refresh) {
                // An explicit Refresh must not leave an already-opened tab on old data, so
                // drop the mount flags: each reloads with the bypass on its next activation.
                if (tabs) tabs.resetMounted();
            }
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
        // Read the diff baseline BEFORE overwriting it, and only once per rep resolution.
        if (state.lastSeen === undefined || state.lastSeenFor !== rep.email) {
            state.lastSeen = readLastSeen();
            state.lastSeenFor = rep.email;
        }
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
        renderTabBadges(data);
        renderMountedTabs(data);        // only tabs the rep has actually opened

        if (data.errors) {
            var failed = Object.keys(data.errors).join(', ');
            DashPage.showError('Some sections could not load (' + failed + '). The rest of the page is live — refresh to retry.');
        }

        // Written only on SUCCESS, never in a catch: the baseline must always describe a state
        // the rep actually saw, or tomorrow's diff is measured against a page that never loaded.
        writeLastSeen(data);
    }

    // Spine KPIs only. The quotes/win-rate tiles moved to Pipeline and the commission tile to
    // Money, each rendered by that tab's own renderer, so nothing here touches a hidden panel.
    function renderKpis(data) {
        var k = data.kpis || {};
        el('kpi-ytd').textContent = money0(k.ytdSales);
        el('kpi-mtd').textContent = money0(k.mtdSales);
        renderTrend(data.trend, data);

        var badge = el('aemc-art-badge');
        var awaiting = data.counts && data.counts.art ? data.counts.art.awaitingApproval : 0;
        badge.hidden = !awaiting;
        badge.textContent = awaiting || '';
    }

    function renderPipelineKpis(data) {
        var k = data.kpis || {};
        el('kpi-quotes').textContent = (k.openQuoteCount == null) ? '—'
            : k.openQuoteCount + ' · ' + money0(k.openQuoteValue);
        el('kpi-quotes-label').textContent = 'Open Quotes (90d)';
        el('kpi-winrate').textContent = (k.leadWinRate == null) ? '—' : k.leadWinRate + '%';

        // Quote → order conversion. ⚠️ In production today BOTH reps get attributed:0,
        // because Quote_Sessions holds 8 rows for all of 2026 and only one carries a
        // SalesRepEmail. Rather than print a meaningless "0%", say what's actually true —
        // a tile reading 0 with no explanation is how a page loses a rep's trust.
        var c = data.quoteConversion;
        var conv = el('mc-conv'), note = el('mc-conv-note');
        var convTile = conv ? conv.closest('.dash-stat-card') : null;
        if (convTile) convTile.hidden = false;
        if (!c) {
            if (sourceFailed(data, 'quotes')) {
                conv.textContent = '—';
                note.textContent = 'Quote figures could not be loaded this time.';
            } else {
                // Field absent = proxy half not deployed yet. Not a failure; don't claim one.
                if (convTile) convTile.hidden = true;
                note.textContent = '';
            }
        } else if (!c.attributed) {
            conv.textContent = '—';
            note.textContent = 'No quotes from the last ' + c.windowDays + ' days carry your name yet, ' +
                'so there is nothing to measure. Pick yourself as the rep when you build a quote and ' +
                'this starts tracking.';
        } else {
            conv.textContent = c.ratePct + '%';
            el('mc-conv-label').textContent = 'Quote → Order (' + c.windowDays + 'd)';
            note.textContent = c.pushed + ' of ' + c.attributed + ' quotes with your name on them became orders (' +
                money0(c.pushedValue) + ' of ' + money0(c.quotedValue) + ')' +
                (c.staleCount ? ' · ' + c.staleCount + ' sitting quiet, worth ' + money0(c.staleValue) : '') + '.';
        }
    }

    // The commission tile lives in the Money panel, so it must be written by MONEY's renderer.
    // It was briefly in renderPipelineKpis, which meant the tile sat at "—" until the rep
    // happened to open Pipeline — a renderer must only ever touch its own panel.
    function renderMoneyKpis(data) {
        // Shows PAID-year-to-date, not quarter-to-date-earned. The hero owns "earned this
        // quarter" and computes it live from orders, while this comes from the
        // Commission_Payouts ledger that the sync refreshes once a day. Labelling both "Bonus
        // Earned" put $300 and $0 on one screen (2026-07-25) — two numbers for one thing.
        // Paid-YTD is genuinely different information and can never contradict it.
        el('kpi-commission').textContent = money0((data.bonus && data.bonus.paidYtd) || 0);
        el('kpi-commission-label').textContent = 'Bonus Paid YTD';
    }

    // Only Today gets a count. A "12" on Money (12 target accounts) reads as twelve problems,
    // and five badged tabs read as five inboxes — the opposite of what this redesign is for.
    // Other tabs get a dot, and only for something genuinely wrong.
    function renderTabBadges(data) {
        if (!tabs) return;
        var q = data.actionQueue || {};
        var n = ['overdueLeads', 'dueTodayLeads', 'newUntouchedLeads', 'staleQuotes', 'artAwaitingApproval', 'kitsPending']
            .reduce(function (sum, k) { return sum + ((q[k] || []).length); }, 0);
        tabs.setBadge('today', n || null);
    }

    // ---------- motion helpers ----------
    // CSS @media can't reach a requestAnimationFrame counter or a canvas confetti, so the
    // preference is read once here and honored in JS as well as in the stylesheet.
    function countUp(node, to, fmt) {
        if (!node) return;
        var paint = function (v) { node.textContent = fmt(v); };

        // TRUTH FIRST, ALWAYS. requestAnimationFrame is throttled to ZERO in a background
        // tab, so animating from a placeholder left the hero reading "$0" indefinitely for
        // anyone who middle-clicked the page open from the staff dashboard or restored a
        // multi-tab session — a rep seeing $0 for her bonus is exactly the wrong-number
        // failure this codebase refuses to ship. Paint the real value before deciding whether
        // to decorate it, and a frozen rAF can only ever cost the animation, never the number.
        paint(to || 0);
        if (state.reduceMotion || document.hidden || !to || to < 0) return;

        var from = 0, dur = 650, t0 = null;
        var step = function (ts) {
            if (t0 === null) t0 = ts;
            var p = Math.min((ts - t0) / dur, 1);
            var eased = 1 - Math.pow(1 - p, 3);              // ease-out cubic
            paint(from + (to - from) * eased);
            if (p < 1) requestAnimationFrame(step); else paint(to);
        };
        requestAnimationFrame(step);
    }

    // ES5 port of the v3 dashboard's sparklineSvg (an ESM export this classic script can't
    // import). reduce() instead of Math.min(...values) — also avoids spreading a 90-item array.
    // aria-hidden because the adjacent text carries the meaning; a sparkline never stands alone.
    function sparkSvg(values, opts) {
        opts = opts || {};
        var w = opts.width || 132, h = opts.height || 26;
        if (!values || values.length < 2) return '';
        var min = values.reduce(function (a, b) { return b < a ? b : a; }, values[0]);
        var max = values.reduce(function (a, b) { return b > a ? b : a; }, values[0]);
        var range = (max - min) || 1;
        var stepX = w / (values.length - 1);
        var pts = values.map(function (v, i) {
            return (i * stepX).toFixed(1) + ',' + (h - ((v - min) / range) * h).toFixed(1);
        }).join(' ');
        return '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h +
            '" aria-hidden="true" focusable="false"><polyline points="' + pts +
            '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" ' +
            'stroke-linejoin="round"/></svg>';
    }

    // The two repos deploy independently, so the frontend can be live against a proxy that
    // doesn't return `trend`/`quoteConversion` yet. Distinguish the two cases: a source that
    // FAILED is named in `errors` and must be reported (Rule 4); a field that is simply ABSENT
    // means the backend half hasn't shipped, which is not a failure and must not be dressed up
    // as one — hide the element and let it light up on its own when the proxy lands.
    function sourceFailed(data, key) {
        return !!(data && data.errors && data.errors[key]);
    }

    // ---------- spine: trend, streak, condensed bar ----------
    function renderTrend(trend, data) {
        var spark = el('mc-spark'), streak = el('mc-streak'), label = el('mc-streak-label'), note = el('mc-mtd-note');
        var tile = streak ? streak.closest('.mc-kpi') : null;
        if (!trend) {
            if (spark) spark.innerHTML = '';
            if (sourceFailed(data, 'sales')) {
                if (tile) tile.hidden = false;
                if (streak) streak.textContent = '—';
                if (label) label.textContent = 'Order streak unavailable';
            } else {
                if (tile) tile.hidden = true;      // capability not deployed yet, not an error
            }
            return;
        }
        if (tile) tile.hidden = false;
        // Last 30 days of the 90-day series — enough to read a shape, short enough that a
        // single big day doesn't flatten everything else.
        var last30 = trend.dailySeries.slice(-30).map(function (d) { return d.r; });
        if (spark) spark.innerHTML = sparkSvg(last30);
        if (note) {
            var sum30 = last30.reduce(function (a, b) { return a + b; }, 0);
            note.textContent = '· ' + money0(sum30) + ' last 30d';
        }
        var s = trend.streak || {};
        if (streak) {
            streak.textContent = s.currentDays ? s.currentDays + (s.currentDays >= 5 ? ' 🔥' : '') : '0';
            streak.classList.toggle('mc-streak--hot', s.currentDays >= 5);
        }
        if (label) {
            label.textContent = s.currentDays
                ? 'Days in a row with an order' + (s.bestDays ? ' · best ' + s.bestDays : '')
                : 'No streak yet · best ' + (s.bestDays || 0);
        }
    }

    // Full hero (~220px) stays in flow; this 48px bar takes over once it scrolls off, so the
    // bonus is always on screen without permanently costing a quarter of the viewport.
    function renderCondensed(mine) {
        var l = (mine && mine.ladder) || {};
        var rungs = l.rungs || [];
        var top = rungs.length ? rungs[rungs.length - 1] : null;
        var amount = el('mc-condensed-amount'), next = el('mc-condensed-next'), fill = el('mc-condensed-fill');
        if (amount) amount.textContent = money2(mine.totalBonus) + ' Q3 bonus';
        if (next) {
            next.textContent = l.nextRung
                ? money0(l.amountToNextRung) + ' more → ' + money2(l.nextRung.pay)
                : 'every rung cleared';
        }
        if (fill && top && top.threshold) {
            fill.style.width = Math.max(0, Math.min((l.revenue / top.threshold) * 100, 100)).toFixed(1) + '%';
        }
    }

    function wireCondensedSpine() {
        var spine = el('mc-spine'), bar = el('mc-condensed');
        if (!spine || !bar || !('IntersectionObserver' in window)) return;   // graceful: bar stays hidden
        new IntersectionObserver(function (entries) {
            bar.hidden = entries[0].isIntersecting;
        }, { rootMargin: '-56px 0px 0px 0px', threshold: 0 }).observe(spine);
    }

    // ---------- "since you last looked" ----------
    // A diff ANNOTATION on live values — never a cached substitute for them. Every number the
    // page shows comes from this load's fetch; the snapshot only supplies the comparison point,
    // and if the fetch failed no diff is shown at all (a delta against an unknown present is
    // a lie). Rep-keyed, and never written while an admin is viewing as someone else.
    function lastSeenKey() {
        return 'aemcLastSeen:' + ((state.rep && state.rep.email) || 'unknown');
    }
    function readLastSeen() {
        try { return JSON.parse(localStorage.getItem(lastSeenKey()) || 'null'); } catch (e) { return null; }
    }
    function writeLastSeen(data) {
        if (state.isAdmin && state.viewAs) return;      // read-only view-as: don't move her baseline
        var k = data.kpis || {};
        try {
            localStorage.setItem(lastSeenKey(), JSON.stringify({
                at: new Date().toISOString(),
                ytdSales: k.ytdSales,
                bonusTotal: state.bonusTotal || 0,
                queueCount: state.queueCount || 0,
            }));
        } catch (e) { /* private mode */ }
    }
    function renderDiff(data, prev) {
        var host = el('mc-diff');
        if (!host || !prev || !prev.at) return;
        var when = new Date(prev.at);
        var hoursAgo = (Date.now() - when.getTime()) / 3600000;
        if (isNaN(hoursAgo) || hoursAgo < 6) return;    // same session — nothing interesting to say
        var bits = [];
        var k = data.kpis || {};
        var dSales = (k.ytdSales || 0) - (prev.ytdSales || 0);
        if (dSales > 0.5) bits.push('<span class="mc-diff-up">+' + money0(dSales) + '</span> invoiced');
        var dBonus = (state.bonusTotal || 0) - (prev.bonusTotal || 0);
        if (dBonus > 0.005) bits.push('<span class="mc-diff-up">+' + money2(dBonus) + '</span> bonus');
        if (!bits.length) return;
        var label = hoursAgo < 36 ? 'yesterday'
            : when.toLocaleDateString('en-US', { weekday: 'long' });
        host.innerHTML = '<span class="mc-diff-since">Since you last looked (' + esc(label) + '):</span> ' +
            bits.join(' · ');
        host.hidden = false;
    }

    // ---------- celebrations ----------
    // Keys derive from SERVER data, never a client counter, so clearing storage can't re-fire a
    // celebration for something that already happened weeks ago.
    function celebratedKey() {
        return 'aemcCelebrated:' + ((state.rep && state.rep.email) || 'unknown');
    }
    function readCelebrated() {
        try { return JSON.parse(localStorage.getItem(celebratedKey()) || '{}') || {}; } catch (e) { return {}; }
    }
    function considerCelebration(mine) {
        if (state.isAdmin && state.viewAs) return;      // never consume her moment from an admin view
        var l = mine.ladder || {};
        var acc = mine.accounts || {};
        var quarter = 'q' + (mine.quarter || '3') + '-' + (mine.year || new Date().getFullYear());
        var keys = [];
        if (l.rungReached) keys.push(quarter + ':rung-' + l.rungReached.threshold);
        (acc.reactivated || []).forEach(function (a) { keys.push(quarter + ':wonback-' + a.idCustomer); });
        (acc['new'] || []).forEach(function (a) { keys.push(quarter + ':newprogram-' + a.idCustomer); });

        var seen = readCelebrated();
        // FIRST SIGHT SEEDS, IT DOES NOT FIRE. Without this, ship day is a confetti storm for
        // three-week-old news, which teaches the rep to ignore confetti permanently.
        var seeded = seen.__seeded;
        var fresh = keys.filter(function (k) { return !seen[k]; });
        keys.forEach(function (k) { seen[k] = 1; });
        seen.__seeded = 1;
        try { localStorage.setItem(celebratedKey(), JSON.stringify(seen)); } catch (e) { return; }
        if (!seeded || !fresh.length) return;

        // One fire per load, and always with a line saying WHAT happened — confetti with no
        // explanation is just noise.
        var first = fresh[0];
        var msg = first.indexOf(':rung-') !== -1
            ? 'New rung cleared — ' + money2((l.rungReached && l.rungReached.pay) || 0) + ' locked in.'
            : (first.indexOf(':wonback-') !== -1 ? 'You won an account back. Bounty earned.'
                                                 : 'First embroidery program on a new account. Nice.');
        showToast('🎉 ' + msg);
        if (!state.reduceMotion && window.NWCAConfetti && typeof window.NWCAConfetti.fire === 'function') {
            window.NWCAConfetti.fire();
        }
    }

    // ---------- team kicker (Money) ----------
    // Legitimately shared compensation, and the one comparative element on the page: the
    // company total and the tiers, never a per-rep figure. Nika at $842K next to Taneisha at
    // $521K on an 857-account book with half the embroidery would read as a verdict on effort
    // rather than on book composition, so there is no rep-vs-rep ranking anywhere.
    // Takes the resolved top-level teamKicker object, not the rep.
    function renderKicker(k) {
        var host = el('mc-kicker'), card = el('mc-kicker-card');
        var tiers = (k && k.tiers) || [];
        if (!host || !card || !tiers.length) return;
        var target = (k.next && k.next.target) || tiers[tiers.length - 1].target;
        var revenue = k.companyRevenue != null ? k.companyRevenue
            : (target && k.amountToNext != null ? target - k.amountToNext : null);
        if (revenue == null) return;
        var pct = target ? Math.max(0, Math.min((revenue / target) * 100, 100)) : 0;
        host.innerHTML =
            '<p class="mc-kicker-line"><strong>' + money0(revenue) + '</strong> of ' + money0(target) +
                ' company-wide this quarter · ' + pct.toFixed(0) + '%</p>' +
            '<span class="mc-kicker-track"><span class="mc-kicker-fill" style="width:' + pct.toFixed(1) + '%"></span></span>' +
            (k.next
                ? '<p class="mc-kicker-line">' + money0(k.amountToNext) + ' to go → <strong>' +
                  money2(k.next.pay) + ' each</strong></p>'
                : '<p class="mc-kicker-line">Every kicker tier cleared. Remarkable quarter.</p>') +
            '<div class="mc-kicker-tiers">' + tiers.map(function (t) {
                return '<span class="mc-kicker-tier' + (revenue >= t.target ? ' is-hit' : '') + '">' +
                    money0(t.target) + ' → ' + money2(t.pay) + ' each</span>';
            }).join('') + '</div>';
        card.hidden = false;
    }

    // ---------- Wins ----------
    function renderRecords(data) {
        var host = el('mc-records'), sub = el('mc-records-sub');
        if (!host) return;
        var t = data.trend;
        var card = host.closest('.dash-card');
        if (card) card.hidden = false;
        if (!t) {
            if (sourceFailed(data, 'sales')) {
                host.innerHTML = '<div class="aemc-panel-error">Your sales history could not be loaded, ' +
                    'so records are unavailable. Refresh to retry.</div>';
            } else if (card) {
                // The daily-trend payload ships with the proxy half of this feature. Until that
                // deploys the field is simply absent — hide the card rather than report a
                // failure that hasn't happened. It appears by itself once the backend lands.
                card.hidden = true;
            }
            return;
        }
        var r = t.records || {};
        // NEVER "all-time": NW_Daily_Sales_By_Rep starts 2026-01-05 and holds no 2025 rows, so
        // the honest claim is "since the archive began". Overstating it once costs the page its
        // credibility for good.
        if (sub) sub.textContent = '(since the daily archive began ' + fmtWhen(t.archiveStartsAt) + ')';
        var cards = [];
        if (r.bestMonth) cards.push({ v: money0(r.bestMonth.r), l: 'Best month', w: monthLabel(r.bestMonth.m) });
        if (r.bestWeek) cards.push({ v: money0(r.bestWeek.r), l: 'Best week', w: 'week of ' + fmtWhen(r.bestWeek.weekStart) });
        if (r.bestDay) cards.push({ v: money0(r.bestDay.r), l: 'Best single day', w: fmtWhen(r.bestDay.d) });
        var s = t.streak || {};
        if (s.bestDays) cards.push({ v: String(s.bestDays), l: 'Longest order streak', w: s.currentDays + ' right now' });
        if (!cards.length) {
            host.innerHTML = '<div class="aemc-empty">No records yet — they appear once the archive has a few weeks of your orders.</div>';
            return;
        }
        host.innerHTML = '<div class="mc-records">' + cards.map(function (c) {
            return '<div class="mc-record"><div class="mc-record-value">' + esc(c.v) + '</div>' +
                '<div class="mc-record-label">' + esc(c.l) + '</div>' +
                '<div class="mc-record-when">' + esc(c.w) + '</div></div>';
        }).join('') + '</div>' +
        '<p class="aemc-hint">Figures are as of ' + fmtWhen(t.asOf) + ', when the nightly sales archive last ran.</p>';
    }

    function monthLabel(m) {
        var d = new Date(String(m) + '-15T12:00:00');
        return isNaN(d.getTime()) ? String(m) : d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }

    // Reuses the memoized 'emb' payload the hero already fetched — zero extra requests.
    function renderWonBack() {
        var host = el('mc-wonback'), sub = el('mc-wonback-sub');
        if (!host) return;
        dataOnce('emb', function () { return fetchEmb(false); }).then(function (r) {
            var mine = r && r.mine;
            var acc = (mine && mine.accounts) || {};
            var rows = (acc.reactivated || []).map(function (a) { return { a: a, kind: 'Won back', icon: '↩️' }; })
                .concat((acc['new'] || []).map(function (a) { return { a: a, kind: 'First program', icon: '✨' }; }));
            if (sub) sub.textContent = rows.length ? '(' + rows.length + ')' : '';
            if (!rows.length) {
                host.innerHTML = '<div class="aemc-empty">Nothing here yet this quarter. The moment an account ' +
                    'you won back crosses the quarter minimum it shows up here — check <strong>Money → Where the ' +
                    'money is</strong> for who is closest.</div>';
                return;
            }
            rows.sort(function (x, y) { return y.a.revenue - x.a.revenue; });
            host.innerHTML = '<ul class="aemc-rows">' + rows.map(function (x) {
                return '<li class="aemc-row"><span class="aemc-row-main">' + x.icon + ' ' + esc(x.a.company) + '</span>' +
                    '<span class="aemc-growth-reason">' + esc(x.kind) + '</span>' +
                    '<span class="aemc-row-right"><span class="aemc-money">' + money2(x.a.bounty) + '</span><br>' +
                    '<span class="aemc-row-meta">' + money0(x.a.revenue) + ' embroidery this quarter</span></span></li>';
            }).join('') + '</ul>';
        }).catch(function (err) {
            host.innerHTML = '<div class="aemc-panel-error">Could not load your wins (' + esc(err.message) + '). Refresh to retry.</div>';
        });
    }

    // Her own finished-product photos. Endpoint was already live and whitelisted server-side
    // and had no consumer at all — the comment in server.js literally said it fed a Mission
    // Control view that didn't exist yet.
    function loadPhotos() {
        var host = el('mc-photos'), sub = el('mc-photos-sub');
        if (!host) return;
        var rep = state.rep && state.rep.fullName;
        if (!rep) { host.innerHTML = '<div class="aemc-empty">Sign-in still resolving…</div>'; return; }
        // Session-resolved fullName, never a client guess — otherwise view-as shows the wrong
        // rep's work.
        return sameOriginJson('/api/staff/finished-photos/library?limit=24&rep=' + encodeURIComponent(rep))
            .then(function (d) {
                var photos = d.photos || [];
                if (sub) sub.textContent = d.totalCount ? '(' + d.totalCount + ' on your accounts)' : '';
                var link = el('mc-photos-all');
                if (link) link.href = '/dashboards/finished-photos-library.html#rep=' + encodeURIComponent(rep);
                if (!photos.length) {
                    host.innerHTML = '<div class="aemc-empty">No finished photos on your accounts yet. ' +
                        'They appear as production photographs completed jobs.</div>';
                    return;
                }
                host.innerHTML = '<div class="mc-photo-grid">' + photos.map(function (p) {
                    var cap = p.companyName || p.designName || '';
                    return '<a class="mc-photo" href="' + esc(p.imageUrl || '#') + '" target="_blank" rel="noopener" ' +
                        'title="' + esc(cap) + '"><img src="' + esc(p.imageUrl || '') + '" alt="' + esc(cap) +
                        '" loading="lazy"><span class="mc-photo-cap">' + esc(cap) + '</span></a>';
                }).join('') + '</div>';
            }).catch(function (err) {
                host.innerHTML = '<div class="aemc-panel-error">Finished photos failed to load (' +
                    esc(err.message) + '). Refresh to retry.</div>';
            });
    }

    // ---------- The One Thing ----------
    // One ranked next-best-action, computed entirely from data the other cards already
    // fetched — zero extra requests. The point is to answer "what do I do right now?" without
    // making the rep triage six lists, and to state what each action is WORTH to her, because
    // /embroidery-bonus/targets already returns bounty and gapToBounty per row.
    //
    // Ordering: a fire outranks a bounty. A late order is a customer already angry; a win-back
    // is money that will still be there tomorrow. Within a kind, dollars × urgency.
    var OT_SKIP_TTL_DAYS = 14;

    function otSkipKey() {
        return 'aemc.onething.skipped.v1.' + ((state.rep && state.rep.email) || 'unknown');
    }
    function readSkips() {
        var raw;
        try { raw = JSON.parse(localStorage.getItem(otSkipKey()) || '{}') || {}; } catch (e) { return {}; }
        var now = Date.now(), out = {}, changed = false;
        Object.keys(raw).forEach(function (k) {
            if (Date.parse(raw[k]) > now) out[k] = raw[k]; else changed = true;
        });
        if (changed) { try { localStorage.setItem(otSkipKey(), JSON.stringify(out)); } catch (e) {} }
        return out;
    }
    function skipOne(id) {
        var skips = readSkips();
        skips[id] = new Date(Date.now() + OT_SKIP_TTL_DAYS * 86400000).toISOString();
        try { localStorage.setItem(otSkipKey(), JSON.stringify(skips)); } catch (e) {}
    }
    function clearSkips() {
        try { localStorage.removeItem(otSkipKey()); } catch (e) {}
    }

    // Candidates from every source already in memory. state.candidates is topped up by each
    // loader as it resolves, so this improves as the page settles rather than blocking on all.
    function otCandidates() {
        var out = [];
        var q = (state.summary && state.summary.actionQueue) || {};

        (state.dueLate || []).forEach(function (o) {
            out.push({
                id: 'late-' + o.idOrder,
                kind: 'fire',
                urgency: 3,
                dollars: o.subtotal || 0,
                title: 'WO #' + o.idOrder + (o.company ? ' — ' + o.company : '') + ' is ' +
                       Math.abs(o.daysUntilDue) + ' days past its ship date',
                why: 'Not shipped, and the requested date has passed' +
                     (o.blanks && o.blanks !== 'received' ? ' — the blanks still are not in house.' : '.') +
                     ' Chase this before the customer calls you about it.',
                worth: 'Protects ' + money0(o.subtotal || 0),
                urgent: true,
                href: '/dashboards/purchasing-portal.html',
                cta: 'Open purchasing',
            });
        });

        (q.overdueLeads || []).forEach(function (l) {
            out.push({
                id: 'lead-' + l.submissionId,
                kind: 'fire',
                urgency: 2,
                dollars: l.leadValue || 0,
                title: (l.company || l.contactName || 'A lead') + ' is past its follow-up date',
                why: 'This lead asked you for something and the date you set has gone by.',
                worth: l.leadValue ? money0(l.leadValue) + ' in play' : 'Keeps the lead alive',
                urgent: true,
                href: leadLink(l.submissionId),
                cta: 'Open lead',
            });
        });

        (state.almostThere || []).forEach(function (x) {
            out.push({
                id: 'almost-' + (x.idCustomer || x.company),
                kind: 'money',
                urgency: 2,
                dollars: x.bounty || 0,
                title: x.company + ' is ' + money0(x.gapToBounty) + ' of embroidery from a bounty',
                why: 'Already ordering with you this quarter — at ' + money0(x.quarterRevenue) +
                     '. The cheapest bounty on your board: one add-on order gets you there.',
                worth: 'Pays ' + money2(x.bounty),
                href: '/quote-builders/embroidery-quote-builder.html',
                cta: 'Start a quote',
            });
        });

        (state.winBack || []).forEach(function (x) {
            out.push({
                id: 'winback-' + (x.idCustomer || x.company),
                kind: 'money',
                urgency: 1,
                dollars: (x.bounty || 0) + (x.avgOrderValue || 0) * 0.25,
                title: 'Call ' + x.company + ' — ' + x.monthsDormant + ' months quiet',
                why: 'Embroidered with us ' + x.embroideryOrders + ' times, typical order ' +
                     money0(x.avgOrderValue) +
                     (x.q3SharePct >= 25 ? ', and this is historically their quarter.' : '.'),
                worth: money2(x.bounty) + ' bounty + ' + money0(x.avgOrderValue) + ' typical order',
                href: '/quote-builders/embroidery-quote-builder.html',
                cta: 'Start a quote',
            });
        });

        (state.growthItems || []).forEach(function (it) {
            out.push({
                id: 'growth-' + it.company,
                kind: 'money',
                urgency: 1,
                dollars: it.estValue || 0,
                title: it.company + ' is overdue against its own rhythm',
                why: ((it.reasons || [])[0] || {}).text ||
                     ('Last order ' + fmtWhen(it.lastOrderDate) + ', average ' + money0(it.avgOrderValue) + '.'),
                worth: '~' + money0(it.estValue) + ' typically',
                href: '/quote-builders/embroidery-quote-builder.html',
                cta: 'Start a quote',
            });
        });

        return out;
    }

    function renderOneThing() {
        var host = el('mc-onething'), skipHost = el('mc-onething-skipped');
        if (!host) return;
        var skips = readSkips();
        var all = otCandidates();
        var live = all.filter(function (c) { return !skips[c.id]; });
        var skippedCount = all.length - live.length;

        // A skipped item must NEVER vanish silently — always offer the way back.
        if (skipHost) {
            if (skippedCount) {
                skipHost.innerHTML = skippedCount + ' skipped · <button type="button" id="mc-ot-unskip">show them again</button>' +
                    ' <span class="aemc-muted">(skips last ' + OT_SKIP_TTL_DAYS + ' days, on this device only)</span>';
                skipHost.hidden = false;
                var un = el('mc-ot-unskip');
                if (un) un.addEventListener('click', function () { clearSkips(); renderOneThing(); });
            } else {
                skipHost.hidden = true;
            }
        }

        if (!live.length) {
            host.hidden = true;
            return;
        }
        live.sort(function (a, b) {
            if (a.kind !== b.kind) return a.kind === 'fire' ? -1 : 1;   // fires first, always
            if (b.urgency !== a.urgency) return b.urgency - a.urgency;
            return (b.dollars || 0) - (a.dollars || 0);
        });
        var c = live[0];
        // ONE escaping chokepoint. Candidate builders above hold RAW strings on purpose:
        // company names come from ShopWorks and lead forms, and when each builder was
        // responsible for its own esc() three of five did it and two did not — the harness's
        // 'Harbor Electric <b>xss</b>' fixture rendered as live markup. Escape here, once.
        host.innerHTML =
            '<div class="mc-ot-eyebrow"><i class="fas fa-star" aria-hidden="true"></i> ' +
                (c.kind === 'fire' ? 'Do this first' : 'Best call you can make today') + '</div>' +
            '<div class="mc-ot-title">' + esc(c.title) + '</div>' +
            '<div class="mc-ot-why">' + esc(c.why) + '</div>' +
            '<span class="mc-ot-worth' + (c.urgent ? ' mc-ot-worth--urgent' : '') + '">' +
                '<i class="fas ' + (c.urgent ? 'fa-shield-halved' : 'fa-sack-dollar') + '" aria-hidden="true"></i> ' +
                esc(c.worth) + '</span>' +
            '<div class="mc-ot-actions">' +
                '<a class="dash-btn dash-btn--primary" href="' + esc(c.href) + '">' + esc(c.cta) + '</a>' +
                '<button type="button" class="dash-btn" id="mc-ot-skip">Not now →</button>' +
                (live.length > 1 ? '<span class="aemc-muted">' + (live.length - 1) + ' more queued</span>' : '') +
            '</div>';
        host.hidden = false;
        var skipBtn = el('mc-ot-skip');
        if (skipBtn) {
            skipBtn.addEventListener('click', function () { skipOne(c.id); renderOneThing(); });
        }
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
    // The types the daily sync cron computes and materializes automatically.
    // Anything else in the payout ledger (e.g. a hand-keyed Setup Bonus) is a manual
    // adjustment — flag it so the row is self-explanatory and the total is trusted.
    // ⚠️ Keep in sync with COMPUTED_TYPES in Python Inksoft web/templates/commissions.html.
    // Flask totals a fixed list of types; this card sums the ledger type-agnostically — miss
    // one here and the two surfaces disagree by exactly that bonus (the 2026-07-21 bug).
    var COMPUTED_BONUS_TYPES = {
        'Online Store': 1, 'Garment Spiff': 1, 'Win-Back Bounty': 1, 'Embroidery Bonus': 1,
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
            var isManual = !COMPUTED_BONUS_TYPES[r.type];
            var metaHtml = captionIsExact
                ? '<span class="aemc-row-meta">on ' + money0(r.base) + ' @ ' + (Math.round(r.rate * 1000) / 10) + '%</span>'
                : (isManual ? '<span class="aemc-row-meta">manual adjustment</span>' : '');
            return '<li class="aemc-row">' +
                '<span class="aemc-row-main">' + esc(r.type) + '</span>' +
                metaHtml +
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

        // Name the components ACTUALLY present in the payout so the footnote can
        // never undercount the total again (a hand-keyed Setup Bonus row is folded
        // into b.current.total but was previously unnamed here). Falls back to the
        // standard three before any rows load.
        var typeSet = {};
        (b.current.rows || []).concat(b.previous.rows || []).forEach(function (r) {
            if (r && r.type) typeSet[r.type] = 1;
        });
        var comps = Object.keys(typeSet);
        var compStr = comps.length ? comps.join(', ') : 'Online Store, Garment Spiff, Win-Back Bounty';
        el('aemc-bonus-foot').textContent = 'Paid so far in ' + b.year + ': ' +
            money2(b.paidYtd) + ' · Components: ' + compStr + '. Annual retention/growth/new-business bonuses are calculated in December.';
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

    function loadPurchasing(refresh) {
        return sameOriginJson('/api/crm-proxy/ae-dashboard/purchasing' + qs(refresh)).then(function (p) {
            var c = p.counts || {};
            var waiting = (c.sent || 0);
            el('aemc-purch-sub').textContent = p.submissionCount
                ? '(' + p.submissionCount + ' request' + (p.submissionCount === 1 ? '' : 's') + ' in ' + p.windowDays + 'd' + (waiting ? ' · ' + waiting + ' not yet ordered' : '') + ')'
                : '';
            if (!p.items || !p.items.length) {
                el('aemc-purch').innerHTML = '<div class="aemc-empty">No purchase requests sent to Bradley in the last ' + p.windowDays + ' days.</div>';
                return;
            }
            var purchRows = [];
            (p.items || []).forEach(function (m) {
                (m.orders || []).forEach(function (o) { purchRows.push({ m: m, o: o }); });
            });
            el('aemc-purch').innerHTML = expandableRows(purchRows, function (r, hidden) {
                var m = r.m, o = r.o;
                var meta = [];
                if (o.orderedDate) meta.push('ordered ' + fmtWhen(o.orderedDate) + (o.vendors && o.vendors.length ? ' (' + o.vendors.join(', ') + ')' : ''));
                if (o.receivedDate) meta.push('received ' + fmtWhen(o.receivedDate));
                if (!o.orderedDate && m.submittedAt) meta.push('sent ' + fmtWhen(m.submittedAt));
                if (m.bradleyPo) meta.push('PO# ' + m.bradleyPo);
                // SanMar invoice button — same shared viewer as the Purchasing Portal.
                var invBtn = (o.sanmarPos && o.sanmarPos.length)
                    ? '<button type="button" class="aemc-mini-btn aemc-inv-btn" data-wo="' + esc(o.orderNumber) + '" data-company="' + esc(o.company || '') + '" data-pos="' + esc(o.sanmarPos.join(',')) + '" data-ordered="' + esc(o.orderedDate || '') + '"><i class="fas fa-file-invoice-dollar"></i> Invoice</button>'
                    : '';
                return '<li class="aemc-row' + (hidden ? ' aemc-row--collapsed' : '') + '">' +
                    '<span class="aemc-row-main">WO #' + esc(o.orderNumber) + (o.company ? ' — ' + esc(o.company) : '') + '</span>' +
                    '<span class="aemc-purch-chip aemc-purch--' + esc(o.status) + '">' + esc(PURCH_LABEL[o.status] || o.status) + '</span>' +
                    invBtn +
                    '<span class="aemc-row-right"><span class="aemc-row-meta">' + esc(meta.join(' · ')) + '</span></span>' +
                    '</li>';
            }, { noun: 'request' }) +
                (p.truncated ? '<p class="aemc-hint">…and ' + p.truncated + ' older request' + (p.truncated === 1 ? '' : 's') + ' in the form inbox.</p>' : '');
            Array.prototype.forEach.call(el('aemc-purch').querySelectorAll('.aemc-inv-btn'), function (btn) {
                btn.addEventListener('click', function () {
                    if (!window.SanMarInvoiceViewer) { DashPage.showError('Invoice viewer failed to load — refresh the page.'); return; }
                    window.SanMarInvoiceViewer.open({
                        wo: btn.dataset.wo, company: btn.dataset.company,
                        pos: btn.dataset.pos.split(',').filter(Boolean), orderedDate: btn.dataset.ordered,
                    });
                });
            });
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

    function dueRow(o, hidden) {
        var flagText = o.flag === 'late'
            ? 'Late ' + Math.abs(o.daysUntilDue) + 'd'
            : (o.daysUntilDue === 0 ? 'Due TODAY' : 'Due in ' + o.daysUntilDue + 'd');
        var meta = ['due ' + fmtWhen(o.dueDate)];
        if (o.vendors && o.vendors.length) meta.push(o.vendors.join(', '));
        if (o.subtotal) meta.push(money0(o.subtotal));
        if (o.invoiced) meta.push('invoiced');
        return '<li class="aemc-row' + (hidden ? ' aemc-row--collapsed' : '') + '">' +
            '<span class="aemc-row-main">WO #' + esc(o.idOrder) + (o.company ? ' — ' + esc(o.company) : '') + '</span>' +
            '<span class="aemc-due-flag aemc-due-flag--' + (o.flag === 'late' ? 'late' : 'risk') + '">' + esc(flagText) + '</span>' +
            '<span class="aemc-purch-chip aemc-purch--' + esc(DUE_BLANKS_CHIP[o.blanks] || 'sent') + '">' + esc(DUE_BLANKS_LABEL[o.blanks] || o.blanks) + '</span>' +
            '<span class="aemc-row-right"><span class="aemc-row-meta">' + esc(meta.join(' · ')) + '</span></span>' +
            '</li>';
    }

    function loadDueDates(refresh) {
        return sameOriginJson('/api/crm-proxy/ae-dashboard/due-dates' + qs(refresh)).then(function (d) {
            var c = d.counts || {};
            var bits = [];
            if (c.late) bits.push(c.late + ' late');
            if (c.atRisk) bits.push(c.atRisk + ' at risk');
            el('aemc-due-sub').textContent = bits.length ? '(' + bits.join(' · ') + ')' : '';
            state.dueLate = d.late || [];        // feeds The One Thing (fires outrank bounties)
            renderOneThing();
            if (!(d.late || []).length && !(d.atRisk || []).length) {
                el('aemc-due').innerHTML = '<div class="aemc-empty">Nothing is late and nothing due in the next ' +
                    (d.dueSoonDays || 7) + ' days is waiting on blanks' +
                    (c.dueSoonOnTrack ? ' — ' + c.dueSoonOnTrack + ' order' + (c.dueSoonOnTrack === 1 ? '' : 's') + ' due soon already have goods in house' : '') + '.</div>';
                return;
            }
            var html = '';
            if ((d.late || []).length) {
                html += '<h3 class="aemc-queue-section-title">🔴 Past due — not shipped</h3>' +
                    expandableRows(d.late, dueRow, { noun: 'order' }) +
                    (d.lateTruncated ? '<p class="aemc-hint">…and ' + d.lateTruncated + ' more past-due order' + (d.lateTruncated === 1 ? '' : 's') + '.</p>' : '');
            }
            if ((d.atRisk || []).length) {
                html += '<h3 class="aemc-queue-section-title">🟠 Due soon — blanks not in house</h3>' +
                    expandableRows(d.atRisk, dueRow, { noun: 'order' }) +
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
    function loadGrowth(refresh) {
        var acct = el('aemc-growth-accounts-link');
        if (state.rep && ACCOUNTS_PAGE[state.rep.email]) { acct.href = ACCOUNTS_PAGE[state.rep.email]; acct.hidden = false; }
        return sameOriginJson('/api/crm-proxy/ae-dashboard/growth' + qs(refresh)).then(function (g) {
            state.growthItems = g.items || [];
            renderOneThing();
            el('aemc-growth-sub').textContent = g.flaggedCount
                ? '(' + g.flaggedCount + ' account' + (g.flaggedCount === 1 ? '' : 's') + ' · ~' + money0(g.potentialTotal) + ' in reach)'
                : '';
            if (!g.items || !g.items.length) {
                el('aemc-growth').innerHTML = '<div class="aemc-empty">Nothing overdue against its own rhythm right now — every active account is on schedule. Check back tomorrow.</div>';
                return;
            }
            el('aemc-growth').innerHTML = expandableRows(g.items, function (it, hidden) {
                var chips = (it.reasons || []).map(function (r) {
                    return '<span class="aemc-growth-reason aemc-growth-reason--' + esc(r.type) + '">' + esc(r.text) + '</span>';
                }).join(' ');
                return '<li class="aemc-row' + (hidden ? ' aemc-row--collapsed' : '') + '">' +
                    '<span class="aemc-row-main">' + esc(it.company) + '</span>' +
                    chips +
                    '<span class="aemc-row-right"><span class="aemc-money aemc-growth-total">~' + money0(it.estValue) + '</span><br>' +
                    '<span class="aemc-row-meta">last order ' + fmtWhen(it.lastOrderDate) + ' · avg ' + money0(it.avgOrderValue) + '</span></span>' +
                    '</li>';
            }, { noun: 'account' }) +
                (g.truncated ? '<p class="aemc-hint">…and ' + g.truncated + ' more flagged — work these first, then refresh tomorrow.</p>' : '');
        }).catch(function (err) {
            el('aemc-growth').innerHTML = '<div class="aemc-panel-error">Growth radar failed to load (' + esc(err.message) + '). Refresh to retry.</div>';
        });
    }

    // "How this works" — the plan has to explain itself on the page. If it needs a memo to
    // be understood it won't motivate anyone (Erik, 2026-07-25).
    function wireBonusExplainer() {
        var btn = el('aemc-bh-explain');
        var box = el('aemc-bh-how');
        if (!btn || !box) return;
        btn.addEventListener('click', function () {
            var open = box.hidden;
            box.hidden = !open;
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            btn.innerHTML = open
                ? '<i class="fas fa-circle-question" aria-hidden="true"></i> Hide details'
                : '<i class="fas fa-circle-question" aria-hidden="true"></i> How this works';
        });
    }

    // ---------- Q3 embroidery bonus ----------
    // ONE request, TWO surfaces: the hero (always painted, whatever tab is open) and the
    // "What earned your bonus" card (Money tab, mounted later). Both go through
    // dataOnce('emb') so opening Money never re-requests what the hero already fetched.
    // Identity is injected by the server forwarder, so this can only ever return the
    // caller's figures (admins with ?viewAs= see that rep).
    function fetchEmb(refresh) {
        return sameOriginJson('/api/crm-proxy/embroidery-bonus' + qs(refresh)).then(function (d) {
            var names = Object.keys(d.reps || {});
            if (!names.length) return null;                  // admin overview or nothing to show
            var mine = (state.rep && d.reps[state.rep.fullName]) || d.reps[names[0]];
            return mine ? { mine: mine, raw: d } : null;
        });
    }

    // A missing hero used to be silent (console.warn, "a blank hero beats a wrong bonus
    // number"). Right about wrongness — we still never show a number we don't trust — but a
    // permanently-visible spine that just isn't there reads as a broken page. Explain the
    // absence instead (Rule 4: failures are visible).
    function spineError(err) {
        var host = el('aemc-bh-fallback');
        if (!host) return;
        host.innerHTML = '<i class="fas fa-triangle-exclamation" aria-hidden="true"></i> ' +
            'Your bonus figures couldn’t load (' + esc(err.message) + '). ' +
            'Nothing else on this page is affected — hit Refresh to retry.';
        host.hidden = false;
    }

    function loadBonusHero(refresh) {
        return dataOnce('emb', function () { return fetchEmb(refresh); })
            .then(function (r) { if (r) renderBonusSpine(r.mine, r.raw); })
            .catch(spineError);
    }

    function loadEarnedAccounts(refresh) {
        return dataOnce('emb', function () { return fetchEmb(refresh); })
            .then(function (r) { renderEarnedAccounts(r && r.mine); })
            .catch(function (err) {
                el('aemc-earned').innerHTML = '<div class="aemc-panel-error">Bonus detail failed to load (' +
                    esc(err.message) + '). Refresh to retry.</div>';
            });
    }

    function renderBonusSpine(mine, d) {
        var l = mine.ladder || {};
        // 🔑 teamKicker is TOP-LEVEL on /api/embroidery-bonus, not on the rep object (whose keys
        // are rep, accounts, counts, bounties, ladder, totalBonus — verified live 2026-07-26).
        // This read was `mine.teamKicker` and therefore ALWAYS undefined in production, with two
        // silent consequences: a rep who cleared the top rung was told "Every milestone cleared
        // this quarter" while the team kicker was still wide open, and the explainer's kicker
        // figure silently kept its hardcoded $740,000 markup instead of the live Caspio config.
        var k = (d && d.teamKicker) || mine.teamKicker || {};
        // Raw /api/embroidery-bonus shape: counts.* / bounties.* live on the rep object,
        // but minAccountRevenue + dormancyMonths are TOP-LEVEL on the response.
        var counts = mine.counts || {};
        var bounties = mine.bounties || {};
        countUp(el('aemc-bh-amount'), Number(mine.totalBonus) || 0, money2);
        state.bonusTotal = Number(mine.totalBonus) || 0;

        // Always state the goal in DOLLARS. A bare "18.4% of your goal" with no
        // denominator anywhere on the page is unactionable — it was the single biggest
        // source of confusion when this shipped (2026-07-25).
        var rungs = l.rungs || [];
        var top = rungs.length ? rungs[rungs.length - 1] : null;
        el('aemc-bh-goal').textContent = l.baseline
            ? money0(l.revenue) + ' of your ' + money0(l.baseline) + ' goal · ' + (l.pctOfBaseline || 0).toFixed(1) + '%'
            : '';

        // RATE mode is the live mechanic (2026-07-26): a continuous $/point above a start
        // percentage, so there are no rungs and no dead zones. The bar runs to a fixed
        // 130%-of-goal display ceiling with the start line marked — that is the only
        // threshold left. `axisMax` is the shared denominator for the fill, the start mark
        // AND the pace flag, so those three can never disagree.
        // The rung branch stays intact: zeroing Rate_Per_Point in Caspio reverts the whole
        // mechanic with no deploy.
        var RATE_CEILING_PCT = 130;
        var isRate = !!l.rate;
        var axisMax = isRate
            ? (l.baseline * RATE_CEILING_PCT / 100)
            : (top && top.threshold ? top.threshold : 0);

        var pct = axisMax ? Math.max(0, Math.min((l.revenue / axisMax) * 100, 100)) : 0;
        el('aemc-bh-fill').style.width = pct.toFixed(1) + '%';
        el('aemc-bh-marks').innerHTML = isRate
            ? '<span class="aemc-bh-mark' + (l.pctOfBaseline >= l.rate.startPct ? ' is-hit' : '') +
              '" style="left:' + (axisMax ? ((l.rate.revenueAtStart / axisMax) * 100).toFixed(1) : '0') +
              '%" title="' + money0(l.rate.revenueAtStart) + ' — earning starts here"></span>'
            : rungs.map(function (r) {
                var at = axisMax ? Math.min((r.threshold / axisMax) * 100, 100) : 0;
                return '<span class="aemc-bh-mark' + (l.revenue >= r.threshold ? ' is-hit' : '') +
                    '" style="left:' + at.toFixed(1) + '%" title="' + money0(r.threshold) + ' pays ' + money2(r.pay) + '"></span>';
            }).join('');

        // PACE MARKER — where she LANDS at today's pace, on the exact same axis as the rung
        // ticks (same denominator, so it can never disagree with the ladder). Rendered as a
        // flag rather than another tick so it doesn't read as one more milestone. The pace
        // SENTENCE below stays as the text equivalent.
        // Honest by construction: computePace() projects on the measured Q3 curve
        // (Jul 30% / Aug 37% / Sep 33%), not elapsed days — straight-line maths makes a rep
        // look further behind than she is on a back-loaded quarter.
        var pace = l.pace;
        if (pace && pace.projectedRevenue && axisMax) {
            var at = Math.min((pace.projectedRevenue / axisMax) * 100, 100);
            var paceBehind = pace.status === 'behind' || pace.status === 'below-start';
            el('aemc-bh-marks').insertAdjacentHTML('beforeend',
                '<span class="mc-bh-pace-mark' + (paceBehind ? ' is-behind' : '') +
                '" style="left:' + at.toFixed(1) + '%" role="img" aria-label="Projected ' +
                money0(pace.projectedRevenue) + ' by September 30 at your current pace"></span>');
        }

        var nextText;
        if (isRate) {
            var earning = l.rate.pointsEarned > 0;
            el('aemc-bh-rungs').innerHTML = earning
                ? '<span class="aemc-bh-rung is-hit">' + l.rate.pointsEarned + ' points over ' +
                  l.rate.startPct + '%<span class="aemc-bh-rung-pay">' + money2(l.rate.payout) + '</span></span>' +
                  '<span class="aemc-bh-rung">each extra 1%<span class="aemc-bh-rung-pay">+' +
                  money2(l.rate.perPoint) + '</span></span>'
                : '<span class="aemc-bh-rung is-next">earning starts at ' + l.rate.startPct + '% — ' +
                  money0(l.rate.revenueAtStart) + '<span class="aemc-bh-rung-pay">then ' +
                  money2(l.rate.perPoint) + ' per 1%</span></span>';
            nextText = earning
                ? 'Every extra 1% of your goal adds ' + money2(l.rate.perPoint) + ' — no ceiling.'
                : money0(Math.max(0, l.rate.revenueAtStart - l.revenue)) + ' more embroidery and you start earning ' +
                  money2(l.rate.perPoint) + ' per 1%.';
        } else {
            el('aemc-bh-rungs').innerHTML = rungs.map(function (r) {
                var hit = l.revenue >= r.threshold;
                var isNext = l.nextRung && l.nextRung.pct === r.pct;
                return '<span class="aemc-bh-rung' + (hit ? ' is-hit' : '') + (isNext ? ' is-next' : '') + '">' +
                    (hit ? '<i class="fas fa-check"></i> ' : '') + money0(r.threshold) +
                    '<span class="aemc-bh-rung-pay">' + money2(r.pay) + '</span></span>';
            }).join('');
            if (l.nextRung) {
                nextText = money0(l.amountToNextRung) + ' more embroidery takes you to ' +
                    money2(l.nextRung.pay) + (top && top.pay > l.nextRung.pay ? ' — and ' + money2(top.pay) + ' at the top' : '');
            } else if (k.next) {
                nextText = 'Top rung cleared. ' + money0(k.amountToNext) + ' company-wide adds ' + money2(k.next.pay) + ' each.';
            } else {
                nextText = 'Every milestone cleared this quarter. Outstanding.';
            }
        }
        el('aemc-bh-next').textContent = nextText;

        // Pace context. A raw "$110,651 more" a quarter of the way in reads as hopeless
        // even when the rep is tracking to clear it — this says which it is. Projection
        // uses the measured Q3 seasonal curve, not elapsed days, because Q3 embroidery is
        // back-loaded (July is only 30% of the quarter).
        var paceEl = el('aemc-bh-pace');
        var p = l.pace;
        if (paceEl && p) {
            var txt, cls;
            // Rate mode has two states — earning, or not yet past the start line.
            if (p.status === 'earning') {
                txt = 'On pace to finish near ' + (p.projectedPct || 0).toFixed(0) + '% of goal (' +
                    money0(p.projectedRevenue) + ') — about ' + money2(p.onPaceForPay) + ' on the rate';
                cls = 'is-onpace';
            } else if (p.status === 'below-start') {
                txt = 'At this pace you land near ' + money0(p.projectedRevenue) + ' — ' +
                    money0(p.shortfallToStartAtPace) + ' short of where earning starts';
                cls = 'is-behind';
            } else if (p.status === 'on-pace') {
                txt = 'On pace to clear it — tracking toward ' + money0(p.projectedRevenue) +
                    ' by Sep 30' + (p.onPaceForPay ? ', which pays ' + money2(p.onPaceForPay) : '');
                cls = 'is-onpace';
            } else if (p.status === 'behind') {
                txt = 'At this pace you land near ' + money0(p.projectedRevenue) + ' — ' +
                    money0(p.shortfallToNextAtPace) + ' short of that rung';
                cls = 'is-behind';
            } else if (p.status === 'topped-out') {
                txt = 'Top rung already cleared — tracking toward ' + money0(p.projectedRevenue);
                cls = 'is-onpace';
            }
            if (txt) {
                paceEl.className = 'aemc-bh-pace ' + cls;
                paceEl.innerHTML = '<i class="fas ' +
                    (cls === 'is-onpace' ? 'fa-circle-check' : 'fa-circle-arrow-up') +
                    '" aria-hidden="true"></i> ' + esc(txt);
                paceEl.hidden = false;
            } else {
                paceEl.hidden = true;
            }
        } else if (paceEl) {
            paceEl.hidden = true;   // too early in the quarter to project honestly
        }

        // Fill the explainer with the LIVE config values, never hardcoded copy.
        var setTxt = function (id, v) { var e = el(id); if (e) e.textContent = v; };
        setTxt('aemc-bh-h-new', money2(bounties.newAccountBounty));
        setTxt('aemc-bh-h-react', money2(bounties.reactivatedBounty));
        setTxt('aemc-bh-h-min', money0(d.minAccountRevenue || 1000));
        setTxt('aemc-bh-h-months', String(d.dormancyMonths || 12));
        var topKick = (k.tiers || []).slice(-1)[0];
        if (topKick) setTxt('aemc-bh-h-kick', money0(topKick.target));

        var chips = [
            { n: counts.new || 0, label: 'new program' + (counts.new === 1 ? '' : 's'), each: bounties.newAccountBounty },
            { n: counts.reactivated || 0, label: 'won back', each: bounties.reactivatedBounty },
        ].map(function (c) {
            return '<span class="aemc-bh-chip' + (c.n ? ' is-on' : '') + '">' +
                '<strong>' + c.n + '</strong> ' + esc(c.label) +
                '<span class="aemc-bh-chip-rate">' + money2(c.each) + ' ea</span></span>';
        });
        chips.push('<span class="aemc-bh-chip' + (l.rungReached ? ' is-on' : '') + '">' +
            '<strong>' + (l.pctOfBaseline || 0) + '%</strong> of your goal' +
            '<span class="aemc-bh-chip-rate">' + (l.rungReached ? money2(l.rungReached.pay) + ' earned' : 'no rung yet') + '</span></span>');
        el('aemc-bh-chips').innerHTML = chips.join('');

        var fb = el('aemc-bh-fallback');
        if (fb) fb.hidden = true;                        // a later success clears an earlier error
        el('aemc-bonus-hero').hidden = false;

        renderCondensed(mine);      // the 48px sticky stand-in
        renderKicker(k);            // shared team goal (Money tab)
        considerCelebration(mine);  // seeds on first sight, only fires on genuinely new events
        if (state.summary) {
            // Diff against the baseline read at the START of render(), THEN re-stamp it now
            // that state.bonusTotal is known. render()'s own write runs before this fetch
            // resolves, so it banks bonusTotal:0 — which would make tomorrow's visit announce
            // the entire quarter's bonus as if it had all landed overnight.
            renderDiff(state.summary, state.lastSeen);
            writeLastSeen(state.summary);
        }
    }

    function renderEarnedAccounts(mine) {
        var host = el('aemc-earned');
        if (!host) return;
        if (!mine) {
            host.innerHTML = '<div class="aemc-panel-error">Bonus detail unavailable — no figures came back ' +
                'for your account. Refresh to retry.</div>';
            return;
        }
        var link = el('aemc-emb-bonus-link');
        if (link && state.rep && BONUS_DASHBOARD_PATH[state.rep.email]) {
            link.href = BONUS_DASHBOARD_BASE + BONUS_DASHBOARD_PATH[state.rep.email];
            link.hidden = false;
        }
        var acc = mine.accounts || {};
        var rows = (acc.new || []).map(function (a) { return { a: a, kind: 'New program' }; })
            .concat((acc.reactivated || []).map(function (a) { return { a: a, kind: 'Won back' }; }));
        var sub = el('aemc-earned-sub');
        if (sub) sub.textContent = rows.length ? '(' + money2(mine.bounties.payout) + ' from ' + rows.length + ' account' + (rows.length === 1 ? '' : 's') + ')' : '';
        if (!rows.length) {
            host.innerHTML = '<div class="aemc-empty">No bounty-earning accounts yet this quarter. ' +
                'An account counts once it reaches the quarter minimum in embroidery — see <strong>Where the money is</strong> below for who to go after.</div>';
            return;
        }
        rows.sort(function (x, y) { return y.a.revenue - x.a.revenue; });
        host.innerHTML = expandableRows(rows, function (r, hidden) {
            return '<li class="aemc-row' + (hidden ? ' aemc-row--collapsed' : '') + '">' +
                '<span class="aemc-row-main">' + esc(r.a.company) + '</span>' +
                '<span class="aemc-growth-reason">' + r.kind + '</span>' +
                '<span class="aemc-row-right"><span class="aemc-money">' + money2(r.a.bounty) + '</span><br>' +
                '<span class="aemc-row-meta">' + money0(r.a.revenue) + ' embroidery this quarter</span></span>' +
                '</li>';
        }, { noun: 'account' });
    }

    // ---------- where the money is: the target roadmap ----------
    function loadTargets(refresh) {
        return sameOriginJson('/api/crm-proxy/embroidery-bonus/targets' + qs(refresh)).then(function (d) {
            var names = Object.keys(d.reps || {});
            if (!names.length) return;
            var mine = (state.rep && d.reps[state.rep.fullName]) || d.reps[names[0]];
            if (!mine) return;
            var s = mine.summary || {};

            // C first: the smallest asks on the board. An account already ordering that just
            // needs a little more is the cheapest bounty a rep can earn all quarter.
            var html = '';
            if ((mine.almostThere || []).length) {
                html += '<h3 class="aemc-queue-section-title">🎯 Almost there — ' +
                    money0(s.almostThereGap) + ' of orders away from ' + money0(s.almostThereBounty) + '</h3>' +
                    expandableRows(mine.almostThere, function (x, hidden) {
                        return '<li class="aemc-row' + (hidden ? ' aemc-row--collapsed' : '') + '">' +
                            '<span class="aemc-row-main">' + esc(x.company) + '</span>' +
                            '<span class="aemc-growth-reason">' + esc(x.category) + '</span>' +
                            '<span class="aemc-row-right"><span class="aemc-money">+' + money0(x.gapToBounty) + '</span><br>' +
                            '<span class="aemc-row-meta">at ' + money0(x.quarterRevenue) + ' — pays ' + money2(x.bounty) + '</span></span>' +
                            '</li>';
                    }, { visible: 4, noun: 'account' });
            }

            html += '<h3 class="aemc-queue-section-title">↩️ Win back — ' + s.winBackCount +
                ' accounts that used to embroider (' + money0(s.winBackLifetime) + ' of past work)</h3>' +
                expandableRows(mine.winBack, function (x, hidden) {
                    var season = x.q3SharePct >= 25 ? '<span class="aemc-growth-reason aemc-growth-reason--season">Q3 buyer</span>' : '';
                    return '<li class="aemc-row' + (hidden ? ' aemc-row--collapsed' : '') + '">' +
                        '<span class="aemc-row-main">' + esc(x.company) + '</span>' + season +
                        '<span class="aemc-row-right"><span class="aemc-money">' + money0(x.avgOrderValue) + '</span><br>' +
                        '<span class="aemc-row-meta">typical order · ' + x.embroideryOrders + ' past · ' +
                        x.monthsDormant + ' mo quiet · ' + money2(x.bounty) + ' bounty</span></span>' +
                        '</li>';
                }, { visible: 5, noun: 'account' });

            html += '<h3 class="aemc-queue-section-title">✨ Never embroidered — ' + s.firstProgramCount +
                ' accounts already buying from you (' + money0(s.firstProgramSpend) + ' in other work)</h3>' +
                expandableRows(mine.firstProgram, function (x, hidden) {
                    return '<li class="aemc-row' + (hidden ? ' aemc-row--collapsed' : '') + '">' +
                        '<span class="aemc-row-main">' + esc(x.company) + '</span>' +
                        '<span class="aemc-row-right"><span class="aemc-money">' + money0(x.otherSpend) + '</span><br>' +
                        '<span class="aemc-row-meta">spent on other work · ' + x.otherOrders + ' orders · last ' +
                        x.monthsSinceOrder + ' mo ago · ' + money2(x.bounty) + ' bounty</span></span>' +
                        '</li>';
                }, { visible: 5, noun: 'account' });

            el('aemc-targets').innerHTML = html;
            el('aemc-targets-sub').textContent = '(' + (s.winBackCount + s.firstProgramCount + s.almostThereCount) + ' accounts)';
            // Feed The One Thing. Both lists already carry bounty / gapToBounty / score, which
            // is what lets every suggested action state what it's worth to her paycheck.
            state.almostThere = mine.almostThere || [];
            state.winBack = mine.winBack || [];
            renderOneThing();
        }).catch(function (err) {
            el('aemc-targets').innerHTML = '<div class="aemc-panel-error">Target list failed to load (' + esc(err.message) + '). Refresh to retry.</div>';
        });
    }

    // The standalone win-back radar was folded into "Where the money is" (loadTargets) on
    // 2026-07-25 — it ranked purely by lifetime spend, while the roadmap ranks by what an
    // account is realistically worth NOW, alongside the other two ways to earn.


    // ---------- data-quality radar (ShopWorks entries missing essentials) ----------
    function dqChips(issues) {
        return (issues || []).map(function (i) {
            return '<span class="aemc-dq-chip aemc-dq-chip--' + (i.severity === 'err' ? 'err' : 'warn') + '">' + esc(i.text) + '</span>';
        }).join(' ');
    }

    function loadDataQuality(refresh) {
        return sameOriginJson('/api/crm-proxy/ae-dashboard/data-quality' + qs(refresh)).then(function (d) {
            var c = d.counts || {};
            el('aemc-dq-sub').textContent = (c.ordersFlagged || c.customersFlagged)
                ? '(' + (c.ordersFlagged || 0) + ' order' + (c.ordersFlagged === 1 ? '' : 's') + ' · ' +
                  (c.customersFlagged || 0) + ' customer' + (c.customersFlagged === 1 ? '' : 's') + ' need attention)'
                : '';
            if (!(d.orders || []).length && !(d.customers || []).length) {
                el('aemc-dq').innerHTML = '<div class="aemc-empty">Clean sweep — every open order you entered in the last ' +
                    (d.windowDays || 30) + ' days has contact, ship-to, terms, ship date, and tax filled in. Nice work.</div>';
                return;
            }
            var html = '';
            if ((d.orders || []).length) {
                html += '<h3 class="aemc-queue-section-title">Orders missing fields</h3>' +
                    expandableRows(d.orders, function (o, hidden) {
                        return '<li class="aemc-row' + (hidden ? ' aemc-row--collapsed' : '') + '">' +
                            '<span class="aemc-row-main">WO #' + esc(o.idOrder) + (o.company ? ' — ' + esc(o.company) : '') + '</span>' +
                            dqChips(o.issues) +
                            '<span class="aemc-row-right"><span class="aemc-row-meta">entered ' + fmtWhen(o.placedDate) + '</span></span>' +
                            '</li>';
                    }, { noun: 'order' });
            }
            if ((d.customers || []).length) {
                html += '<h3 class="aemc-queue-section-title">Customer records needing updates</h3>' +
                    expandableRows(d.customers, function (cu, hidden) {
                        return '<li class="aemc-row' + (hidden ? ' aemc-row--collapsed' : '') + '">' +
                            '<span class="aemc-row-main">' + esc(cu.company) + '</span>' +
                            dqChips(cu.issues) +
                            '<span class="aemc-row-right"><span class="aemc-row-meta">Cust #' + esc(cu.idCustomer) + '</span></span>' +
                            '</li>';
                    }, { noun: 'customer' });
            }
            el('aemc-dq').innerHTML = html;
        }).catch(function (err) {
            el('aemc-dq').innerHTML = '<div class="aemc-panel-error">Missing-info check failed to load (' + esc(err.message) + '). Refresh to retry.</div>';
        });
    }

    // ---------- SanMar inbound (company-wide fetch, rep rows highlighted) ----------
    // No listener wiring in here: this runs again on every rep switch and every Refresh, so
    // an addEventListener would stack and the modal would open N times. The "Full view"
    // button is wired once in wireHeader().
    function loadInbound() {
        return DashPage.fetchJson('/api/sanmar-orders/inbound-today').then(function (data) {
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
