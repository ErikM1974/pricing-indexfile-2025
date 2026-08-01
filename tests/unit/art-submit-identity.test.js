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
