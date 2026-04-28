/**
 * Ad-hoc Puppeteer capture script for the rush-order training deck.
 * Captures 4 screenshots showing the rush UI state on each relevant page.
 * Writes to C:\Users\erik\AppData\Local\Temp\rush-screenshots\
 *
 * Usage: node tests/ui/capture-rush-screenshots.js
 */
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const OUT_DIR = 'C:/Users/erik/AppData/Local/Temp/rush-screenshots';
const BASE = 'http://localhost:3000';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

async function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        defaultViewport: { width: 1400, height: 900 }
    });
    const page = await browser.newPage();

    // ── Screenshot 1: Ruth's AE form with rush toggle active ────────────
    console.log('[1/4] Capturing Ruth AE form…');
    await page.goto(`${BASE}/dashboards/ae-dashboard.html`, { waitUntil: 'networkidle2' });
    await wait(2000);
    // click "Submit Artwork to Ruth" tab
    await page.evaluate(() => {
        const btn = [...document.querySelectorAll('.tab-button')].find(b => /Submit Artwork to Ruth/i.test(b.textContent));
        if (btn) btn.click();
    });
    await wait(1500);
    // click rush toggle to activate
    await page.evaluate(() => {
        const btn = document.getElementById('msf-rush-toggle');
        if (btn) btn.click();
    });
    await wait(600);
    // find rush button bounds for tight crop
    const r1 = await page.evaluate(() => {
        const btn = document.getElementById('msf-rush-toggle');
        if (!btn) return null;
        btn.scrollIntoView({ block: 'center' });
        const r = btn.getBoundingClientRect();
        // Find the whole rush row + submit row so viewer understands context
        const row = btn.closest('.msf-rush-row') || btn;
        const submitRow = row.nextElementSibling; // .msf-submit-row
        const topEl = row.previousElementSibling; // file drop or last field
        const top = Math.max(0, (topEl ? topEl.getBoundingClientRect().top : r.top) - 100);
        const bottom = Math.min(window.innerHeight, (submitRow ? submitRow.getBoundingClientRect().bottom : r.bottom) + 40);
        return { top, bottom };
    });
    await wait(300);
    // Scroll so rush button is at y≈400 in viewport, then take full viewport screenshot.
    await page.evaluate(() => {
        const btn = document.getElementById('msf-rush-toggle');
        const rect = btn.getBoundingClientRect();
        const targetY = 420;
        window.scrollBy(0, rect.top - targetY);
    });
    await wait(400);
    await page.screenshot({
        path: path.join(OUT_DIR, '1-ruth-form-rush.png')
        // no clip — full viewport
    });
    console.log('  → 1-ruth-form-rush.png');

    // ── Screenshot 2: Steve's AE form (Caspio) — just the top ────────────
    console.log('[2/4] Capturing Steve AE form…');
    await page.evaluate(() => {
        const btn = [...document.querySelectorAll('.tab-button')].find(b => /Submit Artwork to Steve/i.test(b.textContent));
        if (btn) btn.click();
    });
    await wait(3500); // Caspio takes longer to render
    await page.evaluate(() => { window.scrollTo(0, 0); });
    await wait(500);
    await page.screenshot({
        path: path.join(OUT_DIR, '2-steve-form-top.png'),
        clip: { x: 100, y: 100, width: 1200, height: 650 }
    });
    console.log('  → 2-steve-form-top.png');

    // ── Screenshot 3: Ruth's dashboard with a fake rush card ─────────────
    console.log('[3/4] Capturing Ruth dashboard with rush card…');
    await page.goto(`${BASE}/dashboards/art-hub-ruth.html`, { waitUntil: 'networkidle2' });
    await wait(4000);
    await page.evaluate(() => {
        const cards = document.querySelectorAll('.mockup-card');
        if (!cards.length) return;
        const first = cards[0];
        first.classList.add('mockup-card--rush');
        const body = first.querySelector('.card-body');
        let badges = first.querySelector('.card-badges');
        if (!badges) {
            badges = document.createElement('div');
            badges.className = 'card-badges';
            body.appendChild(badges);
        }
        if (!badges.querySelector('.card-badge--rush')) {
            badges.insertAdjacentHTML('afterbegin', '<span class="card-badge card-badge--rush">🔥 RUSH</span>');
        }
        first.scrollIntoView({ block: 'start' });
        window.scrollBy(0, -50);
    });
    await wait(800);
    await page.screenshot({
        path: path.join(OUT_DIR, '3-ruth-dashboard-rush.png'),
        clip: { x: 50, y: 150, width: 1300, height: 700 }
    });
    console.log('  → 3-ruth-dashboard-rush.png');

    // ── Screenshot 4: Steve's kanban with a fake rush card ───────────────
    console.log('[4/4] Capturing Steve kanban with rush card…');
    await page.goto(`${BASE}/dashboards/art-hub-steve.html`, { waitUntil: 'networkidle2' });
    await wait(4000);
    await page.evaluate(() => {
        const bb = document.querySelector('[data-view="board"]');
        if (bb) bb.click();
    });
    await wait(4000); // board view fetch
    await page.evaluate(() => {
        const cards = document.querySelectorAll('.kanban-card');
        if (!cards.length) return;
        const first = cards[0];
        first.classList.add('kanban-card--rush');
        let badges = first.querySelector('.kanban-card-badges');
        if (!badges) {
            badges = document.createElement('div');
            badges.className = 'kanban-card-badges';
            first.appendChild(badges);
        }
        if (!badges.querySelector('.kanban-card-badge--rush')) {
            badges.insertAdjacentHTML('afterbegin', '<span class="kanban-card-badge kanban-card-badge--rush">🔥 RUSH</span>');
        }
        // scroll board into view
        const board = document.getElementById('steve-kanban-board');
        if (board) board.scrollIntoView({ block: 'start' });
        window.scrollBy(0, -50);
    });
    await wait(800);
    await page.screenshot({
        path: path.join(OUT_DIR, '4-steve-kanban-rush.png'),
        clip: { x: 30, y: 150, width: 1340, height: 720 }
    });
    console.log('  → 4-steve-kanban-rush.png');

    await browser.close();
    console.log('\nDone. Screenshots in:', OUT_DIR);
})().catch(err => {
    console.error('Capture failed:', err);
    process.exit(1);
});
