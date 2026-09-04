/* =====================================================================
   STAFF DASHBOARD v3 — WORKSPACE CONTROLLER (2026-09-03)

   The role-based tabs: Sales · Production · Art · Office · Company ·
   Everything · Admin. One <section class="ws-panel" data-ws="…"> per tab;
   exactly one is visible.

   Rules (decided with Erik 2026-09-03):
   - The tab that opens first comes from the signed-in role
     (/api/crm-session/me permissions): sales → Sales, art → Art,
     production/shipping → Production, accountant → Office, admin → Sales,
     no role → Everything. After that the page remembers the last tab per
     browser, and per email on shared machines.
   - A `#ws=<tab>` hash wins over both (house rule: hash, never ?query).
   - Hidden is NOT removed. Panels are display:none unless they carry the
     `is-on` class (workspaces.css); every tool stays in the DOM so the
     Ctrl+K palette (which harvests the live DOM) still finds a tool that
     lives on another tab.
     The `hidden` ATTRIBUTE is reserved for gating: nav-access-controller
     clears it on allowed [data-requires-role] nodes and removes the rest,
     and this controller never touches it.
   - "Everything" is GENERATED from the other panels — the union of their
     tools, deduped by href, grouped by each card's data-cat — so it can
     never miss a tool the way a hand-maintained list would.

   No network. localStorage via dashboard-store (slot: workspace).
   ===================================================================== */

import { store } from '../core/dashboard-store.js';
import { escapeHtml } from '../core/dashboard-ui-utils.js';

const ROLE_DEFAULT = Object.freeze({
    admin: 'sales',
    sales: 'sales',
    art: 'art',
    production: 'production',
    shipping: 'production',
    accountant: 'office',
    // 2026-09-04: the plain `staff` role (Jim) landed on Everything every visit while
    // the Office tab called itself "Bradley's and Jim's tab". Office is the closest
    // home for a generic staffer; Everything stays the fallback for NO role.
    staff: 'office',
});
const FALLBACK_WS = 'everything';
const HASH_RE = /(?:^|[#&])ws=([a-z-]+)/;

const state = {
    tabs: [],
    panels: [],
    current: null,
    everythingBuilt: false,
    email: null,
};

/* ── helpers ────────────────────────────────────────────────────────── */

function readMemory() {
    const saved = store.get('workspace');
    return saved && typeof saved === 'object' ? saved : { last: null, byEmail: {} };
}

function remember(ws) {
    const mem = readMemory();
    mem.last = ws;
    if (state.email) {
        mem.byEmail = mem.byEmail && typeof mem.byEmail === 'object' ? mem.byEmail : {};
        mem.byEmail[state.email] = ws;
    }
    store.set('workspace', mem);
}

function hashWorkspace() {
    const m = HASH_RE.exec(window.location.hash || '');
    return m ? m[1] : null;
}

// A panel that nav-access has removed, or is still gated-hidden, is not a
// valid destination — fall through to the default rather than show nothing.
function panelFor(ws) {
    const panel = state.panels.find((p) => p.dataset.ws === ws);
    if (!panel || !panel.isConnected) return null;
    if (panel.matches('[data-requires-role][hidden]')) return null;
    return panel;
}

/** Role → default tab. Exported for the harness + unit test. */
export function defaultWorkspaceFor(permissions) {
    const perms = (permissions || []).map((p) => String(p).toLowerCase());
    // Admin FIRST: permissionsFromRole fans an admin out to accountant/house/
    // taneisha/nika too, and Erik lands on Sales (decided 2026-09-03), not on
    // whichever fanned-out role happens to be checked earlier.
    for (const role of ['admin', 'sales', 'art', 'production', 'shipping', 'accountant', 'staff']) {
        if (perms.includes(role)) return ROLE_DEFAULT[role];
    }
    return FALLBACK_WS;
}

/* ── show ───────────────────────────────────────────────────────────── */

export function showWorkspace(ws, { remember: persist = true, updateHash = true } = {}) {
    let target = panelFor(ws);
    if (!target) {
        ws = FALLBACK_WS;
        target = panelFor(ws);
        if (!target) return null;
    }
    state.current = ws;

    state.tabs.forEach((tab) => {
        const on = tab.dataset.ws === ws;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
    });
    // Panels are display:none by default (workspaces.css) and the active one gets
    // `is-on` — a CLASS, never the `hidden` attribute: `hidden` on a
    // [data-requires-role] node means "gate not resolved / not allowed", and the
    // Ctrl+K palette, My Stuff and the Everything builder all read it that way.
    // nav-access-controller alone flips `hidden`; this controller never does.
    state.panels.forEach((panel) => {
        panel.classList.toggle('is-on', panel === target);
    });

    if (ws === 'everything') buildEverything();
    if (persist) remember(ws);
    if (updateHash) {
        try { window.history.replaceState(null, '', '#ws=' + ws); } catch { /* sandboxed */ }
    }
    return ws;
}

export function currentWorkspace() {
    return state.current;
}

/* ── Everything: generated from the other panels ────────────────────── */

function toolLabel(a) {
    const nm = a.querySelector('.ws-nm') || a.querySelector('b');
    const src = nm ? nm.cloneNode(true) : a.cloneNode(true);
    // Strip the decorations that ride inside a label.
    src.querySelectorAll('.ws-who, .ws-d, .qs-new-badge, .ws-lock, em').forEach((n) => n.remove());
    return (src.textContent || '').replace(/\s+/g, ' ').trim();
}

function familyClass(a) {
    const m = /\bf-[a-z-]+\b/.exec(a.className);
    return m ? m[0] : 'f-ref';
}

function isGatedHidden(el) {
    return !!el.closest('[data-requires-role][hidden]');
}

/**
 * Walk every non-Everything panel, collect its tools (deduped by href),
 * group by the link's own data-cat if set, else the owning card's, and render the list + filter.
 * Rebuilt whenever it is shown after the gated panels resolved, so an admin
 * sees the Admin links here and nobody else does.
 */
export function buildEverything({ force = false } = {}) {
    if (state.everythingBuilt && !force) return;
    const host = document.getElementById('wsEveryTools');
    const countEl = document.getElementById('wsEveryCount');
    const filter = document.getElementById('wsEveryFilter');
    if (!host) return;

    const groups = new Map();
    const seen = new Set();
    document.querySelectorAll('.ws-panel:not([data-ws="everything"]) a.ws-link[href]').forEach((a) => {
        if (a.hidden || isGatedHidden(a)) return;
        const href = a.getAttribute('href') || '';
        if (!href || href.startsWith('#') || seen.has(href)) return;
        const label = toolLabel(a);
        if (!label) return;
        seen.add(href);
        const cat = a.dataset.cat || a.closest('.ws-card')?.dataset.cat
            || a.closest('.ws-panel')?.querySelector('.ws-head h2')?.textContent?.trim()
            || 'Tools';
        // 2026-09-04: carry the description (shown under the name) and the
        // data-keywords (filter-only) so the safety net says what each tool IS.
        const descEl = a.querySelector('.ws-d');
        const desc = descEl ? (descEl.textContent || '').replace(/\s+/g, ' ').trim() : '';
        const keywords = a.dataset.keywords || '';
        if (!groups.has(cat)) groups.set(cat, []);
        groups.get(cat).push({ label, href, fam: familyClass(a), desc, keywords });
    });

    let total = 0;
    const html = [...groups.entries()].map(([cat, tools]) => {
        tools.sort((x, y) => x.label.localeCompare(y.label));
        total += tools.length;
        const rows = tools.map((t) =>
            `<a class="ws-link ws-row ${escapeHtml(t.fam)}" href="${escapeHtml(t.href)}" data-q="${escapeHtml((t.label + ' ' + t.desc + ' ' + t.keywords).toLowerCase())}">` +
            `<i class="ws-mk" aria-hidden="true"></i><span class="ws-nm">${escapeHtml(t.label)}</span>` +
            (t.desc ? `<span class="ws-d">${escapeHtml(t.desc)}</span>` : '') +
            `</a>`
        ).join('');
        return `<div class="ws-every__grp"><div class="ws-sub">${escapeHtml(cat)} · ${tools.length}</div><div class="ws-tools">${rows}</div></div>`;
    }).join('');

    host.innerHTML = html;
    if (countEl) countEl.textContent = `${total} tools`;
    state.everythingBuilt = true;

    if (filter && !filter.dataset.wired) {
        filter.dataset.wired = '1';
        filter.addEventListener('input', () => applyFilter(filter.value));
    }
    if (filter && filter.value) applyFilter(filter.value);
}

function applyFilter(raw) {
    const host = document.getElementById('wsEveryTools');
    const countEl = document.getElementById('wsEveryCount');
    if (!host) return;
    const q = String(raw || '').trim().toLowerCase();
    let n = 0;
    host.querySelectorAll('a.ws-row').forEach((a) => {
        const hit = !q || (a.dataset.q || '').includes(q);
        a.hidden = !hit;
        if (hit) n++;
    });
    host.querySelectorAll('.ws-every__grp').forEach((g) => {
        g.hidden = !g.querySelector('a.ws-row:not([hidden])');
    });
    if (countEl) countEl.textContent = q ? `${n} match` : `${n} tools`;
}

/* ── init ───────────────────────────────────────────────────────────── */

// The tab strip is position:sticky under the sticky .top-header (workspaces.css).
// The header's height is not a constant — it wraps on narrow screens — so its
// measured height is published as --ws-sticky-top and kept current on resize.
function syncStickyTop() {
    const header = document.querySelector('.top-header');
    if (!header) return;
    const apply = () => document.documentElement.style.setProperty('--ws-sticky-top', `${Math.round(header.getBoundingClientRect().height)}px`);
    apply();
    if (typeof ResizeObserver === 'function') new ResizeObserver(apply).observe(header);
    else window.addEventListener('resize', apply);
}

function wireTabs() {
    state.tabs.forEach((tab, i) => {
        tab.addEventListener('click', () => showWorkspace(tab.dataset.ws));
        tab.addEventListener('keydown', (e) => {
            const live = state.tabs.filter((t) => t.isConnected && !t.hidden);
            const idx = live.indexOf(tab);
            let next = -1;
            if (e.key === 'ArrowRight') next = (idx + 1) % live.length;
            else if (e.key === 'ArrowLeft') next = (idx - 1 + live.length) % live.length;
            else if (e.key === 'Home') next = 0;
            else if (e.key === 'End') next = live.length - 1;
            if (next < 0) return;
            e.preventDefault();
            live[next].focus();
            showWorkspace(live[next].dataset.ws);
        });
        if (i === 0) tab.tabIndex = 0;
    });

    // In-page "#ws=…" links (e.g. "see the Sales tab") switch without a reload.
    document.addEventListener('click', (e) => {
        const a = e.target.closest('a[href^="#ws="]');
        if (!a) return;
        e.preventDefault();
        showWorkspace(a.getAttribute('href').slice(4));
    });
    window.addEventListener('hashchange', () => {
        const ws = hashWorkspace();
        if (ws && ws !== state.current) showWorkspace(ws, { updateHash: false });
    });
}

/**
 * @param {object} [opts]
 * @param {Promise<string[]>} [opts.permissionsPromise] resolves to the lowercased
 *   permission list (nav-access-controller's return value) once the gated
 *   panels have been revealed or removed.
 * @param {Promise<object|null>} [opts.authPromise] resolves to the signed-in
 *   user ({email,…}) or null.
 */
export async function initWorkspaces({ permissionsPromise, authPromise } = {}) {
    state.tabs = [...document.querySelectorAll('.ws-tabs .ws-tab[data-ws]')];
    state.panels = [...document.querySelectorAll('.ws-panel[data-ws]')];
    if (!state.tabs.length || !state.panels.length) return null;

    wireTabs();
    syncStickyTop();

    // 1. Paint immediately: hash, else what this browser last used, else the
    //    fallback. No flash of the wrong tab while identity is still loading.
    const fromHash = hashWorkspace();
    const mem = readMemory();
    const first = fromHash || mem.last || FALLBACK_WS;
    showWorkspace(first, { remember: false, updateHash: !!fromHash });

    // 2. Once identity lands: an explicit hash always wins; otherwise the
    //    per-email memory (shared production machines), otherwise the role
    //    default for a first visit. Rebuild Everything either way, because
    //    the gated panels may just have appeared or vanished.
    let permissions = [];
    let user = null;
    try {
        [permissions, user] = await Promise.all([
            permissionsPromise || Promise.resolve([]),
            authPromise || Promise.resolve(null),
        ]);
    } catch (err) {
        console.warn('[workspaces] identity did not resolve; keeping the current tab', err);
    }
    state.email = user && user.email ? String(user.email).toLowerCase() : null;

    const roleDefault = defaultWorkspaceFor(permissions);
    state.tabs.forEach((tab) => tab.classList.toggle('is-you', tab.dataset.ws === roleDefault));

    state.everythingBuilt = false;
    if (fromHash) {
        if (state.current === 'everything') buildEverything({ force: true });
    } else {
        const remembered = (state.email && mem.byEmail && mem.byEmail[state.email]) || mem.last || null;
        const want = remembered && panelFor(remembered) ? remembered : roleDefault;
        showWorkspace(want, { remember: false, updateHash: false });
        if (want === 'everything') buildEverything({ force: true });
    }
    return state.current;
}
