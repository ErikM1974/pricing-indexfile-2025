/**
 * design-queue-metrics.js — the "253gear.com right now" panel on the Design Queue.
 *
 * 🔴 THE ONE RULE HERE. A block we are not permitted to read must NEVER render as a
 * number. Not 0, not "—", not a flat line. The upstream returns either
 * {available:true, ...} or {available:false, missing:[...], howToFix:[...]}, and those
 * two get visibly different treatments: real figures, or a bordered notice naming the
 * scope and the fix.
 *
 * Why this matters more than it sounds: a "Visitors: 0" tile is indistinguishable from
 * a real measurement, and somebody will conclude the store is dead and act on it. The
 * store is not dead — we simply cannot see the number yet. Same class of bug as the
 * sanitiser that turned a missing stitch count into the fact "0 stitches".
 *
 * WHAT IS AVAILABLE TODAY: the catalogue block only. Sessions need `read_reports` and
 * sales need `read_orders`; neither is granted to the 253Gear Publisher app, and
 * read_reports additionally requires Level 2 protected customer data approval. The
 * panel says so on its face rather than shipping empty tiles.
 */
(function () {
    'use strict';

    var URL_PATH = '/api/gear/store-metrics';

    document.addEventListener('DOMContentLoaded', function () {
        load();
        var btn = document.getElementById('metrics-refresh');
        if (btn) btn.addEventListener('click', function () { load(true); });
    });

    async function load(force) {
        var root = document.getElementById('metrics-root');
        if (!root) return;
        root.classList.add('dash-loading');
        root.textContent = 'Reading the store…';
        try {
            var res = await fetch(URL_PATH + (force ? '?refresh=true' : ''), {
                cache: 'no-store',
                signal: AbortSignal.timeout(50000)
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            var data = await res.json();
            if (!data || data.success === false) throw new Error((data && data.error) || 'bad payload');
            render(root, data);
        } catch (err) {
            console.error('[design-queue-metrics]', err);
            root.classList.remove('dash-loading');
            root.innerHTML = '';
            // Never a stale or invented figure — say it failed and why.
            root.appendChild(notice('warn', 'Could not read the store',
                ['The Shopify read failed: ' + String(err.message || err) + '. Nothing below is a '
                 + 'measurement — refresh, and if it persists the proxy or the Shopify credential '
                 + 'needs a look.']));
        }
    }

    function render(root, d) {
        root.classList.remove('dash-loading');
        root.innerHTML = '';

        if (d.catalogue) root.appendChild(catalogueBlock(d.catalogue));
        root.appendChild(gatedBlock('Visitors and traffic sources', d.traffic,
            'Shopify counts these whether or not Google Analytics is installed — this is a '
            + 'permission on our app, not a tracking gap.'));
        root.appendChild(gatedBlock('Units sold per design', d.sales,
            'This is the number that should decide what gets drawn next. A session is interest; '
            + 'a sale is the thing itself.'));

        root.appendChild(leaksBlock(d.leaks));

        var f = el('p', 'dq-note dq-metrics-foot');
        f.textContent = 'Read live from Shopify' + (d.cached ? ' (cached up to 5 min)' : '')
            + '. Window: last ' + (d.windowDays || 30) + ' days.';
        root.appendChild(f);
    }

    function catalogueBlock(c) {
        var wrap = el('div', 'dq-metrics-block');
        if (!c.available) {
            wrap.appendChild(notice('warn', 'Catalogue unreadable',
                [c.error || 'No read_products access.']));
            return wrap;
        }

        var grid = el('div', 'dq-metrics-grid');
        grid.appendChild(tile(c.activeProducts, 'live products', null));
        grid.appendChild(tile(c.medianWords, 'median words', c.medianWords < 300 ? 'warn' : null));
        grid.appendChild(tile(c.thinCopy.count, 'under 300 words', c.thinCopy.count ? 'warn' : 'good'));
        grid.appendChild(tile(c.draftProducts, 'drafts', null));
        wrap.appendChild(grid);

        // The actionable line. Thin copy is the cheapest ranking work available —
        // no drawing required, and the words are what rank.
        if (c.thinCopy.count) {
            var p = el('p', 'dq-note');
            p.textContent = c.thinCopy.count + ' live product'
                + (c.thinCopy.count === 1 ? '' : 's') + ' carry under 300 words. That is the '
                + 'cheapest ranking work on the store — no new drawing needed. Starting with: '
                + c.thinCopy.titles.slice(0, 3).join('; ') + '.';
            wrap.appendChild(p);
        }

        // Both of these are silent killers, so they only appear when real.
        if (c.activeButUnpublished && c.activeButUnpublished.count) {
            wrap.appendChild(notice('warn', c.activeButUnpublished.count + ' ACTIVE but never published',
                ['These 404 on the storefront. Status ACTIVE alone does not publish a product — '
                 + 'publishedAt has to be set. ' + c.activeButUnpublished.titles.slice(0, 4).join('; ')]));
        }
        if (c.noFeaturedImage) {
            wrap.appendChild(notice('warn', c.noFeaturedImage + ' with no featured image', []));
        }
        if (c.missingSeoTitle || c.missingSeoDescription) {
            wrap.appendChild(notice('warn', 'Missing SEO fields',
                [c.missingSeoTitle + ' without an SEO title, ' + c.missingSeoDescription
                 + ' without a meta description. Google renders the raw product title instead — '
                 + 'design number and all.']));
        }
        return wrap;
    }

    /**
     * A block we may not be able to read. The whole point of this function is that the
     * unavailable branch produces PROSE, never a figure — so it can't be misread as data.
     */
    function gatedBlock(title, block, why) {
        var wrap = el('div', 'dq-metrics-block');
        wrap.appendChild(el('h3', 'dq-metrics-title', title));

        if (!block) {
            wrap.appendChild(notice('warn', 'Not reported', ['The server did not return this block.']));
            return wrap;
        }

        if (!block.available) {
            var lines = [];
            if (why) lines.push(why);
            if (block.note) lines.push(block.note);
            if (block.error) lines.push(block.error);
            (block.howToFix || []).forEach(function (h) { lines.push(h); });
            var missing = (block.missing || []).join(', ');
            wrap.appendChild(notice('locked',
                missing ? 'Locked — needs ' + missing : 'Not available', lines));
            return wrap;
        }

        // Available.
        if (block.totals && block.totals.rows && block.totals.rows.length) {
            var total = block.totals.rows[0] && block.totals.rows[0][0];
            var grid = el('div', 'dq-metrics-grid');
            grid.appendChild(tile(total, 'sessions, ' + block.windowDays + 'd', null));
            wrap.appendChild(grid);
        }

        // A single day carrying a quarter or more of the window is a bot sweep far more
        // often than an audience. Say so next to the headline, not in a footnote —
        // an unflagged spike is how "traffic tripled" survives into a meeting.
        if (block.spike) {
            wrap.appendChild(notice('warn', 'One day is ' + block.spike.shareOfWindow + '% of that total',
                [block.spike.day + ' alone recorded ' + block.spike.sessions + ' sessions against single '
                 + 'and double digits on every other day. A spike that shape is usually a crawler or a '
                 + 'scrape, not people. Treat the headline number as an upper bound until it is explained.']));
        }

        if (block.bySource && block.bySource.rows && block.bySource.rows.length) {
            wrap.appendChild(el('div', 'dq-metrics-sub', 'Where they came from'));
            wrap.appendChild(rowsTable(block.bySource.columns, block.bySource.rows));
        }
        if (block.byReferrer && block.byReferrer.rows && block.byReferrer.rows.length) {
            wrap.appendChild(el('div', 'dq-metrics-sub', 'Named referrers'));
            wrap.appendChild(rowsTable(block.byReferrer.columns, block.byReferrer.rows));
        }
        // The block Steve should read first: a design whose page nobody lands on is a
        // drawing, not a product.
        if (block.byLanding && block.byLanding.rows && block.byLanding.rows.length) {
            wrap.appendChild(el('div', 'dq-metrics-sub', 'Pages people actually land on'));
            wrap.appendChild(rowsTable(block.byLanding.columns, block.byLanding.rows));
        }
        if (typeof block.orders === 'number') {
            var g2 = el('div', 'dq-metrics-grid');
            g2.appendChild(tile(block.orders, 'orders, ' + block.windowDays + 'd', null));
            g2.appendChild(tile(block.units, 'units', null));
            wrap.appendChild(g2);
        }
        if (block.topDesigns && block.topDesigns.length) {
            wrap.appendChild(rowsTable(['Design', 'Units'],
                block.topDesigns.map(function (t) { return [t.title, t.units]; })));
        } else if (block.available && typeof block.orders === 'number' && block.orders === 0) {
            // A REAL zero — inside available:true, so it is a measurement and says so.
            wrap.appendChild(el('p', 'dq-note',
                'No orders in the last ' + block.windowDays + ' days. That is a measured zero, '
                + 'not a missing reading.'));
        }
        return wrap;
    }

    /**
     * Where traffic is being lost. Deliberately the loudest block on the page.
     *
     * It exists because no amount of drawing fixes it: on the first run, 76% of everything
     * landing on a product URL never reached a live product. A new design cannot help a
     * visitor who is looking at a 404, and nothing else on this dashboard would have said so.
     */
    function leaksBlock(block) {
        var wrap = el('div', 'dq-metrics-block');
        wrap.appendChild(el('h3', 'dq-metrics-title', 'Where traffic is being lost'));

        if (!block) {
            wrap.appendChild(notice('warn', 'Not reported', ['The server did not return this block.']));
            return wrap;
        }
        if (!block.available) {
            var lines = [];
            if (block.note) lines.push(block.note);
            (block.howToFix || []).forEach(function (h) { lines.push(h); });
            if (block.error) lines.push(block.error);
            wrap.appendChild(notice('locked',
                (block.missing || []).length ? 'Locked — needs ' + block.missing.join(', ') : 'Not available', lines));
            return wrap;
        }

        var s = block.summary || {};
        var grid = el('div', 'dq-metrics-grid');
        grid.appendChild(tile(s.brokenPercent + '%', 'of product traffic broken', s.brokenPercent >= 25 ? 'warn' : null));
        grid.appendChild(tile(s.lostTo404, 'sessions hit a 404', s.lostTo404 ? 'warn' : 'good'));
        grid.appendChild(tile(s.misrouted, 'sent to the wrong product', s.misrouted ? 'warn' : 'good'));
        grid.appendChild(tile(s.reachingALivePage, 'reached a live page', null));
        wrap.appendChild(grid);

        if ((block.dead || []).length) {
            wrap.appendChild(el('div', 'dq-metrics-sub', 'Dead URLs — no product, no redirect'));
            wrap.appendChild(rowsTable(['Path', 'Sessions, 90d'],
                block.dead.map(function (x) { return [x.path, x.sessions]; })));
            // The blank-SKU pattern is the whole story here and it is a business call, not
            // an SEO fix — so it is stated rather than silently "fixed" with a redirect to
            // a nostalgia tee, which would just be a prettier dead end.
            wrap.appendChild(notice('warn', 'These are blank garment style numbers',
                ['PC54, PC147, BC3001 and the rest are Port & Company, Bella+Canvas and Nike style '
                 + 'codes. The people searching them want blanks, not a nostalgia tee — so pointing '
                 + 'them at one would not convert. But NWCA prints on exactly these garments, which '
                 + 'makes this a decision about where they should go, not a broken link to patch.']));
        }

        if ((block.misrouted || []).length) {
            wrap.appendChild(el('div', 'dq-metrics-sub', 'Redirects pointing at the wrong product'));
            wrap.appendChild(rowsTable(['Path', 'Goes to', 'Why it is flagged', 'Sessions'],
                block.misrouted.map(function (x) { return [x.path, x.target, x.why, x.sessions]; })));
            wrap.appendChild(el('p', 'dq-notice-line',
                'Cause: duplicating a product in the Shopify admin makes a "copy-of-" handle, and '
                + 'renaming the duplicate auto-creates a redirect from it. Correct for Shopify, wrong '
                + 'once Google has indexed the old URL under the original name. A redirect whose '
                + 'design number changes is the reliable tell.'));
        }

        if ((block.trafficNoSales || []).length) {
            wrap.appendChild(el('div', 'dq-metrics-sub', 'Found, but not bought'));
            wrap.appendChild(rowsTable(['Design', 'Sessions, 90d'],
                block.trafficNoSales.map(function (x) { return [x.title, x.sessions]; })));
            wrap.appendChild(el('p', 'dq-notice-line',
                'People reach these pages and leave. That is a page problem — copy, photos, price, '
                + 'or a colour with no photograph behind it — not a reason to draw something new.'));
        }

        if (block.noTraffic && block.noTraffic.count) {
            wrap.appendChild(notice('warn', block.noTraffic.count + ' live designs got no traffic at all',
                ['Nobody landed on them once in 90 days. That is findability, and it is the opposite '
                 + 'problem to the list above: those pages need to exist in search before anything '
                 + 'else about them matters. Starting with: '
                 + block.noTraffic.sample.slice(0, 4).map(function (x) { return x.title; }).join('; ')]));
        }

        return wrap;
    }

    function rowsTable(cols, rows) {
        var scroll = el('div', 'dq-metrics-scroll');
        var t = document.createElement('table');
        t.className = 'dq-metrics-table';
        var thead = document.createElement('thead');
        var htr = document.createElement('tr');
        (cols || []).forEach(function (c) {
            var th = document.createElement('th');
            th.textContent = String(c);
            htr.appendChild(th);
        });
        thead.appendChild(htr);
        t.appendChild(thead);
        var tb = document.createElement('tbody');
        (rows || []).slice(0, 12).forEach(function (r) {
            var tr = document.createElement('tr');
            (Array.isArray(r) ? r : [r]).forEach(function (cell) {
                var td = document.createElement('td');
                td.textContent = cell === null || cell === undefined ? '' : String(cell);
                tr.appendChild(td);
            });
            tb.appendChild(tr);
        });
        t.appendChild(tb);
        scroll.appendChild(t);
        return scroll;
    }

    function tile(value, label, state) {
        var d = el('div', 'dq-metric' + (state ? ' dq-metric--' + state : ''));
        d.appendChild(el('div', 'dq-metric-value', value === null || value === undefined ? '?' : String(value)));
        d.appendChild(el('div', 'dq-metric-label', label));
        return d;
    }

    function notice(kind, heading, lines) {
        var n = el('div', 'dq-notice dq-notice--' + kind);
        n.appendChild(el('div', 'dq-notice-head', heading));
        (lines || []).forEach(function (l) { n.appendChild(el('p', 'dq-notice-line', l)); });
        return n;
    }

    /* textContent only — never innerHTML with data (CLAUDE.md XSS rule) */
    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== null && text !== undefined) n.textContent = text;
        return n;
    }
})();
