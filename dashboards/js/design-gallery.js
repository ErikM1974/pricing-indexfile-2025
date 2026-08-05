/**
 * Design Vault — page controller (window.DG.app)
 *
 * The only module that touches the URL, history, and the global keyboard map.
 * Everything else (store/search/grid/rails/drawer) is driven from here so there
 * is exactly one place where "what is on screen" is decided.
 *
 * Modes are URL state, not hidden variables:
 *   browse   — no query, no customer: rails + today's wall
 *   search   — ?q=… : instant local results
 *   customer — ?customer=… : portfolio band + that customer's designs
 * plus #design=<dn> for an open drawer. A pasted URL reproduces all of it.
 *
 * Rule 4 posture: index failures paint a visible banner or the boot surface;
 * a search that finds nothing says "no matches" only when the search actually
 * ran. An API failure never renders as an empty result set.
 *
 * Contract: scratchpad DG-CONTRACTS.md §DG.app.
 */
(function () {
    'use strict';

    window.DG = window.DG || {};

    var TIERS = ['Standard', 'Mid', 'Large', 'Full Back'];
    var SRC_CHIPS = [
        ['DIGITIZED', 'Digitized', 'fa-pen-nib'],
        ['ART', "Steve's art", 'fa-palette'],
        ['RUTH', "Ruth's mockups", 'fa-layer-group'],
        ['PHOTO', 'Finished photos', 'fa-camera'],
        ['THUMB', 'SW thumbnail', 'fa-image']
    ];
    var DEEP_DELAY = 400;
    var STALE_MS = 24 * 60 * 60 * 1000;

    var els = {};
    var ready = false;
    var srcBits = {};
    var deepTimer = null;
    var deepSeq = 0;
    var rafPending = false;
    var lastResults = [];

    var st = {
        q: '', tier: '', src: [], hasImage: false, year: '', customer: 0, sort: '', design: 0
    };

    // ── URL state ───────────────────────────────────────────────────────────
    function readURL() {
        var p = new URLSearchParams(window.location.search);
        st.q = p.get('q') || '';
        st.tier = p.get('tier') || '';
        st.src = (p.get('src') || '').split(',').filter(Boolean);
        st.hasImage = p.get('has') === '1';
        st.year = p.get('yr') || '';
        st.customer = parseInt(p.get('customer'), 10) || 0;
        st.sort = p.get('sort') || '';
        var m = /(?:^|#)design=(\d+)/.exec(window.location.hash || '');
        st.design = m ? parseInt(m[1], 10) : 0;
    }

    function buildURL() {
        var p = new URLSearchParams();
        if (st.q) p.set('q', st.q);
        if (st.tier) p.set('tier', st.tier);
        if (st.src.length) p.set('src', st.src.join(','));
        if (st.hasImage) p.set('has', '1');
        if (st.year) p.set('yr', st.year);
        if (st.customer) p.set('customer', String(st.customer));
        if (st.sort) p.set('sort', st.sort);
        var qs = p.toString();
        return window.location.pathname + (qs ? '?' + qs : '') + (st.design ? '#design=' + st.design : '');
    }

    function pushURL(replace) {
        var url = buildURL();
        if (url === window.location.pathname + window.location.search + window.location.hash) return;
        if (replace) history.replaceState(null, '', url);
        else history.pushState(null, '', url);
    }

    // ── mode ────────────────────────────────────────────────────────────────
    function mode() {
        if (st.customer) return 'customer';
        if (st.q) return 'search';
        return 'browse';
    }

    function srcMask() {
        var mask = 0;
        for (var i = 0; i < st.src.length; i++) mask |= (srcBits[st.src[i]] | 0);
        return mask;
    }

    function queryState() {
        return {
            q: st.q, tier: st.tier, srcMask: srcMask(), hasImage: st.hasImage,
            year: st.year, customerId: st.customer,
            sort: st.sort || (st.q ? 'relevance' : (st.customer ? 'newest' : 'newest'))
        };
    }

    // ── render ──────────────────────────────────────────────────────────────
    function render() {
        if (!ready) return;
        var m = mode();
        els.browse.hidden = m !== 'browse';
        els.results.hidden = m === 'browse';
        els.portfolio.hidden = m !== 'customer';

        if (m === 'browse') {
            DG.rails.render();
            renderTokens();
            return;
        }

        var res = DG.search.query(queryState());
        lastResults = res.results;
        DG.grid.setData(res.results);
        els.count.textContent = res.total.toLocaleString();
        els.ms.textContent = String(res.ms);

        if (m === 'customer') renderPortfolio();
        renderCustomerBanner(res.customerHit);
        renderTokens();
        renderDeepRow(res.total);
    }

    function renderPortfolio() {
        var info = DG.search.forCustomer(st.customer);
        var mix = '';
        for (var i = 0; i < TIERS.length; i++) {
            var n = info.tierMix[TIERS[i]] || 0;
            if (n) mix += '<span class="dg-chip">' + DG.esc(TIERS[i]) + ' · ' + n + '</span>';
        }
        var years = '';
        if (info.firstYYMM && info.lastYYMM) {
            years = '20' + String(Math.floor(info.firstYYMM / 100)).padStart(2, '0')
                + ' → 20' + String(Math.floor(info.lastYYMM / 100)).padStart(2, '0');
        }
        els.portfolio.innerHTML =
            '<div class="dg-portfolio-head">'
            + '<h2>' + DG.esc(info.company || ('Customer #' + st.customer)) + '</h2>'
            + '<span class="dg-mono">#' + st.customer + '</span>'
            + '<button type="button" class="dash-btn" data-exit-customer="1"><i class="fas fa-xmark"></i> Exit portfolio</button>'
            + '</div>'
            + '<div class="dg-portfolio-meta">'
            + '<span><strong>' + info.designs.length.toLocaleString() + '</strong> designs</span>'
            + (info.totalOrders ? '<span><strong>' + info.totalOrders.toLocaleString() + '</strong> orders</span>' : '')
            + (years ? '<span>' + DG.esc(years) + '</span>' : '')
            + mix
            + '</div>';
    }

    function renderCustomerBanner(hit) {
        if (!hit || st.customer) { els.customerBanner.hidden = true; return; }
        els.customerBanner.hidden = false;
        els.customerBanner.innerHTML = 'Customer match: <button type="button" class="dg-chip" data-customer="'
            + (+hit.customerId) + '">' + DG.esc(hit.company || ('#' + hit.customerId))
            + ' — ' + hit.count.toLocaleString() + ' designs <i class="fas fa-arrow-right"></i></button>';
    }

    function renderTokens() {
        var t = '';
        function tok(kind, label) {
            return '<button type="button" class="dg-token" data-token="' + kind + '">'
                + DG.esc(label) + ' <i class="fas fa-xmark"></i></button>';
        }
        if (st.tier) t += tok('tier', 'Tier: ' + st.tier);
        for (var i = 0; i < st.src.length; i++) t += tok('src:' + st.src[i], 'Source: ' + st.src[i]);
        if (st.hasImage) t += tok('has', 'Has image');
        if (st.year) t += tok('yr', 'Year: ' + st.year);
        if (t) t += '<button type="button" class="dg-token dg-token--clear" data-token="all">Clear all</button>';
        els.tokens.innerHTML = t;
    }

    function renderDeepRow(localTotal) {
        if (!st.q || st.q.length < 2) { els.deepRow.hidden = true; return; }
        els.deepRow.hidden = false;
        els.deepRow.innerHTML = localTotal
            ? '<span>Not finding it?</span> <button type="button" class="dash-btn dash-btn--sm" data-deep="1">'
              + '<i class="fas fa-cloud-arrow-down"></i> Deep-search server records</button>'
              + '<span class="dg-deep-hint">threads, DST files, art notes, placement</span>'
            : '<span>No local matches — searching server records…</span>';
    }

    // ── deep search ─────────────────────────────────────────────────────────
    function runDeepSearch() {
        if (!st.q || st.q.length < 2) return;
        var seq = ++deepSeq;
        var q = st.q;
        els.deepRow.hidden = false;
        els.deepRow.innerHTML = '<span><i class="fas fa-spinner fa-spin"></i> Searching server records for “' + DG.esc(q) + '”…</span>';

        var url = APP_CONFIG.API.BASE_URL + '/api/digitized-designs/search-all?fields=deep&limit=50&q=' + encodeURIComponent(q);
        var f = window.fetchWithTimeout || window.fetch;
        f(url, { headers: { Accept: 'application/json' } })
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
                if (seq !== deepSeq) return;
                var rows = (data && data.results) || [];
                var extra = [];
                for (var i = 0; i < rows.length; i++) {
                    var dn = parseInt(rows[i].designNumber, 10) || 0;
                    if (!dn) continue;
                    var local = DG.search.byDn(dn);
                    // Prefer the indexed record (richer); fall back to a shim so a
                    // server-only hit is still openable.
                    extra.push(local || {
                        dn: dn,
                        name: rows[i].designName || '',
                        company: rows[i].company || '',
                        customerId: parseInt(rows[i].customerId, 10) || 0,
                        rep: '', custType: '',
                        tier: rows[i].maxStitchTier || '',
                        maxStitch: parseInt(rows[i].maxStitchCount, 10) || 0,
                        variantCount: rows[i].variantCount || 1,
                        srcBits: 0,
                        imgUrl: rows[i].thumbnailUrl || rows[i].mockupUrl || rows[i].dstPreviewUrl || '',
                        imgLargeUrl: null,
                        orderCount: 0, lastOrderYYMM: 0, dupGroup: null,
                        _deep: true
                    });
                }
                var seen = {};
                for (var k = 0; k < lastResults.length; k++) seen[lastResults[k].dn] = 1;
                var merged = lastResults.slice();
                var added = 0;
                for (var j = 0; j < extra.length; j++) {
                    if (!seen[extra[j].dn]) { merged.push(extra[j]); added++; }
                }
                lastResults = merged;
                DG.grid.setData(merged);
                els.count.textContent = merged.length.toLocaleString();
                els.deepRow.innerHTML = added
                    ? '<span class="dg-deep-badge"><i class="fas fa-cloud"></i> Deep search</span> added <strong>'
                      + added + '</strong> result' + (added === 1 ? '' : 's') + ' matching threads, DST files, or art notes.'
                    : '<span class="dg-deep-badge"><i class="fas fa-cloud"></i> Deep search</span> found nothing beyond the local matches.';
            })
            .catch(function (err) {
                if (seq !== deepSeq) return;
                // Rule 4: a failed deep search is stated, never shown as "no results".
                els.deepRow.innerHTML = '<span class="dg-section-err"><i class="fas fa-triangle-exclamation"></i> '
                    + 'Deep search failed (' + DG.esc(err.message) + '). Local results are unaffected. '
                    + '<button type="button" class="dash-btn dash-btn--sm" data-deep="1">Retry</button></span>';
            });
    }

    function scheduleAutoDeep(total) {
        clearTimeout(deepTimer);
        if (total === 0 && st.q.length >= 2) deepTimer = setTimeout(runDeepSearch, DEEP_DELAY);
    }

    // ── input handling ──────────────────────────────────────────────────────
    function onInput() {
        st.q = els.omnibox.value.trim();
        els.searchClear.hidden = !st.q;
        if (!rafPending) {
            rafPending = true;
            requestAnimationFrame(function () {
                rafPending = false;
                pushURL(true);
                render();
                var res = DG.search.query(queryState(), 1);
                scheduleAutoDeep(res.total);
            });
        }
    }

    function setCustomer(cid) {
        st.customer = +cid || 0;
        st.q = '';
        els.omnibox.value = '';
        els.searchClear.hidden = true;
        els.customerInput.value = st.customer ? String(st.customer) : '';
        st.design = DG.drawer.isOpen() ? st.design : 0;
        pushURL(false);
        render();
    }

    function openDesign(dn) {
        var list = lastResults.map(function (r) { return r.dn; });
        var idx = list.indexOf(+dn);
        if (DG.drawer.open(dn, { list: list, idx: idx })) {
            st.design = +dn;
            pushURL(false);
        }
    }

    // ── filters ─────────────────────────────────────────────────────────────
    function buildFilterUI() {
        var pills = '<button type="button" class="dg-pill' + (!st.tier ? ' dg-pill--active' : '') + '" data-tier="">All</button>';
        for (var i = 0; i < TIERS.length; i++) {
            pills += '<button type="button" class="dg-pill' + (st.tier === TIERS[i] ? ' dg-pill--active' : '')
                + '" data-tier="' + DG.esc(TIERS[i]) + '">' + DG.esc(TIERS[i]) + '</button>';
        }
        els.tierPills.innerHTML = pills;

        var chips = '';
        for (var j = 0; j < SRC_CHIPS.length; j++) {
            var key = SRC_CHIPS[j][0];
            if (!srcBits[key]) continue;
            chips += '<button type="button" class="dg-chip' + (st.src.indexOf(key) !== -1 ? ' dg-chip--active' : '')
                + '" data-src="' + key + '"><i class="fas ' + SRC_CHIPS[j][2] + '"></i> ' + DG.esc(SRC_CHIPS[j][1]) + '</button>';
        }
        els.srcChips.innerHTML = chips;
        els.hasImage.checked = st.hasImage;
        buildYearSelect();
    }

    function buildYearSelect() {
        var idx = DG.store.getIndex();
        if (!idx || !idx.rows) return;
        var years = {};
        for (var i = 0; i < idx.rows.length; i++) {
            var yymm = idx.rows[i][12] | 0;
            if (yymm) years[Math.floor(yymm / 100)] = 1;
        }
        var keys = Object.keys(years).sort(function (a, b) { return b - a; });
        if (!keys.length) { els.year.hidden = true; return; }
        var html = '<option value="">Any year</option>';
        for (var k = 0; k < keys.length; k++) {
            var full = '20' + (keys[k].length === 1 ? '0' + keys[k] : keys[k]);
            html += '<option value="' + DG.esc(keys[k]) + '"' + (st.year === keys[k] ? ' selected' : '') + '>' + DG.esc(full) + '</option>';
        }
        els.year.innerHTML = html;
        els.year.hidden = false;
    }

    function onToolbarClick(e) {
        var tier = e.target.closest('[data-tier]');
        if (tier) {
            st.tier = tier.getAttribute('data-tier');
            buildFilterUI(); pushURL(true); render(); return;
        }
        var src = e.target.closest('[data-src]');
        if (src) {
            var key = src.getAttribute('data-src');
            var at = st.src.indexOf(key);
            if (at === -1) st.src.push(key); else st.src.splice(at, 1);
            buildFilterUI(); pushURL(true); render(); return;
        }
        var dens = e.target.closest('[data-density]');
        if (dens) {
            DG.grid.setDensity(dens.getAttribute('data-density'));
            syncDensityUI(); return;
        }
    }

    function onTokenClick(e) {
        var tok = e.target.closest('[data-token]');
        if (!tok) return;
        var kind = tok.getAttribute('data-token');
        if (kind === 'all') { st.tier = ''; st.src = []; st.hasImage = false; st.year = ''; }
        else if (kind === 'tier') st.tier = '';
        else if (kind === 'has') st.hasImage = false;
        else if (kind === 'yr') st.year = '';
        else if (kind.indexOf('src:') === 0) {
            var at = st.src.indexOf(kind.slice(4));
            if (at !== -1) st.src.splice(at, 1);
        }
        buildFilterUI(); pushURL(true); render();
    }

    function syncDensityUI() {
        var d = DG.grid.getDensity();
        var btns = els.density.querySelectorAll('[data-density]');
        for (var i = 0; i < btns.length; i++) {
            btns[i].classList.toggle('is-active', btns[i].getAttribute('data-density') === d);
        }
    }

    // ── keyboard ────────────────────────────────────────────────────────────
    function isTyping(t) {
        return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    }

    function onKeydown(e) {
        if ((e.key === '/' && !isTyping(e.target)) || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k')) {
            e.preventDefault();
            els.omnibox.focus();
            els.omnibox.select();
            return;
        }
        if (e.key === 'Escape') {
            // Unwind exactly one level per press.
            if (DG.drawer.lightboxOpen()) return;          // drawer module handles it
            if (DG.drawer.isOpen()) { DG.drawer.close(); st.design = 0; pushURL(false); return; }
            if (st.q) { st.q = ''; els.omnibox.value = ''; els.searchClear.hidden = true; pushURL(true); render(); return; }
            if (st.customer) { setCustomer(0); return; }
            return;
        }
        if (e.key.toLowerCase() === 'c' && !isTyping(e.target) && !e.metaKey && !e.ctrlKey) {
            var dn = 0;
            if (DG.drawer.isOpen()) {
                dn = DG.drawer.currentDn();
            } else if (document.activeElement && document.activeElement.closest) {
                var card = document.activeElement.closest('.dg-card[data-dn]');
                if (card) dn = +card.getAttribute('data-dn');
            }
            if (dn) DG.grid.copyDn(dn);
        }
    }

    // ── boot surfaces ───────────────────────────────────────────────────────
    function showBoot(msg, pct) {
        els.boot.hidden = false;
        els.bootMsg.textContent = msg;
        els.bootBar.style.width = (pct == null ? 8 : Math.max(2, Math.min(100, pct))) + '%';
    }

    function hideBoot() { els.boot.hidden = true; }

    function setFreshness(builtAt) {
        if (!builtAt) { els.freshLabel.textContent = 'Unknown'; return; }
        var age = Date.now() - builtAt;
        var stale = age > STALE_MS;
        var hours = Math.round(age / 3600000);
        var label = hours < 1 ? 'Updated just now' : (hours < 48 ? 'Updated ' + hours + 'h ago' : 'Updated ' + Math.round(hours / 24) + 'd ago');
        els.freshness.classList.toggle('is-stale', stale);
        els.freshness.classList.toggle('is-fresh', !stale);
        els.freshLabel.textContent = label + (stale ? ' · Refresh' : '');
        els.freshness.title = 'Index built ' + new Date(builtAt).toLocaleString();
    }

    function banner(kind, msg) {
        var host = document.getElementById('dg-error');
        if (!host) return;
        host.innerHTML = '<div class="dg-banner dg-banner--' + kind + '">' + DG.esc(msg) + '</div>';
    }

    function clearBanner() {
        var host = document.getElementById('dg-error');
        if (host) host.innerHTML = '';
    }

    // ── store wiring ────────────────────────────────────────────────────────
    function onReady(index) {
        srcBits = index.srcBits || {};
        DG.search.decode(index);
        ready = true;
        hideBoot();
        clearBanner();
        setFreshness(index.builtAt);
        buildFilterUI();
        syncDensityUI();
        render();
        if (st.design) openDesign(st.design);
    }

    function onProgress(loaded, total, phase) {
        if (phase === 'parse') { showBoot('Unpacking designs…', 92); return; }
        if (phase === 'save') { showBoot('Building search…', 97); return; }
        var pct = total ? Math.round((loaded / total) * 88) : null;
        showBoot(total
            ? 'Downloading design index… ' + Math.round(loaded / 1024) + ' KB of ' + Math.round(total / 1024) + ' KB'
            : 'Downloading design index… ' + Math.round(loaded / 1024) + ' KB', pct);
    }

    function onError(err, meta) {
        meta = meta || {};
        if (meta.degraded === 'no-persist') {
            banner('info', 'Private browsing: the index will re-download each visit.');
            return;
        }
        if (meta.hasCache) {
            banner('warn', 'Server unreachable — showing the cached index. Deep search and design detail may fail. (' + err.message + ')');
            return;
        }
        hideBoot();
        els.boot.hidden = false;
        els.bootRetry.hidden = false;
        els.bootMsg.textContent = meta.building
            ? 'The design index is building on the server. This takes a minute or two on a fresh deploy.'
            : 'Design index unavailable: ' + err.message;
        els.bootBar.style.width = '100%';
        if (window.DashPage && DashPage.showError) {
            DashPage.showError('Design index unavailable — ' + err.message);
        }
    }

    function wireStore() {
        DG.store.init({
            onProgress: onProgress,
            onReady: onReady,
            onRecentMerged: function (n) {
                if (!n) return;
                if (window.ToastNotifications) ToastNotifications.info(n + ' design' + (n === 1 ? '' : 's') + ' updated since the last index build.');
                var idx = DG.store.getIndex();
                if (idx) { DG.search.decode(idx); render(); }
            },
            onStale: function () { els.freshness.classList.add('is-stale'); },
            onError: onError
        });
    }

    // ── init ────────────────────────────────────────────────────────────────
    function init() {
        els.boot = document.getElementById('dg-boot');
        els.bootMsg = document.getElementById('dg-boot-msg');
        els.bootBar = document.getElementById('dg-boot-bar');
        els.bootRetry = document.getElementById('dg-boot-retry');
        els.omnibox = document.getElementById('dg-omnibox');
        els.searchClear = document.getElementById('dg-search-clear');
        els.customerInput = document.getElementById('dg-customer-input');
        els.customerLoad = document.getElementById('dg-customer-load');
        els.tierPills = document.getElementById('dg-tier-pills');
        els.srcChips = document.getElementById('dg-src-chips');
        els.hasImage = document.getElementById('dg-has-image');
        els.year = document.getElementById('dg-year-select');
        els.density = document.getElementById('dg-density');
        els.tokens = document.getElementById('dg-filter-tokens');
        els.browse = document.getElementById('dg-browse');
        els.results = document.getElementById('dg-results');
        els.portfolio = document.getElementById('dg-portfolio');
        els.count = document.getElementById('dg-count');
        els.ms = document.getElementById('dg-ms');
        els.deepRow = document.getElementById('dg-deep-row');
        els.customerBanner = document.getElementById('dg-customer-banner');
        els.freshness = document.getElementById('dg-freshness');
        els.freshLabel = document.getElementById('dg-freshness-label');

        if (!(window.APP_CONFIG && APP_CONFIG.API && APP_CONFIG.API.BASE_URL)) {
            showBoot('Configuration failed to load — refresh the page.', 100);
            els.bootRetry.hidden = false;
            els.bootRetry.addEventListener('click', function () { window.location.reload(); });
            if (window.DashPage && DashPage.showError) DashPage.showError('Configuration failed to load — refresh the page.');
            return;
        }

        readURL();
        els.omnibox.value = st.q;
        els.searchClear.hidden = !st.q;
        if (st.customer) els.customerInput.value = String(st.customer);
        showBoot('Preparing the design index…', 5);

        DG.grid.init({
            onOpen: openDesign,
            onCustomerClick: setCustomer
        });
        DG.rails.init({
            onOpen: openDesign,
            onCustomerClick: setCustomer
        });
        DG.drawer.init({
            onNavigate: function (dn) { st.design = +dn || 0; pushURL(false); },
            onCustomerClick: function (cid) { DG.drawer.close(); setCustomer(cid); }
        });

        els.omnibox.addEventListener('input', onInput);
        els.searchClear.addEventListener('click', function () {
            st.q = ''; els.omnibox.value = ''; els.searchClear.hidden = true;
            els.omnibox.focus(); pushURL(true); render();
        });
        els.customerLoad.addEventListener('click', function () {
            var v = parseInt(els.customerInput.value, 10) || 0;
            if (!v) { if (window.ToastNotifications) ToastNotifications.info('Enter a customer number first.'); return; }
            setCustomer(v);
        });
        els.customerInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); els.customerLoad.click(); }
        });
        els.tierPills.addEventListener('click', onToolbarClick);
        els.srcChips.addEventListener('click', onToolbarClick);
        els.density.addEventListener('click', onToolbarClick);
        els.tokens.addEventListener('click', onTokenClick);
        els.hasImage.addEventListener('change', function () {
            st.hasImage = els.hasImage.checked; pushURL(true); render();
        });
        els.year.addEventListener('change', function () {
            st.year = els.year.value; pushURL(true); render();
        });
        els.deepRow.addEventListener('click', function (e) {
            if (e.target.closest('[data-deep]')) runDeepSearch();
        });
        els.customerBanner.addEventListener('click', function (e) {
            var c = e.target.closest('[data-customer]');
            if (c) setCustomer(+c.getAttribute('data-customer'));
        });
        els.portfolio.addEventListener('click', function (e) {
            if (e.target.closest('[data-exit-customer]')) setCustomer(0);
        });
        els.freshness.addEventListener('click', function () {
            if (!ready) return;
            showBoot('Refreshing the design index…', 10);
            DG.store.refresh().then(function () { hideBoot(); }).catch(function () { hideBoot(); });
        });
        els.bootRetry.addEventListener('click', function () { window.location.reload(); });

        document.addEventListener('keydown', onKeydown);
        window.addEventListener('popstate', function () {
            readURL();
            els.omnibox.value = st.q;
            els.searchClear.hidden = !st.q;
            els.customerInput.value = st.customer ? String(st.customer) : '';
            buildFilterUI();
            render();
            if (st.design) { if (DG.drawer.currentDn() !== st.design) openDesignSilent(st.design); }
            else DG.drawer.close();
        });
        window.addEventListener('offline', function () { banner('info', 'Offline — the cached index still works; images and detail may not load.'); });
        window.addEventListener('online', clearBanner);

        wireStore();
    }

    /** Open without pushing history — used when history itself moved us. */
    function openDesignSilent(dn) {
        var list = lastResults.map(function (r) { return r.dn; });
        DG.drawer.open(dn, { list: list, idx: list.indexOf(+dn) });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    window.DG.app = { render: render, state: st };
})();
