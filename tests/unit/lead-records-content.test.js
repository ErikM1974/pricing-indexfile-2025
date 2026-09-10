const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { JSDOM } = require('jsdom');
const original = require('../fixtures/lead-records-original-content.json');
const root = path.resolve(__dirname, '../..'), norm = s => s.replace(/\s+/g, ' ').trim();
const hash = s => crypto.createHash('sha256').update(s).digest('hex');

test.each(original.pages)('$file preserves original labels, destinations, identifiers and field values', record => {
    const d = new JSDOM(fs.readFileSync(path.join(root, record.file), 'utf8')).window.document;
    d.querySelectorAll('.skip-link').forEach(n => n.remove());
    expect(d.title).toBe(record.title); expect(hash(norm(d.body.textContent))).toBe(record.bodyTextSha);
    expect([...d.querySelectorAll('[id]')].map(n => n.id).filter(id => id !== 'main-content').sort()).toEqual([...record.ids].sort());
    expect([...d.querySelectorAll('a[href]')].map(n => ({ href: n.getAttribute('href'), label: norm(n.textContent) }))).toEqual(record.links);
    expect([...d.querySelectorAll('input,select,textarea')].map(n => ({ id: n.id, type: n.type, value: n.value }))).toEqual(record.fields);
});

test.each(Object.keys(original.hashes).filter(f => !f.endsWith('.html')))('%s retains original business logic and shared dependencies outside recorded UI changes', file => {
    const retired = original.retiredStyles.find(r => r.file === file);
    if (retired) {
        expect(retired.sha256).toBe(original.hashes[file]);
        expect(fs.existsSync(path.join(root, file))).toBe(false);
        return;
    }
    let s = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
    for (const change of original.changes.filter(c => c.file === file).reverse()) {
        expect(change.after).not.toBe(''); expect(s.split(change.after).length - 1).toBe(change.count);
        s = s.split(change.after).join(change.before);
    }
    expect(hash(s)).toBe(original.hashes[file]);
});

test('retired styles have no remaining HTML consumer and dynamic art ownership stays explicit', () => {
    const files = require('node:child_process').execFileSync('git', ['ls-files', '-z', '*.html'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
    for (const file of files) {
        const d = new JSDOM(fs.readFileSync(path.join(root, file), 'utf8')).window.document;
        for (const link of d.querySelectorAll('link[rel="stylesheet"]')) {
            for (const retired of original.retiredStyles) expect(link.getAttribute('href').split('?')[0]).not.toBe('/' + retired.file);
        }
    }
    const manifest = require('../../scripts/css/migration-manifest.json');
    const lead = manifest.pilots.find(p => p.source === 'dashboards/lead.html');
    expect(lead.dynamicStyles).toEqual(['shared_components/css/garment-submit-form.css']);
    expect(lead.runtimeBoundary.status).toBe('shared-module-migration-pending');
    expect(lead.measuredTriggeredCssBytes).toBe(lead.measuredRawCssBytes + Buffer.byteLength(fs.readFileSync(path.join(root, lead.dynamicStyles[0]), 'utf8').replace(/\r\n/g, '\n')));
    expect(manifest.pendingRuntimeOwners.find(p => p.kind === 'dynamic-css').owners).toContain('dashboards/js/lead-workspace.js');
});

test.each([['lead', 'lead-workspace', 'test-leads-stub.js'], ['form-submissions', 'form-submissions', 'test-form-submissions-stub.js'], ['leads', 'leads', 'test-leads-stub.js']])('%s preview follows current markup, assets and mock boundary', (page, preview, stub) => {
    const production = new JSDOM(fs.readFileSync(path.join(root, 'dashboards/' + page + '.html'), 'utf8')).window.document;
    const harness = new JSDOM(fs.readFileSync(path.join(root, 'tests/ui/test-' + preview + '.html'), 'utf8')).window.document;
    expect(norm(harness.querySelector('main').outerHTML)).toBe(norm(production.querySelector('main').outerHTML));
    expect(harness.body.dataset.ui).toBe('unified');
    const styles = d => [...d.querySelectorAll('link[rel="stylesheet"]')].map(n => n.href).filter(h => !h.startsWith('/tests/ui/'));
    expect(styles(harness)).toEqual(styles(production));
    expect([...harness.querySelectorAll('[role="dialog"],dialog')].map(n => norm(n.outerHTML))).toEqual([...production.querySelectorAll('[role="dialog"],dialog')].map(n => norm(n.outerHTML)));
    const scripts = [...harness.querySelectorAll('script[src]')].map(n => n.src);
    expect(scripts.indexOf('/tests/ui/' + stub)).toBeLessThan(scripts.findIndex(s => s.startsWith('/dashboards/js/' + (page === 'lead' ? 'lead-workspace' : page) + '.js')));
});
