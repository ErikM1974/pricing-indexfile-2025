const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const fixture = require('../fixtures/crm-workspaces-original-content.json');
const records = require('../fixtures/lead-records-original-content.json');
const root = path.resolve(__dirname, '../..'), norm = s => s.replace(/\s+/g, ' ').trim();
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
test.each(fixture.pages)('$file preserves page content, destinations, identifiers and form values', original => {
    const d = new JSDOM(fs.readFileSync(path.join(root, original.file), 'utf8')).window.document;
    d.querySelectorAll('.skip-link').forEach(n => n.remove());
    expect(d.title).toBe(original.title); expect(hash(norm(d.body.textContent))).toBe(original.bodyTextSha);
    expect([...d.querySelectorAll('[id]')].map(n => n.id).filter(id => id !== 'crm-main').sort()).toEqual([...original.ids].sort());
    expect([...d.querySelectorAll('a[href]')].map(n => ({ href: n.getAttribute('href'), label: norm(n.textContent) }))).toEqual(original.links);
    expect([...d.querySelectorAll('input,select,textarea')].map(n => ({ id: n.id, type: n.type, value: n.value }))).toEqual(original.fields);
});
test.each(Object.keys(fixture.hashes))('%s preserves calculations and data contracts through the CRM and lead-record migrations', file => {
    const retired = records.retiredStyles.find(r => r.file === file);
    if (retired) { expect(retired.sha256).toBe(fixture.hashes[file]); expect(fs.existsSync(path.join(root, file))).toBe(false); return; }
    // The records suite separately checks current HTML semantics against this original source.
    const page = records.pages.find(p => p.file === file);
    let s = (page ? page.html : fs.readFileSync(path.join(root, file), 'utf8')).replace(/\r\n/g, '\n');
    if (!page) for (const change of records.changes.filter(c => c.file === file).reverse()) {
        expect(s.split(change.after).length - 1).toBe(change.count);
        s = s.split(change.after).join(change.before);
    }
    for (const change of fixture.changes.filter(c => c.file === file).reverse()) {
        expect(change.after).not.toBe(''); expect(s.split(change.after).length - 1).toBe(change.count);
        s = s.split(change.after).join(change.before);
    }
    expect(hash(s)).toBe(fixture.hashes[file]);
});

test.each(['lead-scorecard', 'unqualified-leads'])('%s static preview mirrors the current production main and styles', tool => {
    const page = new JSDOM(fs.readFileSync(path.join(root, 'dashboards/' + tool + '.html'), 'utf8')).window.document;
    const preview = new JSDOM(fs.readFileSync(path.join(root, 'tests/ui/test-' + tool + '.html'), 'utf8')).window.document;
    expect(norm(preview.querySelector('main').outerHTML)).toBe(norm(page.querySelector('main').outerHTML));
    const styles = d => [...d.querySelectorAll('link[rel="stylesheet"]')].map(n => n.href).filter(h => !h.includes('/tests/ui/'));
    expect(styles(preview)).toEqual(styles(page)); expect(preview.body.dataset).toMatchObject({ ui: 'unified', crmWorkspace: tool });
    const scripts = [...preview.querySelectorAll('script[src]')].map(n => n.src);
    expect(scripts.indexOf('/tests/ui/test-' + tool + '-stub.js')).toBeLessThan(scripts.findIndex(s => s.startsWith('/dashboards/js/' + tool)));
});
