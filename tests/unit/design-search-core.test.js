/**
 * design-search-core.test.js — contract lock for the Design Vault search core
 * (dashboards/js/design-gallery-search.js, required directly via its Node
 * dual-export — plain node env, no jsdom).
 *
 * Locks: positional row decode, imgRef expansion (f:/b:/u:/empty), the ranking
 * ladder (dn exact > dn prefix > company word-prefix > name word-prefix >
 * company substring > name substring), multi-token AND, filter composition,
 * /recent delta-merge semantics (insert new dn · srcBits OR · fill-only-empty
 * · never zero stitch/tier/orders), seeded slice determinism, and DG.esc on
 * hostile strings. If the proxy wire format moves, these tests move WITH the
 * server-side contract tests — never independently.
 */
'use strict';

const BASE = 'https://proxy.example.test';

// The module resolves APP_CONFIG lazily at decode() time; give it a browser-ish
// window so imgRef expansion produces absolute URLs like production.
global.window = { APP_CONFIG: { API: { BASE_URL: BASE } } };

const { search, esc } = require('../../dashboards/js/design-gallery-search.js');

// ── fixture helpers ──
const SRC = { DIGITIZED: 1, SHOPWORKS: 2, THUMB: 4, ART: 8, RUTH: 16, PHOTO: 32, DESIGNS2026: 64 };
const DICTS = {
    reps: ['', 'Taneisha', 'Jim'],
    custTypes: ['', 'Contract', 'Direct'],
    tiers: ['', 'Standard', 'Mid', 'Large', 'Full Back']
};

function makeIndex(rows, extra) {
    return Object.assign({
        version: 'dsi-1754300000-' + rows.length,
        builtAt: 1754300000000,
        lookupBuiltAt: 1754300000000,
        srcBits: SRC,
        dicts: DICTS,
        rows: rows,
        dupClusters: [],
        counts: { baseRows: rows.length, groups: rows.length, excludedUnnumbered: 0, bySource: {} }
    }, extra || {});
}

// [dn, name, company, custId, repIdx, custTypeIdx, tierIdx, maxStitch,
//  variantCount, srcBits, imgRef, orderCount, lastOrderYYMM]
function coreRows() {
    return [
        [31442, 'Eagle Crest', 'Acme Corp', 12025, 1, 1, 2, 9000, 2, 7, 'b:42', 4, 2506],
        [31500, 'Eagle Script', 'Acme Corp', 12025, 1, 1, 2, 9500, 1, 1, 'f:abc123', 2, 2504],
        [32000, 'Bear Logo', 'Beta Industries', 13000, 2, 2, 1, 5000, 1, 2, '', 0, 0],
        [35439, 'Dragon Full Back', 'Acme Corp', 12025, 1, 1, 4, 52000, 3, 9, 'u:https://cdn.example.com/x.png', 9, 2512],
        [40000, 'Script Name', 'Gamma LLC', 14000, 0, 0, 1, 4200, 1, 4, 'b:77', 1, 2301]
    ];
}

function coreIndex() {
    return makeIndex(coreRows(), { dupClusters: [[31442, 31500]] });
}

// ── row decode positions ──
describe('decode — positional row mapping', () => {
    test('every column lands on the contract field', () => {
        const acc = search.decode(coreIndex());
        expect(acc.size).toBe(5);
        const d = search.byDn(31442);
        expect(d).not.toBeNull();
        expect(d.dn).toBe(31442);
        expect(d.name).toBe('Eagle Crest');
        expect(d.company).toBe('Acme Corp');
        expect(d.customerId).toBe(12025);
        expect(d.rep).toBe('Taneisha');           // repIdx 1 via dicts.reps
        expect(d.custType).toBe('Contract');      // custTypeIdx 1
        expect(d.tier).toBe('Mid');               // tierIdx 2
        expect(d.maxStitch).toBe(9000);
        expect(d.variantCount).toBe(2);
        expect(d.srcBits).toBe(7);
        expect(d.orderCount).toBe(4);
        expect(d.lastOrderYYMM).toBe(2506);
        expect(d.dupGroup).toEqual([31442, 31500]);
    });

    test('dict index 0 decodes to empty string, dupGroup null when unclustered', () => {
        search.decode(coreIndex());
        const d = search.byDn(40000);
        expect(d.rep).toBe('');
        expect(d.custType).toBe('');
        expect(d.dupGroup).toBeNull();
    });

    test('accessor get(i) walks rows in dn order', () => {
        const acc = search.decode(coreIndex());
        expect(acc.get(0).dn).toBe(31442);
        expect(acc.get(4).dn).toBe(40000);
        expect(acc.get(99)).toBeNull();
    });

    test('decode throws loudly on a malformed index', () => {
        expect(() => search.decode({})).toThrow(/rows/);
        search.decode(coreIndex()); // restore state for later tests
    });
});

// ── imgRef expansion ──
describe('imgRef expansion', () => {
    beforeAll(() => search.decode(coreIndex()));

    // Box thumbnails are SAME-ORIGIN as of 2026-08-05, not absolute proxy URLs.
    // The proxy's Box read routes are moving behind the app's session-gated
    // forwarder, and an <img> only sends the SAML cookie when the request goes
    // to our own origin — so a BASE-prefixed URL here would mean a 401 image.
    test('b:<boxId> → same-origin box thumbnail URL with ?size=large hi-res twin', () => {
        const d = search.byDn(31442);
        expect(d.imgUrl).toBe('/api/box/thumbnail/42');
        expect(d.imgLargeUrl).toBe('/api/box/thumbnail/42?size=large');
    });

    test('f:<key> → files URL, no large variant', () => {
        const d = search.byDn(31500);
        expect(d.imgUrl).toBe(BASE + '/api/files/abc123');
        expect(d.imgLargeUrl).toBeNull();
    });

    test('u:<absoluteUrl> passes through untouched', () => {
        const d = search.byDn(35439);
        expect(d.imgUrl).toBe('https://cdn.example.com/x.png');
        expect(d.imgLargeUrl).toBeNull();
    });

    test('empty imgRef → no image', () => {
        const d = search.byDn(32000);
        expect(d.imgUrl).toBe('');
        expect(d.imgLargeUrl).toBeNull();
    });
});

// ── ranking ladder ──
describe('query — ranking (contract-locked ladder)', () => {
    function rankRows() {
        return [
            [310, 'Zebra Mark', 'Plainco', 0, 0, 0, 1, 1000, 1, 1, '', 0, 0],       // dn exact for "310"
            [3100, 'Quiet Fox', 'Dullco', 0, 0, 0, 1, 1000, 1, 1, '', 0, 0],        // dn prefix for "310"
            [5001, 'Mountain Mark', 'Eagle Outfitters', 21, 0, 0, 1, 1000, 1, 1, '', 0, 0], // company word-prefix "eagle"
            [5002, 'Eagle Crest', 'Acme Corp', 22, 0, 0, 1, 1000, 1, 1, '', 0, 0],  // name word-prefix
            [5003, 'Mountain Mark', 'Beagleton Inc', 23, 0, 0, 1, 1000, 1, 1, '', 0, 0], // company substring
            [5004, 'Spreadeagle', 'Acme Corp', 22, 0, 0, 1, 1000, 1, 1, '', 0, 0]   // name substring
        ];
    }
    beforeEach(() => search.decode(makeIndex(rankRows())));

    test('dn exact outranks dn prefix', () => {
        const { results } = search.query({ q: '310' });
        expect(results.map(r => r.dn)).toEqual([310, 3100]);
    });

    test('company word-prefix > name word-prefix > company substring > name substring', () => {
        const { results } = search.query({ q: 'eagle' });
        expect(results.map(r => r.dn)).toEqual([5001, 5002, 5003, 5004]);
    });

    test('ties break orderCount desc, then lastOrderYYMM desc, then dn desc', () => {
        search.decode(makeIndex([
            [7001, 'Eagle One', 'Aco', 1, 0, 0, 1, 1000, 1, 1, '', 2, 2401],
            [7002, 'Eagle Two', 'Bco', 2, 0, 0, 1, 1000, 1, 1, '', 5, 2301],  // most orders → first
            [7003, 'Eagle Three', 'Cco', 3, 0, 0, 1, 1000, 1, 1, '', 2, 2405], // ties 7001 on orders, newer activity
            [7004, 'Eagle Four', 'Dco', 4, 0, 0, 1, 1000, 1, 1, '', 2, 2405]   // full tie with 7003 → dn desc
        ]));
        const { results } = search.query({ q: 'eagle' });
        expect(results.map(r => r.dn)).toEqual([7002, 7004, 7003, 7001]);
    });

    test('multi-token queries AND every token', () => {
        search.decode(coreIndex());
        const { results } = search.query({ q: 'acme eagle' });
        // Acme+Dragon lacks "eagle"; Beta/Gamma lack "acme".
        expect(results.map(r => r.dn).sort()).toEqual([31442, 31500]);
    });

    test('no-hit query returns empty, never throws', () => {
        search.decode(coreIndex());
        const out = search.query({ q: 'zzzznothing' });
        expect(out.results).toEqual([]);
        expect(out.total).toBe(0);
    });

    test('limit caps results but total reports the full match count', () => {
        search.decode(coreIndex());
        const out = search.query({ q: 'acme' }, 2);
        expect(out.results).toHaveLength(2);
        expect(out.total).toBe(3);
        expect(typeof out.ms).toBe('number');
    });
});

// ── customer hit ──
describe('query — pure-digit customerHit', () => {
    beforeAll(() => search.decode(coreIndex()));

    test('q equal to a known customerId reports the hit', () => {
        const { customerHit } = search.query({ q: '12025' });
        expect(customerHit).toEqual({ customerId: 12025, company: 'Acme Corp', count: 3 });
    });

    test('unknown id and non-digit queries report null', () => {
        expect(search.query({ q: '99999' }).customerHit).toBeNull();
        expect(search.query({ q: 'acme' }).customerHit).toBeNull();
    });
});

// ── filters ──
describe('query — filter composition (AND)', () => {
    beforeEach(() => search.decode(coreIndex()));

    test('tier filter matches the decoded tier name', () => {
        const { results } = search.query({ tier: 'Mid', sort: 'number' });
        expect(results.map(r => r.dn)).toEqual([31442, 31500]);
    });

    test('srcMask keeps rows sharing ANY selected source bit', () => {
        const { results } = search.query({ srcMask: SRC.ART, sort: 'number' });
        expect(results.map(r => r.dn)).toEqual([35439]); // srcBits 9 = DIGITIZED|ART
    });

    test('hasImage drops imageless rows', () => {
        const { results } = search.query({ hasImage: true, sort: 'number' });
        expect(results.map(r => r.dn)).toEqual([31442, 31500, 35439, 40000]);
    });

    test('year filter reads the YY of lastOrderYYMM (2506 → 2025)', () => {
        const { results } = search.query({ year: 2025, sort: 'number' });
        expect(results.map(r => r.dn)).toEqual([31442, 31500, 35439]);
    });

    test('customerId filter + query text compose with AND', () => {
        const { results } = search.query({ q: 'eagle', customerId: 12025 });
        expect(results.map(r => r.dn).sort()).toEqual([31442, 31500]);
        const none = search.query({ q: 'eagle', customerId: 13000 });
        expect(none.total).toBe(0);
    });

    test('tier + hasImage + year stack', () => {
        const { results } = search.query({ tier: 'Mid', hasImage: true, year: 2025, sort: 'number' });
        expect(results.map(r => r.dn)).toEqual([31442, 31500]);
    });

    test('sort modes: number asc, newest dn desc, orders desc', () => {
        expect(search.query({ sort: 'number' }).results.map(r => r.dn))
            .toEqual([31442, 31500, 32000, 35439, 40000]);
        expect(search.query({ sort: 'newest' }).results.map(r => r.dn))
            .toEqual([40000, 35439, 32000, 31500, 31442]);
        expect(search.query({ sort: 'orders' }).results[0].dn).toBe(35439);
    });
});

// ── browse helpers ──
describe('stats / topCompanies / forCustomer', () => {
    beforeAll(() => search.decode(coreIndex()));

    test('stats counts groups, distinct companies, image %, multi-file', () => {
        expect(search.stats()).toEqual({
            groups: 5,
            companies: 3,            // Acme(12025), Beta(13000), Gamma(14000)
            withImagePct: 80,        // 4 of 5
            multiFileCount: 2        // 31442 (×2), 35439 (×3)
        });
    });

    test('topCompanies ranks by design count with up to 4 sample images', () => {
        const top = search.topCompanies(2);
        expect(top[0].company).toBe('Acme Corp');
        expect(top[0].customerId).toBe(12025);
        expect(top[0].count).toBe(3);
        expect(top[0].sampleImgUrls.length).toBeLessThanOrEqual(4);
        expect(top[0].sampleImgUrls).toContain('https://cdn.example.com/x.png');
    });

    test('forCustomer aggregates portfolio, tierMix, activity range, orders', () => {
        const p = search.forCustomer(12025);
        expect(p.company).toBe('Acme Corp');
        expect(p.designs.map(d => d.dn)).toEqual([35439, 31500, 31442]); // dn desc
        expect(p.tierMix).toEqual({ Mid: 2, 'Full Back': 1 });
        expect(p.firstYYMM).toBe(2504);
        expect(p.lastYYMM).toBe(2512);
        expect(p.totalOrders).toBe(15);
    });

    test('forCustomer with no designs returns an empty portfolio', () => {
        const p = search.forCustomer(555);
        expect(p.designs).toEqual([]);
        expect(p.company).toBe('');
        expect(p.totalOrders).toBe(0);
    });
});

// ── /recent delta-merge ──
describe('mergeRecent — /recent delta-merge semantics', () => {
    function localRows() {
        return [
            [100, 'Alpha', 'Aco', 1, 1, 1, 1, 5000, 1, 1, 'f:a', 2, 2401],
            [200, '', '', 0, 0, 0, 2, 8000, 1, 2, '', 0, 0],
            [300, 'Gamma', 'Gco', 3, 1, 1, 3, 52000, 2, 4, 'b:9', 7, 2512]
        ];
    }

    test('unknown dn inserts, preserving dn sort order', () => {
        const rows = localRows();
        const changed = search.mergeRecent(rows, [
            [150, 'Newbie', 'Nco', 9, 0, 0, 0, 0, 1, SRC.RUTH, 'u:https://x/y.png', 0, 0]
        ]);
        expect(changed).toBe(1);
        expect(rows.map(r => r[0])).toEqual([100, 150, 200, 300]);
        expect(rows[1][1]).toBe('Newbie');
    });

    test('existing dn: srcBits OR union', () => {
        const rows = localRows();
        search.mergeRecent(rows, [[300, '', '', 0, 0, 0, 0, 0, 0, SRC.RUTH, '', 0, 0]]);
        expect(rows[2][9]).toBe(4 | SRC.RUTH); // THUMB | RUTH = 20
    });

    test('name/company/custId/imgRef fill ONLY where local is empty/0', () => {
        const rows = localRows();
        search.mergeRecent(rows, [
            [200, 'Beta', 'Bco', 5, 0, 0, 0, 0, 0, 0, 'b:77', 0, 0],   // local empty → fills
            [300, 'ZZZ', 'ZZco', 99, 0, 0, 0, 0, 0, 0, 'u:nope', 0, 0] // local set → untouched
        ]);
        expect(rows[1][1]).toBe('Beta');
        expect(rows[1][2]).toBe('Bco');
        expect(rows[1][3]).toBe(5);
        expect(rows[1][10]).toBe('b:77');
        expect(rows[2][1]).toBe('Gamma');
        expect(rows[2][2]).toBe('Gco');
        expect(rows[2][3]).toBe(3);
        expect(rows[2][10]).toBe('b:9');
    });

    test('NEVER zeroes local stitch/tier/orders when recent carries 0', () => {
        const rows = localRows();
        search.mergeRecent(rows, [[300, '', '', 0, 0, 0, 0, 0, 0, 0, '', 0, 0]]);
        expect(rows[2][7]).toBe(52000); // maxStitch survives
        expect(rows[2][6]).toBe(3);     // tierIdx survives
        expect(rows[2][11]).toBe(7);    // orderCount survives
        expect(rows[2][12]).toBe(2512); // lastOrderYYMM survives
    });

    test('nonzero incoming stats only move values UP', () => {
        const rows = localRows();
        search.mergeRecent(rows, [[300, '', '', 0, 0, 0, 0, 60000, 3, 0, '', 8, 2601]]);
        expect(rows[2][7]).toBe(60000);
        expect(rows[2][8]).toBe(3);
        expect(rows[2][11]).toBe(8);
        expect(rows[2][12]).toBe(2601);
        // and a LOWER incoming value never downgrades
        search.mergeRecent(rows, [[300, '', '', 0, 0, 0, 0, 100, 1, 0, '', 1, 2401]]);
        expect(rows[2][7]).toBe(60000);
        expect(rows[2][12]).toBe(2601);
    });

    test('garbage recent rows are skipped without damage', () => {
        const rows = localRows();
        const changed = search.mergeRecent(rows, [null, [], ['nope'], [0, 'x'], [-5, 'y']]);
        expect(changed).toBe(0);
        expect(rows).toHaveLength(3);
    });
});

// ── seeded daily wall ──
describe('slice — seeded wall determinism', () => {
    function wallIndex() {
        const rows = [];
        for (let i = 1; i <= 12; i++) {
            rows.push([9000 + i, 'Design ' + i, 'Wallco ' + i, i, 0, 0, 1, 1000, 1, 1,
                i <= 8 ? 'b:' + i : '', 0, 0]); // 8 with-image, 4 without
        }
        return makeIndex(rows);
    }
    beforeEach(() => search.decode(wallIndex()));

    test('same seed → identical wall, only with-image designs', () => {
        const a = search.slice({ seed: 20260805, count: 5 });
        const b = search.slice({ seed: 20260805, count: 5 });
        expect(a.map(d => d.dn)).toEqual(b.map(d => d.dn));
        expect(a).toHaveLength(5);
        a.forEach(d => expect(d.imgUrl).not.toBe(''));
        expect(new Set(a.map(d => d.dn)).size).toBe(5); // distinct picks
    });

    test('different seed → different draw', () => {
        const a = search.slice({ seed: 20260805, count: 5 }).map(d => d.dn);
        const b = search.slice({ seed: 19991231, count: 5 }).map(d => d.dn);
        expect(a).not.toEqual(b);
    });

    test('count above pool size returns the whole with-image pool', () => {
        const all = search.slice({ seed: 1, count: 500 });
        expect(all).toHaveLength(8);
    });
});

// ── DG.esc ──
describe('esc — hostile string escaping', () => {
    test('script/element breakouts are neutralised', () => {
        expect(esc('<img src=x onerror=alert(1)>'))
            .toBe('&lt;img src=x onerror=alert(1)&gt;');
        expect(esc('</div><script>x</script>'))
            .toBe('&lt;/div&gt;&lt;script&gt;x&lt;/script&gt;');
    });

    test('attribute breakouts: both quote styles escape', () => {
        expect(esc('"onmouseover=alert(1)')).toBe('&quot;onmouseover=alert(1)');
        expect(esc("'); fetch('//evil')//")).toBe('&#39;); fetch(&#39;//evil&#39;)//');
    });

    test('ampersand escapes first (no double-encode artifacts)', () => {
        expect(esc('A & B <C>')).toBe('A &amp; B &lt;C&gt;');
        expect(esc('&lt;')).toBe('&amp;lt;');
    });

    test('null/undefined/number coerce safely', () => {
        expect(esc(null)).toBe('');
        expect(esc(undefined)).toBe('');
        expect(esc(31442)).toBe('31442');
    });

    test('esc.attr is the same escaper (shared alias)', () => {
        expect(esc.attr).toBe(esc);
    });
});
