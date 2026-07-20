/* =====================================================
   STAFF DASHBOARD v3 — WIN BELL (Phase 1 "alive" layer, 2026-07-20)

   The sales-floor bell, digitized: a slim live ticker under the
   goal banner that celebrates wins the moment the data shows them.

   Event sources (NO new backend — reuses feeds already on the page):
   • quote_sessions (same proxy endpoint the Orders Inbox uses,
     WITHOUT &refresh=true so polls ride the proxy cache and don't
     burn Caspio quota) — new paid storefront orders + newly
     Accepted quotes, diffed against a localStorage seen-set.
   • #goalPercent DOM (rendered by sales-goal-controller) — crossing
     a 10% band of the 2026 goal fires a milestone.

   First run seeds the seen-set silently (no celebration flood) and
   shows a one-time intro line so the strip isn't empty on day 1.
   Confetti respects prefers-reduced-motion.
   ===================================================== */

import { apiBaseUrl } from '../core/dashboard-endpoints.js';
import { dashboardFetchJson } from '../core/dashboard-fetch.js';
import { escapeHtml, formatMoney, formatRelativeTime } from '../core/dashboard-ui-utils.js';

const SEEN_KEY = 'nwca-winbell-seen-v1';
const FEED_KEY = 'nwca-winbell-feed-v1';
const POLL_MS = 5 * 60 * 1000;
const SEEN_CAP = 600;   // ids retained for diffing
const FEED_CAP = 30;    // events retained for display
const SHOW_MAX = 4;     // events rendered in the strip

const STOREFRONT_PREFIXES = ['SAM', 'CAP', 'DTG', '3DT', 'TDT', 'CTS'];

/* ── storage ────────────────────────────────────────── */

function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
}

function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota/private mode */ }
}

/* ── event id + classification (mirrors orders-inbox rules) ── */

function ymdDaysAgo(days) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
}

function prefixOf(quoteID) {
    const m = String(quoteID || '').match(/^([A-Z]+)/);
    return m ? m[1] : '';
}

function eventsFromSessions(sessions) {
    const found = [];
    for (const s of sessions) {
        const status = String(s.Status || '');
        const pfx = prefixOf(s.QuoteID);
        // Erik 2026-07-20: show the pre-tax SUBTOTAL (falls back to TotalAmount
        // for old rows), plus the sales rep and the order-type prefix chip.
        const subtotal = parseFloat(s.SubtotalAmount) || parseFloat(s.TotalAmount) || 0;
        const rep = String(s.SalesRepName || '').split(' ')[0]; // first name keeps the line short
        const who = s.CompanyName || s.CustomerName || s.QuoteID;
        const base = { pfx, rep, amt: subtotal, href: `/quote/${encodeURIComponent(s.QuoteID)}` };
        if ((status === 'Processed' || status === 'Payment Confirmed') && STOREFRONT_PREFIXES.includes(pfx)) {
            found.push({ ...base, id: `${s.QuoteID}|paid`, icon: '📦', text: `Paid web order — ${who}` });
        } else if (status === 'Accepted') {
            found.push({ ...base, id: `${s.QuoteID}|accepted`, icon: '✅', text: `Quote accepted — ${who}` });
        }
    }
    return found;
}

/* ── confetti (tiny, dependency-free, reduced-motion aware) ── */

function fireConfetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (document.getElementById('wbConfettiCanvas')) return; // one burst at a time

    const canvas = document.createElement('canvas');
    canvas.id = 'wbConfettiCanvas';
    canvas.className = 'wb-confetti';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const colors = ['#4ade80', '#3a7c52', '#f5c04a', '#ffffff', '#6db3f2'];
    const parts = Array.from({ length: 90 }, () => ({
        x: canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.5,
        y: -20 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 5,
        vy: 2 + Math.random() * 3.5,
        size: 5 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)],
    }));

    // rAF pauses in background tabs — without this fallback the canvas
    // would linger forever and its presence blocks every later burst.
    setTimeout(() => canvas.remove(), 2600);

    const started = performance.now();
    function frame(now) {
        const elapsed = now - started;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of parts) {
            p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.rot += p.vr;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.globalAlpha = Math.max(0, 1 - elapsed / 1800);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            ctx.restore();
        }
        if (elapsed < 1800) {
            requestAnimationFrame(frame);
        } else {
            canvas.remove();
        }
    }
    requestAnimationFrame(frame);
}

/* ── render ─────────────────────────────────────────── */

function render(feed, { celebrate = false } = {}) {
    const strip = document.getElementById('winBellStrip');
    const list = document.getElementById('wbEvents');
    if (!strip || !list) return;
    if (!feed.length) { strip.hidden = true; return; }

    strip.hidden = false;
    list.innerHTML = feed.slice(0, SHOW_MAX).map((ev, i) => `
        <${ev.href ? `a href="${escapeHtml(ev.href)}" target="_blank" rel="noopener"` : 'span'}
            class="wb-event${i === 0 && celebrate ? ' wb-event--new' : ''}">
            <span aria-hidden="true">${escapeHtml(ev.icon)}</span>
            ${ev.pfx ? `<span class="wb-pfx">${escapeHtml(ev.pfx)}</span>` : ''}
            <span class="wb-event-text">${escapeHtml(ev.text)}</span>
            ${ev.amt ? `<span class="wb-amt">${formatMoney(ev.amt)}</span>` : ''}
            ${ev.rep ? `<span class="wb-rep">${escapeHtml(ev.rep)}</span>` : ''}
            <span class="wb-when">${escapeHtml(formatRelativeTime(new Date(ev.ts)))}</span>
        </${ev.href ? 'a' : 'span'}>`).join('');

    if (celebrate) {
        const bell = document.getElementById('wbBell');
        if (bell) {
            bell.classList.remove('wb-bell--ring'); // restart animation
            void bell.offsetWidth;
            bell.classList.add('wb-bell--ring');
        }
        fireConfetti();
    }
}

/* ── polling ────────────────────────────────────────── */

async function poll() {
    let rows;
    try {
        // No &refresh=true on purpose — win detection can be a few minutes
        // stale; riding the proxy cache keeps Caspio API usage flat.
        rows = await dashboardFetchJson(
            `${apiBaseUrl}/quote_sessions?createdAfter=${ymdDaysAgo(30)}`);
    } catch (err) {
        console.warn('[WinBell] poll failed (will retry next interval):', err.message);
        return;
    }
    const sessions = Array.isArray(rows) ? rows : (rows?.data || []);
    const current = eventsFromSessions(sessions);

    const seen = readJson(SEEN_KEY, null);
    const feed = readJson(FEED_KEY, []);

    if (!seen) {
        // First run on this browser: seed silently, introduce the bell once.
        writeJson(SEEN_KEY, { ids: current.map((e) => e.id), goalBand: null });
        const intro = { id: 'intro', icon: '🔔', text: 'The Win Bell is live — new orders and accepted quotes will ring here.', amt: 0, ts: Date.now() };
        writeJson(FEED_KEY, [intro]);
        render([intro]);
        return;
    }

    const seenIds = new Set(seen.ids || []);
    const fresh = current.filter((e) => !seenIds.has(e.id));
    if (fresh.length) {
        const now = Date.now();
        const newFeed = [
            ...fresh.map((e) => ({ ...e, ts: now })),
            ...feed.filter((e) => e.id !== 'intro'),
        ].slice(0, FEED_CAP);
        writeJson(FEED_KEY, newFeed);
        writeJson(SEEN_KEY, {
            ...seen,
            ids: [...fresh.map((e) => e.id), ...seen.ids].slice(0, SEEN_CAP),
        });
        render(newFeed, { celebrate: true });
    } else {
        render(feed); // refresh relative times
    }
}

/* ── goal milestone (reads what sales-goal-controller rendered) ── */

function checkGoalMilestone() {
    const el = document.getElementById('goalPercent');
    const pct = parseInt(el?.textContent, 10);
    if (!Number.isFinite(pct) || pct <= 0) return;
    const band = Math.floor(pct / 10) * 10;

    const seen = readJson(SEEN_KEY, null);
    if (!seen) return; // poll() seeds first
    if (seen.goalBand === null || seen.goalBand === undefined) {
        writeJson(SEEN_KEY, { ...seen, goalBand: band }); // baseline, no fanfare
        return;
    }
    if (band > seen.goalBand) {
        const feed = readJson(FEED_KEY, []);
        const ev = { id: `goal|${band}`, icon: '🏆', text: `We just crossed ${band}% of the 2026 goal!`, amt: 0, ts: Date.now() };
        const newFeed = [ev, ...feed.filter((e) => e.id !== 'intro')].slice(0, FEED_CAP);
        writeJson(FEED_KEY, newFeed);
        writeJson(SEEN_KEY, { ...seen, goalBand: band });
        render(newFeed, { celebrate: true });
    }
}

export function initWinBell() {
    // Show whatever the last session left in the feed immediately —
    // the strip should never flash empty for returning users.
    const feed = readJson(FEED_KEY, []);
    if (feed.length) render(feed);

    poll();
    setInterval(poll, POLL_MS);
    // Goal % renders async from the sales-goal controller; check once
    // it has had ample time, then hourly (it only moves a little per day).
    setTimeout(checkGoalMilestone, 15_000);
    setInterval(checkGoalMilestone, 60 * 60 * 1000);
}
