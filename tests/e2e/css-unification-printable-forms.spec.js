const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const forms = require('../../scripts/css/migration-manifest.json').printableFormsContent;
// Each case has its own page, mocked services and storage state.
test.describe.configure({ mode: 'parallel' });
const company = { id_Customer: 123456, Company_Name: 'CSS Review Company', City: 'Milton', State: 'WA', Sales_Rep: 'Test Rep', Customer_Warning: 'Fixture warning', Is_Tax_Exempt: true, contacts: [{ ct_NameFull: 'Taylor Example', Email: 'taylor@example.test', Phone_Best: '2535550142' }] };

async function fixture(page, source) {
    const state = { errors: [], unexpectedWrites: [], submissions: [], saveMode: 'failure', contactMode: 'success', styleMode: 'success', colorMode: 'success', taxMode: 'success', taxRequests: [] };
    await page.addInitScript(() => { window.__printCalls = 0; window.print = () => { window.__printCalls++; }; });
    page.on('pageerror', error => state.errors.push(error.message));
    await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (!['GET', 'HEAD'].includes(request.method())) {
            if (url.pathname === '/api/tax-rates/lookup') { state.taxRequests.push(request.postDataJSON()); return route.fulfill(state.taxMode === 'failure' ? { status: 503, json: { success: false, error: 'Fixture tax failure' } } : { json: { success: true, taxRate: 10, locationCode: 'Fixture rate' } }); }
            if (url.pathname === '/api/form-submissions' && request.method() === 'POST') {
                state.submissions.push(request.postDataJSON());
                if (state.saveMode === 'pending') { state.pendingSave = route; return; }
                if (state.saveMode === 'failure') return route.fulfill({ status: 503, json: { error: 'Fixture save unavailable' } });
                return route.fulfill({ json: { submissionId: 'CSS-REVIEW-001' } });
            }
            state.unexpectedWrites.push(url.pathname);
            return route.fulfill({ status: 503, json: { error: 'Business writes blocked in form fixtures' } });
        }
        if (url.pathname === '/api/crm-session/me') return route.fulfill({ json: { authenticated: false } });
        if (url.pathname === '/api/company-contacts-2026/search') return route.fulfill(state.contactMode === 'failure' ? { status: 503, json: { error: 'Fixture lookup failure' } } : { json: { companies: [company] } });
        if (url.pathname === '/api/stylesearch') return route.fulfill(state.styleMode === 'failure' ? { status: 503, json: { error: 'Fixture style failure' } } : { json: [{ value: url.searchParams.get('term') || 'PC54', label: 'Fixture Cotton Tee' }] });
        if (url.pathname === '/api/product-colors') return route.fulfill(state.colorMode === 'failure' ? { status: 503, json: { error: 'Fixture colors unavailable' } } : state.colorMode === 'empty' ? { json: { colors: [] } } : { json: { colors: [{ COLOR_NAME: 'Midnight Navy', CATALOG_COLOR: 'Navy', COLOR_SQUARE_IMAGE: '' }, { COLOR_NAME: 'Red', CATALOG_COLOR: 'Red', COLOR_SQUARE_IMAGE: '' }] } });
        if (url.pathname === '/api/sizes-by-style-color') return route.fulfill({ json: { sizes: ['S', 'M', 'L', 'XL', '2XL'] } });
        if (url.pathname === '/api/max-prices-by-style') return route.fulfill({ json: { sellingPriceDisplayAddOns: { '2XL': 2 } } });
        if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { error: 'No live service in form fixtures' } });
        if (url.hostname !== 'localhost' && ['xhr', 'fetch', 'script'].includes(request.resourceType())) return route.fulfill({ status: 503, body: 'External service blocked' });
        return route.continue();
    });
    await page.route('http://localhost:3400/' + source + '*', route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(ROOT, source), 'utf8') }));
    await page.goto('/' + source);
    await page.evaluate(() => document.fonts.ready);
    return state;
}

async function layout(page, name) {
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth), name + ' at ' + width).toBeLessThanOrEqual(width + 1);
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(result.violations).toEqual([]);
        if (process.env.CSS_SHOT_TAG) {
            const out = path.join(__dirname, 'screenshots/css-unification');fs.mkdirSync(out, { recursive: true });
            await page.screenshot({ path: path.join(out, process.env.CSS_SHOT_TAG + '-' + name + '-' + width + '.png'), fullPage: true });
        }
    }
}

for (const form of forms) {
    const name = path.basename(form.source, '.html');
    test('CSS printable: ' + name + ' layout, keyboard, edit and clear cancellation', async ({ page }) => {
        const state = await fixture(page, form.source);
        await expect(page.locator('body')).toHaveCSS('font-family', /Public Sans/);
        await layout(page, name);
        const field = page.locator('main input[type="text"]:visible').first();
        await field.fill('CSS Review');
        await expect(field).toBeFocused();
        for (const region of await page.locator('.form-table-scroll').all()) {
            await region.focus(); await page.keyboard.press('ArrowRight');
            await expect.poll(() => region.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
        }
        page.once('dialog', dialog => dialog.dismiss());
        await page.locator('#clearFormBtn').click();
        await expect(field).toHaveValue('CSS Review');
        page.once('dialog', dialog => dialog.accept());
        await page.locator('#clearFormBtn').click();
        await expect(field).not.toHaveValue('CSS Review');
        await page.locator('#printFormBtn').focus(); await page.keyboard.press('Enter');
        expect(await page.evaluate(() => window.__printCalls)).toBe(1);
        expect(state.errors).toEqual([]); expect(state.unexpectedWrites).toEqual([]); expect(state.submissions).toEqual([]);
    });

    test('CSS printable: ' + name + ' preserves paper layout and page count', async ({ page }) => {
        const state = await fixture(page, form.source);
        await page.emulateMedia({ media: 'print' });
        await expect(page.locator('.form-toolbar')).toBeHidden();
        for (const label of await page.locator('.signature-field label').all()) {
            const box=await label.boundingBox(); if(box) expect(box.width).toBeGreaterThan(35);
        }
        for (const region of await page.locator('.form-table-scroll').all()) await expect(region).toHaveCSS('overflow-x', 'visible');
        const out = path.join(__dirname, 'screenshots/css-unification');fs.mkdirSync(out, { recursive: true });
        const pdf = await page.pdf({ path: path.join(out, name + '.pdf'), preferCSSPageSize: true, printBackground: true });
        expect((pdf.toString('latin1').match(/\/Type\s*\/Page(?=\s|\/|>)/g) || []).length).toBe(form.blankPrintPages);
        expect(state.errors).toEqual([]); expect(state.unexpectedWrites).toEqual([]);
    });
}

test('CSS printable: roster add-row, size tally, save failure and retry preserve the payload', async ({ page }) => {
    const state = await fixture(page, 'pages/forms/team-roster-form.html');
    await page.locator('#fldCompany').fill('CSS Review Company');
    await page.locator('#fldContact').fill('Taylor Example');
    await page.locator('#fldDueDate').fill('9/30/2026');
    await page.locator('#rosterRows .row-name').first().fill('Test Player');
    await page.locator('#rosterRows .row-number').first().fill('12');
    await page.locator('#rosterRows .row-size').first().fill('M');
    const rows = await page.locator('#rosterRows tr').count();
    await page.locator('#addRowBtn').click(); await expect(page.locator('#rosterRows tr')).toHaveCount(rows + 1);
    await expect(page.locator('.roster-tally')).toContainText('M');
    state.saveMode = 'pending'; await page.locator('#saveFormBtn').click();
    await expect(page.locator('#saveFormBtn')).toBeDisabled();
    await expect.poll(() => Boolean(state.pendingSave)).toBe(true);
    await state.pendingSave.fulfill({ status: 503, json: { error: 'Fixture save unavailable' } });
    await expect(page.locator('.form-save-banner')).toContainText('NOT saved');
    await expect(page.locator('#saveFormBtn')).toBeEnabled();
    await expect(page.locator('#rosterRows .row-name').first()).toHaveValue('Test Player');
    await layout(page, 'roster-save-error');
    state.saveMode = 'success'; await page.locator('#saveFormBtn').click();
    await expect(page.locator('.form-save-banner')).toContainText('CSS-REVIEW-001');
    expect(state.submissions).toHaveLength(2);
    expect(state.submissions[1]).toEqual(state.submissions[0]);
    expect(state.submissions[1]).toMatchObject({ formId: 'team-roster', dueDateIso: '2026-09-30', company: 'CSS Review Company' });
    expect(JSON.stringify(state.submissions[1].payload)).toContain('Test Player');
    expect(state.errors).toEqual([]); expect(state.unexpectedWrites).toEqual([]);
});

test('CSS printable: contact lookup fails visibly and keyboard selection fills the roster', async ({ page }) => {
    const state = await fixture(page, 'pages/forms/team-roster-form.html');
    state.contactMode = 'failure'; await page.locator('#fldCompany').fill('Review');
    await expect(page.locator('.contacts-row--empty')).toContainText('unavailable');
    state.contactMode = 'success'; await page.locator('#fldCompany').fill('CSS Review');
    await expect(page.locator('.contacts-row--company')).toBeVisible();
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await expect(page.locator('#fldContact')).toHaveValue('Taylor Example');
    await expect(page.locator('#fldEmail')).toHaveValue('taylor@example.test');
    await expect(page.locator('.customer-intel')).toContainText('Fixture warning');
    await layout(page, 'roster-customer-intel');
    expect(state.errors).toEqual([]); expect(state.unexpectedWrites).toEqual([]);
});

test('CSS printable: roster date keeps free text and accepts a calendar date', async ({ page }) => {
    const state = await fixture(page, 'pages/forms/team-roster-form.html');
    await page.locator('#fldDueDate').fill('ASAP');
    const native = page.locator('.date-anchor').filter({ has: page.locator('#fldDueDate') }).locator('input[type="date"]');
    await native.evaluate(el => { el.value = '2026-09-30'; el.dispatchEvent(new Event('change', { bubbles: true })); });
    await expect(page.locator('#fldDueDate')).toHaveValue('9/30/2026');
    await page.locator('#fldDueDate').fill('ASAP');
    await expect(page.locator('#fldDueDate')).toHaveValue('ASAP');
    expect(state.errors).toEqual([]); expect(state.unexpectedWrites).toEqual([]);
});

test('CSS printable: last table row style and color menus work with keyboard on a phone', async ({ page }) => {
    const state = await fixture(page, 'pages/forms/ae-order-intake-form.html');
    await page.setViewportSize({ width: 320, height: 900 });
    const row = page.locator('#orderRows tr').last(), style = row.locator('.cell-style input');
    state.styleMode = 'failure'; await style.fill('PC5');
    await expect(row.locator('.contacts-row--empty')).toContainText('unavailable');
    state.styleMode = 'success'; await style.fill('PC54');
    await expect(row.locator('[role="option"]')).toBeVisible();
    const popup = await row.locator('.styles-dropdown').boundingBox();
    expect(popup.x).toBeGreaterThanOrEqual(0); expect(popup.x + popup.width).toBeLessThanOrEqual(321);
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    const button = row.locator('.swatch-btn'); await expect(button).toBeVisible();
    await button.focus(); await page.keyboard.press('Enter');
    const color = row.getByRole('button', { name: 'Midnight Navy', exact: true });
    await expect(color).toBeFocused(); await page.keyboard.press('Enter');
    await expect(row.locator('.cell-color input')).toHaveValue('Midnight Navy');
    await expect(row.locator('.cell-color input')).toHaveAttribute('data-catalog-color', 'Navy');
    await expect(button).toBeFocused();
    await page.keyboard.press('Space'); await expect(color).toBeVisible();
    // Hit testing proves the final-row menu escapes the table scroll container.
    expect(await color.evaluate(el => { const r=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); })).toBe(true);
    await page.keyboard.press('Escape'); await expect(button).toBeFocused();
    await button.click(); await row.getByRole('button', { name: /type color manually/ }).click();
    await expect(row.locator('.cell-color input')).toBeFocused();
    await expect(row.locator('.cell-color input')).not.toHaveAttribute('data-catalog-color');
    await row.locator('.cell-color input').fill('Customer supplied color');
    await layout(page, 'ae-style-manual');
    expect(state.errors).toEqual([]); expect(state.unexpectedWrites).toEqual([]);
});

test('CSS printable: empty and failed color lookups keep manual entry visible and can retry', async ({ page }) => {
    const state = await fixture(page, 'pages/forms/team-roster-form.html');
    const style = page.locator('#fldStyle');
    for (const mode of ['failure', 'empty', 'success']) {
        state.colorMode=mode; await style.fill(''); await style.fill('PC54');
        await expect(page.locator('.styles-dropdown [role="option"]')).toBeVisible();
        await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
        if(mode==='success') { await expect(page.locator('.swatch-btn')).toBeVisible(); }
        else { await expect(page.locator('.form-lookup-status')).toContainText(mode==='failure'?'unavailable':'No catalog'); await expect(page.locator('#fldColor')).toBeVisible(); }
    }
    await layout(page,'roster-color-retry');
    expect(state.errors).toEqual([]); expect(state.unexpectedWrites).toEqual([]);
});

test('CSS printable: roster draft restores added rows and can be discarded', async ({ page }) => {
    const state=await fixture(page,'pages/forms/team-roster-form.html');
    await page.locator('#fldCompany').fill('Draft Review');
    await page.locator('#addRowBtn').click(); await page.locator('#rosterRows .row-name').last().fill('Restored Player');
    await page.locator('#rosterRows .row-size').last().fill('L');
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('nwca-form-draft:team-roster')||'null')?.tables[0].at(-1)[0])).toBe('Restored Player');
    page.once('dialog', d=>d.accept()); await page.reload();
    await expect(page.locator('.draft-restore-btn')).toBeVisible();
    await page.locator('.draft-restore-btn').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#rosterRows tr')).toHaveCount(15);
    await expect(page.locator('#rosterRows .row-name').last()).toHaveValue('Restored Player');
    await expect(page.locator('#rosterTally')).toContainText('L×1');
    await layout(page,'roster-restored');
    page.once('dialog', d=>d.accept()); await page.reload();
    await page.locator('.draft-discard-btn').focus(); await page.keyboard.press('Enter');
    expect(await page.evaluate(()=>localStorage.getItem('nwca-form-draft:team-roster'))).toBeNull();
    await expect(page.locator('#rosterRows .row-name').last()).toHaveValue('');
    expect(state.errors).toEqual([]); expect(state.unexpectedWrites).toEqual([]);
});

test('CSS printable: QC marks and disposition remain exclusive with keyboard controls', async ({ page }) => {
    const state=await fixture(page,'pages/forms/qc-checklist-form.html');
    const row=page.locator('#qcRows tr').first();
    await row.locator('.qc-ok').focus(); await page.keyboard.press('Space');
    await row.locator('.qc-fail').focus(); await page.keyboard.press('Space');
    await expect(row.locator('.qc-ok')).not.toBeChecked(); await expect(row.locator('.qc-fail')).toBeChecked();
    await page.locator('#dispRelease').check(); await page.locator('#dispHold').check();
    await expect(page.locator('#dispRelease')).not.toBeChecked(); await expect(page.locator('#dispHold')).toBeChecked();
    await layout(page,'qc-hold');
    expect(state.errors).toEqual([]); expect(state.unexpectedWrites).toEqual([]);
});

test('CSS printable: AE totals, tax errors and quote provenance survive the new layout', async ({ page }) => {
    const state=await fixture(page,'pages/forms/ae-order-intake-form.html');
    const row=page.locator('#orderRows tr').first();
    await row.locator('.cell-style input').fill('PC54'); await row.locator('.row-qty').fill('10');
    await row.locator('.row-price').fill('20'); await expect(row.locator('.row-total')).toHaveValue('200.00');
    await expect(page.locator('#fldSubtotal')).toHaveValue('200.00');
    state.taxMode='failure'; await page.locator('#taxLookupBtn').click(); await expect(page.locator('#taxHint')).toContainText('failed');
    state.taxMode='success'; await page.locator('#taxLookupBtn').click(); await expect(page.locator('#fldTax')).toHaveValue('20.00');
    await expect(page.locator('#fldOrderTotal')).toHaveValue('220.00');
    await page.locator('#fldDeposit').fill('50'); await expect(page.locator('#fldBalanceDue')).toHaveValue('170.00');
    await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{ key:'nwca-qq-handback',newValue:JSON.stringify({style:'PC54',perPiece:25,provenance:'Fixture quote configuration'}) })));
    // Existing matching contract requires a token or blank price for a style match.
    await row.locator('.row-price').fill('');
    await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{ key:'nwca-qq-handback',newValue:JSON.stringify({style:'PC54',perPiece:25,provenance:'Fixture quote configuration'}) })));
    await expect(row.locator('.price-prov')).toContainText('Fixture quote configuration');
    await expect(row.locator('.row-total')).toHaveValue('250.00');
    await row.locator('.row-price').fill('26'); await expect(row.locator('.price-prov')).toHaveCount(0);
    await layout(page,'ae-money');
    expect(state.taxRequests).toHaveLength(2); expect(state.errors).toEqual([]); expect(state.unexpectedWrites).toEqual([]);
});

for (const name of ['garment-drop-off-form','credit-card-auth-form','name-personalization-form','team-roster-form']) {
    test('CSS printable: '+name+' prints complete entered values and restores editing',async ({page})=>{
        const state=await fixture(page,'pages/forms/'+name+'.html');
        await page.locator('main input[type="text"]:visible').first().fill('CSS Review Company');
        const textarea=page.locator('main textarea').first();
        const longValue=Array.from({length:45},(_,i)=>'Review note '+(i+1)+': Preserve the full production instruction.').join('\n')+'\nEND OF REVIEW NOTES';
        if(await textarea.count()) await textarea.fill(longValue);
        const row=page.locator('main tbody input[type="text"]').first();
        if(await row.count()) await row.fill('Complete printable player name with a long garment assignment');
        await page.emulateMedia({media:'print'}); await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
        await expect(page.locator('.form-print-value').first()).toHaveText('CSS Review Company');
        if(await textarea.count()) await expect(page.locator('.form-print-textarea').first()).toHaveText(longValue);
        const out=path.join(__dirname,'screenshots/css-unification'); fs.mkdirSync(out,{recursive:true});
        await page.pdf({path:path.join(out,name+'-filled.pdf'),preferCSSPageSize:true,printBackground:true});
        await page.evaluate(()=>window.dispatchEvent(new Event('afterprint'))); await page.emulateMedia({media:'screen'});
        await expect(page.locator('.form-print-value')).toHaveCount(0);
        if(await textarea.count()) await expect(textarea).toHaveValue(longValue);
        await expect(page.locator('main input[type="text"]:visible').first()).toHaveValue('CSS Review Company');
        expect(state.errors).toEqual([]); expect(state.unexpectedWrites).toEqual([]);
    });
}

test('CSS printable: changing styles clears old color verification before a failed lookup', async ({page})=>{
    const state=await fixture(page,'pages/forms/team-roster-form.html');
    const style=page.locator('#fldStyle'), color=page.locator('#fldColor');
    await style.fill('PC54'); await expect(page.locator('.styles-dropdown [role="option"]')).toBeVisible();
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await page.locator('.swatch-btn').click(); await page.getByRole('button',{name:'Midnight Navy',exact:true}).click();
    await expect(color).toHaveAttribute('data-catalog-color','Navy');
    state.colorMode='failure'; await style.fill('PC61');
    await expect(color).toBeVisible(); await expect(color).not.toHaveAttribute('data-catalog-color');
    await expect(page.locator('.styles-dropdown [role="option"]')).toBeVisible();
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await expect(page.locator('.form-lookup-status')).toContainText('unavailable');
    await expect(color).toBeVisible(); await expect(color).not.toHaveAttribute('data-catalog-color');
    await color.fill('Manual color');
    expect(state.errors).toEqual([]); expect(state.unexpectedWrites).toEqual([]);
});
