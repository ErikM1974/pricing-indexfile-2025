const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');
const libraryRows = [
  { ID_Design: '53001', CompanyName: 'Fixture Apparel', Rep_Mockup: '/favicon.png', Date_Created: '2026-09-08', Rep_Mockup_Meta: JSON.stringify({ garmentName: 'Navy', placement: 'Full Front', printWidthIn: 10, threads: ['Navy', 'White'] }) },
  { ID_Design: '53002', CompanyName: 'Cascade Field Services', Rep_Mockup: '/favicon.png', Date_Created: '2026-09-08', Rep_Mockup_Meta: '{malformed metadata' },
];
const mockups = [
  ...['Submitted', 'In Progress', 'Awaiting Approval', 'Revision Requested'].map((Status, index) => ({ ID: 701 + index, Company_Name: ['Fixture Apparel', 'Cascade Field Services', 'Cedar Workshop', 'West Sound Team'][index], Design_Number: String(53001 + index), Design_Name: 'Crew logo', Status, Submitted_By: 'fixture@example.test', Submitted_Date: '2026-09-08T10:00:00', Due_Date: '2026-09-09', Is_Rush: index === 0, Is_On_Hold: false, Revision_Count: 2, Box_Mockup_1: '/favicon.png', Garment_Info: 'PC54 Navy', Print_Location: 'Left Chest', Logo_Width: 3, Logo_Height: 2, Stitch_Count: 6500, Thread_Colors: 'Navy, White' })),
  ...Array.from({ length: 6 }, (_, index) => ({ ID: 710 + index, Company_Name: 'Completed customer ' + index, Design_Number: String(54001 + index), Status: 'Completed', Submitted_Date: '2026-09-08T09:00:00' })),
  { ID: 720, Company_Name: 'Approved Customer', Design_Number: '54011', Status: 'Approved', Submitted_Date: '2026-09-08T09:00:00' },
  { ID: 721, Company_Name: 'Paused Customer', Design_Number: '54012', Status: 'In Progress', Is_On_Hold: true, On_Hold_Note: 'Waiting for customer', Submitted_Date: '2026-09-08T09:00:00' },
];
async function fixture(page, file, options = {}) {
  const state = { mockups: mockups.map(row => ({ ...row })), rows: libraryRows.map(row => ({ ...row })), failure: false, writes: [], errors: [], ...options };
  page.on('pageerror', error => state.errors.push(error.message));
  await page.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.fulfill({ status: 503, json: { error: 'Visual fixture blocks external writes' } }));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url());
    if (!['GET', 'HEAD'].includes(request.method())) {
      state.writes.push({ path: url.pathname, body: request.postData() });
      if (url.pathname.endsWith('/status')) {
        if (state.statusWait) await state.statusWait;
        if (state.allowStatus) {
          const id = Number(url.pathname.split('/')[3]);
          const row = state.mockups.find(item => item.ID === id);
          if (row) row.Status = request.postDataJSON().status;
          return route.fulfill({ json: { success: true } });
        }
      }
      if (url.pathname.endsWith('/auto-recover-mockup')) {
        if (state.recoveryWait) await state.recoveryWait;
        if (state.allowRecovery) { state.broken = false; return route.fulfill({ json: { status: 'recovered', confidence: 'high', newFileName: 'fixture.png' } }); }
        return route.fulfill({ status: 503, json: { status: 'error', error: 'Fixture recovery unavailable' } });
      }
      if (url.pathname.endsWith('/upload-file')) return route.fulfill({ status: 503, json: { error: 'Fixture upload unavailable' } });
      return route.fulfill({ status: 503, json: { error: 'No business writes in visual fixture' } });
    }
    if (url.pathname === '/api/artrequests') {
      if (state.wait) await state.wait;
      return route.fulfill({ status: state.failure ? 503 : 200, json: state.failure ? { error: 'Fixture unavailable' } : state.rows });
    }
    if (url.pathname === '/api/crm-session/me') return route.fulfill({ json: { email: 'fixture@example.test', firstName: 'Fixture', lastName: 'Staff' } });
    if (url.pathname === '/api/mockups') {
      if (state.wait) await state.wait;
      return route.fulfill({ status: state.failure ? 503 : 200, json: { records: state.mockups } });
    }
    if (url.pathname === '/api/mockups/broken-mockups') return route.fulfill({ status: state.scanFailure ? 503 : 200, json: { checked: 12, uniqueFileIds: 4, broken: state.broken ? 1 : 0, results: state.broken ? [{ id: 701, designNumber: '53001', companyName: 'Fixture Apparel', status: 'In Progress', salesRep: 'Fixture', submittedDate: '2026-09-08', brokenSlots: [{ field: 'Box_Mockup_1', fileId: 'fixture-file' }] }] : [] } });
    if (url.pathname.includes('mockup-notifications')) return route.fulfill({ json: { notifications: [] } });
    if (url.pathname === '/api/service-codes') return route.fulfill({ status: state.billingFailure ? 503 : 200, json: { data: [{ SellPrice: url.searchParams.get('code') === 'GRT-75' ? 75 : 50 }] } });
    return route.fulfill({ status: 503, json: { error: 'Fixture service unavailable' } });
  });
  await page.route(`http://localhost:3400/${file}*`, route => route.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(ROOT, file), 'utf8') }));
  return state;
}
async function layouts(page, name) {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), name + ' overflow at ' + width).toBeLessThanOrEqual(width + 1);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(result.violations, name + ' accessibility at ' + width).toEqual([]);
    if (process.env.CSS_SHOT_TAG) {
      const folder = path.join(__dirname, 'screenshots/css-unification');
      fs.mkdirSync(folder, { recursive: true });
      await page.screenshot({ path: path.join(folder, `${process.env.CSS_SHOT_TAG}-${name}-${width}.png`), fullPage: (await page.locator('[role="dialog"]:visible').count()) === 0 });
    }
  }
}
test('CSS art: Saved Mockups cards, search, destinations and keyboard preview', async ({ page }) => {
  const state = await fixture(page, 'pages/mockup-library.html');
  await page.goto('/pages/mockup-library.html');
  await expect(page.locator('.ml-card')).toHaveCount(2);
  await expect(page.locator('#ml-search')).toHaveCSS('font-size', '16px');
  await expect(page.locator('.ml-card-meta').first()).toContainText('Sep 8, 2026');
  await layouts(page, 'saved-mockups');
  const boxes = await page.locator('.ml-card').evaluateAll(cards => cards.map(card => { const box = card.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width }; }));
  expect(boxes[1].x).toEqual(boxes[0].x);
  expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
  await page.locator('#ml-search').fill('53001');
  await expect(page.locator('.ml-card')).toHaveCount(1);
  await expect(page.locator('#ml-count')).toHaveText('1 of 2 mockups');
  const designer = page.getByRole('link', { name: 'Open in Designer' });
  await expect(designer).toHaveAttribute('href', /designId=53001&company=Fixture%20Apparel/);
  await expect(page.getByRole('link', { name: 'Open Request' })).toHaveAttribute('href', '/art-request/53001');
  const trigger = page.locator('.ml-card-img').first();
  await trigger.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#ml-lightbox-img')).toBeVisible();
  await expect(page.locator('#ml-lightbox-close')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#ml-lightbox-close')).toBeFocused();
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await layouts(page, 'saved-mockup-preview');
  await page.keyboard.press('Escape');
  await expect(page.locator('#ml-lightbox')).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(page.locator('main')).not.toHaveAttribute('inert', '');
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await page.locator('#ml-search').fill('Nothing matching');
  await expect(page.locator('#ml-grid')).toContainText('No mockups match');
  await page.locator('#ml-search').fill('');
  await expect(page.locator('.ml-card')).toHaveCount(2);
  expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
});
test('CSS art: Saved Mockups loading, visible request failure and retry', async ({ page }) => {
  let release;
  const state = await fixture(page, 'pages/mockup-library.html', { failure: true, wait: new Promise(resolve => { release = resolve; }) });
  await page.goto('/pages/mockup-library.html');
  await expect(page.locator('#ml-loading')).toBeVisible();
  await expect(page.locator('#ml-grid')).toBeEmpty();
  release(); state.wait = null;
  await expect(page.locator('#ml-error')).toBeVisible();
  await expect(page.locator('#ml-retry')).toBeEnabled();
  await layouts(page, 'saved-mockups-error');
  state.failure = false;
  await page.locator('#ml-retry').click();
  await expect(page.locator('.ml-card')).toHaveCount(2);
  await expect(page.locator('#ml-error')).toBeHidden();
  expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
});
test('CSS art: Saved Mockups empty state and unreadable response recovery', async ({ page }) => {
  const state = await fixture(page, 'pages/mockup-library.html', { rows: { unexpected: [] } });
  await page.goto('/pages/mockup-library.html');
  await expect(page.locator('#ml-error-text')).toContainText('could not be read');
  state.rows = [];
  await page.locator('#ml-retry').click();
  await expect(page.locator('#ml-empty')).toBeVisible();
  await expect(page.locator('#ml-count')).toHaveText('0 mockups');
  await layouts(page, 'saved-mockups-empty');
  expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
});
test('CSS art: Saved Mockups long names and broken image feedback', async ({ page }) => {

  const state = await fixture(page, 'pages/mockup-library.html', { rows: [{ ...libraryRows[0], CompanyName: 'CascadeFieldServicesWorkshopTeamWithAnUnbrokenLongCompanyName', Rep_Mockup: '/art-fixture-preview.png' }, { ...libraryRows[1], Rep_Mockup: '/art-fixture-missing.png' }] });
  await page.route('**/art-fixture-missing.png', route => route.fulfill({ status: 404, body: 'Missing fixture' }));
  await page.route('**/art-fixture-preview.png', route => route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join(ROOT, 'favicon.png')) }));
  await page.goto('/pages/mockup-library.html');
  await expect(page.locator('.ml-image-unavailable').last()).toBeVisible();
  await expect(page.locator('.ml-card-img').last()).toBeDisabled();
  await layouts(page, 'saved-mockups-long-name');
  // Use a distinct failing full-image URL so Chromium does not reuse its decoded thumbnail.
  const trigger = page.locator('.ml-card-img').first();
  await trigger.evaluate(button => button.setAttribute('data-full', '/art-fixture-missing.png'));
  await trigger.click();
  await expect(page.locator('#ml-lightbox-status')).toContainText('could not be loaded');
  await expect(page.locator('#ml-lightbox-img')).toBeHidden();
  await layouts(page, 'saved-mockup-image-error');
  await page.locator('#ml-lightbox-close').click();
  await expect(trigger).toBeFocused();
  expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
});

test('CSS art: Ruth grid, status/search filters, four tabs and billing', async ({ page }) => {
  const state = await fixture(page, 'dashboards/art-hub-ruth.html');
  await page.goto('/dashboards/art-hub-ruth.html');
  await expect(page.locator('#queue-grid .mockup-card')).toHaveCount(4);
  await expect(page.locator('#ruth-search-input')).toHaveCSS('font-size', '16px');
  await layouts(page, 'ruth-grid');
  const statusFilter = page.locator('.status-stat[data-status="In Progress"]');
  await statusFilter.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#queue-grid .mockup-card')).toHaveCount(1);
  await expect(statusFilter).toBeFocused();
  await page.locator('.status-stat[data-status="In Progress"]').click();
  await expect(page.locator('#queue-grid .mockup-card')).toHaveCount(4);
  await page.locator('#ruth-search-input').fill('53001');
  await expect(page.locator('#queue-grid .mockup-card')).toHaveCount(1);
  await page.locator('#ruth-search-input').fill('');
  await expect(page.locator('#queue-grid .mockup-card')).toHaveCount(4);
  await page.locator('#tab-queue').focus(); await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-completed')).toBeFocused();
  await expect(page.locator('#completed-grid .mockup-card')).toHaveCount(7);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#tab-on-hold')).toBeFocused();
  await expect(page.locator('#on-hold-grid .mockup-card')).toHaveCount(1);
  await expect(page.locator('#on-hold-grid .card-action-btn')).toHaveCount(0);
  await layouts(page, 'ruth-on-hold');
  await page.locator('#tab-billing').click();
  await expect(page.locator('#bill-grt50')).toHaveText('$50');
  await expect(page.locator('#bill-grt75')).toHaveText('$75/hr');
  await expect(page.locator('#bill-inc-15')).toHaveText('$18.75');
  await layouts(page, 'ruth-billing');
  expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
});
test('CSS art: Ruth board remains searchable, excludes held work and expands completed by keyboard', async ({ page }) => {
  const state = await fixture(page, 'dashboards/art-hub-ruth.html');
  await page.goto('/dashboards/art-hub-ruth.html');
  await expect(page.locator('#queue-grid .mockup-card')).toHaveCount(4);
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await expect(page.locator('#ruth-search-input')).toBeVisible();
  await expect(page.locator('.kanban-column')).toHaveCount(6);
  await expect(page.locator('#ruth-kanban-board')).not.toContainText('Paused Customer');
  const toggle = page.locator('button.kanban-column-header');
  await toggle.focus(); await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.kanban-column--completed .kanban-card:visible')).toHaveCount(5);
  await page.locator('.kanban-show-all').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.kanban-column--completed .kanban-card:visible')).toHaveCount(6);
  await expect(page.locator('.kanban-column--completed .kanban-card').nth(5)).toBeFocused();
  await layouts(page, 'ruth-board');
  const board = page.locator('#ruth-kanban-board');
  await board.evaluate(element => { element.scrollLeft = 0; });
  await board.focus(); await page.keyboard.press('ArrowRight');
  await expect.poll(() => board.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await page.locator('.status-stat[data-status="In Progress"]').click();
  await expect(page.locator('.kanban-card')).toHaveCount(1);
  await page.locator('.status-stat[data-status="In Progress"]').click();
  await page.locator('#ruth-search-input').fill('does not match');
  await expect(page.locator('.kanban-card')).toHaveCount(0);
  await page.locator('#ruth-search-input').fill('53001');
  await expect(page.locator('.kanban-card')).toHaveCount(1);
  expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
});
test('CSS art: Ruth loading, API failure retry and empty board', async ({ page }) => {
  let release;
  const state = await fixture(page, 'dashboards/art-hub-ruth.html', { failure: true, billingFailure: true, wait: new Promise(resolve => { release = resolve; }) });
  await page.goto('/dashboards/art-hub-ruth.html');
  await expect(page.locator('#mockup-loading')).toBeVisible();
  release(); state.wait = null;
  await expect(page.locator('.mockup-error')).toBeVisible();
  await layouts(page, 'ruth-error');
  state.failure = false; state.mockups = [];
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.locator('#queue-grid .mockup-empty')).toBeVisible();
  await page.getByRole('button', { name: 'Board', exact: true }).click();
  await expect(page.locator('.kanban-column')).toHaveCount(6);
  await expect(page.locator('.kanban-card')).toHaveCount(0);
  await page.locator('#tab-billing').click();
  await expect(page.locator('#billing-rate-note')).toContainText('Could not verify these prices');
  await layouts(page, 'ruth-billing-fallback');
  expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
});
test('CSS art: Ruth quick status action pending, failure and retry', async ({ page }) => {
  let release;
  const state = await fixture(page, 'dashboards/art-hub-ruth.html', { statusWait: new Promise(resolve => { release = resolve; }) });
  await page.goto('/dashboards/art-hub-ruth.html');
  const action = page.locator('[data-mockup-id="701"] button[data-action="start"]');
  await action.click();
  await expect(action).toBeDisabled();
  await expect(action).toHaveText('Updating...');
  release(); state.statusWait = null;
  await expect(page.locator('.mockup-toast--error')).toContainText('Failed to update mockup');
  await expect(action).toBeEnabled();
  state.allowStatus = true;
  await action.click();
  await expect(page.locator('[data-mockup-id="701"] .status-pill')).toHaveText('In Progress');
  expect(state.writes).toHaveLength(2);
  expect(JSON.parse(state.writes[1].body)).toMatchObject({ status: 'In Progress', author: 'fixture@example.test', authorName: 'Fixture Staff' });
  expect(state.errors).toEqual([]);
});
test('CSS art: Ruth recovery dialog traps focus and restores after the list refreshes', async ({ page }) => {
  const state = await fixture(page, 'dashboards/art-hub-ruth.html', { broken: true });
  await page.goto('/dashboards/art-hub-ruth.html');
  const trigger = page.locator('#ruth-broken-pill');
  await trigger.click();
  const dialog = page.locator('#broken-mockups-modal');
  await expect(page.locator('#broken-mockups-modal-close')).toBeFocused();
  await expect(page.locator('.bml-row__meta')).toContainText('Submitted Sep 8, 2026');
  await layouts(page, 'ruth-recovery');
  await page.locator('.bml-action--reupload').focus(); await page.keyboard.press('Tab');
  await expect(page.locator('#broken-mockups-modal-close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click();
  state.scanFailure = true;
  await page.locator('#bml-refresh').click();
  await expect(page.locator('.mockup-toast--error')).toContainText('Could not refresh');
  await expect(page.locator('#bml-refresh')).toBeEnabled();
  state.scanFailure = false;
  await page.locator('#bml-refresh').click();
  await expect(page.locator('#broken-mockups-modal-close')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect(state.writes).toEqual([]); expect(state.errors).toEqual([]);
});
test('CSS art: Ruth recovery and upload failures, then successful mocked recovery', async ({ page }) => {
  let release;
  const state = await fixture(page, 'dashboards/art-hub-ruth.html', { broken: true, recoveryWait: new Promise(resolve => { release = resolve; }) });
  await page.goto('/dashboards/art-hub-ruth.html');
  await page.locator('#ruth-broken-pill').click();
  const recover = page.locator('.bml-action--recover');
  await recover.click(); await expect(recover).toBeDisabled();
  release(); state.recoveryWait = null;
  await expect(page.locator('.bml-result--error')).toContainText('Fixture recovery unavailable');
  await expect(recover).toBeEnabled();
  await page.locator('.bml-action--reupload').click();
  const picker = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose file', exact: true }).focus();
  await page.keyboard.press('Enter');
  await (await picker).setFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: fs.readFileSync(path.join(ROOT, 'favicon.png')) });
  await expect(page.locator('.bml-result--error')).toContainText('Fixture upload unavailable');
  await expect(recover).toBeEnabled();
  await layouts(page, 'ruth-recovery-failed');
  state.allowRecovery = true;
  await recover.click();
  await expect(page.locator('.bml-empty-state-title')).toHaveText('All broken links resolved!');
  await expect(page.locator('#ruth-broken-pill')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#tab-queue')).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  expect(state.writes.map(write => write.path)).toEqual(['/api/mockups/701/auto-recover-mockup', '/api/mockups/701/upload-file', '/api/mockups/701/auto-recover-mockup']);
  expect(state.errors).toEqual([]);
});



test('CSS art: Ruth bulk recovery cancellation and failed response never report success', async ({ page }) => {
  const state = await fixture(page, 'dashboards/art-hub-ruth.html', { broken: true });
  await page.goto('/dashboards/art-hub-ruth.html');
  await page.locator('#ruth-broken-pill').click();
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#bml-bulk-recover').click();
  expect(state.writes).toEqual([]);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#bml-bulk-recover').click();
  await expect(page.locator('.bml-result--error')).toContainText('Recovery request failed (503)');
  await expect(page.locator('#bml-bulk-recover')).toBeEnabled();
  await expect(page.locator('#bml-bulk-recover')).not.toContainText('Recovered');
  await page.keyboard.press('Escape');
  expect(state.writes.map(write => write.path)).toEqual(['/api/mockups/auto-recover-mockups-bulk']);
  expect(state.errors).toEqual([]);
});


test('CSS art: Ruth clears stale records when a status update succeeds but refresh fails', async ({ page }) => {
  const state = await fixture(page, 'dashboards/art-hub-ruth.html', { allowStatus: true });
  await page.goto('/dashboards/art-hub-ruth.html');
  await expect(page.locator('#queue-grid .mockup-card')).toHaveCount(4);
  state.failure = true;
  await page.locator('[data-mockup-id="701"] button[data-action="start"]').click();
  await expect(page.locator('.mockup-error')).toBeVisible();
  await expect(page.locator('.mockup-card')).toHaveCount(0);
  await page.locator('#tab-completed').click();
  await expect(page.locator('#completed-grid .mockup-empty')).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.errors).toEqual([]);
});
