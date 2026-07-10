/**
 * Build the full NWCA Employee Handbook as a print-quality .docx:
 * cover → TOC (Word field) → intro → 22 chapters (page-break each),
 * footers with page numbers. Bodies fetched live from the Policies Hub API
 * and converted from HTML with a pragmatic tag-subset converter.
 */
const fs = require('fs');
const { parse } = require('./node_modules/node-html-parser');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, PageNumber, Footer, TableOfContents, ImageRun,
} = require('./node_modules/docx');

const GREEN = '1A472A';
const CONTENT = 9360;
const API = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/policies-public/';

async function fetchPolicy(id) {
  const r = await fetch(API + id);
  if (!r.ok) throw new Error(id + ' HTTP ' + r.status);
  const d = await r.json();
  return d.policy || d;
}

// ---------- HTML -> docx converter (tag subset used by hub bodies) ----------
function runsFromInline(node, style = {}) {
  // returns TextRun[] for inline content
  const out = [];
  for (const child of node.childNodes) {
    if (child.nodeType === 3) { // text
      const t = child.text.replace(/\s+/g, ' ');
      if (t) out.push(new TextRun({ text: t, bold: style.bold, italics: style.italics, font: style.mono ? 'JetBrains Mono' : undefined, size: style.size }));
    } else if (child.nodeType === 1) {
      const tag = child.rawTagName ? child.rawTagName.toLowerCase() : '';
      if (tag === 'strong' || tag === 'b') out.push(...runsFromInline(child, { ...style, bold: true }));
      else if (tag === 'em' || tag === 'i') out.push(...runsFromInline(child, { ...style, italics: true }));
      else if (tag === 'code') out.push(...runsFromInline(child, { ...style, mono: true, size: 20 }));
      else if (tag === 'a') out.push(...runsFromInline(child, style)); // plain text in print
      else if (tag === 'br') out.push(new TextRun({ text: '', break: 1 }));
      else out.push(...runsFromInline(child, style)); // span/u/etc
    }
  }
  return out;
}

function convertBlock(node, paras, listLevel = -1) {
  const tag = node.rawTagName ? node.rawTagName.toLowerCase() : '';
  if (node.nodeType === 3) {
    const t = node.text.trim();
    if (t) paras.push(new Paragraph({ spacing: { after: SP() }, children: [new TextRun(t.replace(/\s+/g, ' '))] }));
    return;
  }
  if (tag === 'h1' || tag === 'h2') {
    paras.push(new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: H2SP(), children: runsFromInline(node) }));
  } else if (tag === 'h3' || tag === 'h4') {
    paras.push(new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: H3SP(), children: runsFromInline(node) }));
  } else if (tag === 'p') {
    const runs = runsFromInline(node);
    if (runs.length) paras.push(new Paragraph({ spacing: { after: SP() }, children: runs }));
  } else if (tag === 'ul' || tag === 'ol') {
    const ref = tag === 'ul' ? 'hb-bullets' : ('hb-num-' + (numSeq++));
    if (tag === 'ol') numRefs.push(ref);
    for (const li of node.childNodes) {
      if (li.nodeType !== 1 || li.rawTagName.toLowerCase() !== 'li') continue;
      // inline part of the li
      const inlineRuns = [];
      const nestedBlocks = [];
      for (const c of li.childNodes) {
        const ctag = c.nodeType === 1 ? c.rawTagName.toLowerCase() : '';
        if (ctag === 'ul' || ctag === 'ol' || ctag === 'p' && nestedBlocks.length) nestedBlocks.push(c);
        else if (ctag === 'ul' || ctag === 'ol') nestedBlocks.push(c);
        else if (c.nodeType === 3 || ctag) inlineRuns.push(...(c.nodeType === 3
          ? (c.text.replace(/\s+/g, ' ').trim() ? [new TextRun(c.text.replace(/\s+/g, ' '))] : [])
          : (ctag === 'p' ? runsFromInline(c) : runsFromInline({ childNodes: [c] }))));
      }
      if (inlineRuns.length) {
        paras.push(new Paragraph({
          numbering: { reference: ref === 'hb-bullets' ? 'hb-bullets' : ref, level: Math.min(listLevel + 1, 2) },
          spacing: { after: SLI() }, children: inlineRuns,
        }));
      }
      for (const nb of nestedBlocks) convertBlock(nb, paras, listLevel + 1);
    }
  } else if (tag === 'blockquote') {
    paras.push(new Paragraph({
      spacing: { after: SP() }, indent: { left: 420 },
      border: { left: { style: BorderStyle.SINGLE, size: 12, color: GREEN, space: 4 } },
      children: runsFromInline(node, { italics: true }),
    }));
  } else if (tag === 'hr') {
    paras.push(new Paragraph({ spacing: { after: SP() }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB', space: 1 } }, children: [] }));
  } else if (tag === 'table') {
    const rows = [];
    for (const tr of node.querySelectorAll('tr')) {
      const cells = [];
      const tds = tr.childNodes.filter(c => c.nodeType === 1 && ['td', 'th'].includes(c.rawTagName.toLowerCase()));
      for (const td of tds) {
        const isTh = td.rawTagName.toLowerCase() === 'th';
        cells.push({ th: isTh, runs: runsFromInline(td, { bold: isTh }) });
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length) {
      const ncols = Math.max(...rows.map(r => r.length));
      const w = Math.floor(CONTENT / ncols);
      const widths = Array(ncols).fill(w);
      const b = { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' };
      const bs = { top: b, bottom: b, left: b, right: b };
      paras.push(new Table({
        width: { size: w * ncols, type: WidthType.DXA }, columnWidths: widths,
        rows: rows.map(r => new TableRow({
          children: Array.from({ length: ncols }, (_, i) => new TableCell({
            borders: bs, width: { size: w, type: WidthType.DXA },
            shading: r[i] && r[i].th ? { fill: 'E3F0E7', type: ShadingType.CLEAR } : undefined,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [new Paragraph({ children: (r[i] ? r[i].runs : []) })],
          })),
        })),
      }));
      paras.push(new Paragraph({ spacing: { after: SP() }, children: [] }));
    }
  } else if (tag === 'div' || tag === 'section' || tag === '') {
    for (const c of node.childNodes) convertBlock(c, paras, listLevel);
  } else {
    const runs = runsFromInline(node);
    if (runs.length) paras.push(new Paragraph({ spacing: { after: SP() }, children: runs }));
  }
}

let numSeq = 0;
const numRefs = [];
let COMPACT = 0; // per-chapter tail-spill compression: 0 normal, 1 tight, 2 tighter
const SP  = () => COMPACT === 4 ? 20 : COMPACT === 3 ? 30 : COMPACT === 2 ? 40 : COMPACT === 1 ? 60 : 100;
const SLI = () => COMPACT >= 3 ? 0 : COMPACT === 2 ? 10 : COMPACT === 1 ? 20 : 40;
const H2SP = () => COMPACT === 4 ? { before: 60, after: 20 } : COMPACT === 3 ? { before: 80, after: 30 } : COMPACT === 2 ? { before: 100, after: 40 } : COMPACT === 1 ? { before: 140, after: 60 } : undefined;
const H3SP = () => COMPACT === 4 ? { before: 40, after: 15 } : COMPACT === 3 ? { before: 60, after: 20 } : COMPACT === 2 ? { before: 80, after: 30 } : COMPACT === 1 ? { before: 110, after: 50 } : undefined;

function htmlToParas(html) {
  // strip the per-chapter nav trailer
  html = html.replace(/<hr>\s*<p><em>This chapter is part of the NWCA Employee Handbook[\s\S]*?<\/p>/i, '');
  // strip web-only "Related Policies" link blocks — noise on paper (2026-07-10)
  html = html.replace(/<h[234]>\s*Related Policies(?:\s+Hub entries)?\s*<\/h[234]>\s*(<ul>[\s\S]*?<\/ul>|<ol>[\s\S]*?<\/ol>)?/gi, '');
  html = html.replace(/<p><em>\s*Related policies:[\s\S]*?<\/p>/gi, '');
  const root = parse(html);
  const paras = [];
  for (const c of root.childNodes) convertBlock(c, paras, -1);
  return paras;
}

(async () => {
  const ids = ['employee-handbook'];
  for (let i = 1; i <= 22; i++) ids.push(null); // placeholder
  const parent = await fetchPolicy('employee-handbook');
  // discover chapter ids from the live list (hb-NN-*)
  const list = await (await fetch(API)).json();
  const chapters = (list.policies || [])
    .filter(p => /^hb-\d\d-/.test(p.Policy_ID))
    .sort((a, b) => a.Policy_ID.localeCompare(b.Policy_ID));
  console.log('chapters found:', chapters.length);

  const children = [];

  // COVER — logo, title block, footer line (437x238 source, rendered 262x143)
  children.push(
    new Paragraph({ spacing: { before: 2100, after: 400 }, alignment: AlignmentType.CENTER,
      children: [new ImageRun({ type: 'png', data: fs.readFileSync('logo.png'),
        transformation: { width: 262, height: 143 },
        altText: { title: 'Northwest Custom Apparel', description: 'Northwest Custom Apparel logo', name: 'nwca-logo' } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: 'Employee Handbook', bold: true, size: 64, color: GREEN })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: SP() },
      children: [new TextRun({ text: 'Effective May 26, 2026 · Revised July 10, 2026', size: 24, color: '555555' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 2900 },
      children: [new TextRun({ text: 'Deliver Happiness and Create WOW Moments for Every Customer', italics: true, size: 22, color: '3A7C52' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: '2025 Freeman Road East, Milton, WA 98354 · (253) 922-5793 · teamnwca.com', size: 20, color: '777777' })] }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // TOC — title is a styled plain paragraph (NOT Heading1) so the TOC doesn't list itself
  children.push(
    new Paragraph({ spacing: { before: 240, after: 200 },
      children: [new TextRun({ text: 'Table of Contents', bold: true, size: 32, color: GREEN })] }),
    new TableOfContents('Table of Contents', { hyperlink: true, headingStyleRange: '1-1' }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // INTRO (parent body, minus the read/download section and its own chapter
  // list — the real TOC on page 2 already covers it)
  let intro = parent.Body_HTML
    .replace(/<h2>Read or download the handbook<\/h2>[\s\S]*?(?=<h2>)/i, '')
    .replace(/<h2>Table of Contents<\/h2>[\s\S]*?(?=<h2>)/i, '');
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Welcome')] }));
  children.push(...htmlToParas(intro));

  // CHAPTERS
  const COMPACT_CHAPTERS = { 'hb-09-diversity-inclusion': 1, 'hb-10-bullying-harassment': 1, 'hb-12-work-conditions': 2, 'hb-18-health-safety': 4 };
  for (const ch of chapters) {
    const full = await fetchPolicy(ch.Policy_ID);
    COMPACT = COMPACT_CHAPTERS[ch.Policy_ID] || 0;
    children.push(new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun(full.Title.trim())] }));
    if (full.Summary) children.push(new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: full.Summary, italics: true, color: '555555' })] }));
    children.push(...htmlToParas(full.Body_HTML));
    console.log('converted', full.Policy_ID, COMPACT ? '(compact)' : '');
    COMPACT = 0;
  }

  const numberingConfig = [
    { reference: 'hb-bullets', levels: [0, 1, 2].map(l => ({ level: l, format: LevelFormat.BULLET, text: l === 0 ? '•' : '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 620 + l * 360, hanging: 300 } } } })) },
    ...numRefs.map(ref => ({ reference: ref, levels: [0, 1, 2].map(l => ({ level: l, format: LevelFormat.DECIMAL, text: `%${l + 1}.`, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 620 + l * 360, hanging: 300 } } } })) })),
  ];

  const doc = new Document({
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: 'Arial', size: 20 } } },
      paragraphStyles: [
        // keepNext on every heading: a heading never strands at a page bottom
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'Arial', color: GREEN },
          paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 0, keepNext: true } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 25, bold: true, font: 'Arial', color: '222222' },
          paragraph: { spacing: { before: 190, after: 90 }, outlineLevel: 1, keepNext: true } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, font: 'Arial', color: '444444' },
          paragraph: { spacing: { before: 150, after: 70 }, outlineLevel: 2, keepNext: true } },
      ],
    },
    numbering: { config: numberingConfig },
    sections: [{
      // Left margin 1.4" for three-hole punching (single-sided printing);
      // titlePage keeps the cover footer-free.
      properties: {
        titlePage: true,
        page: { size: { width: 12240, height: 15840 }, margin: { top: 1300, right: 1296, bottom: 1300, left: 2016 } },
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: 'Northwest Custom Apparel — Employee Handbook · Page ', size: 17, color: '888888' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 17, color: '888888' }),
        ] })] }),
        first: new Footer({ children: [new Paragraph({ children: [] })] }),
      },
      children,
    }],
  });

  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync('Employee-Handbook-2026-07-10.docx', buf);
  console.log('docx written:', buf.length, 'bytes');
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
