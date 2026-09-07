#!/usr/bin/env node
/**
 * extract-section.js — move a contiguous section of server.js into routes/<name>.js VERBATIM (server split, 2026-09-07).
 *
 *   node scripts/server/extract-section.js --name customer-portal --from 7091 --to 10407 [--dry] [--title "Customer Portal"]
 *
 * What it does, and what it refuses to do:
 *   - Parses server.js (espree + eslint-scope) and takes every top-level statement whose lines fall inside --from..--to.
 *     The range must start and end on statement boundaries (comments between statements are carried along).
 *   - Computes the section's free names: identifiers used inside that resolve to server.js module-scope bindings
 *     declared OUTSIDE the section. Those become `const { … } = ctx;` at the top of the module, and the call site in
 *     server.js passes exactly those names: `{ const ctx = { … }; require('./routes/<name>')(app, ctx); }`.
 *   - REFUSES (prints the reason, writes nothing) when the move would change behaviour:
 *       • a binding declared inside the section is referenced outside it (a shared helper — move it to lib/ first,
 *         or leave it out of the range);
 *       • a `let`/`var` declared outside the section is ASSIGNED inside it (destructuring would copy the value;
 *         hoist that state into an object first);
 *       • a non-function ctx binding is declared BELOW the section (it would be in its temporal dead zone at the
 *         call site — move the declaration up first).
 *   - The section's code is inserted unchanged (byte for byte, same indentation): the route order and every handler
 *     body are exactly what they were, which is what tests/unit/server-route-table.test.js then proves.
 */
const fs = require('fs');
const path = require('path');
const espree = require('espree');
const eslintScope = require('eslint-scope');

const ROOT = path.resolve(__dirname, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []).filter(Boolean));
const NAME = args.name, FROM = Number(args.from), TO = Number(args.to), DRY = !!args.dry, TITLE = args.title || NAME;
if (!NAME || !FROM || !TO) { console.error('usage: --name <routes-file-name> --from <line> --to <line> [--dry] [--title "…"]'); process.exit(2); }

const serverPath = path.join(ROOT, 'server.js');
const raw = fs.readFileSync(serverPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const ast = espree.parse(raw, { ecmaVersion: 2024, sourceType: 'script', loc: true, range: true, comment: true });
const scopeManager = eslintScope.analyze(ast, { ecmaVersion: 2024, sourceType: 'script' });
const moduleScope = scopeManager.acquire(ast); // global scope for a script

// 1. the statements in range, on boundaries
const inRange = ast.body.filter((s) => s.loc.start.line >= FROM && s.loc.end.line <= TO);
const straddling = ast.body.filter((s) => (s.loc.start.line < FROM && s.loc.end.line >= FROM) || (s.loc.start.line <= TO && s.loc.end.line > TO));
if (straddling.length) { console.error(`REFUSED: the range splits a statement at lines ${straddling.map((s) => `${s.loc.start.line}-${s.loc.end.line}`).join(', ')}`); process.exit(1); }
if (!inRange.length) { console.error('REFUSED: no top-level statement in range'); process.exit(1); }
const within = (line) => line >= FROM && line <= TO;

// 2. module-scope bindings: declared inside vs outside the section
const bindings = moduleScope.variables.filter((v) => v.defs.length);
const declaredIn = new Map(); // name -> { kind, line }
const declaredOut = new Map();
for (const v of bindings) {
    const def = v.defs[0];
    const line = def.node.loc.start.line;
    const kind = def.type === 'FunctionName' ? 'function' : (def.parent && def.parent.kind) || def.type;
    (within(line) ? declaredIn : declaredOut).set(v.name, { kind, line, variable: v });
}

// 3. references — collected from EVERY scope by name, not via variable.references: in a classic script
//    eslint-scope leaves references to top-level `function`/`var` declarations unresolved (they are
//    properties of the global object), so `requireStaff` used inside a section never showed up on the
//    `function requireStaff` variable. Lesson of the first cut (2026-09-07): the server did not boot.
//    A reference counts only when it is NOT resolved to some inner binding: `r.resolved` is null for the
//    global-object names (function/var at top level) and is the module-scope variable for let/const there;
//    a handler's own `const path = …` resolves to that local and is ignored (it shadows, it does not depend).
const refsByName = new Map();
for (const scope of scopeManager.scopes) {
    for (const r of scope.references) {
        if (r.resolved && r.resolved.scope !== moduleScope) continue;
        const n = r.identifier.name;
        if (!refsByName.has(n)) refsByName.set(n, []);
        refsByName.get(n).push(r);
    }
}
const problems = [];
const ctxNames = new Set();
const lateConst = [];
for (const [name, info] of declaredOut) {
    const refsInside = (refsByName.get(name) || []).filter((r) => within(r.identifier.loc.start.line));
    if (!refsInside.length) continue;
    if (refsInside.some((r) => r.isWrite()) && info.kind !== 'function') problems.push(`assigns outside ${info.kind} "${name}" (declared line ${info.line}) inside the section`);
    ctxNames.add(name);
    if (info.kind !== 'function' && info.line > TO) lateConst.push(`${name} (line ${info.line})`);
}
for (const [name, info] of declaredIn) {
    const refsOutside = (refsByName.get(name) || []).filter((r) => !within(r.identifier.loc.start.line));
    if (refsOutside.length) problems.push(`"${name}" (${info.kind}, line ${info.line}) is used outside the section at line(s) ${[...new Set(refsOutside.map((r) => r.identifier.loc.start.line))].slice(0, 6).join(', ')}`);
}
if (lateConst.length) problems.push(`ctx bindings declared BELOW the section (temporal dead zone at the call site): ${lateConst.join(', ')}`);
// `app` and `require`/`module` are provided by the module function / Node itself
ctxNames.delete('app'); ctxNames.delete('require'); ctxNames.delete('module'); ctxNames.delete('exports'); ctxNames.delete('__dirname'); ctxNames.delete('__filename');

const registrations = inRange.filter((s) => /^app\.(get|post|put|patch|delete|all|use)\(/.test(lines[s.loc.start.line - 1].trim())).length;
console.log(`section ${FROM}-${TO}: ${inRange.length} statements, ${registrations} registrations at top level, ${declaredIn.size} local bindings, ${ctxNames.size} ctx names`);
console.log(`ctx: ${[...ctxNames].sort().join(', ')}`);
if (problems.length) { console.error('REFUSED:\n  - ' + problems.join('\n  - ')); process.exit(1); }
if (DRY) { console.log('dry run — nothing written'); process.exit(0); }

// 4. write the module and the call site.
//    Two things in verbatim code change meaning when the file moves into routes/: a relative require
//    (`require('./lib/x')` would look for routes/lib/x) and `__dirname` / `__filename` (they would name routes/).
//    Requires get one more `../`; the dirname/filename become SERVER_DIR / SERVER_FILE passed through ctx.
let sectionText = lines.slice(FROM - 1, TO).join(nl);
const extraCtx = [];
sectionText = sectionText.replace(/require\((['"])\.\//g, 'require($1../');
if (/\b__dirname\b/.test(sectionText)) { sectionText = sectionText.replace(/\b__dirname\b/g, 'SERVER_DIR'); extraCtx.push('SERVER_DIR: __dirname'); ctxNames.add('SERVER_DIR'); }
if (/\b__filename\b/.test(sectionText)) { sectionText = sectionText.replace(/\b__filename\b/g, 'SERVER_FILE'); extraCtx.push('SERVER_FILE: __filename'); ctxNames.add('SERVER_FILE'); }
const ctxList = [...ctxNames].sort();
const header = [
    `// routes/${NAME}.js — ${TITLE}`,
    `// Extracted VERBATIM from server.js lines ${FROM}-${TO} on 2026-09-07 (server split). The code below is byte-for-byte`,
    `// what the monolith had, at the same indentation, so every handler body and the registration order are unchanged`,
    `// (tests/unit/server-route-table.test.js). Everything it needs from server.js arrives in ctx; nothing is global.`,
    `module.exports = function register(app, ctx) {`,
    ctxList.length ? `const { ${ctxList.join(', ')} } = ctx;` : '',
    '',
].filter((l) => l !== null);
const moduleText = header.join(nl) + nl + sectionText + nl + '};' + nl;
const routesDir = path.join(ROOT, 'routes');
fs.mkdirSync(routesDir, { recursive: true });
const modulePath = path.join(routesDir, `${NAME}.js`);
if (fs.existsSync(modulePath)) { console.error(`REFUSED: ${modulePath} exists`); process.exit(1); }
fs.writeFileSync(modulePath, moduleText);
const ctxEntries = ctxList.map((n) => (n === 'SERVER_DIR' ? 'SERVER_DIR: __dirname' : n === 'SERVER_FILE' ? 'SERVER_FILE: __filename' : n));
const call = [
    `// ${TITLE} — extracted to routes/${NAME}.js (server split, 2026-09-07); registered here so the order is unchanged.`,
    `{ const ctx = { ${ctxEntries.join(', ')} }; require('./routes/${NAME}')(app, ctx); }`,
];
const newLines = lines.slice(0, FROM - 1).concat(call, lines.slice(TO));
fs.writeFileSync(serverPath, newLines.join(nl));
console.log(`wrote routes/${NAME}.js (${TO - FROM + 1} lines moved); server.js now ${newLines.length} lines`);
