const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const original = require('../fixtures/customer-job-status-original-content.json');
const root = path.resolve(__dirname, '../..'), norm = s => s.replace(/\s+/g, ' ').trim();
const hash = s => crypto.createHash('sha256').update(s).digest('hex');

function beforeEdits(file) {
    let text = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    for (const change of original.changes.filter(c => c.file === file).reverse()) text = text.split(change.after).join(change.before);
    return text;
}

test.each([
    ['pages/js/order-status.js', ['money', 'escapeHTML', 'promiseLabel', 'render']],
    ['pages/js/vendor-portal.js', ['esc', 'parseDate', 'fmtDate', 'isPastDue', 'statusBadge', 'matchesFilter', 'jobMatchesSearch', 'renderNotes']],
])('%s preserves financial rendering, dates and data transformations', (file, names) => {
    const espree = require('espree');
    function functions(source) {
        const found = {};
        function visit(node) {
            if (!node || typeof node !== 'object') return;
            if (node.type === 'FunctionDeclaration' && names.includes(node.id.name)) found[node.id.name] = source.slice(...node.range);
            if (node.type === 'VariableDeclarator' && names.includes(node.id.name)) found[node.id.name] = source.slice(...node.range);
            for (const value of Object.values(node)) {
                if (Array.isArray(value)) value.forEach(visit);
                else if (value && typeof value === 'object') visit(value);
            }
        }
        visit(espree.parse(source, { ecmaVersion: 'latest', range: true }));
        expect(Object.keys(found).sort()).toEqual([...names].sort());
        return found;
    }
    expect(functions(fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n'))).toEqual(functions(beforeEdits(file)));
});

test('job count labels remain text inside the three canonical filter buttons', () => {
    const d = new JSDOM(fs.readFileSync(path.join(root, 'pages/vendor-portal.html'), 'utf8')).window.document;
    expect(d.querySelectorAll('button.btn.vp-chip')).toHaveLength(3);
    expect(d.querySelectorAll('.vp-chip-count.btn')).toHaveLength(0);
    expect(d.querySelectorAll('#vp-search.field-input, #vp-comment-input.field-textarea')).toHaveLength(2);
});

test.each(original.pages)('$file preserves original labels, fields, links and identifiers', record => {
    let html = fs.readFileSync(path.join(root, record.file), 'utf8').replace(/\r\n/g, '\n');
    for (const change of original.changes.filter(c => c.file === record.file).reverse()) {
        expect(html.split(change.after).length - 1).toBe(change.count);
        html = html.split(change.after).join(change.before);
    }
    const d = new JSDOM(html).window.document;
    expect(d.title).toBe(record.title);
    expect(hash(norm(d.body.textContent))).toBe(record.bodyTextSha);
    expect([...d.querySelectorAll('[id]')].map(n => n.id).sort()).toEqual([...record.ids].sort());
    expect([...d.querySelectorAll('a[href]')].map(n => ({ href: n.getAttribute('href'), label: norm(n.textContent) }))).toEqual(record.links);
    expect([...d.querySelectorAll('input,select,textarea')].map(n => ({ id: n.id, type: n.type, value: n.value }))).toEqual(record.fields);
});

test.each(Object.keys(original.hashes).filter(f => !f.endsWith('.html')))('%s retains source outside explicitly recorded UI edits', file => {
    const retired = (original.retiredStyles || []).find(r => r.file === file);
    if (retired) {
        expect(hash(retired.css)).toBe(original.hashes[file]);
        expect(fs.existsSync(path.join(root, file))).toBe(false);
        return;
    }
    let s = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    for (const change of original.changes.filter(c => c.file === file).reverse()) {
        expect(change.after).not.toBe('');
        expect(s.split(change.after).length - 1).toBe(change.count);
        s = s.split(change.after).join(change.before);
    }
    expect(hash(s)).toBe(original.hashes[file]);
});
