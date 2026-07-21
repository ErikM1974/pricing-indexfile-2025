/* =====================================================
   STAFF DASHBOARD v3 — PRIDE WALL (Phase 1 "alive" layer, 2026-07-20)

   A static strip of the six most recent finished-product photos —
   the work we actually made — sitting under the goal banner all day.

   Data: GET /api/staff/finished-photos/library (same-origin SAML
   forwarder that finished-photos-library.html uses; 60s server
   cache). Published photos only (showToCustomer) — the quality-vetted
   ones; falls back to all photos if nothing is published yet so the
   wall isn't empty in week 1.

   Order: newest work first, left → right (defensive uploadedDate sort).

   Frozen: the newest 6, static — no rotation/crossfade (Erik, 2026-07-21).
   Re-fetched hourly so genuinely new photos off the shop floor take
   their place at the front.

   Caption: each tile labels the account + design # (when set) on top,
   sales rep · date below — always visible, not hover-only.

   Failure state is VISIBLE but calm (muted one-liner, Rule #4 —
   this is decor, not pricing, so no alarm banner).
   ===================================================== */

import { escapeHtml } from '../core/dashboard-ui-utils.js';

const TILE_COUNT = 6;
const FETCH_LIMIT = 200;

// Newest first — the wall leads with the most recent work, left → right.
// The library API already returns rows newest-first; we sort defensively by
// uploadedDate so the wall stays correct even if that upstream order changes.
// Array.sort is stable, so ties / undated rows keep the API's original order
// (never worse than what the endpoint hands us). Parsing the naive Pacific
// timestamp as browser-local is fine here — every row gets the same treatment,
// so relative order is preserved (we only need ordering, not absolute time).
function uploadedAt(p) {
    const t = p && p.uploadedDate ? Date.parse(p.uploadedDate) : NaN;
    return isNaN(t) ? 0 : t;
}
function newestFirst(arr) {
    return arr.slice().sort((a, b) => uploadedAt(b) - uploadedAt(a));
}

// "Jul 21" — short + local. Same parse the library page uses; year omitted
// because the wall only ever shows the newest handful (all but certainly this year).
function fmtDate(s) {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function tileHtml(p) {
    const co = p.companyName || '';
    const dsn = p.designNumber ? `#${p.designNumber}` : '';
    const meta = [p.repName, fmtDate(p.uploadedDate)].filter(Boolean).join(' · ');
    const title = [co, dsn, meta].filter(Boolean).join(' · ') || 'Open the Photo Library';
    // Line 1 = company (truncates) with the design # pinned to the right so it is
    // never clipped; line 2 = rep · date. Each piece is dropped when it's absent.
    const line1 = (co || dsn)
        ? `<span class="pw-cap-co">
                ${co ? `<span class="pw-cap-name">${escapeHtml(co)}</span>` : ''}
                ${dsn ? `<span class="pw-cap-dsn">${escapeHtml(dsn)}</span>` : ''}
           </span>`
        : '';
    return `
        <a class="pw-tilelink" href="/dashboards/finished-photos-library.html" title="${escapeHtml(title)}">
            <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(co || 'Finished product photo')}" loading="lazy"
                 onerror="this.closest('.pw-tile').classList.add('pw-tile--dead')">
            <span class="pw-cap">
                ${line1}
                ${meta ? `<span class="pw-cap-meta">${escapeHtml(meta)}</span>` : ''}
            </span>
        </a>`;
}

function renderTiles(photos) {
    const track = document.getElementById('pwTrack');
    if (!track) return;
    track.innerHTML = photos
        .slice(0, TILE_COUNT)
        .map((p) => `<div class="pw-tile">${tileHtml(p)}</div>`)
        .join('');
}

async function load() {
    const strip = document.getElementById('prideWall');
    const track = document.getElementById('pwTrack');
    if (!strip || !track) return;

    let data;
    try {
        const res = await fetch(`/api/staff/finished-photos/library?limit=${FETCH_LIMIT}`, { credentials: 'same-origin' });
        data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) throw new Error(data.error || `HTTP ${res.status}`);
    } catch (err) {
        console.warn('[PrideWall] library unavailable:', err.message);
        strip.hidden = false;
        track.innerHTML = `<div class="pw-unavailable">Pride Wall photos unavailable right now — they'll be back on the next refresh.</div>`;
        return;
    }

    const all = (data.photos || []).filter((p) => p.imageUrl);
    const published = all.filter((p) => p.showToCustomer);
    const pool = published.length >= TILE_COUNT ? published : all;
    if (!pool.length) { strip.hidden = true; return; } // nothing to show yet — no empty chrome

    strip.hidden = false;
    renderTiles(newestFirst(pool));
}

export function initPrideWall() {
    load();
    // Refresh hourly — new photos from the shop floor take their place at the front.
    setInterval(load, 60 * 60 * 1000);
}
