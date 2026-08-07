// gear-publisher-store.js — the browser-side draft model.
//
// The load-bearing part is imagePlan(): the photo grid is the variant-to-image
// binding surface, so if the plan is wrong the whole product binds wrong. That defect
// shipped on 253gear.com twice, so it gets asserted on both sides of the wire — here
// and in the proxy's shopify-variant-media-binding.test.js.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/** Load the IIFE with a minimal window, so no jsdom is needed for pure logic. */
function loadStore() {
    const src = fs.readFileSync(
        path.join(__dirname, '..', '..', 'dashboards', 'js', 'gear-publisher-store.js'), 'utf8');
    const store = {};
    const win = {
        localStorage: {
            _d: store,
            setItem(k, v) { this._d[k] = String(v); },
            getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
            removeItem(k) { delete this._d[k]; },
            key(i) { return Object.keys(this._d)[i]; },
            get length() { return Object.keys(this._d).length; }
        }
    };
    const sandbox = { window: win, console };
    vm.createContext(sandbox);
    vm.runInContext(src, sandbox);
    return win.GearStore;
}

const S = loadStore();

function draft(over = {}) {
    return Object.assign(S.newDraft('t1'), {
        designNumber: '34293',
        designName: 'Retro Sumner',
        designDescription: 'Retro arch, one colour.',
        styles: ['T-Shirt', 'Hoodie'],
        colors: [
            { colorName: 'Jet Black', catalogColor: 'Jet Black' },
            { colorName: 'Navy', catalogColor: 'Navy' }
        ],
        sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'],
        hook: 'A hook.',
        body: 'Body copy.',
        altText: 'Retro arch design'
    }, over);
}

describe('the image plan is one photo per (Style x Colour)', () => {
    test('Size never multiplies the photo count', () => {
        const d = draft();
        expect(S.imagePlan(d)).toHaveLength(2 * 2);     // NOT 2 x 2 x 7
        expect(S.variantCount(d)).toBe(2 * 2 * 7);
    });

    test('the cell key matches the server binding key exactly', () => {
        // Server: `${style}|||${color}`, both lowercased and trimmed.
        expect(S.cellKey('T-Shirt', 'Jet Black')).toBe('t-shirt|||jet black');
        expect(S.cellKey('  T-SHIRT ', 'JET BLACK')).toBe(S.cellKey('T-Shirt', 'Jet Black'));
    });

    test('a seasonal design plans on Season, not Style', () => {
        const d = draft({ seasonal: true, seasons: ['Winter', 'Summer', 'Fall'], styles: ['T-Shirt'] });
        expect(S.imagePlan(d)).toHaveLength(3 * 2);
        expect(S.imagePlan(d).map((c) => c.styleOption)).toEqual(
            expect.arrayContaining(['Winter', 'Summer', 'Fall']));
    });
});

describe('an empty cell blocks the wizard', () => {
    test('every cell missing is reported', () => {
        expect(S.missingCells(draft())).toHaveLength(4);
    });

    test('a cell that uploaded is no longer missing', () => {
        const d = draft();
        const key = S.imagePlan(d)[0].key;
        d.images[key] = { state: 'uploaded', externalKey: 'abc12345' };
        expect(S.missingCells(d)).toHaveLength(3);
    });

    test('a FAILED upload still counts as missing — it is not a photo', () => {
        const d = draft();
        const key = S.imagePlan(d)[0].key;
        d.images[key] = { state: 'failed', error: 'too small' };
        expect(S.missingCells(d)).toHaveLength(4);
    });

    test('photos step is blocked while any cell is empty, and says how many', () => {
        const blockers = S.blockers(draft(), 'photos');
        expect(blockers.join(' ')).toMatch(/4 photos still needed/);
        expect(blockers.join(' ')).toMatch(/variants with no image/);
    });
});

describe('upload validation refuses bad photos at the cell', () => {
    const file = (over = {}) => Object.assign({ type: 'image/jpeg', size: 2 * 1024 * 1024 }, over);

    test('an undersized image is refused with the real numbers', () => {
        const problems = S.validateImage(file(), { width: 1200, height: 1200 }, null);
        expect(problems.join(' ')).toMatch(/1200×1200/);
        expect(problems.join(' ')).toMatch(/2048px/);
    });

    test('a large enough image passes', () => {
        expect(S.validateImage(file(), { width: 2400, height: 2400 }, null)).toEqual([]);
    });

    test('a mismatched aspect ratio is refused — mixed shapes make the gallery jump', () => {
        const problems = S.validateImage(file(), { width: 2400, height: 3000 }, 1.0);
        expect(problems.join(' ')).toMatch(/does not match the other photos/);
    });

    test('a matching aspect ratio passes', () => {
        expect(S.validateImage(file(), { width: 2400, height: 2400 }, 1.0)).toEqual([]);
    });

    test('wrong format and oversized files are named plainly', () => {
        expect(S.validateImage(file({ type: 'image/gif' }), { width: 2400, height: 2400 }, null).join(' '))
            .toMatch(/JPEG or PNG/);
        expect(S.validateImage(file({ size: 25 * 1024 * 1024 }), { width: 2400, height: 2400 }, null).join(' '))
            .toMatch(/limit is 20 MB/);
    });
});

describe('mandatory identity is enforced in the form too', () => {
    test('a missing design number, name or description each block', () => {
        expect(S.blockers(draft({ designNumber: '' }), 'identity').join(' ')).toMatch(/design number/);
        expect(S.blockers(draft({ designName: '' }), 'identity').join(' ')).toMatch(/design name/i);
        expect(S.blockers(draft({ designDescription: '' }), 'identity').join(' ')).toMatch(/description/i);
    });

    test('a 3-digit number is not accepted', () => {
        expect(S.blockers(draft({ designNumber: '123' }), 'identity')).not.toEqual([]);
    });

    test('a complete identity clears', () => {
        expect(S.blockers(draft(), 'identity')).toEqual([]);
    });

    test('a seasonal design with two garments is blocked with the reason', () => {
        const d = draft({ seasonal: true, seasons: ['Winter'], styles: ['T-Shirt', 'Hoodie'] });
        expect(S.blockers(d, 'products').join(' ')).toMatch(/only one garment/);
    });
});

describe('the payload sent to the server', () => {
    test('uploaded images carry their (Style, Colour) and the hero sorts first', () => {
        const d = draft();
        const plan = S.imagePlan(d);
        plan.forEach((cell, i) => {
            d.images[cell.key] = { state: 'uploaded', externalKey: 'key' + i };
        });
        d.heroKey = plan[2].key;

        const out = S.uploadedImages(d);
        expect(out).toHaveLength(4);
        expect(out[0].primary).toBe(true);
        expect(out[0].styleOption).toBe(plan[2].styleOption);
        expect(out.every((i) => i.styleOption && i.catalogColor && i.altText)).toBe(true);
    });

    test('the hook is its own paragraph, first — the theme renders it under the price', () => {
        const html = S.descriptionHtml(draft({ hook: 'One line.', body: 'Para one.\n\nPara two.' }));
        expect(html.indexOf('<p>One line.</p>')).toBe(0);
        expect(html).toContain('<p>Para one.</p>');
        expect(html).toContain('<p>Para two.</p>');
    });

    test('description HTML escapes user text rather than injecting it', () => {
        const html = S.descriptionHtml(draft({ hook: '<script>alert(1)</script>', body: 'x' }));
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;');
    });
});

describe('drafts survive a reload', () => {
    test('save then load round-trips', () => {
        const d = draft();
        S.save(d);
        expect(S.load('t1').designNumber).toBe('34293');
        expect(S.list().length).toBeGreaterThan(0);
        S.remove('t1');
        expect(S.load('t1')).toBeNull();
    });
});
