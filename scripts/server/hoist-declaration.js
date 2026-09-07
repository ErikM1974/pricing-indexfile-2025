#!/usr/bin/env node
/**
 * hoist-declaration.js — move one top-level declaration of server.js to just above a banner line (server split).
 *
 *   node scripts/server/hoist-declaration.js --name sendHashedHtml --above "// BLOG — server-rendered"
 *
 * Why: extract-section.js refuses to cut a section that declares something the rest of the file uses. A shared
 * helper that happens to live inside a section is moved ABOVE the section first (byte for byte, with the comment
 * block immediately preceding it), so the cut can pass it in through ctx. A function declaration is hoisted by
 * the language, so its position never changed behaviour; a `const`/`let` may only be moved UP past code that does
 * not reference it (the tool checks there is no reference between the new and the old position).
 */
const fs = require('fs');
const path = require('path');
const espree = require('espree');

const ROOT = path.resolve(__dirname, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]] : []).filter(Boolean));
const NAME = args.name, ABOVE = args.above;
if (!NAME || !ABOVE) { console.error('usage: --name <identifier> --above "<banner line prefix>"'); process.exit(2); }

const file = path.join(ROOT, 'server.js');
const raw = fs.readFileSync(file, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const ast = espree.parse(raw, { ecmaVersion: 2024, sourceType: 'script', loc: true, range: true });
// a `const { a, b } = require(…)` destructuring declares every property name it binds
const binds = (d) => d.id.type === 'Identifier' ? [d.id.name]
    : d.id.type === 'ObjectPattern' ? d.id.properties.map((p) => p.value && p.value.type === 'Identifier' ? p.value.name : null).filter(Boolean) : [];
const decl = ast.body.find((s) => (s.type === 'FunctionDeclaration' && s.id.name === NAME)
    || (s.type === 'VariableDeclaration' && s.declarations.some((d) => binds(d).includes(NAME))));
if (!decl) { console.error(`no top-level declaration of ${NAME}`); process.exit(1); }
let start = decl.loc.start.line;  // carry the comment block directly above it
while (start > 1 && /^\s*(\/\/|\*|\/\*)/.test(lines[start - 2]) && !/^\/\/ ?={5,}/.test(lines[start - 2])) start--;
const end = decl.loc.end.line;
// Git Bash rewrites a leading "//" argument as "/": match the banner text after its comment marker instead.
const want = ABOVE.replace(/^\/+\s*/, '');
const bannerIdx = lines.findIndex((l) => /^\/\/\s*/.test(l) && l.replace(/^\/\/\s*/, '').startsWith(want));
if (bannerIdx < 0) { console.error(`banner not found: ${ABOVE}`); process.exit(1); }
// the banner is usually preceded by a "// ====" rule line: insert above that rule
let insertAt = bannerIdx; if (insertAt > 0 && /^\/\/ ?={5,}/.test(lines[insertAt - 1])) insertAt--;
if (insertAt >= start - 1) { console.error(`REFUSED: ${NAME} (lines ${start}-${end}) is already above the banner (line ${bannerIdx + 1})`); process.exit(1); }
if (decl.type === 'VariableDeclaration') {
    // A const may only move up past code that does not EVALUATE it at load time: a reference inside a function
    // body between the two positions runs later and is fine; a top-level statement that reads it is not.
    const loadTime = ast.body.filter((s) => s.type !== 'FunctionDeclaration' && s.loc.start.line > insertAt && s.loc.end.line < start)
        .map((s) => lines.slice(s.loc.start.line - 1, s.loc.end.line).join('\n')).join('\n');
    if (new RegExp(`\\b${NAME}\\b`).test(loadTime)) { console.error(`REFUSED: ${NAME} is evaluated at load time between the new position and its declaration`); process.exit(1); }
}
const block = lines.slice(start - 1, end);
const note = `// ${NAME} — hoisted here from lines ${start}-${end} on 2026-09-07 (server split): the section below is moved into routes/ and this helper is shared.`;
const newLines = lines.slice(0, insertAt).concat([note], block, [''], lines.slice(insertAt, start - 1), lines.slice(end));
fs.writeFileSync(file, newLines.join(nl));
console.log(`hoisted ${NAME} (${end - start + 1} lines) to above line ${insertAt + 1}; server.js ${newLines.length} lines`);
