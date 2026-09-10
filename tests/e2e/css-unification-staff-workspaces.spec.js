const { test, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const source = require('../fixtures/staff-workspaces-original-content.json');
const drainBaseline = require('../fixtures/staff-workspaces-drainpro-original-browser.json');
const shiftBaseline = require('../fixtures/staff-workspaces-shifts-original-browser.json');
const AxeBuilder = require('@axe-core/playwright').default;
const root = path.resolve(__dirname, '../..'), output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.use({ reducedMotion: 'reduce', timezoneId: 'America/Los_Angeles' });
const providerPaths = ['/dp/a0e15000da6b6fa1d16145b4ab86/emb', '/dp/a0e15000848e0baf43604a908d78/emb'];
const reactPaths = ['/react@18.3.1/umd/react.production.min.js', '/react-dom@18.3.1/umd/react-dom.production.min.js', '/@babel/standalone@7.29.0/babel.min.js'];

async function open(page, name, state = {}) {
    const events = { errors: [], writes: [], unknown: [], missing: [], providers: [] };
    page.on('pageerror', e => events.errors.push(e.message));
    await page.clock.setFixedTime(new Date('2026-09-10T18:00:00Z'));
    await page.addInitScript(() => { window.print = () => { window.__printCalls = (window.__printCalls || 0) + 1; }; });
    await page.route('**/*', async route => {
        const req = route.request(), u = new URL(req.url()), p = u.pathname;
        if (!['GET', 'HEAD'].includes(req.method()) || p.startsWith('/api/quote-sequence/') || u.searchParams.get('autoAdd') === 'true') {
            events.writes.push({ path: p, method: req.method(), body: req.postData() });
            return route.fulfill({ status: 503, json: { error: 'Synthetic write denied' } });
        }
        if (state.block && state.block(u)) return route.abort();
        if (u.hostname === 'c3eku948.caspio.com' && providerPaths.includes(p)) {
            events.providers.push(p);
            const title = p === providerPaths[0] ? 'Synthetic label records' : 'Synthetic bundle records';
            const html = '<html lang="en"><title>' + title + '</title><main><h1>' + title + '</h1><p>External provider boundary: synthetic data only.</p><table><caption>Sample approved employee</caption><tr><th>Name</th><th>Size</th><th>Status</th></tr><tr><td>Cedar Example</td><td>XL</td><td>Approved</td></tr></table></main></html>';
            return route.fulfill({ contentType: 'application/javascript', body: '(function(){const f=document.createElement("iframe");f.title=' + JSON.stringify(title) + ';f.width="100%";f.height="360";f.srcdoc=' + JSON.stringify(html) + ';document.currentScript.parentElement.appendChild(f);})();' });
        }
        if ((u.hostname === 'fonts.googleapis.com' && p === '/css2') || (u.hostname === 'cdnjs.cloudflare.com' && p === '/ajax/libs/font-awesome/6.4.0/css/all.min.css')) return route.continue();
        if (u.hostname === 'unpkg.com' && reactPaths.includes(p)) return route.continue();
        const capturedScript = ['localhost', '127.0.0.1'].includes(u.hostname) && /\.(?:js|jsx)$/.test(p) && source.hashes[p.slice(1)];
        if (p.startsWith('/api/') || (['fetch', 'xhr'].includes(req.resourceType()) && !capturedScript)) { events.unknown.push(req.url()); return route.fulfill({ status: 503, json: { error: 'Unmapped synthetic API' } }); }
        if (['localhost', '127.0.0.1'].includes(u.hostname)) {
            const file = path.resolve(root, '.' + p), retired = state.original && (source.retiredStyles || []).find(r => '/' + r.file === p);
            if (retired) return route.fulfill({ contentType: 'text/css', body: retired.css });
            if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { events.missing.push(p); return route.fulfill({ status: 404 }); }
            let body = fs.readFileSync(file);
            if (state.original && source.hashes[p.slice(1)]) {
                const html = source.pages.find(r => r.file === p.slice(1));
                let original = html ? html.html : body.toString('utf8').replace(/\r\n/g, '\n');
                if (!html) for (const change of source.changes.filter(c => c.file === p.slice(1)).reverse()) { expect(original.split(change.after).length - 1).toBe(change.count); original = original.split(change.after).join(change.before); }
                expect(crypto.createHash('sha256').update(original).digest('hex')).toBe(source.hashes[p.slice(1)]); body = Buffer.from(original);
            }
            return route.fulfill({ contentType: { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.jsx': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.pdf': 'application/pdf' }[path.extname(file)] || 'application/octet-stream', body });
        }
        if (['font', 'image'].includes(req.resourceType())) return route.continue();
        events.unknown.push(req.url()); return route.abort();
    });
    await page.goto('/dashboards/' + name + '.html'); await page.evaluate(() => document.fonts.ready);
    return events;
}

test('CSS staff workspaces: preserve the original DrainPro provider boundaries, tab content and four widths', async ({ page }) => {
    const events = await open(page, 'DrainPro-Bundle', { original: true }), views = [];
    await expect(page.locator('iframe')).toHaveCount(2);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const tab of ['labels', 'employees']) {
            const button = page.locator('.tab-button').nth(tab === 'labels' ? 0 : 1);
            await button.focus(); await page.keyboard.press('Enter');
            await expect(page.locator('#' + tab + '-tab')).toHaveClass(/active/);
            views.push({ width, tab, scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), title: await page.title(), text: await page.locator('#' + tab + '-tab').innerText(), links: await page.locator('a[href]').evaluateAll(ns => ns.map(n => n.getAttribute('href'))) });
            await page.screenshot({ path: path.join(output, 'staff-workspaces-drainpro-original-' + tab + '-' + width + '.png'), fullPage: true });
        }
    }
    expect(events.providers.sort()).toEqual([...providerPaths].sort());
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => document.getAnimations().forEach(animation => animation.finish()));
    await page.pdf({ path: path.join(output, 'staff-workspaces-drainpro-original.pdf'), format: 'Letter', printBackground: true, preferCSSPageSize: true });
    fs.writeFileSync(path.join(output, 'staff-workspaces-drainpro-original-browser.json'), JSON.stringify({ base: source.base, views, events }, null, 2) + '\n');
});

async function shiftWorkflow(page, originalView) {
    const events = await open(page, 'production-shifts', { original: originalView });
    await expect(page.locator('h1')).toHaveText('Production Shifts');
    const departments = [], views = [], details = [];
    for (const dept of ['All', 'Embroidery', 'DTG', 'Ruthie/Mikalah']) {
        await page.getByRole('button', { name: new RegExp('^' + dept.replace('/', '\\/') + '\\s') }).click();
        departments.push({ dept, tables: await page.locator('table').evaluateAll(ns => ns.map(n => [...n.rows].map(r => [...r.cells].map(c => c.textContent.replace(/\s+/g, ' ').trim())))), timeline: await page.locator('.timeline-card').innerText() });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.pdf({ path: path.join(output, 'staff-workspaces-shifts-' + (originalView ? 'original-' : '') + dept.replace(/[^a-z]/gi, '-') + '.pdf'), preferCSSPageSize: true, printBackground: true });
    }
    await page.getByRole('button', { name: /^All\s/ }).click();
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        views.push({ width, scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth), title: await page.title(), main: await page.locator('main').innerText() });
        await page.screenshot({ path: path.join(output, 'staff-workspaces-shifts-' + (originalView ? 'original-' : '') + width + '.png'), fullPage: true });
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const names = await page.evaluate(() => window.NWCA_SCHEDULE.map(e => e.name));
    for (const name of names) {
        await page.getByRole('button', { name: name + ' — show shift details', exact: true }).first().click();
        await expect(page.getByRole('dialog')).toBeVisible();
        details.push({ name, text: await page.getByRole('dialog').innerText() });
        await page.keyboard.press('Escape');
    }
    const data = await page.evaluate(() => ({ schedule: window.NWCA_SCHEDULE, segments: window.NWCA_SCHEDULE.map(e => ({ id: e.id, segments: window.NWCA_HELPERS.segments(e) })) }));
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
    const result = { base: source.base, departments, views, details, data, events };
    fs.writeFileSync(path.join(output, 'staff-workspaces-shifts-' + (originalView ? 'original-' : '') + 'browser.json'), JSON.stringify(result, null, 2) + '\n');
    return result;
}

test('CSS staff workspaces: original production schedule retains every department, employee detail and paper view', async ({ page }) => {
    await shiftWorkflow(page, true);
});

test('CSS staff workspaces: current production schedule preserves original records, department tables and segment math', async ({ page }) => {
    // CSS sentence case is deliberate; source/data guards still compare exact original values.
    const current = await shiftWorkflow(page, false), norm = value => value.replace(/\s+/g, ' ').trim().toLowerCase();
    expect(current.data).toEqual(shiftBaseline.data);
    expect(current.departments.map(d => ({ ...d, timeline: norm(d.timeline) }))).toEqual(shiftBaseline.departments.map(d => ({ ...d, timeline: norm(d.timeline) })));
    expect(current.details.map(d => ({ ...d, text: norm(d.text) }))).toEqual(shiftBaseline.details.map(d => ({ ...d, text: norm(d.text) })));
    for (const view of current.views) {
        const original = shiftBaseline.views.find(v => v.width === view.width);
        expect(norm(view.main)).toBe(norm(original.main));
        expect(view.scrollWidth).toBeLessThanOrEqual(view.width);
    }
});

test('CSS staff workspaces: production schedule layout and accessibility audit', async ({ page }) => {
    const events = await open(page, 'production-shifts'), reports = [];
    await expect(page.locator('h1')).toHaveText('Production Shifts');
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect(page.locator('.topbar-right a').first()).toBeVisible();
        await expect(page.locator('.topbar-right a').last()).toBeVisible();
        const geometry = await page.evaluate(() => {
            const width = window.innerWidth;
            return { scrollWidth: document.documentElement.scrollWidth,
                overflow: [...document.querySelectorAll('body *')].filter(n => {
                    const r = n.getBoundingClientRect();
                    return r.width > 0 && r.right > width + 0.5 && !n.closest('.master-scroll, .timeline-scroll');
                }).map(n => ({ tag: n.tagName, class: n.className, right: n.getBoundingClientRect().right })),
                links: [...document.querySelectorAll('.topbar-right a')].map(n => ({ text: n.textContent, background: getComputedStyle(n).backgroundColor, color: getComputedStyle(n).color })) };
        });
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        reports.push({ width, geometry, violations: axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, reason: n.failureSummary })) })) });
    }
    fs.writeFileSync(path.join(output, 'staff-workspaces-shifts-layout-audit.json'), JSON.stringify(reports, null, 2) + '\n');
    for (const report of reports) { expect(report.geometry.scrollWidth).toBeLessThanOrEqual(report.width); expect(report.violations).toEqual([]); }
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
});

test('CSS staff workspaces: production detail contains focus and its schedule regions scroll by keyboard', async ({ page }) => {
    const events = await open(page, 'production-shifts');
    for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        const trigger = page.getByRole('button', { name: 'Kanha Chhorn — show shift details', exact: true }).first();
        await trigger.focus(); await page.keyboard.press('Enter');
        await expect(page.getByRole('dialog')).toBeVisible();
        const close = page.getByRole('button', { name: 'Close shift details' });
        await expect(close).toBeFocused();
        await page.keyboard.press('Tab'); await expect(close).toBeFocused();
        await page.keyboard.press('Shift+Tab'); await expect(close).toBeFocused();
        await expect(page.locator('.ps-screen')).toHaveAttribute('inert', '');
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(axe.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
        await page.screenshot({ path: path.join(output, 'staff-workspaces-shifts-detail-' + width + '.png'), fullPage: false });
        await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
        await expect(page.locator('.ps-screen')).not.toHaveAttribute('inert', '');
    }
    for (const name of ['Master production schedule', 'Production shift timeline']) {
        const region = page.getByRole('region', { name }); await region.focus(); await page.keyboard.press('ArrowRight');
        await expect.poll(() => region.evaluate(n => n.scrollLeft)).toBeGreaterThan(0);
    }
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
});

test('CSS staff workspaces: expanded schedule reference remains readable at four widths', async ({ page }) => {
    const events = await open(page, 'production-shifts');
    const summary = page.locator('.rules-source summary');
    await summary.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.rules-source')).toHaveAttribute('open', '');
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
        expect(axe.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
    }
    await page.locator('.rules-source').screenshot({ path: path.join(output, 'staff-workspaces-shifts-reference-320.png') });
    await summary.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.rules-source')).not.toHaveAttribute('open', '');
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
});

for (const missing of ['react', 'data']) test('CSS staff workspaces: missing ' + missing + ' keeps a readable schedule recovery link', async ({ page }) => {
    const events = await open(page, 'production-shifts', { block: u => missing === 'react' ? u.hostname === 'unpkg.com' && u.pathname === reactPaths[0] : u.pathname === '/dashboards/production-shifts/data.js' });
    await page.setViewportSize({ width: 320, height: 1000 });
    await expect(page.locator('#schedule-load-state')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Reload schedule' })).toHaveAttribute('href', '/dashboards/production-shifts.html');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect(events.writes).toEqual([]); expect(events.unknown).toEqual([]);
});

for (const width of [1440, 768, 390, 320]) test('CSS staff workspaces: DrainPro ' + width + ' retains content, accessible tabs and contained providers', async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const events = await open(page, 'DrainPro-Bundle');
    await expect(page.locator('iframe')).toHaveCount(2);
    for (const tab of ['labels', 'employees']) {
        const button = page.locator('#' + tab + '-tab-button');
        await button.click();
        await expect(button).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#' + tab + '-tab')).toBeVisible();
        const original = drainBaseline.views.find(v => v.width === width && v.tab === tab);
        const norm = s => s.replace(/\s+/g, ' ').trim();
        expect(norm(await page.locator('#' + tab + '-tab').innerText())).toBe(norm(original.text));
        expect(await page.locator('a[href]:not(.skip-link)').evaluateAll(ns => ns.map(n => n.getAttribute('href')))).toEqual(original.links);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).exclude('.table-container').analyze();
        expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
        await page.screenshot({ path: path.join(output, 'staff-workspaces-drainpro-' + tab + '-' + width + '.png'), fullPage: true });
    }
    expect(events.providers.sort()).toEqual([...providerPaths].sort());
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
});

test('CSS staff workspaces: DrainPro keyboard and direct calls retain exactly one selected view', async ({ page }) => {
    const events = await open(page, 'DrainPro-Bundle');
    await page.getByRole('tab').first().focus();
    for (const [key, id] of [['ArrowRight', 'employees'], ['ArrowRight', 'labels'], ['End', 'employees'], ['Home', 'labels'], ['ArrowLeft', 'employees']]) {
        await page.keyboard.press(key);
        await expect(page.locator('#' + id + '-tab-button')).toBeFocused();
        await expect(page.getByRole('tab', { selected: true })).toHaveCount(1);
        await expect(page.getByRole('tabpanel')).toHaveCount(1);
    }
    await page.evaluate(() => { window.switchTab('labels'); window.switchTab('missing'); });
    await expect(page.locator('#labels-tab-button')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#labels-tab')).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
    await expect(page.locator('.tab-content[hidden]')).toHaveCount(0);
    await page.pdf({ path: path.join(output, 'staff-workspaces-drainpro.pdf'), preferCSSPageSize: true, printBackground: true });
    await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    for (const kind of ['errors', 'unknown', 'missing', 'writes']) expect(events[kind]).toEqual([]);
});
