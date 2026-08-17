/**
 * forms-staff-only.test.js — the staff-only allowlist inside the public /forms tree.
 *
 * WHY THIS EXISTS
 * 2026-08-17: the Business Credit Application (No Personal Guaranty) shipped into
 * /forms/, which is a PUBLIC express.static mount — anyone who guessed the URL got
 * NWCA's credit paperwork. Erik asked for it to be staff-only.
 *
 * The first cut of the gate compared req.path to the filename with string equality
 * and looked correct. It was measured serving the complete PDF, 200 and anonymous,
 * to `/forms/<file>.pdf::$DATA` — Win32 opens a file's default NTFS data stream
 * under that name, so serve-static happily returned all 321,188 bytes while the
 * gate saw a string it didn't recognise. Dot-segments (`/forms/x/../<file>.pdf`)
 * are the same class and DO apply on Linux, where production runs.
 *
 * So these tests pin three things that must never drift apart:
 *   1. every URL spelling that resolves to a gated file collapses to the same key,
 *   2. the gate is registered ABOVE the static mount — ordering IS the security
 *      property here, exactly as for /dashboards, /tools and /admin, and
 *   3. the rest of /forms stays PUBLIC. Over-gating is a real failure too: the
 *      Employee Handbook and the meal-period waiver are opened by employees who
 *      are not signed in, and the drop-off form by customers. A gate that quietly
 *      swallowed those would bounce them into a staff SSO they cannot complete.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const SERVER = fs.readFileSync(path.join(REPO, 'server.js'), 'utf8');

/** Pull a top-level function's real source out of server.js by brace matching. */
function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}(`);
    if (start === -1) throw new Error(`${name} not found in server.js`);
    let depth = 0;
    for (let i = source.indexOf('{', start); i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error(`unbalanced braces reading ${name}`);
}

/** Pull the real allowlist declaration, so the test uses the SHIPPING list. */
function extractAllowlist(source) {
    const start = source.indexOf('const STAFF_ONLY_FORMS = new Set([');
    if (start === -1) throw new Error('STAFF_ONLY_FORMS not found in server.js');
    const end = source.indexOf(']);', start);
    if (end === -1) throw new Error('unterminated STAFF_ONLY_FORMS');
    return source.slice(start, end + 3);
}

/**
 * Instantiate the REAL gate + REAL allowlist so behaviour is tested, not spelling.
 * requireStaff is injected as a spy: reaching it IS the "gated" outcome, and its
 * own redirect/401 behaviour is already covered by detail-page-gate.test.js.
 */
function loadGate() {
    const calls = { gated: 0 };
    const requireStaff = () => { calls.gated++; };
    const src = `${extractAllowlist(SERVER)}\n${extractFunction(SERVER, 'gateStaffOnlyForms')}\nreturn gateStaffOnlyForms;`;
    // eslint-disable-next-line no-new-func
    const gate = new Function('requireStaff', src)(requireStaff);
    return { gate, calls };
}

/** Run one request path through the gate. Returns 'gated' | 'public'. */
function ask(urlPath) {
    const { gate, calls } = loadGate();
    let nexted = false;
    // req.path inside app.use('/forms', …) is stripped of the mount prefix.
    gate({ path: urlPath }, {}, () => { nexted = true; });
    if (calls.gated === 1 && !nexted) return 'gated';
    if (calls.gated === 0 && nexted) return 'public';
    throw new Error(`gate did neither/both for ${urlPath}`);
}

const FILE = 'business-credit-application-no-personal-guaranty.pdf';

describe('gateStaffOnlyForms — the gated file, however it is spelled', () => {
    test('the allowlist actually contains the credit application', () => {
        expect(extractAllowlist(SERVER)).toContain(FILE);
    });

    // Lives at forms/policies/…, so this also pins that a NESTED file is covered
    // — the basename match is what makes that work, and it is easy to "tidy" away.
    test('the card authorization PDF is gated from its real nested path', () => {
        expect(extractAllowlist(SERVER)).toContain('credit-card-authorization.pdf');
        expect(ask('/policies/credit-card-authorization.pdf')).toBe('gated');
        expect(ask('/policies/credit-card-authorization.pdf::$DATA')).toBe('gated');
    });

    test.each([
        ['plain',                     `/${FILE}`],
        ['uppercase',                 `/${FILE.toUpperCase()}`],
        ['mixed case',                '/Business-Credit-Application-No-Personal-Guaranty.pdf'],
        ['double slash',              `//${FILE}`],
        ['dot segment',               `/./${FILE}`],
        ['traversal from sibling',    `/policies/../${FILE}`],
        ['double traversal',          `/x/y/../../${FILE}`],
        ['backslash separator',       `\\${FILE}`],
        ['NTFS data stream',          `/${FILE}::$DATA`],
        ['NTFS index stream',         `/${FILE}:$i30:$INDEX_ALLOCATION`],
        ['Win32 trailing dot',        `/${FILE}.`],
        ['Win32 trailing space',      `/${FILE} `],
        ['traversal + stream',        `/subdir/../${FILE}::$DATA`],
        ['same name in a subfolder',  `/policies/${FILE}`],
    ])('%s → gated', (_label, urlPath) => {
        expect(ask(urlPath)).toBe('gated');
    });

    test('a malformed percent-escape does not throw (decode failure falls back)', () => {
        expect(() => ask('/%E0%A4%A.pdf')).not.toThrow();
    });
});

describe('gateStaffOnlyForms — the rest of /forms stays PUBLIC', () => {
    // These are opened by people who are NOT signed in. Gating one is as much a
    // bug as leaving the credit application open.
    test.each([
        ['Employee-Handbook-Latest.pdf'],
        ['NWCA-Meal-Period-Waiver.pdf'],
        ['customer-garment-drop-off-form.pdf'],
        ['sample-checkout-return-agreement.pdf'],
        ['final-qc-checklist.pdf'],
        ['policies/dtg-ink-order-form.pdf'],
    ])('%s → public', (name) => {
        expect(ask(`/${name}`)).toBe('public');
    });

    test('every PDF on disk except the allowlisted ones is public', () => {
        const roots = [path.join(REPO, 'forms'), path.join(REPO, 'forms', 'policies')];
        const allow = extractAllowlist(SERVER);
        const seen = [];
        for (const dir of roots) {
            if (!fs.existsSync(dir)) continue;
            for (const f of fs.readdirSync(dir)) {
                if (!f.toLowerCase().endsWith('.pdf')) continue;
                seen.push(f);
                const expected = allow.includes(f.toLowerCase()) ? 'gated' : 'public';
                expect({ file: f, verdict: ask(`/${f}`) }).toEqual({ file: f, verdict: expected });
            }
        }
        // guard against the loop silently finding nothing and "passing"
        expect(seen.length).toBeGreaterThan(10);
    });
});

describe('gateStaffOnlyForms — registration order IS the security property', () => {
    test('the gate is mounted on /forms', () => {
        expect(SERVER).toContain("app.use('/forms', gateStaffOnlyForms);");
    });

    test('the gate is registered BEFORE the /forms static mount', () => {
        const gateAt = SERVER.indexOf("app.use('/forms', gateStaffOnlyForms);");
        const staticAt = SERVER.indexOf("app.use('/forms', express.static(");
        expect(gateAt).toBeGreaterThan(-1);
        expect(staticAt).toBeGreaterThan(-1);
        expect(gateAt).toBeLessThan(staticAt);
    });

    test('/forms is not ALSO served by an earlier, ungated static mount', () => {
        const staticAt = SERVER.indexOf("app.use('/forms', express.static(");
        const before = SERVER.slice(0, staticAt);
        expect(before).not.toMatch(/express\.static\(\s*path\.join\(__dirname\)\s*[,)]/);
        expect(before).not.toMatch(/express\.static\(__dirname\s*[,)]/);
    });
});
