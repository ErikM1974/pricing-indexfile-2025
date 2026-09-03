/* =====================================================
   STAFF DASHBOARD v3 — TOOL SEARCH (the hero bar / Ctrl+K)

   2026-07-20: shipped as the "Everything Bar" — tools plus a debounced
   backend fan-out over customers, orders, quotes and designs.
   2026-09-03 (Erik): TOOLS AND PAGES ONLY. The fan-out cost a proxy call
   on every keystroke, pushed the tool matches under a screen of customer
   and order rows, and every one of those things has a better search on its
   own page (Leads / the account pages, Saved Quotes, Design Vault). The
   dashboard search now does one job: find a tool on any tab, instantly,
   with no network.

   • Registry is harvested live from the page (every a.ws-link on every
     workspace tab + My Stuff), so it can never drift from what is shown.
   • Enter opens the top match. No match → one row that opens the
     Everything tab with the text already in its filter.
   • Closing: Escape, the × in the bar, picking a result, or clicking
     ANYWHERE outside the bar — and that outside click still lands where it
     was aimed (no dimming overlay swallowing it; the old backdrop made a
     tab switch take two clicks).
   ===================================================== */

import { events } from '../core/dashboard-events.js';
import { escapeHtml } from '../core/dashboard-ui-utils.js';
import { showWorkspace } from './workspace-controller.js';

const LOCAL_MAX = 8;
const MIN_CHARS = 2;

const state = {
    open: false,
    q: '',
    registry: null,       // [{label, href, icon, tab, card}]
    flat: [],             // rendered items in order, for keyboard nav
    sel: 0,
};

/* ── tool registry (harvested from the page itself) ── */

function cleanLabel(nm) {
    const c = nm.cloneNode(true);
    c.querySelectorAll('.ws-who, .qs-new-badge, em').forEach((n) => n.remove());
    return (c.textContent || '').replace(/\s+/g, ' ').trim();
}

function harvestRegistry() {
    const seen = new Set();
    const out = [];
    // Every tool on every tab, visible or not — a hidden tab is still one
    // keystroke away. Gated nodes that nav-access has not yet resolved (or has
    // removed) are skipped; the generated Everything list is skipped because it
    // repeats the same hrefs.
    const links = document.querySelectorAll('.ws-panel a.ws-link[href], .pinned-row a.tool-btn[href]');
    for (const a of links) {
        if (a.hidden || a.closest('[data-requires-role][hidden]') || a.closest('#wsEveryTools')) continue;
        const href = a.getAttribute('href') || '';
        if (!href || href.startsWith('#')) continue;
        if (seen.has(href)) continue;   // one tool, one result — even when it sits on two tabs
        const nm = a.querySelector('.ws-nm') || a.querySelector('.ws-tile__tx b');
        const label = (nm ? cleanLabel(nm) : (a.textContent || '').replace(/\s+/g, ' ').trim().split(' — ')[0]).slice(0, 48);
        if (!label) continue;
        seen.add(href);
        const panel = a.closest('.ws-panel');
        const tab = panel?.querySelector('.ws-head h2')?.textContent?.trim() || (a.closest('.pinned-row') ? 'My Stuff' : '');
        const card = a.closest('.ws-card')?.querySelector('.ws-card-h h3')?.textContent?.trim() || '';
        const iconEl = a.querySelector('i[class*="fa-"]');
        const icon = iconEl ? iconEl.className.replace(/\bws-[a-z_-]+\b/g, '').trim() : '';
        out.push({ label, href, icon: icon || 'fas fa-toolbox', tab, card });
    }
    // Actions that aren't plain links
    out.push({ label: 'New Quote', href: null, run: () => document.getElementById('quote-start-btn')?.click(), icon: 'fas fa-plus', tab: 'Sales', card: 'Quote' });
    return out;
}

function searchLocal(q) {
    if (!state.registry) state.registry = harvestRegistry();
    const needle = q.toLowerCase();
    const scored = [];
    for (const t of state.registry) {
        const hay = t.label.toLowerCase();
        let score = -1;
        if (hay.startsWith(needle)) score = 0;
        else if (hay.split(/[\s(/·-]+/).some((w) => w.startsWith(needle))) score = 1;   // word start: "quote" → Saved Quotes
        else if (hay.includes(needle)) score = 2;
        else if ((t.card + ' ' + t.tab).toLowerCase().includes(needle)) score = 3;
        if (score >= 0) scored.push({ score, t });
    }
    scored.sort((a, b) => a.score - b.score || a.t.label.localeCompare(b.t.label));
    return scored.slice(0, LOCAL_MAX).map((s) => s.t);
}

/* ── build flat item list ── */

function buildItems() {
    const items = [];
    const q = state.q;

    for (const t of searchLocal(q)) {
        items.push({
            group: t.run ? 'Actions' : 'Tools & pages',
            icon: `<i class="${escapeHtml(t.icon)}" aria-hidden="true"></i>`,
            title: t.label,
            meta: [t.tab, t.card].filter(Boolean).join(' · '),
            hint: '↵ open',
            href: t.href,
            run: t.run || null,
        });
    }
    if (!items.length) {
        items.push({
            group: 'No tool matches',
            icon: '<i class="fas fa-list" aria-hidden="true"></i>',
            title: `Show every tool filtered by "${q}"`,
            meta: 'Everything tab',
            hint: '↵ open',
            run: () => openEverything(q),
            everything: true,
        });
    }
    return items;
}

// Hand the query to the Everything tab's filter and go there.
function openEverything(q) {
    showWorkspace('everything');
    const filter = document.getElementById('wsEveryFilter');
    if (filter) {
        filter.value = q;
        filter.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.getElementById('wsTabs')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

/* ── render ── */

function render() {
    const list = document.getElementById('cpResults');
    const status = document.getElementById('cpStatus');
    if (!list || !status) return;

    if (state.q.trim().length < MIN_CHARS) {
        state.flat = [];
        list.innerHTML = '';
        status.textContent = `Type ${MIN_CHARS}+ letters of a tool or page name — every tab is searched, Enter opens the top match. Can't find it? The Everything tab lists every tool.`;
        return;
    }

    state.flat = buildItems();
    state.sel = Math.min(state.sel, Math.max(0, state.flat.length - 1));

    let html = '';
    let lastGroup = null;
    state.flat.forEach((it, i) => {
        if (it.group !== lastGroup) {
            html += `<div class="cp-group">${escapeHtml(it.group)}</div>`;
            lastGroup = it.group;
        }
        html += `
            <div class="cp-item${i === state.sel ? ' cp-item--sel' : ''}" role="option" aria-selected="${i === state.sel}" data-action="palette:pick" data-idx="${i}">
                <span class="cp-icon">${it.icon}</span>
                <span class="cp-main">
                    <span class="cp-title">${escapeHtml(it.title)}</span>
                    ${it.meta ? `<span class="cp-meta">${escapeHtml(it.meta)}</span>` : ''}
                </span>
                <span class="cp-hint">${escapeHtml(it.hint)}</span>
            </div>`;
    });
    list.innerHTML = html;
    status.textContent = state.flat[0]?.everything
        ? 'Customers, quotes, orders and designs each have their own search: Leads, Saved Quotes, Design Vault.'
        : '↑ ↓ to move · Enter to open · Esc to close';
}

function syncClear() {
    const clear = document.getElementById('cpClear');
    const input = document.getElementById('cpInput');
    if (clear && input) clear.hidden = !(state.open || input.value);
}

/* ── open/close ── */

function openPalette() {
    if (state.open) return;
    state.open = true;
    state.registry = null; // re-harvest — My Stuff pins / gated tabs may have changed
    document.getElementById('cpPanel').hidden = false;
    const input = document.getElementById('cpInput');
    input.setAttribute('aria-expanded', 'true');
    state.sel = 0;
    render();
    syncClear();
    // Persistent hero bar: focus it unless the focus event is what opened us.
    if (document.activeElement !== input) input.focus();
}

function closePalette() {
    if (!state.open) return;
    state.open = false;
    document.getElementById('cpPanel').hidden = true;
    const input = document.getElementById('cpInput');
    input.setAttribute('aria-expanded', 'false');
    input.value = '';
    state.q = ''; state.sel = 0;
    syncClear();
    input.blur();
}

function activate(i) {
    const it = state.flat[i];
    if (!it) return;
    if (it.run) {
        it.run();
        closePalette();
    } else if (it.href) {
        window.location.href = it.href;
    }
}

/* ── init ── */

export function initCommandPalette() {
    const input = document.getElementById('cpInput');
    if (!input) return;

    events.register('palette:open', () => openPalette());
    events.register('palette:close', () => closePalette());
    events.register('palette:pick', (el) => activate(parseInt(el.dataset.idx, 10)));

    // Persistent hero bar: focusing it opens the results panel.
    input.addEventListener('focus', () => openPalette());

    // Click-through close: a pointer press ANYWHERE outside the bar closes the
    // panel and is NOT swallowed — the tab or tile under it still gets the
    // click. (Capture phase so it runs before the target's own handlers; no
    // preventDefault, so the click proceeds.)
    document.addEventListener('pointerdown', (e) => {
        if (!state.open) return;
        if (e.target.closest('.hero-search-wrap')) return;
        closePalette();
    }, true);

    input.addEventListener('input', () => {
        state.q = input.value.trim();
        state.sel = 0;
        render();
        syncClear();
    });

    document.addEventListener('keydown', (e) => {
        // Ctrl+K / Cmd+K toggles from anywhere on the dashboard
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            state.open ? closePalette() : openPalette();
            return;
        }
        if (!state.open) return;
        // Accept legacy key names ('Down'/'Up'/'Esc') alongside the standard
        // ones — some remote-input/automation senders still emit them.
        const k = e.key;
        if (k === 'Escape' || k === 'Esc') { e.preventDefault(); closePalette(); }
        else if (k === 'ArrowDown' || k === 'Down') { e.preventDefault(); state.sel = Math.min(state.sel + 1, state.flat.length - 1); render(); }
        else if (k === 'ArrowUp' || k === 'Up') { e.preventDefault(); state.sel = Math.max(state.sel - 1, 0); render(); }
        else if (k === 'Enter') { e.preventDefault(); activate(state.sel); }
    });
}
