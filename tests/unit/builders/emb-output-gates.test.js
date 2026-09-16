/**
 * Embroidery builder output gates (2026-09-16).
 *
 * A non-SanMar line with no price and no blank cost is left out of the total (the engine lists
 * it in unpricedProducts instead of raising the critical "contact IT" banner). Every way a quote
 * leaves the builder must therefore refuse while one remains, and Email/Push must stop when the
 * save they depend on was refused — otherwise they send the previous revision without the line.
 */
const fs = require('fs');
const path = require('path');

const read = (file) => fs.readFileSync(path.join(__dirname, '../../../shared_components/js/builders/emb', file), 'utf8').replace(/\r\n/g, '\n');
const output = read('output.js');
const savePush = read('save-push.js');
const productRows = read('product-rows.js');
const body = (source, name) => {
    const start = source.indexOf(`export async function ${name}(`);
    expect(start).toBeGreaterThan(-1);
    const next = source.indexOf('\nexport ', start + 10);
    return source.slice(start, next === -1 ? undefined : next);
};

test('save, print and copy refuse a vendor line that has no price', () => {
    expect(savePush).toMatch(/const zeroPriceStyles = vendorStylesWithoutPrice\(products\);\n\s+if \(zeroPriceStyles\.length > 0\)/);
    expect(body(output, 'printQuote')).toMatch(/const unpriced = vendorStylesWithoutPrice\(allItems\);\n\s+if \(unpriced\.length > 0\) \{\n\s+showToast\(`Set a price for/);
    expect(body(output, 'copyToClipboard')).toMatch(/const unpriced = vendorStylesWithoutPrice\(productList\);\n\s+if \(unpriced\.length > 0\) \{\n\s+showToast\(`Set a price for/);
});

test('a save reports success, and Email and Push stop when it did not complete', () => {
    expect(savePush).toMatch(/if \(!finishSuccessfulSave\(result, skipShareModal\)\) return;\n\s+return true;/);
    expect(body(output, 'embEmailQuote')).toMatch(/const saved = await saveAndGetLink\(\{ skipShareModal: true \}\);\n\s+if \(saved !== true\) return;/);
    expect(body(savePush, 'pushToShopWorks')).toMatch(/const saved = await saveAndGetLink\(\{ skipShareModal: true \}\);\n\s+if \(saved !== true\) return;/);
});

test('a vendor parent row is never hidden (its price button lives there)', () => {
    const start = productRows.indexOf('export function hideVariantOnlyParents(');
    const fn = productRows.slice(start, productRows.indexOf('\n}\n', start));
    expect(fn).toMatch(/if \(\/\*\* @type \{HTMLElement\} \*\/ \(parentRow\)\.dataset\.nonSanmar === 'true'\) return;/);
});
