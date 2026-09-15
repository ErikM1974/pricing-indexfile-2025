/**
 * Customer-Supplied Garment Liability Waiver (2026-09-15) — source locks.
 *   Page: printable-forms family, honeypot, consent + typed name + canvas, sign flow posts formId
 *   garment-waiver through APP_CONFIG (no hardcoded host), the waiver version in the HTML matches the
 *   controller, the text never offers DTG, no bare icons, no inline code, versioned assets.
 *   Forms Inbox: Waivers chip, badge, statuses (never 'Completed'), guarded drawn-signature render.
 *   Server: the two email routes are registered and locked in the route table; the proxy formId lives
 *   in the sibling repo (tests/jest/form-submissions-cardstrip.test.js there).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const BARE = /<i class="(?:fa[sr]|fa-solid|fa-regular) [^"]*"><\/i>/;
const BARE_DYN = /<i class="fas ' \+/;
const noComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const html = read('pages/forms/garment-liability-waiver.html').replace(/<!--[\s\S]*?-->/g, '');
const js = read('pages/forms/garment-liability-waiver.js');
const css = read('pages/forms/garment-liability-waiver.css');
const route = read('routes/garment-waiver.js');
const manifest = JSON.parse(read('scripts/css/migration-manifest.json'));

describe('waiver page', () => {
    test('printable-forms family, shared foundations in order, versioned assets, no inline code', () => {
        expect(html).toMatch(/<body data-ui="unified" data-form="printable" data-waiver="garment">/);
        const links = [...html.matchAll(/<link rel="stylesheet" href="(\/[^"?]+)/g)].map((m) => m[1]);
        expect(links).toEqual(['/shared_components/css/tokens.css', '/shared_components/css/components.css', '/shared_components/css/printable-forms.css', '/pages/forms/garment-liability-waiver.css']);
        expect(html).toMatch(/garment-liability-waiver\.(css|js)\?v=2026\.09\./);
        expect(html).toMatch(/nwca-form-shared\.js\?v=2026\.09\./);
        expect(html).not.toMatch(/<style|<script>|onclick=|style="/);
        expect(html).not.toMatch(BARE);
        expect(js).not.toMatch(BARE_DYN);
        expect(noComments(js)).not.toMatch(/console\.log\(/);
        expect(css).toMatch(/^@layer components\.pages \{/);
        expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    });

    test('customer flow: honeypot, required identity, consent, typed name, drawable canvas, signed panel, print', () => {
        expect(html).toMatch(/<div class="hp-wrap" aria-hidden="true"><label for="hpWebsite">Website<\/label><input type="text" id="hpWebsite" tabindex="-1" autocomplete="off"><\/div>/);
        for (const id of ['fldCompany', 'fldContact', 'fldEmail', 'fldPhone', 'fldOrderRef', 'fldRep', 'fldRepEmail', 'fldGarments', 'fldCount', 'fldSignedName', 'fldSignDate', 'chkAgree', 'sigPad', 'clearSigBtn', 'signWaiverBtn', 'signedPanel', 'signedRef', 'signedCopyNote', 'sigStamp', 'printSignedBtn', 'clearFormBtn', 'printFormBtn', 'staffSendPanel', 'emailLinkBtn', 'copyLinkBtn', 'customerLinkPreview']) {
            expect(html).toContain('id="' + id + '"');
        }
        expect(html).toMatch(/<canvas id="sigPad" class="sig-pad" role="img" aria-labelledby="sigPadLabel" aria-describedby="sigPadHelp">/);
        expect(html).toMatch(/<input type="text" id="fldSignDate" readonly>/);
        expect(html).toMatch(/<section class="staff-send-panel no-print" id="staffSendPanel" hidden/);
        expect(html).toMatch(/<section class="signed-panel no-print" id="signedPanel" hidden tabindex="-1"/);
        expect(html).toMatch(/<p class="sig-stamp" id="sigStamp" hidden><\/p>/);
        expect(js).toMatch(/var FORM_ID = 'garment-waiver';/);
        expect(js).toMatch(/formId: FORM_ID,/);
        expect(js).toMatch(/hp: val\('hpWebsite'\),/);
        expect(js).toMatch(/fetch\(base \+ '\/api\/form-submissions'/);
        expect(js).toMatch(/APP_CONFIG\.API\.BASE_URL/);
        expect(js).not.toMatch(/herokuapp\.com|teamnwca\.com/);
        expect(js).toMatch(/if \(!checked\('chkAgree'\)\) return fail\(/);
        expect(js).toMatch(/if \(!name\) return fail\(/);
        expect(js).toMatch(/toDataURL\('image\/png'\)/);
        expect(js).toMatch(/var MAX_DRAWN_CHARS = 30000;/);
        expect(js).toMatch(/timeZone: 'America\/Los_Angeles'/);
        expect(js).toMatch(/textSha256: hash,/);
        expect(js).toMatch(/\['Waiver Text \(as signed\)', text\]/);
        expect(js).toMatch(/onSigned\(data\.submissionId \|\| '', name, serverStamp\(data\.receivedAt\) \|\| when, email\);/);
        expect(js).toMatch(/pair\[1\] === 'fldOrderRef' \|\| pair\[1\] === 'fldRep'\)\) el\.readOnly = true;/);
        expect(js).toMatch(/fetch\('\/api\/garment-waiver\/signed'/);
        expect(js).toMatch(/fetch\('\/api\/garment-waiver\/send-link'/);
        expect(js).toMatch(/could not email your copy just now/);
        expect(js).toMatch(/if \(resp\.status === 404\) throw Object\.assign\(new Error\('not on file'\), \{ notFound: true \}\);/);
        expect(js).not.toMatch(/NWCAForm\.autosave/); // no localStorage draft of customer PII on a shared device
        expect(js).toContain('var EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;'); // same rule as routes/garment-waiver.js
        expect(js).toMatch(/window\.addEventListener\('beforeprint', resize\);/);
    });

    test('waiver text: version matches the controller, policy facts present, DTG never offered', () => {
        const version = js.match(/var WAIVER_VERSION = '(\d{4}-\d{2}-\d{2})';/)[1];
        expect(html).toContain('Waiver version ' + version);
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
        expect(text).toMatch(/limited to the cost of the decoration service|the cost of the decoration service for that item/);
        expect(text).toMatch(/up to 3 may be misprinted or damaged/);
        expect(text).toMatch(/within 7 days of pickup/);
        expect(text).toMatch(/laws of the State of Washington/);
        expect(text).toMatch(/ESIGN Act/);
        expect(text).toMatch(/receiving count is the count of record/);
        expect(text).not.toMatch(/\bDTG\b|direct-to-garment/i);
        // the canonical copy the server hashes against is exactly the wording the customer sees
        const { JSDOM } = require('jsdom');
        const shown = new JSDOM(read('pages/forms/garment-liability-waiver.html')).window.document.getElementById('waiverText').textContent.replace(/\s+/g, ' ').trim();
        expect(read('pages/forms/garment-liability-waiver.txt').replace(/\s+/g, ' ').trim()).toBe(shown);
        expect(route).toMatch(/garment-liability-waiver\.txt/);
    });

    test('registered in the CSS manifest with its real styles and a printable-forms content lock', () => {
        const pilot = manifest.pilots.find((p) => p.source === 'pages/forms/garment-liability-waiver.html');
        expect(pilot).toBeTruthy();
        expect(pilot.family).toBe('printable-forms');
        expect(pilot.styles).toEqual(['shared_components/css/tokens.css', 'shared_components/css/components.css', 'shared_components/css/printable-forms.css', 'pages/forms/garment-liability-waiver.css']);
        expect(pilot.test).toBe('tests/e2e/css-unification-printable-forms.spec.js');
        expect(manifest.printableFormsContent.find((p) => p.source === 'pages/forms/garment-liability-waiver.html')).toMatchObject({ blankPrintPages: 2 });
    });
});

describe('forms inbox: waivers', () => {
    const inboxHtml = read('dashboards/form-submissions.html').replace(/<!--[\s\S]*?-->/g, '');
    const inboxJs = read('dashboards/js/form-submissions.js');
    const inboxCss = read('shared_components/css/crm-records.css');
    test('badge, chip, statuses and guarded drawn-signature render', () => {
        expect(inboxJs).toMatch(/'garment-waiver': \{ label: 'Waiver', icon: 'fa-file-signature', cls: 'badge--wvr' \},/);
        expect(inboxJs).toMatch(/'garment-waiver': \['Signed', 'Attached to Order', 'Archived'\],/);
        expect(inboxJs).toMatch(/'Signed': 'status--new',/);
        expect(inboxJs).toMatch(/'Attached to Order': 'status--done',/);
        expect(inboxJs).toMatch(/function isSafePngDataUrl\(value\) \{\s*return typeof value === 'string' && value\.length <= 60000 && \/\^data:image\\\/png;base64,\[A-Za-z0-9\+\/\]\+=\*\$\/\.test\(value\);/);
        expect(inboxJs).toMatch(/if \(isSafePngDataUrl\(sig\.drawn\)\) \{/);
        expect(inboxJs).toMatch(/\['IP address \(server\)', audit\.ip\]/);
        expect(inboxJs).toMatch(/\['Browser \(server\)', audit\.userAgent\], \['Browser \(device-reported\)', sig\.userAgent\]/);
        expect(inboxHtml).toMatch(/<button type="button" class="inbox-chip btn" data-form="garment-waiver" aria-pressed="false">Waivers<\/button>/);
        expect(inboxHtml).toMatch(/<option>Signed<\/option>\s*<option>Attached to Order<\/option>\s*<option>Archived<\/option>/);
        expect(inboxCss).toMatch(/\.badge--wvr \{/);
        expect(inboxCss).toMatch(/\.detail-signature-img \{/);
    });
});

describe('server: waiver email routes', () => {
    test('registered after the quote-delete routes and locked in the route table', () => {
        const server = read('server.js');
        expect(server).toMatch(/require\('\.\/routes\/quote-delete'\)\(app, ctx\); \}\r?\n\/\/ Customer-Supplied Garment Liability Waiver emails[^\n]*\r?\n\{ const ctx = \{ CRM_API_BASE, PUBLIC_SITE_ORIGIN, SERVER_DIR: __dirname, crypto, escapeHTMLSrv, fetch, fs, path, rateLimit, requireStaff, sendEmailJSTemplate, withProxySecret \}; require\('\.\/routes\/garment-waiver'\)\(app, ctx\); \}/);
        // route modules never declare module-level requires: the test helper inlines them into server.js as one source
        expect(route).not.toMatch(/^const (fs|path|crypto) = require/m);
        const table = JSON.parse(read('tests/fixtures/server-route-table.json'));
        expect(table).toContain('post /api/garment-waiver/send-link [requireStaff, sendLinkLimiter] (nested)');
        expect(table).toContain('post /api/garment-waiver/signed [signedLimiter] (nested)');
        // Admin-only Forms_Library writes from a signed-in browser (how the waiver row was added, 2026-09-15).
        expect(table).toContain("all /api/crm-proxy/forms-library* [...createCrmProxy('forms-library', ['admin'])]");
        expect(read('routes/crm-proxy.js')).toMatch(/app\.all\('\/api\/crm-proxy\/forms-library\*', \.\.\.createCrmProxy\('forms-library', \['admin'\]\)\);/);
        expect(route).toMatch(/process\.env\.EMAILJS_TEMPLATE_GARMENT_WAIVER \|\| 'template_garment_waiver'/);
        expect(route).toMatch(/if \(!emailReady\(\)\) return res\.status\(503\)/);
        expect(route).not.toMatch(/herokuapp\.com/);
    });
});
