const { windowFor, summarizeSales, summarizeWorkload, createLiveService, cents, orderSubtotalCents } = require('../../lib/december-finish-line-live');
const window = windowFor(new Date('2026-09-14T20:00:00Z'));
const archive = { success: true, days: [
    { date: '2026-01-10', reps: [{ name: 'Rep A', revenue: 100.01, orderCount: 1 }] },
    { date: '2026-07-17', reps: [{ name: 'Rep A', revenue: 999, orderCount: 9 }] },
    { date: '2026-09-11', reps: [{ name: 'Rep A', revenue: 500, orderCount: 2 }] },
] };
const invoice = (id, amount, date = '2026-09-11') => ({ id_Order: id, id_Customer: 10, date_Invoiced: date, sts_Invoiced: '1', cur_SubTotal: amount });
const assignments = { success: true, records: [{ ID_Customer: 10, CustomerServiceRep: 'Rep A' }] };

test('Pacific date labels and the 60-day replacement interval remain stable across timezones', () => {
    expect(window).toEqual({ year: 2026, today: '2026-09-14', start: '2026-07-17', end: '2026-09-14', hasRecentWindow: true });
    expect(windowFor(new Date('2026-09-14T03:00:00Z')).today).toBe('2026-09-13');
    expect(windowFor(new Date('2027-04-01T20:00:00Z')).hasRecentWindow).toBe(false);
});

test('recent invoices replace archive overlap, deduplicate order IDs, keep signed credits and exclude the two plan orders', () => {
    const a = invoice(1, 25.15);
    const data = summarizeSales(archive, { result: [a, a, invoice(2, -5.10), invoice(133856, 1000), invoice(138925, 1000)] }, assignments, window, { asOf: '2026-09-11', netSalesCents: 10000 });
    expect(data.revenueCents).toBe(12006);
    expect(data.orders).toBe(3);
    expect(data.months[6].revenueCents).toBe(0); // old July amount was replaced, not retained
    expect(data.months[8].revenueCents).toBe(2005);
    expect(data.months.reduce((sum, month) => sum + month.revenueCents, 0)).toBe(data.revenueCents);
    expect(data.reps).toEqual([{ name: 'Rep A', revenueCents: 12006, orders: 3 }]);
    expect(data.comparison.differenceCents).toBe(2006);
});

test('unexpected dates, missing history, stale responses and conflicting duplicate orders fail visibly', () => {
    expect(() => summarizeSales({ success: true, days: [] }, { result: [] }, assignments, window)).toThrow(/coverage/);
    expect(() => summarizeSales(archive, { result: [invoice(1, 5, '2026-07-16')] }, assignments, window)).toThrow(/date/);
    expect(() => summarizeSales(archive, { result: [], stale: true }, assignments, window)).toThrow(/stale/);
    expect(() => summarizeSales(archive, { result: [invoice(1, 5), invoice(1, 6)] }, assignments, window)).toThrow(/conflicting/);
    expect(() => summarizeSales(archive, { result: [invoice(1, null)] }, assignments, window)).toThrow(/money/);
    expect(() => cents('not money')).toThrow();
});

test('null merchandise is zero only when independently confirmed by total, tax and shipping', () => {
    expect(orderSubtotalCents({ cur_SubTotal: null, cur_TotalInvoice: 0, cur_SalesTaxTotal: 0, cur_Shipping: null })).toBe(0);
    expect(orderSubtotalCents({ cur_SubTotal: null, cur_TotalInvoice: 12, cur_SalesTaxTotal: 2, cur_Shipping: 10 })).toBe(0);
    expect(() => orderSubtotalCents({ cur_SubTotal: null, cur_TotalInvoice: 112, cur_SalesTaxTotal: 2, cur_Shipping: 10 })).toThrow(/missing/);
    expect(() => orderSubtotalCents({ cur_SubTotal: null })).toThrow();
    const data = summarizeSales(archive, { result: [invoice('0001', 5), invoice(1, 5)] }, assignments, window);
    expect(data.orders).toBe(2); // one historical and one live invoice
});

test('uninvoiced workload is a separate ordered-date window and cannot inflate achieved sales', () => {
    const row = (id, status) => ({ id_Order: id, date_Ordered: '2026-08-01', sts_Invoiced: status, cur_SubTotal: 10 });
    expect(summarizeWorkload({ result: [row(1, '0'), row(2, '1'), row(3, '.5'), row(4, '222'), row(133856, '0'), row(138925, '0')] }, window))
        .toEqual({ orders: 1, subtotalCents: 1000, start: window.start, end: window.end });
});

function service(failure) {
    const fetch = jest.fn(async url => {
        if (failure && url.includes(failure)) return { ok: false };
        let data;
        if (url.includes('daily-sales')) data = archive;
        else if (url.includes('sales-reps-2026')) data = assignments;
        else if (url.includes('service-codes')) data = { data: [{ ServiceCode: 'CO-ANNUAL-GOAL', IsActive: true, SellPrice: 1000 }] };
        else if (url.includes('date_Invoiced')) data = { result: [invoice(1, 50)] };
        else data = { result: [] };
        return { ok: true, json: async () => data };
    });
    return { fetch, live: createLiveService({ baseUrl: 'https://fixture.invalid', secret: 'synthetic', fetch, clock: () => new Date('2026-09-14T20:00:00Z') }) };
}

test('only GET reads are used; successful requests cache for five minutes and manual refresh bypasses cache', async () => {
    const { live, fetch } = service();
    const result = await live.get();
    expect(result.errors).toEqual([]);
    expect(result.sales.revenueCents).toBe(15001);
    expect(result.goalCents).toBe(100000);
    await live.get(); expect(fetch).toHaveBeenCalledTimes(5);
    await live.get({ force: true }); expect(fetch).toHaveBeenCalledTimes(10);
    for (const [url, options] of fetch.mock.calls) {
        expect(options.method).toBeUndefined();
        if (url.includes('manageorders/orders')) expect(url).toContain('refresh=true');
    }
});

test.each(['daily-sales', 'date_Invoiced'])('failed %s never produces a partial YTD total', async failure => {
    const { live } = service(failure);
    const result = await live.get();
    expect(result.sales).toBe(null);
    expect(result.errors[0]).toMatch(/Sales could not/);
    expect(result.goalCents).toBe(100000);
});

test('failed goal and rep calls do not substitute invented numbers or discard company sales', async () => {
    const result = await service('sales-reps-2026').live.get();
    expect(result.sales.revenueCents).toBe(15001);
    expect(result.sales.reps).toBe(null);
    expect(result.errors).toHaveLength(1);
    const noGoal = await service('service-codes').live.get();
    expect(noGoal.goalCents).toBe(null);
    expect(noGoal.sales.revenueCents).toBe(15001);
});
