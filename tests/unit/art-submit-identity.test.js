/**
 * art-submit-identity.test.js
 *
 * Locks the submitter-identity contract for the AE art submit forms.
 *
 * Why this exists: getSubmitterEmail() used to end in
 *   `return localStorage.getItem('userEmail') || 'ae@nwcustomapparel.com';`
 * Nobody owns ae@nwcustomapparel.com, so when the staff session was missing the
 * request saved under a bogus User_Email AND the AE's own confirmation email
 * went to a dead inbox. Steve still got his (his address is hardcoded in
 * sendNotificationEmails), which is why it went unnoticed for 14 requests
 * (found 2026-07-31: Sales_Rep "Taneisha Clark" + User_Email "ae@...").
 *
 * An unidentified staffer must now resolve to '' so handleSubmit() blocks with
 * a visible error instead of writing a mislabeled record — Erik's #1 rule.
 *
 * The identical edit was applied to the three sibling forms (Rule 8):
 * sticker-banner-submit-form.js, jds-submit-form.js, mockup-submit-form.js.
 * The `no stand-in inbox` test below greps all four so none can regress.
 */

const fs = require('fs');
const path = require('path');

global.window = {};
var GarmentSubmitForm = require('../../shared_components/js/garment-submit-form.js');

const FORMS = [
    'garment-submit-form.js',
    'sticker-banner-submit-form.js',
    'jds-submit-form.js',
    'mockup-submit-form.js'
];

function identityWith({ staffAuth, appConfigUser, storedEmail }) {
    if (staffAuth) global.StaffAuthHelper = staffAuth;
    else delete global.StaffAuthHelper;
    global.window = appConfigUser ? { APP_CONFIG: { USER: appConfigUser } } : {};
    global.localStorage = { getItem: (k) => (k === 'userEmail' ? (storedEmail || null) : null) };
    return GarmentSubmitForm._getSubmitterIdentityForTest();
}

describe('AE art submit — submitter identity', () => {
    afterAll(() => {
        delete global.StaffAuthHelper;
        delete global.localStorage;
        delete global.window;
    });

    test('signed-in staffer resolves to their real session identity', () => {
        const id = identityWith({
            staffAuth: {
                getLoggedInStaffEmail: () => 'ruth@nwcustomapparel.com',
                getLoggedInStaffName: () => 'Ruth Nhoung'
            }
        });
        expect(id.email).toBe('ruth@nwcustomapparel.com');
        expect(id.name).toBe('Ruth Nhoung');
    });

    test('falls back to APP_CONFIG.USER when StaffAuthHelper has no session', () => {
        const id = identityWith({
            staffAuth: { getLoggedInStaffEmail: () => null, getLoggedInStaffName: () => null },
            appConfigUser: { email: 'nika@nwcustomapparel.com', name: 'Nika Lao' }
        });
        expect(id.email).toBe('nika@nwcustomapparel.com');
        expect(id.name).toBe('Nika Lao');
    });

    test('falls back to a stored userEmail, deriving the name from the local part', () => {
        const id = identityWith({ storedEmail: 'taneisha@nwcustomapparel.com' });
        expect(id.email).toBe('taneisha@nwcustomapparel.com');
        expect(id.name).toBe('Taneisha');
    });

    // The regression this file exists for.
    test('unidentified staffer resolves to empty — never a stand-in inbox', () => {
        const id = identityWith({});
        expect(id.email).toBe('');
        expect(id.name).toBe('');
        // The old bug shape: a truthy address that passes handleSubmit's guard
        // and gets written to User_Email.
        expect(id.email).not.toBe('ae@nwcustomapparel.com');
    });

    test('no submit form hardcodes a stand-in submitter inbox', () => {
        const offenders = FORMS.filter((f) => {
            const src = fs.readFileSync(
                path.join(__dirname, '..', '..', 'shared_components', 'js', f), 'utf8'
            );
            // Allowed inside comments explaining the bug; banned as a value the
            // code can actually return (i.e. after `||` in the fallback chain).
            return /\|\|\s*['"]ae@nwcustomapparel\.com['"]/.test(src);
        });
        expect(offenders).toEqual([]);
    });

    test('all four submit forms block submit when the submitter is unknown', () => {
        const missing = FORMS.filter((f) => {
            const src = fs.readFileSync(
                path.join(__dirname, '..', '..', 'shared_components', 'js', f), 'utf8'
            );
            return !/if\s*\(!getSubmitterEmail\(\)\)/.test(src);
        });
        expect(missing).toEqual([]);
    });
});

/**
 * The art-intake pages must not embed a Caspio DataPage submission form.
 *
 * A DataPage writes STRAIGHT into the ArtRequests table, so it never calls
 * POST /api/artrequests — where both submission notifications live (the
 * #art-notifications Slack post in the proxy's art.js, and the EmailJS send to
 * Steve + the submitting AE). Requests made that way land in Steve's queue with
 * nobody told. That is precisely how Ruth's jobs went unannounced for months
 * (diagnosed 2026-07-31, embed removed 2026-08-01).
 *
 * ⚠ These assertions cover OUR HTML only. Deleting an embed does not disable the
 * DataPage — it stays live at its direct c3eku948.caspio.com URL until a Caspio
 * admin disables it, which no test can verify. Re-run
 * `node scripts/art-request-source-audit.js` to catch rows still arriving off-path.
 */
describe('art intake pages — no DataPage submission bypass', () => {
    const REPO = path.join(__dirname, '..', '..');

    // Every Caspio WEBFORM that wrote ArtRequests and has since been replaced by
    // the API-backed forms. All THREE are still live in Caspio at their direct
    // c3eku948.caspio.com URLs (probed 2026-08-01) — un-embedding them from our
    // pages did not disable them. This test only stops us re-wiring one.
    const RETIRED_SUBMISSION_DATAPAGES = [
        'a0e1500073092d827fb74d968d9d', // "Artist-Steve's Express Art Request Form" — pulled 2026-08-01
        'a0e150009f0e9f9d4ff3457dae47', // "AE Submit Form Art to Steve 2026" — replaced by GarmentSubmitForm 2026-06-17
        'a0e15000b16eb864a2924121b1fd'  // "Ruth - AE Request Form" — replaced by MockupSubmitForm
    ];

    // Pages where an AE or Steve can create an art request.
    const INTAKE_PAGES = [
        'dashboards/art-hub-steve.html',
        'dashboards/ae-dashboard.html'
    ];

    test.each(INTAKE_PAGES)('%s embeds no Caspio DataPage', (page) => {
        const src = fs.readFileSync(path.join(REPO, page), 'utf8');
        // Match only a live <script src=...>, so comments naming a retired id
        // stay legal.
        const embeds = src.match(/<script[^>]+src=["'][^"']*caspio\.com\/dp\/[^"']*["']/gi) || [];
        expect(embeds).toEqual([]);
    });

    test('no retired submission DataPage is wired up from any .html or .js', () => {
        // Scans .js as well as .html on purpose: a DataPage does not need a
        // <script> tag to go live. shared_components/js/ae-dashboard.js:249,262
        // loads DataPages by assigning `iframe.src`, and an HTML-only check
        // would wave that straight through.
        //
        // The signal is the id inside a caspio /dp/ URL — i.e. actually wired.
        // A bare id in prose (ae-dashboard.html:158, garment-submit-form.js:4,
        // and the retirement notice in art-hub-steve.html all name one) is
        // documentation and stays legal.
        const offenders = [];
        const urlPattern = new RegExp(
            `caspio\\.com/dp/(${RETIRED_SUBMISSION_DATAPAGES.join('|')})`, 'i'
        );
        const walk = (dir) => {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (entry.isDirectory()) {
                    // Skip history, dependencies, and other sessions' checkouts.
                    if (['node_modules', '.git', 'archive', '.claude', 'coverage'].includes(entry.name)) continue;
                    walk(path.join(dir, entry.name));
                } else if (/\.(html|js)$/i.test(entry.name)) {
                    const full = path.join(dir, entry.name);
                    const m = urlPattern.exec(fs.readFileSync(full, 'utf8'));
                    if (m) offenders.push(`${path.relative(REPO, full)} -> ${m[1]}`);
                }
            }
        };
        walk(REPO);
        expect(offenders).toEqual([]);
    });
});
