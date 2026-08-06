/**
 * vendor-proof-image.test.js — vendor-scoped Box proof images.
 *
 * WHY THIS EXISTS
 * The 2026-08-05 Box gating put /api/box/thumbnail/:fileId behind requireStaff.
 * Transfer mockup thumbnails are stored as absolute URLs pointing at exactly that
 * route, so every mockup an OUTSIDE VENDOR sees (Supacolor, L&P Printing) 401ed.
 *
 * boxUrl() — the fix that repaired all the staff surfaces — does nothing here: a
 * gate is per-IDENTITY, not per-origin, and same-origin still lands on
 * requireStaff. So the vendor portal mints an HMAC capability bound to
 * {fileId, vendorName} while projecting rows vendorOwnsRow() has ALREADY cleared,
 * exactly as the customer portal does.
 *
 * These tests pin three things: the token's integrity, the fact that it can never
 * be confused with the CUSTOMER proof token (same signing key, different type
 * tag), and that the projections actually route their Box fields through it.
 */

process.env.SESSION_SECRET = 'test-session-secret-for-proof-tokens';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vml = require('../../lib/vendor-magic-link');
const cml = require('../../lib/customer-magic-link');

const REPO = path.join(__dirname, '..', '..');
const SERVER = fs.readFileSync(path.join(REPO, 'server.js'), 'utf8');

describe('vendor proof token — integrity', () => {
    test('round-trips the file id and vendor it was minted for', () => {
        const t = vml.mintProofToken({ fileId: '2206719186394', vendorName: 'L&P Printing' });
        expect(typeof t).toBe('string');
        expect(vml.verifyProofToken(t)).toEqual({ fileId: '2206719186394', vendorName: 'L&P Printing' });
    });

    test('a tampered file id invalidates the token', () => {
        const t = vml.mintProofToken({ fileId: '999', vendorName: 'Supacolor' });
        const [payload, sig] = t.split('.');
        const tampered = Buffer.from(
            JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), f: '123456789' })
        ).toString('base64url');
        expect(vml.verifyProofToken(tampered + '.' + sig)).toBeNull();
    });

    test('a token signed with the wrong key is rejected', () => {
        const payload = Buffer.from(JSON.stringify({
            f: '123', v: 'Supacolor', x: Math.floor(Date.now() / 1000) + 60, t: 'vproof',
        })).toString('base64url');
        const badSig = crypto.createHmac('sha256', 'not-the-secret').update(payload).digest('base64url');
        expect(vml.verifyProofToken(payload + '.' + badSig)).toBeNull();
    });

    test('an expired token is rejected', () => {
        const payload = Buffer.from(JSON.stringify({
            f: '123', v: 'Supacolor', x: Math.floor(Date.now() / 1000) - 1, t: 'vproof',
        })).toString('base64url');
        const sig = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(payload).digest('base64url');
        expect(vml.verifyProofToken(payload + '.' + sig)).toBeNull();
    });

    test('a non-numeric file id never mints (no path traversal into the Box route)', () => {
        expect(vml.mintProofToken({ fileId: '../../etc/passwd', vendorName: 'Supacolor' })).toBeNull();
        expect(vml.mintProofToken({ fileId: '12 OR 1=1', vendorName: 'Supacolor' })).toBeNull();
    });

    test('garbage and empty input return null rather than throwing', () => {
        for (const v of [null, undefined, '', 'nonsense', 'a.b', {}]) {
            expect(() => vml.verifyProofToken(v)).not.toThrow();
            expect(vml.verifyProofToken(v)).toBeNull();
        }
    });
});

/**
 * 🔴 The load-bearing one. Both token families are signed with SESSION_SECRET.
 * Without a distinct type tag, a vendor image capability would verify as a
 * customer one (and vice versa) — one outside company's bookmarked image URL
 * would become a read into another identity's scope.
 */
describe('vendor and customer proof tokens can never be confused', () => {
    const vt = vml.mintProofToken({ fileId: '12345', vendorName: 'L&P Printing' });
    const ct = cml.mintProofToken({ fileId: '12345', idCustomer: '12007' });

    test('a vendor token does not verify as a customer token', () => {
        expect(cml.verifyProofToken(vt)).toBeNull();
    });

    test('a customer token does not verify as a vendor token', () => {
        expect(vml.verifyProofToken(ct)).toBeNull();
    });

    test('each still verifies as itself (the guard is not simply rejecting everything)', () => {
        expect(vml.verifyProofToken(vt)).not.toBeNull();
        expect(cml.verifyProofToken(ct)).not.toBeNull();
    });

    test('the vendor session cookie is not usable as an image capability', () => {
        const sess = vml.mintSession({ email: 'a@b.com', vendorName: 'Supacolor', contactName: 'A' });
        expect(vml.verifyProofToken(sess)).toBeNull();
    });

    test('an image capability is not usable as a session cookie', () => {
        expect(vml.verifySession(vt)).toBeNull();
    });
});

/**
 * Drift guard. A projection that stops routing its Box field through
 * vendorProofUrl is invisible — it just renders broken for an outside vendor who
 * will report it to Erik, not to us. Same failure mode the customer portal had.
 */
describe('vendor projections route Box fields through the minter', () => {
    test('the job card thumbnail is wrapped', () => {
        expect(SERVER).toContain('mockupThumbnailUrl: vendorProofUrl(r.mockup_thumbnail_url, vendorName)');
    });

    test('the file-row thumbnail is wrapped', () => {
        expect(SERVER).toContain('thumbnailUrl: vendorProofUrl(f.Thumbnail_URL, vendorName)');
    });

    test('the image route exists, is limited, and is token-gated', () => {
        expect(SERVER).toContain("app.get('/api/vendor/proof-image/:token', vendorImageLimiter, requireVendorProofToken");
    });

    test('the image route forwards ONLY size — never the staff allowlist', () => {
        const at = SERVER.indexOf("'/api/vendor/proof-image/:token'");
        const block = SERVER.slice(at, at + 400);
        expect(block).toContain("query: new Set(['size'])");
        expect(block).toContain("cacheControl: 'private, max-age=300'");
    });

    test('images do NOT share vendorApiLimiter (that is what 429d the customer portal)', () => {
        const at = SERVER.indexOf("'/api/vendor/proof-image/:token'");
        expect(SERVER.slice(at, at + 200)).not.toContain('vendorApiLimiter');
    });

    /**
     * `.map(projectVendorJob)` passes map's INDEX as the second argument, so every
     * token would be minted for vendor "0"/"1"/… and 404 on redemption. The bug is
     * silent at author time and total at runtime, so pin the explicit arrows.
     */
    test('projections are called with an explicit vendor, never a bare map reference', () => {
        expect(SERVER).not.toMatch(/\.map\(projectVendorJob\)/);
        expect(SERVER).not.toMatch(/\.map\(projectVendorFile\)/);
        expect(SERVER).toContain('projectVendorJob(r, pv.vendorName)');
        expect(SERVER).toContain('projectVendorFile(f, pv.vendorName)');
    });
});

/**
 * The customer-portal half of the same 2026-08-06 sweep: the mockup LIST filter
 * admits a row on `Box_Mockup_1 || _2 || _3`, and the client picks the first of
 * those three — but the projection only emitted slot 1, so a proof living in slot
 * 2 or 3 reached the browser as a card with no image at all.
 */
describe('customer mockup list projects every slot its filter admits', () => {
    test('slots 1-3 are all projected through portalProofUrl', () => {
        const at = SERVER.indexOf('function projectPortalMockup');
        const block = SERVER.slice(at, at + 1400);
        for (const slot of ['Box_Mockup_1', 'Box_Mockup_2', 'Box_Mockup_3']) {
            expect(block).toContain(`${slot}: portalProofUrl(m.${slot}, cid)`);
        }
    });

    test('the filter and the projection agree on which slots matter', () => {
        // If someone widens the filter to _4, this fails until the projection follows.
        const filter = /\.filter\(\(m\) => \(([^)]*Box_Mockup[^)]*)\)/.exec(SERVER);
        expect(filter).not.toBeNull();
        const slotsInFilter = [...filter[1].matchAll(/Box_Mockup_(\d)/g)].map((m) => m[1]);
        const at = SERVER.indexOf('function projectPortalMockup');
        const block = SERVER.slice(at, at + 1400);
        for (const n of slotsInFilter) {
            expect(block).toContain(`Box_Mockup_${n}: portalProofUrl(m.Box_Mockup_${n}, cid)`);
        }
    });
});
