/**
 * routes/garment-waiver.js (2026-09-15) — behaviour with the transport mocked.
 *   send-link: staff builds the prefilled e-sign link server-side (canonical shape), emails it through the
 *   waiver template, refuses bad input, reports EmailJS failures with the link so the rep can still send it.
 *   signed: only emails after the proxy confirms the row is a FRESH garment-waiver whose stored Email matches
 *   the body; the emails carry no customer-typed free text and stamp the SERVER receipt time; the rep notice
 *   goes out independently of the customer copy and flags a stored wording that differs from the canonical
 *   text; rep address must be an nwcustomapparel.com mailbox; one send per id, the duplicate answer only for
 *   the row's owner.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MODULE = path.join(__dirname, '../../routes/garment-waiver.js');
const CANONICAL = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '../../pages/forms/garment-liability-waiver.txt'), 'utf8').replace(/\s+/g, ' ').trim()).digest('hex');

function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function load(opts = {}) {
    delete require.cache[MODULE];
    const routes = {};
    const app = { post: (p, ...handlers) => { routes[p] = { chain: handlers.slice(0, -1), handler: handlers[handlers.length - 1] }; } };
    const sends = [];
    const fetches = [];
    const ctx = {
        CRM_API_BASE: 'https://proxy.example.test',
        PUBLIC_SITE_ORIGIN: 'https://www.teamnwca.com',
        SERVER_DIR: path.join(__dirname, '../..'),
        crypto, fs, path,
        escapeHTMLSrv: esc,
        fetch: async (url, init) => { fetches.push({ url, init }); return opts.fetchImpl ? opts.fetchImpl(url, init) : { ok: true, status: 200, json: async () => ({}) }; },
        rateLimit: (o) => ({ limiter: o }),
        requireStaff: 'requireStaff',
        sendEmailJSTemplate: async (template, params) => {
            sends.push({ template, params });
            if (opts.sendFail === true || (typeof opts.sendFail === 'function' && opts.sendFail(params))) throw new Error('EmailJS HTTP 400: template not found');
            return true;
        },
        withProxySecret: (h) => ({ ...h, 'x-crm-api-secret': 'secret' }),
    };
    require(MODULE)(app, ctx);
    return { routes, sends, fetches };
}

function res() {
    const out = { statusCode: 200, headers: {}, body: null };
    out.set = (k, v) => { out.headers[k] = v; return out; };
    out.status = (c) => { out.statusCode = c; return out; };
    out.json = (b) => { out.body = b; return out; };
    return out;
}
const staffReq = (body) => ({ body, session: { crmUser: { name: 'Nika Lao', email: 'nika@nwcustomapparel.com' } } });

beforeEach(() => { process.env.EMAILJS_PUBLIC_KEY = 'pub'; process.env.EMAILJS_PRIVATE_KEY = 'priv'; delete process.env.EMAILJS_TEMPLATE_GARMENT_WAIVER; });

describe('POST /api/garment-waiver/send-link', () => {
    test('staff-gated, builds the canonical prefilled link server-side and emails it through the waiver template', async () => {
        const { routes, sends } = load();
        expect(routes['/api/garment-waiver/send-link'].chain[0]).toBe('requireStaff');
        const r = res();
        await routes['/api/garment-waiver/send-link'].handler(staffReq({
            to: 'Taylor@Example.test ', customerName: 'Taylor Example', company: 'ACME Roofing', phone: '253-555-0142', orderRef: 'WO 143001',
            garments: '12 Carhartt J130 jackets, brown', count: '12', rep: '', methods: ['emb', 'bogus', 'scr'],
        }), r);
        expect(r.statusCode).toBe(200);
        expect(r.body.sent).toBe(true);
        expect(r.body.link).toBe('https://www.teamnwca.com/pages/forms/garment-liability-waiver.html?c=ACME+Roofing&n=Taylor+Example&e=taylor%40example.test&p=253-555-0142&o=WO+143001&g=12+Carhartt+J130+jackets%2C+brown&q=12&r=Nika+Lao&re=nika%40nwcustomapparel.com&m=emb%2Cscr');
        expect(sends).toHaveLength(1);
        expect(sends[0].template).toBe('template_garment_waiver');
        expect(sends[0].params).toMatchObject({ to_email: 'taylor@example.test', reply_to: 'nika@nwcustomapparel.com', customer_name: 'Taylor Example', rep_name: 'Nika Lao', rep_email: 'nika@nwcustomapparel.com' });
        expect(sends[0].params.subject).toBe('Please sign: Customer-Supplied Garment Waiver – WO 143001 – Northwest Custom Apparel');
        expect(sends[0].params.message_html).toContain('href="' + esc(r.body.link) + '"');
        expect(sends[0].params.message_html).toContain('Read &amp; sign the waiver');
        expect(sends[0].params.message_html).not.toContain('&amp;amp;');
        expect(r.headers['Cache-Control']).toBe('no-store');
    });

    test('rejects a bad email or missing name, and 503s with no keys instead of faking success', async () => {
        const { routes, sends } = load();
        let r = res();
        await routes['/api/garment-waiver/send-link'].handler(staffReq({ to: 'not-an-email', customerName: 'T' }), r);
        expect(r.statusCode).toBe(400);
        r = res();
        await routes['/api/garment-waiver/send-link'].handler(staffReq({ to: 't@example.test', customerName: '' }), r);
        expect(r.statusCode).toBe(400);
        delete process.env.EMAILJS_PRIVATE_KEY;
        r = res();
        await routes['/api/garment-waiver/send-link'].handler(staffReq({ to: 't@example.test', customerName: 'T' }), r);
        expect(r.statusCode).toBe(503);
        expect(sends).toHaveLength(0);
    });

    test('an EmailJS failure is a visible 502 that still hands the rep the link', async () => {
        const { routes } = load({ sendFail: true });
        const r = res();
        await routes['/api/garment-waiver/send-link'].handler(staffReq({ to: 't@example.test', customerName: 'Taylor' }), r);
        expect(r.statusCode).toBe(502);
        expect(r.body.error).toMatch(/^Email failed \(EmailJS HTTP 400/);
        expect(r.body.link).toMatch(/^https:\/\/www\.teamnwca\.com\/pages\/forms\/garment-liability-waiver\.html\?/);
    });

    test('a template override env var wins', async () => {
        process.env.EMAILJS_TEMPLATE_GARMENT_WAIVER = 'template_custom_waiver';
        const { routes, sends } = load();
        await routes['/api/garment-waiver/send-link'].handler(staffReq({ to: 't@example.test', customerName: 'Taylor' }), res());
        expect(sends[0].template).toBe('template_custom_waiver');
    });
});

describe('POST /api/garment-waiver/signed', () => {
    const RECEIVED = '2026-09-15T18:22:10.000Z'; // 11:22 AM PDT
    const row = (over = {}, payloadOver = {}) => ({
        Submission_ID: 'GLW0915-1234', Form_ID: 'garment-waiver', Company: 'ACME Roofing', Contact_Name: 'Taylor Example', Email: 'taylor@example.test',
        Sales_Rep: 'Nika Lao', Submitted_At: new Date(Date.now() - 30 * 1000).toISOString(),
        Payload_JSON: JSON.stringify({
            fields: [['Order / Quote #', 'WO 143001']],
            notes: [['Garments Supplied', '12 jackets <script>alert(1)</script>'], ['Waiver Text (as signed)', 'Customer-Supplied Garment Liability Waiver <terms>']],
            signature: { typedName: 'Taylor Example', signedAtPacific: '1/1/2000 1:00 AM PT', waiverVersion: '2026-09-15', repEmail: 'nika@nwcustomapparel.com' },
            audit: { ip: '203.0.113.9', receivedAt: RECEIVED, textSha256: CANONICAL },
            ...payloadOver,
        }),
        ...over,
    });
    const proxyOk = (r) => async () => ({ ok: true, status: 200, json: async () => ({ submission: r }) });

    test('confirms a fresh owned row, notifies the rep, emails the customer copy without free text, stamps the SERVER time, once', async () => {
        const { routes, sends, fetches } = load({ fetchImpl: proxyOk(row()) });
        expect(routes['/api/garment-waiver/signed'].chain).toHaveLength(1); // the limiter only — the global JSON parser has already run
        const r = res();
        await routes['/api/garment-waiver/signed'].handler({ body: { submissionId: 'GLW0915-1234', email: 'Taylor@example.test' } }, r);
        expect(fetches[0].url).toBe('https://proxy.example.test/api/form-submissions/GLW0915-1234');
        expect(fetches[0].init.headers['x-crm-api-secret']).toBe('secret');
        expect(r.statusCode).toBe(200);
        expect(r.body).toEqual({ sent: true, wordingMatches: true });
        expect(sends).toHaveLength(2);
        const rep = sends[0].params, customer = sends[1].params;
        expect(rep).toMatchObject({ to_email: 'nika@nwcustomapparel.com', reply_to: 'taylor@example.test', subject: 'Waiver signed: Taylor Example – WO 143001 (GLW0915-1234)' });
        expect(rep.message_html).toContain('https://www.teamnwca.com/dashboards/form-submissions.html');
        expect(rep.message_html).toContain('matches the current waiver text');
        expect(customer).toMatchObject({ to_email: 'taylor@example.test', reply_to: 'nika@nwcustomapparel.com', subject: 'Your signed garment waiver – GLW0915-1234 – Northwest Custom Apparel', customer_name: 'Taylor Example' });
        // the server receipt time is the time of record — never the browser's clock
        expect(customer.message_html).toContain('Electronically signed by Taylor Example on 9/15/2026 11:22 AM PT · Reference GLW0915-1234 · Waiver version 2026-09-15');
        expect(customer.message_html).not.toContain('1/1/2000');
        expect(customer.message_html).toContain('https://www.teamnwca.com/pages/forms/garment-liability-waiver.html');
        // nothing the anonymous submitter typed is echoed into an NWCA-branded email
        for (const html of [rep.message_html, customer.message_html]) { expect(html).not.toContain('terms'); expect(html).not.toContain('jackets'); }
        // second call for the same id sends nothing more
        const r2 = res();
        await routes['/api/garment-waiver/signed'].handler({ body: { submissionId: 'GLW0915-1234', email: 'taylor@example.test' } }, r2);
        expect(r2.body).toEqual({ sent: false, duplicate: true });
        expect(sends).toHaveLength(2);
        // …and a stranger asking about that id still gets the same not-found answer, not the duplicate hint
        const r3 = res();
        await routes['/api/garment-waiver/signed'].handler({ body: { submissionId: 'GLW0915-1234', email: 'stranger@example.test' } }, r3);
        expect(r3.statusCode).toBe(404);
    });

    test('a stored wording that differs from the canonical text is flagged to the rep but never blocks the customer', async () => {
        const { routes, sends } = load({ fetchImpl: proxyOk(row({}, { audit: { ip: '203.0.113.9', receivedAt: RECEIVED, textSha256: 'deadbeef' } })) });
        const r = res();
        await routes['/api/garment-waiver/signed'].handler({ body: { submissionId: 'GLW0915-1234', email: 'taylor@example.test' } }, r);
        expect(r.body).toEqual({ sent: true, wordingMatches: false });
        expect(sends[0].params.message_html).toContain('Check the record');
        expect(sends[1].params.to_email).toBe('taylor@example.test');
    });

    test('refuses a mismatched email, a non-waiver row, a stale row, a missing row and a malformed id — nothing is sent', async () => {
        let h = load({ fetchImpl: proxyOk(row()) });
        let r = res();
        await h.routes['/api/garment-waiver/signed'].handler({ body: { submissionId: 'GLW0915-1234', email: 'someone-else@example.test' } }, r);
        expect(r.statusCode).toBe(404); expect(h.sends).toHaveLength(0);

        h = load({ fetchImpl: proxyOk(row({ Form_ID: 'quote-request' })) });
        r = res();
        await h.routes['/api/garment-waiver/signed'].handler({ body: { submissionId: 'GLW0915-1234', email: 'taylor@example.test' } }, r);
        expect(r.statusCode).toBe(404); expect(h.sends).toHaveLength(0);

        h = load({ fetchImpl: proxyOk(row({ Submitted_At: new Date(Date.now() - 2 * 3600 * 1000).toISOString() })) });
        r = res();
        await h.routes['/api/garment-waiver/signed'].handler({ body: { submissionId: 'GLW0915-1234', email: 'taylor@example.test' } }, r);
        expect(r.statusCode).toBe(404); expect(h.sends).toHaveLength(0);

        h = load({ fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({ error: 'nope' }) }) });
        r = res();
        await h.routes['/api/garment-waiver/signed'].handler({ body: { submissionId: 'GLW0915-1234', email: 'taylor@example.test' } }, r);
        expect(r.statusCode).toBe(404); expect(h.sends).toHaveLength(0);

        h = load();
        r = res();
        await h.routes['/api/garment-waiver/signed'].handler({ body: { submissionId: 'QRQ0915-1234', email: 'taylor@example.test' } }, r);
        expect(r.statusCode).toBe(400); expect(h.fetches).toHaveLength(0);
    });

    test('a rep address outside nwcustomapparel.com falls back to the shop mailbox; a customer-copy failure is a 502 but the rep is still told', async () => {
        let h = load({ fetchImpl: proxyOk(row({}, { signature: { typedName: 'Taylor Example', repEmail: 'evil@attacker.test' } })) });
        let r = res();
        await h.routes['/api/garment-waiver/signed'].handler({ body: { submissionId: 'GLW0915-1234', email: 'taylor@example.test' } }, r);
        expect(h.sends[0].params.to_email).toBe('sales@nwcustomapparel.com');
        expect(h.sends[1].params.reply_to).toBe('sales@nwcustomapparel.com');

        h = load({ fetchImpl: proxyOk(row({ Submission_ID: 'GLW0915-9999' })), sendFail: (params) => params.to_email === 'taylor@example.test' });
        r = res();
        await h.routes['/api/garment-waiver/signed'].handler({ body: { submissionId: 'GLW0915-9999', email: 'taylor@example.test' } }, r);
        expect(r.statusCode).toBe(502);
        expect(r.body.error).toMatch(/print this page/);
        expect(h.sends.map((s) => s.params.to_email)).toEqual(['nika@nwcustomapparel.com', 'taylor@example.test']); // rep notice went first, independently
    });
});
