/**
 * Monday Morning Huddle — What Shipped Apr 24-26
 * Output: C:\Users\erik\Downloads\huddle-2026-04-27.pptx
 *
 * Screenshots come from: C:\Users\erik\AppData\Local\Temp\huddle-screenshots\
 *   supacolor-dashboard.png  → slide 2
 *   steve-dashboard.png      → slide 4
 *   ruth-dashboard.png       → slide 5
 *   mockup-detail.png        (available but not used — short-and-simple)
 *
 * Missing screenshots are replaced with a soft "screenshot pending" placeholder
 * so the deck can be regenerated.
 */
const PptxGenJS = require('pptxgenjs');
const path = require('path');
const fs = require('fs');

const SCREENSHOT_DIR = 'C:/Users/erik/AppData/Local/Temp/huddle-screenshots';
const OUT_PATH = 'C:/Users/erik/Downloads/huddle-2026-04-27.pptx';

// ── Design tokens — NWCA brand palette ────────────────────────────
// Green / black / gray / white. NWCA green = 2E7D32 (matches header bar).
const COLOR = {
    accent: '2E7D32',        // NWCA green — primary
    accentDark: '1B5E20',    // deeper green for hover/dark elements
    accentBg: 'E8F5E9',      // very light green wash
    accentBgDeeper: 'C8E6C9',
    ink: '111827',           // near-black for body text
    black: '000000',
    muted: '4B5563',         // medium gray
    light: '9CA3AF',          // light gray
    bg: 'FFFFFF',
    bgSoft: 'F9FAFB',         // off-white card bg
    cardBorder: 'E5E7EB',     // light gray border
    // status badges for the AE digest age coloring
    green: '2E7D32',          // reuse brand green for "fresh"
    greenBg: 'E8F5E9',
    orange: 'EA580C',
    orangeBg: 'FFEDD5',
    red: 'DC2626',
    redBg: 'FEE2E2'
};

const FONT = { heading: 'Calibri', body: 'Calibri' };

const TOTAL_SLIDES = 5;

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.title = 'Monday Huddle — Apr 27, 2026';
pptx.author = 'Northwest Custom Apparel';

// ── Helpers ───────────────────────────────────────────────────────
function addFooter(slide, pageNum) {
    slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 7.4, w: 13.33, h: 0.1,
        fill: { color: COLOR.accent }, line: { color: COLOR.accent }
    });
    slide.addText('Northwest Custom Apparel', {
        x: 0.5, y: 7.12, w: 5, h: 0.25,
        fontFace: FONT.body, fontSize: 9, color: COLOR.light, italic: true
    });
    slide.addText(`${pageNum} / ${TOTAL_SLIDES}`, {
        x: 12.3, y: 7.12, w: 0.5, h: 0.25,
        fontFace: FONT.body, fontSize: 9, color: COLOR.light, align: 'right'
    });
}

function addAccentBar(slide) {
    slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 0.4, h: 7.5,
        fill: { color: COLOR.accent }, line: { color: COLOR.accent }
    });
}

// Place an image if the file exists, otherwise draw a soft placeholder card.
function addScreenshotOrPlaceholder(slide, filename, opts) {
    const fullPath = path.join(SCREENSHOT_DIR, filename);
    if (fs.existsSync(fullPath)) {
        slide.addImage({ path: fullPath, x: opts.x, y: opts.y, w: opts.w, h: opts.h });
        return;
    }
    slide.addShape(pptx.ShapeType.roundRect, {
        x: opts.x, y: opts.y, w: opts.w, h: opts.h,
        fill: { color: COLOR.accentBg },
        line: { color: COLOR.accentBgDeeper, width: 1 },
        rectRadius: 0.08
    });
    slide.addText([
        { text: '📸\n', options: { fontSize: 28 } },
        { text: 'Screenshot pending\n', options: { fontSize: 14, bold: true, color: COLOR.accentDark } },
        { text: filename, options: { fontSize: 11, color: COLOR.muted, italic: true } }
    ], {
        x: opts.x, y: opts.y, w: opts.w, h: opts.h,
        fontFace: FONT.body, color: COLOR.muted, align: 'center', valign: 'middle'
    });
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 1 — TITLE
// ═══════════════════════════════════════════════════════════════════
{
    const s = pptx.addSlide();
    s.background = { color: COLOR.bg };
    addAccentBar(s);

    s.addText('Monday, April 27, 2026', {
        x: 0.9, y: 0.6, w: 6, h: 0.3,
        fontFace: FONT.body, fontSize: 12, color: COLOR.muted,
        bold: true, charSpacing: 3
    });

    s.addText([
        { text: 'What Shipped ', options: { color: COLOR.ink } },
        { text: '— ', options: { color: COLOR.light } },
        { text: 'Weekend of Apr 24', options: { color: COLOR.accent } }
    ], {
        x: 0.9, y: 1.0, w: 11.5, h: 1.6,
        fontFace: FONT.heading, fontSize: 50, bold: true
    });

    s.addText('Three things to know going into the week', {
        x: 0.9, y: 2.6, w: 11.5, h: 0.6,
        fontFace: FONT.body, fontSize: 22, color: COLOR.muted, italic: true
    });

    s.addShape(pptx.ShapeType.roundRect, {
        x: 0.9, y: 3.7, w: 11.5, h: 2.3,
        fill: { color: COLOR.accentBg }, line: { color: COLOR.accentBgDeeper, width: 1 },
        rectRadius: 0.12
    });
    s.addText([
        { text: '1.  ', options: { bold: true, color: COLOR.accent } },
        { text: 'Supacolor moved from Bradley to Steve', options: { bold: true, color: COLOR.ink } },
        { text: ' — Steve sends jobs himself now, Bradley\'s queue is post-order.\n\n', options: { color: COLOR.ink } },
        { text: '2.  ', options: { bold: true, color: COLOR.accent } },
        { text: 'AEs get a daily reminder email', options: { bold: true, color: COLOR.ink } },
        { text: ' — every weekday at 8 AM, only items waiting on customer approval, color-coded by age.\n\n', options: { color: COLOR.ink } },
        { text: '3.  ', options: { bold: true, color: COLOR.accent } },
        { text: 'Steve\'s gallery got rebuilt', options: { bold: true, color: COLOR.ink } },
        { text: ' — broken Box thumbnails are now one-click recoverable.', options: { color: COLOR.ink } }
    ], {
        x: 1.2, y: 3.85, w: 10.9, h: 2.05,
        fontFace: FONT.body, fontSize: 16,
        paraSpaceAfter: 4
    });

    s.addText('For the team — Bradley, Steve, Ruthie, Nika, Taneisha, Adriyella', {
        x: 0.9, y: 6.3, w: 11.5, h: 0.5,
        fontFace: FONT.body, fontSize: 13, color: COLOR.muted, bold: true
    });

    addFooter(s, 1);
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 2 — SUPACOLOR HANDOFF (Bradley → Steve)
// ═══════════════════════════════════════════════════════════════════
{
    const s = pptx.addSlide();
    s.background = { color: COLOR.bg };
    addAccentBar(s);

    s.addText('FOR STEVE & BRADLEY', {
        x: 0.9, y: 0.55, w: 6, h: 0.3,
        fontFace: FONT.body, fontSize: 11, color: COLOR.accent,
        bold: true, charSpacing: 4
    });

    s.addText('Steve now sends Supacolor jobs himself', {
        x: 0.9, y: 0.85, w: 11.5, h: 0.9,
        fontFace: FONT.heading, fontSize: 32, color: COLOR.ink, bold: true
    });

    const bullets = [
        { text: 'New "Send to Supacolor" modal — paste Box links, no design# prompt', options: { bullet: { code: '25CF' }, color: COLOR.ink } },
        { text: 'Embedded Box folder picker — search inside the modal', options: { bullet: { code: '25CF' }, color: COLOR.ink } },
        { text: 'Modal warns if a mockup file is missing before you send', options: { bullet: { code: '25CF' }, color: COLOR.ink } },
        { text: 'Bradley\'s queue moved to "Frequently Used Tools"', options: { bullet: { code: '25CF' }, color: COLOR.ink } },
        { text: 'Bradley\'s detail page now shows the full Supacolor job inline — joblines, shipping, tracking', options: { bullet: { code: '25CF' }, color: COLOR.ink } },
        { text: 'Carrier + tracking # is a clickable pill on the orders list', options: { bullet: { code: '25CF' }, color: COLOR.accent, bold: true } }
    ];
    s.addText(bullets, {
        x: 0.9, y: 1.95, w: 5.4, h: 4.2,
        fontFace: FONT.body, fontSize: 15, color: COLOR.ink,
        paraSpaceAfter: 12, lineSpacingMultiple: 1.2
    });

    s.addShape(pptx.ShapeType.roundRect, {
        x: 0.9, y: 6.1, w: 5.4, h: 0.85,
        fill: { color: COLOR.accentBg }, line: { color: COLOR.accentBgDeeper, width: 1 },
        rectRadius: 0.1
    });
    s.addText([
        { text: 'Renamed everywhere: ', options: { color: COLOR.ink } },
        { text: '"Supacolor Orders" → "Supacolor API Orders"', options: { color: COLOR.accentDark, bold: true } },
        { text: ' so it\'s clearer where data comes from.', options: { color: COLOR.ink } }
    ], {
        x: 1.1, y: 6.18, w: 5.0, h: 0.7,
        fontFace: FONT.body, fontSize: 12, valign: 'middle'
    });

    s.addShape(pptx.ShapeType.roundRect, {
        x: 6.5, y: 1.9, w: 6.4, h: 5.1,
        fill: { color: COLOR.bgSoft }, line: { color: COLOR.cardBorder, width: 1 },
        rectRadius: 0.12
    });
    addScreenshotOrPlaceholder(s, 'supacolor-dashboard.png', {
        x: 6.65, y: 2.05, w: 6.1, h: 4.5
    });
    s.addText('Live "Supacolor API Orders" dashboard — synced every 10 minutes', {
        x: 6.65, y: 6.55, w: 6.1, h: 0.35,
        fontFace: FONT.body, fontSize: 11, color: COLOR.muted, italic: true, align: 'center'
    });

    addFooter(s, 2);
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 3 — DAILY AE DIGEST EMAIL
// ═══════════════════════════════════════════════════════════════════
{
    const s = pptx.addSlide();
    s.background = { color: COLOR.bg };
    addAccentBar(s);

    s.addText('FOR ALL AEs', {
        x: 0.9, y: 0.55, w: 4, h: 0.3,
        fontFace: FONT.body, fontSize: 11, color: COLOR.accent,
        bold: true, charSpacing: 4
    });

    s.addText('Daily nag for stuck approvals', {
        x: 0.9, y: 0.85, w: 11.5, h: 0.9,
        fontFace: FONT.heading, fontSize: 36, color: COLOR.ink, bold: true
    });

    s.addText([
        { text: 'Every weekday at 8 AM Pacific, ', options: { color: COLOR.ink } },
        { text: 'each AE gets one email', options: { color: COLOR.accent, bold: true } },
        { text: ' listing only their items still waiting on customer approval — oldest first.', options: { color: COLOR.ink } }
    ], {
        x: 0.9, y: 1.85, w: 5.6, h: 1.0,
        fontFace: FONT.body, fontSize: 15, paraSpaceAfter: 6
    });

    // Color-coded age badges
    s.addText('Color-coded by days waiting:', {
        x: 0.9, y: 3.05, w: 5.6, h: 0.3,
        fontFace: FONT.body, fontSize: 13, color: COLOR.muted, bold: true
    });

    const ages = [
        { label: 'Under 3 days', dot: COLOR.green, bg: COLOR.greenBg, ink: COLOR.green },
        { label: '3 – 6 days',   dot: COLOR.orange, bg: COLOR.orangeBg, ink: COLOR.orange },
        { label: '7+ days',      dot: COLOR.red, bg: COLOR.redBg, ink: COLOR.red }
    ];
    let yPos = 3.45;
    ages.forEach(a => {
        s.addShape(pptx.ShapeType.roundRect, {
            x: 0.9, y: yPos, w: 5.6, h: 0.55,
            fill: { color: a.bg }, line: { color: a.bg }, rectRadius: 0.08
        });
        s.addShape(pptx.ShapeType.ellipse, {
            x: 1.1, y: yPos + 0.15, w: 0.25, h: 0.25,
            fill: { color: a.dot }, line: { color: a.dot }
        });
        s.addText(a.label, {
            x: 1.5, y: yPos, w: 4.0, h: 0.55,
            fontFace: FONT.body, fontSize: 14, color: a.ink,
            bold: true, valign: 'middle'
        });
        yPos += 0.7;
    });

    // Bottom callout
    s.addShape(pptx.ShapeType.roundRect, {
        x: 0.9, y: 5.85, w: 5.6, h: 1.05,
        fill: { color: COLOR.accent }, line: { color: COLOR.accentDark, width: 1 },
        rectRadius: 0.1
    });
    s.addText([
        { text: '✉ ', options: { fontSize: 22 } },
        { text: 'Zero items? No email.\n', options: { bold: true, fontSize: 16 } },
        { text: 'Inbox-zero AEs are not bothered.', options: { fontSize: 13 } }
    ], {
        x: 1.1, y: 5.95, w: 5.2, h: 0.85,
        fontFace: FONT.body, color: 'FFFFFF'
    });

    // Right column — email screenshot
    s.addShape(pptx.ShapeType.roundRect, {
        x: 6.7, y: 1.9, w: 6.2, h: 5.1,
        fill: { color: COLOR.bgSoft }, line: { color: COLOR.cardBorder, width: 1 },
        rectRadius: 0.12
    });
    addScreenshotOrPlaceholder(s, 'ae-digest-email.png', {
        x: 6.85, y: 2.05, w: 5.9, h: 4.5
    });
    s.addText('Sample digest email — what Nika or Taneisha will see', {
        x: 6.7, y: 6.55, w: 6.2, h: 0.35,
        fontFace: FONT.body, fontSize: 11, color: COLOR.muted, italic: true, align: 'center'
    });

    addFooter(s, 3);
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 4 — STEVE'S GALLERY REBUILD
// ═══════════════════════════════════════════════════════════════════
{
    const s = pptx.addSlide();
    s.background = { color: COLOR.bg };
    addAccentBar(s);

    s.addText('FOR STEVE', {
        x: 0.9, y: 0.55, w: 4, h: 0.3,
        fontFace: FONT.body, fontSize: 11, color: COLOR.accent,
        bold: true, charSpacing: 4
    });

    s.addText('Gallery rebuild — broken thumbnails fixable in one click', {
        x: 0.9, y: 0.85, w: 11.5, h: 0.9,
        fontFace: FONT.heading, fontSize: 28, color: COLOR.ink, bold: true
    });

    const features = [
        { emoji: '⚡', title: 'Broken Links modal', desc: 'Pulsing pill at top of gallery → "Auto-recover all" button fixes ~97% in one click' },
        { emoji: '🎨', title: 'AE artwork fallback', desc: 'When no mockup exists yet, the AE\'s submitted artwork shows instead of a blank card' },
        { emoji: '🔍', title: 'Smarter empty states', desc: '"No mockup yet" vs "Completed — no mockup file" vs ⚠ "Link broken" — each looks different' },
        { emoji: '📦', title: 'Open in Box / Re-upload', desc: 'Per-row actions in the modal — restore from Box trash or drag-drop a new file' }
    ];

    let yPos = 1.95;
    features.forEach(f => {
        s.addShape(pptx.ShapeType.ellipse, {
            x: 0.9, y: yPos + 0.05, w: 0.7, h: 0.7,
            fill: { color: COLOR.accentBg }, line: { color: COLOR.accentBgDeeper, width: 1 }
        });
        s.addText(f.emoji, {
            x: 0.9, y: yPos + 0.08, w: 0.7, h: 0.65,
            fontFace: FONT.body, fontSize: 22, align: 'center', valign: 'middle'
        });
        s.addText(f.title, {
            x: 1.75, y: yPos, w: 4.7, h: 0.4,
            fontFace: FONT.heading, fontSize: 17, color: COLOR.ink, bold: true
        });
        s.addText(f.desc, {
            x: 1.75, y: yPos + 0.4, w: 4.7, h: 0.7,
            fontFace: FONT.body, fontSize: 12, color: COLOR.muted
        });
        yPos += 1.15;
    });

    s.addShape(pptx.ShapeType.roundRect, {
        x: 6.5, y: 1.9, w: 6.4, h: 5.1,
        fill: { color: COLOR.bgSoft }, line: { color: COLOR.cardBorder, width: 1 },
        rectRadius: 0.12
    });
    addScreenshotOrPlaceholder(s, 'steve-dashboard.png', {
        x: 6.65, y: 2.05, w: 6.1, h: 4.5
    });
    s.addText('Steve\'s rebuilt Gallery View — green nav, search, Send-to-Supacolor', {
        x: 6.65, y: 6.55, w: 6.1, h: 0.35,
        fontFace: FONT.body, fontSize: 11, color: COLOR.muted, italic: true, align: 'center'
    });

    addFooter(s, 4);
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 5 — POLISH GRAB BAG
// ═══════════════════════════════════════════════════════════════════
{
    const s = pptx.addSlide();
    s.background = { color: COLOR.bg };
    addAccentBar(s);

    s.addText('SMALL WINS', {
        x: 0.9, y: 0.55, w: 4, h: 0.3,
        fontFace: FONT.body, fontSize: 11, color: COLOR.accent,
        bold: true, charSpacing: 4
    });

    s.addText('Other things you\'ll notice', {
        x: 0.9, y: 0.85, w: 11.5, h: 0.9,
        fontFace: FONT.heading, fontSize: 36, color: COLOR.ink, bold: true
    });

    const wins = [
        { title: 'Rep first name on every card', desc: 'Steve, Ruth, and AE dashboards now show "Nika", "Taneisha", etc. right in the card header.' },
        { title: 'Click a rep name to filter', desc: 'On any of the 3 dashboards, click a rep\'s name on a card and the whole queue filters to just their work.' },
        { title: '"Supacolor API Orders" rename', desc: 'On the Staff Dashboard and AE/Ruth tabs — clearer what data is coming from the live Supacolor API.' },
        { title: 'Workflow Strip on Staff Dashboard', desc: 'New visual pattern at the top of the dashboard, Transfer flow comes first.' },
        { title: '33 stability fixes on Steve\'s dashboard', desc: '4 critical, 8 high, plus medium/low — all closed Friday from a one-day audit pass.' }
    ];

    // Left column: wins list (narrower so we have room for screenshot)
    let yPos = 1.95;
    wins.forEach((w) => {
        s.addShape(pptx.ShapeType.rect, {
            x: 0.9, y: yPos, w: 0.06, h: 0.85,
            fill: { color: COLOR.accent }, line: { color: COLOR.accent }
        });
        s.addText(w.title, {
            x: 1.15, y: yPos, w: 5.2, h: 0.35,
            fontFace: FONT.heading, fontSize: 14, color: COLOR.ink, bold: true
        });
        s.addText(w.desc, {
            x: 1.15, y: yPos + 0.32, w: 5.2, h: 0.7,
            fontFace: FONT.body, fontSize: 11, color: COLOR.muted
        });
        yPos += 1.0;
    });

    // Right column: Ruth's dashboard showing rep names on cards
    s.addShape(pptx.ShapeType.roundRect, {
        x: 6.7, y: 1.9, w: 6.2, h: 4.5,
        fill: { color: COLOR.bgSoft }, line: { color: COLOR.cardBorder, width: 1 },
        rectRadius: 0.12
    });
    addScreenshotOrPlaceholder(s, 'ruth-dashboard.png', {
        x: 6.85, y: 2.05, w: 5.9, h: 3.95
    });
    s.addText('Ruth\'s queue — "From: Taneisha" / "From: Nika" right on each card', {
        x: 6.7, y: 6.0, w: 6.2, h: 0.35,
        fontFace: FONT.body, fontSize: 11, color: COLOR.muted, italic: true, align: 'center'
    });

    s.addText('Questions? Slack me. — Erik', {
        x: 0.9, y: 6.95, w: 11.5, h: 0.35,
        fontFace: FONT.body, fontSize: 12, color: COLOR.muted, italic: true
    });

    addFooter(s, 5);
}

// ── Save ──────────────────────────────────────────────────────────
pptx.writeFile({ fileName: OUT_PATH })
    .then(f => console.log('Saved:', f))
    .catch(err => { console.error('Failed:', err); process.exit(1); });
