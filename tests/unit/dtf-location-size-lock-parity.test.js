/**
 * dtf-location-size-lock-parity.test.js — guards the DTF location→transfer-size
 * lock against silent drift between its TWO hand-copied definitions:
 *   1. shared_components/js/dtf-quote-pricing.js  → window.DTFConfig.transferLocations  (the authority)
 *   2. shared_components/js/quote-cart-engine.js  → DTF_LOCATIONS_FALLBACK              (engine's copy)
 *
 * All 3 DTF price surfaces (Quote Builder, Quick Quote/Express, Catalog) resolve a print
 * location → Small/Medium/Large through this lock. The two copies MUST stay identical on
 * (value → size → zone) or the engine fallback could price a location differently from the
 * staff builder. Confirmed byte-consistent by the 2026-06-19 three-surface DTF audit; this
 * test keeps them that way. (`label` is display-only and intentionally absent from the engine copy.)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CONFIG = fs.readFileSync(path.join(ROOT, 'shared_components', 'js', 'dtf-quote-pricing.js'), 'utf8');
const ENGINE = fs.readFileSync(path.join(ROOT, 'shared_components', 'js', 'quote-cart-engine.js'), 'utf8');

// Pull the array literal after `marker`, then map each {value,size,zone} object → {value: {size, zone}}.
function extractLocLock(src, marker) {
    const m = src.match(new RegExp(marker + '\\s*[:=]\\s*\\[([\\s\\S]*?)\\]'));
    if (!m) return null;
    const map = {};
    (m[1].match(/\{[^}]*\}/g) || []).forEach((o) => {
        const val = (o.match(/value:\s*'([^']+)'/) || [])[1];
        const size = (o.match(/size:\s*'([^']+)'/) || [])[1];
        const zone = (o.match(/zone:\s*'([^']+)'/) || [])[1];
        if (val) map[val] = { size, zone };
    });
    return map;
}

describe('DTF location → transfer-size lock parity (DTFConfig ↔ engine fallback)', () => {
    const authority = extractLocLock(CONFIG, 'transferLocations');
    const fallback = extractLocLock(ENGINE, 'DTF_LOCATIONS_FALLBACK');

    test('both lock definitions parse and carry all 9 locations', () => {
        expect(authority && Object.keys(authority).length).toBe(9);
        expect(fallback && Object.keys(fallback).length).toBe(9);
    });

    test('engine DTF_LOCATIONS_FALLBACK == DTFConfig.transferLocations (value → size → zone)', () => {
        // Any added/removed location, or a changed size/zone, in ONE file but not the
        // other would make the engine price a DTF location differently from the builder.
        expect(fallback).toEqual(authority);
    });

    test('the canonical Small/Medium/Large mapping is preserved (audited 2026-06-19)', () => {
        // Pins the audited-correct mapping so even a *synchronized* wrong edit is caught.
        const expected = {
            'left-chest': 'small', 'right-chest': 'small',
            'left-sleeve': 'small', 'right-sleeve': 'small', 'back-of-neck': 'small',
            'center-front': 'medium', 'center-back': 'medium',
            'full-front': 'large', 'full-back': 'large',
        };
        Object.keys(expected).forEach((loc) => {
            expect(authority[loc] && authority[loc].size).toBe(expected[loc]);
        });
    });
});
