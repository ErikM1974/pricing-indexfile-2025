const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const original = require('../fixtures/personalization-original-content.json');
const root = path.resolve(__dirname, '../..'), norm = s => s.replace(/\s+/g, ' ').trim();
const hash = s => crypto.createHash('sha256').update(s).digest('hex');

test.each(original.pages)('$file retains original labels, names, destinations and field values', record => {
    const d = new JSDOM(fs.readFileSync(path.join(root, record.file), 'utf8')).window.document;
    d.querySelectorAll('.skip-link').forEach(n => n.remove());
    expect(d.title).toBe(record.title); expect(hash(norm(d.body.textContent))).toBe(record.bodyTextSha);
    expect([...d.querySelectorAll('[id]')].map(n => n.id).filter(id => id !== 'personalization-main').sort()).toEqual([...record.ids].sort());
    expect([...d.querySelectorAll('a[href]')].map(n => ({ href: n.getAttribute('href'), label: norm(n.textContent) }))).toEqual(record.links);
    expect([...d.querySelectorAll('input,select,textarea')].map(n => ({ id: n.id, type: n.type, value: n.value }))).toEqual(record.fields);
});

test.each(Object.keys(original.hashes).filter(f => !f.endsWith('.html')))('%s preserves service, QA and controller logic outside recorded UI edits', file => {
    let s = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    for (const change of original.changes.filter(c => c.file === file).reverse()) {
        expect(change.after).not.toBe(''); expect(s.split(change.after).length - 1).toBe(change.count);
        s = s.split(change.after).join(change.before);
    }
    expect(hash(s)).toBe(original.hashes[file]);
});
