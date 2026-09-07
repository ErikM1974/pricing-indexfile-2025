#!/usr/bin/env node
/**
 * route-table.js — the server's registration order as data (server split, 2026-09-07).
 *
 * Express matches routes and middleware in REGISTRATION ORDER, so that order is behaviour. This script walks
 * server.js statically, in order, follows every `require('./routes/<name>')(app, ctx);` line into that module at
 * the point where it is called, and lists every `app.get/post/put/patch/delete/all/use(` registration it meets:
 * method, path (or "*" for a path-less use), and the middleware identifiers that precede the handler.
 *
 *   node scripts/server/route-table.js            print the table (one line per registration)
 *   node scripts/server/route-table.js --update   rewrite tests/fixtures/server-route-table.json (deliberate route change)
 *   node scripts/server/route-table.js --check    exit 1 if the live table differs from the fixture (what the jest lock does)
 *
 * Registrations inside loops (e.g. `ROUTES.forEach(r => app.post(...))`) are listed once, as written — the same
 * static reading on both sides is what makes the comparison honest. Line numbers are reported but never compared.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE = path.join(ROOT, 'tests', 'fixtures', 'server-route-table.json');
const REG = /^(\s*)app\.(get|post|put|patch|delete|all|use)\(/;
// the call site extract-section.js writes is one line: `{ const ctx = { … }; require('./routes/<name>')(app, ctx); }`
const INCLUDE = /require\('\.\/routes\/([a-z0-9-]+)'\)\(app, ctx\);/;

function firstArgs(text) {
    // text starts right after "app.<method>(". Return { path, middleware } from the argument list up to the handler.
    let depth = 0, i = 0, inStr = null, args = [], cur = '';
    for (; i < text.length; i++) {
        const c = text[i];
        if (inStr) { cur += c; if (c === '\\') { cur += text[++i]; continue; } if (c === inStr) inStr = null; continue; }
        if (c === '\'' || c === '"' || c === '`') { inStr = c; cur += c; continue; }
        if (c === '(' || c === '[' || c === '{') { depth++; cur += c; continue; }
        if (c === ')' || c === ']' || c === '}') { if (depth === 0) { args.push(cur.trim()); break; } depth--; cur += c; continue; }
        if (c === ',' && depth === 0) { args.push(cur.trim()); cur = ''; continue; }
        cur += c;
    }
    const isHandler = (a) => /^(async\s*)?(\(|function\b|[a-zA-Z_$][\w$]*\s*=>)/.test(a) && /=>|function/.test(a);
    let p = '*';
    if (args.length && /^['"`]/.test(args[0])) { p = args[0].slice(1, -1); args = args.slice(1); }
    // normalise the moved-module spellings of __dirname/__filename BEFORE truncating, so the 60-char key is stable
    const middleware = args.filter((a) => a && !isHandler(a))
        .map((a) => a.replace(/\s+/g, ' ').replace(/\bSERVER_DIR\b/g, '__dirname').replace(/\bSERVER_FILE\b/g, '__filename').slice(0, 60));
    return { path: p, middleware };
}

function walk(file, out, seen) {
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    if (seen.has(rel)) throw new Error(`route-table: ${rel} included twice`);
    seen.add(rel);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        const inc = INCLUDE.exec(lines[i]);
        if (inc) {
            // a call site belongs in server.js only: inside a module it resolves relative to routes/ and fails at boot
            // (a cut whose range started on a neighbouring call-site line swallowed one on 2026-09-07)
            if (rel !== 'server.js') throw new Error(`route-table: ${rel}:${i + 1} includes routes/${inc[1]} — a call site swallowed by a cut`);
            walk(path.join(ROOT, 'routes', inc[1] + '.js'), out, seen); continue;
        }
        const m = REG.exec(lines[i]);
        if (!m) continue;
        // gather the statement text until the argument list closes (bounded scan, 400 lines is plenty for the head)
        let text = lines[i].slice(lines[i].indexOf('(') + 1);
        for (let j = i + 1; j < Math.min(lines.length, i + 400) && !/\)\s*;?\s*$/.test(text) && text.length < 4000; j++) text += '\n' + lines[j];
        const { path: p, middleware } = firstArgs(text);
        out.push({ file: rel, line: i + 1, method: m[2], path: p, middleware, nested: m[1].length > 0 });
    }
    return out;
}

function table() { return walk(path.join(ROOT, 'server.js'), [], new Set()); }
// SERVER_DIR / SERVER_FILE are what a moved module calls __dirname / __filename (passed through ctx): same value,
// so the table reads them as the original names and the fixture stays the pre-split baseline.
function comparable(rows) {
    return rows.map((r) => `${r.method} ${r.path} [${r.middleware.join(', ')}]${r.nested ? ' (nested)' : ''}`
        .replace(/\bSERVER_DIR\b/g, '__dirname').replace(/\bSERVER_FILE\b/g, '__filename'));
}

if (require.main === module) {
    const rows = table();
    const key = comparable(rows);
    if (process.argv.includes('--update')) {
        fs.mkdirSync(path.dirname(FIXTURE), { recursive: true });
        fs.writeFileSync(FIXTURE, JSON.stringify(key, null, 2) + '\n');
        console.log(`wrote ${key.length} registrations to ${path.relative(ROOT, FIXTURE)}`);
    } else if (process.argv.includes('--check')) {
        const want = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
        const diffs = [];
        for (let i = 0; i < Math.max(want.length, key.length); i++) if (want[i] !== key[i]) diffs.push(`#${i + 1}: expected ${want[i] || '(none)'} | got ${key[i] || '(none)'}`);
        if (diffs.length) { console.error(`route table differs (${diffs.length}):\n` + diffs.slice(0, 20).join('\n')); process.exit(1); }
        console.log(`route table unchanged: ${key.length} registrations`);
    } else {
        rows.forEach((r, i) => console.log(`${String(i + 1).padStart(3)} ${r.method.padEnd(6)} ${r.path.padEnd(60)} [${r.middleware.join(', ')}]  ${r.file}:${r.line}`));
        console.log(`${rows.length} registrations`);
    }
}

module.exports = { table, comparable, FIXTURE };
