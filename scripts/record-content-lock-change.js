#!/usr/bin/env node
/**
 * Record an intentional edit to a content-locked file in its fixture ledger.
 *
 * The content-lock suites (quote-builders-content, lead-records-content,
 * crm-workspaces-content) hash each locked file back to a recorded original.
 * An intentional edit is legal only when the ledger carries a {before, after,
 * count} row that reverses it — the tests replay those rows in REVERSE array
 * order, so a new row is APPENDED and gets reversed first.
 *
 * Hand-writing those rows is how you get a fixture that reverses to *almost*
 * the original. This computes them from the real sources instead, and runs
 * each fixture's own pre-transform chain (quick-quote mappings,
 * staff-print-scenes) so the snippets match what the test actually sees.
 *
 * Usage: node scripts/record-content-lock-change.js <base-ref> [--write] [--only=a,b]
 *   base-ref  the commit holding the pre-edit content (the branch's merge base)
 *   --write   persist; omit for a dry run
 *   --only    limit to these paths — use it when a later step (a release
 *             cache-bust) edits more locked files and the earlier rows are
 *             already recorded, so re-running would append them twice.
 */
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BASE_REF = process.argv[2];
const WRITE = process.argv.includes('--write');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
if (!BASE_REF) {
    console.error('usage: node scripts/record-content-lock-change.js <base-ref> [--write]');
    process.exit(1);
}

const restorePreQuickQuote = require('../tests/helpers/quick-quote-source-mappings');

const norm = (s) => s.replace(/\r\n/g, '\n');
const readNow = (f) => norm(fs.readFileSync(path.join(ROOT, f), 'utf8'));
const readBase = (f) =>
    norm(cp.execFileSync('git', ['show', `${BASE_REF}:${f}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }));

/** Files → the fixture that owns them + the pre-transform the test applies first. */
const TARGETS = [
    {
        fixture: 'tests/fixtures/quote-builders-original-content.json',
        pre: (file, s) => restorePreQuickQuote(file, s),
        files: [
            'shared_components/js/quote-builder-utils.js',
            'shared_components/js/builders/emb/adapter.js',
            'shared_components/js/builders/scp/adapter.js',
            'shared_components/js/builders/dtf/methods-lifecycle.js',
            'shared_components/js/builders/dtg/crm.js',
            'quote-builders/embroidery-quote-builder.html',
            'quote-builders/screenprint-quote-builder.html',
            'quote-builders/dtf-quote-builder.html',
            'quote-builders/dtg-quote-builder.html',
        ],
    },
    {
        // lead-records owns the source rows; crm-workspaces replays them too, so one
        // row here serves both suites.
        fixture: 'tests/fixtures/lead-records-original-content.json',
        pre: (file, s) => s,
        files: ['dashboards/js/lead-workspace.js'],
    },
];

/** Changed line ranges between two line arrays, via LCS on the differing middle. */
function diffRanges(a, b) {
    let lo = 0;
    while (lo < a.length && lo < b.length && a[lo] === b[lo]) lo++;
    let hiA = a.length;
    let hiB = b.length;
    while (hiA > lo && hiB > lo && a[hiA - 1] === b[hiB - 1]) { hiA--; hiB--; }

    const A = a.slice(lo, hiA);
    const B = b.slice(lo, hiB);
    const n = A.length;
    const m = B.length;
    const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    const ranges = [];
    let i = 0;
    let j = 0;
    let cur = null;
    const flush = () => { if (cur) ranges.push(cur); cur = null; };
    while (i < n && j < m) {
        if (A[i] === B[j]) { flush(); i++; j++; continue; }
        cur = cur || { a0: i, a1: i, b0: j, b1: j };
        if (dp[i + 1][j] >= dp[i][j + 1]) { i++; cur.a1 = i; } else { j++; cur.b1 = j; }
    }
    if (i < n || j < m) { cur = cur || { a0: i, a1: i, b0: j, b1: j }; cur.a1 = n; cur.b1 = m; flush(); }
    flush();
    return ranges.map((r) => ({ a0: r.a0 + lo, a1: r.a1 + lo, b0: r.b0 + lo, b1: r.b1 + lo }));
}

const entries = [];
let failed = false;

for (const target of TARGETS) {
    const fixturePath = path.join(ROOT, target.fixture);
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    for (const file of target.files) {
        if (ONLY.length && !ONLY.includes(file)) continue;
        const curS = target.pre(file, readNow(file));
        const baseS = target.pre(file, readBase(file));
        if (curS === baseS) { console.log(`· ${file}: unchanged`); continue; }

        const baseLines = baseS.split('\n');
        const curLines = curS.split('\n');
        const ranges = diffRanges(baseLines, curLines);
        const rows = [];

        for (const r of ranges) {
            // Grow context symmetrically until BOTH snippets are unique in their own source.
            let ctx = 1;
            let before;
            let after;
            for (; ctx <= 40; ctx++) {
                const a0 = Math.max(0, r.a0 - ctx);
                const a1 = Math.min(baseLines.length, r.a1 + ctx);
                const b0 = Math.max(0, r.b0 - ctx);
                const b1 = Math.min(curLines.length, r.b1 + ctx);
                before = baseLines.slice(a0, a1).join('\n');
                after = curLines.slice(b0, b1).join('\n');
                if (after !== '' && curS.split(after).length - 1 === 1 && baseS.split(before).length - 1 === 1) break;
            }
            if (ctx > 40) { console.error(`✗ ${file}: could not make a hunk unique`); failed = true; continue; }
            rows.push({ file, before, after, count: 1 });
        }

        // Prove the rows actually reverse the file back to its pre-edit source.
        let replay = curS;
        for (const row of [...rows].reverse()) replay = replay.split(row.after).join(row.before);
        if (replay !== baseS) { console.error(`✗ ${file}: rows do not reverse to the base source`); failed = true; continue; }

        console.log(`✓ ${file}: ${rows.length} row(s), reverses cleanly`);
        entries.push({ fixturePath, fixture, rows });
    }
}

if (failed) process.exit(1);

if (!WRITE) {
    console.log('\n(dry run — pass --write to persist)');
    process.exit(0);
}

const REASON = process.env.LOCK_REASON || 'Recorded intentional change.';
const byFixture = new Map();
for (const e of entries) {
    if (!byFixture.has(e.fixturePath)) byFixture.set(e.fixturePath, e.fixture);
    byFixture.get(e.fixturePath).changes.push(...e.rows.map((r) => ({ ...r, reason: REASON })));
}
for (const [p, fixture] of byFixture) {
    fs.writeFileSync(p, `${JSON.stringify(fixture, null, 2)}\n`);
    console.log(`wrote ${path.relative(ROOT, p)}`);
}
