/* =====================================================
   STAFF DASHBOARD v3 — COMMAND PALETTE (Phase 2 "effortless" layer, 2026-07-20)

   Ctrl+K anywhere on the dashboard → one box that finds ANYTHING:
   • Tools & pages — harvested live from the dashboard's own DOM
     (every .tool-btn + sidebar link), so the registry can never
     drift from the real grid. Instant, no network.
   • Customers / Orders / Quotes / Designs — debounced backend
     search via GET /api/staff/command-search (SAML forwarder →
     proxy fan-out). Until the proxy route is deployed, the palette
     says so plainly and keeps tool search working (Rule #4:
     visible, never silent).

   Primary action per result type (v1 — deep links where real
   destinations exist, clipboard where they don't yet):
     tool     → navigate            quote  → /quote/<QuoteID>
     customer → their rep's CRM     order  → copy order # (toast)
     design   → copy design # (toast)
   ===================================================== */

import { events } from '../core/dashboard-events.js';
import { escapeHtml, formatMoney, debounce } from '../core/dashboard-ui-utils.js';

const BACKEND_DEBOUNCE_MS = 275;
const LOCAL_MAX = 6;

const state = {
    open: false,
    q: '',
    registry: null,       // [{label, href, icon, category}]
    local: [],
    backend: null,        // null | 'loading' | 'unavailable' | {customers,orders,quotes,designs,errors}
    flat: [],             // rendered items in order, for keyboard nav
    sel: 0,
    lastQueried: '',
};

/* ── tool registry (harvested from the page itself) ── */

function harvestRegistry() {
    const seen = new Set();
    const out = [];
    const links = document.querySelectorAll(
        '.quick-access-grid a.tool-btn, .pinned-row a.tool-btn, ' +
        '.sidebar-nav a.nav-link, .sidebar-nav a.nav-section-header-link, .tool-workflow a.tool-btn');
    for (const a of links) {
        const href = a.getAttribute('href') || '';
        if (!href || href.startsWith('#')) continue;
        const label = (a.textContent || '').replace(/\s+/g, ' ').trim().split(' — ')[0].slice(0, 48);
        if (!label) continue;
        const key = `${href}|${label.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const cat = a.closest('.tool-category')?.querySelector('.tool-category-title')?.textContent?.trim()
            || a.closest('.nav-section')?.querySelector('.nav-section-title span:last-child')?.textContent?.trim()
            || 'Tools';
        out.push({ label, href, icon: a.querySelector('i')?.className || 'fas fa-toolbox', category: cat });
    }
    // Actions that aren't plain links
    out.push({ label: 'New Quote', href: null, run: () => document.getElementById('quote-start-btn')?.click(), icon: 'fas fa-plus', category: 'Actions' });
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
        else if (hay.includes(needle)) score = 1;
        else if (t.category.toLowerCase().includes(needle)) score = 2;
        if (score >= 0) scored.push({ score, t });
    }
    scored.sort((a, b) => a.score - b.score || a.t.label.localeCompare(b.t.label));
    return scored.slice(0, LOCAL_MAX).map((s) => s.t);
}

/* ── backend search ── */

const fetchBackend = debounce(async (q) => {
    state.lastQueried = q;
    try {
        const res = await fetch(`/api/staff/command-search?q=${encodeURIComponent(q)}`, { credentials: 'same-origin' });
        if (state.q !== q) return; // stale response — user kept typing
        if (res.status === 404 || res.status === 502 || res.status === 503) {
            state.backend = 'unavailable';
        } else if (!res.ok) {
            state.backend = 'unavailable';
            console.warn('[palette] backend search HTTP', res.status);
        } else {
            state.backend = await res.json();
        }
    } catch (err) {
        if (state.q !== q) return;
        state.backend = 'unavailable';
        console.warn('[palette] backend search failed:', err.message);
    }
    render();
}, BACKEND_DEBOUNCE_MS);

/* ── result actions ── */

function repCrmHref(rep) {
    const r = String(rep || '').toLowerCase();
    if (r.startsWith('nika')) return '/dashboards/nika-crm.html';
    if (r.startsWith('taneisha')) return '/dashboards/taneisha-crm.html';
    return '/dashboards/house-accounts.html';
}

function copyWithToast(text, label) {
    const done = () => showToast(`${label} copied — paste it anywhere`);
    try {
        navigator.clipboard.writeText(text).then(done, done);
    } catch { done(); }
}

function showToast(msg) {
    const el = document.getElementById('cpToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('cp-toast--show');
    setTimeout(() => el.classList.remove('cp-toast--show'), 1800);
}

/* ── build flat item list ── */

function buildItems() {
    const items = [];
    const q = state.q;

    for (const t of searchLocal(q)) {
        items.push({
            group: t.category === 'Actions' ? 'Actions' : 'Tools & pages',
            icon: `<i class="${escapeHtml(t.icon)}" aria-hidden="true"></i>`,
            title: t.label,
            meta: t.category,
            hint: '↵ open',
            href: t.href,
            run: t.run || null,
        });
    }

    const b = state.backend;
    if (b && typeof b === 'object') {
        for (const c of b.customers || []) {
            items.push({
                group: 'Customers',
                icon: '🏢', title: c.company,
                meta: [c.rep, c.city && `${c.city}, ${c.state}`].filter(Boolean).join(' · '),
                hint: '↵ open CRM',
                href: repCrmHref(c.rep),
            });
        }
        for (const o of b.orders || []) {
            items.push({
                group: 'Orders (ShopWorks)',
                icon: '📦', title: `#${o.idOrder} — ${o.company}`,
                meta: [o.orderType, o.rep, o.subtotal ? formatMoney(o.subtotal) : '', o.shipped ? 'shipped' : 'open'].filter(Boolean).join(' · '),
                hint: '↵ copy #',
                run: () => copyWithToast(String(o.idOrder), `Order #${o.idOrder}`),
                keep: true,
            });
        }
        for (const qt of b.quotes || []) {
            items.push({
                group: 'Quotes',
                icon: '💬', title: `${qt.quoteID} — ${qt.company}`,
                meta: [qt.status, qt.rep, qt.subtotal ? formatMoney(qt.subtotal) : ''].filter(Boolean).join(' · '),
                hint: '↵ open',
                href: `/quote/${encodeURIComponent(qt.quoteID)}`,
            });
        }
        for (const d of b.designs || []) {
            items.push({
                group: 'Designs',
                icon: '🧵', title: `#${d.designNumber}${d.name ? ' — ' + d.name : ''}`,
                meta: [d.company, d.stitchCount ? `${d.stitchCount.toLocaleString()} st` : ''].filter(Boolean).join(' · '),
                hint: '↵ copy #',
                run: () => copyWithToast(String(d.designNumber), `Design #${d.designNumber}`),
                keep: true,
            });
        }
    }
    return items;
}

/* ── render ── */

function render() {
    const list = document.getElementById('cpResults');
    const status = document.getElementById('cpStatus');
    if (!list || !status) return;

    if (state.q.trim().length < 2) {
        state.flat = [];
        list.innerHTML = '';
        status.textContent = 'Type at least 2 characters — a customer, order #, quote, design #, or any tool.';
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

    if (state.backend === 'loading') {
        status.textContent = 'Searching customers, orders, quotes & designs…';
    } else if (state.backend === 'unavailable') {
        status.textContent = 'Tool search works now — customer/order/quote/design search lights up after the next backend deploy.';
    } else if (state.backend && typeof state.backend === 'object') {
        const errs = Object.keys(state.backend.errors || {});
        status.textContent = errs.length
            ? `Heads up: ${errs.join(', ')} search failed — showing the rest.`
            : (state.flat.length ? '' : 'No matches — try fewer letters or a different spelling.');
    } else {
        status.textContent = '';
    }
}

/* ── open/close ── */

function openPalette() {
    if (state.open) return;
    state.open = true;
    state.registry = null; // re-harvest — My Stuff pins may have changed
    document.getElementById('cp-backdrop').hidden = false;
    document.getElementById('cpPanel').hidden = false;
    const input = document.getElementById('cpInput');
    input.setAttribute('aria-expanded', 'true');
    state.sel = 0;
    render();
    // Persistent hero bar: focus it unless the focus event is what opened us.
    if (document.activeElement !== input) input.focus();
}

function closePalette() {
    if (!state.open) return;
    state.open = false;
    document.getElementById('cp-backdrop').hidden = true;
    document.getElementById('cpPanel').hidden = true;
    const input = document.getElementById('cpInput');
    input.setAttribute('aria-expanded', 'false');
    input.value = '';
    state.q = ''; state.backend = null; state.sel = 0;
    input.blur();
}

function activate(i) {
    const it = state.flat[i];
    if (!it) return;
    if (it.run) {
        it.run();
        if (!it.keep) closePalette();
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

    document.getElementById('cp-backdrop')?.addEventListener('click', closePalette);

    // Persistent hero bar: focusing it opens the results panel. (No blur→close
    // handler on purpose — that would fire before a result click registers.)
    input.addEventListener('focus', () => openPalette());

    input.addEventListener('input', () => {
        state.q = input.value.trim();
        state.sel = 0;
        if (state.q.length >= 2) {
            state.backend = 'loading';
            fetchBackend(state.q);
        } else {
            state.backend = null;
        }
        render();
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
