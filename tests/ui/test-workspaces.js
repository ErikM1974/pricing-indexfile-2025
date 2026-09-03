/* QA harness for the Workspaces restructure (2026-09-03).
   See test-workspaces.html for what this proves and why it fetches the real page. */

// Cache-busted dynamic imports: the browser hard-caches ES modules by URL, and a
// stale controller here would "verify" code that is no longer on disk (the same
// trap the boot shim closes for stylesheets).
const stamp = Date.now();
const { initNavAccess } = await import(`/shared_components/js/staff-dashboard/controllers/nav-access-controller.js?t=${stamp}`);
const { initWorkspaces, showWorkspace, currentWorkspace, defaultWorkspaceFor } =
    await import(`/shared_components/js/staff-dashboard/controllers/workspace-controller.js?t=${stamp}`);

const DASHBOARD_URL = '/staff-dashboard-v3/index.html';
const ME_ENDPOINT = '/api/crm-session/me';
const STORE_KEY = 'nwca-dash:workspace';   // dashboard-store.js wraps as {v, ts, data}

// Permission sets exactly as lib/staff-saml.js permissionsFromRole() derives them.
const SESSIONS = {
    admin:      { authenticated: true, email: 'erik@nwcustomapparel.com',     permissions: ['admin', 'accountant', 'house', 'policies-admin', 'taneisha', 'nika'] },
    nika:       { authenticated: true, email: 'nika@nwcustomapparel.com',     permissions: ['sales', 'nika'] },
    taneisha:   { authenticated: true, email: 'taneisha@nwcustomapparel.com', permissions: ['sales', 'taneisha'] },
    art:        { authenticated: true, email: 'art@nwcustomapparel.com',      permissions: ['art'] },
    ruth:       { authenticated: true, email: 'ruth@nwcustomapparel.com',     permissions: ['art', 'ruth'] },
    production: { authenticated: true, email: 'brian.beardsley@nwcustomapparel.com', permissions: ['production'] },
    shipping:   { authenticated: true, email: 'mikalah@nwcustomapparel.com',  permissions: ['shipping'] },
    accountant: { authenticated: true, email: 'bradley@nwcustomapparel.com',  permissions: ['accountant'] },
    staff:      { authenticated: true, email: 'newhire@nwcustomapparel.com',  permissions: [] },
    anon:       { authenticated: false, email: '', permissions: [] },
};
const EXPECTED_DEFAULT = {
    admin: 'sales', nika: 'sales', taneisha: 'sales', art: 'art', ruth: 'art',
    production: 'production', shipping: 'production', accountant: 'office',
    staff: 'everything', anon: 'everything', error: 'everything',
};

const realFetch = window.fetch.bind(window);
function installSessionStub(role) {
    window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : (input && input.url) || '';
        if (url.includes(ME_ENDPOINT)) {
            if (role === 'error') return Promise.reject(new Error('simulated network failure'));
            return Promise.resolve(new Response(JSON.stringify(SESSIONS[role] || SESSIONS.staff), {
                status: 200, headers: { 'Content-Type': 'application/json' },
            }));
        }
        return realFetch(input, init);
    };
}

let cachedDoc = null;
async function loadRealDashboard() {
    if (cachedDoc) return cachedDoc;
    const res = await realFetch(DASHBOARD_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Could not load ${DASHBOARD_URL}: HTTP ${res.status}`);
    cachedDoc = new DOMParser().parseFromString(await res.text(), 'text/html');
    return cachedDoc;
}

const results = [];
const metrics = {};
const check = (label, condition) => results.push({ label, ok: !!condition });

function render() {
    const list = document.getElementById('qaAssertions');
    list.innerHTML = '';
    const failed = results.filter((r) => !r.ok);
    const summary = document.createElement('li');
    summary.className = failed.length ? 'fail' : 'pass';
    summary.textContent = failed.length ? `${failed.length} of ${results.length} FAILED` : `all ${results.length} passed`;
    list.appendChild(summary);
    for (const r of results) {
        const li = document.createElement('li');
        li.className = r.ok ? 'pass' : 'fail';
        li.textContent = `${r.ok ? 'PASS' : 'FAIL'} — ${r.label}`;
        list.appendChild(li);
    }
    window.__qaResults = { passed: results.length - failed.length, failed: failed.map((r) => r.label), metrics };
    const dl = document.getElementById('qaMetrics');
    dl.innerHTML = '';
    for (const [k, v] of Object.entries(metrics)) {
        const dt = document.createElement('dt'); dt.textContent = k;
        const dd = document.createElement('dd'); dd.textContent = String(v);
        dl.append(dt, dd);
    }
}

const visiblePanels = () => [...document.querySelectorAll('#qaMount .ws-panel')].filter((p) => !p.hidden && p.classList.contains('is-on'));
const selectedTab = () => document.querySelector('#qaMount .ws-tab[aria-selected="true"]')?.dataset.ws || null;
const liveToolHrefs = () => new Set(
    [...document.querySelectorAll('#qaMount .ws-panel:not([data-ws="everything"]) a.ws-link[href]')]
        .filter((a) => !a.hidden && !a.closest('[data-requires-role][hidden]'))
        .map((a) => a.getAttribute('href'))
);

async function run(role) {
    results.length = 0;
    Object.keys(metrics).forEach((k) => delete metrics[k]);
    localStorage.removeItem(STORE_KEY);
    history.replaceState(null, '', location.pathname + location.search);   // no #ws= carried over

    // Lift the real markup: tab strip + every panel.
    const doc = await loadRealDashboard();
    const host = document.getElementById('qaMount');
    const parts = [doc.querySelector('.ws-tabs'), ...doc.querySelectorAll('.ws-panel')];
    host.replaceChildren(...parts.map((el) => document.importNode(el, true)));

    installSessionStub(role);
    const permissionsPromise = initNavAccess();
    const session = role === 'error' ? null : (SESSIONS[role] || SESSIONS.staff);
    const authPromise = Promise.resolve(session && session.authenticated ? { email: session.email } : null);
    await initWorkspaces({ permissionsPromise, authPromise });
    window.fetch = realFetch;

    // ── Default tab per role ────────────────────────────────────────────
    check(`"${role}" lands on ${EXPECTED_DEFAULT[role]}`, selectedTab() === EXPECTED_DEFAULT[role] && currentWorkspace() === EXPECTED_DEFAULT[role]);
    check('exactly one panel is visible', visiblePanels().length === 1);
    check('the visible panel is the selected tab', visiblePanels()[0]?.dataset.ws === selectedTab());
    check('the role dot marks the default tab', host.querySelector('.ws-tab.is-you')?.dataset.ws === EXPECTED_DEFAULT[role]);
    check('defaultWorkspaceFor() agrees with the harness table',
        defaultWorkspaceFor(role === 'error' ? [] : (SESSIONS[role] || SESSIONS.staff).permissions) === EXPECTED_DEFAULT[role]);

    // ── Gating (nav-access-controller, unchanged) ───────────────────────
    const isAdmin = role === 'admin';
    const adminTab = host.querySelector('.ws-tab[data-ws="admin"]');
    const adminPanel = host.querySelector('.ws-panel[data-ws="admin"]');
    check(`Admin tab ${isAdmin ? 'present and revealed' : 'removed from the DOM'}`, isAdmin ? (adminTab && !adminTab.hidden) : !adminTab);
    check(`Admin panel ${isAdmin ? 'present' : 'removed from the DOM'}`, isAdmin ? !!adminPanel : !adminPanel);
    if (!isAdmin) {
        check('no admin href remains harvestable (payroll, access-admin)',
            host.querySelectorAll('a[href*="payroll"], a[href*="access-admin"]').length === 0);
    }
    const seesTaneisha = !!host.querySelector('a[href="/dashboards/taneisha-crm.html"]');
    const seesNika = !!host.querySelector('a[href="/dashboards/nika-crm.html"]');
    const seesHouse = !!host.querySelector('a[href="/dashboards/house-accounts.html"]');
    check('Taneisha\'s accounts tile only for Taneisha and admins', seesTaneisha === (role === 'taneisha' || isAdmin));
    check('Nika\'s accounts tile only for Nika and admins', seesNika === (role === 'nika' || isAdmin));
    check('House Accounts only for the house permission (admins)', seesHouse === isAdmin);

    // ── Switching ───────────────────────────────────────────────────────
    host.querySelector('.ws-tab[data-ws="production"]').click();
    check('clicking Production shows Production only', selectedTab() === 'production' && visiblePanels().length === 1 && visiblePanels()[0].dataset.ws === 'production');
    check('a Sales-only tool is still in the DOM while its tab is off (Ctrl+K can find it)',
        !!host.querySelector('.ws-panel[data-ws="sales"] a[href="/calculators/quick-quote/"]')
        && !host.querySelector('.ws-panel[data-ws="sales"]').classList.contains('is-on')
        && !host.querySelector('.ws-panel[data-ws="sales"]').hidden);
    const saved = () => ((JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}).data || {});
    check('the choice is remembered (last = production)', saved().last === 'production');
    if (session && session.authenticated) {
        check('…and remembered per email on a shared machine', saved().byEmail && saved().byEmail[session.email] === 'production');
    }
    check('the URL hash follows the tab', location.hash === '#ws=production');

    // Keyboard: ArrowRight from Production → Art
    const prodTab = host.querySelector('.ws-tab[data-ws="production"]');
    prodTab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    check('ArrowRight moves to the next tab (Art)', selectedTab() === 'art');

    // Hash deep link
    location.hash = '#ws=office';
    await new Promise((r) => setTimeout(r, 0));
    check('#ws=office deep link switches to Office', selectedTab() === 'office');

    // ── Everything (generated) ──────────────────────────────────────────
    showWorkspace('everything');
    const every = host.querySelector('#wsEveryTools');
    const generated = [...every.querySelectorAll('a.ws-row[href]')].map((a) => a.getAttribute('href'));
    const expected = liveToolHrefs();
    check(`Everything lists every live tool once (${generated.length})`,
        generated.length === expected.size && new Set(generated).size === generated.length && generated.every((h) => expected.has(h)));
    if (!isAdmin) check('Everything carries no admin tools for a non-admin', !generated.some((h) => /payroll|access-admin|api-usage/.test(h)));
    else check('Everything carries the admin tools for an admin', generated.some((h) => /payroll/.test(h)));
    const filter = host.querySelector('#wsEveryFilter');
    filter.value = 'roland';
    filter.dispatchEvent(new Event('input', { bubbles: true }));
    const shown = [...every.querySelectorAll('a.ws-row')].filter((a) => !a.hidden);
    check('the filter narrows to the matching tool', shown.length === 1 && /roland/i.test(shown[0].textContent));
    filter.value = '';
    filter.dispatchEvent(new Event('input', { bubbles: true }));

    // ── Structure ───────────────────────────────────────────────────────
    const tabCount = host.querySelectorAll('.ws-tab').length;
    check(`${isAdmin ? 7 : 6} tabs for "${role}"`, tabCount === (isAdmin ? 7 : 6));
    check('every tab has aria-controls resolving to its panel',
        [...host.querySelectorAll('.ws-tab')].every((t) => host.querySelector(`#${CSS.escape(t.getAttribute('aria-controls'))}`)?.dataset.ws === t.dataset.ws));

    metrics['Default tab'] = EXPECTED_DEFAULT[role];
    metrics['Tabs'] = tabCount;
    metrics['Live tools'] = expected.size;
    metrics['Per tab'] = [...host.querySelectorAll('.ws-panel:not([data-ws="everything"])')]
        .map((p) => `${p.dataset.ws} (${[...p.querySelectorAll('a.ws-link[href]')].filter((a) => !a.hidden).length})`).join(' · ');

    showWorkspace(EXPECTED_DEFAULT[role]);
    render();
}

document.getElementById('qaReload').addEventListener('click', () => run(document.getElementById('qaRole').value));
document.getElementById('qaRole').addEventListener('change', (e) => run(e.target.value));
run('admin').catch((err) => {
    document.getElementById('qaAssertions').innerHTML = `<li class="fail">Harness failed to start: ${err.message}</li>`;
});
