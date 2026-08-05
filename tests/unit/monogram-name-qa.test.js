/**
 * Stitch Check (monogram-name-qa.js) — pins every QA rule so a "helpful"
 * refactor can't silently stop catching the mistakes that ruin garments.
 */
const QA = require('../../shared_components/js/monogram-name-qa.js');

function item(row, name, extra = {}) {
    return { row, name, size: 'M', threadColor: 'Black', location: 'Right Chest', ...extra };
}

function codes(result) {
    return result.findings.map(f => f.code);
}

describe('cleanName', () => {
    test('trims and collapses internal whitespace', () => {
        expect(QA.cleanName('  Jim   Smith ')).toBe('Jim Smith');
    });
    test('handles null/undefined', () => {
        expect(QA.cleanName(null)).toBe('');
        expect(QA.cleanName(undefined)).toBe('');
    });
});

describe('levenshtein', () => {
    test('identical → 0', () => expect(QA.levenshtein('Jim', 'Jim')).toBe(0));
    test('Jon → John is 1', () => expect(QA.levenshtein('jon smith', 'john smith')).toBe(1));
    test('empty vs word', () => expect(QA.levenshtein('', 'abc')).toBe(3));
    test('substitution + insertion', () => expect(QA.levenshtein('kitten', 'sitting')).toBe(3));
});

describe('classifyCase', () => {
    test('title', () => expect(QA.classifyCase('Jim Smith')).toBe('title'));
    test('upper', () => expect(QA.classifyCase('JIM SMITH')).toBe('upper'));
    test('lower', () => expect(QA.classifyCase('jim smith')).toBe('lower'));
    test('McDonald is mixed, never an outlier pattern', () => {
        expect(QA.classifyCase('Kate McDonald')).toBe('mixed');
    });
    test("O'Brien is mixed", () => expect(QA.classifyCase("Erin O'Brien")).toBe('mixed'));
    test('hyphenated title stays title', () => {
        expect(QA.classifyCase('Mary-Jane Watson')).toBe('title');
    });
});

describe('analyze — whitespace', () => {
    test('flags trailing space as fixable error', () => {
        const r = QA.analyze([item(1, 'Jim Smith '), item(2, 'Ann Lee')], {});
        const f = r.findings.find(x => x.code === 'whitespace');
        expect(f).toBeDefined();
        expect(f.severity).toBe('error');
        expect(f.rows).toEqual([1]);
        expect(f.fixable).toBe(true);
        expect(f.fixes).toEqual([{ row: 1, from: 'Jim Smith ', to: 'Jim Smith' }]);
        expect(r.summary.errors).toBe(1);
    });
    test('flags double internal space', () => {
        const r = QA.analyze([item(1, 'Jim  Smith')], {});
        expect(codes(r)).toContain('whitespace');
    });
    test('clean names produce no whitespace finding', () => {
        const r = QA.analyze([item(1, 'Jim Smith')], {});
        expect(codes(r)).not.toContain('whitespace');
    });
});

describe('analyze — case outliers', () => {
    const titles = [item(1, 'Jim Smith'), item(2, 'Ann Lee'), item(3, 'Bob Jones'), item(4, 'Sue Ray')];
    test('one ALL CAPS name among title-case names is flagged', () => {
        const r = QA.analyze([...titles, item(5, 'CARL YOUNG')], {});
        const f = r.findings.find(x => x.code === 'case-outlier');
        expect(f).toBeDefined();
        expect(f.rows).toEqual([5]);
    });
    test('one all-lowercase name is flagged', () => {
        const r = QA.analyze([...titles, item(5, 'carl young')], {});
        const f = r.findings.find(x => x.code === 'case-outlier');
        expect(f).toBeDefined();
        expect(f.rows).toEqual([5]);
    });
    test('McDonald / mixed case is NEVER flagged', () => {
        const r = QA.analyze([...titles, item(5, 'Kate McDonald')], {});
        expect(codes(r)).not.toContain('case-outlier');
    });
    test('a fully ALL-CAPS list is a style choice, not an outlier', () => {
        const r = QA.analyze(
            [item(1, 'JIM'), item(2, 'ANN LEE'), item(3, 'BOB JONES'), item(4, 'SUE RAY')], {});
        expect(codes(r)).not.toContain('case-outlier');
    });
    test('fewer than 3 names: no case analysis', () => {
        const r = QA.analyze([item(1, 'Jim Smith'), item(2, 'ANN LEE')], {});
        expect(codes(r)).not.toContain('case-outlier');
    });
});

describe('analyze — duplicates', () => {
    test('exact duplicate (case/space-insensitive) is a warn', () => {
        const r = QA.analyze([item(1, 'Jim Smith'), item(2, ' jim  smith')], {});
        const f = r.findings.find(x => x.code === 'duplicate');
        expect(f).toBeDefined();
        expect(f.severity).toBe('warn');
        expect(f.rows).toEqual([1, 2]);
    });
    test('near-duplicate Jon/John pair flagged, not reported as exact dup', () => {
        const r = QA.analyze([item(1, 'Jon Smith'), item(2, 'John Smith')], {});
        expect(codes(r)).toContain('near-duplicate');
        expect(codes(r)).not.toContain('duplicate');
    });
    test('longer names allow distance 2', () => {
        const r = QA.analyze([item(1, 'Katherine Johnson'), item(2, 'Katharine Jonson')], {});
        expect(codes(r)).toContain('near-duplicate');
    });
    test('clearly different names not flagged', () => {
        const r = QA.analyze([item(1, 'Jim Smith'), item(2, 'Ann Lee')], {});
        expect(codes(r)).not.toContain('near-duplicate');
        expect(codes(r)).not.toContain('duplicate');
    });
    test('very short names (≤3 chars) never near-dup', () => {
        const r = QA.analyze([item(1, 'Al'), item(2, 'Ali')], {});
        expect(codes(r)).not.toContain('near-duplicate');
    });
});

describe('analyze — characters', () => {
    test('curly apostrophe is a smart-punct warn', () => {
        const r = QA.analyze([item(1, 'O’Brien')], {});
        expect(codes(r)).toContain('smart-punct');
    });
    test("straight apostrophe O'Brien is fine", () => {
        const r = QA.analyze([item(1, "O'Brien")], {});
        expect(codes(r)).not.toContain('smart-punct');
        expect(codes(r)).not.toContain('non-ascii');
    });
    test('diacritics are an info (font glyph check), not the smart-punct warn', () => {
        const r = QA.analyze([item(1, 'José Muñoz')], {});
        expect(codes(r)).toContain('non-ascii');
        expect(codes(r)).not.toContain('smart-punct');
        const f = r.findings.find(x => x.code === 'non-ascii');
        expect(f.severity).toBe('info');
    });
});

describe('analyze — long names', () => {
    test('19+ characters flagged as info', () => {
        const r = QA.analyze([item(1, 'Bartholomew Higglesworth')], {});
        const f = r.findings.find(x => x.code === 'long-name');
        expect(f).toBeDefined();
        expect(f.severity).toBe('info');
    });
    test('18 characters exactly is fine', () => {
        const r = QA.analyze([item(1, 'x'.repeat(18))], {});
        expect(codes(r)).not.toContain('long-name');
    });
});

describe('analyze — completeness', () => {
    test('name without size is an error', () => {
        const r = QA.analyze([item(1, 'Jim Smith', { size: '' })], {});
        const f = r.findings.find(x => x.code === 'missing-size');
        expect(f).toBeDefined();
        expect(f.severity).toBe('error');
    });
    test('missing thread only flagged when order uses multiple threads', () => {
        const rows = [item(1, 'Jim Smith', { threadColor: '' })];
        expect(codes(QA.analyze(rows, { multiThread: false }))).not.toContain('missing-thread');
        expect(codes(QA.analyze(rows, { multiThread: true }))).toContain('missing-thread');
    });
    test('missing location only flagged when order uses multiple locations', () => {
        const rows = [item(1, 'Jim Smith', { location: '' })];
        expect(codes(QA.analyze(rows, { multiLocation: false }))).not.toContain('missing-location');
        expect(codes(QA.analyze(rows, { multiLocation: true }))).toContain('missing-location');
    });
    test('empty rows are ignored entirely', () => {
        const r = QA.analyze([item(1, ''), item(2, '   ')], { multiThread: true, multiLocation: true });
        expect(r.findings).toEqual([]);
    });
});

describe('analyze — unassigned imported names', () => {
    test('unassigned roster names warn (a person gets skipped)', () => {
        const r = QA.analyze([item(1, 'Jim Smith')], { unassignedNames: ['Ann Lee', 'Bob Jones'] });
        const f = r.findings.find(x => x.code === 'unassigned');
        expect(f).toBeDefined();
        expect(f.message).toContain('2 imported names are');
    });
    test('no warn when roster fully assigned', () => {
        const r = QA.analyze([item(1, 'Jim Smith')], { unassignedNames: [] });
        expect(codes(r)).not.toContain('unassigned');
    });
});

describe('analyze — clean list', () => {
    test('a well-formed list produces zero findings', () => {
        const r = QA.analyze([
            item(1, 'Jim Mickelson'), item(2, 'Erik Mickelson'), item(3, 'Ruthie Nhoung'),
        ], { multiThread: false, multiLocation: false, unassignedNames: [] });
        expect(r.findings).toEqual([]);
        expect(r.summary).toEqual({ errors: 0, warnings: 0, infos: 0 });
    });
});

describe('buildRunPlan', () => {
    test('groups by thread, preserves in-group order, counts changes', () => {
        const plan = QA.buildRunPlan([
            item(1, 'A', { threadColor: 'Black' }),
            item(2, 'B', { threadColor: 'Royal' }),
            item(3, 'C', { threadColor: 'Black' }),
            item(4, 'D', { threadColor: 'Royal' }),
        ]);
        expect(plan.totalNames).toBe(4);
        expect(plan.threadChanges).toBe(1);
        expect(plan.groups.map(g => g.thread)).toEqual(['Black', 'Royal']);
        expect(plan.groups[0].items.map(i => i.name)).toEqual(['A', 'C']);
    });
    test('unspecified thread sorts first so it gets resolved before the run', () => {
        const plan = QA.buildRunPlan([
            item(1, 'A', { threadColor: 'Black' }),
            item(2, 'B', { threadColor: '' }),
        ]);
        expect(plan.groups.map(g => g.thread)).toEqual(['', 'Black']);
    });
    test('single thread → zero changes', () => {
        const plan = QA.buildRunPlan([item(1, 'A'), item(2, 'B')]);
        expect(plan.threadChanges).toBe(0);
        expect(plan.groups).toHaveLength(1);
    });
    test('empty names excluded from the plan', () => {
        const plan = QA.buildRunPlan([item(1, ''), item(2, 'B')]);
        expect(plan.totalNames).toBe(1);
    });
});
