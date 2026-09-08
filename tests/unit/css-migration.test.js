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
    test('migrated styles have resolved tokens, no important rules, no CSS IDs or shadowed global scales', () => {
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
                expect({ file, property: d.prop, important: Boolean(d.important) }).toMatchObject({ important: false });
                expect(d.prop).not.toMatch(/^--(?:space-|font-size-|radius-|shadow-)/);
                for (const token of d.value.matchAll(/var\((--[\w-]+)/g)) {
                    expect({ file, token: token[1], defined: knownTokens.has(token[1]) || manifest.pilots.some(p => p.styles.includes(file) && (p.dynamicTokens || []).includes(token[1])) }).toMatchObject({ defined: true });
                }
            });
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
