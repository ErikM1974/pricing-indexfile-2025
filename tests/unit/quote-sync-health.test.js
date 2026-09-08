const createHealth = require('../../lib/quote-sync-health');

function watchdog(options = {}) {
    let time = 1000000,
        seconds = 0;
    const fetch = jest.fn().mockResolvedValue({ ok: true });
    return {
        fetch,
        tick: (minutes) => {
            time += minutes * 60000;
        },
        uptime: (minutes) => {
            seconds = minutes * 60;
        },
        state: createHealth({
            fetch,
            now: () => time,
            uptime: () => seconds,
            webhook: 'https://alerts.example.test/quote-sync',
            ...options,
        }),
    };
}

test('construction has no timers or network effects and waits 150 minutes for the first sync', () => {
    const h = watchdog();
    expect(h.fetch).not.toHaveBeenCalled();
    expect(h.state.computeQuoteSyncHealth()).toMatchObject({
        ok: true,
        coldStart: true,
        lastSyncAgo_min: null,
    });
    h.uptime(149);
    expect(h.state.computeQuoteSyncHealth().ok).toBe(true);
    h.uptime(150);
    expect(h.state.computeQuoteSyncHealth()).toMatchObject({
        ok: false,
        reason: 'no-sync-since-boot',
    });
});

test('one recorded run refreshes the same health instance and normalizes counters', () => {
    const h = watchdog();
    h.state.recordQuoteSyncRun({ synced: '2', imported: '1', errors: 0, purgeErrors: 9 }, '2');
    expect(h.state.computeQuoteSyncHealth()).toMatchObject({
        ok: true,
        coldStart: false,
        lastSyncResult: {
            synced: 2,
            imported: 1,
            deleted: 0,
            pending: 0,
            errors: 0,
            candidateCount: 2,
        },
    });
    expect(h.state.computeQuoteSyncHealth().lastSyncResult).not.toHaveProperty('purgeErrors');
});

test('staleness uses the existing rounded 90-minute boundary', () => {
    const h = watchdog();
    h.state.recordQuoteSyncRun({ synced: 1 }, 1);
    h.tick(89.49);
    expect(h.state.computeQuoteSyncHealth().ok).toBe(true);
    h.tick(0.01);
    expect(h.state.computeQuoteSyncHealth()).toMatchObject({
        reason: 'stale-cron',
        lastSyncAgo_min: 90,
    });
});

test('stale, error and no-op reasons keep their original order', () => {
    const h = watchdog();
    h.state.recordQuoteSyncRun({ synced: 0, errors: 3 }, 3);
    h.tick(100);
    expect(h.state.computeQuoteSyncHealth().reason).toBe('stale-cron+sync-errors+sync-noop');
    h.state.recordQuoteSyncRun({}, 0);
    expect(h.state.computeQuoteSyncHealth().ok).toBe(true);
});

test('alerts deduplicate for four hours per reason, then send again', async () => {
    const h = watchdog();
    h.state.recordQuoteSyncRun({ errors: 1 }, 1);
    const alert = h.state.computeQuoteSyncHealth();
    await expect(h.state.notifyQuoteSyncHealth(alert)).resolves.toEqual({ sent: true });
    await expect(h.state.notifyQuoteSyncHealth(alert)).resolves.toEqual({
        sent: false,
        skipped: 'dedup',
    });
    await expect(
        h.state.notifyQuoteSyncHealth({ ...alert, reason: 'stale-cron' })
    ).resolves.toEqual({ sent: true });
    h.tick(240);
    await expect(h.state.notifyQuoteSyncHealth(alert)).resolves.toEqual({ sent: true });
    expect(h.fetch).toHaveBeenCalledTimes(3);
    const [url, request] = h.fetch.mock.calls[0];
    expect(url).toBe('https://alerts.example.test/quote-sync');
    expect(request.method).toBe('POST');
    expect(JSON.parse(request.body).text).toContain('sync-errors+sync-noop');
});

test.each(['http', 'transport'])(
    'a failed %s notification allows the next poll to retry',
    async (failure) => {
        const h = watchdog();
        if (failure === 'http') h.fetch.mockResolvedValueOnce({ ok: false, status: 503 });
        else h.fetch.mockRejectedValueOnce(new Error('Connection interrupted'));
        const alert = { reason: 'sync-errors', lastSyncResult: { errors: 1 } };
        await expect(h.state.notifyQuoteSyncHealth(alert)).resolves.toMatchObject({
            sent: false,
            error: expect.any(String),
        });
        await expect(h.state.notifyQuoteSyncHealth(alert)).resolves.toEqual({ sent: true });
    }
);

test('missing webhook skips delivery without calling fetch', async () => {
    const h = watchdog({ webhook: '' });
    await expect(h.state.notifyQuoteSyncHealth({ reason: 'sync-errors' })).resolves.toEqual({
        sent: false,
        skipped: 'no-webhook',
    });
    expect(h.fetch).not.toHaveBeenCalled();
});

test('independent servers have independent state and dedup maps', async () => {
    const a = watchdog(),
        b = watchdog();
    a.state.recordQuoteSyncRun({ synced: 1 }, 1);
    expect(a.state.computeQuoteSyncHealth().coldStart).toBe(false);
    expect(b.state.computeQuoteSyncHealth().coldStart).toBe(true);
    for (const h of [a, b])
        await expect(h.state.notifyQuoteSyncHealth({ reason: 'sync-errors' })).resolves.toEqual({
            sent: true,
        });
});
