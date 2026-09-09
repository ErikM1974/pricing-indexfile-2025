const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const postcss = require('postcss');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const manifest = JSON.parse(read('scripts/css/migration-manifest.json'));

describe('unified CSS ownership and preserved content', () => {
    const knownTokens = new Set();
    postcss.parse(read('shared_components/css/tokens.css')).walkDecls(d => {
        if (d.prop.startsWith('--')) knownTokens.add(d.prop);
    });
    test.each(manifest.pilots)('$source keeps its audited style owners and byte budget', pilot => {
        const document = new JSDOM(read(pilot.source)).window.document;
        expect(document.body.dataset.ui).toBe('unified');
        const assets = [...document.querySelectorAll('link[rel="stylesheet"]')]
            .map(el => el.getAttribute('href').split('?')[0]).filter(href => href.startsWith('/'));
        expect(assets).toEqual(pilot.styles.map(file => '/' + file));
        // Match committed source bytes across Windows CRLF and Linux LF checkouts.
        const bytes = pilot.styles.reduce((sum, file) => sum + Buffer.byteLength(read(file).replace(/\r\n/g, '\n')), 0);
        expect(bytes).toBeLessThanOrEqual(pilot.maxCssBytes);
        expect(pilot.states.length).toBeGreaterThan(0);
    });
    test('migrated styles resolve tokens in every consuming page and keep bounded visibility exceptions', () => {
        const normalize = value => value.replace(/\s+/g, ' ').trim();
        const declaredByFile = new Map();
        for (const file of new Set(manifest.pilots.flatMap(p => p.styles))) {
            const names = new Set();
            postcss.parse(read(file)).walkDecls(d => { if (d.prop.startsWith('--')) names.add(d.prop); });
            declaredByFile.set(file, names);
        }
        const tokensByPage = new Map(manifest.pilots.map(pilot => [pilot.source,
            new Set([...knownTokens, ...(pilot.dynamicTokens || []), ...pilot.styles.flatMap(file => [...declaredByFile.get(file)])])
        ]));
        const exceptions = manifest.importantExceptions || [];
        const usedExceptions = [];
        const files = new Set(manifest.pilots.flatMap(p => p.styles));
        files.delete('shared_components/css/tokens.css');
        // Existing utility animations/sr-only remain independently maintained and linted.
        files.delete('shared_components/css/utilities.css');
        for (const file of files) {
            const css = postcss.parse(read(file));
            css.walkRules(rule => {
                if (rule.parent.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return;
                expect({ file, selector: rule.selector }).not.toMatchObject({ selector: expect.stringMatching(/#[\w-]+/) });
                expect(rule.selector).toContain('[data-ui="unified"]');
            });
            css.walkDecls(d => {
                if (d.important) {
                    const exception = exceptions.find(item => item.file === file && item.selector === normalize(d.parent.selector) && item.property === d.prop && item.value === d.value);
                    expect({ file, selector: d.parent.selector, property: d.prop, documented: Boolean(exception) }).toMatchObject({ documented: true });
                    expect(exception.reason.length).toBeGreaterThan(20);
                    if (exception.context === 'print') {
                        let parent = d.parent;
                        while (parent && !(parent.type === 'atrule' && parent.name === 'media' && parent.params === 'print')) parent = parent.parent;
                        expect(Boolean(parent)).toBe(true);
                    }
                    usedExceptions.push(exception);
                }
                expect(d.prop).not.toMatch(/^--(?:space-|font-size-|radius-|shadow-)/);
                for (const token of d.value.matchAll(/var\((--[\w-]+)/g)) {
                    for (const pilot of manifest.pilots.filter(p => p.styles.includes(file))) {
                        expect({ page: pilot.source, file, token: token[1], defined: tokensByPage.get(pilot.source).has(token[1]) }).toMatchObject({ defined: true });
                    }
                }
            });
        }
        expect(usedExceptions).toHaveLength(exceptions.length);
        expect(exceptions).toHaveLength(4);
        expect(exceptions.every(item => item.file === 'pages/css/art-request-detail.css')).toBe(true);
    });
    test('unified transfer consumers load the dialog dependency before the sender', () => {
        for (const pilot of manifest.pilots) {
            const document = new JSDOM(read(pilot.source)).window.document;
            const scripts = [...document.querySelectorAll('script[src]')].map(el => el.getAttribute('src').split('?')[0]);
            const sender = scripts.indexOf('/shared_components/js/transfer-actions-shared.js');
            if (sender < 0) continue;
            const dialog = scripts.indexOf('/shared_components/js/ui-dialog.js');
            expect({ page: pilot.source, ready: dialog >= 0 && dialog < sender }).toMatchObject({ ready: true });
        }
    });
    test('billing prices, prose, anchors and navigation match the pre-migration content', () => {
        const document = new JSDOM(read('pages/art-billing-reference.html')).window.document;
        const main = document.querySelector('main');
        const content = {
            text: main.textContent.replace(/\s+/g, ' ').trim(),
            ids: [...main.querySelectorAll('[id]')].map(el => el.id),
            links: [...document.querySelectorAll('a')].map(el => [el.getAttribute('href'), el.textContent.replace(/\s+/g, ' ').trim()]),
        };
        const digest = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
        expect(digest).toBe(manifest.billingContentSha256);
    });
});


test('Ruth billing reference preserves its prices, explanatory text and field IDs', () => {
  const main = new JSDOM(read('dashboards/art-hub-ruth.html')).window.document.querySelector('#billing-tab');
  const content = { text: main.textContent.replace(/\s+/g, ' ').trim(), ids: [...main.querySelectorAll('[id]')].map(el => el.id), links: [...main.querySelectorAll('a')].map(el => [el.getAttribute('href'), el.textContent.replace(/\s+/g, ' ').trim()]) };
  expect(crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex')).toBe(manifest.ruthBillingContentSha256);
});


describe('training document content and CSS ownership', () => {
    test.each(manifest.trainingContent)('$source retains its original prose, examples and destinations', entry => {
        const document = new JSDOM(read(entry.source)).window.document;
        const main = document.querySelector('main');
        const content = {
            text: main.textContent.replace(/\s+/g, ' ').trim(),
            ids: [...main.querySelectorAll('[id]')].map(el => el.id).filter(id => !id.startsWith('training-panel-')),
            links: [...document.querySelectorAll('a')].map(el => [el.getAttribute('href'), el.textContent.replace(/\s+/g, ' ').trim()]),
        };
        expect(crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex')).toBe(entry.sha256);
        expect(document.querySelectorAll('[style], style, script:not([src])')).toHaveLength(0);
    });
});

describe('service training guide preservation', () => {
    test.each(manifest.trainingServiceContent)('$source preserves prose, destinations and practice values', entry => {
        const document = new JSDOM(read(entry.source)).window.document;
        const main = document.querySelector('main');
        const content = {
            text: main.textContent.replace(/\s+/g, ' ').trim(),
            ids: [...main.querySelectorAll('[id]')].map(el => el.id).filter(id => !id.startsWith('training-')),
            links: [...document.querySelectorAll('a')].map(el => [el.getAttribute('href'), el.textContent.replace(/\s+/g, ' ').trim()]),
        };
        expect(crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex')).toBe(entry.sha256);
        expect([...document.querySelectorAll('input,textarea,select')].map(el => ({ id: el.id, value: el.value }))).toEqual(entry.fields);
        expect(document.querySelectorAll('[style], style, script:not([src]), [data-call]')).toHaveLength(0);
    });
});

describe('printable form content and field preservation', () => {
    test.each(manifest.printableFormsContent)('$source retains its original text, IDs, destinations and default values', entry => {
        const document = new JSDOM(read(entry.source)).window.document;
        const main = document.querySelector('main');
        const content = {
            text: main.textContent.replace(/\s+/g, ' ').trim(),
            ids: [...document.querySelectorAll('[id]')].map(el => el.id),
            links: [...document.querySelectorAll('a')].map(el => [el.getAttribute('href'), el.textContent.replace(/\s+/g, ' ').trim()]),
            fields: [...document.querySelectorAll('input,textarea,select')].map(el => ({ id: el.id, type: el.type, value: el.value })),
        };
        expect(crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex')).toBe(entry.sha256);
        expect(document.body.dataset.form).toBe('printable');
        expect(document.querySelectorAll('style, script:not([src])')).toHaveLength(0);
    });
});


describe('training practice content preservation', () => {
    test.each(manifest.trainingPracticeContent)('$source preserves the original lessons and exercise field defaults', entry => {
        const document = new JSDOM(read(entry.source)).window.document;
        const main = document.querySelector('main');
        const content = {
            text: main.textContent.replace(/\s+/g, ' ').trim(),
            ids: [...document.querySelectorAll('[id]')].map(el => el.id),
            links: [...document.querySelectorAll('a')].map(el => [el.getAttribute('href'), el.textContent.replace(/\s+/g, ' ').trim()]),
            fields: [...document.querySelectorAll('input,textarea,select')].map(el => ({ id: el.id, type: el.type, value: el.value })),
        };
        expect(crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex')).toBe(entry.sha256);
        expect(document.querySelectorAll('[style], style, script:not([src])')).toHaveLength(0);
    });
});


test.each(manifest.trainingPracticeData)('$source keeps the original $variable exercise data', entry => {
    const source = read(entry.source);
    const ast = require('acorn').parse(source, { ecmaVersion: 'latest' });
    const declaration = ast.body.filter(node => node.type === 'VariableDeclaration')
        .flatMap(node => node.declarations).find(node => node.id.name === entry.variable);
    expect(declaration).toBeDefined();
    const value = source.slice(declaration.init.start, declaration.init.end).replace(/\r\n/g, '\n');
    expect(crypto.createHash('sha256').update(value).digest('hex')).toBe(entry.sha256);
});
