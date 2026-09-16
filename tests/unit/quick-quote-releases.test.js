/**
 * quick-quote-releases.test.js — Quick Quote's version line and "What's new" list
 * (Erik 2026-09-16: reps quote the version in feedback, so it must never go stale).
 *
 * - The version comes from index.html's #qqRelease data-release, which /deploy's cache-bust
 *   rewrites together with the quick-quote-releases.js script tag.
 * - Any change to Quick Quote's own files, or to the release list itself, needs a "What's new"
 *   entry: the first entry's fingerprint must match. The failure message says whether to add a
 *   new entry (the first one has shipped) or update the unshipped one, and prints the value.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const releases = require('../../calculators/quick-quote/quick-quote-releases');

const ROOT = path.join(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');
const PAGE = 'calculators/quick-quote/index.html';
const HTML = read(PAGE);
const VERSION = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;

// Quick Quote's own files: the page and every calculators/quick-quote asset it loads, including
// the release list (minus the first entry's fingerprint value, which records this hash).
// ?v= values are left out so a cache-bust alone never needs an entry.
const RELEASES = 'calculators/quick-quote/quick-quote-releases.js';
function fingerprint() {
    const files = [PAGE, ...new Set([...HTML.matchAll(/(?:src|href)="\/(calculators\/quick-quote\/[^"?]+)/g)].map(m => m[1]))].sort();
    const hash = crypto.createHash('sha256');
    for (const file of files) {
        let body = read(file).replace(/\?v=[^"' >]+/g, '?v=');
        if (file === RELEASES) body = body.replace(/fingerprint: '[0-9a-f]*'/, "fingerprint: ''");
        hash.update(file + '\n' + body + '\n');
    }
    return { value: hash.digest('hex').slice(0, 16), files };
}
const liveVersion = () => releases.versionFrom((HTML.match(/data-release="([^"]+)"/) || [])[1]);

test('the version line carries the same release tag as the release-list script', () => {
    const marker = (HTML.match(/data-release="([^"]+)"/) || [])[1];
    const script = (HTML.match(/src="(\/calculators\/quick-quote\/quick-quote-releases\.js\?v=[^"]+)"/) || [])[1];
    expect(marker).toBe(script);
    expect(releases.versionFrom(marker)).toMatch(VERSION);
    const tagAt = name => HTML.indexOf('<script src="/calculators/quick-quote/' + name + '?v=');
    expect(tagAt('quick-quote-releases.js')).toBeGreaterThan(-1);
    expect(tagAt('quick-quote-releases.js')).toBeLessThan(tagAt('quick-quote-workspace.js'));
});

test('every Quick Quote change has a "What\'s new" entry', () => {
    const { value, files } = fingerprint();
    expect(files).toEqual(expect.arrayContaining([RELEASES, 'calculators/quick-quote/quick-quote.js', 'calculators/quick-quote/quick-quote.css', 'calculators/quick-quote/quick-quote-workspace.js', 'calculators/quick-quote/quick-quote-document.js', 'calculators/quick-quote/linesheet-print.css']));
    if (releases.ENTRIES[0].fingerprint === value) return;
    const live = liveVersion(), shipped = releases.compare(live, releases.ENTRIES[1].version) > 0;
    throw new Error(shipped
        ? 'Quick Quote changed after version ' + live + ' shipped. In ' + RELEASES + ' give the first entry version \'' + live + '\' (and remove its fingerprint), then add a new first entry: { version: null, fingerprint: \'' + value + '\', notes: [...] }.'
        : 'Quick Quote changed. The first entry in ' + RELEASES + ' has not shipped yet: add notes for this change to it and set its fingerprint to \'' + value + '\'.');
});

test('entries: one unreleased entry first, then released versions newest first, notes without prices', () => {
    const [first, ...released] = releases.ENTRIES;
    const live = liveVersion();
    expect(first.version).toBeNull();
    expect(released.length).toBeGreaterThan(0);
    released.forEach((entry, i) => {
        expect(entry.version).toMatch(VERSION);
        expect(entry.fingerprint).toBeUndefined();
        if (i) expect(releases.compare(released[i - 1].version, entry.version)).toBeGreaterThan(0);
    });
    expect(releases.compare(live, released[0].version)).toBeGreaterThanOrEqual(0);
    for (const entry of releases.ENTRIES) {
        expect(entry.notes.length).toBeGreaterThan(0);
        for (const note of entry.notes) {
            expect(note).toMatch(/^[A-Z].*[.]$/);
            expect(note).not.toMatch(/\$\s?\d/); // prices come from Caspio, never from release notes
        }
    }
});

test('versions read from the page and dated for reps', () => {
    expect(releases.versionFrom('/calculators/quick-quote/quick-quote-releases.js?v=2026.09.16.3')).toBe('2026.09.16.3');
    expect(releases.versionFrom('/x.js?v=20260424b')).toBe('');
    expect(releases.versionFrom('')).toBe('');
    expect(releases.dateOf('2026.09.16.3')).toBe('Sep 16, 2026');
    expect(releases.dateOf('2027.01.02.1')).toBe('Jan 2, 2027');
    expect(releases.compare('2026.09.16.10', '2026.09.16.9')).toBeGreaterThan(0);
    const previous = releases.ENTRIES[1].version;
    const next = releases.history(previous.replace(/\.(\d+)$/, (m, n) => '.' + (Number(n) + 1)));
    expect(next[0].heading).toMatch(/^Version \d{4}\.\d{2}\.\d{2}\.\d+ · [A-Z][a-z]{2} \d{1,2}, \d{4}$/);
    expect(next[1].heading).toBe('Version ' + previous + ' · ' + releases.dateOf(previous));
    // Before the deploy the page still carries the previous version: the new entry says so.
    expect(releases.history(previous)[0].heading).toBe('Next update (not live yet)');
});

function page(ref) {
    return new JSDOM('<div class="qq-release" id="qqRelease"' + (ref === undefined ? '' : ' data-release="' + ref + '"') + ' hidden>'
        + '<span id="qqReleaseLabel"></span><button type="button" id="qqReleaseToggle" aria-expanded="false" aria-controls="qqReleaseNotes">What’s new '
        + '<span id="qqReleaseBadge" hidden>Updated</span></button><div id="qqReleaseNotes" hidden></div></div>').window.document;
}
function memory(initial) {
    const store = new Map(initial ? [[releases.STORAGE_KEY, initial]] : []);
    return { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), store };
}
const REF = '/calculators/quick-quote/quick-quote-releases.js?v=2099.01.05.2';
const shown = badge => !badge.hidden && badge.style.visibility !== 'hidden';

test('the badge shows once per version and opening What\'s new clears it', () => {
    const doc = page(REF), storage = memory('2026.01.01.1');
    expect(releases.mount(doc, storage)).toEqual({ version: '2099.01.05.2', badge: true });
    const $ = id => doc.getElementById(id);
    expect($('qqRelease').hidden).toBe(false);
    expect($('qqReleaseLabel').textContent).toBe('Version 2099.01.05.2 · Updated Jan 5, 2099');
    expect(shown($('qqReleaseBadge'))).toBe(true);
    expect($('qqReleaseNotes').hidden).toBe(true);
    $('qqReleaseToggle').click();
    expect($('qqReleaseNotes').hidden).toBe(false);
    expect($('qqReleaseToggle').getAttribute('aria-expanded')).toBe('true');
    // Seen: invisible now (its space kept so nothing shifts), gone on the next visit.
    expect(shown($('qqReleaseBadge'))).toBe(false);
    expect($('qqReleaseBadge').hidden).toBe(false);
    expect(storage.store.get(releases.STORAGE_KEY)).toBe('2099.01.05.2');
    const headings = [...doc.querySelectorAll('#qqReleaseNotes h2')].map(h => h.textContent);
    expect(headings[0]).toBe('Version 2099.01.05.2 · Jan 5, 2099');
    expect(headings).toHaveLength(releases.ENTRIES.length);
    expect(doc.querySelectorAll('#qqReleaseNotes li')).toHaveLength(releases.ENTRIES.reduce((n, e) => n + e.notes.length, 0));
    // Only the latest notes are open; older versions are folded away.
    const earlier = doc.querySelector('#qqReleaseNotes details.qq-release-earlier');
    expect(earlier.open).toBe(false);
    expect(earlier.querySelector('summary').textContent).toBe('Earlier versions');
    expect(earlier.querySelectorAll('h2')).toHaveLength(releases.ENTRIES.length - 1);
    expect(doc.querySelector('#qqReleaseNotes > section h2').textContent).toBe(headings[0]);
    $('qqReleaseToggle').click();
    expect($('qqReleaseNotes').hidden).toBe(true);
    expect($('qqReleaseToggle').getAttribute('aria-expanded')).toBe('false');

    const again = page(REF);
    expect(releases.mount(again, storage).badge).toBe(false);
    expect(again.getElementById('qqReleaseBadge').hidden).toBe(true);
});

test('Escape or a click elsewhere closes What\'s new; clicks inside keep it open', () => {
    const doc = page(REF);
    const outside = doc.createElement('p');
    doc.body.appendChild(outside);
    releases.mount(doc, memory());
    const $ = id => doc.getElementById(id);
    $('qqReleaseToggle').click();
    doc.querySelector('#qqReleaseNotes summary').click();
    expect($('qqReleaseNotes').hidden).toBe(false);
    outside.click();
    expect($('qqReleaseNotes').hidden).toBe(true);
    expect($('qqReleaseToggle').getAttribute('aria-expanded')).toBe('false');
    $('qqReleaseToggle').click();
    doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect($('qqReleaseNotes').hidden).toBe(false);
    $('qqReleaseToggle').focus();
    doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect($('qqReleaseNotes').hidden).toBe(true);
    expect(doc.activeElement).toBe($('qqReleaseToggle'));
    // Escape while typing elsewhere closes the list but leaves the cursor where it is.
    const field = doc.createElement('input');
    doc.body.appendChild(field);
    $('qqReleaseToggle').click();
    field.focus();
    doc.dispatchEvent(new doc.defaultView.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect($('qqReleaseNotes').hidden).toBe(true);
    expect(doc.activeElement).toBe(field);
    // Tabbing past the list closes it; moving focus inside keeps it open.
    $('qqReleaseToggle').click();
    const inside = doc.querySelector('#qqReleaseNotes summary');
    $('qqReleaseToggle').dispatchEvent(new doc.defaultView.FocusEvent('focusout', { bubbles: true, relatedTarget: inside }));
    expect($('qqReleaseNotes').hidden).toBe(false);
    const next = doc.createElement('button');
    doc.body.appendChild(next);
    inside.dispatchEvent(new doc.defaultView.FocusEvent('focusout', { bubbles: true, relatedTarget: next }));
    expect($('qqReleaseNotes').hidden).toBe(true);
});

test('blocked storage still shows the version and the notes', () => {
    const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    const doc = page(REF);
    expect(releases.mount(doc, blocked)).toEqual({ version: '2099.01.05.2', badge: true });
    doc.getElementById('qqReleaseToggle').click();
    expect(doc.getElementById('qqReleaseNotes').hidden).toBe(false);
    expect(releases.mount(page(REF), null).badge).toBe(true);
});

test('a missing or malformed release marker shows no version at all', () => {
    for (const ref of [undefined, '', '/calculators/quick-quote/quick-quote-releases.js', '/calculators/quick-quote/quick-quote-releases.js?v=next']) {
        const doc = page(ref);
        expect(releases.mount(doc, memory())).toBeNull();
        expect(doc.getElementById('qqRelease').hidden).toBe(true);
        expect(doc.getElementById('qqReleaseLabel').textContent).toBe('');
    }
});
