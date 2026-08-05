/**
 * Locks the content-hashing page list.
 *
 * The feature only works when three things agree: the page is in
 * lib/hashed-pages.js, the file exists, and whatever serves it calls
 * sendHashedHtml(). Any one of those drifting fails SILENTLY — the page just
 * quietly serves uncached source paths, which is indistinguishable from
 * "caching isn't enabled yet". Hence a test rather than a comment.
 */
const fs = require('fs');
const path = require('path');

const {
    BUILDER_PAGES,
    STOREFRONT_PAGES,
    STAFF_PAGES,
    CALCULATOR_PAGES,
    HASHED_PAGES,
    HASHED_PAGES_UNDER_PAGES_MOUNT,
} = require('../../../lib/hashed-pages');

const ROOT = path.join(__dirname, '..', '..', '..');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const buildSrc = fs.readFileSync(path.join(ROOT, 'scripts', 'build.js'), 'utf8');

describe('hashed page list', () => {
    test('every listed page exists on disk', () => {
        const missing = HASHED_PAGES.filter((p) => !fs.existsSync(path.join(ROOT, p)));
        expect(missing).toEqual([]);
    });

    test('no duplicates', () => {
        expect(new Set(HASHED_PAGES).size).toBe(HASHED_PAGES.length);
    });

    test('paths are repo-relative with forward slashes, no leading slash', () => {
        for (const p of HASHED_PAGES) {
            expect(p).not.toMatch(/^\//);
            expect(p).not.toMatch(/\\/);
            expect(p).toMatch(/\.html$/);
        }
    });

    test('the four tranches together make the full list', () => {
        expect(HASHED_PAGES).toEqual([
            ...BUILDER_PAGES, ...STOREFRONT_PAGES, ...STAFF_PAGES, ...CALCULATOR_PAGES,
        ]);
    });

    test('calculators are all under calculators/, at most one level deep, never archive', () => {
        expect(CALCULATOR_PAGES.length).toBeGreaterThan(0);
        for (const p of CALCULATOR_PAGES) {
            expect(p).toMatch(/^calculators\/[^/]+(\/[^/]+)?$/);
            expect(p).not.toMatch(/^calculators\/archive\//);
        }
    });

    test('staff pages come only from the two uniformly gated mounts', () => {
        // /calculators and /staff-dashboard-v3 gate per-page rather than at the
        // mount, so they are NOT safe to sweep in the same way.
        const stray = STAFF_PAGES.filter((p) => !/^(dashboards|tools)\//.test(p));
        expect(stray).toEqual([]);
        expect(STAFF_PAGES.length).toBeGreaterThan(0);
    });
});

describe('build side', () => {
    test('build.js takes its page list from lib/hashed-pages (never its own copy)', () => {
        expect(buildSrc).toMatch(/require\(['"]\.\.\/lib\/hashed-pages['"]\)/);
        // a re-introduced literal array of builder pages would mean drift is back
        expect(buildSrc).not.toMatch(/const BUILDER_HTML = \[/);
    });
});

describe('serve side', () => {
    test('server.js imports the shared list', () => {
        expect(serverSrc).toMatch(/require\(['"]\.\/lib\/hashed-pages['"]\)/);
    });

    test('every storefront page is actually served through sendHashedHtml', () => {
        // Pages under /pages reached via the static mount are covered by the
        // /pages/:page route; the rest must each call the helper by filename.
        const viaMount = new Set(HASHED_PAGES_UNDER_PAGES_MOUNT.map((p) => p.replace('/pages/', '')));
        // Pages whose handler passes a path VARIABLE rather than a literal.
        // Each needs its own assertion below — a filename search can't see them.
        const viaPathVariable = new Map([['product.html', 'productHtmlPath']]);
        const notWired = [];
        for (const page of STOREFRONT_PAGES) {
            const base = page.split('/').pop();
            if (viaMount.has(base)) continue;
            const token = viaPathVariable.get(base) || base;
            const re = new RegExp('sendHashedHtml\\(res,[^;]*' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            if (!re.test(serverSrc)) notWired.push(page);
        }
        expect(notWired).toEqual([]);
    });

    test('the /pages rewrite route is registered BEFORE the /pages static mount', () => {
        const route = serverSrc.indexOf("app.get('/pages/:page'");
        const mount = serverSrc.indexOf("app.use('/pages', express.static");
        expect(route).toBeGreaterThan(-1);
        expect(mount).toBeGreaterThan(-1);
        // express.static would answer first and the rewrite would never run
        expect(route).toBeLessThan(mount);
    });

    test('product.html keeps its SEO injection — the rewrite composes, not replaces', () => {
        expect(serverSrc).toMatch(/sendHashedHtml\(res, productHtmlPath, productSeo\.injectHead\(/);
    });

    // ─────────────────────────────────────────────────────────────────────
    // SECURITY. For the staff mounts the ORDER of registration is the access
    // control: gateStaffHtml must run before the rewrite, or an anonymous
    // request gets payroll/payables HTML instead of a bounce to SSO. These
    // assertions exist so a future reorder fails the build, not production.
    // ─────────────────────────────────────────────────────────────────────
    describe.each(['dashboards', 'tools'])('%s mount ordering', (mount) => {
        const gate = serverSrc.indexOf(`app.use('/${mount}', gateStaffHtml)`);
        const rewrite = serverSrc.indexOf(`app.get('/${mount}/:page', serveHashedStaffPage`);
        const staticMount = serverSrc.indexOf(`app.use('/${mount}', express.static`);

        test('all three are registered', () => {
            expect(gate).toBeGreaterThan(-1);
            expect(rewrite).toBeGreaterThan(-1);
            expect(staticMount).toBeGreaterThan(-1);
        });

        test('the staff gate runs BEFORE the rewrite (anonymous must never reach the HTML)', () => {
            expect(gate).toBeLessThan(rewrite);
        });

        test('the rewrite runs BEFORE express.static (or it would never run at all)', () => {
            expect(rewrite).toBeLessThan(staticMount);
        });
    });

    test('the staff rewrite performs no auth of its own — it relies on the gate above it', () => {
        const fn = serverSrc.slice(serverSrc.indexOf('function serveHashedStaffPage'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        // If this ever needs its own auth, the ordering guarantee has been broken.
        expect(body).not.toMatch(/crmUser|requireStaff|requirePageAccess|redirect/);
    });

    describe('calculators mount ordering', () => {
        // /calculators has no mount gate; the one staff-only page has its own
        // requireStaff route. The rewrite must sit below that gate and above
        // express.static — "above static" is what makes it below EVERY gate,
        // since a gate under static would already be bypassed.
        const decalGate = serverSrc.indexOf("'/pricing/decals'], requireStaff");
        const rewrite = serverSrc.indexOf("app.get('/calculators/:a/:b', serveHashedCalculator)");
        const staticMount = serverSrc.indexOf("app.use('/calculators', express.static");

        test('all three are registered', () => {
            expect(decalGate).toBeGreaterThan(-1);
            expect(rewrite).toBeGreaterThan(-1);
            expect(staticMount).toBeGreaterThan(-1);
        });

        test('the staff-gated decal route precedes the rewrite', () => {
            expect(decalGate).toBeLessThan(rewrite);
        });

        test('the rewrite precedes express.static', () => {
            expect(rewrite).toBeLessThan(staticMount);
        });

        test('nested calculators are reachable (two-param route registered)', () => {
            expect(serverSrc).toMatch(/app\.get\('\/calculators\/:a\/:b', serveHashedCalculator\)/);
        });
    });

    test('sendHashedHtml falls back to the static file when the manifest is absent', () => {
        const fn = serverSrc.slice(serverSrc.indexOf('function sendHashedHtml'));
        const body = fn.slice(0, fn.indexOf('\n}'));
        expect(body).toMatch(/if \(!manifest\)/);
        expect(body).toMatch(/res\.sendFile\(absPath\)/);
    });
});
