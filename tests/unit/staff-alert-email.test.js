/**
 * Staff alert pipe (2026-09-07): every money-path alert (alert3DT / alertQuotePay) must also EMAIL the shop
 * through EmailJS `template_staff_alert`, because no Slack webhook was ever configured on Heroku and a failed
 * payment reached nobody. Runs the real helper source out of server.js with fetch mocked.
 */
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'server.js'), 'utf8');

function slice(from, to) {
    const a = src.indexOf(from); const b = src.indexOf(to, a);
    if (a < 0 || b < 0) throw new Error('anchor missing: ' + from);
    return src.slice(a, b);
}
// the three helpers + the sender, evaluated in a sandbox with a mock fetch
const body = [
    slice('function alert3DT(text)', '// ── Shared quote_sessions row fetch'),
    slice('async function sendEmailJSTemplate(templateId, templateParams)', '// Sends BOTH confirmation emails'),
    slice('function alertQuotePay(text)', '// Append-only Order_Payments ledger'),
].join('\n');

function load(env, fetchImpl) {
    const calls = [];
    const errors = [];
    const fn = new Function('process', 'fetch', 'console', 'EMAILJS_SEND_URL', 'ORDER_EMAILJS_SERVICE', 'AbortController', 'setTimeout', 'clearTimeout',
        body + '\nreturn { alert3DT, alertQuotePay, staffAlert, staffAlertEmail, STAFF_ALERT_TEMPLATE, STAFF_ALERT_DEFAULT_TO };');
    const api = fn({ env }, async (url, opts) => { calls.push({ url, body: JSON.parse(opts.body) }); return fetchImpl ? fetchImpl(url, opts) : { ok: true }; },
        { error: (m) => errors.push(m) }, 'https://api.emailjs.com/api/v1.0/email/send', 'service_1c4k67j', AbortController, setTimeout, clearTimeout);
    return { api, calls, errors };
}
const tick = () => new Promise((r) => setImmediate(r));

test('both alert functions route through the one staffAlert pipe', () => {
    expect(src).toMatch(/function alert3DT\(text\) \{\s*staffAlert\(/);
    expect(src).toMatch(/function alertQuotePay\(text\) \{\s*staffAlert\(/);
    expect(src.match(/const hook = process\.env\.SLACK_ORDER_ALERT_WEBHOOK_URL/g)).toHaveLength(1);
});

test('with EmailJS keys and no Slack hook, an alert emails the shop through template_staff_alert', async () => {
    const { api, calls, errors } = load({ EMAILJS_PUBLIC_KEY: 'pub', EMAILJS_PRIVATE_KEY: 'priv' });
    api.alertQuotePay('deposit paid but Order_Payments write failed for Q-1 ($120.00)');
    await tick(); await tick();
    expect(errors[0]).toBe('[QUOTE PAY] deposit paid but Order_Payments write failed for Q-1 ($120.00)');
    expect(calls).toHaveLength(1);
    const { url, body } = calls[0];
    expect(url).toBe('https://api.emailjs.com/api/v1.0/email/send');
    expect(body.service_id).toBe('service_1c4k67j');
    expect(body.template_id).toBe('template_staff_alert');
    expect(body.template_id.length).toBeLessThanOrEqual(24);
    expect(body.accessToken).toBe('priv');
    expect(body.template_params).toEqual({
        to_email: 'erik@nwcustomapparel.com',
        subject: '🚨 Quote payments: deposit paid but Order_Payments write failed for Q-1 ($120.00)',
        message: 'deposit paid but Order_Payments write failed for Q-1 ($120.00)',
        source: 'Quote payments',
    });
});

test('Slack still fires when a hook exists, and ALERT_EMAIL_TO overrides the recipient', async () => {
    const { api, calls } = load({ EMAILJS_PUBLIC_KEY: 'pub', EMAILJS_PRIVATE_KEY: 'priv', SLACK_ORDER_ALERT_WEBHOOK_URL: 'https://hooks.slack/x', ALERT_EMAIL_TO: 'ops@nwcustomapparel.com' });
    api.alert3DT('paid order 3DT-9 never reached ShopWorks');
    await tick(); await tick();
    expect(calls.map((c) => c.url)).toEqual(['https://hooks.slack/x', 'https://api.emailjs.com/api/v1.0/email/send']);
    expect(calls[0].body.text).toBe('🚨 3-Day Tees: paid order 3DT-9 never reached ShopWorks');
    expect(calls[1].body.template_params.to_email).toBe('ops@nwcustomapparel.com');
    expect(calls[1].body.template_params.source).toBe('3-Day Tees');
});

test('no EmailJS keys → log only, no send; a failed send never throws out of the alert', async () => {
    const a = load({});
    a.api.alertQuotePay('x');
    await tick();
    expect(a.calls).toHaveLength(0);
    expect(a.errors).toEqual(['[QUOTE PAY] x']);
    const b = load({ EMAILJS_PUBLIC_KEY: 'pub', EMAILJS_PRIVATE_KEY: 'priv' }, async () => ({ ok: false, status: 400, text: async () => 'bad template' }));
    expect(() => b.api.alertQuotePay('y')).not.toThrow();
    await tick(); await tick(); await tick();
    expect(b.errors.some((m) => /email failed: EmailJS HTTP 400/.test(m))).toBe(true);
});
