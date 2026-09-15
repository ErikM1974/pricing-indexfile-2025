'use strict';
/**
 * routes/garment-waiver.js — emails for the Customer-Supplied Garment Liability
 * Waiver (pages/forms/garment-liability-waiver.html), 2026-09-15.
 *
 *   POST /api/garment-waiver/send-link   STAFF (requireStaff). The rep fills the
 *        customer's details on the waiver page and clicks "Email customer". The
 *        SERVER builds the prefilled e-sign link (so a tampered link can't be
 *        injected) and sends it through EmailJS template
 *        `template_garment_waiver` (params: to_email, reply_to, subject,
 *        customer_name, message_html, rep_name, rep_email). Returns the link too.
 *
 *   POST /api/garment-waiver/signed      PUBLIC, rate-limited (10/h/IP). Called by
 *        the waiver page right after the proxy stored the signature. Re-reads
 *        the Form_Submissions row through the proxy with the CRM secret and only
 *        emails when the row is a garment-waiver, its stored Email matches the
 *        body AND it was submitted in the last 20 minutes — so nobody can turn an
 *        old row into a mailing, and a 404 tells the page nothing was stored
 *        (honeypot). The emails carry NO customer-typed free text (the row is
 *        created by an anonymous POST, so its text is untrusted): the customer
 *        copy is the reference, name, the server receipt time and a link to the
 *        waiver wording; the rep notice points at the Forms Inbox and is sent
 *        independently of the customer copy. The proxy's server-side hash of the
 *        signed text is compared with the canonical wording shipped in
 *        pages/forms/garment-liability-waiver.txt — a mismatch is flagged to the
 *        rep (never blocks the customer). One send per submission per dyno.
 *
 * EmailJS keys absent (local dev) → 503 with a clear error, never a fake success.
 * The global JSON body parser (server.js) has already run by the time these
 * routes execute, so no per-route parser is mounted here.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = function register(app, ctx) {
    const { CRM_API_BASE, PUBLIC_SITE_ORIGIN, SERVER_DIR, escapeHTMLSrv, fetch, rateLimit, requireStaff, sendEmailJSTemplate, withProxySecret } = ctx;

    const TEMPLATE = process.env.EMAILJS_TEMPLATE_GARMENT_WAIVER || 'template_garment_waiver';
    const PAGE_PATH = '/pages/forms/garment-liability-waiver.html';
    const SHOP_EMAIL = 'sales@nwcustomapparel.com';
    const SHOP_PHONE = '253-922-5793';
    const STAFF_DOMAIN = '@nwcustomapparel.com';
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const ID_RE = /^GLW\d{4}-\d{4}$/;
    const FRESH_MS = 20 * 60 * 1000; // a real customer confirms seconds after signing
    const METHOD_KEYS = { emb: 'Embroidery', scr: 'Screen Printing', dtf: 'DTF / Heat Transfer', las: 'Laser Engraving', pat: 'Patches' };

    // Canonical wording (the .txt is locked to the page's text by tests/unit/garment-liability-waiver.test.js).
    let CANONICAL_SHA256 = '';
    try {
        const canonical = fs.readFileSync(path.join(SERVER_DIR, 'pages', 'forms', 'garment-liability-waiver.txt'), 'utf8').replace(/\s+/g, ' ').trim();
        CANONICAL_SHA256 = crypto.createHash('sha256').update(canonical).digest('hex');
    } catch (e) {
        console.error('[garment-waiver] canonical waiver text unavailable — wording checks disabled:', e && e.message);
    }

    const S = (v, max = 200) => String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);
    const esc = (v) => escapeHTMLSrv(String(v == null ? '' : v));
    const emailReady = () => !!(process.env.EMAILJS_PUBLIC_KEY && process.env.EMAILJS_PRIVATE_KEY);

    // "9/15/2026 11:22 AM PT" from an ISO instant; '' when unparsable.
    function pacificText(iso) {
        const d = new Date(iso);
        if (!iso || isNaN(d.getTime())) return '';
        const date = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', month: 'numeric', day: 'numeric', year: 'numeric' }).format(d);
        const time = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' }).format(d);
        return date + ' ' + time + ' PT';
    }

    const sendLinkLimiter = rateLimit({ windowMs: 60 * 60000, limit: 60, standardHeaders: true, legacyHeaders: false,
        message: { error: 'Too many waiver emails this hour — copy the link instead.' } });
    const signedLimiter = rateLimit({ windowMs: 60 * 60000, limit: 10, standardHeaders: true, legacyHeaders: false,
        message: { error: 'Too many requests — please print this page for your records.' } });

    // Builds the customer link from validated fields — the ONLY place the link shape is defined.
    function buildLink(f) {
        const p = new URLSearchParams();
        const put = (key, value) => { if (value) p.set(key, value); };
        put('c', f.company); put('n', f.customerName); put('e', f.to); put('p', f.phone); put('o', f.orderRef);
        put('g', f.garments); put('q', f.count); put('r', f.rep); put('re', f.repEmail); put('m', f.methods.join(','));
        const q = p.toString();
        return PUBLIC_SITE_ORIGIN + PAGE_PATH + (q ? '?' + q : '');
    }

    function messageBlock(paragraphs, button) {
        let html = paragraphs.map((t) => '<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#1f2933;">' + t + '</p>').join('');
        if (button) {
            html += '<p style="margin:22px 0;"><a href="' + esc(button.href) + '" style="display:inline-block;padding:14px 26px;background:#2e5827;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;">' + button.label + '</a></p>' +
                '<p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:#52606d;">If the button does not open, copy this link into your browser:<br><a href="' + esc(button.href) + '" style="color:#2e5827;word-break:break-all;">' + esc(button.href) + '</a></p>';
        }
        return html;
    }

    // POST /api/garment-waiver/send-link — staff sends the prefilled e-sign link
    app.post('/api/garment-waiver/send-link', requireStaff, sendLinkLimiter, async (req, res) => {
        res.set('Cache-Control', 'no-store');
        const b = req.body || {};
        const staff = (req.session && req.session.crmUser) || {};
        const f = {
            to: S(b.to, 160).toLowerCase(),
            customerName: S(b.customerName, 120),
            company: S(b.company, 160),
            phone: S(b.phone, 60),
            orderRef: S(b.orderRef, 60),
            garments: S(b.garments, 600),
            count: S(b.count, 12),
            rep: S(b.rep, 80) || S(staff.name, 80),
            repEmail: S(staff.email, 160).toLowerCase(),
            methods: (Array.isArray(b.methods) ? b.methods : []).map((m) => S(m, 4).toLowerCase()).filter((m) => METHOD_KEYS[m]).slice(0, 5),
        };
        if (!EMAIL_RE.test(f.to)) return res.status(400).json({ error: 'A valid customer email is required' });
        if (!f.customerName) return res.status(400).json({ error: 'The customer name is required' });
        if (!emailReady()) return res.status(503).json({ error: 'Email is not configured on this server — copy the link instead' });

        const link = buildLink(f);
        const replyTo = f.repEmail.endsWith(STAFF_DOMAIN) ? f.repEmail : SHOP_EMAIL;
        const what = f.garments ? ' (' + esc(f.garments) + ')' : '';
        try {
            await sendEmailJSTemplate(TEMPLATE, {
                to_email: f.to,
                reply_to: replyTo,
                subject: 'Please sign: Customer-Supplied Garment Waiver' + (f.orderRef ? ' – ' + f.orderRef : '') + ' – Northwest Custom Apparel',
                customer_name: f.customerName,
                rep_name: f.rep || 'Northwest Custom Apparel',
                rep_email: replyTo,
                message_html: messageBlock([
                    'Before we start decorating the garments you are supplying' + what + ', we need your signature on our Customer-Supplied Garment Liability Waiver. It explains that we cannot replace garments we did not sell if a production mishap happens, and it takes about two minutes to read and sign online.',
                    'Your details are already filled in — just read it, type your name, and click <strong>Sign &amp; Submit</strong>. You will get a signed copy by email.',
                ], { href: link, label: 'Read &amp; sign the waiver' }),
            });
        } catch (e) {
            console.error('[garment-waiver] send-link email failed:', e && e.message);
            return res.status(502).json({ error: 'Email failed (' + S(e && e.message, 120) + ')', link });
        }
        console.log('[garment-waiver] link emailed to ' + f.to + ' by ' + S(staff.email, 120) + (f.orderRef ? ' for ' + f.orderRef : ''));
        res.json({ sent: true, link });
    });

    // One customer-copy send per submission id per dyno (bounded).
    const sentIds = new Set();
    const remember = (id) => { if (sentIds.size > 2000) sentIds.clear(); sentIds.add(id); };
    const NOT_FOUND = { error: 'Waiver not found' };

    // POST /api/garment-waiver/signed — confirm the row, then customer copy + rep notice
    app.post('/api/garment-waiver/signed', signedLimiter, async (req, res) => {
        res.set('Cache-Control', 'no-store');
        const b = req.body || {};
        const id = S(b.submissionId, 40);
        const email = S(b.email, 160).toLowerCase();
        if (!ID_RE.test(id) || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'submissionId and email are required' });
        if (!emailReady()) return res.status(503).json({ error: 'Email is not configured on this server' });

        let submission;
        try {
            const resp = await fetch(CRM_API_BASE + '/api/form-submissions/' + encodeURIComponent(id), {
                headers: withProxySecret({}), signal: AbortSignal.timeout(12000),
            });
            if (resp.status === 404) return res.status(404).json(NOT_FOUND);
            if (!resp.ok) throw new Error('proxy HTTP ' + resp.status);
            submission = (await resp.json()).submission;
        } catch (e) {
            console.error('[garment-waiver] signed lookup failed:', e && e.message);
            return res.status(502).json({ error: 'Could not confirm the signed waiver' });
        }
        const submittedAt = submission ? Date.parse(submission.Submitted_At) : NaN;
        const fresh = Number.isFinite(submittedAt) && Math.abs(Date.now() - submittedAt) <= FRESH_MS;
        if (!submission || submission.Form_ID !== 'garment-waiver' || S(submission.Email, 160).toLowerCase() !== email || !fresh) {
            return res.status(404).json(NOT_FOUND);
        }
        // Only now is the caller known to own the row — a duplicate answer must not reveal ids to anyone else.
        if (sentIds.has(id)) return res.json({ sent: false, duplicate: true });

        let payload = {};
        try { payload = JSON.parse(submission.Payload_JSON || '{}'); } catch (e) { payload = {}; }
        const sig = (payload && payload.signature && typeof payload.signature === 'object' && !Array.isArray(payload.signature)) ? payload.signature : {};
        const audit = (payload && payload.audit && typeof payload.audit === 'object' && !Array.isArray(payload.audit)) ? payload.audit : {};
        const customerName = S(submission.Contact_Name, 120) || S(sig.typedName, 120);
        const typedName = S(sig.typedName, 120);
        // Time of record = the proxy's receipt time (server clock), never the browser's.
        const signedWhen = pacificText(audit.receivedAt) || pacificText(submission.Submitted_At) || S(sig.signedAtPacific, 60);
        const orderRef = S((Array.isArray(payload.fields) ? payload.fields : []).filter((f) => Array.isArray(f) && f[0] === 'Order / Quote #').map((f) => f[1])[0], 60);
        const repName = S(submission.Sales_Rep, 80);
        const repEmail = S(sig.repEmail, 160).toLowerCase();
        const repTo = repEmail.endsWith(STAFF_DOMAIN) ? repEmail : SHOP_EMAIL;
        const version = S(sig.waiverVersion, 20);
        const stamp = 'Electronically signed by ' + esc(typedName) + ' on ' + esc(signedWhen) + ' · Reference ' + esc(id) + (version ? ' · Waiver version ' + esc(version) : '');
        const wordingLink = PUBLIC_SITE_ORIGIN + PAGE_PATH;
        // The proxy hashed the text the browser said it signed; compare with the canonical wording we ship.
        const serverHash = S(audit.textSha256, 64).toLowerCase();
        const wordingMatches = !!(CANONICAL_SHA256 && serverHash && serverHash === CANONICAL_SHA256);
        if (CANONICAL_SHA256 && !wordingMatches) console.warn('[garment-waiver] ' + id + ': signed text hash ' + (serverHash || '(none)') + ' != canonical ' + CANONICAL_SHA256.slice(0, 12) + '…');

        // Rep notice first and independent of the customer copy — a signed waiver must never arrive unseen.
        const repNotice = sendEmailJSTemplate(TEMPLATE, {
            to_email: repTo,
            reply_to: S(submission.Email, 160),
            subject: 'Waiver signed: ' + customerName + (orderRef ? ' – ' + orderRef : '') + ' (' + id + ')',
            customer_name: repName || 'team',
            rep_name: 'Forms Inbox',
            rep_email: SHOP_EMAIL,
            message_html: messageBlock([
                esc(customerName) + (submission.Company && submission.Company !== customerName ? ' (' + esc(S(submission.Company, 160)) + ')' : '') + ' just signed the Customer-Supplied Garment Liability Waiver' + (orderRef ? ' for ' + esc(orderRef) : '') + '.',
                '<strong>' + stamp + '</strong>',
                wordingMatches
                    ? 'The wording they signed matches the current waiver text.'
                    : '<strong>Check the record:</strong> the wording stored with this signature does not match the current waiver text' + (CANONICAL_SHA256 ? '' : ' (canonical text unavailable on the server)') + '. Open the submission and read the "Waiver Text (as signed)" note before relying on it.',
                'The full record (typed name, drawn signature, garments listed, IP address and waiver text) is in the Forms Inbox under Waivers.',
            ], { href: PUBLIC_SITE_ORIGIN + '/dashboards/form-submissions.html', label: 'Open the Forms Inbox' }),
        }).catch((e) => console.error('[garment-waiver] rep notice failed for ' + id + ':', e && e.message));

        try {
            await sendEmailJSTemplate(TEMPLATE, {
                to_email: S(submission.Email, 160),
                reply_to: repTo,
                subject: 'Your signed garment waiver – ' + id + ' – Northwest Custom Apparel',
                customer_name: customerName,
                rep_name: repName || 'Northwest Custom Apparel',
                rep_email: repTo,
                message_html: messageBlock([
                    'Thank you — your Customer-Supplied Garment Liability Waiver is signed and on file' + (orderRef ? ' for ' + esc(orderRef) : '') + '. Keep this email as your copy.',
                    '<strong>' + stamp + '</strong>',
                    'The full wording you agreed to is the current waiver on our website, and the complete signed record (including the garments you listed) is kept with your order.',
                    'Questions? Reply to this email or call ' + SHOP_PHONE + '.',
                ], { href: wordingLink, label: 'Read the waiver wording' }),
            });
        } catch (e) {
            console.error('[garment-waiver] customer copy failed for ' + id + ':', e && e.message);
            await repNotice;
            return res.status(502).json({ error: 'Copy email failed — print this page for your records' });
        }
        remember(id);
        await repNotice;
        console.log('[garment-waiver] copy emailed for ' + id + ' -> ' + email + ' (rep notice -> ' + repTo + ', wording ' + (wordingMatches ? 'matches' : 'DIFFERS') + ')');
        res.json({ sent: true, wordingMatches });
    });
};
