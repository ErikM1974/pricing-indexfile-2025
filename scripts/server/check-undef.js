#!/usr/bin/env node
/**
 * check-undef.js — list every undefined name in routes/ (server split). Exit 1 if any.
 * A name a cut missed shows up here before the server boots (middleware) or before a request hits a handler.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const eslint = path.join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');
const res = spawnSync(process.execPath, [eslint, '--no-config-lookup', '--config', path.join(__dirname, 'eslint.noundef.mjs'), 'routes/**/*.js', '--format', 'json'], { cwd: ROOT, encoding: 'utf8' });
if (res.status !== 0 && !res.stdout.trim().startsWith('[')) { console.error(res.stderr || res.stdout); process.exit(2); }
const report = JSON.parse(res.stdout || '[]');
let n = 0;
for (const f of report) for (const m of f.messages) { if (m.ruleId !== 'no-undef') continue; n++; console.log(`${path.relative(ROOT, f.filePath)}:${m.line} ${m.message}`); }
console.log(`${n} undefined name(s) in ${report.length} module(s)`);
process.exit(n ? 1 : 0);
