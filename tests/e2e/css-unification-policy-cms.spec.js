const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const fs = require('node:fs'), path = require('node:path'), Keygrip = require('keygrip');
const { TEST_SESSION_SECRET } = require('./staff-session');
const data = require('../fixtures/policy-cms-data.json');
const names = ['policies-hub', 'policy-detail', 'policy-questions', 'handbook'];
const output = path.join(__dirname, 'screenshots/css-unification');
fs.mkdirSync(output, { recursive: true });
test.describe.configure({ mode: 'parallel' });
test.use({ reducedMotion: 'reduce' });

async function open(page, baseURL, name, options = {}) {
    const admin = options.admin !== false;
    const value = Buffer.from(JSON.stringify({ crmUser: { name: 'Policy Harness', email: 'e2e-harness@nwcustomapparel.com', role: admin ? 'admin' : 'staff', permissions: admin ? ['admin', 'policies-admin'] : ['staff'], via: 'saml' } })).toString('base64');
    const signature = new Keygrip([TEST_SESSION_SECRET]).sign('nwca_staff=' + value);
    await page.context().clearCookies();
    await page.context().addCookies([{ name: 'nwca_staff', value }, { name: 'nwca_staff.sig', value: signature }].map(cookie => ({ ...cookie, url: baseURL, httpOnly: true, sameSite: 'Lax' })));
    const state = { errors: [], writes: [], unhandled: [] };
    page.on('pageerror', e => state.errors.push(e.message));
    await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url()), p = url.pathname;
        if (p === '/api/csp-report') return route.fulfill({ status: 204, body: '' });
        if (!['GET', 'HEAD'].includes(request.method())) { state.writes.push(p); return route.fulfill({ status: 503, json: { error: 'Unmocked business write blocked' } }); }
        if (p === '/api/crm-session/me') return route.fulfill({ json: { authenticated: true, firstName: 'Fixture', lastName: 'Colleague', email: 'fixture@example.invalid', permissions: admin ? ['policies-admin'] : [] } });
        if (options.failure && request.url().includes(options.failure)) return route.fulfill({ status: 503, json: { error: 'Offline fixture' } });
        if (p === '/api/crm-proxy/policy-comments/inbox/count') return route.fulfill({ json: { count: data.questions.length } });
        if (p === '/api/crm-proxy/policy-comments/inbox') return route.fulfill({ status: admin ? 200 : 403, json: { questions: data.questions, count: data.questions.length } });
        if (p.includes('/policy-comments-public/')) return route.fulfill({ json: { comments: data.questions, count: data.questions.length } });
        if (/\/api\/(?:policies-public|crm-proxy\/policies)\/tree$/.test(p)) return route.fulfill({ json: data.tree });
        if (/\/api\/(?:policies-public|crm-proxy\/policies)\/search$/.test(p)) return route.fulfill({ json: { policies: data.records.filter(record => record.Title.toLowerCase().includes((url.searchParams.get('q') || '').toLowerCase())) } });
        if (/\/api\/(?:policies-public|crm-proxy\/policies)\/?$/.test(p)) return options.badParents ? route.fulfill({ status: 503, json: { error: 'Parent catalogue unavailable' } }) : route.fulfill({ json: { policies: url.searchParams.has('parent') ? [] : data.records } });
        if (/\/api\/(?:policies-public|crm-proxy\/policies)\//.test(p)) { const id = decodeURIComponent(p.split('/').at(-1)), policy = data.records.find(record => record.Policy_ID === id); return route.fulfill({ status: policy ? 200 : 404, json: policy ? { policy } : { error: 'Missing fixture' } }); }
        if (p.startsWith('/api/')) { state.unhandled.push(p); return route.fulfill({ status: 503, json: { error: 'Unmocked business call blocked' } }); }
        return route.fallback();
    });
    if (options.policy) await page.route('**/api/*/policies/' + options.policy.Policy_ID, route => route.fulfill({ json: { policy: options.policy } }));
    if (options.policy) await page.route('**/api/policies-public/' + options.policy.Policy_ID, route => route.fulfill({ json: { policy: options.policy } }));
    await page.goto('/pages/' + name + '.html' + (name === 'policy-detail' ? '?id=' + (options.policy?.Policy_ID || 'cms-fixture') + (options.edit ? '&edit=1' : '') : ''));
    await page.evaluate(() => document.fonts.ready);
    if (!options.failure && !options.badParents) {
        const selector = name === 'policies-hub' ? '.policy-card' : name === 'policy-detail' ? (options.edit ? '.tt-content' : options.policy ? '#policyBody' : '#policyBody h2') : name === 'handbook' ? '.handbook-chapter' : admin ? '.question-card' : '#questionsLockedNote';
        await expect(page.locator(selector).first()).toBeVisible({ timeout: options.edit ? 60000 : 10000 });
    }
    return state;
}
const clean = (state, writes = []) => { expect(state.errors).toEqual([]); expect(state.unhandled).toEqual([]); expect(state.writes).toEqual(writes); };
const axe = async page => expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
for (const name of names) test('CSS policy CMS: ' + name + ' at four widths', async ({ page, baseURL }) => {
    test.setTimeout(180000);
    const state = await open(page, baseURL, name);
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await axe(page);
        await page.screenshot({ path: path.join(output, 'policy-cms-' + name + '-' + width + '.png') });
    }
    clean(state);
});
test('CSS policy CMS: hub list empty state, search retry and view preference failures', async ({ page, baseURL }) => {
    await page.addInitScript(() => { Storage.prototype.getItem = () => { throw Error('Storage blocked'); }; Storage.prototype.setItem = () => { throw Error('Storage blocked'); }; });
    const state = await open(page, baseURL, 'policies-hub');
    await expect(page.getByRole('status')).toContainText('view preference');
    await page.getByRole('button', { name: 'List view' }).click();
    await expect(page.getByRole('button', { name: 'List view' })).toHaveAttribute('aria-pressed', 'true');
    const search = page.getByRole('textbox', { name: 'Search policies' });
    await search.fill('no matching record');
    await expect(page.locator('#policiesList')).toContainText('No policies match');
    await page.route('**/api/policies-public/search*', r => r.fulfill({ status: 503, json: { error: 'Search offline' } }));
    await search.fill('shipping');
    await expect(page.locator('#policiesList')).toContainText('Could not search policies');
    await page.unroute('**/api/policies-public/search*');
    await page.locator('#policiesList').getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('#policiesList .policy-list-item')).toHaveCount(1);
    await expect(search).toHaveValue('shipping');
    clean(state);
});
test('CSS policy CMS: hub malformed catalogue is visible and retries', async ({ page, baseURL }) => {
    const state = await open(page, baseURL, 'policies-hub', { failure: '/tree' });
    await expect(page.locator('#policiesGrid')).toContainText('Could not load policies');
    await page.route('**/api/crm-proxy/policies/tree', r => r.fulfill({ json: { tree: null } }));
    await page.locator('#policiesGrid').getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('#policiesGrid')).toContainText('Could not load policies');
    await page.route('**/api/crm-proxy/policies/tree', r => r.fulfill({ json: data.tree }));
    await page.locator('#policiesGrid').getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('.policy-card')).toHaveCount(3);
    clean(state);
});
test('CSS policy CMS: ordinary staff has reading controls and no admin actions', async ({ page, baseURL }) => {
    const state = await open(page, baseURL, 'policies-hub', { admin: false });
    await expect(page.locator('#newPolicyBtn')).toBeHidden();
    await expect(page.locator('#questionsBadge')).toBeHidden();
    await expect(page.locator('#archivedToggleWrap')).toBeHidden();
    clean(state);
});

test('CSS policy CMS: an unavailable question count is distinct from an empty inbox', async ({ page, baseURL }) => {
    const state = await open(page, baseURL, 'policies-hub', { failure: '/inbox/count' });
    await expect(page.locator('#questionsBadgeCount')).toHaveText('?');
    await expect(page.locator('#questionsBadge')).toHaveAccessibleName('Question count unavailable. Open the inbox to retry.');
    clean(state);
});
test('CSS policy CMS: handbook phone contents, history, partial chapter failure and retry', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const state = await open(page, baseURL, 'handbook', { failure: '/chapter-13' });
    await expect(page.getByRole('alert')).toContainText('incomplete');
    const contents = page.locator('.policy-navigation');
    await expect(contents).not.toHaveAttribute('open');
    await contents.locator('summary').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#handbookToc')).toHaveCSS('overflow-y', 'visible');
    await page.locator('a[data-target="ch-chapter-22"]').click();
    await expect(page.locator('#ch-chapter-22')).toBeFocused();
    await page.locator('a[data-target="ch-chapter-2"]').click();
    await expect(page.locator('#ch-chapter-2')).toBeFocused();
    await page.locator('a[data-target="ch-chapter-3"]').click();
    await page.goBack(); await expect(page).toHaveURL(/#ch-chapter-2$/);
    await page.route('**/api/policies-public/chapter-13*', r => r.fulfill({ json: { policy: data.chapters[12] } }));
    await page.getByRole('button', { name: 'Retry missing chapters' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('.handbook-chapter')).toHaveCount(22);
    await expect(page.locator('#ch-chapter-13')).toContainText('Complete handbook fixture content for chapter 13');
    clean(state);
});
test('CSS policy CMS: AI search is a native modal with visible retry and focus restoration', async ({ page, baseURL }) => {
    const state = await open(page, baseURL, 'policies-hub');
    const trigger = page.getByRole('button', { name: 'Ask Claude', exact: true });
    await trigger.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.getByRole('textbox', { name: 'Describe the policy you need' }).fill('shipping');
    await page.route('**/api/policies-ai-search', r => { state.writes.push('/api/policies-ai-search'); return r.fulfill({ status: 503, json: { error: 'Search temporarily unavailable' } }); });
    await dialog.getByRole('button', { name: 'Search', exact: true }).click();
    await expect(dialog.getByRole('status')).toContainText('temporarily unavailable');
    await page.route('**/api/policies-ai-search', r => { state.writes.push('/api/policies-ai-search'); expect(r.request().postDataJSON()).toEqual({ query: 'shipping' }); return r.fulfill({ json: { results: [{ policy_id: 'cms-fixture', Title: 'Receiving and shipping guide', Category: 'Operations', confidence: 'high', why: 'Fixture match' }], policies_searched: 27 } }); });
    await dialog.getByRole('button', { name: 'Search again' }).click();
    await expect(dialog.locator('.ai-search-result')).toHaveCount(1);
    await axe(page);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused();
    clean(state, ['/api/policies-ai-search', '/api/policies-ai-search']);
});
for (const name of names) test('CSS policy CMS: ' + name + ' produces a populated PDF', async ({ page, baseURL }) => {
    const state = await open(page, baseURL, name);
    if (name === 'handbook') await expect(page.locator('.handbook-chapter')).toHaveCount(22);
    await page.pdf({ path: path.join(output, 'policy-cms-' + name + '.pdf'), format: 'Letter', margin: { top: '12mm', bottom: '12mm', left: '12mm', right: '12mm' }, printBackground: true });
    clean(state);
});

test('CSS policy CMS: actual editor preserves source, parent and failed-save recovery', async ({ page, baseURL }) => {
    test.setTimeout(120000);
    const state = await open(page, baseURL, 'policy-detail', { edit: true });
    await expect(page.locator('#editParent option')).toHaveCount(4);
    await page.locator('#editTitle').fill('Reviewed fixture guide');
    await page.locator('#editParent').selectOption('financial-fixture');
    await page.locator('.tt-toolbar [data-cmd="source"]').click();
    const editorSource = await page.locator('.tt-source').inputValue();
    // The existing visual editor normalizes table markup. Verify its content,
    // then require the submitted source and failed-save draft to stay identical.
    const content = await page.evaluate(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return [...doc.querySelectorAll('h2,h3,p,th,td')].filter(el => !el.querySelector('p')).map(el => el.textContent);
    }, editorSource);
    expect(content).toEqual(await page.evaluate(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return [...doc.querySelectorAll('h2,h3,p,th,td')].filter(el => !el.querySelector('p')).map(el => el.textContent);
    }, data.policy.Body_HTML));
    let payload;
    await page.route('**/api/crm-proxy/policies/cms-fixture', route => {
        if (route.request().method() !== 'PUT') return route.fallback();
        state.writes.push('/api/crm-proxy/policies/cms-fixture'); payload = route.request().postDataJSON();
        expect(route.request().headers()['if-match']).toBe(data.policy.Updated_At);
        return route.fulfill({ status: 503, json: { error: 'Save unavailable' } });
    });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.locator('#saveStatus')).toContainText('Save failed');
    expect(payload).toMatchObject({ Title: 'Reviewed fixture guide', Parent_Policy_ID: 'financial-fixture', Body_HTML: editorSource, Updated_By: 'fixture@example.invalid' });
    await expect(page.locator('.tt-source')).toHaveValue(editorSource);
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
    for (const width of [1440, 390, 320]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page); }
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Archive', exact: true }).click();
    clean(state, ['/api/crm-proxy/policies/cms-fixture']);
});

test('CSS policy CMS: comments retain text on failed post and native reply cancellation', async ({ page, baseURL }) => {
    const state = await open(page, baseURL, 'policy-detail');
    await expect(page.locator('.comment-text')).toContainText(data.questions[0].Body);
    await page.getByRole('button', { name: 'Reply', exact: true }).click();
    await expect(page.locator('#commentsBody')).toBeFocused();
    await page.locator('#commentsCancelReply').click();
    await page.locator('#commentsBody').fill('Synthetic comment for the browser harness');
    await page.route('**/api/policy-comments-public/', route => { state.writes.push('/api/policy-comments-public/'); expect(route.request().postDataJSON()).toMatchObject({ Policy_ID: 'cms-fixture', Body: 'Synthetic comment for the browser harness', Parent_Comment_ID: '', Author_Name: 'Fixture Colleague', Author_Email: 'fixture@example.invalid' }); return route.fulfill({ status: 503, json: { error: 'Post unavailable' } }); });
    await page.locator('#commentsSubmit').click();
    await expect(page.locator('#commentsFormStatus')).toContainText('Post unavailable');
    await expect(page.locator('#commentsBody')).toHaveValue('Synthetic comment for the browser harness');
    clean(state, ['/api/policy-comments-public/']);
});

test('CSS policy CMS: failed content sanitizer cannot display raw policy markup', async ({ page, baseURL }) => {
    const state = await open(page, baseURL, 'policy-detail', { failure: '/shared_components/vendor/dompurify/' });
    await expect(page.locator('#detailRoot')).toContainText('could not be prepared safely');
    await expect(page.locator('.tt-content')).toHaveCount(0);
    clean(state);
});

test('CSS policy CMS: unavailable editor and parent catalogue cannot save empty content', async ({ page, baseURL }) => {
    const state = await open(page, baseURL, 'policy-detail', { edit: true, failure: 'https://esm.sh/' });
    await expect(page.locator('.editor-error')).toContainText("Couldn't load editor");
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    clean(state);
    await page.unrouteAll({ behavior: 'wait' });
    const parentState = await open(page, baseURL, 'policy-detail', { edit: true, badParents: true });
    await expect(page.locator('#detailRoot')).toContainText('Could not load parent policies');
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    clean(parentState);
});

test('CSS policy CMS: signed-in comments work with browser storage blocked', async ({ page, baseURL }) => {
    await page.addInitScript(() => { Storage.prototype.getItem = () => { throw Error('Storage blocked'); }; });
    const state = await open(page, baseURL, 'policy-detail', { admin: false });
    await expect(page.locator('#commentsForm')).toContainText('Fixture Colleague');
    await expect(page.locator('#commentsPolish')).toBeHidden();
    await page.setViewportSize({ width: 320, height: 900 });
    await axe(page);
    clean(state);
});

test('CSS policy CMS: inbox retries and moderation waits for native confirmation', async ({ page, baseURL }) => {
    const state = await open(page, baseURL, 'policy-questions', { failure: '/policy-comments/inbox' });
    await expect(page.locator('#questionsList')).toContainText('Could not load');
    await page.route('**/api/crm-proxy/policy-comments/inbox', route => route.fulfill({ json: { questions: data.questions } }));
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.locator('.question-card')).toHaveCount(1);
    page.once('dialog', dialog => dialog.dismiss());
    await page.getByRole('button', { name: 'Hide', exact: true }).click();
    expect(state.writes).toEqual([]);
    let action;
    await page.route('**/api/crm-proxy/policy-comments/*/resolve', route => { action = route.request().method(); state.writes.push(new URL(route.request().url()).pathname); return route.fulfill({ json: { success: true } }); });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Mark resolved', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Mark resolved', exact: true })).toBeEnabled();
    expect(action).toBe('POST');
    clean(state, ['/api/crm-proxy/policy-comments/' + data.questions[0].Comment_ID + '/resolve']);
});

test('CSS policy CMS: organization chart keyboard search and print include collapsed teams', async ({ page, baseURL }) => {
    const card = (name, role) => '<div><div>' + name + '</div><div>' + role + '</div><div>Fixture team</div></div>';
    const body = '<div><div>As of July 2026</div><div>' + card('Fixture President', 'President') + '</div><div></div><div>' + card('Fixture Director', 'Director') + '</div><div></div><div>' + card('Fixture Coordinator', 'Coordinator') + '</div><section><h2>Production</h2><div><div>' + card('Fixture Supervisor', 'Production supervisor') + '<div><div><span>Fixture Operator</span><span>Embroidery</span></div></div></div></div></section><section><h2>Coverage</h2><p>Fixture full coverage details</p></section></div>';
    const state = await open(page, baseURL, 'policy-detail', { policy: { ...data.policy, Policy_ID: 'org-chart-2026', Title: 'Organization chart', Body_HTML: body } });
    const team = page.getByRole('button', { name: /Fixture Supervisor/ });
    await team.focus(); await page.keyboard.press('Enter');
    await expect(team).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.org-operator')).toBeHidden();
    await page.getByRole('button', { name: 'Collapse production' }).click();
    await page.getByRole('searchbox', { name: 'Find a team member' }).fill('Fixture Operator');
    await expect(page.locator('.org-operator')).toBeVisible();
    await expect(team).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('button', { name: 'Collapse production' })).toHaveAttribute('aria-expanded', 'true');
    for (const width of [1440, 390, 320]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width); await axe(page); }
    await page.getByRole('searchbox', { name: 'Find a team member' }).fill('');
    await team.click();
    await page.getByRole('button', { name: 'Collapse production' }).click();
    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.org-operator')).toBeVisible();
    await page.pdf({ path: path.join(output, 'policy-cms-organization.pdf'), format: 'Letter', printBackground: true });
    await page.emulateMedia({ media: 'screen' });
    await expect(page.locator('.org-card--department')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.org-operator')).toBeHidden();
    clean(state);
});
