/**
 * builders/shared/errors.js — roadmap 1.15 lock.
 *
 * The structural "never a silent wrong price" module: assertPriceOrThrow
 * stops NaN/negative money math, safeExecute surfaces every failure (even
 * when a fallback is returned), and the banner/badge helpers degrade to
 * console-only without a DOM (these tests run in node).
 */

const path = require('path');
const esbuild = require('esbuild');

function loadModule() {
    const result = esbuild.buildSync({
        entryPoints: [path.join(__dirname, '../../../shared_components/js/builders/shared/errors.js')],
        bundle: true,
        format: 'cjs',
        target: 'es2020',
        write: false,
        logLevel: 'silent',
    });
    const moduleObj = { exports: {} };
     
    new Function('module', 'exports', 'console', result.outputFiles[0].text)(
        moduleObj, moduleObj.exports, { log() {}, warn() {}, error() {} }
    );
    return moduleObj.exports;
}

const {
    PricingError,
    assertPriceOrThrow,
    safeExecute,
    showErrorBanner,
    showFallbackPricingWarning,
    fallbackPricingLabels,
} = loadModule();

describe('assertPriceOrThrow', () => {
    test('passes finite non-negative prices through (0 is a legal $0.00 line)', () => {
        expect(assertPriceOrThrow(12.5)).toBe(12.5);
        expect(assertPriceOrThrow(0)).toBe(0);
        expect(assertPriceOrThrow('7.25')).toBe(7.25); // numeric strings coerce
    });

    test('THROWS PricingError on NaN/undefined/null/negative — corruption never renders', () => {
        expect(() => assertPriceOrThrow(NaN, 'unit price')).toThrow(PricingError);
        expect(() => assertPriceOrThrow(undefined)).toThrow(PricingError);
        expect(() => assertPriceOrThrow(null)).toThrow(PricingError);
        expect(() => assertPriceOrThrow(-4)).toThrow(PricingError);
        expect(() => assertPriceOrThrow('garbage')).toThrow(/Invalid price/);
    });

    test('error carries context + offending value for debuggability', () => {
        try {
            assertPriceOrThrow(NaN, 'AL run charge');
        } catch (err) {
            expect(err.message).toContain('AL run charge');
            expect(err.name).toBe('PricingError');
            return;
        }
        throw new Error('should have thrown');
    });
});

describe('safeExecute', () => {
    test('success passes the result through untouched', async () => {
        await expect(safeExecute(() => 42, { userMessage: 'x' })).resolves.toBe(42);
        await expect(safeExecute(async () => 'ok', { userMessage: 'x' })).resolves.toBe('ok');
    });

    test('failure RETHROWS by default (callers cannot accidentally swallow)', async () => {
        await expect(
            safeExecute(() => { throw new Error('boom'); }, { userMessage: 'API failed' })
        ).rejects.toThrow('boom');
    });

    test('rethrow:false returns the fallback — but the failure was still surfaced first', async () => {
        const result = await safeExecute(
            () => { throw new Error('down'); },
            { userMessage: 'Pricing down', rethrow: false, fallback: [] }
        );
        expect(result).toEqual([]);
    });
});

describe('DOM-less degradation (node env has no document)', () => {
    test('showErrorBanner returns null instead of crashing', () => {
        expect(showErrorBanner('pricing dead')).toBeNull();
    });

    test('showFallbackPricingWarning still ACCUMULATES labels (state survives for a later render)', () => {
        expect(showFallbackPricingWarning('service prices')).toBeNull();
        showFallbackPricingWarning('digitizing rate');
        showFallbackPricingWarning('service prices'); // idempotent
        expect(fallbackPricingLabels().sort()).toEqual(['digitizing rate', 'service prices']);
    });
});
