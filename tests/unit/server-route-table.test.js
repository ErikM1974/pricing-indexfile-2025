/**
 * server-route-table.test.js — the server's registration order is behaviour (server split, 2026-09-07).
 *
 * Express walks its stack in registration order: a middleware registered after a route never runs for it, and two
 * overlapping paths resolve to whichever came first. While server.js is being split into routes/<domain>.js
 * modules, this lock proves every extraction reproduced the order exactly: scripts/server/route-table.js reads
 * server.js statically, follows each `require('./routes/x')(app, ctx);` at the point it is called, and lists every
 * registration (method, path, middleware). The fixture is the table as it was before the split.
 *
 * A DELIBERATE route change updates the fixture: `node scripts/server/route-table.js --update` — and the diff of
 * that fixture in the commit is the review artefact.
 */
const fs = require('fs');
const { table, comparable, FIXTURE } = require('../../scripts/server/route-table');

describe('server route table', () => {
    const rows = table();
    const live = comparable(rows);
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));

    test('is large and well-formed (sanity)', () => {
        expect(rows.length).toBeGreaterThan(400);
        expect(rows.filter((r) => r.method === 'get').length).toBeGreaterThan(250);
        expect(rows.every((r) => typeof r.path === 'string' && r.path.length > 0)).toBe(true);
    });

    test('matches the committed fixture registration for registration', () => {
        const diffs = [];
        for (let i = 0; i < Math.max(fixture.length, live.length); i++) {
            if (fixture[i] !== live[i]) diffs.push(`#${i + 1}: fixture ${fixture[i] || '(none)'} | live ${live[i] || '(none)'}`);
        }
        expect({ registrations: live.length, diffs: diffs.slice(0, 10) }).toEqual({ registrations: fixture.length, diffs: [] });
    });

    test('every routes/ module is included exactly once, at a call site in server.js', () => {
        const server = fs.readFileSync(require('path').join(__dirname, '..', '..', 'server.js'), 'utf8');
        const dir = require('path').join(__dirname, '..', '..', 'routes');
        const modules = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')) : [];
        for (const m of modules) {
            const name = m.replace(/\.js$/, '');
            const calls = (server.match(new RegExp(`require\\('\\./routes/${name}'\\)\\(app, ctx\\);`, 'g')) || []).length;
            expect({ module: m, calls }).toEqual({ module: m, calls: 1 });
        }
    });

    test('moved code never resolves a path relative to routes/ (no __dirname, __filename or require("./…"))', () => {
        // Verbatim code that said path.join(__dirname, 'staff-dashboard-v3') or require('./lib/blog') would silently
        // name routes/… once moved. The extractor rewrites them to SERVER_DIR / SERVER_FILE (passed through ctx)
        // and require('../…'); this proves no module slipped through (2026-09-07: the first blog cut did).
        const dir = require('path').join(__dirname, '..', '..', 'routes');
        const modules = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.js')) : [];
        for (const m of modules) {
            const src = fs.readFileSync(require('path').join(dir, m), 'utf8');
            const bad = (src.match(/\b__dirname\b|\b__filename\b|require\(['"]\.\//g) || []);
            expect({ module: m, bad }).toEqual({ module: m, bad: [] });
            const server = fs.readFileSync(require('path').join(__dirname, '..', '..', 'server.js'), 'utf8');
            const name = m.replace(/\.js$/, '');
            const call = server.match(new RegExp(`\\{ const ctx = \\{ ([^}]*) \\}; require\\('\\./routes/${name}'\\)`));
            for (const token of ['SERVER_DIR', 'SERVER_FILE']) {
                if (new RegExp(`\\b${token}\\b`).test(src)) expect({ module: m, passes: token, ok: !!call && call[1].includes(`${token}: __${token === 'SERVER_DIR' ? 'dirname' : 'filename'}`) }).toEqual({ module: m, passes: token, ok: true });
            }
        }
    });
});
