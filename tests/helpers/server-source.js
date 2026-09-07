/**
 * server-source.js — the server as ONE text, for the locks that read it (server split, 2026-09-07).
 *
 * server.js is being split into routes/<domain>.js modules, each registered from its original position with
 * `{ const ctx = { … }; require('./routes/<name>')(app, ctx); }`. Locks that grep the server's source for a route,
 * a limiter or a posture should keep asserting the same thing wherever the code now lives, so this helper returns
 * server.js with every module inlined at its call site — the monolith as Express sees it, in registration order.
 *
 *   const { serverSource } = require('../helpers/server-source');
 *   const server = serverSource();
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CALL = /^[^\r\n]*require\('\.\/routes\/([a-z0-9-]+)'\)\(app, ctx\);[^\r\n]*$/gm;

function serverSource() {
    const raw = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
    return raw.replace(CALL, (line, name) => fs.readFileSync(path.join(ROOT, 'routes', `${name}.js`), 'utf8'));
}

module.exports = { serverSource, ROOT };
