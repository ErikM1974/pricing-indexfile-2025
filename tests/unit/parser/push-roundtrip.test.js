/**
 * The parser must understand the part numbers WE PUSH.
 *
 * The EMB builder pushes decoration lines to ShopWorks using the part numbers in the proxy's
 * KNOWN_FEE_PNS (caspio-pricing-proxy/config/manageorders-emb-config.js:64-84). When a rep later
 * pastes one of OUR OWN orders back into the builder to re-quote or reorder it, the parser has to
 * recognise those same part numbers. Two of them it does not, and the failure is silent:
 *
 *   DECG-FB → classified 'product'  (every full back the current builder pushes)
 *   AL-CAP  → classified 'product'  (every cap additional logo; KNOWN_FEE_PNS line 78 even says
 *                                    "new builder uses AL-CAP")
 *
 * A decoration classified as a product does not become a mispriced decoration — it becomes a
 * GARMENT ROW whose style number is the literal string "DECG-FB", with the decoration charge as
 * its unit price, and no warning anywhere. The parser knows only the LEGACY vocabulary (FB, CB,
 * CS), so orders written by the old system round-trip and orders written by the current one do not.
 *
 * These lock the vocabulary in both directions: the legacy codes keep working, and the codes we
 * actually emit stop being silently demoted to garments.
 */
const path = require('path');
const fs = require('fs');
const ShopWorksImportParser = require('../../../shared_components/js/shopworks-import-parser');

const FIXTURES_DIR = path.join(__dirname, '..', '..', 'fixtures', 'shopworks-orders');

/**
 * Every part number the EMB/SCP/DTF push transformers can emit as a FEE line, mirrored from the
 * proxy's KNOWN_FEE_PNS. Mirrored rather than imported because it lives in the sibling repo; the
 * drift risk is deliberate and cheap — a new fee part that the parser cannot read is exactly the
 * bug this file exists to catch, and it surfaces here as a failing test rather than as a garment
 * row named "GRT-75" in someone's quote.
 */
const PUSHED_FEE_PARTS = [
    'SEG', 'DECG', 'DECC', 'Monogram', 'RUSH', 'Freight',
    'DD', 'DDE', 'DDT', 'AL', 'DT', 'Pallet', 'Art',
    'AS-Garm', 'CDP', 'AS-CAP', 'LTM', 'CTR-Garmt', 'CTR-Cap',
    'AL-CAP', 'DECG-FB', '3D-EMB', 'GRT-50', 'GRT-75',
    'SPRESET', 'SPSU', 'Vellum', 'Color Chg',
    'Laser Patch', 'SECC', 'CB', 'CS', 'WEIGHT',
];

describe('the parser understands every part number we push', () => {
    let parser;
    beforeEach(() => { parser = new ShopWorksImportParser(); });

    test.each(PUSHED_FEE_PARTS)('%s is not demoted to a product', (pn) => {
        expect(parser.classifyPartNumber(pn)).not.toBe('product');
    });

    // The two that were actually broken, called out by name so a regression names itself
    // instead of hiding in a parameterised list.
    test('DECG-FB is a full back, not a garment', () => {
        expect(parser.classifyPartNumber('DECG-FB')).toBe('fb');
    });

    test('AL-CAP is a cap additional logo, not a garment', () => {
        expect(parser.classifyPartNumber('AL-CAP')).toBe('cb');
    });

    test('the LEGACY codes still classify as before — this is additive', () => {
        expect(parser.classifyPartNumber('FB')).toBe('fb');
        expect(parser.classifyPartNumber('CB')).toBe('cb');
        expect(parser.classifyPartNumber('CS')).toBe('cs');
        expect(parser.classifyPartNumber('AL')).toBe('al');
    });

    test('a real garment style is still a product — the fix must not overreach', () => {
        for (const style of ['PC54', 'PC61', 'C112', 'CP90', 'F260', 'PC54_2X']) {
            expect(parser.classifyPartNumber(style)).toBe('product');
        }
    });
});

describe('an order WE pushed round-trips', () => {
    let result;
    beforeAll(() => {
        const text = fs.readFileSync(path.join(FIXTURES_DIR, 'decg-fb-roundtrip.txt'), 'utf8');
        result = new ShopWorksImportParser().parse(text);
    });

    test('the DECG-FB line does not become a garment row', () => {
        const pns = (result.products || []).map((p) => p.partNumber);
        expect(pns).toContain('PC54');      // the real garment survives
        expect(pns).not.toContain('DECG-FB');
        expect(pns).not.toContain('AL-CAP');
        expect(result.products).toHaveLength(1);
    });

    test('the DECG-FB line becomes a Full Back decoration', () => {
        const fb = (result.services.additionalLogos || []).find((a) => a.type === 'fb');
        expect(fb).toBeDefined();
        expect(fb.position).toBe('Full Back');
        expect(fb.quantity).toBe(24);
    });

    test('the AL-CAP line becomes a cap decoration', () => {
        const cap = (result.services.additionalLogos || []).find((a) => a.type === 'cb');
        expect(cap).toBeDefined();
        expect(cap.position).toBe('Cap Back');
        expect(cap.quantity).toBe(24);
    });

    // Only the 'al' branch used to keep unitPrice. fb/cb/cs dropped it, so the review modal
    // computed shopWorksPrice 0 and DISABLED its ShopWorks radio (spr-modal.js:
    // `swAvail = swPrice != null && swPrice > 0`). The rep could not choose "bill what the
    // customer was actually billed" on precisely the lines where our recomputed number is most
    // likely to differ from history — and a $0.00 next to a computed price reads as "we have no
    // record", not "we dropped the field".
    test('the ShopWorks price survives, so the rep can still compare', () => {
        const fb = (result.services.additionalLogos || []).find((a) => a.type === 'fb');
        const cap = (result.services.additionalLogos || []).find((a) => a.type === 'cb');
        expect(fb.unitPrice).toBe(32.5);
        expect(cap.unitPrice).toBe(7);
    });
});

describe('the legacy reclassify path also keeps its price', () => {
    test('a $45 "Back Logo" AL reclassified to FB carries the $45 forward', () => {
        const text = fs.readFileSync(path.join(FIXTURES_DIR, 'al-back-logo-reclassify.txt'), 'utf8');
        const result = new ShopWorksImportParser().parse(text);
        const fb = result.services.additionalLogos.find((a) => a.type === 'fb');
        expect(fb.reclassifiedFromAL).toBe(true);
        // The $40 threshold that triggered the reclassify is the SAME number the rep needs to
        // see; dropping it here was doubly odd because this branch had it in hand.
        expect(fb.unitPrice).toBe(45);
    });
});
