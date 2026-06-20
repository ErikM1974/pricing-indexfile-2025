/**
 * dtg-canonical-fallback-parity.test.js — locks the DTG empty-tiers fallback margin against drift
 * between its TWO copies (2026-06-20 pricing-engine audit DTG-4).
 *
 * The DTG formula lives in TWO repos: the SERVER canonical pricer
 * (caspio-pricing-proxy/lib/dtg-canonical-pricing.js — drives the customer catalog + Quick Quote
 * via /api/dtg/quote-pricing) and the CLIENT service (shared_components/js/dtg-pricing-service.js —
 * drives the staff builder preview/PDF). When Caspio returns no tiers, BOTH substitute a hardcoded
 * fallback margin. They had silently DRIFTED — server 0.57 vs client 0.53 — so an empty-tiers outage
 * would price the same item differently across surfaces. Reconciled to 0.53; this pins them together.
 *
 * Cross-repo: skips the cross-repo assertion if the sibling proxy repo isn't checked out (FE-only CI).
 * The real long-term fix is to collapse the two copies into one (DTG-1) — until then, this guards the
 * constant that already drifted once.
 */
const fs = require('fs');
const path = require('path');

const CLIENT = path.join(__dirname, '..', '..', 'shared_components', 'js', 'dtg-pricing-service.js');
const PROXY = path.join(__dirname, '..', '..', '..', 'caspio-pricing-proxy', 'lib', 'dtg-canonical-pricing.js');

/** Client's getTierForQuantity() empty-tiers fallback margin. */
function clientFallbackMargin() {
    const src = fs.readFileSync(CLIENT, 'utf8');
    const m = src.match(/Return a safe fallback tier[\s\S]{0,300}?MarginDenominator:\s*([\d.]+)/);
    return m ? parseFloat(m[1]) : null;
}
/** Server's FALLBACK_MARGIN_DENOM (undefined if the sibling repo isn't present). */
function proxyFallbackMargin() {
    if (!fs.existsSync(PROXY)) return undefined;
    const src = fs.readFileSync(PROXY, 'utf8');
    const m = src.match(/FALLBACK_MARGIN_DENOM\s*=\s*([\d.]+)/);
    return m ? parseFloat(m[1]) : null;
}

describe('DTG empty-tiers fallback margin parity (server canonical ↔ client service)', () => {
    test('client dtg-pricing-service.js exposes a numeric fallback margin', () => {
        const c = clientFallbackMargin();
        expect(typeof c).toBe('number');
        expect(c).toBeGreaterThan(0);
    });

    test('server and client fallback margins are IDENTICAL (no silent drift)', () => {
        const proxy = proxyFallbackMargin();
        if (proxy === undefined) {
            console.warn('[dtg-fallback-parity] sibling caspio-pricing-proxy not checked out — skipping cross-repo assertion');
            return;
        }
        expect(proxy).toBe(clientFallbackMargin()); // both 0.53 as of 2026-06-20
    });
});
