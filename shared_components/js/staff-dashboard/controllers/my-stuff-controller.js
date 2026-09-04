/* =====================================================
   STAFF DASHBOARD v3 — MY STUFF ROW (Phase 1 "personal" layer, 2026-07-20)

   The dashboard learns YOU: a personal strip above ⭐ Frequently
   Used showing your pinned tools first, then your recent tools.

   Flow (deliberately zero-config):
   1. Click any tool button or sidebar link → it lands in Recents.
   2. Hover a Recent chip and hit its ☆ → it's pinned (★) and
      survives forever; hit ★ to unpin.
   Nothing is ever hidden or moved by this — the full tool grid
   below stays exactly as-is (house rule: never make a loved tool
   hard to find).

   Storage: localStorage, per browser. Shared production machines
   just share a recents list — acceptable; pins are additive only.
   ===================================================== */

import { events } from '../core/dashboard-events.js';
import { escapeHtml } from '../core/dashboard-ui-utils.js';

const STORE_KEY = 'nwca-mystuff-v1';
const RECENTS_CAP = 12;   // stored
const RECENTS_SHOW = 6;   // rendered (after pins)

function readStore() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        const s = raw ? JSON.parse(raw) : null;
        return { pins: Array.isArray(s?.pins) ? s.pins : [], recents: Array.isArray(s?.recents) ? s.recents : [] };
    } catch { return { pins: [], recents: [] }; }
}

function writeStore(s) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch { /* quota/private mode */ }
}

/* Only allow FontAwesome-ish class strings through to innerHTML. */
function safeIcon(icon) {
    return /^[a-z0-9 -]+$/i.test(icon || '') ? icon : 'fas fa-toolbox';
}

function toolFromLink(a) {
    const href = a.getAttribute('href') || '';
    // Internal destinations only — skip modals, hash-only, external links
    if (!href || href.startsWith('#') || /^https?:\/\//i.test(href)) return null;
    // Workspaces (2026-09-03): a row's label is its .ws-nm (a tile's <b>), never the
    // whole textContent — that used to sweep in the "Updated · Aug 5" chip and the
    // Shop Menu's "Est. 1977" subtitle ("Shop MenuEst. 1977 · every service price").
    const nm = a.querySelector('.ws-nm') || a.querySelector('.ws-tile__tx b');
    let raw;
    if (nm) {
        const c = nm.cloneNode(true);
        c.querySelectorAll('.ws-who, .qs-new-badge, em').forEach((n) => n.remove());
        raw = c.textContent;
    } else {
        raw = a.textContent;
    }
    const iconEl = a.querySelector('i[class*="fa-"]');
    const icon = iconEl ? iconEl.className.replace(/\bws-[a-z_-]+\b/g, '').trim() : '';
    const label = (raw || '').replace(/\s+/g, ' ').trim()
        // Drop trailing " — description" halves from legacy links
        .split(' — ')[0].slice(0, 40);
    if (!label) return null;
    return { href, label, icon: safeIcon(icon) };
}

/* ── render ─────────────────────────────────────────── */

function chipHtml(tool, pinned) {
    return `
        <span class="ms-chip${pinned ? ' ms-chip--pinned' : ''}">
            <a href="${escapeHtml(tool.href)}" class="tool-btn ms-chip-link">
                <i class="${escapeHtml(safeIcon(tool.icon))}" aria-hidden="true"></i> ${escapeHtml(tool.label)}
            </a>
            <button type="button" class="ms-star" data-action="mystuff:toggle-pin"
                    data-href="${escapeHtml(tool.href)}"
                    aria-label="${pinned ? `Unpin ${escapeHtml(tool.label)}` : `Pin ${escapeHtml(tool.label)}`}"
                    title="${pinned ? 'Unpin' : 'Pin — keeps it here forever'}">${pinned ? '★' : '☆'}</button>
        </span>`;
}

/* Stored chips carry the label as it was recorded. Before 2026-09-03 that was the
   link's whole textContent — "Shop MenuEst. 1977 · every service price" — and a
   pin is forever, so those labels would never heal on their own. On every render,
   re-derive the label (and icon) from the live link with the same href when one is
   on the page; a chip whose page is no longer linked keeps what it has. */
function refreshFromDom(s) {
    let changed = false;
    const fix = (t) => {
        const a = document.querySelector(`.ws-panel a.ws-link[href="${CSS.escape(t.href)}"]`);
        if (!a) return t;
        const fresh = toolFromLink(a);
        if (!fresh || (fresh.label === t.label && fresh.icon === t.icon)) return t;
        changed = true;
        return { ...t, label: fresh.label, icon: fresh.icon };
    };
    // Recents are learned from clicks on THIS page, so one whose page is no longer
    // linked anywhere here was retired or renamed — drop it rather than keep
    // offering a dead tool (the retired Shop Services calculator sat in Erik's
    // recents for a day). Pins are deliberate and are never dropped.
    // Only on a page that actually has workspace panels — a harness or a page
    // with no panels must not wipe recents it just recorded.
    const hasPanels = !!document.querySelector('.ws-panel a.ws-link');
    const onPage = (t) => !!document.querySelector(`.ws-panel a.ws-link[href="${CSS.escape(t.href)}"]`);
    const recents = hasPanels ? s.recents.filter(onPage) : s.recents;
    if (recents.length !== s.recents.length) changed = true;
    const next = { pins: s.pins.map(fix), recents: recents.map(fix) };
    if (changed) writeStore(next);
    return next;
}

function render() {
    const list = document.getElementById('myStuffList');
    if (!list) return;
    const { pins, recents } = refreshFromDom(readStore());
    const pinnedHrefs = new Set(pins.map((p) => p.href));
    const shownRecents = recents.filter((r) => !pinnedHrefs.has(r.href)).slice(0, RECENTS_SHOW);

    if (!pins.length && !shownRecents.length) {
        list.innerHTML = `<span class="ms-hint">Use any tool below and it shows up here — hit its ☆ to pin it for good.</span>`;
        return;
    }
    list.innerHTML =
        pins.map((t) => chipHtml(t, true)).join('') +
        shownRecents.map((t) => chipHtml(t, false)).join('');
}

/* ── behavior ───────────────────────────────────────── */

function recordVisit(tool) {
    const s = readStore();
    s.recents = [tool, ...s.recents.filter((r) => r.href !== tool.href)].slice(0, RECENTS_CAP);
    writeStore(s);
    // No re-render needed — the browser is navigating away; the row is
    // fresh on the next dashboard load.
}

function togglePin(href) {
    const s = readStore();
    const existing = s.pins.find((p) => p.href === href);
    if (existing) {
        s.pins = s.pins.filter((p) => p.href !== href);
    } else {
        const tool = s.recents.find((r) => r.href === href);
        if (!tool) return;
        s.pins = [...s.pins, tool];
    }
    writeStore(s);
    render();
}

export function initMyStuff() {
    render();

    events.register('mystuff:toggle-pin', (el, e) => {
        e.preventDefault();
        togglePin(el.dataset.href);
    });

    // Delegated capture of tool usage — one listener, survives re-renders.
    // Capture phase so we record even though navigation follows immediately.
    document.addEventListener('click', (e) => {
        // a.tool-btn = the Ctrl+K palette's own result rows; the sidebar selectors left with the sidebar.
        const a = e.target.closest('a.ws-link, a.tool-btn');
        if (!a || a.closest('#myStuffList')) return; // don't self-record
        const tool = toolFromLink(a);
        if (tool) recordVisit(tool);
    }, true);
}
