/**
 * Sample-order tax — destination-based DOR lookup (2026-07-06).
 * Guards the fix for the hardcoded 10.1% Milton rate that survived the
 * 2026-07-06 repo sweep (Milton is 10.2% now). The service must:
 *   - derive the rate from POST /api/tax-rates/lookup on the SHIP-TO address
 *     (WAC 458-20-145 destination sourcing), not a flat Milton constant
 *   - zero out-of-state shipments (WAC 458-20-193)
 *   - fall back to Milton 10.2% ONLY with fallback:true, which stamps a
 *     "TAX — VERIFY AT INVOICING" note on the pushed order
 *   - emit the storefront-push tax part convention: Tax_<pct> / Tax_0
 *
 * The service is a browser global with no module.exports, so we load it by
 * evaluating the file with window/fetch/localStorage injected.
 */
const fs = require('fs');
const path = require('path');

// Mutable fetch dispatcher — each test swaps impl.fetch.
const impl = { fetch: async () => { throw new Error('fetch not stubbed'); } };

function loadServiceClass() {
    const code = fs.readFileSync(
        path.join(__dirname, '../../shared_components/js/sample-order-service.js'), 'utf8');
    // eslint-disable-next-line no-new-func
    const factory = new Function('window', 'document', 'fetch', 'localStorage',
        code + '\nreturn SampleOrderService;');
    return factory({}, {}, (...a) => impl.fetch(...a), { getItem: () => null, setItem: () => {} });
}

const SampleOrderService = loadServiceClass();
const svc = new SampleOrderService();

const jsonResp = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

describe('SampleOrderService destination-based sales tax', () => {
    test('out-of-state ship → 0% + Tax_0, no DOR call (WAC 458-20-193)', async () => {
        impl.fetch = jest.fn();
        const t = await svc.lookupSalesTax({ shipping_state: 'or' });
        expect(t.rate).toBe(0);
        expect(t.source).toBe('out-of-state');
        expect(t.fallback).toBe(false);
        expect(impl.fetch).not.toHaveBeenCalled();

        const f = svc.deriveTaxPartFields(t.rate, t);
        expect(f.taxPartNumber).toBe('Tax_0');
        expect(f.taxPartDescription).toMatch(/out of state/i);
    });

    test('WA ship → destination percent from lookup (10.2 → 0.102, Tax_10.2), posts ship-to address', async () => {
        impl.fetch = jest.fn(async () => jsonResp({
            success: true, taxRate: 10.2, account: '2200.102', accountName: 'Wash:10.2%', fallback: false,
        }));
        const t = await svc.lookupSalesTax({
            shipping_state: 'WA', shipping_city: 'Milton', shipping_zip: '98354',
            shipping_address1: '2025 Freeman Rd E',
        });
        expect(t.rate).toBeCloseTo(0.102, 6);
        expect(t.fallback).toBe(false);

        const f = svc.deriveTaxPartFields(t.rate, t);
        expect(f.taxPartNumber).toBe('Tax_10.2');
        expect(f.taxPct).toBe('10.2');
        expect(f.taxPartDescription).toContain('10.2%');

        // The lookup must be driven by the customer's ship-to, not a constant.
        const [url, opts] = impl.fetch.mock.calls[0];
        expect(url).toContain('/api/tax-rates/lookup');
        const body = JSON.parse(opts.body);
        expect(body).toEqual({ address: '2025 Freeman Rd E', city: 'Milton', state: 'WA', zip: '98354' });
    });

    test('non-Milton WA destination keeps ITS rate (destination sourcing, not Milton flat)', async () => {
        impl.fetch = async () => jsonResp({
            success: true, taxRate: 10.35, account: '2200.103', accountName: 'Wash:10.35%', fallback: false,
        });
        const t = await svc.lookupSalesTax({ shipping_state: 'WA', shipping_city: 'Seattle', shipping_zip: '98101' });
        expect(t.rate).toBeCloseTo(0.1035, 6);
        expect(svc.deriveTaxPartFields(t.rate, t).taxPartNumber).toBe('Tax_10.35');
    });

    test('lookup failure → Milton 10.2% ESTIMATE flagged fallback:true (never silent, never 10.1)', async () => {
        impl.fetch = async () => { throw new Error('network down'); };
        const t = await svc.lookupSalesTax({ shipping_state: 'WA', shipping_city: 'Milton', shipping_zip: '98354' });
        expect(t.rate).toBeCloseTo(0.102, 6);
        expect(t.fallback).toBe(true);   // drives the TAX — VERIFY order note
        expect(svc.deriveTaxPartFields(t.rate, t).taxPartNumber).toBe('Tax_10.2');
    });

    test('DOR-default response (fallback:true) keeps the flag so the order gets a VERIFY note', async () => {
        impl.fetch = async () => jsonResp({ success: true, taxRate: 10.2, fallback: true });
        const t = await svc.lookupSalesTax({ shipping_state: 'WA', shipping_city: 'Puyallup', shipping_zip: '98371' });
        expect(t.fallback).toBe(true);
        expect(t.source).toBe('dor-default');
    });

    test('lookup rejects a no-rate response body instead of pushing NaN tax', async () => {
        impl.fetch = async () => jsonResp({ success: false, error: 'bad address' }, false, 400);
        const t = await svc.lookupSalesTax({ shipping_state: 'WA', shipping_city: 'X', shipping_zip: '99999' });
        expect(t.fallback).toBe(true);           // fell through to the flagged Milton default
        expect(Number.isFinite(t.rate)).toBe(true);
    });
});
