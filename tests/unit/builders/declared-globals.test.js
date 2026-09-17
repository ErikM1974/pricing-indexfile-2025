/**
 * Builder modules may only lean on page globals that really are globals (2026-09-16).
 *
 * shopworks-import.js listed reorderRowByProductType in its `global` lint comment and called it
 * bare, but the function is private to product-rows.js. Bundling renamed the private copy, so
 * every ShopWorks import of a product missing from SanMar threw before its color and sizes were
 * set, and the line silently dropped out of the quote total. jsdom suites stubbed the name, so
 * nothing failed. This lock reads every builder module: a name declared as a global must be a
 * real page global (a classic script the builder pages load defines it) or bridged to window —
 * never only a private declaration inside another builder module.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../..');
const BUILDERS = path.join(ROOT, 'shared_components/js/builders');
const TOP_LEVEL = /^(?:export\s+)?(?:async\s+)?(?:function\s*\*?\s*|class\s+|const\s+|let\s+|var\s+)([A-Za-z_$][\w$]*)/gm;
const WINDOW_BRIDGE = /(?:^|[^\w$.])window\.([A-Za-z_$][\w$]*)\s*=/g;

function modules(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return modules(full);
        return entry.name.endsWith('.js') ? [full] : [];
    });
}

const files = modules(BUILDERS).map((file) => ({
    file: path.relative(ROOT, file).replace(/\\/g, '/'),
    source: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n'),
}));

const declaredGlobals = [];
const privateDeclarations = new Map();   // name -> [file]
const bridged = new Set();
for (const { file, source } of files) {
    for (const comment of source.matchAll(/\/\*\s*global\s+([\s\S]*?)\*\//g)) {
        for (const name of comment[1].split(/[\s,]+/).map((n) => n.split(':')[0].trim()).filter(Boolean)) {
            declaredGlobals.push({ file, name });
        }
    }
    for (const match of source.matchAll(TOP_LEVEL)) {
        privateDeclarations.set(match[1], [...(privateDeclarations.get(match[1]) || []), file]);
    }
    for (const match of source.matchAll(WINDOW_BRIDGE)) bridged.add(match[1]);
}

// Real page globals: top-level declarations (and window bridges) in the classic scripts the four
// builder pages load. A name defined there is a global even if a module also has a private copy.
const pageGlobals = new Set();
for (const page of ['embroidery', 'screenprint', 'dtf', 'dtg']) {
    const html = fs.readFileSync(path.join(ROOT, `quote-builders/${page}-quote-builder.html`), 'utf8');
    for (const tag of html.matchAll(/<script\s([^>]*?)src="(\/[^"?]+)[^"]*"[^>]*>/g)) {
        if (/type="module"/.test(tag[0])) continue;
        const file = path.join(ROOT, tag[2]);
        if (!file.endsWith('.js') || !fs.existsSync(file)) continue;
        const source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
        for (const match of source.matchAll(TOP_LEVEL)) pageGlobals.add(match[1]);
        for (const match of source.matchAll(WINDOW_BRIDGE)) pageGlobals.add(match[1]);
    }
}

test('the lock reads real files (builder modules, their declared globals, the pages\' classic scripts)', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(declaredGlobals.length).toBeGreaterThan(20);
    expect(pageGlobals.has('escapeHtml')).toBe(true);
    expect(pageGlobals.has('showToast')).toBe(true);
});

test('no module treats another builder module\'s private function as a page global', () => {
    const problems = declaredGlobals
        .filter(({ name }) => privateDeclarations.has(name) && !bridged.has(name) && !pageGlobals.has(name))
        .map(({ file, name }) => `${file} uses ${name} as a global, but it is private to ${privateDeclarations.get(name).join(', ')} — import it instead`);
    expect(problems).toEqual([]);
});
