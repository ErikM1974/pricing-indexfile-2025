/**
 * dtf-medium-resolver.test.js — locks the DTF location->size contract that the
 * Quick Quote and the customer catalog rely on to reach the Medium (<=9x12) transfer band.
 *
 * WHY THIS EXISTS: the penny-locked web-quote-cart-parity baselines price DTF by an
 * explicit `l.size` and NEVER call the location->size resolver, so they would NOT catch a
 * regression in `center-front`/`center-back` -> `medium`. This test exercises the real
 * resolver maps directly. (DTF Medium app-wide audit, 2026-06-23.)
 *
 * Two maps must agree, because the engine resolver (dtfLocationInfo) reads DTFConfig.
 * transferLocations when present (the LIVE browser path) and the engine's structural-copy
 * fallback otherwise. If either drifts, DTF Medium silently breaks on the catalog + quick quote.
 */

// dtf-quote-pricing.js assigns DTFConfig to `window` only — give it a window to load into.
// (tests/setup.js intentionally sets global.window = undefined for dual-export guards.)
if (typeof global.window === 'undefined' || global.window === undefined) global.window = {};
require('../../shared_components/js/dtf-quote-pricing.js');
const DTFConfig = global.window.DTFConfig;

const QuoteCartEngine = require('../../shared_components/js/quote-cart-engine.js');
const FALLBACK = QuoteCartEngine._internals.DTF_LOCATIONS_FALLBACK;
const fbSize = (loc) => { const r = FALLBACK.find((l) => l.value === loc); return r && r.size; };

describe('DTF location -> size resolver — Medium (<=9x12) band', () => {
    test('DTFConfig (the live browser resolver) maps center-front / center-back -> medium', () => {
        expect(DTFConfig).toBeDefined();
        expect(DTFConfig.helpers.getSizeForLocation('center-front')).toBe('medium');
        expect(DTFConfig.helpers.getSizeForLocation('center-back')).toBe('medium');
    });

    test('engine fallback maps center-front / center-back -> medium', () => {
        expect(fbSize('center-front')).toBe('medium');
        expect(fbSize('center-back')).toBe('medium');
    });

    test('size anchors are unchanged (small / large)', () => {
        expect(fbSize('left-chest')).toBe('small');
        expect(fbSize('full-front')).toBe('large');
        expect(fbSize('full-back')).toBe('large');
        expect(DTFConfig.helpers.getSizeForLocation('left-chest')).toBe('small');
        expect(DTFConfig.helpers.getSizeForLocation('full-front')).toBe('large');
        expect(DTFConfig.helpers.getSizeForLocation('full-back')).toBe('large');
    });

    test('DTFConfig and the engine fallback AGREE on every shared location', () => {
        FALLBACK.forEach((fb) => {
            const cfgSize = DTFConfig.helpers.getSizeForLocation(fb.value);
            if (cfgSize) expect(cfgSize).toBe(fb.size); // every location both know about must match
        });
    });
});
