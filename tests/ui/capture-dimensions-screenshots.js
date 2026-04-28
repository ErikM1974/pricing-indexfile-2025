/**
 * Capture screenshots for the "dimensions fix" training slide.
 * 1: Ruth grid card showing Dimensions meta row
 * 2: Ruth kanban card showing 📐 dimensions badge
 * 3: AE form showing Width + Height inputs labeled so Taneisha knows where to type
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const OUT_DIR = 'C:/Users/erik/AppData/Local/Temp/rush-screenshots';
const BASE = 'http://localhost:3000';

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
const wait = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        defaultViewport: { width: 1400, height: 900 }
    });
    const page = await browser.newPage();

    // ── 1: Ruth grid card with Dimensions row ────────────────────
    console.log('[1/3] Ruth grid card…');
    await page.goto(`${BASE}/dashboards/art-hub-ruth.html`, { waitUntil: 'networkidle2' });
    await wait(4500);
    await page.evaluate(() => {
        // Scroll to a card that has dimensions populated
        const cards = [...document.querySelectorAll('.mockup-card')];
        const withDim = cards.find(c =>
            [...c.querySelectorAll('.card-meta-row')].some(r => /Dimensions:/i.test(r.textContent))
        );
        if (withDim) {
            withDim.scrollIntoView({ block: 'center' });
            window.scrollBy(0, -20);
        }
    });
    await wait(500);
    await page.screenshot({
        path: path.join(OUT_DIR, 'd1-ruth-grid-dimensions.png'),
        clip: { x: 40, y: 120, width: 1320, height: 720 }
    });

    // ── 2: Ruth kanban card with dimension badge ──────────────────
    console.log('[2/3] Ruth kanban with dimension badges…');
    await page.evaluate(() => {
        const boardBtn = document.querySelector('[data-view="board"]');
        if (boardBtn) boardBtn.click();
    });
    await wait(1800);
    await page.evaluate(() => {
        const board = document.getElementById('ruth-kanban-board');
        if (board) board.scrollIntoView({ block: 'start' });
        window.scrollBy(0, -60);
    });
    await wait(500);
    await page.screenshot({
        path: path.join(OUT_DIR, 'd2-ruth-kanban-dimensions.png'),
        clip: { x: 40, y: 120, width: 1320, height: 720 }
    });

    // ── 3: AE form — Width + Height inputs labeled ───────────────
    console.log('[3/3] AE form width/height inputs…');
    await page.goto(`${BASE}/dashboards/ae-dashboard.html`, { waitUntil: 'networkidle2' });
    await wait(2500);
    await page.evaluate(() => {
        const btn = [...document.querySelectorAll('.tab-button')].find(b => /Submit Artwork to Ruth/i.test(b.textContent));
        if (btn) btn.click();
    });
    await wait(1800);
    // Fill in example values
    await page.evaluate(() => {
        const w = document.getElementById('msf-width');
        const h = document.getElementById('msf-height');
        if (w) w.value = '3.5';
        if (h) h.value = '2.0';
        // Position width input at approx y=300 in viewport
        if (w) {
            const rect = w.getBoundingClientRect();
            window.scrollBy(0, rect.top - 300);
        }
    });
    await wait(500);
    await page.screenshot({
        path: path.join(OUT_DIR, 'd3-ae-form-width-height.png')
        // no clip — full viewport to grab context
    });

    await browser.close();
    console.log('\nDone.');
})().catch(err => { console.error(err); process.exit(1); });
