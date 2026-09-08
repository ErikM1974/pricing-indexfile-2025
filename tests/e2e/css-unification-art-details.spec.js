const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const baseline = process.env.CSS_ART_BASELINE === '1';
const requestRows = ['Submitted', 'In Progress', 'Awaiting Approval', 'Revision Requested', 'Completed'].map((Status, i) => ({
    ID_Design: 10001 + i, PK_ID: 801 + i, CompanyName: ['Cascade Field Services', 'Cedar Workshop', 'West Sound Team', 'Harbor Print Studio', 'Completed Customer'][i],
    Design_Number: String(53001 + i), Design_Num_SW: String(53001 + i), DesignName: 'Crew logo', Design_Name: 'Crew logo', Status,
    Sales_Rep: 'fixture@example.test', Submitted_By: 'fixture@example.test', Date_Created: '2026-09-08T09:00:00', Due_Date: '2026-09-09',
    Is_Rush: i === 0, Is_On_Hold: false, Item_Type: 'Garment', Order_Type_Source: 'New Design',
    Rep_Mockup: '/favicon.png', Mockup_1: '/favicon.png', Box_Mockup_1: '/favicon.png', Box_File_Mockup: '/favicon.png', Art_Minutes: 30, Additional_Notes: 'Navy work shirts with white lettering.',
    Company_Name: 'Cascade Field Services', Contact_Name: 'Fixture Contact', Contact_Email: 'customer@example.test', Garment_Info: 'PC54 Navy',
}));
const mockupRows = requestRows.map((row, i) => ({
    ID: 101 + i, Company_Name: row.CompanyName, Design_Number: row.Design_Number, Design_Name: 'Crew logo', Status: row.Status,
    Submitted_By: 'fixture@example.test', Submitted_Date: '2026-09-08T09:00:00', Due_Date: '2026-09-09', Is_Rush: i === 0,
    Is_On_Hold: false, Box_Mockup_1: '/favicon.png', Garment_Info: 'PC54 Navy', Print_Location: 'Left Chest',
    Logo_Width: 3, Logo_Height: 2, Stitch_Count: 6500, Thread_Colors: 'Navy, White', Customer_Name: 'Fixture Contact',
}));

async function fixture(page, file, routePath, options = {}) {
    const state = { requests: requestRows.map(row => ({ ...row })), mockups: mockupRows.map(row => ({ ...row })), calls: [], writes: [], errors: [], failure: false, ...options };
    page.on('pageerror', error => state.errors.push(error.message));
    await page.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.fulfill({ status: 503, json: { error: 'Fixture blocks all external writes' } }));
    await page.route('**/api/**', async route => {
        const request = route.request(), url = new URL(request.url());
        state.calls.push(url.pathname);
        const product = { SKU: 'FIXTURE1', Category: 'Drinkware', DisplayName: 'Crew Tumbler', ProductFamily: 'Crew Tumbler', ThumbnailURL: '/favicon.png', IsActive: true };
        if (url.pathname === '/api/jds/products' && request.method() === 'POST') return route.fulfill({ json: { result: [{ sku: 'FIXTURE1', images: { thumbnail: '/favicon.png' } }] } });
        if (url.pathname === '/api/jds-catalog/categories') return route.fulfill({ json: { result: [{ category: 'Drinkware', count: 1, sampleThumbnail: '/favicon.png' }] } });
        if (url.pathname === '/api/jds-catalog') return route.fulfill({ json: { result: [product] } });
        if (url.pathname === '/api/jds-catalog/FIXTURE1') return route.fulfill({ json: { result: product } });
        if (url.pathname === '/api/jds/products/FIXTURE1') return route.fulfill({ json: { success: true, result: { sku: 'FIXTURE1', description: 'Crew Tumbler', images: { thumbnail: '/favicon.png' }, pricing: { net: 8 }, inventory: { available: 25 } } } });
        if (!['GET', 'HEAD'].includes(request.method())) {
            state.writes.push({ path: url.pathname, body: request.postData() });
            return route.fulfill({ status: 503, json: { error: 'Fixture blocks business writes' } });
        }
        if (url.pathname === '/api/embroidery/palette') return route.fulfill({json:{success:true,families:['Blue','White'],colors:[{name:'Navy',catalog:'1001',hex:'#162d50',family:'Blue'},{name:'White',catalog:'1002',hex:'#ffffff',family:'White'}]}});
        if (url.pathname === '/api/emb-designs/by-mockup/101' && state.threads) return route.fulfill({json:{records:[{Mockup_Slot:'1',Thread_Sequence_JSON:JSON.stringify([{run:1,name:'Navy',catalog:'1001',hex:'#162d50'}])}]}});
        if (url.pathname === '/api/box/shared-image') return route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(ROOT, 'favicon.png')) });
        if (url.pathname === '/api/locations') return route.fulfill({ json: [{ Location: 'Left Chest', Type: 'EMB' }] });
        if (url.pathname === '/api/crm-session/me') return route.fulfill({ json: { email: 'fixture@example.test', firstName: 'Fixture', lastName: 'Staff', role: 'admin' } });
        if (url.pathname === '/api/artrequests' || url.pathname === '/api/portal/fixture/art-request/10001') {
            if (state.wait) await state.wait;
            const rows = url.searchParams.has('id_design') || url.pathname.includes('/portal/') ? state.requests.slice(0, 1) : state.requests;
            return route.fulfill({ status: state.failure ? 503 : 200, json: state.failure ? { error: 'Fixture art service unavailable' } : rows });
        }
        if (url.pathname === '/api/mockups') return route.fulfill({ json: { records: state.mockups } });
        if (/^\/api\/mockups\/\d+$/.test(url.pathname) || url.pathname === '/api/portal/fixture/mockup/101') {
            if (state.wait) await state.wait;
            return route.fulfill({ status: state.failure ? 503 : 200, json: state.failure ? { error: 'Fixture mockup service unavailable' } : { success: true, record: state.mockups[0], notes: [], versions: [] } });
        }
        if (url.pathname.includes('broken-mockups')) return route.fulfill({ json: { checked: 5, broken: 0, results: [] } });
        if (url.pathname.includes('mockup-notifications')) return route.fulfill({ json: { notifications: [] } });
        if (url.pathname.includes('/mockup-notes')) return route.fulfill({ json: { notes: [] } });
        if (url.pathname.includes('/mockup-versions')) return route.fulfill({ json: { versions: [] } });
        if (['/api/design-notes', '/api/art-charges', '/api/embroidery-designs', '/api/emb-designs/by-mockup/101'].includes(url.pathname)) return route.fulfill({ json: [] });
        if (url.pathname === '/api/transfer-orders') return route.fulfill({ json: { success: true, records: [], orders: [], transfers: [] } });
        if (url.pathname === '/api/service-codes') return route.fulfill({ json: { data: [{ ServiceCode: 'GRT-50', SellPrice: 50 }, { ServiceCode: 'GRT-75', SellPrice: 75 }] } });
        if (url.pathname.includes('thread-colors')) return route.fulfill({ json: { Result: [] } });
        if (url.pathname.includes('/box/') && url.pathname.includes('folders')) return route.fulfill({ json: { folders: [{ id: 'fixture-folder', name: 'Fixture Art' }] } });
        if (url.pathname === '/api/box/folder-files') return route.fulfill({ json: { files: [] } });
        return route.fulfill({ status: 503, json: { error: 'Unconfigured fixture service' } });
    });
    const pathname = routePath.split(/[?#]/)[0];
    await page.route('http://localhost:3400' + pathname + '*', route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(ROOT, file), 'utf8') }));
    await page.goto(routePath);
    return state;
}

async function review(page, name) {
    const issues = [];

    for (const width of baseline ? [1440, 390] : [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => document.fonts.ready);
        if (!baseline) {
            const overflow = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed').map(el => ({ tag: el.tagName, id: el.id, className: el.className, right: el.getBoundingClientRect().right })));
            if (await page.evaluate(() => document.documentElement.scrollWidth) > width + 1) issues.push({ width, id: 'document-overflow', nodes: overflow });
            const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations;
            issues.push(...violations.map(v => ({ width, id: v.id, nodes: v.nodes.map(n => ({ target: n.target, summary: n.failureSummary })) })));
        }
        if (process.env.CSS_SHOT_TAG || baseline) {
            const directory = path.join(__dirname, 'screenshots/css-unification');
            fs.mkdirSync(directory, { recursive: true });
            await page.screenshot({ path: path.join(directory, `${process.env.CSS_SHOT_TAG || 'art-details-before'}-${name}-${width}.png`), fullPage: true });
        }
    }
    if (!baseline) {
        const directory = path.join(__dirname, 'screenshots/css-unification');
        fs.mkdirSync(directory, { recursive: true });
        fs.writeFileSync(path.join(directory, name + '-axe.json'), JSON.stringify(issues, null, 2));
        expect(issues, name + ' accessibility').toEqual([]);
    }
}

test('CSS art details: Steve queue renders requests and workflow controls', async ({ page }) => {
    const state = await fixture(page, 'dashboards/art-hub-steve.html', '/dashboards/art-hub-steve.html');
    await expect(page.locator('#steve-gallery-grid .mockup-card').first()).toBeVisible();
    await review(page, 'steve-queue');
    expect(state.errors).toEqual([]);
});

test('CSS art details: AE art gallery preserves the selected navigation', async ({ page }) => {
    const state = await fixture(page, 'dashboards/ae-dashboard.html', '/dashboards/ae-dashboard.html#view');
    await expect(page.locator('#view-tab')).toBeVisible();
    await expect(page.locator('#view-tab .mockup-card').first()).toBeVisible();
    await review(page, 'ae-gallery');
    expect(state.errors).toEqual([]);
});

for (const view of ['staff', 'customer']) {
    test(`CSS art details: art request ${view} view keeps artwork and actions visible`, async ({ page }) => {
        const route = '/art-request/10001' + (view === 'customer' ? '?view=customer&cid=fixture' : '');
        const state = await fixture(page, 'pages/art-request-detail.html', route, { requests: [{ ...requestRows[0], Status: 'Awaiting Approval' }] });
        await expect(page.locator('#ard-content')).toBeVisible();
        if (view === 'customer') {
            // A single proof is selected and previewed by the existing runtime.
            await expect(page.locator('#ard-lightbox')).toBeVisible();
            await page.locator('#ard-lightbox-close').click();
        }
        await review(page, 'art-request-' + view);
        if (view === 'customer') expect(state.calls.filter(url => /^\/api\/(transfer-order|supacolor-job)/.test(url))).toEqual([]);
        expect(state.errors).toEqual([]);
    });
    test(`CSS art details: mockup ${view} view keeps artwork and actions visible`, async ({ page }) => {
        const route = '/mockup/101' + (view === 'customer' ? '?view=customer&cid=fixture' : '');
        const state = await fixture(page, 'pages/mockup-detail.html', route, { mockups: [{ ...mockupRows[0], Status: 'Awaiting Approval' }] });
        await expect(page.locator('#pmd-content')).toBeVisible();
        await review(page, 'mockup-' + view);
        if (view === 'customer') expect(state.calls.filter(url => /^\/api\/(transfer-order|supacolor-job)/.test(url))).toEqual([]);
        expect(state.errors).toEqual([]);
    });
}

for (const type of ['Garment', 'Sticker', 'Banner', 'JDS', 'Ruth']) {
 test('CSS art details: AE ' + type + ' intake keeps its fields usable', async ({page}) => {
  const state=await fixture(page,'dashboards/ae-dashboard.html','/dashboards/ae-dashboard.html#'+(type==='Ruth'?'mockup-ruth':'submit'));
  if(type!=='Ruth') await page.locator('.ae-item-pill[data-item-type="'+type+'"]').click();
  const container=type==='Ruth'?'#mockup-submit-container':type==='Garment'?'#garment-form-container':type==='JDS'?'#jds-form-container':'#sticker-banner-form-container';
  await expect(page.locator(container)).toBeVisible();
  await expect(page.locator(container+' input').first()).toBeVisible();
  if(type==='JDS') {
   await page.locator('.jds-category-card[data-category="Drinkware"]').click();
   await page.locator('.jds-product-card[data-sku="FIXTURE1"]').click();
   await expect(page.locator('#jds-form-body')).toBeVisible();
  }
  await review(page,'ae-intake-'+type.toLowerCase());
  expect(state.errors).toEqual([]);
 });
}

test('CSS art details: Steve filters, selection and board stay usable', async ({page}) => {
 const state=await fixture(page,'dashboards/art-hub-steve.html','/dashboards/art-hub-steve.html');
 const cards=page.locator('#steve-gallery-grid .mockup-card');
 await expect(cards).toHaveCount(5);
 await page.locator('#steve-gallery-search').fill('Cedar');
 await expect(cards).toHaveCount(1);
 await page.locator('#steve-gallery-search').fill('No matching company');
 await expect(cards).toHaveCount(0);
 await expect(page.locator('.sg-empty')).toBeVisible();
 await review(page,'steve-filter-empty');
 await page.locator('#steve-gallery-search').fill('');
 await expect(cards).toHaveCount(5);
 await page.locator('#steve-gallery-select').click();
 await page.locator('input[data-action="bulk-select"]').first().check();
 await expect(page.locator('#steve-gallery-bulk-count')).toContainText('1');
 await review(page,'steve-selection');
 await page.locator('#steve-gallery-bulk-cancel').click();
 await page.locator('#steve-view-toggle').getByRole('button',{name:'Board'}).click();
 await expect(page.locator('#steve-kanban-board')).toBeVisible();
 await review(page,'steve-board');
 expect(state.writes).toEqual([]);
 expect(state.errors).toEqual([]);
});

test('CSS art details: Steve service failure is visible and retry recovers', async ({page}) => {
 const state=await fixture(page,'dashboards/art-hub-steve.html','/dashboards/art-hub-steve.html',{failure:true});
 await expect(page.locator('.sg-retry')).toBeVisible();
 await review(page,'steve-failed');
 state.failure=false;
 await page.locator('.sg-retry').click();
 await expect(page.locator('#steve-gallery-grid .mockup-card')).toHaveCount(5);
 expect(state.writes).toEqual([]);
});

test('CSS art details: Steve time dialog can be opened and cancelled with the keyboard', async ({page}) => {
 const state=await fixture(page,'dashboards/art-hub-steve.html','/dashboards/art-hub-steve.html');
 await page.locator('#steve-gallery-grid button[data-action="log-time"]').first().click();
 await expect(page.locator('#art-time-modal')).toBeVisible();
 await review(page,'steve-time-dialog');
 await page.keyboard.press('Escape');
 await expect(page.locator('#art-time-modal')).toHaveCount(0);
 expect(state.writes).toEqual([]);
});

test('CSS art details: AE keyboard navigation, gallery filter and More menu preserve state', async ({page}) => {
 const state=await fixture(page,'dashboards/ae-dashboard.html','/dashboards/ae-dashboard.html#view');
 await page.locator('#view-tab .status-stat[data-bucket="all"]').press('Enter');
 await expect(page.locator('#view-tab .mockup-card')).toHaveCount(5);
 await page.locator('#aeNavSections [data-section="steve"]').focus();
 await page.keyboard.press('ArrowRight');
 await expect(page.locator('#aeNavSections [data-section="ruth"]')).toHaveAttribute('aria-selected','true');
 await page.locator('#aeNavSub [data-page="digitizing"]').click();
 await expect(page.locator('#digitizing-tab')).toBeVisible();
 await expect(page.locator('#digitizing-tab .mockup-card').first()).toBeVisible();
 await review(page,'ae-ruth-gallery');
 await page.locator('#moreButton').click();
 await expect(page.locator('#moreDropdown')).toBeVisible();
 await review(page,'ae-more-menu');
 expect(state.writes).toEqual([]);
 expect(state.errors).toEqual([]);
});

for(const [name,prefix,routePath] of [['art-request','ard','/art-request/10001'],['mockup','pmd','/mockup/101']]) {
 test('CSS art details: '+name+' loading and service failure remain readable', async ({page}) => {
  let release;
  const wait=new Promise(resolve=>{release=resolve;});
  const state=await fixture(page,'pages/'+name+'-detail.html',routePath,{wait,failure:true});
  await expect(page.locator('#'+prefix+'-loading')).toBeVisible();
  await review(page,name+'-loading');
  release();
  await expect(page.locator('#'+prefix+'-error')).toBeVisible();
  await review(page,name+'-failed');
  expect(state.writes).toEqual([]);
 });
 test('CSS art details: '+name+' customer revision dialog keeps approval controls private', async ({page}) => {
  const options=name==='art-request'?{requests:[{...requestRows[0],Status:'Awaiting Approval'}]}:{mockups:[{...mockupRows[0],Status:'Awaiting Approval'}]};
  const state=await fixture(page,'pages/'+name+'-detail.html',routePath+'?view=customer&cid=fixture',options);
  await expect(page.locator('#'+prefix+'-rush-toggle')).toBeDisabled();
  await expect(page.locator('#'+prefix+'-rush-toggle')).toHaveText('Rush order');
  if(name==='art-request') {
   await expect(page.locator('#ard-lightbox')).toBeVisible();
   await review(page,'art-request-customer-preview');
   await page.locator('#ard-lightbox-close').click();
  }
  await page.locator('#'+prefix+'-btn-customer-revise').click();
  const dialog=name==='art-request'?'#ard-changes-modal':'#pmd-revise-overlay';
  await expect(page.locator(dialog)).toBeVisible();
  await review(page,name+'-customer-revision');
  await page.locator(name==='art-request'?'#ard-changes-cancel':'#pmd-revise-cancel').click();
  await expect(page.locator(dialog)).toBeHidden();
  expect(state.writes).toEqual([]);
 });
}

test('CSS art details: art request staff print sheet preserves job data and customer print stays private', async ({page}) => {
 const state=await fixture(page,'pages/art-request-detail.html','/art-request/10001');
 await expect(page.locator('#ard-content')).toBeVisible();
 await page.evaluate(()=>{window.print=()=>{window.__printed=true;};});
 await page.locator('#ard-print-btn').click();
 await expect.poll(()=>page.evaluate(()=>window.__printed)).toBe(true);
 await page.emulateMedia({media:'print'});
 await expect(page.locator('#ard-print-sheet')).toBeVisible();
 await expect(page.locator('#ard-print-sheet')).toContainText('Cascade Field Services');
 await expect(page.locator('#ard-content')).toBeHidden();
 await page.screenshot({path:path.join(__dirname,'screenshots/css-unification/art-request-staff-job-sheet.png'),fullPage:true});
 await page.pdf({path:path.join(__dirname,'screenshots/css-unification/art-request-staff-job-sheet.pdf'),format:'Letter',printBackground:true});
 expect(state.writes).toEqual([]);
 await page.emulateMedia({media:'screen'});
 state.requests[0].Status='Awaiting Approval';
 await page.goto('/art-request/10001?view=customer&cid=fixture');
 await expect(page.locator('#ard-content')).toBeVisible();
 await expect(page.locator('#ard-lightbox')).toBeVisible();
 await page.locator('#ard-lightbox-close').click();
 await page.emulateMedia({media:'print'});
 await expect(page.locator('#ard-print-sheet')).toBeHidden();
 await expect(page.locator('#ard-content')).toBeVisible();
 await expect(page.locator('#ard-print-sheet')).toBeEmpty();
 expect(state.writes).toEqual([]);
});

test('CSS art details: AE validation and queued files keep the intake actionable', async ({page}) => {
 const state=await fixture(page,'dashboards/ae-dashboard.html','/dashboards/ae-dashboard.html#submit');
 await page.locator('#gsf-submit-btn').click();
 await expect(page.locator('#gsf-company-error')).toBeVisible();
 await review(page,'ae-intake-invalid');
 await page.locator('#gsf-file-input').setInputFiles({name:'crew-artwork.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="navy"/></svg>')});
 await expect(page.locator('.gsf-file-name')).toHaveText('crew-artwork.svg');
 await review(page,'ae-intake-file-queued');
 await page.locator('.gsf-file-remove').click();
 await expect(page.locator('.gsf-file-name')).toHaveCount(0);
 expect(state.writes).toEqual([]);
 expect(state.errors).toEqual([]);
});

test('CSS art details: art request sender handles an empty Box folder and cancels without sending', async ({page}) => {
 const state=await fixture(page,'pages/art-request-detail.html','/art-request/10001');
 await page.locator('#ard-btn-send-mockup').click();
 await expect(page.locator('#approval-modal')).toBeVisible();
 await expect(page.locator('#box-picker-empty')).toBeVisible();
 await review(page,'art-request-sender-empty');
 await page.keyboard.press('Escape');
 await expect(page.locator('#approval-modal')).toBeHidden();
 expect(state.writes).toEqual([]);
 expect(state.errors).toEqual([]);
});

test('CSS art details: thread picker filters, keyboard selection and Escape preserve unsaved edits', async ({page}) => {
 const state=await fixture(page,'pages/mockup-detail.html','/mockup/101',{threads:true});
 await page.locator('.pmd-edit-threads-btn').first().click();
 await expect(page.locator('.tcp-overlay')).toHaveCount(1);
 await page.locator('.pmd-thread-editor-row').first().press('Enter');
 await expect(page.getByRole('dialog',{name:'Choose Thread Color'})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Search thread colors'})).toBeFocused();
 await expect(page.getByRole('button',{name:'Close thread color picker'})).toHaveText('×');
 await review(page,'mockup-thread-picker');
 await page.getByRole('textbox',{name:'Search thread colors'}).fill('No matching color');
 await expect(page.locator('.tcp-empty')).toBeVisible();
 await review(page,'mockup-thread-picker-empty');
 await page.getByRole('textbox',{name:'Search thread colors'}).fill('White');
 await expect(page.locator('.tcp-cell')).toHaveCount(1);
 await page.locator('.tcp-cell').press('Enter');
 await expect(page.locator('.tcp-overlay')).toBeHidden();
 await expect(page.locator('.pmd-te-name')).toHaveText('White');
 await page.locator('.pmd-thread-editor-row').first().press('Enter');
 await page.keyboard.press('Escape');
 await expect(page.locator('.tcp-overlay')).toBeHidden();
 await expect(page.locator('.pmd-thread-editor-row').first()).toBeFocused();
 expect(state.writes).toEqual([]);
 expect(state.errors).toEqual([]);
});

test('CSS art details: art request transfer sender traps focus and restores its trigger', async ({page}) => {
 const state=await fixture(page,'pages/art-request-detail.html','/art-request/10001');
 const trigger=page.locator('#ard-btn-send-supacolor');
 await trigger.click();
 await expect(page.locator('#tas-modal')).toBeVisible();
 await expect(page.locator('#tas-picker-search-input')).toBeFocused();
 await review(page,'art-request-transfer-sender');
 await page.keyboard.press('Escape');
 await expect(page.locator('#tas-modal')).toBeHidden();
 await expect(trigger).toBeFocused();
 await expect(page.locator('body')).not.toHaveCSS('overflow','hidden');
 expect(state.writes).toEqual([]);
 expect(state.errors).toEqual([]);
});
