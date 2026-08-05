/**
 * portal-proof-image.test.js — customer-scoped Box proof images.
 *
 * WHY THIS EXISTS
 * The Aug 5 2026 Box gating (`b9e9d2a3`) put /api/box/thumbnail/:fileId behind
 * requireStaff. Customer portal artwork is stored as absolute URLs pointing at
 * exactly that route, so every proof a CUSTOMER sees started 401ing — measured
 * at 92% of art proofs, 8 of 9 mockup proofs, and 100% of the logo library.
 *
 * The fix could not be "let customers call the Box route": that would hand every
 * customer read access to any Box file in the enterprise by numeric id. Instead
 * the server mints an HMAC capability token bound to {fileId, customer} while
 * projecting rows it has ALREADY authorized, and the image route accepts nothing
 * else. These tests pin both halves — the token's integrity, and the fact that
 * every projection actually routes its Box fields through the minter.
 */

process.env.SESSION_SECRET = 'test-session-secret-for-proof-tokens';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ml = require('../../lib/customer-magic-link');

const REPO = path.join(__dirname, '..', '..');

describe('proof token — integrity', () => {
    test('round-trips the file id and customer it was minted for', () => {
        const t = ml.mintProofToken({ fileId: '2390618521549', idCustomer: '13268' });
        expect(typeof t).toBe('string');
        expect(ml.verifyProofToken(t)).toEqual({ fileId: '2390618521549', idCustomer: '13268' });
    });

    test('the Box file id is NOT readable as plaintext the client can edit', () => {
        // It is base64url, so it is not secret — but it IS signed, which is the
        // property that matters: editing it invalidates the token.
        const t = ml.mintProofToken({ fileId: '999', idCustomer: '1' });
        const [payload, sig] = t.split('.');
        const tampered = Buffer.from(
            JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), f: '123456789' })
        ).toString('base64url');
        expect(ml.verifyProofToken(tampered + '.' + sig)).toBeNull();
    });

    test('a token signed with the wrong key is rejected', () => {
        const payload = Buffer.from(JSON.stringify({
            f: '123', c: '1', x: Math.floor(Date.now() / 1000) + 60, t: 'proof',
        })).toString('base64url');
        const badSig = crypto.createHmac('sha256', 'not-the-secret').update(payload).digest('base64url');
        expect(ml.verifyProofToken(payload + '.' + badSig)).toBeNull();
    });

    test('an expired token is rejected', () => {
        const payload = Buffer.from(JSON.stringify({
            f: '123', c: '1', x: Math.floor(Date.now() / 1000) - 1, t: 'proof',
        })).toString('base64url');
        const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url');
        expect(ml.verifyProofToken(payload + '.' + sig)).toBeNull();
    });

    test('CROSS-TYPE CONFUSION: a session cookie is not a proof token', () => {
        // Both are signed with SESSION_SECRET, so only the `t` discriminator
        // stops a stolen session cookie being replayed as an image capability
        // (and vice versa).
        const sess = ml.mintSession({ email: 'a@b.com', idCustomer: '13268', companyName: 'X' });
        expect(ml.verifyProofToken(sess)).toBeNull();
        const proof = ml.mintProofToken({ fileId: '123', idCustomer: '13268' });
        expect(ml.verifySession(proof)).toBeNull();
    });

    test('a non-numeric file id is refused at mint time', () => {
        expect(ml.mintProofToken({ fileId: '../../etc/passwd', idCustomer: '1' })).toBeNull();
        expect(ml.mintProofToken({ fileId: '12 OR 1=1', idCustomer: '1' })).toBeNull();
    });

    test('garbage never throws — a bad token is a 404, not a 500', () => {
        for (const v of [null, undefined, '', 'x', 'a.b', 'a.b.c', {}, 42]) {
            expect(() => ml.verifyProofToken(v)).not.toThrow();
            expect(ml.verifyProofToken(v)).toBeNull();
        }
    });

    test('tokens are customer-bound — B cannot be derived from A', () => {
        const a = ml.mintProofToken({ fileId: '555', idCustomer: '111' });
        const b = ml.mintProofToken({ fileId: '555', idCustomer: '222' });
        expect(a).not.toBe(b);
        expect(ml.verifyProofToken(a).idCustomer).toBe('111');
        expect(ml.verifyProofToken(b).idCustomer).toBe('222');
    });
});

/**
 * DRIFT GUARD — a Box field added to a projection but not wrapped is invisible:
 * it just renders as a broken image for customers, which is exactly how this
 * shipped in the first place.
 */
describe('every customer-facing Box field is minted, never passed through raw', () => {
    const src = fs.readFileSync(path.join(REPO, 'server.js'), 'utf8');

    const sliceFn = (name) => {
        const start = src.indexOf(`function ${name}(`);
        expect(start).toBeGreaterThan(-1);
        const end = src.indexOf('\n}', start);
        return src.slice(start, end);
    };

    const CASES = [
        ['projectPortalMockup', ['Box_Mockup_1']],
        ['projectPortalArt', ['Final_Approved_Mockup', 'Box_File_Mockup', 'BoxFileLink']],
        ['projectPortalArtDetail', ['Final_Approved_Mockup', 'Box_File_Mockup', 'BoxFileLink',
            'Company_Mockup', 'Mockup_4', 'Mockup_5', 'Mockup_6']],
        ['projectPortalMockupDetail', ['Box_Mockup_1', 'Box_Mockup_2', 'Box_Mockup_3',
            'Box_Mockup_4', 'Box_Mockup_5', 'Box_Mockup_6']],
    ];

    test.each(CASES)('%s wraps every Box field', (fn, fields) => {
        const body = sliceFn(fn);
        const arg = fn.includes('Mockup') && !fn.includes('Art') ? 'm' : 'a';
        for (const f of fields) {
            expect(body).toContain(`portalProofUrl(${arg}.${f},`);
        }
        // and nothing slipped back to the raw `x.Field || null` shape
        for (const f of fields) {
            expect(body).not.toContain(`${f}: ${arg}.${f} || null`);
        }
    });

    test('the logo library and finished photos are minted too', () => {
        expect(src).toContain('thumbnailUrl: portalProofUrl(d.thumbnailUrl, customerId)');
        expect(src).toContain('imageUrl: portalProofUrl(p.imageUrl, customerId)');
    });

    test('portalProofUrl only rewrites Box thumbnails, leaving public urls alone', () => {
        const body = src.slice(src.indexOf('function portalProofUrl('), src.indexOf('\n}', src.indexOf('function portalProofUrl(')));
        expect(body).toContain('BOX_THUMB_RE');
        expect(body).toContain('return storedUrl;');       // non-Box passthrough
        expect(body).toContain('mintProofToken');
    });
});

describe('the image route cannot be turned into an arbitrary Box reader', () => {
    const src = fs.readFileSync(path.join(REPO, 'server.js'), 'utf8');

    test('mounted with the token guard, and the id comes from the token only', () => {
        expect(src).toContain("app.get('/api/portal/proof-image/:token', portalImageLimiter, requireProofToken,");
        const guard = src.slice(src.indexOf('function requireProofToken('), src.indexOf('\n}', src.indexOf('function requireProofToken(')));
        // The fileId is assigned FROM the verified claim — never from req.query/params.
        expect(guard).toContain('req.params.fileId = claim.fileId');
        expect(guard).not.toMatch(/req\.(query|body)\.fileId/);
    });

    test('failures answer 404 so the route is not an existence oracle', () => {
        const guard = src.slice(src.indexOf('function requireProofToken('), src.indexOf('\n}', src.indexOf('function requireProofToken(')));
        // Assert on the CODE, not the prose — the comment above it says "never 401".
        expect(guard).not.toMatch(/status\(401\)/);
        expect((guard.match(/status\(404\)/g) || []).length).toBeGreaterThanOrEqual(2);
    });

    test('a signed-in customer cannot replay another customer\'s token', () => {
        const guard = src.slice(src.indexOf('function requireProofToken('), src.indexOf('\n}', src.indexOf('function requireProofToken(')));
        expect(guard).toContain('claim.idCustomer');
        expect(guard).toContain('portalCustomer');
    });

    test('images get their own rate budget — one page view is 50+ of them', () => {
        // Regression: mounted on portalLimiter (60/15min) the customer 429s out
        // of their own portal partway down the page. Caught only by loading a
        // real customer's portal end to end (Binford Metals: 53 images).
        const lim = src.slice(src.indexOf('const portalImageLimiter'), src.indexOf('});', src.indexOf('const portalImageLimiter')));
        expect(Number((lim.match(/max:\s*(\d+)/) || [])[1])).toBeGreaterThanOrEqual(300);
        expect(src).not.toContain("proof-image/:token', portalLimiter");
    });

    test('forwards a NARROWER param allowlist than the staff forwarder', () => {
        // The staff list carries `full` and `url` too. The proxy's thumbnail route
        // ignores both today, so this is not a live hole — but inheriting the wide
        // list means the day the proxy starts honouring them, customers silently
        // gain the same reach. `size` is all the portal lightbox needs.
        const mount = src.slice(src.indexOf("app.get('/api/portal/proof-image/:token'"));
        const decl = mount.slice(0, mount.indexOf('\n\n'));
        expect(decl).toContain("query: new Set(['size'])");
        for (const wide of ["'full'", "'url'", "'folderId'", "'query'"]) {
            expect(decl).not.toContain(wide);
        }
    });

    test('cache-control is FORCED private, not echoed from upstream', () => {
        // These responses are per-customer capabilities; if the proxy ever returns
        // a public cache header, echoing it would let a shared cache hand one
        // customer's artwork to the next caller.
        const mount = src.slice(src.indexOf("app.get('/api/portal/proof-image/:token'"));
        expect(mount.slice(0, mount.indexOf('\n\n'))).toContain("cacheControl: 'private, max-age=300'");
        const fwd = src.slice(src.indexOf('function boxForward('), src.indexOf('\n}', src.indexOf('function boxForward(')));
        expect(fwd).toContain('if (forcedCacheControl) res.setHeader');
    });

    test('the staff Box routes stay requireStaff — this must not have loosened them', () => {
        for (const r of ['thumbnail/:fileId', 'download/:fileId']) {
            expect(src).toContain(`app.get('/api/box/${r}', requireStaff,`);
        }
    });
});
