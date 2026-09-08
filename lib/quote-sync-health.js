// One watchdog instance per server: bulk sync and health routes share this state.
module.exports = function createQuoteSyncHealth({
    fetch,
    now: readNow = Date.now,
    uptime = process.uptime,
    webhook = process.env.SLACK_QUOTE_SYNC_HEALTH_WEBHOOK_URL || '',
}) {
    let lastQuoteSyncAtMs = 0;
    let lastQuoteSyncResult = null;

    function recordQuoteSyncRun(stats, candidateCount) {
        lastQuoteSyncAtMs = readNow();
        lastQuoteSyncResult = {
            synced: Number(stats.synced) || 0,
            imported: Number(stats.imported) || 0,
            deleted: Number(stats.deleted) || 0,
            pending: Number(stats.pending) || 0,
            errors: Number(stats.errors) || 0,
            candidateCount: Number(candidateCount) || 0,
        };
    }

    // Cron runs hourly; >90 min since the last successful bulk-sync = ~1.5 missed
    // runs = the trigger stopped. uptime guard catches "cron never scheduled at
    // all" (coldStart that never clears) once the dyno has been up long enough
    // that a sync SHOULD have happened.
    const QUOTE_SYNC_STALE_AFTER_MIN = 90;
    const QUOTE_SYNC_NO_BOOT_SYNC_AFTER_MIN = 150;

    function computeQuoteSyncHealth() {
        const now = readNow();
        const coldStart = !lastQuoteSyncAtMs;
        const lastSyncAgoMin = coldStart ? null : Math.round((now - lastQuoteSyncAtMs) / 60000);
        const uptimeMin = Math.round(uptime() / 60);
        const r = lastQuoteSyncResult || {};

        const reasons = [];
        // Never synced since boot, yet the dyno has been up long enough that the
        // hourly cron should have run — the Scheduler job is missing/disabled.
        if (coldStart && uptimeMin >= QUOTE_SYNC_NO_BOOT_SYNC_AFTER_MIN)
            reasons.push('no-sync-since-boot');
        // Cron ran before but has gone quiet.
        if (!coldStart && lastSyncAgoMin >= QUOTE_SYNC_STALE_AFTER_MIN) reasons.push('stale-cron');
        // Cron ran but threw on rows (the ECONNREFUSED regression signature).
        if (!coldStart && Number(r.errors) > 0) reasons.push('sync-errors');
        // Cron ran, had work to do, but synced nothing (also the regression signature).
        if (!coldStart && Number(r.candidateCount) > 0 && Number(r.synced) === 0)
            reasons.push('sync-noop');

        const reason = reasons.length ? reasons.join('+') : null;
        return {
            ok: !reason,
            reason,
            coldStart,
            uptimeMin,
            lastSyncAgo_min: lastSyncAgoMin,
            lastSyncResult: lastQuoteSyncResult,
            thresholds: {
                staleAfterMin: QUOTE_SYNC_STALE_AFTER_MIN,
                noBootSyncAfterMin: QUOTE_SYNC_NO_BOOT_SYNC_AFTER_MIN,
            },
        };
    }

    // Deduped, fire-and-forget Slack notify (same shape as the proxy's
    // slack-supacolor-health-notify.js: 4-hour dedup per reason; unset webhook =
    // silent no-op so the watchdog can ship before the Slack channel exists).
    const SLACK_QUOTE_SYNC_HEALTH_WEBHOOK = webhook;
    const QUOTE_SYNC_HEALTH_DEDUP_TTL_MS = 4 * 60 * 60 * 1000;
    const _quoteSyncHealthDedup = new Map();

    async function notifyQuoteSyncHealth(health) {
        if (!SLACK_QUOTE_SYNC_HEALTH_WEBHOOK) return { sent: false, skipped: 'no-webhook' };
        const key = `quote-sync-health|${health.reason || 'unknown'}`;
        const now = readNow();
        const expiresAt = _quoteSyncHealthDedup.get(key);
        if (expiresAt && expiresAt > now) return { sent: false, skipped: 'dedup' };
        _quoteSyncHealthDedup.set(key, now + QUOTE_SYNC_HEALTH_DEDUP_TTL_MS);

        const r = health.lastSyncResult || {};
        const lastRun = health.coldStart
            ? `never since boot (${health.uptimeMin}m uptime)`
            : `${health.lastSyncAgo_min}m ago — synced:${r.synced} imported:${r.imported} errors:${r.errors} candidates:${r.candidateCount}`;
        const text = [
            `🚨 *Quote→ShopWorks sync unhealthy*`,
            `*Reason:* ${health.reason}`,
            `*Last bulk-sync:* ${lastRun}`,
            `\n<https://www.teamnwca.com/dashboards/quote-management.html|Open Quote Management> · check \`heroku logs --app sanmar-inventory-app | grep bulk-sync\``,
        ].join('\n');

        try {
            const resp = await fetch(SLACK_QUOTE_SYNC_HEALTH_WEBHOOK, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            return { sent: true };
        } catch (err) {
            _quoteSyncHealthDedup.delete(key); // let the next poll retry
            return { sent: false, error: err.message };
        }
    }
    return { recordQuoteSyncRun, computeQuoteSyncHealth, notifyQuoteSyncHealth };
};
