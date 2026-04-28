/**
 * Build a 2-slide PowerPoint deck for the "dimensions fix" rollout.
 * Output: C:\Users\erik\Downloads\dimensions-fix-rollout.pptx
 */
const PptxGenJS = require('pptxgenjs');
const path = require('path');

const SS = 'C:/Users/erik/AppData/Local/Temp/rush-screenshots';
const OUT = 'C:/Users/erik/Downloads/dimensions-fix-rollout.pptx';

const COLOR = {
    primary: '2563EB',       // blue - "fix/improvement"
    primaryDark: '1E40AF',
    primaryBg: 'EFF6FF',
    primaryBgDeep: 'DBEAFE',
    ink: '0F172A',
    muted: '475569',
    light: '94A3B8',
    bg: 'FFFFFF',
    bgSoft: 'F8FAFC',
    cardBorder: 'E2E8F0',
    green: '047857',
    greenBg: 'ECFDF5'
};

const FONT = { heading: 'Calibri', body: 'Calibri' };

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.title = 'Dimensions Fix Rollout';
pptx.author = 'Northwest Custom Apparel';

function addFooter(slide, pageNum, totalPages) {
    slide.addShape(pptx.ShapeType.rect, {
        x: 0, y: 7.4, w: 13.33, h: 0.1, fill: { color: COLOR.primary }, line: { color: COLOR.primary }
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
// SLIDE 1 — The change, from AE side
// ═══════════════════════════════════════════════════════════════════
{
    const s = pptx.addSlide();
    s.background = { color: COLOR.bg };

    s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 0.4, h: 7.5, fill: { color: COLOR.primary }, line: { color: COLOR.primary }
    });

    s.addText('IMPROVEMENT · APRIL 17', {
        x: 0.9, y: 0.55, w: 6, h: 0.3,
        fontFace: FONT.body, fontSize: 11, color: COLOR.primary,
        bold: true, charSpacing: 4
    });

    s.addText('Logo dimensions now flow AE → Ruth', {
        x: 0.9, y: 0.85, w: 11.5, h: 0.9,
        fontFace: FONT.heading, fontSize: 34, color: COLOR.ink, bold: true
    });

    // Left column — the "what" and "why"
    s.addText('What changed', {
        x: 0.9, y: 2.0, w: 5.3, h: 0.35,
        fontFace: FONT.body, fontSize: 12, color: COLOR.primary, bold: true, charSpacing: 3
    });

    s.addText([
        { text: 'When you fill in ', options: { color: COLOR.ink } },
        { text: 'Width (inches)', options: { color: COLOR.primary, bold: true } },
        { text: ' and ', options: { color: COLOR.ink } },
        { text: 'Height (inches)', options: { color: COLOR.primary, bold: true } },
        { text: ' on the Ruth submit form, those numbers now show up directly on Ruth\'s dashboard cards and in the Request Details panel.', options: { color: COLOR.ink } }
    ], {
        x: 0.9, y: 2.4, w: 5.3, h: 2.2,
        fontFace: FONT.body, fontSize: 16, paraSpaceAfter: 8, lineSpacingMultiple: 1.3
    });

    // Before/After callout
    s.addShape(pptx.ShapeType.roundRect, {
        x: 0.9, y: 4.7, w: 5.3, h: 2.25,
        fill: { color: COLOR.primaryBg }, line: { color: COLOR.primaryBgDeep, width: 1 },
        rectRadius: 0.12
    });
    s.addText('Before', {
        x: 1.1, y: 4.85, w: 2.4, h: 0.35,
        fontFace: FONT.body, fontSize: 11, color: COLOR.muted, bold: true, charSpacing: 3
    });
    s.addText('Ruth had to re-type the dimensions during digitizing because your input never surfaced.', {
        x: 1.1, y: 5.2, w: 4.9, h: 0.8,
        fontFace: FONT.body, fontSize: 13, color: COLOR.ink
    });
    s.addText('Now', {
        x: 1.1, y: 6.0, w: 2.4, h: 0.35,
        fontFace: FONT.body, fontSize: 11, color: COLOR.primary, bold: true, charSpacing: 3
    });
    s.addText('Your dimensions flow straight through — Ruth plans her work from your numbers.', {
        x: 1.1, y: 6.3, w: 4.9, h: 0.6,
        fontFace: FONT.body, fontSize: 13, color: COLOR.ink
    });

    // Right column — screenshot of the form
    s.addShape(pptx.ShapeType.roundRect, {
        x: 6.5, y: 2.0, w: 6.4, h: 4.95,
        fill: { color: COLOR.bgSoft }, line: { color: COLOR.cardBorder, width: 1 },
        rectRadius: 0.12
    });
    s.addImage({
        path: path.join(SS, 'd3-ae-form-width-height.png'),
        x: 6.65, y: 2.15, w: 6.1, h: 4.25
    });
    s.addText('The Width / Height inputs on the Ruth submit form', {
        x: 6.65, y: 6.5, w: 6.1, h: 0.35,
        fontFace: FONT.body, fontSize: 11, color: COLOR.muted, italic: true, align: 'center'
    });

    addFooter(s, 1, 2);
}

// ═══════════════════════════════════════════════════════════════════
// SLIDE 2 — Where Ruth sees them
// ═══════════════════════════════════════════════════════════════════
{
    const s = pptx.addSlide();
    s.background = { color: COLOR.bg };

    s.addShape(pptx.ShapeType.rect, {
        x: 0, y: 0, w: 0.4, h: 7.5, fill: { color: COLOR.primary }, line: { color: COLOR.primary }
    });

    s.addText('WHERE RUTH SEES THEM', {
        x: 0.9, y: 0.55, w: 6, h: 0.3,
        fontFace: FONT.body, fontSize: 11, color: COLOR.primary,
        bold: true, charSpacing: 4
    });

    s.addText('Three places, all automatic', {
        x: 0.9, y: 0.85, w: 11.5, h: 0.9,
        fontFace: FONT.heading, fontSize: 34, color: COLOR.ink, bold: true
    });

    // Three numbered blocks on the left
    const blocks = [
        { num: '1', label: 'GRID CARD', desc: 'A Dimensions: 3.5″ × 2.0″ row on every card in the Mockup Queue.' },
        { num: '2', label: 'KANBAN CARD', desc: 'A compact green 📐 badge next to the Mockup Type pill.' },
        { num: '3', label: 'DETAIL PAGE', desc: 'The "Logo Dimensions" row in Request Details — same place it already was.' }
    ];

    let yPos = 2.0;
    blocks.forEach(block => {
        // Circle number
        s.addShape(pptx.ShapeType.ellipse, {
            x: 0.9, y: yPos, w: 0.6, h: 0.6,
            fill: { color: COLOR.primary }, line: { color: COLOR.primaryDark, width: 1 }
        });
        s.addText(block.num, {
            x: 0.9, y: yPos, w: 0.6, h: 0.6,
            fontFace: FONT.heading, fontSize: 22, color: 'FFFFFF', bold: true,
            align: 'center', valign: 'middle'
        });
        // Label
        s.addText(block.label, {
            x: 1.7, y: yPos - 0.05, w: 4.5, h: 0.35,
            fontFace: FONT.body, fontSize: 12, color: COLOR.primary, bold: true, charSpacing: 3
        });
        // Desc
        s.addText(block.desc, {
            x: 1.7, y: yPos + 0.25, w: 4.5, h: 0.8,
            fontFace: FONT.body, fontSize: 14, color: COLOR.ink
        });
        yPos += 1.35;
    });

    // Bottom callout
    s.addShape(pptx.ShapeType.roundRect, {
        x: 0.9, y: 6.15, w: 5.3, h: 0.8,
        fill: { color: COLOR.greenBg }, line: { color: COLOR.green, width: 1 },
        rectRadius: 0.1
    });
    s.addText([
        { text: '✓ ', options: { color: COLOR.green, bold: true, fontSize: 16 } },
        { text: 'No extra clicks, no double-entry. It just works.', options: { color: COLOR.ink, fontSize: 14, bold: true } }
    ], {
        x: 1.1, y: 6.25, w: 5.0, h: 0.6,
        fontFace: FONT.body, valign: 'middle'
    });

    // Right column — the grid card screenshot (shows the Dimensions row + kanban badge in same view would be ideal, but grid is clearest)
    s.addShape(pptx.ShapeType.roundRect, {
        x: 6.5, y: 2.0, w: 6.4, h: 4.95,
        fill: { color: COLOR.bgSoft }, line: { color: COLOR.cardBorder, width: 1 },
        rectRadius: 0.12
    });
    s.addImage({
        path: path.join(SS, 'd1-ruth-grid-dimensions.png'),
        x: 6.65, y: 2.15, w: 6.1, h: 4.25
    });
    s.addText('Ruth\'s dashboard — the new Dimensions row on each card', {
        x: 6.65, y: 6.5, w: 6.1, h: 0.35,
        fontFace: FONT.body, fontSize: 11, color: COLOR.muted, italic: true, align: 'center'
    });

    addFooter(s, 2, 2);
}

pptx.writeFile({ fileName: OUT })
    .then(f => console.log('Saved:', f))
    .catch(err => { console.error('Failed:', err); process.exit(1); });
