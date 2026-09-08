// Payment alerts: explicit shared application dependencies.
module.exports = function create(ctx) {
    const { fetch, sendEmailJSTemplate } = ctx;

    // Staff alert for money-path failures (paid order that didn't reach
    // ShopWorks, payment with no Caspio record). Fire-and-forget Slack webhook;
    // falls back to the quote-delete channel hook, and ALWAYS error-logs so
    // Papertrail catches it even with no Slack configured.
    function alert3DT(text) {
        staffAlert('[3DT ALERT] ', '🚨 3-Day Tees: ', '3-Day Tees', text);
    }

    // ── The one staff-alert pipe (2026-09-07) ──────────────────────────────────
    // Every money-path alert goes: (1) console.error so Papertrail always has it,
    // (2) Slack if a webhook is configured, (3) EMAIL to the shop through the
    // EmailJS template `template_staff_alert` (Erik built it 2026-09-07; params
    // to_email / subject / message / source). Neither Slack var was ever set on
    // Heroku, so until now a failed payment reached nobody — the email is the path
    // that actually lands. Fire-and-forget: alerting must never throw or await.
    const STAFF_ALERT_TEMPLATE = 'template_staff_alert';

    // ≤24 chars — EmailJS truncates longer IDs
    const STAFF_ALERT_DEFAULT_TO = 'erik@nwcustomapparel.com';

    function staffAlert(logPrefix, slackPrefix, source, text) {
        console.error(logPrefix + text);
        const hook =
            process.env.SLACK_ORDER_ALERT_WEBHOOK_URL ||
            process.env.SLACK_QUOTE_DELETE_WEBHOOK_URL ||
            '';
        if (hook) {
            fetch(hook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: slackPrefix + text }),
            }).catch(() => {
                /* alerting must never throw */
            });
        }
        staffAlertEmail(source, text).catch(() => {
            /* alerting must never throw */
        });
    }

    // Resolves false (never throws) when the EmailJS keys are absent (local dev) or the send fails.
    async function staffAlertEmail(source, text) {
        if (!process.env.EMAILJS_PUBLIC_KEY || !process.env.EMAILJS_PRIVATE_KEY) return false;
        try {
            await sendEmailJSTemplate(STAFF_ALERT_TEMPLATE, {
                to_email: process.env.ALERT_EMAIL_TO || STAFF_ALERT_DEFAULT_TO,
                subject: `🚨 ${source}: ${String(text).split('\n')[0].slice(0, 120)}`,
                message: String(text),
                source,
            });
            return true;
        } catch (e) {
            console.error('[staff-alert] email failed: ' + (e && e.message));
            return false;
        }
    }

    // Money-path alert for quote payments (deposit paid / stale-hash / ledger
    // failure). Same Slack hooks as alert3DT, labeled for quotes.
    function alertQuotePay(text) {
        staffAlert('[QUOTE PAY] ', '💰 Quote payments: ', 'Quote payments', text);
    }

    return { alert3DT, alertQuotePay };
};
