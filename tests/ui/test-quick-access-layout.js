/* Quick Access layout harness (2026-07-29 IA reorg).

   Fetches the production dashboard, lifts its Pride Wall + Quick Access
   zone into this page, runs the real tool-grid-controller against them,
   and asserts the things the reorg is supposed to guarantee:

     - exactly 6 category cards, in the intended order
     - every count badge equals that card's unique-href count
     - Pricing spans 2 tracks at >=880px container and 1 track below
     - Reference spans the full row at every width
     - no card overflows its grid cell horizontally

   Layout is measured from real getBoundingClientRect values, so a broken
   grid rule fails here rather than looking fine in the DOM and wrong on
   screen. */

import { initToolGrid } from '/shared_components/js/staff-dashboard/controllers/tool-grid-controller.js';

const SOURCE = '/staff-dashboard-v3/index.html';

const EXPECTED_ORDER = [
    'Quoting',
    'Pricing',
    'Production',
    'Art & Design',
    'CRM & Customers',
    'Reference',
];

const resultsEl = document.getElementById('results');
const stageEl   = document.getElementById('stage');
const mountEl   = document.getElementById('mount');
const widthEl   = document.getElementById('widthReadout');

const lines = [];
let failures = 0;

// Messages mention tag names like <details>, so everything caller-supplied
// is escaped — an unescaped one silently ate the rest of the report once.
function esc(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function head(text)      { lines.push(`<span class="head">${esc(text)}</span>`); }
function check(ok, text) {
    if (!ok) failures++;
    lines.push(`<span class="${ok ? 'pass' : 'fail'}">${ok ? 'PASS' : 'FAIL'}</span>  ${esc(text)}`);
}
function flush() {
    lines.unshift(
        `<span class="${failures ? 'fail' : 'pass'}">${failures ? `${failures} FAILURE(S)` : 'ALL CHECKS PASSED'}</span>\n`
    );
    resultsEl.innerHTML = lines.join('\n');
}

async function loadProductionMarkup() {
    const res = await fetch(SOURCE, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${SOURCE} → HTTP ${res.status}`);
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');

    const prideWall = doc.querySelector('#prideWall');
    const zone      = doc.querySelector('.zone-quick-access');
    if (!zone) throw new Error('.zone-quick-access not found in the production page');

    // Pride Wall ships hidden and is revealed by its controller once photos
    // load. There's no API here, so reveal it manually and drop in a few
    // placeholder tiles so its collapsed/expanded heights are measurable.
    if (prideWall) {
        prideWall.hidden = false;
        const track = prideWall.querySelector('#pwTrack');
        if (track) track.innerHTML = '<div class="pw-tile"></div>'.repeat(6);
        mountEl.appendChild(prideWall);
    }
    mountEl.appendChild(zone);
}

function cards() {
    return [...document.querySelectorAll('.quick-access-grid > .tool-category')];
}

function trackCount() {
    const grid = document.querySelector('.quick-access-grid');
    return getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length;
}

function runChecks() {
    lines.length = 0;
    failures = 0;

    const grid      = document.querySelector('.quick-access-grid');
    const gridBox   = grid.getBoundingClientRect();
    const container = document.querySelector('.zone-quick-access').getBoundingClientRect().width;
    const tracks    = trackCount();

    head(`container ${Math.round(container)}px · ${tracks} track(s) · stage ${stageEl.clientWidth}px`);

    // ── Structure ────────────────────────────────────────────────────
    const titles = cards().map((c) => c.querySelector('.tool-category-title')?.textContent.trim());
    check(titles.length === 6, `6 category cards (found ${titles.length})`);
    check(
        JSON.stringify(titles) === JSON.stringify(EXPECTED_ORDER),
        `card order is ${EXPECTED_ORDER.join(' → ')}`
    );

    // ── Count badges match reality ───────────────────────────────────
    head('count badges');
    for (const card of cards()) {
        const title = card.querySelector('.tool-category-title')?.textContent.trim();
        const badge = card.querySelector('.tool-category-count')?.textContent.trim();
        const uniq  = new Set(
            [...card.querySelectorAll('a.tool-btn[href]')].map((a) => a.getAttribute('href'))
        ).size;
        check(Number(badge) === uniq, `${title}: badge ${badge} = ${uniq} unique links`);
    }

    // ── Placement ────────────────────────────────────────────────────
    head('placement');
    const pricing   = document.querySelector('.tool-category--pricing');
    const reference = document.querySelector('.tool-category--reference');
    const colWidth  = (gridBox.width - 14 * (tracks - 1)) / tracks;
    const pricingW  = pricing.getBoundingClientRect().width;
    const expected  = tracks >= 3 ? colWidth * 2 + 14 : colWidth;

    check(
        Math.abs(pricingW - expected) < 3,
        `Pricing spans ${tracks >= 3 ? '2 tracks' : '1 track'} at ${tracks} track(s) ` +
        `(${Math.round(pricingW)}px vs ${Math.round(expected)}px expected)`
    );
    check(
        Math.abs(reference.getBoundingClientRect().width - gridBox.width) < 3,
        'Reference spans the full grid row'
    );

    // ── Nothing overflows ────────────────────────────────────────────
    head('overflow');
    let overflow = 0;
    for (const card of cards()) {
        if (card.scrollWidth > card.clientWidth + 1) {
            overflow++;
            lines.push(`      ↳ ${card.querySelector('.tool-category-title')?.textContent.trim()} ` +
                       `scrollWidth ${card.scrollWidth} > clientWidth ${card.clientWidth}`);
        }
    }
    check(overflow === 0, `no card overflows its cell (${overflow} overflowing)`);
    const docEl = document.documentElement;
    check(
        docEl.scrollWidth <= docEl.clientWidth + 1,
        `page does not scroll horizontally (scrollWidth ${docEl.scrollWidth} vs clientWidth ${docEl.clientWidth})`
    );

    // ── Pride Wall collapse ──────────────────────────────────────────
    head('pride wall');
    const pw = document.querySelector('#prideWall');
    if (pw) {
        const openH = pw.getBoundingClientRect().height;
        pw.open = false;
        const closedH = pw.getBoundingClientRect().height;
        pw.open = true;
        check(pw.tagName === 'DETAILS', 'Pride Wall is a <details>');
        // Assert the photo track is what goes away, not a pixel count:
        // tiles are aspect-ratio sized and the header wraps to two lines on
        // a phone, so any fixed threshold fails at one width or another.
        // checkVisibility() — NOT getBoundingClientRect() — is the probe that
        // works here: a closed <details> hides its content with
        // content-visibility, and a skipped subtree keeps reporting its last
        // laid-out rect, so the naive height===0 test passes at no width.
        pw.open = false;
        const trackHidden = !document.querySelector('#pwTrack').checkVisibility();
        pw.open = true;
        check(
            trackHidden && openH > closedH,
            `collapsing hides the photo track, reclaiming ${Math.round(openH - closedH)}px / ` +
            `${Math.round((1 - closedH / openH) * 100)}% (open ${Math.round(openH)} → closed ${Math.round(closedH)})`
        );
    } else {
        check(false, 'Pride Wall present');
    }

    // ── Frequently Used stays on one line ────────────────────────────
    head('frequently used row');
    const list = document.querySelector('#pinnedToolsList');
    if (list) {
        const tops = new Set(
            [...list.children].map((el) => Math.round(el.getBoundingClientRect().top))
        );
        check(
            tops.size === 1 || stageEl.clientWidth < 900,
            `row occupies ${tops.size} line(s) at stage width ${stageEl.clientWidth}px`
        );
        check(!!list.querySelector('.tool-workflow'), 'Transfer Workflow strip intact');
    }

    widthEl.textContent = `stage ${stageEl.clientWidth}px · container ${Math.round(container)}px · ${tracks} tracks`;
    flush();
}

document.querySelectorAll('.harness-bar button[data-w]').forEach((btn) => {
    btn.addEventListener('click', () => {
        stageEl.style.width = `${btn.dataset.w}px`;
        requestAnimationFrame(runChecks);
    });
});
document.getElementById('rerunBtn').addEventListener('click', runChecks);
new ResizeObserver(() => {
    widthEl.textContent = `stage ${stageEl.clientWidth}px`;
}).observe(stageEl);

try {
    await loadProductionMarkup();
    initToolGrid();
    runChecks();
} catch (err) {
    resultsEl.innerHTML = `<span class="fail">HARNESS ERROR</span>  ${err.message}`;
    console.error(err);
}
