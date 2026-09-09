/* Runtime style census. Read-only: tracked sources, route AST, CSS imports and JS module graph.
 * This reports evidence, not visual certification. Migration state comes from the reviewed manifest.
 * node scripts/css/runtime-inventory.js [--out path.json]
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const ROOT = process.cwd();
const localRequire = createRequire(path.join(ROOT, 'package.json'));
const espree = localRequire('espree');
const { JSDOM, VirtualConsole } = localRequire('jsdom');
const postcss = localRequire('postcss');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const unique = list => [...new Set(list)].sort();
const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
const exists = file => fs.existsSync(path.join(ROOT, file));
function local(owner, url) {
    if (!url || /^(?:[a-z]+:|\/\/|#)/i.test(url)) return null;
    const clean = url.split(/[?#]/)[0];
    return clean.startsWith('/') ? clean.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(owner), clean));
}
function parse(source) { return espree.parse(source, { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true }, loc: true, range: true }); }
function walk(node, fn) {
    if (!node || typeof node.type !== 'string') return;
    fn(node);
    for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(child => walk(child, fn));
        else if (value && typeof value === 'object' && value.type) walk(value, fn);
    }
}
function literals(node) {
    if (!node) return [];
    if (node.type === 'Literal' && typeof node.value === 'string') return [node.value];
    if (node.type === 'ArrayExpression') return node.elements.flatMap(literals);
    return [];
}
// Read only literal routes and path.join source targets. Never execute the server.
const routes = [];
for (const file of files.filter(f => f === 'server.js' || /^routes\/.*\.js$/.test(f))) {
    const ast = parse(read(file));
    walk(ast, node => {
        if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') return;
        if (node.callee.object.name !== 'app' || node.callee.property.name !== 'get') return;
        const urls = literals(node.arguments[0]);
        if (!urls.length) return;
        const targets = [];
        let redirect = false;
        for (const arg of node.arguments.slice(1)) walk(arg, child => {
            if (child.type !== 'CallExpression' || child.callee.type !== 'MemberExpression') return;
            const name = child.callee.object.name + '.' + child.callee.property.name;
            if (name === 'res.redirect') redirect = true;
            if (name === 'path.join') {
                const segments = child.arguments.slice(1).flatMap(literals);
                if (segments.length && /\.html$/.test(segments.at(-1))) targets.push(segments.join('/'));
            }
        });
        const gates = node.arguments.slice(1).filter(n => n.type === 'Identifier').map(n => n.name);
        routes.push({ urls, targets: unique(targets), gates, redirect, owner: file, line: node.loc.start.line });
    });
}
const cssCache = new Map();
function cssInfo(file) {
    if (cssCache.has(file)) return cssCache.get(file);
    if (!exists(file)) return { missing: true, bytes: 0, important: 0, imports: [] };
    const source = read(file);
    let ast;
    try { ast = postcss.parse(source, { from: file }); }
    catch (error) { const info = { bytes: Buffer.byteLength(source), important: 0, imports: [], parseError: error.reason }; cssCache.set(file, info); return info; }
    const info = { bytes: Buffer.byteLength(source), important: 0, imports: [] };
    ast.walkDecls(d => { if (d.important) info.important++; });
    ast.walkAtRules('import', rule => {
        const match = rule.params.match(/^(?:url\(\s*)?["']?([^"'\s)]+)["']?/);
        if (match) info.imports.push(local(file, match[1]) || match[1]);
    });
    cssCache.set(file, info);
    return info;
}
function cssClosure(initial) {
    const seen = new Set();
    function visit(file) {
        if (seen.has(file) || /^(?:[a-z]+:|\/\/)/i.test(file)) return;
        seen.add(file); cssInfo(file).imports.forEach(visit);
    }
    initial.forEach(visit);
    return [...seen];
}
const jsCache = new Map();
function jsInfo(file) {
    if (jsCache.has(file)) return jsCache.get(file);
    const result = { imports: [], cssReferences: [], generatedStyles: false, inlineStyles: false };
    jsCache.set(file, result);
    if (!exists(file) || /\/vendor\//.test(file)) return result;
    const source = read(file);
    let ast;
    try { ast = parse(source); }
    catch (error) { result.parseError = error.message; return result; }
    walk(ast, node => {
        if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)) {
            for (const url of literals(node.source)) {
                const target = local(file, url);
                if (target && /\.m?js$/.test(target)) result.imports.push(target);
            }
        }
        if (node.type === 'ImportExpression') {
            for (const url of literals(node.source)) {
                const target = local(file, url);
                if (target && /\.m?js$/.test(target)) result.imports.push(target);
            }
        }
        if (node.type === 'Literal' && typeof node.value === 'string' && /\.css(?:\?|$)/.test(node.value)) {
            const target = local(file, node.value);
            if (target && exists(target)) result.cssReferences.push(target);
        }
    });
    result.generatedStyles = /<style\b|createElement\(['"]style['"]\)/i.test(source);
    result.inlineStyles = /\bstyle\s*=\s*["']|\.style\.(?:cssText|setProperty)/.test(source);
    result.cssReferences = unique(result.cssReferences);
    return result;
}
function jsClosure(initial) {
    const seen = new Set();
    function visit(file) { if (seen.has(file)) return; seen.add(file); jsInfo(file).imports.forEach(visit); }
    initial.forEach(visit); return [...seen];
}
function classification(file, directRoutes) {
    // This is the browser-based template editor, not an email-client document.
    if (file === 'training/lead-email-templates.html') return ['application', null];
    if (/email.?template|emailjs.?template/i.test(file)) return ['email', 'Email clients require a separate maintained style contract.'];
    if (/^(?:tests?|reference|templates)\/|\/templates\//.test(file)) return ['fixture-or-template', 'Not a production page.'];
    if (/archive\//.test(file)) return directRoutes.length ? ['served-archive', 'Explicit server route still serves this archived source.'] : ['archive', 'Archived source; no literal file-serving route found.'];
    if (['pages/3-day-tees.html', 'pages/mockup-generator.html', 'calculators/sticker-manual-pricing.html'].includes(file)) return ['retired-source', 'Redirect/retirement source retained; verify aliases before removal.'];
    return ['application', null];
}
function family(file, sheets) {
    if (file.startsWith('quote-builders/')) return 'quote-builder';
    if (file.startsWith('calculators/')) return 'calculator';
    if (/training|reference|brand-standards|polic|resources/.test(file)) return 'reference-training';
    if (/webstore|company-store/.test(file)) return 'webstore';
    if (/^dashboards\//.test(file)) return 'staff-workspace';
    if (/^staff-dashboard/.test(file)) return 'staff-home';
    if (/^(?:admin|tools|vendor-portals)\//.test(file)) return 'staff-tool';
    if (/request-a-quote|inquiry|forms?\//.test(file)) return 'customer-form';
    if (/quote-view|invoice|approval|portal|mockup-detail/.test(file)) return 'detail-document';
    if (sheets.some(s => s.endsWith('/nwca-2026-core.css')) || /custom-|product|catalog|brands/.test(file)) return 'storefront';
    return 'special-page';
}
const manifest = JSON.parse(read('scripts/css/migration-manifest.json'));
const reviewed = new Map(manifest.pilots.map(p => [p.source, p]));
// The census only reads attributes. Reuse one parser instead of creating a
// complete browser window for every tracked document; scripts stay inert.
const censusWindow = new JSDOM('', { virtualConsole: new VirtualConsole() }).window;
const htmlParser = new censusWindow.DOMParser();
const surfaces = files.filter(f => f.endsWith('.html')).map(file => {
    const document = htmlParser.parseFromString(read(file), 'text/html');
    const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map(el => el.getAttribute('href'));
    const directStyles = styles.map(url => local(file, url)).filter(Boolean);
    const scripts = [...document.querySelectorAll('script[src]')].map(el => local(file, el.getAttribute('src'))).filter(Boolean);
    const scriptGraph = jsClosure(scripts);
    const runtimeOwners = scriptGraph.filter(f => {
        const js = jsInfo(f); return js.cssReferences.length || js.generatedStyles || js.inlineStyles || js.parseError;
    }).map(source => ({ source, ...jsInfo(source) }));
    const dynamicStyles = unique(runtimeOwners.flatMap(o => o.cssReferences));
    const allStyles = cssClosure([...directStyles, ...dynamicStyles]);
    const directRoutes = routes.filter(r => r.targets.includes(file));
    const [kind, exception] = classification(file, directRoutes);
    const pilot = reviewed.get(file);
    const embeds = [...document.querySelectorAll('iframe[src],script[src]')].map(el => el.getAttribute('src')).filter(url => /^https?:\/\//.test(url) && /caspio|youtube|vimeo|inksoft/.test(url));
    const record = {
        source: file, kind, family: pilot?.family || family(file, directStyles),
        status: pilot ? 'verified-migration' : kind === 'application' || kind === 'served-archive' ? 'pending' : 'exception',
        exception, sourceRoute: '/' + file, aliases: unique(directRoutes.flatMap(r => r.urls)),
        routeEvidence: directRoutes.map(({ owner, line, gates }) => ({ owner, line, gates })),
        directStyles, externalStyles: styles.filter(url => !local(file, url)), dynamicStyles, allStyles,
        rawCssBytes: allStyles.reduce((n, f) => n + cssInfo(f).bytes, 0),
        importantDeclarations: allStyles.reduce((n, f) => n + cssInfo(f).important, 0),
        missingStyles: allStyles.filter(f => cssInfo(f).missing),
        cssParseErrors: allStyles.filter(f => cssInfo(f).parseError).map(source => ({ source, error: cssInfo(source).parseError })),
        scriptEntry: scripts, runtimeOwners, externalEmbeds: unique(embeds),
        states: pilot?.states || [], tests: pilot ? [pilot.test] : [],
        stateCoverage: pilot ? 'Manifest states tested; other states remain subject to review.' : 'Pending family fixtures; source inspection is not browser coverage.',
    };
    return record;
});
censusWindow.close();
const counts = key => Object.fromEntries(unique(surfaces.map(s => s[key])).map(value => [value, surfaces.filter(s => s[key] === value).length]));
const report = {
    scope: 'Tracked HTML, literal GET/path.join routes, CSS imports, JS ESM dependency closure and known runtime owners. Static evidence; no routes or business services executed. Variable-built routes/styles still require family review.',
    summary: { surfaces: surfaces.length, kind: counts('kind'), family: counts('family'), status: counts('status') },
    serverGeneratedOwners: manifest.pendingRuntimeOwners.filter(o => o.kind === 'server-generated'),
    surfaces,
};
const output = JSON.stringify(report, null, 2) + '\n';
const out = process.argv.indexOf('--out');
if (out !== -1) {
    if (!process.argv[out + 1]) throw new Error('--out requires a path');
    fs.writeFileSync(process.argv[out + 1], output);
    console.log(JSON.stringify(report.summary, null, 2));
} else process.stdout.write(output);
