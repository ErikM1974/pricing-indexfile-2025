const { test, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');

// These requests hit the real local server. Unlike visual fixtures, no HTML is
// served from disk and no route handler is replaced. API probes are anonymous
// so none may reach business services; authenticated checks read HTML only.
test('Supacolor detail HTML requires the actual staff session gate', async ({ playwright, request }) => {
    const anonymous = await playwright.request.newContext({ baseURL: 'http://localhost:3400', storageState: { cookies: [], origins: [] } });
    try {
        const response = await anonymous.get('/pages/supacolor-job-detail.html?id=101', { maxRedirects: 0 });
        expect(response.status()).toBe(302);
        expect(response.headers().location).toContain('/auth/saml/login');
        const staffPage = await request.get('/pages/supacolor-job-detail.html?id=101');
        expect(staffPage.status()).toBe(200);
        expect(await staffPage.text()).toContain('data-ui="unified"');
    } finally { await anonymous.dispose(); }
});

test('real server denies anonymous transfer, notes, images and vision relays', async ({ playwright }) => {
    const anonymous = await playwright.request.newContext({ baseURL: 'http://localhost:3400', storageState: { cookies: [], origins: [] } });
    try {
        for (const [method, url] of [
            ['GET', '/api/transfer-orders'], ['GET', '/api/supacolor-jobs'],
            ['GET', '/api/supacolor-jobs/proxy-image?url=https%3A%2F%2Fcdn.supacolor.com%2Ffixture.png'],
            ['POST', '/api/transfer-order-notes'], ['POST', '/api/vision/extract-supacolor'],
            ['POST', '/api/vision/extract-supacolor-jobs-list'], ['POST', '/api/vision/extract-supacolor-job-detail'],
        ]) {
            const response = await anonymous.fetch(url, { method, headers: { Origin: 'https://teamnwca.com', 'X-CRM-API-Secret': 'spoofed-browser-secret' } });
            expect(response.status(), method + ' ' + url).toBe(401);
        }
    } finally { await anonymous.dispose(); }
});

test('customer mockup approval renders without requesting staff transfer data', async ({ page }) => {
    const calls = [], writes = [], errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.context().clearCookies();
    await page.route('**/*', route => route.request().method() === 'GET' ? route.continue() : route.fulfill({ status: 503, json: { error: 'Fixture blocks all business writes' } }));
    await page.route('**/api/**', route => {
        const request = route.request(), url = new URL(request.url());
        calls.push(url.pathname);
        if (request.method() !== 'GET') { writes.push(url.pathname); return route.fulfill({ status: 503, json: { error: 'Fixture blocks writes' } }); }
        if (url.pathname === '/api/portal/fixture/mockup/101') return route.fulfill({ json: {
            success: true, record: { ID: 101, Company_Name: 'Customer Preview Fixture', Design_Number: '900001', Status: 'Awaiting Approval', Submitted_Date: '2026-09-08T09:00:00', Box_Mockup_1: '/favicon.png' }, notes: [], versions: [],
        } });
        if (url.pathname.includes('/embroidery-designs') || url.pathname.includes('/thread-colors')) return route.fulfill({ json: { success: true, records: [] } });
        return route.fulfill({ status: 503, json: { error: 'Unconfigured fixture service' } });
    });
    await page.route('http://localhost:3400/mockup/101?view=customer&cid=fixture', route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(__dirname, '../../pages/mockup-detail.html'), 'utf8') }));
    await page.goto('/mockup/101?view=customer&cid=fixture');
    await expect(page.locator('body')).toHaveClass(/pmd-customer-view/);
    await expect(page.locator('#pmd-design-id')).toContainText('Customer Preview Fixture');
    await expect(page.locator('#pmd-content')).toBeVisible();
    expect(calls).toContain('/api/portal/fixture/mockup/101');
    expect(calls.filter(url => /^\/api\/(?:transfer-order|supacolor-job)/.test(url))).toEqual([]);
    expect(writes).toEqual([]); expect(errors).toEqual([]);
});
