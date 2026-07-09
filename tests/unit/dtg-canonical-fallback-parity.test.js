/**
 * dtg-canonical-fallback-parity.test.js — Batch 6 upgrade: import-based lock.
 *
 * Pre-Batch-6 this regex-matched the fallback CONSTANT in two hand-kept copies.
 * Now the client DELEGATES to the vendored canonical module, and the vendored
 * file is BYTE-locked to the proxy's (dtg-canonical-vendored-parity.test.js),
 * so this suite locks the import surface + fallback semantics directly.
 */
const fs = require('fs');
const path = require('path');

const VENDORED = path.join(__dirname, '../../shared_components/js/dtg-canonical-pricing.js');
const PROXY = path.join(__dirname, '../../../caspio-pricing-proxy/lib/dtg-canonical-pricing.js');
const CLIENT_SRC = fs.readFileSync(path.join(__dirname, '../../shared_components/js/dtg-pricing-service.js'), 'utf8');

describe('DTG fallback + delegation lock (Batch 6)', () => {
    test('empty-tiers fallback: no-LTM 0.53 tier, identical on both requires', () => {
        const v = require(VENDORED);
        const t = v.tierForCombinedQty([], 12);
        expect(t.MarginDenominator).toBe(v.FALLBACK_MARGIN_DENOM);
        expect(t.MarginDenominator).toBe(0.53);
        expect(Number(t.LTM_Fee)).toBe(0);
        if (fs.existsSync(PROXY)) {
            const p = require(PROXY);
            expect(p.FALLBACK_MARGIN_DENOM).toBe(v.FALLBACK_MARGIN_DENOM);
            expect(p.tierForCombinedQty([], 12)).toEqual(t);
        } else {
            console.warn('[fallback-parity] sibling proxy not checked out — vendored-only assertions ran');
        }
    });

    test('client service contains NO local formula copies (delegation ratchet)', () => {
        // The drift class-of-bug: any re-introduced local pipeline shows up as one of these.
        const body = CLIENT_SRC.split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n'); // comments may narrate; code may not
        expect(body).not.toMatch(/Math\.ceil\([^)]*\* 2\) \/ 2/); // half-dollar rounding
        expect(body).not.toMatch(/MarginDenominator\s*[+*/]/); // margin math
        expect(body.match(/DTGCanonicalPricing/g).length).toBeGreaterThanOrEqual(6); // delegation sites
    });
});
