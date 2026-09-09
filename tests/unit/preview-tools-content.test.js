const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const fixture = require('../fixtures/preview-tools-original-content.json');
const root = path.resolve(__dirname, '../..'), norm = s => s.replace(/\s+/g, ' ').trim();
test.each(fixture.pages)('$file preserves preview instructions and original inputs', original => {
    const d = new JSDOM(fs.readFileSync(path.join(root, original.file), 'utf8')).window.document;
    d.querySelectorAll('.skip-link,#dv-retry,.jmc-file-label,.dst-file-label').forEach(n => n.remove());
    expect(d.title).toBe(original.title); expect(norm(d.body.textContent)).toBe(original.bodyText);
    expect([...d.querySelectorAll('[id]')].map(n => n.id).filter(id => !['preview-main', 'dv-image-status', 'dv-lightbox-error', 'pickerTitle'].includes(id)).sort()).toEqual([...original.ids].sort());
    expect([...d.querySelectorAll('a[href]')].map(n => ({ href: n.getAttribute('href'), label: norm(n.textContent) }))).toEqual(original.links);
    expect([...d.querySelectorAll('input,select,textarea')].map(n => ({ id: n.id, type: n.type, value: n.value })).sort((a, b) => a.id.localeCompare(b.id))).toEqual([...original.fields].sort((a, b) => a.id.localeCompare(b.id)));
});
test.each(Object.keys(fixture.hashes))('%s preserves original output helpers outside recorded UI edits', file => {
    let s = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    for (const change of fixture.changes.filter(c => c.file === file).reverse()) { expect(s).toContain(change.to); s = s.replace(change.to, change.from); }
    expect(crypto.createHash('sha256').update(s).digest('hex')).toBe(fixture.hashes[file]);
});
