/**
 * Production Shifts + Roland Printer Supplies — 2026-09-05 review locks.
 *   Shifts: ships PRODUCTION React builds (dev builds + their warnings went to staff since launch);
 *   master-table rows have a keyboard path (a real button in the name cell, aria-pressed); timeline
 *   row labels / roster cards / dept chips carry aria-pressed; the detail panel is a labelled dialog
 *   whose effect focuses Close, closes on Esc and returns focus — with a STABLE onClose (useCallback)
 *   so the effect does not re-run every render; every button has type="button".
 *   Roland: decorative icons aria-hidden; still no inline code.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('production shifts', () => {
    const html = read('dashboards/production-shifts.html');
    const jsx = read('dashboards/production-shifts/app.jsx');
    const css = read('dashboards/production-shifts/styles.css');
    test('production React builds with integrity, versions bumped', () => {
        expect(html).toMatch(/react@18\.3\.1\/umd\/react\.production\.min\.js" integrity="sha384-/);
        expect(html).toMatch(/react-dom@18\.3\.1\/umd\/react-dom\.production\.min\.js" integrity="sha384-/);
        expect(html).not.toMatch(/\.development\.js/);
        // versioned, not pinned to a date: the deploy cache-bust rewrites ?v= on every changed asset
        expect(html).toMatch(/app\.jsx\?v=2026\.\d{2}\.\d{2}\.\d+/);
        expect(html).toMatch(/styles\.css\?v=2026\.\d{2}\.\d{2}\.\d+/);
    });
    test('keyboard paths + pressed state', () => {
        expect(jsx).toMatch(/className="td-name-wrap row-btn"\s+aria-pressed=\{isSel\}/);
        expect(jsx).toMatch(/className=\{`tl-row-label \$\{isSelected \? "selected" : ""\}`\}\s+aria-pressed=\{isSelected\}/);
        expect(jsx).toMatch(/aria-pressed=\{selectedId === emp\.id\}/);
        expect(jsx).toMatch(/aria-pressed=\{dept === d\}/);
        expect(jsx).toMatch(/<div className="chip-row" role="group" aria-label="Filter by department">/);
        expect(jsx).not.toMatch(/<button\s+className=/); // every button declares type="button"
        expect(jsx).not.toMatch(/<button className=/);
        expect(css).toMatch(/\.row-btn \{/);
    });
    test('detail panel is a dialog with focus + Esc, stable onClose', () => {
        expect(jsx).toMatch(/<aside className="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-name">/);
        expect(jsx).toMatch(/<div className="detail-name" id="detail-name">/);
        expect(jsx).toMatch(/returnRef\.current = document\.activeElement;/);
        expect(jsx).toMatch(/if \(e\.key === "Escape"\) onClose\(\);/);
        expect(jsx).toMatch(/const closeDetail = useCallback\(\(\) => setSelectedId\(null\), \[\]\);/);
        expect(jsx).toMatch(/<DetailPanel emp=\{selected\} onClose=\{closeDetail\} \/>/);
        expect(jsx).toMatch(/<div className="scrim" aria-hidden="true"/);
        expect(jsx).toMatch(/const \{ useState, useMemo, useEffect, useRef, useCallback \} = React;/);
    });
});

describe('roland printer supplies', () => {
    const html = read('dashboards/roland-printer-supplies.html').replace(/<!--[\s\S]*?-->/g, '');
    test('icons decorative, one h1, no inline code', () => {
        expect(html).not.toMatch(/<i class="fa[^"]*"><\/i>/);
        expect((html.match(/<h1\b/g) || []).length).toBe(1);
        expect(html).not.toMatch(/<style>/);
        expect(html).not.toMatch(/<script>[^<]/);
        expect(html).not.toMatch(/style="/);
    });
});
