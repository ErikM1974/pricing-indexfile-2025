// Payment email-transport: explicit shared application dependencies.
module.exports = function create(ctx) {
    const { fetch } = ctx;

    // ── Server-authoritative order-confirmation emails (Feature A, 2026-06-10) ──
    // The Stripe webhook is the authoritative sender — a buyer who closes the tab
    // before the success page polls no longer loses the confirmation. The browser
    // (custom-tees-success.js sendEmailsOnce) stays as FALLBACK when the
    // orderSettings.emailsSentAt stamp is absent. This is a faithful server-side
    // port of that function's template params — keep the two in sync.
    // Service id is hardcoded to match the browser sender: the EMAILJS_SERVICE_ID
    // env var points at a DIFFERENT service in the same account — do not use it.
    const ORDER_EMAILJS_SERVICE = 'service_1c4k67j';

    const EMAILJS_SEND_URL = 'https://api.emailjs.com/api/v1.0/email/send';

    // One EmailJS REST send with an 8s timeout. Throws on failure — callers
    // catch; email errors must NEVER block the webhook or the ShopWorks push.
    async function sendEmailJSTemplate(templateId, templateParams) {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 8000);
        try {
            const resp = await fetch(EMAILJS_SEND_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    service_id: ORDER_EMAILJS_SERVICE,
                    template_id: templateId,
                    user_id: process.env.EMAILJS_PUBLIC_KEY,
                    accessToken: process.env.EMAILJS_PRIVATE_KEY,
                    template_params: templateParams,
                }),
                signal: ctl.signal,
            });
            if (!resp.ok) {
                const body = await resp.text().catch(() => '');
                throw new Error(`EmailJS HTTP ${resp.status}: ${body.slice(0, 200)}`);
            }
            return true;
        } finally {
            clearTimeout(timer);
        }
    }

    return { sendEmailJSTemplate };
};
