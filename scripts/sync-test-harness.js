#!/usr/bin/env node
/**
 * Keep tests/ui/test-ae-mission-control.html in step with dashboards/ae-mission-control.html.
 *
 * WHY THIS EXISTS
 * The harness is a hand-copied fork of the real page — it has to be, because the real page is
 * SAML-gated and cannot be fetched at test time. On 2026-07-27 that fork silently kept the OLD
 * bonus hero, the OLD tab bar and the OLD Today panel across three separate changes; each time
 * the harness rendered a page that no longer existed and reported it as fine. It was re-synced
 * by hand four times in one day. This script does the copy, and harness-drift.test.js fails the
 * build when someone forgets to run it.
 *
 * WHAT IS SHARED vs WHAT IS NOT
 * Only the regions in SHARED_REGIONS are copied. Everything else in the harness — its <title>,
 * its stub <script> tags, its ?as=rep controls — is harness-only and deliberately untouched.
 * A region is identified by tag + id so a moved block still matches.
 *
 * USAGE
 *   node scripts/sync-test-harness.js            # copy real -> harness
 *   node scripts/sync-test-harness.js --check    # exit 1 on drift, change nothing
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'dashboards', 'ae-mission-control.html');
const HARNESS = path.join(ROOT, 'tests', 'ui', 'test-ae-mission-control.html');

/**
 * The contract. Each entry is a block that MUST be byte-identical in both files, because the
 * harness exercises the real ae-mission-control.js against it — markup that differs is a test
 * asserting against a page nobody ships.
 *
 * Add a region here when you add a shared block. If a region ever needs to differ legitimately,
 * remove it from this list with a comment saying why — do NOT weaken the comparison, because a
 * fuzzy match is how the hero drifted three times without anyone noticing.
 */
const SHARED_REGIONS = [
    { tag: 'div', id: 'mc-tablist' },            // the tab buttons themselves
    { tag: 'section', id: 'aemc-bonus-hero' },   // dial + scenarios + goal track
    { tag: 'section', id: 'mc-panel-today' },
    { tag: 'section', id: 'mc-panel-money' },
    { tag: 'section', id: 'mc-panel-calls' },
    { tag: 'section', id: 'mc-panel-book' },
    { tag: 'section', id: 'mc-panel-pipeline' },
    { tag: 'section', id: 'mc-panel-wins' },
    { tag: 'div', id: 'mc-drawer-scrim' },
    { tag: 'aside', id: 'mc-drawer' },
];

/**
 * Pull one element out of an HTML string by tag + id, balancing nested same-name tags.
 *
 * A regex for the whole element would stop at the first </section>, which for a panel full of
 * nested sections is the wrong place. Void-ish elements (the scrim is an empty <div>) are
 * handled because depth returns to zero on their own closing tag.
 */
function extractRegion(html, tag, id) {
    const open = new RegExp(`<${tag}\\b[^>]*\\bid="${id}"`);
    const m = open.exec(html);
    if (!m) return null;
    const start = m.index;
    const scan = new RegExp(`</?${tag}\\b`, 'g');
    scan.lastIndex = start;
    let depth = 0;
    let hit;
    while ((hit = scan.exec(html)) !== null) {
        if (html.slice(hit.index, hit.index + 2) === `</`) {
            depth -= 1;
            if (depth === 0) {
                const close = html.indexOf('>', hit.index);
                return html.slice(start, close + 1);
            }
        } else {
            depth += 1;
        }
    }
    return null;
}

/** Compare every shared region. Returns [{ id, reason }] — empty means in sync. */
function findDrift(sourceHtml, harnessHtml) {
    const drift = [];
    for (const r of SHARED_REGIONS) {
        const a = extractRegion(sourceHtml, r.tag, r.id);
        const b = extractRegion(harnessHtml, r.tag, r.id);
        if (a === null) { drift.push({ id: r.id, reason: `missing from the page (${path.basename(SOURCE)})` }); continue; }
        if (b === null) { drift.push({ id: r.id, reason: `missing from the harness` }); continue; }
        if (a !== b) {
            drift.push({ id: r.id, reason: `differs (page ${a.length} chars, harness ${b.length})` });
        }
    }
    return drift;
}

function sync() {
    const source = fs.readFileSync(SOURCE, 'utf8');
    let harness = fs.readFileSync(HARNESS, 'utf8');
    let changed = 0;
    const missing = [];
    for (const r of SHARED_REGIONS) {
        const a = extractRegion(source, r.tag, r.id);
        const b = extractRegion(harness, r.tag, r.id);
        if (a === null) { missing.push(`${r.id} (not in the page)`); continue; }
        if (b === null) { missing.push(`${r.id} (not in the harness — add the block by hand once)`); continue; }
        if (a !== b) { harness = harness.replace(b, a); changed += 1; }
    }
    if (changed) fs.writeFileSync(HARNESS, harness);
    return { changed, missing };
}

if (require.main === module) {
    const check = process.argv.includes('--check');
    const source = fs.readFileSync(SOURCE, 'utf8');
    const harness = fs.readFileSync(HARNESS, 'utf8');
    if (check) {
        const drift = findDrift(source, harness);
        if (!drift.length) { console.log('✓ harness is in sync with the page'); process.exit(0); }
        console.error('✗ harness has drifted from dashboards/ae-mission-control.html:');
        drift.forEach((d) => console.error(`    ${d.id} — ${d.reason}`));
        console.error('\n  Fix: node scripts/sync-test-harness.js');
        process.exit(1);
    }
    const { changed, missing } = sync();
    missing.forEach((m) => console.warn(`  ⚠ skipped ${m}`));
    console.log(changed ? `✓ synced ${changed} region(s) into the harness` : '✓ already in sync');
}

module.exports = { SOURCE, HARNESS, SHARED_REGIONS, extractRegion, findDrift, sync };
