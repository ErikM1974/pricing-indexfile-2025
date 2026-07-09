/**
 * SCP bridge diet — two-way lock (Batch 7.5, 2026-07-09; same protocol as the
 * EMB 3.3 diet locks).
 *
 * The 7.5 classifier graded every scp/index.js window bridge against real
 * consumers (HTML pages, classic scripts, generated onclick markup, bare
 * /* global *\/ callers, tests). Four had NONE — their only callers import
 * them directly — so their bridges were deleted. They must stay exported
 * (modules consume them) AND stay off the window surface.
 *
 * Four others looked dead from outside but are LOAD-BEARING: SCP modules call
 * them as bare globals that resolve THROUGH the bridge at runtime. Deleting
 * those breaks features SILENTLY (try/catch-wrapped nudge, dirty-marking):
 * updateDarkGarmentNudge, markScreenPrintDirty, getScpExtraFees,
 * recalculateAllPrices — locked PRESENT here.
 */
const fs = require('fs');
const path = require('path');

const INDEX = path.join(__dirname, '../../../shared_components/js/builders/scp/index.js');

const DIET_UNBRIDGED = [
    'initScreenPrintPersistence',
    'applyMethodSwitchPrefillScp',
    'applyQuickQuotePrefillScp',
    'renderScpPushPreview',
];

const LOAD_BEARING = [
    'updateDarkGarmentNudge',
    'markScreenPrintDirty',
    'getScpExtraFees',
    'recalculateAllPrices',
];

const src = fs.readFileSync(INDEX, 'utf8');

describe('SCP bridge diet (Batch 7.5)', () => {
    test('dieted names stay OFF the window surface', () => {
        for (const name of DIET_UNBRIDGED) {
            expect(src).not.toContain(`window.${name} =`);
        }
    });

    test('dieted names stay exported from their modules', () => {
        const persistence = fs.readFileSync(
            path.join(__dirname, '../../../shared_components/js/builders/scp/persistence.js'),
            'utf8'
        );
        const push = fs.readFileSync(
            path.join(__dirname, '../../../shared_components/js/builders/scp/push.js'),
            'utf8'
        );
        for (const name of ['initScreenPrintPersistence', 'applyMethodSwitchPrefillScp', 'applyQuickQuotePrefillScp']) {
            expect(persistence).toMatch(new RegExp(`export (async )?function ${name}\\b`));
        }
        expect(push).toMatch(/export function renderScpPushPreview\b/);
    });

    test('load-bearing bare-global bridges stay PRESENT', () => {
        for (const name of LOAD_BEARING) {
            expect(src).toContain(`window.${name} = ${name};`);
        }
    });
});
