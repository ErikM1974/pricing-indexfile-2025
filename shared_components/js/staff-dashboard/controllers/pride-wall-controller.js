/* =====================================================
   STAFF DASHBOARD v3 — PRIDE WALL (Phase 1 "alive" layer, 2026-07-20)

   Ambient strip of recent finished-product photos — the work we
   actually made, drifting by under the goal banner all day.

   Data: GET /api/staff/finished-photos/library (same-origin SAML
   forwarder that finished-photos-library.html uses; 60s server
   cache). Published photos only (showToCustomer) — those are the
   quality-vetted ones; falls back to all photos if nothing is
   published yet so the wall isn't empty in week 1.

   Rotation: one random tile crossfades to the next photo every
   ~7s. prefers-reduced-motion ⇒ static 6 photos, no rotation.
   Failure state is VISIBLE but calm (muted one-liner, Rule #4 —
   this is decor, not pricing, so no alarm banner).
   ===================================================== */

import { escapeHtml } from '../core/dashboard-ui-utils.js';

const TILE_COUNT = 6;
const ROTATE_MS = 7000;
const FETCH_LIMIT = 200;

const state = {
    photos: [],     // shuffled pool
    cursor: 0,      // next photo to show
    onTiles: [],    // photo per tile index
    timer: null,
};

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function nextPhoto() {
    const p = state.photos[state.cursor % state.photos.length];
    state.cursor++;
    return p;
}

function tileHtml(p) {
    const cap = [p.companyName, p.repName].filter(Boolean).join(' · ');
    return `
        <a class="pw-tilelink" href="/dashboards/finished-photos-library.html" title="${escapeHtml(cap || 'Open the Photo Library')}">
            <img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(cap || 'Finished product photo')}" loading="lazy"
                 onerror="this.closest('.pw-tile').classList.add('pw-tile--dead')">
            <span class="pw-cap">${escapeHtml(cap)}</span>
        </a>`;
}

function renderStatic() {
    const track = document.getElementById('pwTrack');
    if (!track) return;
    state.onTiles = Array.from({ length: Math.min(TILE_COUNT, state.photos.length) }, () => nextPhoto());
    track.innerHTML = state.onTiles
        .map((p) => `<div class="pw-tile">${tileHtml(p)}</div>`)
        .join('');
}

function rotateOneTile() {
    const track = document.getElementById('pwTrack');
    if (!track || state.photos.length <= TILE_COUNT) return;
    const tiles = track.querySelectorAll('.pw-tile');
    if (!tiles.length) return;

    const i = Math.floor(Math.random() * tiles.length);
    const tile = tiles[i];
    // Skip photos already on screen so the wall never shows duplicates.
    const showing = new Set(state.onTiles.map((p) => p && p.imageUrl));
    let fresh = nextPhoto();
    let guard = 0;
    while (showing.has(fresh.imageUrl) && guard++ < state.photos.length) fresh = nextPhoto();
    state.onTiles[i] = fresh;
    tile.classList.add('pw-tile--fading');
    setTimeout(() => {
        tile.innerHTML = tileHtml(fresh);
        tile.classList.remove('pw-tile--fading');
    }, 600); // matches the CSS opacity transition
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

    state.photos = shuffle(pool.slice());
    state.cursor = 0;
    strip.hidden = false;
    renderStatic();

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && !state.timer && state.photos.length > TILE_COUNT) {
        state.timer = setInterval(rotateOneTile, ROTATE_MS);
    }
}

export function initPrideWall() {
    load();
    // Refresh the pool hourly — new photos from the shop floor join the wall.
    setInterval(load, 60 * 60 * 1000);
}
