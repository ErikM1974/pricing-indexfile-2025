const { test, expect } = require('@playwright/test'),
    AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'),
    path = require('node:path'),
    fixture = require('../fixtures/announcements-original-content.json');
const root = path.resolve(__dirname, '../..'),
    output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.describe.configure({ mode: 'parallel' });
const rows = Array.from({ length: 6 }, (_, i) => [
    'Team update ' + (i + 1),
    'Review message ' + (i + 1) + ' for the production team.',
    '09/09/2026',
]);
function hosted(file, state) {
    if (state === 'login')
        return '<form id="cbformLogin" aria-label="Hosted sign in"><h3>Sign in</h3><label>Email <input type="email" autocomplete="username"></label><label>Password <input type="password" autocomplete="current-password"></label><button type="button">Sign in</button></form>';
    if (state === 'empty')
        return '<section id="cbformEmpty" aria-label="Hosted results"><h3>Announcements</h3><p role="status">No announcements found</p></section>';
    if (file.includes('create'))
        return '<form id="cbformCreate" aria-label="Hosted announcement fixture" style="min-width:440px"><h3>Announcement details</h3><p>Review fixture only.</p><label style="display:block">Title <input name="title"></label><label style="display:block">Message <textarea name="message" rows="4"></textarea></label><button type="button">Post announcement</button></form>';
    return (
        '<section id="cbformReport" aria-label="Hosted announcements"><h3>Announcements</h3><p>Review fixture only.</p><table class="cbFormTable" style="min-width:850px"><caption>Team announcements</caption><thead><tr>' +
        ['Title', 'Message', 'Published'].map((x) => '<th scope="col">' + x + '</th>').join('') +
        '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + r.map((v) => '<td>' + v + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></section>'
    );
}
async function open(page, file, state = { value: 'loaded' }) {
    const events = { errors: [], writes: [] };
    page.on('pageerror', (e) => events.errors.push(e.message));
    await page.route('**/*', (route) => {
        const req = route.request(),
            url = new URL(req.url());
        if (url.pathname === '/api/csp-report') return route.fulfill({ status: 204 });
        if (!['GET', 'HEAD'].includes(req.method())) {
            events.writes.push(req.url());
            return route.fulfill({ status: 503 });
        }
        if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 503 });
        if (url.hostname === 'c3eku948.caspio.com' && url.pathname.endsWith('/emb')) {
            if (state.value === 'failed') return route.abort('failed');
            return route.fulfill({
                contentType: 'application/javascript',
                body: 'document.write(' + JSON.stringify(hosted(file, state.value)) + ');',
            });
        }
        if (['localhost', '127.0.0.1'].includes(url.hostname)) {
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
    test(
        'announcements: ' + name + ' four widths, navigation and hosted keyboard scrolling',
        async ({ page }) => {
            const events = await open(page, p.file);
            await expect(page.locator('#loadingOverlay')).toBeHidden();
        await expect(page.locator('[aria-current="page"]')).toHaveCSS('background-color', 'rgb(55, 65, 81)');
            for (const width of [1440, 768, 390, 320]) {
                await page.setViewportSize({ width, height: 950 });
                expect(
                    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
                ).toBe(true);
                expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
                await page.screenshot({
                    path: path.join(output, 'announcement-' + name + '-' + width + '.png'),
                    fullPage: true,
                });
            }
            await page.locator('.skip-link').focus();
            await page.keyboard.press('Enter');
            await expect(page.locator('main')).toBeFocused();
            const region = page.locator('.hosted-embed');
            await region.focus();
            await page.keyboard.press('ArrowRight');
            await expect.poll(() => region.evaluate((n) => n.scrollLeft)).toBeGreaterThan(0);
            if (p.file.includes('create')) {
                await page.getByLabel('Title', { exact: true }).fill('Team update');
                await page.getByLabel('Message', { exact: true }).fill('Meet in the showroom.');
                await expect(page.getByLabel('Message', { exact: true })).toHaveValue(
                    'Meet in the showroom.',
                );
            } else
                expect(await page.locator('tbody tr').allTextContents()).toEqual(
                    rows.map((r) => r.join('')),
                );
            await expect(page.locator('[aria-current="page"]')).toHaveAttribute(
                'href',
                '/' + name + '.html',
            );
            expect(events.errors).toEqual([]);
            expect(events.writes).toEqual([]);
        },
    );
    test(
        'announcements: ' +
            name +
            ' unavailable embed leaves the fallback reachable after loading ends',
        async ({ page }) => {
            await page.clock.install();
            const events = await open(page, p.file, { value: 'failed' });
            await expect(page.locator('#loadingOverlay')).toBeVisible();
            await expect(page.locator('#loadingOverlay')).toHaveAttribute('role', 'status');
            await page.clock.fastForward(3100);
            await expect(page.locator('#loadingOverlay')).toBeHidden();
            const link = page.locator('.hosted-help a');
            await expect(link).toBeVisible();
            await expect(link).toHaveAttribute(
                'href',
                p.scripts
                    .find((s) => s.startsWith('https://c3eku948.caspio.com/'))
                    .replace(/\/emb$/, ''),
            );
            await link.focus();
            await expect(link).toBeFocused();
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            expect(events.writes).toEqual([]);
        },
    );
    test(
        'announcements: ' + name + ' hosted login and empty fixtures keep separate states',
        async ({ page }) => {
            const state = { value: 'login' },
                events = await open(page, p.file, state);
            await page.setViewportSize({ width: 320, height: 950 });
            await expect(page.locator('#loadingOverlay')).toBeHidden();
            await page.getByLabel('Email', { exact: true }).fill('review@example.test');
            await page.getByLabel('Password', { exact: true }).fill('review-only');
            expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
            state.value = 'empty';
            await page.reload();
            await expect(page.locator('#loadingOverlay')).toBeHidden();
            await expect(page.getByText('No announcements found', { exact: true })).toBeVisible();
            await expect(page.locator('tbody tr')).toHaveCount(0);
            expect(events.writes).toEqual([]);
        },
    );
    test(
        'announcements: ' + name + ' paper preserves wrapper and synthetic hosted content',
        async ({ page }) => {
            await open(page, p.file);
            await expect(page.locator('#loadingOverlay')).toBeHidden();
            await page.emulateMedia({ media: 'print' });
            await expect(page.locator('.hosted-print-link')).toBeVisible();
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
                path: path.join(output, 'announcement-' + name + '.pdf'),
                format: 'Letter',
                landscape: true,
                printBackground: true,
                preferCSSPageSize: true,
            });
            fs.writeFileSync(
                path.join(output, 'announcement-' + name + '-paper-nodes.json'),
                JSON.stringify(nodes),
            );
            await page.emulateMedia({ media: 'screen' });
            await expect(page.locator('.hosted-print-link')).toBeHidden();
        },
    );
}
