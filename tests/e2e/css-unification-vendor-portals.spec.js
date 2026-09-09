const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'),
    path = require('node:path');
const fixture = require('../fixtures/vendor-portals-original-content.json');
const root = path.resolve(__dirname, '../..'),
    output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.describe.configure({ mode: 'parallel' });
const rows = Array.from({ length: 12 }, (_, i) => [
    'REVIEW-' + (100 + i),
    'Sample vendor account ' + (i + 1),
    '09/09/2026',
    ['$1,204.50', '$95.00', '$2,456.71'][i % 3],
    'Open',
]);
function report(state) {
    if (state === 'login')
        return '<form aria-label="Hosted portal sign in"><h2>Portal sign in</h2><p>Review fixture only.</p><label>Email <input type="email" name="email" autocomplete="username"></label><label>Password <input type="password" name="password" autocomplete="current-password"></label><button type="button">Sign in</button></form>';
    if (state === 'empty')
        return '<section aria-label="Hosted portal results"><h2>Invoices</h2><p role="status">No records found</p></section>';
    return (
        '<section aria-label="Hosted portal report"><h2>Invoices and credits</h2><form><label>Search records <input name="search"></label> <button type="button">Search</button></form><table class="cbFormTable" style="min-width:900px"><caption>Review data only</caption><thead><tr>' +
        ['Reference', 'Account', 'Date', 'Amount', 'Status']
            .map((x) => '<th scope="col">' + x + '</th>')
            .join('') +
        '</tr></thead><tbody>' +
        rows
            .map((row) => '<tr>' + row.map((x) => '<td>' + x + '</td>').join('') + '</tr>')
            .join('') +
        '</tbody></table></section>'
    );
}
async function open(page, file, state = 'report') {
    const events = { errors: [], writes: [] };
    page.on('pageerror', (e) => events.errors.push(e.message));
    await page.route('**/*', (route) => {
        const req = route.request(),
            url = new URL(req.url());
        if (url.pathname === '/api/csp-report') return route.fulfill({ status: 204 });
        if (!['GET', 'HEAD'].includes(req.method())) {
            events.writes.push(req.url());
            return route.fulfill({ status: 503, json: { error: 'Actual vendor writes blocked' } });
        }
        if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503 });
        if (url.hostname === 'c3eku948.caspio.com' && url.pathname.endsWith('/emb')) {
            if (state === 'failed') return route.abort('failed');
            return route.fulfill({
                contentType: 'application/javascript',
                body: 'document.write(' + JSON.stringify(report(state)) + ');',
            });
        }
        if (['localhost', '127.0.0.1', 'vendor.local'].includes(url.hostname)) {
            const f = path.resolve(root, '.' + decodeURIComponent(url.pathname));
            if (!f.startsWith(root + path.sep) || !fs.existsSync(f) || !fs.statSync(f).isFile())
                return route.fulfill({ status: 404 });
            return route.fulfill({
                contentType:
                    {
                        '.html': 'text/html',
                        '.css': 'text/css',
                        '.js': 'application/javascript',
                        '.svg': 'image/svg+xml',
                        '.woff2': 'font/woff2',
                    }[path.extname(f)] || 'application/octet-stream',
                body: fs.readFileSync(f),
            });
        }
        return route.continue();
    });
    await page.goto('/' + file);
    await page.evaluate(() => document.fonts.ready);
    return events;
}
for (const p of fixture.pages) {
    const name = path.basename(p.file, '.html');
    test(`vendor: ${name} four widths and keyboard-scrolling preserve report data`, async ({
        page,
    }) => {
        const events = await open(page, p.file);
        await expect(page.locator('tbody tr')).toHaveCount(rows.length);
        for (const width of [1440, 768, 390, 320]) {
            await page.setViewportSize({ width, height: 950 });
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            await page.screenshot({
                path: path.join(output, 'vendor-' + name + '-' + width + '.png'),
                fullPage: true,
            });
        }
        await page.locator('.skip-link').focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('main')).toBeFocused();
        const region = page.locator('.vendor-embed');
        await region.focus();
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => region.evaluate((n) => n.scrollLeft)).toBeGreaterThan(0);
        expect(await page.locator('tbody tr').allTextContents()).toEqual(
            rows.map((row) => row.join('')),
        );
        await page.getByLabel('Search records').fill('REVIEW-102');
        await expect(page.getByLabel('Search records')).toHaveValue('REVIEW-102');
        expect(events.errors).toEqual([]);
        expect(events.writes).toEqual([]);
    });
    test(`vendor: ${name} failed embed retains a keyboard-accessible hosted destination`, async ({
        page,
    }) => {
        const events = await open(page, p.file, 'failed'),
            link = page.locator('.vendor-help a');
        await expect(link).toHaveAttribute('href', p.embeds[0].replace(/\/emb$/, ''));
        await expect(link).toBeVisible();
        await link.focus();
        await expect(link).toBeFocused();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        expect(events.writes).toEqual([]);
    });
    test(`vendor: ${name} externally owned sign-in and empty results remain usable`, async ({
        page,
    }) => {
        await open(page, p.file, 'login');
        await page.setViewportSize({ width: 320, height: 950 });
        await page.getByLabel('Email', { exact: true }).fill('review@example.test');
        await page.getByLabel('Password', { exact: true }).fill('review-only');
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
        // Replace only this synthetic provider response; never submit a real sign-in.
        await page.route('**/dp/*/emb', (route) =>
            route.fulfill({
                contentType: 'application/javascript',
                body: 'document.write(' + JSON.stringify(report('empty')) + ');',
            }),
        );
        await page.reload();
        await expect(page.getByRole('status')).toHaveText('No records found');
        await expect(page.locator('tbody tr')).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    });
    test(`vendor: ${name} paper retains every synthetic invoice value and portal destination`, async ({
        page,
    }) => {
        await open(page, p.file);
        await page.emulateMedia({ media: 'print' });
        await expect(page.locator('.vendor-print-link')).toBeVisible();
        const nodes = await page.locator('main').evaluate((main) => {
            const values = [],
                w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
            while (w.nextNode()) {
                const n = w.currentNode,
                    t = n.textContent.replace(/\s+/g, ' ').trim();
                if (!t || n.parentElement.closest('script,style')) continue;
                const r = document.createRange();
                r.selectNode(n);
                if (r.getBoundingClientRect().width && r.getBoundingClientRect().height)
                    values.push(t);
            }
            return values;
        });
        await page.pdf({
            path: path.join(output, 'vendor-' + name + '.pdf'),
            format: 'Letter',
            landscape: true,
            printBackground: true,
            preferCSSPageSize: true,
        });
        fs.writeFileSync(
            path.join(output, 'vendor-' + name + '-paper-nodes.json'),
            JSON.stringify(nodes),
        );
        await page.emulateMedia({ media: 'screen' });
        await expect(page.locator('.vendor-print-link')).toBeHidden();
        await expect(page.locator('tbody tr')).toHaveCount(rows.length);
    });
}
