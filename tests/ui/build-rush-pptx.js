/**
 * Build the rush-order training PowerPoint deck.
 * Output: C:\Users\erik\Downloads\rush-order-rollout.pptx
 */
const PptxGenJS = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = 'C:/Users/erik/AppData/Local/Temp/rush-screenshots';
const OUT_PATH = 'C:/Users/erik/Downloads/rush-order-rollout.pptx';

// ── Design tokens ─────────────────────────────────────────────────
const COLOR = {
    rush: 'DC2626',          // primary red accent
    rushDark: '991B1B',
    rushBg: 'FEF2F2',        // very light red
    rushBgDeeper: 'FEE2E2',
    ink: '0F172A',           // dark slate for body
    muted: '475569',         // medium slate
    light: '94A3B8',         // light slate
    bg: 'FFFFFF',
    bgSoft: 'F8FAFC',
    cardBorder: 'E2E8F0',
    nwcaGreen: '2E7D32',     // small accent nod to brand
    slackBg: '1A1D21'
};

const FONT = { heading: 'Calibri', body: 'Calibri' };

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5 inches
pptx.title = 'Rush Orders Rollout';
pptx.author = 'Northwest Custom Apparel';

// ── Helper: add consistent footer bar ─────────────────────────────
function addFooter(slide, pageNum, totalPages) {
    // Thin red bar at very bottom
    slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 7.4, w: 13.33, h: 0.1, fill: { color: COLOR.rush }, line: { color: COLOR.rush }
    });
    slide.addText('Northwest Custom Apparel', {
        x: 0.5, y: 7.12, w: 5, h: 0.25,
        fontFace: FONT.body, fontSize: 9, color: COLOR.light, italic: true
    });
    slide.addText(`${pageNum} / ${totalPages}`, {
        x: 12.3, y: 7.12, w: 0.5, h: 0.25,
        fontFace: FONT.body, fontSize: 9, color: COLOR.light, align: 'right'
    });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 1 — TITLE
// ═══════════════════════════════════════════════════════════════════
{
    const s = pptx.addSlide();
    s.background = { color: COLOR.bg };

    // Big red accent bar on the left (visual motif carried across)
    s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 0.4, h: 7.5, fill: { color: COLOR.rush }, line: { color: COLOR.rush }
    });

    // Small date line
    s.addText('April 17, 2026', {
        x: 0.9, y: 0.6, w: 5, h: 0.3,
        fontFace: FONT.body, fontSize: 12, color: COLOR.muted,
        bold: true, charSpacing: 3
    });

    // Giant title
    s.addText([
        { text: '🔥 ', options: { color: COLOR.rush } },
        { text: 'Rush Orders ', options: { color: COLOR.ink } },
        { text: '— ', options: { color: COLOR.light } },
        { text: 'Now Live', options: { color: COLOR.rush } }
    ], {
        x: 0.9, y: 1.0, w: 11.5, h: 1.6,
        fontFace: FONT.heading, fontSize: 54, bold: true
    });

    // Subtitle
    s.addText('One-click rush for urgent artwork and mockups', {
        x: 0.9, y: 2.6, w: 11.5, h: 0.6,
        fontFace: FONT.body, fontSize: 22, color: COLOR.muted, italic: true
    });

    // Intro paragraph in a soft card
    s.addShape(pptx.ShapeType.roundRect, {
        x: 0.9, y: 3.7, w: 11.5, h: 1.9,
        fill: { color: COLOR.rushBg }, line: { color: COLOR.rushBgDeeper, width: 1 },
        rectRadius: 0.12
    });
    s.addText('Before today there was no way to flag an urgent job — it landed in the queue with everything else. Now one click jumps work to the top of Steve\'s and Ruthie\'s boards and pings them on Slack within a minute.', {
        x: 1.2, y: 3.85, w: 10.9, h: 1.6,
        fontFace: FONT.body, fontSize: 18, color: COLOR.ink,
        paraSpaceAfter: 8
    });

    // Audience line
    s.addText('For the team — Taneisha, Nika, Steve, and Ruthie', {
        x: 0.9, y: 6.1, w: 11.5, h: 0.5,
        fontFace: FONT.body, fontSize: 14, color: COLOR.muted, bold: true
    });

    addFooter(s, 1, 4);
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 2 — HOW AES SUBMIT A RUSH
// ═══════════════════════════════════════════════════════════════════
{
    const s = pptx.addSlide();
    s.background = { color: COLOR.bg };

    // Left accent bar (consistent motif)
    s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 0.4, h: 7.5, fill: { color: COLOR.rush }, line: { color: COLOR.rush }
    });

    // Pre-title eyebrow
    s.addText('FOR AEs', {
        x: 0.9, y: 0.55, w: 4, h: 0.3,
        fontFace: FONT.body, fontSize: 11, color: COLOR.rush,
        bold: true, charSpacing: 4
    });

    // Title
    s.addText('Click the Rush button before submitting', {
        x: 0.9, y: 0.85, w: 11.5, h: 0.9,
        fontFace: FONT.heading, fontSize: 36, color: COLOR.ink, bold: true
    });

    // Left column: bullet points
    const bullets = [
        { text: 'A red 🔥 Rush Order button sits right above Submit', options: { bullet: { code: '25CF' }, color: COLOR.ink, bold: false } },
        { text: 'Same button on both Steve and Ruth forms', options: { bullet: { code: '25CF' }, color: COLOR.ink } },
        { text: 'One click — that\'s it', options: { bullet: { code: '25CF' }, color: COLOR.rush, bold: true } },
        { text: 'Anyone can mark an existing job as rush later from its detail page', options: { bullet: { code: '25CF' }, color: COLOR.ink } }
    ];
    s.addText(bullets, {
        x: 0.9, y: 2.0, w: 5.2, h: 3.8,
        fontFace: FONT.body, fontSize: 18, color: COLOR.ink,
        paraSpaceAfter: 14, lineSpacingMultiple: 1.2
    });

    // Callout pill at bottom of left column
    s.addShape(pptx.ShapeType.roundRect, {
        x: 0.9, y: 5.9, w: 5.2, h: 1.0,
        fill: { color: COLOR.rushBg }, line: { color: COLOR.rushBgDeeper, width: 1 },
        rectRadius: 0.1
    });
    s.addText([
        { text: 'The button changes from a red outline to a ', options: { color: COLOR.ink } },
        { text: 'bold red fill', options: { color: COLOR.rush, bold: true } },
        { text: ' when rush is active.', options: { color: COLOR.ink } }
    ], {
        x: 1.1, y: 6.05, w: 4.8, h: 0.8,
        fontFace: FONT.body, fontSize: 13, italic: false
    });

    // Right column: screenshot with a subtle frame
    s.addShape(pptx.ShapeType.roundRect, {
        x: 6.5, y: 1.9, w: 6.4, h: 5.1,
        fill: { color: COLOR.bgSoft }, line: { color: COLOR.cardBorder, width: 1 },
        rectRadius: 0.12
    });
    s.addImage({
        path: path.join(SCREENSHOT_DIR, '1-ruth-form-rush.png'),
        x: 6.65, y: 2.05, w: 6.1, h: 4.5
    });
    s.addText('The Rush Order button activated on the Ruth form', {
        x: 6.65, y: 6.55, w: 6.1, h: 0.35,
        fontFace: FONT.body, fontSize: 11, color: COLOR.muted, italic: true, align: 'center'
    });

    addFooter(s, 2, 4);
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 3 — WHO GETS NOTIFIED
// ═══════════════════════════════════════════════════════════════════
{
    const s = pptx.addSlide();
    s.background = { color: COLOR.bg };

    s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 0.4, h: 7.5, fill: { color: COLOR.rush }, line: { color: COLOR.rush }
    });

    s.addText('NOTIFICATIONS', {
        x: 0.9, y: 0.55, w: 4, h: 0.3,
        fontFace: FONT.body, fontSize: 11, color: COLOR.rush,
        bold: true, charSpacing: 4
    });

    s.addText('When you click Rush, this happens automatically', {
        x: 0.9, y: 0.85, w: 11.5, h: 0.9,
        fontFace: FONT.heading, fontSize: 32, color: COLOR.ink, bold: true
    });

    // Left column: notification table (manual layout, not pptx table, for control)
    const rows = [
        { who: 'The AE who submitted', gets: 'Email confirmation' },
        { who: 'Sales rep (if different)', gets: 'CC on the email' },
        { who: 'Steve — for art rushes', gets: 'Slack DM + email' },
        { who: 'Ruthie — for mockup rushes', gets: 'Slack DM + email' }
    ];

    // Header row
    const rowH = 0.75;
    const tableX = 0.9, tableY = 1.95, tableW = 6.5;
    s.addShape(pptx.ShapeType.rect, {
        x: tableX, y: tableY, w: tableW, h: 0.5,
        fill: { color: COLOR.ink }, line: { color: COLOR.ink }
    });
    s.addText('WHO', {
        x: tableX + 0.2, y: tableY, w: 3.1, h: 0.5,
        fontFace: FONT.body, fontSize: 12, color: 'FFFFFF', bold: true, charSpacing: 3,
        valign: 'middle'
    });
    s.addText('GETS', {
        x: tableX + 3.4, y: tableY, w: 3.0, h: 0.5,
        fontFace: FONT.body, fontSize: 12, color: 'FFFFFF', bold: true, charSpacing: 3,
        valign: 'middle'
    });

    // Data rows
    rows.forEach((row, i) => {
        const y = tableY + 0.5 + (i * rowH);
        const isHighlight = i >= 2; // Steve and Ruthie rows — highlight them

        // Row bg
        s.addShape(pptx.ShapeType.rect, {
            x: tableX, y: y, w: tableW, h: rowH,
            fill: { color: isHighlight ? COLOR.rushBg : (i % 2 === 0 ? 'FFFFFF' : COLOR.bgSoft) },
            line: { color: COLOR.cardBorder, width: 0.5 }
        });

        s.addText(row.who, {
            x: tableX + 0.2, y: y, w: 3.1, h: rowH,
            fontFace: FONT.body, fontSize: 14,
            color: isHighlight ? COLOR.rushDark : COLOR.ink,
            bold: isHighlight, valign: 'middle'
        });

        s.addText(row.gets, {
            x: tableX + 3.4, y: y, w: 3.0, h: rowH,
            fontFace: FONT.body, fontSize: 14,
            color: isHighlight ? COLOR.rushDark : COLOR.ink,
            bold: isHighlight, valign: 'middle'
        });
    });

    // Callout below table
    s.addShape(pptx.ShapeType.roundRect, {
        x: tableX, y: 5.75, w: tableW, h: 1.15,
        fill: { color: COLOR.rush }, line: { color: COLOR.rushDark, width: 1 },
        rectRadius: 0.1
    });
    s.addText([
        { text: '⚡ ', options: { fontSize: 22 } },
        { text: 'Slack fires within ~1 minute.\n', options: { bold: true, fontSize: 18 } },
        { text: 'Email is instant.', options: { fontSize: 16 } }
    ], {
        x: tableX + 0.25, y: 5.85, w: tableW - 0.5, h: 0.95,
        fontFace: FONT.body, color: 'FFFFFF'
    });

    // Right column: Slack message screenshot
    s.addShape(pptx.ShapeType.roundRect, {
        x: 7.7, y: 1.95, w: 5.2, h: 4.95,
        fill: { color: COLOR.slackBg }, line: { color: COLOR.slackBg, width: 1 },
        rectRadius: 0.1
    });
    s.addImage({
        path: path.join(SCREENSHOT_DIR, '5-slack-message.png'),
        x: 7.82, y: 2.15, w: 4.95, h: 2.75
    });
    s.addText('What Steve / Ruthie actually see in Slack', {
        x: 7.7, y: 5.05, w: 5.2, h: 0.3,
        fontFace: FONT.body, fontSize: 11, color: 'FFFFFF', italic: true, align: 'center'
    });
    // extra spacer text below screenshot inside the dark box
    s.addText('Clickable link goes straight to the detail page — one tap to start working.', {
        x: 7.9, y: 5.45, w: 4.8, h: 1.3,
        fontFace: FONT.body, fontSize: 13, color: '8b9398', align: 'center', italic: false
    });

    addFooter(s, 3, 4);
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 4 — HOW STEVE & RUTHIE SEE RUSH ORDERS
// ═══════════════════════════════════════════════════════════════════
{
    const s = pptx.addSlide();
    s.background = { color: COLOR.bg };

    s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 0.4, h: 7.5, fill: { color: COLOR.rush }, line: { color: COLOR.rush }
    });

    s.addText('FOR STEVE & RUTHIE', {
        x: 0.9, y: 0.55, w: 6, h: 0.3,
        fontFace: FONT.body, fontSize: 11, color: COLOR.rush,
        bold: true, charSpacing: 4
    });

    s.addText('Rush always comes first', {
        x: 0.9, y: 0.85, w: 11.5, h: 0.9,
        fontFace: FONT.heading, fontSize: 36, color: COLOR.ink, bold: true
    });

    // Left column: bullets with red check-style bullets
    const bulletRows = [
        { emoji: '🔥', title: 'RUSH badge', desc: 'Red, pulsing, impossible to miss' },
        { emoji: '📕', title: 'Red left border', desc: 'Highlights the entire card' },
        { emoji: '⬆️', title: 'Auto-sort to top', desc: 'Rushed items jump to the top of every column' },
        { emoji: '✅', title: 'One-click clear', desc: 'Clear the rush flag from the detail page once you\'re on it' }
    ];

    let yPos = 2.0;
    bulletRows.forEach((row) => {
        // Emoji badge
        s.addShape(pptx.ShapeType.ellipse, {
            x: 0.9, y: yPos + 0.05, w: 0.7, h: 0.7,
            fill: { color: COLOR.rushBg }, line: { color: COLOR.rushBgDeeper, width: 1 }
        });
        s.addText(row.emoji, {
            x: 0.9, y: yPos + 0.08, w: 0.7, h: 0.65,
            fontFace: FONT.body, fontSize: 22, align: 'center', valign: 'middle'
        });
        // Title
        s.addText(row.title, {
            x: 1.75, y: yPos, w: 4.5, h: 0.4,
            fontFace: FONT.heading, fontSize: 18, color: COLOR.ink, bold: true
        });
        // Description
        s.addText(row.desc, {
            x: 1.75, y: yPos + 0.4, w: 4.5, h: 0.4,
            fontFace: FONT.body, fontSize: 13, color: COLOR.muted
        });
        yPos += 1.05;
    });

    // Right column: Steve kanban screenshot (it's the cleanest demo shot)
    s.addShape(pptx.ShapeType.roundRect, {
        x: 6.5, y: 1.9, w: 6.4, h: 5.1,
        fill: { color: COLOR.bgSoft }, line: { color: COLOR.cardBorder, width: 1 },
        rectRadius: 0.12
    });
    s.addImage({
        path: path.join(SCREENSHOT_DIR, '4-steve-kanban-rush.png'),
        x: 6.65, y: 2.05, w: 6.1, h: 4.5
    });
    s.addText('Steve\'s kanban — the rushed card sits at the top of "Submitted"', {
        x: 6.65, y: 6.55, w: 6.1, h: 0.35,
        fontFace: FONT.body, fontSize: 11, color: COLOR.muted, italic: true, align: 'center'
    });

    addFooter(s, 4, 4);
}

// ── Save ──────────────────────────────────────────────────────────
pptx.writeFile({ fileName: OUT_PATH })
    .then(f => console.log('Saved:', f))
    .catch(err => { console.error('Failed:', err); process.exit(1); });
