/**
 * rep-email-maps.test.js — hand-maintained rep→email maps agree, and none of them
 * points at a mailbox that does not exist.
 *
 * WHY THIS EXISTS
 * `ruthie@nwcustomapparel.com` is not a real account — lib/staff-saml.js:125 says so
 * outright. Ruth's inbox is ruth@. The wrong address keeps getting typed because
 * ShopWorks and ArtRequests store her display name as "Ruthie" (ORDER_ODBC has
 * "Ruthie Nhoung"), so the address gets derived from the name and nothing complains.
 *
 * There is no runtime error when it happens. These maps feed rep FILTERS and mailto
 * targets, so a wrong value returns an empty list or sends mail nowhere — the exact
 * shape of the bug that once had Ruth 404ing across the app. Four separate copies of
 * this map had drifted to the dead address while three sibling copies were correct.
 *
 * The first test is the durable one: no source file may contain the dead address at
 * all, in any map, present or future. The rest pin the specific invariant that both
 * spellings resolve, since the AE rep-filter dropdowns emit the literal "Ruthie".
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const DEAD_ADDRESS = 'ruthie@nwcustomapparel.com';
const REAL_ADDRESS = 'ruth@nwcustomapparel.com';

const SEARCH_DIRS = ['pages/js', 'dashboards/js', 'shared_components/js', 'lib'];

function jsFilesIn(dir) {
    const abs = path.join(REPO, dir);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs)
        .filter((f) => f.endsWith('.js'))
        .map((f) => ({ rel: `${dir}/${f}`, src: fs.readFileSync(path.join(abs, f), 'utf8') }));
}

const FILES = SEARCH_DIRS.flatMap(jsFilesIn);

describe('the dead ruthie@ address', () => {
    test('the search actually found files (guard against a vacuous pass)', () => {
        expect(FILES.length).toBeGreaterThan(50);
    });

    test('no source file uses it as a VALUE anywhere', () => {
        const offenders = [];
        for (const { rel, src } of FILES) {
            src.split('\n').forEach((line, i) => {
                if (!line.includes(DEAD_ADDRESS)) return;
                // Comments documenting that the address is dead are the point, not a bug.
                if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
                offenders.push(`${rel}:${i + 1}`);
            });
        }
        expect(offenders).toEqual([]);
    });
});

describe('every rep map resolves both spellings of Ruth', () => {
    // The AE dashboards' rep-filter <option> values are the literal string "Ruthie"
    // (art-hub-ae.js, mockup-ae.js), while ArtRequests rows may carry either. A map
    // that dropped the "Ruthie" key would silently filter to nothing.
    const MAP_FILES = [
        'pages/js/art-request-detail.js',
        'pages/js/mockup-detail.js',
        'shared_components/js/art-hub-ae.js',
        'shared_components/js/mockup-ae.js',
        'shared_components/js/art-actions-shared.js',
    ];

    test.each(MAP_FILES)('%s maps both "Ruthie" and "Ruth" to the real inbox', (rel) => {
        const src = fs.readFileSync(path.join(REPO, rel), 'utf8');
        // Strip comment lines so prose about the address never satisfies the assertion.
        const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
        expect(code).toMatch(new RegExp(`'Ruthie':\\s*'${REAL_ADDRESS}'`));
        expect(code).toMatch(new RegExp(`'Ruth':\\s*'${REAL_ADDRESS}'`));
    });
});
