const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs');
const path = require('node:path');
const fixture = require('../fixtures/staff-admin-review-data.json');
const root = path.join(__dirname, '../..');
const output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.describe.configure({ mode: 'parallel' });
test.use({ reducedMotion: 'reduce' });
const files = ['access-admin', 'drive-access', 'portal-directory'];
const endpoints = {
    '/api/crm-proxy/admin-rbac/roles': 'roles',
    '/api/crm-proxy/admin-rbac/pages': 'pages',
    '/api/staff/drive-access': 'drive',
    '/api/mockups': 'mockups',
    '/api/artrequests': 'art',
};
async function open(page, name, state = {}) {
    const events = { writes: [], unexpected: [], errors: [] };
    page.on('pageerror', error => events.errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-09-09T19:00:00Z'));
    await page.addInitScript(() => {
        window.reviewCopies = [];
        window.reviewCopyBlocked = false;
        Object.defineProperty(navigator, 'clipboard', { value: { writeText: text => {
            if (window.reviewCopyBlocked) return Promise.reject(new Error('Blocked fixture'));
            window.reviewCopies.push(text); return Promise.resolve();
        } } });
        window.reviewPrints = 0;
        window.print = () => { window.reviewPrints++; };
    });
    await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname === '/api/csp-report') return route.fulfill({ status: 204, body: '' });
        if (!['GET', 'HEAD'].includes(request.method())) {
            const expected = ['/api/crm-proxy/admin-rbac/roles', '/api/crm-proxy/admin-rbac/pages'].includes(url.pathname);
            (expected ? events.writes : events.unexpected).push({ method: request.method(), path: url.pathname, query: url.search, body: request.postDataJSON() });
            return route.fulfill({ status: expected ? (state.writeStatus || 200) : 503, json: { success: true, error: 'Simulated save failure' } });
        }
        if (url.pathname === '/dashboards/' + name + '.html') return route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(root, url.pathname)) });
        const key = endpoints[url.pathname];
        if (key) {
            const body = state[key] === undefined ? fixture[key] : state[key];
            return route.fulfill(typeof body === 'number' ? { status: body, json: { error: 'Unavailable fixture' } } : { json: body });
        }
        if (url.pathname === '/api/company-contacts/search') return route.fulfill({ json: { contacts: [] } });
        if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503, json: { error: 'Unmocked read blocked' } });
        return route.fallback();
    });
    await page.goto('/dashboards/' + name + '.html');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('h1')).toBeVisible();
    return events;
}
function clean(events, writes = false) {
    expect(events.errors).toEqual([]);
    expect(events.unexpected).toEqual([]);
    if (!writes) expect(events.writes).toEqual([]);
}
async function ready(page, name) {
    await expect(page.locator(name === 'access-admin' ? '#roles-body select' : name === 'drive-access' ? '.da-card' : '.pd-card')).toHaveCount(name === 'access-admin' ? 2 : 3);
}
async function accessible(page) {
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
}
for (const name of files) {
    test('CSS staff admin: ' + name + ' at four widths, keyboard and print', async ({ page }) => {
        test.setTimeout(180000);
        const events = await open(page, name); await ready(page, name);
        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 950 });
            expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
            await accessible(page);
            if (name === 'access-admin') {
                await page.getByRole('button', { name: 'Page Access', exact: true }).click();
                await accessible(page);
                const region = page.getByRole('region', { name: 'Page Access table' });
                await region.focus(); await page.keyboard.press('End');
                if (width <= 768) expect(await region.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
                await page.getByRole('button', { name: 'Staff Roles', exact: true }).click();
            }
            await page.screenshot({ path: path.join(output, 'staff-admin-' + name + '-' + width + '.png'), fullPage: true });
        }
        await page.locator('.skip-link').focus(); await page.keyboard.press('Enter');
        await expect(page.locator('#staff-tool-main')).toBeFocused();
        await page.setViewportSize({ width: 1440, height: 950 });
        if (name === 'access-admin') {
            await page.getByRole('button', { name: 'Page Access', exact: true }).click();
            await page.locator('.aa-emails-in').first().fill('reviewer@example.test,another-long-review-address@example.test');
            await page.locator('.aa-desc-in').first().fill('A longer review note must wrap fully on paper and remain unchanged in the editable table afterward.');
            await page.getByRole('button', { name: 'Staff Roles', exact: true }).click();
        }
        await page.emulateMedia({ media: 'print' });
        if (name === 'access-admin') await expect(page.locator('#panel-pages')).toBeVisible();
        const blocks = await page.locator('h1,h2,p,th,td,.da-stat,.da-person-name,.da-chip,.pd-card-stats,.pd-card-meta').evaluateAll(nodes => nodes.filter(n => n.checkVisibility() && !n.closest('.aa-actions,.aa-add')).map(n => {
            const copy = n.cloneNode(true); copy.querySelectorAll('button,select,input').forEach(el => el.remove());
            return copy.textContent.replace(/\s+/g, ' ').trim();
        }).filter(Boolean));
        const values = name === 'access-admin' ? await page.locator('tbody input,tbody select').evaluateAll(nodes => nodes.map(n => n.value).filter(Boolean)) : [];
        fs.writeFileSync(path.join(output, 'staff-admin-' + name + '-print.json'), JSON.stringify({ blocks, values }));
        await page.pdf({ path: path.join(output, 'staff-admin-' + name + '.pdf'), preferCSSPageSize: true, printBackground: true });
        await page.emulateMedia({ media: 'screen' });
        if (name === 'access-admin') {
            await expect(page.locator('#panel-pages')).toBeHidden();
            await expect(page.locator('.aa-print-value')).toHaveCount(0);
            await expect(page.locator('.aa-desc-in').first()).toHaveValue('A longer review note must wrap fully on paper and remain unchanged in the editable table afterward.');
        }
        clean(events);
    });
}
test('CSS staff admin: role and page saves retain exact requests, errors and removal confirmation', async ({ page }) => {
    const state = { writeStatus: 503 }, events = await open(page, 'access-admin', state); await ready(page, 'access-admin');
    const role = page.locator('tr[data-email="operator@example.test"]');
    await role.locator('select').selectOption('art'); await role.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('#aa-status')).toContainText('Error: Simulated save failure'); await expect(role.locator('select')).toHaveValue('art');
    expect(events.writes[0]).toEqual({ method: 'PUT', path: '/api/crm-proxy/admin-rbac/roles', query: '', body: { email: 'operator@example.test', role: 'art' } });
    state.writeStatus = 200; await role.getByRole('button', { name: 'Save', exact: true }).click(); await expect(page.locator('#aa-status')).toContainText('Saved operator@example.test');
    page.once('dialog', dialog => dialog.dismiss()); await role.getByRole('button', { name: 'Remove' }).click(); expect(events.writes).toHaveLength(2);
    page.once('dialog', dialog => dialog.accept()); await role.getByRole('button', { name: 'Remove' }).click();
    await expect.poll(() => events.writes.length).toBe(3); expect(events.writes[2].query).toBe('?email=operator%40example.test');
    const tab = page.getByRole('button', { name: 'Page Access', exact: true }); await tab.focus(); await page.keyboard.press('Enter'); await expect(tab).toHaveAttribute('aria-pressed', 'true');
    const rule = page.locator('tr[data-page="design-gallery.html"]');
    await rule.locator('.aa-roles-in').fill('art'); await rule.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('#aa-status')).toContainText('Saved design-gallery.html');
    expect(events.writes[3].body).toEqual({ page: 'design-gallery.html', allowedRoles: 'art', allowedEmails: 'reviewer@example.test', description: 'Artwork workspace' });
    page.once('dialog', dialog => dialog.dismiss()); await rule.getByRole('button', { name: 'Remove' }).click(); expect(events.writes).toHaveLength(4);
    page.once('dialog', dialog => dialog.accept()); await rule.getByRole('button', { name: 'Remove' }).click(); await expect.poll(() => events.writes.length).toBe(5);
    expect(events.writes[4]).toMatchObject({ method: 'DELETE', query: '?page=design-gallery.html' }); clean(events, true);
});
test('CSS staff admin: new permission entries keep input on failed save and clear only after success', async ({ page }) => {
    const state = { writeStatus: 503 }, events = await open(page, 'access-admin', state);
    await page.locator('#new-role-email').fill('new@example.test'); await page.locator('#new-role-role').selectOption('production'); await page.locator('#add-role-btn').click();
    await expect(page.locator('#aa-status')).toContainText('Error:'); await expect(page.locator('#new-role-email')).toHaveValue('new@example.test');
    state.writeStatus = 200; await page.locator('#add-role-btn').click(); await expect(page.locator('#new-role-email')).toHaveValue('');
    await page.getByRole('button', { name: 'Page Access', exact: true }).click();
    for (const [id, value] of Object.entries({ 'new-page-name': 'review.html', 'new-page-roles': 'art', 'new-page-emails': 'new@example.test', 'new-page-desc': 'Review note' })) await page.locator('#' + id).fill(value);
    state.writeStatus = 503; await page.locator('#add-page-btn').click(); await expect(page.locator('#aa-status')).toContainText('Error:'); await expect(page.locator('#new-page-name')).toHaveValue('review.html');
    state.writeStatus = 200; await page.locator('#add-page-btn').click(); await expect(page.locator('#new-page-name')).toHaveValue('');
    expect(events.writes[3].body).toEqual({ page: 'review.html', allowedRoles: 'art', allowedEmails: 'new@example.test', description: 'Review note' }); clean(events, true);
});
test('CSS staff admin: failed permissions reads and empty tables stay explicit', async ({ page }) => {
    const state = { roles: 403, pages: 503 }, events = await open(page, 'access-admin', state);
    await expect(page.locator('#roles-body')).toContainText('Failed to load'); await accessible(page);
    await page.getByRole('button', { name: 'Page Access', exact: true }).click(); await expect(page.locator('#pages-body')).toContainText('Failed to load');
    state.roles = { rows: [] }; state.pages = { rows: [] }; await page.reload(); await expect(page.locator('#roles-body')).toContainText('No roles yet');
    await page.getByRole('button', { name: 'Page Access', exact: true }).click(); await expect(page.locator('#pages-body')).toContainText('No restricted pages'); clean(events);
});
test('CSS staff admin: drive search, rights, view switches and print remain read only', async ({ page }) => {
    const events = await open(page, 'drive-access'); await ready(page, 'drive-access');
    await expect(page.locator('#da-verified')).toHaveText('September 9, 2026');
    const designer = page.locator('.da-person').filter({ hasText: 'Sample Designer' }); const reviewer = page.locator('.da-person').filter({ hasText: 'Sample Reviewer' });
    await expect(designer.locator('.da-chip--modify')).toHaveText('B:'); await expect(designer.locator('.da-chip--read')).toHaveCount(0);
    await expect(reviewer.locator('.da-chip--read')).toHaveText('B:'); await expect(reviewer.locator('.da-chip--modify')).toHaveCount(0);
    await page.locator('#da-search').fill('no such person'); await expect(page.locator('#da-grid')).toContainText('No matching');
    await page.locator('#da-search').fill(''); await page.getByRole('button', { name: 'By drive' }).click(); await expect(page.locator('.da-card')).toHaveCount(2);
    await accessible(page); await page.locator('#da-search').fill('review.invalid/designs'); await expect(page.locator('.da-card')).toHaveCount(1);
    await expect(page.locator('.da-card')).toContainText('Review Admin'); await page.getByRole('button', { name: 'Print', exact: true }).click(); expect(await page.evaluate(() => window.reviewPrints)).toBe(1); clean(events);
});
for (const failure of [401, 403, 503, {}]) test('CSS staff admin: drive failure ' + JSON.stringify(failure) + ' is readable and recovers', async ({ page }) => {
    const state = { drive: failure }, events = await open(page, 'drive-access', state);
    await expect(page.locator('#da-status')).toHaveAttribute('role', 'alert'); await expect(page.locator('#da-search')).toBeDisabled();
    await expect(page.locator('#da-grid')).toContainText('No access data loaded'); await accessible(page);
    state.drive = fixture.drive; await page.getByRole('button', { name: 'Try again' }).click(); await ready(page, 'drive-access'); await expect(page.locator('#da-search')).toBeEnabled(); clean(events);
});
test('CSS staff admin: portal search, sort, counts and separate preview/customer destinations', async ({ page }) => {
    const events = await open(page, 'portal-directory'); await ready(page, 'portal-directory');
    await expect(page.locator('#pd-stats')).toHaveText('3 companies · 2 mockups · 2 art requests');
    await expect(page.getByRole('link', { name: 'Preview portal for Alpha Company' })).toHaveAttribute('href', '/portal-admin/preview/101');
    await expect(page.getByRole('link', { name: 'Preview portal for Alpha Company' })).toHaveAttribute('rel', 'noopener');
    await page.getByRole('button', { name: 'Copy portal link for Alpha Company' }).click(); await expect(page.locator('#pd-toast')).toHaveText('Portal link copied!');
    expect(await page.evaluate(() => window.reviewCopies)).toEqual(['https://www.teamnwca.com/portal/101']);
    await page.evaluate(() => { window.reviewCopyBlocked = true; }); await page.getByRole('button', { name: 'Copy portal link for Beta Company' }).click();
    await expect(page.locator('#pd-toast')).toContainText('https://www.teamnwca.com/portal/202'); await accessible(page);
    await expect(page.locator('[data-company="no id company"] button')).toBeDisabled(); await expect(page.locator('[data-company="no id company"] a')).toHaveCount(0);
    await page.locator('#pd-sort').selectOption('nameAZ'); expect(await page.locator('.pd-card-company').allTextContents()).toEqual(['Alpha Company', 'Beta Company', 'No ID Company']);
    await page.locator('#pd-sort').selectOption('mostItems'); await expect(page.locator('.pd-card-company').first()).toHaveText('Alpha Company');
    await page.locator('#pd-search').fill('beta'); await expect(page.locator('.pd-card')).toHaveCount(1); await expect(page.locator('.pd-card-company')).toHaveText('Beta Company');
    await page.locator('#pd-search').fill('absent'); await expect(page.locator('#pd-grid')).toContainText('No companies'); clean(events);
});
for (const feed of ['mockups', 'art']) test('CSS staff admin: failed ' + feed + ' feed cannot look like an empty directory', async ({ page }) => {
    const state = { [feed]: 503 }, events = await open(page, 'portal-directory', state);
    await expect(page.locator('#pd-error')).toBeVisible(); await expect(page.locator('#pd-empty')).toBeHidden(); await accessible(page);
    state[feed] = fixture[feed]; await page.locator('#pd-retry').click(); await ready(page, 'portal-directory'); await expect(page.locator('#pd-error')).toBeHidden(); clean(events);
});
test('CSS staff admin: empty portal feeds keep the empty state visible', async ({ page }) => {
    const events = await open(page, 'portal-directory', { mockups: { records: [] }, art: { records: [] } });
    await expect(page.locator('#pd-empty')).toBeVisible(); await expect(page.locator('#pd-error')).toBeHidden(); clean(events);
});
