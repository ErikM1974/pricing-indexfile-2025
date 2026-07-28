/* QA harness for the Administration nav reorg + role gate (2026-07-28).
   See test-admin-nav.html for what this proves and why it fetches the real page. */

import { initSidebar }   from '/shared_components/js/staff-dashboard/controllers/sidebar-controller.js';
import { initNavAccess } from '/shared_components/js/staff-dashboard/controllers/nav-access-controller.js';

const DASHBOARD_URL = '/staff-dashboard-v3/index.html';
const ME_ENDPOINT   = '/api/crm-session/me';
// dashboard-store.js writes sidebar collapse state here, wrapped as {v, ts, data}.
const SIDEBAR_STORE_KEY = 'nwca-dash:sidebar';

// Permission sets exactly as server.js permissionsFromRole() derives them.
const SESSIONS = {
    admin:      { authenticated: true,  permissions: ['admin', 'accountant', 'house', 'policies-admin', 'taneisha', 'nika'] },
    accountant: { authenticated: true,  permissions: ['accountant'] },
    sales:      { authenticated: true,  permissions: ['sales'] },
    staff:      { authenticated: true,  permissions: [] },
    anon:       { authenticated: false, permissions: [] },
};

const realFetch = window.fetch.bind(window);

// Stub only /api/crm-session/me; everything else (the dashboard HTML) passes through.
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

// Pull the live sidebar out of the real dashboard. DOMParser does not run scripts,
// so the Caspio auth embed never fires and can't redirect this harness.
async function loadRealSidebar() {
    const res = await realFetch(DASHBOARD_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Could not load ${DASHBOARD_URL}: HTTP ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    const content = doc.querySelector('.sidebar-content');
    if (!content) throw new Error('No .sidebar-content found in the dashboard markup');
    return content;
}

const results = [];
const metrics = {};
const check = (label, condition) => results.push({ label, ok: !!condition });

// Transitions are disabled (see test-admin-nav.css .qa-no-motion), so a forced
// reflow is enough to settle layout — no timers, no flake.
const settle = (el) => { void el.offsetHeight; };

// A row is only genuinely on screen if nothing between it and the sidebar is
// clipped shut. The collapse uses max-height + overflow:hidden, so a hidden row
// still reports a non-zero bounding box — height alone would over-count.
function isRevealed(el) {
    for (let p = el.parentElement; p && !p.classList.contains('sidebar-content'); p = p.parentElement) {
        if (p.classList.contains('nav-subsection-content') || p.classList.contains('nav-section-content')) {
            if (getComputedStyle(p).maxHeight === '0px') return false;
        }
    }
    return el.getBoundingClientRect().height > 0;
}

function render() {
    const list = document.getElementById('qaAssertions');
    list.innerHTML = '';
    const failed = results.filter((r) => !r.ok);

    // Pass/fail is conveyed by a CSS ::before glyph, which does not survive a text
    // scrape — so state it in real text too, and expose it on window for automation.
    const summary = document.createElement('li');
    summary.className = failed.length ? 'fail' : 'pass';
    summary.textContent = failed.length
        ? `${failed.length} of ${results.length} FAILED`
        : `all ${results.length} passed`;
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

async function run(role) {
    results.length = 0;
    Object.keys(metrics).forEach((k) => delete metrics[k]);
    localStorage.removeItem(SIDEBAR_STORE_KEY); // start from the markup defaults

    const host = document.getElementById('qaSidebar');
    host.replaceChildren(...(await loadRealSidebar()).childNodes);

    installSessionStub(role);
    await initNavAccess();
    initSidebar();
    window.fetch = realFetch;

    const admin = host.querySelector('[data-section="admin"]');
    const isAdmin = role === 'admin';

    check(`Administration ${isAdmin ? 'present' : 'removed from the DOM'} for "${role}"`, isAdmin ? !!admin : !admin);

    if (!admin) {
        check('No admin links remain harvestable by the Ctrl+K palette',
            host.querySelectorAll('a.nav-link[href*="payroll"], a.nav-link[href*="access-admin"]').length === 0);
        metrics['Sidebar rows visible'] = host.querySelectorAll('.nav-section').length;
        return render();
    }

    check('Administration is visible (hidden attribute cleared)', !admin.hidden && admin.offsetParent !== null);

    const groups = admin.querySelectorAll('.nav-subsection');
    const links  = admin.querySelectorAll('a.nav-link');
    check('Split into 5 sub-groups', groups.length === 5);
    check('All 18 original links preserved', links.length === 18);
    check('Every link sits inside a sub-group',
        [...links].every((a) => a.closest('.nav-subsection-content')));
    check('No duplicate hrefs', new Set([...links].map((a) => a.getAttribute('href'))).size === links.length);
    check('Every sub-group starts collapsed', [...groups].every((g) => g.classList.contains('collapsed')));
    check('Every sub-group has a unique data-subsection key',
        new Set([...groups].map((g) => g.dataset.subsection)).size === groups.length);

    // aria-controls must resolve, and aria-expanded must match the visual state.
    const headers = admin.querySelectorAll('.nav-subsection-header');
    check('Every sub-group header aria-controls resolves to its panel',
        [...headers].every((h) => host.querySelector(`#${CSS.escape(h.getAttribute('aria-controls'))}`)));
    check('aria-expanded seeded to match collapsed state',
        [...headers].every((h) => h.getAttribute('aria-expanded') === 'false'));

    // Expand the section and measure what a user actually sees.
    const sectionHeader = admin.querySelector(':scope > .nav-section-header');
    sectionHeader.click();
    settle(admin);

    check('Section header aria-expanded flips to true on open',
        sectionHeader.getAttribute('aria-expanded') === 'true');

    const visibleRows = [...admin.querySelectorAll('.nav-subsection-header, a.nav-link')].filter(isRevealed);
    check('Opening Administration reveals 5 rows, not 18', visibleRows.length === 5);
    check('No admin link is on screen until its group is opened',
        [...links].every((a) => !isRevealed(a)));

    const collapsedHeight = admin.getBoundingClientRect().height;

    // Open the biggest group (6 links) and confirm nothing is clipped by max-height.
    const biggest = [...groups].reduce((a, b) =>
        b.querySelectorAll('a.nav-link').length > a.querySelectorAll('a.nav-link').length ? b : a);
    const biggestHeader = biggest.querySelector('.nav-subsection-header');
    biggestHeader.click();
    settle(admin);

    check('Sub-group toggles independently of its parent section',
        !biggest.classList.contains('collapsed') && !admin.classList.contains('collapsed'));
    check('Sub-group aria-expanded flips to true', biggestHeader.getAttribute('aria-expanded') === 'true');
    check('Opening one group leaves the other four closed',
        [...groups].filter((g) => !g.classList.contains('collapsed')).length === 1);
    check('Every link in the opened group is on screen',
        [...biggest.querySelectorAll('a.nav-link')].every(isRevealed));

    const panel = biggest.querySelector('.nav-subsection-content');
    const linkTotal = [...panel.querySelectorAll('a.nav-link')]
        .reduce((sum, a) => sum + a.getBoundingClientRect().height, 0);
    check('Open sub-group is not clipped by max-height',
        panel.getBoundingClientRect().height >= linkTotal - 1);

    const openHeight = admin.getBoundingClientRect().height;
    check('Whole section still fits without scrolling a 900px viewport', openHeight < 700);

    // Collapse persistence — the controller writes through dashboard-store.js.
    const saved = (JSON.parse(localStorage.getItem(SIDEBAR_STORE_KEY) || '{}') || {}).data || {};
    check('Sub-group state persists under a namespaced key',
        Object.prototype.hasOwnProperty.call(saved, `sub:${biggest.dataset.subsection}`));
    check('Sub-group keys never collide with section keys',
        !Object.keys(saved).some((k) => k.startsWith('sub:') && Object.keys(saved).includes(k.slice(4))));

    metrics['Links total'] = links.length;
    metrics['Sub-groups'] = groups.length;
    metrics['Rows on open'] = visibleRows.length;
    metrics['Section height — groups closed'] = `${Math.round(collapsedHeight)}px`;
    metrics['Section height — largest group open'] = `${Math.round(openHeight)}px`;
    metrics['Per group'] = [...groups]
        .map((g) => `${g.querySelector('.nav-subsection-title').textContent.trim()} (${g.querySelectorAll('a.nav-link').length})`)
        .join(' · ');

    render();
}

document.getElementById('qaReload').addEventListener('click', () => run(document.getElementById('qaRole').value));
document.getElementById('qaRole').addEventListener('change', (e) => run(e.target.value));
run('admin').catch((err) => {
    document.getElementById('qaAssertions').innerHTML =
        `<li class="fail">Harness failed to start: ${err.message}</li>`;
});
