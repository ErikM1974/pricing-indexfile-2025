/**
 * Design Vault — browse rails (window.DG.rails)
 *
 * The page is never empty: before a single keystroke this renders the stat
 * strip, two curated rails, a top-clients row, and a date-seeded wall so staff
 * rediscover work they forgot existed. Everything comes from the already-loaded
 * local index — zero API calls, zero Caspio cost.
 *
 * Cards render through DG.grid.cardHTML so a rail card and a result card can
 * never drift apart. Click handling is delegated on the rails root; nothing
 * here builds an inline handler.
 *
 * Depends: DG.search (stats/slice/topCompanies), DG.grid (cardHTML/tileHTML), DG.esc.
 * Contract: scratchpad DG-CONTRACTS.md §DG.rails.
 */
(function () {
    'use strict';

    window.DG = window.DG || {};

    var FRESH_COUNT = 24;
    var STITCHED_COUNT = 24;
    var CLIENT_COUNT = 12;
    var WALL_COUNT = 48;

    var root = null;
    var cbs = { onOpen: null, onCustomerClick: null };
    var wallSeed = 0;
    var wired = false;

    /** YYYYMMDD for today — stable all day, new every morning. */
    function todaySeed() {
        var d = new Date();
        return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    }

    function railHTML(id, icon, title, sub, bodyHTML, opts) {
        opts = opts || {};
        var nav = opts.nav === false ? '' :
            '<div class="dg-rail-nav">'
            + '<button type="button" class="dg-rail-btn" data-rail-scroll="-1" data-rail="' + id + '" aria-label="Scroll left"><i class="fas fa-chevron-left"></i></button>'
            + '<button type="button" class="dg-rail-btn" data-rail-scroll="1" data-rail="' + id + '" aria-label="Scroll right"><i class="fas fa-chevron-right"></i></button>'
            + '</div>';
        var extra = opts.action || '';
        return '<section class="dg-rail" data-rail-section="' + id + '">'
            + '<div class="dg-rail-head">'
            + '<h2><i class="fas ' + icon + '"></i> ' + DG.esc(title) + '</h2>'
            + (sub ? '<span class="dg-rail-sub">' + DG.esc(sub) + '</span>' : '')
            + extra + nav
            + '</div>'
            + bodyHTML
            + '</section>';
    }

    function trackHTML(id, recs) {
        var html = '<div class="dg-rail-track" id="dg-rail-' + id + '">';
        for (var i = 0; i < recs.length; i++) html += DG.grid.cardHTML(recs[i], -1);
        return html + '</div>';
    }

    function statStrip() {
        var s = DG.search.stats();
        function card(value, label, mod) {
            return '<div class="dash-stat-card' + (mod ? ' ' + mod : '') + '">'
                + '<div class="dash-stat-value dg-mono">' + DG.esc(value) + '</div>'
                + '<div class="dash-stat-label">' + DG.esc(label) + '</div>'
                + '</div>';
        }
        return '<div class="dg-stat-strip">'
            + card(s.groups.toLocaleString(), 'Designs', 'is-accent')
            + card(s.companies.toLocaleString(), 'Companies')
            + card(s.withImagePct + '%', 'With images')
            + card(s.multiFileCount.toLocaleString(), 'Multi-file designs')
            + '</div>';
    }

    /** Newest = highest design number; ShopWorks issues ids sequentially. */
    function freshest(n) {
        return DG.search.query({ sort: 'newest' }, n).results;
    }

    function recentlyStitched(n) {
        var res = DG.search.query({ sort: 'activity' }, n * 3).results;
        var out = [];
        for (var i = 0; i < res.length && out.length < n; i++) {
            if (res[i].orderCount > 0 && res[i].lastOrderYYMM > 0) out.push(res[i]);
        }
        return out;
    }

    function clientTiles() {
        var list = DG.search.topCompanies(CLIENT_COUNT);
        if (!list.length) return '';
        var html = '<div class="dg-rail-track" id="dg-rail-clients">';
        for (var i = 0; i < list.length; i++) {
            var c = list[i];
            var cells = '';
            for (var j = 0; j < 4; j++) {
                var u = c.sampleImgUrls[j];
                cells += u
                    ? '<img src="' + DG.esc(u) + '" alt="" loading="lazy" decoding="async">'
                    : '<span class="dg-card-tile dg-tile-' + ((i + j) % 8) + '"></span>';
            }
            html += '<button type="button" class="dg-collage"'
                + (c.customerId ? ' data-customer="' + (+c.customerId) + '"' : '')
                + ' aria-label="' + DG.esc('Open ' + c.company + ' — ' + c.count + ' designs') + '">'
                + '<span class="dg-collage-grid">' + cells + '</span>'
                + '<span class="dg-collage-name">' + DG.esc(c.company) + '</span>'
                + '<span class="dg-collage-count dg-mono">' + c.count.toLocaleString() + ' designs</span>'
                + '</button>';
        }
        return html + '</div>';
    }

    function wallHTML() {
        var recs = DG.search.slice({ seed: wallSeed, count: WALL_COUNT });
        if (!recs.length) return '';
        var html = '<div class="dg-wall-grid">';
        for (var i = 0; i < recs.length; i++) html += DG.grid.cardHTML(recs[i], -1);
        return html + '</div>';
    }

    function skeleton() {
        var cells = '';
        for (var i = 0; i < 8; i++) cells += '<div class="dg-skel"></div>';
        return '<div class="dg-rail-track">' + cells + '</div>';
    }

    function onClick(e) {
        var scroller = e.target.closest('[data-rail-scroll]');
        if (scroller) {
            var track = document.getElementById('dg-rail-' + scroller.getAttribute('data-rail'));
            if (track) track.scrollBy({ left: (+scroller.getAttribute('data-rail-scroll')) * Math.max(240, track.clientWidth * 0.8), behavior: 'smooth' });
            return;
        }
        if (e.target.closest('[data-shuffle]')) {
            wallSeed = (wallSeed * 1664525 + 1013904223) >>> 0;   // LCG step — new wall, still deterministic
            var host = root.querySelector('[data-rail-section="wall"]');
            if (host) host.outerHTML = wallSection();
            return;
        }
        var copyBtn = e.target.closest('[data-copy-dn]');
        if (copyBtn) { DG.grid.copyDn(+copyBtn.getAttribute('data-copy-dn')); return; }
        var cust = e.target.closest('[data-customer]');
        if (cust && cbs.onCustomerClick) { cbs.onCustomerClick(+cust.getAttribute('data-customer')); return; }
        var card = e.target.closest('.dg-card[data-dn]');
        if (card && cbs.onOpen) cbs.onOpen(+card.getAttribute('data-dn'));
    }

    function wallSection() {
        return railHTML('wall', 'fa-shapes', "Today's wall", WALL_COUNT + ' designs, reshuffled every morning', wallHTML(), {
            nav: false,
            action: '<button type="button" class="dash-btn dg-rail-shuffle" data-shuffle="1"><i class="fas fa-shuffle"></i> Shuffle</button>'
        });
    }

    function init(opts) {
        opts = opts || {};
        root = document.querySelector(opts.container || '#dg-browse');
        cbs.onOpen = opts.onOpen || null;
        cbs.onCustomerClick = opts.onCustomerClick || null;
        wallSeed = todaySeed();
        if (root && !wired) { root.addEventListener('click', onClick); wired = true; }
        if (root) root.innerHTML = skeleton();
    }

    function render() {
        if (!root) return;
        var html = statStrip();

        var fresh = freshest(FRESH_COUNT);
        if (fresh.length) {
            html += railHTML('fresh', 'fa-wand-magic-sparkles', 'Fresh off the digitizer',
                'Newest ' + fresh.length + ' designs', trackHTML('fresh', fresh));
        }

        // Hidden entirely when the index carries no order history — an empty
        // rail would imply "nothing was stitched", which isn't what we know.
        var stitched = recentlyStitched(STITCHED_COUNT);
        if (stitched.length) {
            html += railHTML('stitched', 'fa-clock-rotate-left', 'Recently stitched',
                'Last ordered', trackHTML('stitched', stitched));
        }

        var clients = clientTiles();
        if (clients) {
            html += railHTML('clients', 'fa-building', 'Top clients', 'By design count', clients);
        }

        html += wallSection();
        root.innerHTML = html;
    }

    window.DG.rails = { init: init, render: render };
})();
