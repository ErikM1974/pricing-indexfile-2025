/**
 * builders/emb/pricing.js — extraction #0 lock (roadmap 0.4).
 *
 * The module is ESM (for the esbuild bundle); jest runs CJS, so we
 * transpile with esbuild at load — the same transform the build uses,
 * which also keeps this test honest about bundle-ability.
 *
 * Locks the Service_Codes contract:
 *   - loadServiceCodePrices caches UPPERCASED codes on window._serviceCodes
 *     (cross-file contract — the monolith's rush sync reads it directly)
 *   - API failure → null + console.error + visible showToast warning,
 *     never a silent wrong price
 *   - getServicePrice: live SellPrice; documented fallback when the code
 *     is missing, the cache is absent, or SellPrice is non-numeric
 */

const path = require('path');
const esbuild = require('esbuild');

function loadModule(win) {
    // bundle:true (not a single-file transform) — pricing.js imports the shared
    // errors module (1.15 fallback badge), so the test loads the same graph the
    // real build ships.
    const result = esbuild.buildSync({
        entryPoints: [path.join(__dirname, '../../../shared_components/js/builders/emb/pricing.js')],
        bundle: true,
        format: 'cjs',
        target: 'es2020',
        write: false,
        logLevel: 'silent',
    });
    const code = result.outputFiles[0].text;
    const moduleObj = { exports: {} };
     
    new Function('module', 'exports', 'window', 'fetch', 'console', code)(
        moduleObj, moduleObj.exports, win, win.fetch, win.console || console
    );
    return moduleObj.exports;
}

function makeWin(fetchImpl) {
    return {
        APP_CONFIG: { API: { BASE_URL: 'http://test/api-base' } },
        fetch: fetchImpl,
        showToast: jest.fn(),
        console: { error: jest.fn(), log: () => {}, warn: () => {} },
    };
}

describe('builders/emb/pricing.js', () => {
    test('loadServiceCodePrices caches uppercased codes on window._serviceCodes', async () => {
        const win = makeWin(jest.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: [
                { ServiceCode: 'grt-75', SellPrice: '75' },
                { ServiceCode: 'DD', SellPrice: '100' },
                { NotACode: true },
            ] }),
        }));
        const mod = loadModule(win);
        const map = await mod.loadServiceCodePrices();
        expect(win.fetch).toHaveBeenCalledWith('http://test/api-base/api/service-codes');
        expect(Object.keys(map).sort()).toEqual(['DD', 'GRT-75']);
        expect(win._serviceCodes['GRT-75'].SellPrice).toBe('75');
    });

    test('API failure → null + console.error + visible toast (never silent)', async () => {
        const win = makeWin(jest.fn().mockResolvedValue({ ok: false, status: 503 }));
        const mod = loadModule(win);
        const result = await mod.loadServiceCodePrices();
        expect(result).toBeNull();
        expect(win.console.error).toHaveBeenCalled();
        expect(win.showToast).toHaveBeenCalledWith(expect.stringContaining('default service prices'), 'warning', 5000);
    });

    test.each([
        ['live price wins', { RUSH: { SellPrice: '25.5' } }, 'RUSH', 99, 25.5],
        ['case-insensitive lookup', { RUSH: { SellPrice: '25.5' } }, 'rush', 99, 25.5],
        ['missing code → fallback', { RUSH: { SellPrice: '25.5' } }, 'NOPE', 42, 42],
        ['no cache → fallback', null, 'RUSH', 42, 42],
        ['non-numeric SellPrice → fallback', { RUSH: { SellPrice: 'call us' } }, 'RUSH', 42, 42],
        ['zero is a valid live price', { LTM: { SellPrice: '0' } }, 'LTM', 50, 0],
    ])('getServicePrice: %s', (_label, cache, code, fallback, expected) => {
        const win = makeWin(jest.fn());
        const mod = loadModule(win);
        win._serviceCodes = cache;
        expect(mod.getServicePrice(code, fallback)).toBe(expected);
    });
});
