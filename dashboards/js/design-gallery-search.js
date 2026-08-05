/**
 * design-gallery-search.js — Design Vault pure search core (DG.search + DG.esc)
 *
 * PURE data module: no DOM, no fetch, no timers. Decodes the positional wire
 * index served by GET /api/design-search/index — rows =
 *   [dn, name, company, custId, repIdx, custTypeIdx, tierIdx, maxStitch,
 *    variantCount, srcBits, imgRef, orderCount, lastOrderYYMM], sorted by dn —
 * and answers everything the gallery UI asks: ranked instant search, filter
 * composition, stat strip counts, top-company collages, customer portfolios,
 * the seeded daily wall, and the /recent delta-merge that DG.store applies
 * between full index rebuilds.
 *
 * Ranking is CONTRACT-LOCKED (tests/unit/design-search-core.test.js):
 *   dn exact 1000 > dn prefix 600 > company word-prefix 400 >
 *   name word-prefix 350 > company substring 200 > name substring 150.
 *   Multi-token queries AND (every token must match somewhere on the row);
 *   ties break orderCount desc, then lastOrderYYMM desc, then dn desc.
 *
 * imgRef expansion: "f:<key>" -> BASE/api/files/<key> · "b:<id>" ->
 * BASE/api/box/thumbnail/<id> (+ ?size=large hi-res) · "u:<url>" as-is ·
 * "" -> none. BASE = APP_CONFIG.API.BASE_URL, read lazily at decode() time
 * (DG.app halts boot before decode if config is missing — rule 6).
 *
 * Dual export: attaches DG.search + DG.esc in the browser AND module.exports
 * for jest (same pattern as shared_components/js/quote-cart-engine.js).
 */
(function (global) {
    'use strict';

    // ── shared escaper (every DG module renders dynamic text through this) ──
    var ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC_MAP[c]; });
    }
    esc.attr = esc; // same rules cover attribute contexts (quotes are escaped)

    // Column positions in a wire row — the positional contract, never reorder.
    var COL = {
        DN: 0, NAME: 1, COMPANY: 2, CUST: 3, REP: 4, CTYPE: 5, TIER: 6,
        STITCH: 7, VARIANTS: 8, SRC: 9, IMG: 10, ORDERS: 11, LAST: 12
    };
    var ROW_LEN = 13;

    // Module state, rebuilt on every decode() (store re-decodes after merges).
    var S = null;

    function resolveBase() {
        var w = (typeof window !== 'undefined') ? window : global;
        if (w && w.APP_CONFIG && w.APP_CONFIG.API && w.APP_CONFIG.API.BASE_URL) {
            return w.APP_CONFIG.API.BASE_URL;
        }
        return ''; // never hit in the browser: DG.app halts boot when config is absent
    }

    function expandImgRef(ref, base) {
        if (!ref) return { url: '', large: null };
        if (ref.lastIndexOf('f:', 0) === 0) {
            return { url: base + '/api/files/' + ref.slice(2), large: null };
        }
        if (ref.lastIndexOf('b:', 0) === 0) {
            var u = base + '/api/box/thumbnail/' + ref.slice(2);
            return { url: u, large: u + '?size=large' };
        }
        if (ref.lastIndexOf('u:', 0) === 0) {
            return { url: ref.slice(2), large: null };
        }
        return { url: '', large: null }; // unknown scheme = treat as no image
    }

    // Normalize for matching: lowercase, non-alphanumerics collapse to single
    // spaces — so "J&B Fasteners" and a query of "j b" line up on word starts.
    function normText(s) {
        return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }

    function wordPrefix(norm, tok) {
        if (!norm) return false;
        return norm.lastIndexOf(tok, 0) === 0 || norm.indexOf(' ' + tok) !== -1;
    }

    function buildDupMap(clusters) {
        var m = new Map();
        (clusters || []).forEach(function (cluster) {
            (cluster || []).forEach(function (dn) { m.set(dn, cluster); });
        });
        return m;
    }

    // ── decode: wire index → decoded records + lookup structures ──
    function decode(index) {
        if (!index || !Array.isArray(index.rows)) {
            throw new Error('DG.search.decode: index.rows is not an array');
        }
        var base = resolveBase();
        var dup = (index.dupByDn instanceof Map) ? index.dupByDn : buildDupMap(index.dupClusters);
        var dicts = index.dicts || {};
        var reps = dicts.reps || [];
        var custTypes = dicts.custTypes || [];
        var tiers = dicts.tiers || [];
        var rows = index.rows;

        var recs = new Array(rows.length);
        var byDnMap = new Map();
        var customers = new Map();  // customerId -> { company, count }
        var companyKeys = new Set();
        var withImg = 0, multiFile = 0;

        for (var i = 0; i < rows.length; i++) {
            var r = rows[i];
            var img = expandImgRef(r[COL.IMG] || '', base);
            var rec = {
                dn: r[COL.DN],
                name: r[COL.NAME] || '',
                company: r[COL.COMPANY] || '',
                customerId: r[COL.CUST] || 0,
                rep: reps[r[COL.REP]] || '',
                custType: custTypes[r[COL.CTYPE]] || '',
                tier: tiers[r[COL.TIER]] || '',
                maxStitch: r[COL.STITCH] || 0,
                variantCount: r[COL.VARIANTS] || 0,
                srcBits: r[COL.SRC] || 0,
                imgUrl: img.url,
                imgLargeUrl: img.large,
                orderCount: r[COL.ORDERS] || 0,
                lastOrderYYMM: r[COL.LAST] || 0,
                dupGroup: dup.get(r[COL.DN]) || null
            };
            rec._dnStr = String(rec.dn);
            rec._nameN = normText(rec.name);
            rec._compN = normText(rec.company);

            recs[i] = rec;
            byDnMap.set(rec.dn, rec);
            if (rec.imgUrl) withImg++;
            if (rec.variantCount > 1) multiFile++;
            var ckey = rec.customerId > 0 ? 'c' + rec.customerId : (rec._compN ? 'n' + rec._compN : '');
            if (ckey) companyKeys.add(ckey);
            if (rec.customerId > 0) {
                var c = customers.get(rec.customerId);
                if (c) { c.count++; if (!c.company && rec.company) c.company = rec.company; }
                else customers.set(rec.customerId, { company: rec.company, count: 1 });
            }
        }

        S = {
            recs: recs, byDn: byDnMap, customers: customers,
            stats: {
                groups: recs.length,
                companies: companyKeys.size,
                withImagePct: recs.length ? Math.round((withImg / recs.length) * 100) : 0,
                multiFileCount: multiFile
            }
        };
        return {
            size: recs.length,
            get: function (i) { return S.recs[i] || null; },
            byDn: function (dn) { return S.byDn.get(dn) || null; }
        };
    }

    function requireDecoded(fn) {
        if (!S) throw new Error('DG.search.' + fn + ': call decode(index) first');
    }

    // ── ranked query with AND-composed filters ──
    function scoreRec(rec, tokens) {
        var total = 0;
        for (var t = 0; t < tokens.length; t++) {
            var tok = tokens[t];
            var best = 0;
            if (tok.digits) {
                if (rec._dnStr === tok.t) best = 1000;
                else if (rec._dnStr.lastIndexOf(tok.t, 0) === 0) best = 600;
            }
            if (best < 400 && wordPrefix(rec._compN, tok.t)) best = 400;
            if (best < 350 && wordPrefix(rec._nameN, tok.t)) best = 350;
            if (best < 200 && rec._compN.indexOf(tok.t) !== -1) best = 200;
            if (best < 150 && rec._nameN.indexOf(tok.t) !== -1) best = 150;
            if (!best) return 0; // AND: every token must land somewhere
            total += best;
        }
        return total;
    }

    function query(state, limit) {
        requireDecoded('query');
        state = state || {};
        var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

        var qRaw = String(state.q || '').trim();
        var tokens = qRaw ? normText(qRaw).split(' ').filter(Boolean).map(function (t) {
            return { t: t, digits: /^\d+$/.test(t) };
        }) : [];
        // Raw digit runs also rank as dn matches even when glued to letters after
        // normalisation; a fully-numeric q additionally probes the customer map.
        var customerHit = null;
        if (/^\d+$/.test(qRaw)) {
            var cid = parseInt(qRaw, 10);
            var cust = S.customers.get(cid);
            if (cust && cust.count >= 1) {
                customerHit = { customerId: cid, company: cust.company, count: cust.count };
            }
        }

        var tierWant = state.tier || '';
        var srcMask = state.srcMask | 0;
        var wantImage = state.hasImage === true;
        var year = parseInt(state.year, 10) || 0;
        var yy = year > 100 ? year % 100 : year; // accept 2025 or 25
        var custWant = parseInt(state.customerId, 10) || 0;

        var hits = [];
        for (var i = 0; i < S.recs.length; i++) {
            var rec = S.recs[i];
            if (tierWant && rec.tier !== tierWant) continue;
            if (srcMask && (rec.srcBits & srcMask) === 0) continue;
            if (wantImage && !rec.imgUrl) continue;
            if (custWant && rec.customerId !== custWant) continue;
            if (yy && (!rec.lastOrderYYMM || Math.floor(rec.lastOrderYYMM / 100) !== yy)) continue;
            var score = 0;
            if (tokens.length) {
                score = scoreRec(rec, tokens);
                if (!score) continue;
            }
            hits.push({ rec: rec, score: score });
        }

        var sort = state.sort || 'relevance';
        var cmp;
        if (sort === 'newest') cmp = function (a, b) { return b.rec.dn - a.rec.dn; };
        else if (sort === 'number') cmp = function (a, b) { return a.rec.dn - b.rec.dn; };
        else if (sort === 'activity') cmp = function (a, b) { return b.rec.lastOrderYYMM - a.rec.lastOrderYYMM || b.rec.dn - a.rec.dn; };
        else if (sort === 'orders') cmp = function (a, b) { return b.rec.orderCount - a.rec.orderCount || b.rec.dn - a.rec.dn; };
        else cmp = function (a, b) { // relevance (contract tie-break chain)
            return b.score - a.score || b.rec.orderCount - a.rec.orderCount ||
                b.rec.lastOrderYYMM - a.rec.lastOrderYYMM || b.rec.dn - a.rec.dn;
        };
        hits.sort(cmp);

        var total = hits.length;
        var n = (typeof limit === 'number' && limit > 0) ? Math.min(limit, total) : total;
        var results = new Array(n);
        for (var k = 0; k < n; k++) results[k] = hits[k].rec;

        var t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        return { results: results, total: total, ms: Math.max(0, Math.round(t1 - t0)), customerHit: customerHit };
    }

    // ── browse-surface helpers ──
    function stats() {
        requireDecoded('stats');
        return {
            groups: S.stats.groups,
            companies: S.stats.companies,
            withImagePct: S.stats.withImagePct,
            multiFileCount: S.stats.multiFileCount
        };
    }

    function topCompanies(n) {
        requireDecoded('topCompanies');
        var groups = new Map();
        // Walk newest-first so sample collages favour recent designs.
        for (var i = S.recs.length - 1; i >= 0; i--) {
            var rec = S.recs[i];
            var key = rec.customerId > 0 ? 'c' + rec.customerId : (rec._compN ? 'n' + rec._compN : '');
            if (!key) continue;
            var g = groups.get(key);
            if (!g) {
                g = { company: rec.company, customerId: rec.customerId || 0, count: 0, sampleImgUrls: [] };
                groups.set(key, g);
            }
            g.count++;
            if (!g.company && rec.company) g.company = rec.company;
            if (rec.imgUrl && g.sampleImgUrls.length < 4) g.sampleImgUrls.push(rec.imgUrl);
        }
        var list = [];
        groups.forEach(function (g) { if (g.company) list.push(g); });
        list.sort(function (a, b) { return b.count - a.count || (a.company < b.company ? -1 : 1); });
        return list.slice(0, n > 0 ? n : 12);
    }

    function forCustomer(customerId) {
        requireDecoded('forCustomer');
        var cid = parseInt(customerId, 10) || 0;
        var designs = [];
        var company = '';
        var tierMix = {};
        var firstYYMM = 0, lastYYMM = 0, totalOrders = 0;
        for (var i = 0; i < S.recs.length; i++) {
            var rec = S.recs[i];
            if (rec.customerId !== cid) continue;
            designs.push(rec);
            if (!company && rec.company) company = rec.company;
            if (rec.tier) tierMix[rec.tier] = (tierMix[rec.tier] || 0) + 1;
            totalOrders += rec.orderCount;
            if (rec.lastOrderYYMM) {
                if (!firstYYMM || rec.lastOrderYYMM < firstYYMM) firstYYMM = rec.lastOrderYYMM;
                if (rec.lastOrderYYMM > lastYYMM) lastYYMM = rec.lastOrderYYMM;
            }
        }
        designs.sort(function (a, b) { return b.dn - a.dn; });
        return {
            company: company, designs: designs, tierMix: tierMix,
            firstYYMM: firstYYMM, lastYYMM: lastYYMM, totalOrders: totalOrders
        };
    }

    function byDn(dn) {
        requireDecoded('byDn');
        return S.byDn.get(parseInt(dn, 10)) || null;
    }

    // Deterministic PRNG for the daily wall — same seed, same wall, all day.
    function mulberry32(a) {
        return function () {
            a |= 0; a = (a + 0x6D2B79F5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function slice(opts) {
        requireDecoded('slice');
        opts = opts || {};
        var rng = mulberry32(opts.seed | 0);
        var count = opts.count > 0 ? opts.count : 48;
        var pool = [];
        for (var i = 0; i < S.recs.length; i++) {
            if (S.recs[i].imgUrl) pool.push(S.recs[i]);
        }
        // Seeded Fisher-Yates, drawing from the tail as we go — only `count`
        // swaps needed, fully deterministic per seed.
        var n = pool.length;
        var take = Math.min(count, n);
        var out = new Array(take);
        for (var k = 0; k < take; k++) {
            var j = k + Math.floor(rng() * (n - k));
            var tmp = pool[k]; pool[k] = pool[j]; pool[j] = tmp;
            out[k] = pool[k];
        }
        return out;
    }

    // ── /recent delta-merge (pure; DG.store calls this, jest locks it) ──
    // Contract: find local row by dn. Absent -> insert (keeping dn sort).
    // Present -> srcBits |= incoming; fill name/company/custId/imgRef ONLY
    // where local is empty/0; NEVER zero local stitch/tier/orders — recent
    // rows carry 0/'' for fields their live source doesn't know. Numeric
    // stats (stitch/variants/orders/lastOrder) only ever move UP.
    function lowerBound(rows, dn) {
        var lo = 0, hi = rows.length;
        while (lo < hi) {
            var mid = (lo + hi) >> 1;
            if (rows[mid][COL.DN] < dn) lo = mid + 1; else hi = mid;
        }
        return lo;
    }

    function mergeInto(loc, inc) {
        var touched = false;
        var sb = (loc[COL.SRC] | 0) | (inc[COL.SRC] | 0);
        if (sb !== loc[COL.SRC]) { loc[COL.SRC] = sb; touched = true; }
        // fill-only-empty: strings + custId + dict codes
        var fill = [COL.NAME, COL.COMPANY, COL.CUST, COL.IMG, COL.REP, COL.CTYPE, COL.TIER];
        for (var f = 0; f < fill.length; f++) {
            var i = fill[f];
            if (!loc[i] && inc[i]) { loc[i] = inc[i]; touched = true; }
        }
        // monotonic numerics: never zeroed, never lowered
        var up = [COL.STITCH, COL.VARIANTS, COL.ORDERS, COL.LAST];
        for (var u = 0; u < up.length; u++) {
            var j = up[u];
            var v = inc[j] | 0;
            if (v > (loc[j] | 0)) { loc[j] = v; touched = true; }
        }
        return touched;
    }

    function mergeRecent(rows, recentRows) {
        if (!Array.isArray(rows) || !Array.isArray(recentRows)) return 0;
        var changed = 0;
        for (var i = 0; i < recentRows.length; i++) {
            var r = recentRows[i];
            if (!Array.isArray(r) || typeof r[COL.DN] !== 'number' || r[COL.DN] <= 0) continue;
            var at = lowerBound(rows, r[COL.DN]);
            if (rows[at] && rows[at][COL.DN] === r[COL.DN]) {
                if (mergeInto(rows[at], r)) changed++;
            } else {
                rows.splice(at, 0, r.slice(0, ROW_LEN));
                changed++;
            }
        }
        return changed;
    }

    var search = {
        decode: decode,
        query: query,
        stats: stats,
        topCompanies: topCompanies,
        forCustomer: forCustomer,
        byDn: byDn,
        slice: slice,
        mergeRecent: mergeRecent
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { search: search, esc: esc };
    }
    if (typeof window !== 'undefined' && window) {
        window.DG = window.DG || {};
        window.DG.search = search;
        window.DG.esc = esc;
    }
})(typeof window !== 'undefined' ? window : globalThis);
