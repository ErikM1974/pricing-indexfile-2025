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
    const icon = a.querySelector('i')?.className || '';
    const label = (a.textContent || '').replace(/\s+/g, ' ').trim()
        // Drop trailing " — description" halves from sidebar links
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

function render() {
    const list = document.getElementById('myStuffList');
    if (!list) return;
    const { pins, recents } = readStore();
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
        const a = e.target.closest('a.tool-btn, a.nav-link, a.nav-section-header-link');
        if (!a || a.closest('#myStuffList')) return; // don't self-record
        const tool = toolFromLink(a);
        if (tool) recordVisit(tool);
    }, true);
}
