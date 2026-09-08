const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const transfer = {
    ID_Transfer: 'ST-260908-0001', Method: 'Supacolor', Status: 'Requested',
    Company_Name: 'Fixture Company', Customer_Name: 'Fixture Customer', Design_Number: '10001',
    Requested_By: 'Fixture Staff', Requested_At: '2026-09-08T09:00:00', Sales_Rep_Name: 'Fixture Rep',
    Is_Rush: true, Rush_Reason: 'Fixture deadline', Needed_By_Date: '2026-09-11', Is_Reorder: true,
    line_count: 2, file_count: 2,
};
const job = {
    ID_Job: 101, Supacolor_Job_Number: '900001', Status: 'Open', PO_Number: '112898',
    Description: 'Workshop transfer order', Customer_Name: 'Fixture Company', Location: 'Los Angeles',
    Created_By_Name: 'Fixture Staff', Date_Entered: '2026-09-01T09:00:00', Requested_Ship_Date: '2026-09-04T09:00:00',
    Carrier: 'FedEx', Tracking_Number: '123456789012', Shipping_Method: 'Ground',
    Ship_To_Name: 'Fixture Company', Ship_To_Address: 'Fixture street\nFixture city', Subtotal: 120, Total: 130, Backfill_Source: 'api',
};
async function fixture(page, file, options = {}) {
    const state = {
        record: { ...transfer, ...options.record }, job: { ...job, ...options.job },
        failure: false, writes: [], errors: [], ...options,
    };
    page.on('pageerror', error => state.errors.push(error.message));
    await page.addInitScript(() => {
        localStorage.setItem('transfer_user_name', 'Fixture Staff');
        localStorage.setItem('transfer_user_email', 'fixture@example.test');
    });
    await page.route('**/*', route => route.request().method() === 'GET' ? route.continue() : route.fulfill({ status: 503, json: { error: 'Visual fixture blocks external writes' } }));
    await page.route('**/api/**', route => {
        const request = route.request(), url = new URL(request.url());
        let data = { error: 'Fixture service unavailable' }, status = 503;
        if (request.method() !== 'GET') {
            state.writes.push({ path: url.pathname, body: request.postData() });
            if (state.box && url.pathname === '/api/box/shared-link' && !state.linkFailure) return route.fulfill({ json: { success: true, sharedLink: 'https://example.test/file/fixture' } });
            if (state.box && url.pathname === '/api/transfer-orders/analyze-link') return route.fulfill({ json: { success: true, fileName: '10001-transfer.png', mimeType: 'image/png', filenameParsed: { type: 'working', designNumber: '10001', placementLabel: 'Full front' } } });
            if (url.pathname.endsWith('/extract-supacolor-jobs-list')) return route.fulfill({ json: { duration: 100, data: { jobs: [
                { supacolorJobNumber: '900001', poNumber: '112898', description: 'Workshop transfer', status: 'Open' },
                { supacolorJobNumber: '900002', poNumber: '112899', description: 'Field services transfer', status: 'Open' },
            ] } } });
            if (url.pathname.includes('/vision/')) return route.fulfill({ json: { duration: 100, data: {
                supacolorJobNumber: '900001', poNumber: '112898', description: 'Workshop transfer order', status: 'Open', total: 130,
                joblines: [{ itemCode: 'WE_A3', description: 'Workshop transfer', quantity: 24, unitPrice: 5, lineTotal: 120 }],
                history: [{ eventType: 'Created', eventAt: '2026-09-01T09:00:00' }],
            } } });
            return route.fulfill({ status, json: data });
        }
        if (url.pathname === '/api/crm-session/me') { data = { email: 'fixture@example.test', firstName: 'Fixture', lastName: 'Staff' }; status = 200; }
        if (url.pathname === '/api/transfer-orders/stats') { data = { success: true, stats: { Requested: 1, Ordered: 1, Shipped: 1 } }; status = 200; }
        else if (url.pathname === '/api/transfer-orders') {
            data = { success: true, records: [
                state.record,
                { ...state.record, ID_Transfer: 'ST-260908-0002', Company_Name: 'Cascade Field Services', Status: 'Ordered', Is_Rush: false, ShopWorks_PO_Number: '112898' },
                { ...state.record, ID_Transfer: 'ST-260908-0003', Company_Name: 'Cedar Works', Status: 'Shipped', Is_Rush: false, Supacolor_Order_Number: '900001', ShopWorks_PO_Number: '112899' },
            ] }; status = state.failure ? 503 : 200;
        } else if (url.pathname.startsWith('/api/transfer-orders/ST-')) {
            data = { success: true, record: state.record,
                notes: [{ Note_Type: 'comment', Note_Text: 'Artwork approved for production.', Author_Name: 'Fixture Staff', Created_At: '2026-09-08T09:00:00' }],
                lines: [{ Line_Order: 1, Quantity: 24, Transfer_Size: 'Adult', Press_Count: 1 }, { Line_Order: 2, Quantity: 12, Transfer_Size: 'Youth', Press_Count: 1 }],
                files: state.emptyFiles ? [] : [
                    { File_Type: 'mockup', File_Name: 'approved-artwork.png', File_URL: '/favicon.png', Thumbnail_URL: '/favicon.png' },
                    { File_Type: 'working', File_Name: 'production-artwork.png', File_MIME: 'image/png', File_URL: '/favicon.png', Thumbnail_URL: '/favicon.png' },
                ],
            }; status = state.failure ? 503 : 200;
        }
        if (url.pathname === '/api/supacolor-jobs/stats') { data = { success: true, stats: { Active: 1, Closed: 1, Cancelled: 1 } }; status = 200; }
        else if (url.pathname === '/api/supacolor-jobs') {
            data = { success: true, records: [state.job, { ...state.job, ID_Job: 102, Supacolor_Job_Number: '900002', Status: 'Closed' }, { ...state.job, ID_Job: 103, Supacolor_Job_Number: '900003', Status: 'Cancelled' }] }; status = state.failure ? 503 : 200;
        } else if (url.pathname === '/api/supacolor-jobs/101') {
            data = { success: true, job: state.job,
                joblines: [{ Line_Order: 1, Line_Type: 'TRANSFER', Item_Code: 'WE_A3', Description: 'Workshop shirt transfer', Detail_Line: 'Mixed fabric\n10 inch width', Color: 'White', Quantity: 24, Unit_Price: 5, Line_Total: 120, Thumbnail_URL: state.brokenImage ? '/missing-workflow.png' : '/favicon.png' }],
                history: [{ Event_Type: 'Created', Event_Detail: 'Order received', Event_At: '2026-09-01T09:00:00' }],
            }; status = state.failure ? 503 : 200;
        } else if (url.pathname.startsWith('/api/supacolor-jobs/by-number/')) { data = { success: true, job: state.job }; status = 200; }
        if (state.box && url.pathname === '/api/box/search') { data = { success: true, entries: [{ id: 'folder-1', name: 'Fixture Company' }] }; status = 200; }
        if (state.box && url.pathname === '/api/box/folder-files') { data = { success: true, files: [{ id: 'file-1', name: '10001-transfer.png', extension: 'png', size: 32768, thumbnailUrl: '/api/box/fixture-thumbnail' }, { id: 'file-2', name: '10001-production.ai', extension: 'ai', size: 32768 }] }; status = 200; }
        return route.fulfill({ status, json: data });
    });
    await page.route(`http://localhost:3400/${file}*`, route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(ROOT, file), 'utf8') }));
    return state;
}
async function screenshot(page, name) {
    if (!process.env.CSS_SHOT_TAG) return;
    const folder = path.join(__dirname, 'screenshots/css-unification');
    fs.mkdirSync(folder, { recursive: true });
    await page.evaluate(() => document.fonts.ready);
    const dialog = await page.locator('[role="dialog"]:visible').count();
    await page.screenshot({ path: path.join(folder, `${process.env.CSS_SHOT_TAG}-${name}.png`), fullPage: dialog === 0 });
}
async function layouts(page, name) {
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth), name + ' at ' + width).toBeLessThanOrEqual(width + 1);
        const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
        expect(result.violations, name + ' accessibility at ' + width).toEqual([]);
        expect(await page.locator('.bt-modal-intro:visible').evaluateAll(nodes => nodes.filter(node => node.scrollWidth > node.clientWidth + 1).length)).toBe(0);
        await screenshot(page, `${name}-${width}`);
    }
}
async function dismiss(page, host, trigger) {
    const dialog = page.locator(host);
    await expect(dialog).toBeVisible();
    const buttons = dialog.locator('button:visible');
    await buttons.last().focus();
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    if (trigger) await expect(trigger).toBeFocused();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
}

for (const [file, method] of [['bradley-transfers.html', 'Supacolor'], ['bradley-screenprint.html', 'Screen Print']]) {
    test(`CSS Bradley: ${method} queue filters, touch controls and delete cancellation`, async ({ page }) => {
        const state = await fixture(page, 'dashboards/' + file, { record: { ...transfer, Method: method } });
        await page.goto('/dashboards/' + file);
        await expect(page.locator('.bt-card')).toHaveCount(3);
        await expect(page.locator('#bt-filter-search')).toHaveCSS('font-size', '16px');
        await layouts(page, method === 'Supacolor' ? 'transfer-queue' : 'screenprint-queue');
        await page.locator('#bt-filter-status').selectOption('Ordered');
        await expect(page.locator('.bt-card')).toHaveCount(1);
        await page.locator('#bt-filter-clear').click();
        await expect(page.locator('.bt-card')).toHaveCount(3);
        await page.locator('#bt-filter-search').fill('No matching fixture');
        await expect(page.locator('.bt-card')).toHaveCount(0);
        await screenshot(page, method + '-queue-empty');
        await page.locator('#bt-filter-clear').click();
        const trigger = page.locator('.bt-card-menu-btn').first();
        await trigger.click();
        await expect(page.locator('#bt-delete-reason')).toBeFocused();
        await layouts(page, method + '-delete-dialog');
        await dismiss(page, '#bt-delete-modal', trigger);
        expect(state.writes).toEqual([]);
        expect(state.errors).toEqual([]);
    });
    test(`CSS Bradley: ${method} queue failure and recovery`, async ({ page }) => {
        const state = await fixture(page, 'dashboards/' + file, { failure: true, record: { ...transfer, Method: method } });
        await page.goto('/dashboards/' + file);
        await expect(page.locator('.bt-error')).toBeVisible();
        const toast = page.locator('.bt-toast--error').first();
        // Sample the actual entry and dismissal animations while text remains visible.
        for (const leaving of [false, true]) {
            const opacity = await toast.evaluate((el, isLeaving) => {
                el.classList.toggle('is-leaving', isLeaving);
                getComputedStyle(el).transform;
                for (const animation of el.getAnimations()) {
                    animation.pause();
                    const duration = Number(animation.effect.getComputedTiming().duration);
                    animation.currentTime = duration / 2;
                }
                return getComputedStyle(el).opacity;
            }, leaving);
            expect(opacity).toBe('1');
        }
        await layouts(page, method + '-queue-error');
        state.failure = false;
        await page.locator('.bt-error button').click();
        await expect(page.locator('.bt-card')).toHaveCount(3);
        expect(state.errors).toEqual([]);
    });
}

test('CSS Bradley: Supacolor Orders views, search, table and failed refresh', async ({ page }) => {
    const state = await fixture(page, 'dashboards/supacolor-orders.html');
    await page.goto('/dashboards/supacolor-orders.html');
    await expect(page.locator('a.sc-row')).toHaveCount(1);
    await page.locator('[data-view="all"]').click();
    await expect(page.locator('a.sc-row')).toHaveCount(3);
    await layouts(page, 'supacolor-orders');
    await page.locator('#sc-filter-search').fill('No matching fixture');
    await expect(page.locator('a.sc-row')).toHaveCount(0);
    await page.locator('#sc-filter-clear').click();
    await expect(page.locator('a.sc-row')).toHaveCount(3);
    state.failure = true;
    await page.reload();
    await expect(page.locator('#sc-load-retry')).toBeVisible();
    state.failure = false;
    await page.locator('#sc-load-retry').click();
    await expect(page.locator('a.sc-row').first()).toBeVisible();
    expect(state.errors).toEqual([]);
});

test('CSS Bradley: Transfer Detail PO states, linked job and keyboard dialog', async ({ page }) => {
    const state = await fixture(page, 'pages/transfer-detail.html');
    await page.goto('/pages/transfer-detail.html?id=ST-260908-0001');
    await expect(page.locator('#td-main')).toBeVisible();
    await layouts(page, 'transfer-detail');
    await page.locator('#td-po-input').fill('PO 112898');
    await expect(page.locator('#td-po-preview')).toContainText('112898');
    const trigger = page.locator('[data-id="td-act-delete"]');
    await trigger.click();
    await layouts(page, 'transfer-delete');
    await dismiss(page, '#td-delete-modal', trigger);
    state.record.ShopWorks_PO_Number = '112898';
    await page.reload();
    await expect(page.locator('#td-po-banner')).toHaveClass(/pending/);
    state.record.Supacolor_Order_Number = '900001';
    await page.reload();
    await expect(page.locator('#td-po-banner')).toHaveClass(/linked/);
    await expect(page.locator('#td-supacolor-live-card')).toBeVisible();
    await layouts(page, 'transfer-linked');
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
});

test('CSS Bradley: Screen Print detail keeps actions, empty files and load errors visible', async ({ page }) => {
    const state = await fixture(page, 'pages/transfer-detail.html', { record: { ...transfer, Method: 'Screen Print', Status: 'Ordered', SP_Vendor: 'Fixture printer', SP_Notes: 'Use approved artwork.' }, emptyFiles: true });
    await page.goto('/pages/transfer-detail.html?id=ST-260908-0001');
    await expect(page.locator('#td-main')).toBeVisible();
    await expect(page.locator('[data-id="td-act-cancel"]')).toBeVisible();
    await layouts(page, 'screenprint-detail');
    state.failure = true;
    await page.reload();
    await expect(page.locator('#td-error')).toBeVisible();
    await layouts(page, 'transfer-load-error');
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
});

test('CSS Bradley: Job Detail, native image preview, status dialog and focus return', async ({ page }) => {
    const state = await fixture(page, 'pages/supacolor-job-detail.html');
    await page.goto('/pages/supacolor-job-detail.html?id=101');
    await expect(page.locator('#sjd-content')).toBeVisible();
    await layouts(page, 'job-detail');
    const thumb = page.locator('.sjd-line-thumb--clickable').first();
    await thumb.focus();
    await page.keyboard.press('Enter');
    // Text must remain readable during entrance motion, including on fast CI runners.
    await page.locator('.product-image-modal-content').evaluate(node => {
        for (const animation of node.getAnimations()) { animation.pause(); animation.currentTime = 100; }
    });
    await layouts(page, 'job-image-preview');
    await dismiss(page, '#product-image-modal', thumb);
    const status = page.locator('#sjd-status-btn');
    await status.click();
    await layouts(page, 'job-status');
    await dismiss(page, '#sjd-status-modal', status);
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
});

test('CSS Bradley: screenshot extraction stays inside the open Job Detail dialog', async ({ page }) => {
    const state = await fixture(page, 'pages/supacolor-job-detail.html');
    await page.goto('/pages/supacolor-job-detail.html?id=101');
    const trigger = page.locator('#sjd-paste-btn');
    await trigger.click();
    await page.locator('#sjd-paste-file').setInputFiles(path.join(ROOT, 'favicon.png'));
    await expect(page.locator('#sjd-extract-summary')).toBeVisible();
    await expect(page.locator('#sjd-paste-apply')).toBeEnabled();
    await layouts(page, 'job-extracted');
    await dismiss(page, '#sjd-paste-modal', trigger);
    const writes = state.writes.length;
    await page.evaluate(async () => {
        const bytes = await (await fetch('/favicon.png')).arrayBuffer();
        const clipboard = new DataTransfer();
        clipboard.items.add(new File([bytes], 'fixture.png', { type: 'image/png' }));
        document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 100));
    });
    expect(state.writes.length).toBe(writes);
    expect(state.errors).toEqual([]);
});

test('CSS Bradley: sender file picker opens, reports failed search and closes by keyboard', async ({ page }) => {
    const state = await fixture(page, 'dashboards/bradley-transfers.html');
    await page.goto('/dashboards/bradley-transfers.html?view=steve');
    const trigger = page.locator('#bt-send-another-btn');
    await trigger.click();
    await expect(page.locator('#tas-picker-search-input')).toBeFocused();
    await layouts(page, 'transfer-sender');
    await page.locator('#tas-picker-search-input').fill('Fixture Company');
    await expect(page.locator('.tas-picker-err')).toBeVisible();
    await layouts(page, 'transfer-sender-error');
    await dismiss(page, '#tas-modal', trigger);
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
});


test('CSS Bradley: populated sender picker recovers from link failure and previews the analyzed file', async ({ page }) => {
    const state = await fixture(page, 'dashboards/bradley-transfers.html', { box: true, linkFailure: true });
    await page.goto('/dashboards/bradley-transfers.html?view=steve');
    const trigger = page.locator('#bt-send-another-btn');
    await trigger.click();
    await page.locator('#tas-picker-search-input').fill('Fixture Company');
    await expect(page.locator('.tas-picker-folder')).toBeVisible();
    await page.locator('.tas-picker-folder').click();
    const file = page.locator('.tas-picker-file').first();
    await expect(file).toBeVisible();
    await expect(file.locator('img')).toBeHidden();
    await layouts(page, 'sender-populated');
    let releaseLink;
    const linkGate = new Promise(resolve => { releaseLink = resolve; });
    await page.route('**/api/box/shared-link', async route => { await linkGate; await route.fallback(); }, { times: 1 });
    await file.click();
    await expect(file).toBeDisabled();
    await expect(file).toHaveAttribute('aria-busy', 'true');
    await expect(file).not.toHaveClass(/--added/);
    releaseLink();
    await expect(page.locator('.bt-toast--error')).toBeVisible();
    await expect(file).not.toHaveClass(/--added/);
    await expect(file.locator('.tas-picker-file-add')).toHaveClass(/fa-plus-circle/);
    state.linkFailure = false;
    await file.click();
    await expect(page.locator('.tas-row-card')).toBeVisible();
    await expect(page.locator('#tas-submit-btn')).toBeEnabled();
    await layouts(page, 'sender-analysis');
    await dismiss(page, '#tas-modal', trigger);
    expect(state.writes.map(write => write.path)).toEqual(['/api/box/shared-link', '/api/box/shared-link', '/api/transfer-orders/analyze-link']);
    expect(state.errors).toEqual([]);
});

test('CSS Bradley: broken image preview reports failure and recovers on the next image', async ({ page }) => {
    const state = await fixture(page, 'pages/supacolor-job-detail.html', { brokenImage: true });
    await page.goto('/pages/supacolor-job-detail.html?id=101');
    const thumb = page.locator('.sjd-line-thumb--clickable').first();
    await thumb.click();
    await expect(page.locator('.product-image-unavailable')).toBeVisible();
    await layouts(page, 'job-image-error');
    await dismiss(page, '#product-image-modal', thumb);
    state.brokenImage = false;
    await page.reload();
    await thumb.click();
    await expect(page.locator('#modal-product-img')).toBeVisible();
    await expect(page.locator('.product-image-unavailable')).toBeHidden();
    await dismiss(page, '#product-image-modal', thumb);
    expect(state.errors).toEqual([]);
});

test('CSS Bradley: shared sender retains legacy Steve visibility and dismissal', async ({ page }) => {
    const state = await fixture(page, 'dashboards/art-hub-steve.html');
    await page.goto('/dashboards/art-hub-steve.html');
    await page.locator('#steve-send-supacolor-btn').click();
    await expect(page.locator('#tas-modal')).toBeVisible();
    await expect(page.locator('#tas-picker-search-input')).toBeFocused();
    await expect(page.locator('#tas-mockup-summary')).toBeHidden();
    await page.keyboard.press('Escape');
    await expect(page.locator('#tas-modal')).toBeHidden();
    await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    expect(state.writes).toEqual([]);
});


test('CSS Bradley: Supacolor screenshot list can be reviewed and cancelled before import', async ({ page }) => {
    const state = await fixture(page, 'dashboards/supacolor-orders.html');
    await page.goto('/dashboards/supacolor-orders.html');
    const trigger = page.locator('#sc-backfill-btn');
    await trigger.click();
    await page.locator('#sc-paste-file').setInputFiles(path.join(ROOT, 'favicon.png'));
    await expect(page.locator('#sc-extract-results')).toContainText('900002');
    await expect(page.locator('#sc-backfill-import')).toBeEnabled();
    await layouts(page, 'orders-screenshot-review');
    await expect(page.locator('.sc-preview-row').nth(1).locator('div').nth(1)).toBeVisible();
    await expect(page.locator('.sc-preview-row').nth(1).locator('div').nth(4)).toBeVisible();
    await page.locator('#sc-extract-results').focus();
    for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
    await expect.poll(() => page.locator('#sc-extract-results').evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
    await dismiss(page, '#sc-backfill-modal', trigger);
    expect(state.writes.map(write => write.path).sort()).toEqual(['/api/vision/extract-supacolor-job-detail', '/api/vision/extract-supacolor-jobs-list']);
    expect(state.errors).toEqual([]);
});

for (const builder of ['embroidery', 'screenprint', 'dtf']) {
    test('CSS Bradley: legacy ' + builder + ' thumbnail layouts still switch and reopen correctly', async ({ page }) => {
        await fixture(page, 'quote-builders/' + builder + '-quote-builder.html');
        await page.goto('/quote-builders/' + builder + '-quote-builder.html');
        await page.waitForFunction(() => Boolean(window.productThumbnailModal));
        await page.evaluate(() => window.productThumbnailModal.open('/favicon.png', 'Fixture shirt', 'PC54', 'White'));
        await expect(page.locator('#product-image-modal')).toBeVisible();
        await expect(page.locator('#modal-product-legacy-details')).toBeVisible();
        await expect(page.locator('#modal-product-color')).toHaveText('White');
        await expect(page.locator('#modal-product-meta')).toBeHidden();
        await page.keyboard.press('Escape');
        await expect(page.locator('#product-image-modal')).toBeHidden();
        await page.evaluate(() => window.productThumbnailModal.openGeneric({ imageUrl: '/favicon.png', title: 'Fixture transfer', metaLines: [{ label: 'Item', value: 'WE_A3' }] }));
        await expect(page.locator('#modal-product-legacy-details')).toBeHidden();
        await expect(page.locator('#modal-product-meta')).toContainText('WE_A3');
        await page.keyboard.press('Escape');
        await expect(page.locator('#product-image-modal')).toBeHidden();
        await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
    });
}
