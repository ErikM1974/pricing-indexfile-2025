/**
 * quick-quote-releases.js — Quick Quote's version line and "What's new" list.
 *
 * Erik 2026-09-16: Nika and Taneisha are trialling the page, so every change gets a version
 * they can quote in feedback, and a one-time "Updated" badge tells them something changed.
 *
 * The version is never typed here. index.html's #qqRelease carries this file's own URL with
 * its ?v=, and /deploy's cache-bust rewrites that ?v= (together with the script tag) to the
 * release tag whenever this file changes. Adding an entry below is what moves the version.
 *
 * tests/unit/quick-quote-releases.test.js fingerprints Quick Quote's own files and this file
 * (everything except the first entry's fingerprint value), so any change fails it until you:
 *   - first entry NOT shipped yet (the page shows the same version as the second entry, and
 *     What's new says "Next update (not live yet)"): add your notes to it and paste the new
 *     fingerprint the test prints;
 *   - first entry already shipped (the page shows a newer version than the second entry):
 *     give it that version and drop its fingerprint, then add a new first entry with version
 *     null, your notes and the new fingerprint. Never reword notes that have shipped.
 * Plain English for reps. Never put prices in the notes — they come from Caspio.
 */
(function (root) {
    'use strict';

    const ENTRIES = [
        {
            version: null,
            fingerprint: '2148889f2625c9cb',
            notes: [
                'This version line and What’s new. Please mention the version when you send feedback.',
            ],
        },
        {
            version: '2026.09.16.2',
            notes: [
                'Last week’s Line Sheet is back: pick a method with one tap and type style numbers — prices appear as you type.',
                'Price breaks show the per-piece price with the small-batch fee on its own row. Type an exact quantity for an all-in order total.',
                'DTF price breaks never quote under the Quote Builder at any quantity in their range.',
                'Richardson caps such as 112FPR price as cap embroidery.',
                'Beanies and knit caps price as flat embroidery, the same as the Embroidery builder.',
                'Copy prices, customer & rep details, recent styles and the saved draft are still here, out of the way.',
            ],
        },
    ];

    const STORAGE_KEY = 'nwca.quickQuote.releaseSeen';
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const VERSION = /^(\d{4})\.(\d{2})\.(\d{2})\.(\d+)$/;

    // "…quick-quote-releases.js?v=2026.09.16.3" → "2026.09.16.3"; anything else → ''.
    function versionFrom(ref) {
        const m = /[?&]v=([^&#"'\s]+)/.exec(String(ref || ''));
        return m && VERSION.test(m[1]) ? m[1] : '';
    }
    function dateOf(version) {
        const m = VERSION.exec(version || '');
        return m ? MONTHS[Number(m[2]) - 1] + ' ' + Number(m[3]) + ', ' + m[1] : '';
    }
    function compare(a, b) {
        const x = a.split('.').map(Number), y = b.split('.').map(Number);
        for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] - y[i];
        return 0;
    }
    // The list as shown for the live version. A first entry that isn't released yet (the page
    // still carries the previous version) says so instead of borrowing that version.
    function history(current) {
        const released = ENTRIES.length < 2 || compare(current, ENTRIES[1].version) > 0;
        return ENTRIES.map((e, i) => {
            const version = i === 0 ? (released ? current : '') : e.version;
            return { version, heading: version ? 'Version ' + version + ' · ' + dateOf(version) : 'Next update (not live yet)', notes: e.notes.slice() };
        });
    }
    function currentVersion(doc) {
        const box = doc && doc.getElementById('qqRelease');
        return box ? versionFrom(box.getAttribute('data-release')) : '';
    }
    function read(storage) {
        try { return storage ? storage.getItem(STORAGE_KEY) : null; } catch (e) { return null; }
    }
    function remember(storage, version) {
        try { if (storage) storage.setItem(STORAGE_KEY, version); } catch (e) { /* per-browser convenience only */ }
    }

    function section(doc, entry) {
        const block = doc.createElement('section');
        const heading = doc.createElement('h2');
        const list = doc.createElement('ul');
        block.className = 'qq-release-entry';
        heading.textContent = entry.heading;
        entry.notes.forEach(note => { const item = doc.createElement('li'); item.textContent = note; list.appendChild(item); });
        block.append(heading, list);
        return block;
    }

    // A dropdown that floats over the page (the form never moves): the latest notes, with older
    // versions folded away. Closes on a second click, Escape or a click anywhere else.
    function mount(doc, storage) {
        const box = doc.getElementById('qqRelease');
        const version = currentVersion(doc);
        if (!box || !version) return null;
        const label = doc.getElementById('qqReleaseLabel');
        const toggle = doc.getElementById('qqReleaseToggle');
        const badge = doc.getElementById('qqReleaseBadge');
        const panel = doc.getElementById('qqReleaseNotes');
        const [latest, ...earlier] = history(version);
        label.textContent = 'Version ' + version + ' · Updated ' + dateOf(version);
        const parts = [section(doc, latest)];
        if (earlier.length) {
            const more = doc.createElement('details');
            const summary = doc.createElement('summary');
            more.className = 'qq-release-earlier';
            summary.textContent = 'Earlier versions';
            more.append(summary, ...earlier.map(entry => section(doc, entry)));
            parts.push(more);
        }
        panel.replaceChildren(...parts);
        badge.hidden = read(storage) === version;
        // Keep the floating panel inside the window: shift it left when the link sits near the
        // right edge (a 900–990px window), never past the left gutter.
        const view = doc.defaultView;
        const place = () => {
            panel.style.left = '';
            const width = doc.documentElement.clientWidth;
            if (!width || panel.hidden) return;
            const rect = panel.getBoundingClientRect(), gutter = 16;
            const over = rect.right - (width - gutter);
            if (over > 0) panel.style.left = -Math.min(over, Math.max(0, rect.left - gutter)) + 'px';
        };
        // Seen badges keep their space until the next visit, so the line never shifts under the pointer.
        const setOpen = open => {
            panel.hidden = !open;
            toggle.setAttribute('aria-expanded', String(open));
            if (open) { remember(storage, version); badge.style.visibility = 'hidden'; place(); }
        };
        toggle.addEventListener('click', () => setOpen(panel.hidden));
        if (view) view.addEventListener('resize', place);
        // Keyboard users tabbing past the list close it, so it never covers the focused control.
        box.addEventListener('focusout', event => {
            if (!panel.hidden && event.relatedTarget && !box.contains(event.relatedTarget)) setOpen(false);
        });
        doc.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || panel.hidden) return;
            const inside = box.contains(doc.activeElement) || doc.activeElement === doc.body;
            setOpen(false);
            if (inside) toggle.focus();
        });
        doc.addEventListener('click', event => {
            if (!panel.hidden && !box.contains(event.target)) setOpen(false);
        });
        box.hidden = false;
        return { version, badge: !badge.hidden };
    }

    function browserStorage() {
        try { return root.localStorage; } catch (e) { return null; }
    }

    const api = { ENTRIES, STORAGE_KEY, versionFrom, dateOf, compare, history, currentVersion, mount,
        current: () => (typeof document === 'undefined' ? '' : currentVersion(document)) };
    root.QuickQuoteReleases = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (typeof document !== 'undefined' && document.getElementById) {
        const start = () => mount(document, browserStorage());
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
        else start();
    }
})(typeof window !== 'undefined' ? window : globalThis);
