"""Build the NWCA Employee Handbook PDF from Caspio policy chapters.

Fetches the 'employee-handbook' parent + all child chapter policies via the
public proxy API, assembles them into a single corporate-styled HTML document
(full-bleed Employee Handbook cover with the NWCA logo, Contents with page
numbers, intro, and numbered chapters), then renders to PDF via xhtml2pdf.

Output: forms/Employee-Handbook-Latest.pdf

Design notes
------------
* Brand fonts are EMBEDDED (Source Serif 4 for display, Source Sans 3 for body).
  xhtml2pdf's @font-face is broken on Windows (it copies the TTF to a locked
  temp file -> PermissionError, and drive-letter paths parse as URL schemes),
  so we bypass @font-face entirely and pre-register the TTFs with reportlab,
  then point xhtml2pdf's DEFAULT_FONT map at them. TTFs live in scripts/fonts/.
* The cover is a single full-bleed PNG (Pillow draws the gradient, keyline
  frame, NWCA logo, and typography). xhtml2pdf canNOT place it full-bleed: an
  <img> flowable is hard-capped at ~94.76% of the page width, and a CSS @page
  background renders only on the DEFAULT page and then bleeds onto EVERY page
  (named-page backgrounds are dropped entirely in xhtml2pdf 0.2.17). So the
  body is rendered WITHOUT a cover, and the cover PNG is prepended afterward as
  a true full-page image with PyMuPDF (page.insert_image over the full rect).
* Page numbering: the cover is intentionally UNNUMBERED (standard for a bound
  cover). xhtml2pdf numbers the body 1..N starting at the Contents page, so the
  printed footers and the Contents table use the same body-relative numbers and
  always agree. Prepending the cover shifts physical position by one but leaves
  the visible numbering untouched; the chapter PDF outline is offset by +1.
* Two-pass render: pass 1 produces PDF bookmarks (one per chapter via
  -pdf-outline); we read the real page numbers back with PyMuPDF and rebuild
  the Contents page with them in pass 2. Placeholder numbers in pass 1 are the
  same width as real ones, so pagination does not shift between passes.

This script is NOT a temp script -- it's the permanent handbook builder.
Re-run any time chapters change. Online reader auto-syncs; the PDF does not.

Run: python scripts/build-handbook-pdf.py
"""
import json
import os
import re
import shutil
import sys
import tempfile
import time
import urllib.request
from datetime import datetime

from xhtml2pdf import pisa
from xhtml2pdf.default import DEFAULT_FONT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping
from PIL import Image, ImageDraw, ImageFont
import fitz  # PyMuPDF

PROXY = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com'
PARENT_ID = 'employee-handbook'
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(SCRIPT_DIR, 'fonts')
LOGO_PATH = os.path.join(SCRIPT_DIR, 'assets', 'nwca-logo.png')
OUT_PATH = os.path.abspath(os.path.join(
    SCRIPT_DIR, '..', 'forms', 'Employee-Handbook-Latest.pdf'
))

EFFECTIVE_DATE = 'May 26, 2026'

# Brand palette
GREEN_DEEP = '#175C28'
GREEN_BRIGHT = '#23843A'
GREEN_ACCENT = '#2e5b3e'


# --------------------------------------------------------------------------
# Font registration -- embed brand fonts, bypassing xhtml2pdf @font-face.
# --------------------------------------------------------------------------
def register_fonts():
    """Register the brand TTFs with reportlab and expose them to xhtml2pdf.

    addMapping wires up the bold/italic variants so <b>/<i> and font-weight
    resolve to the right TTF; DEFAULT_FONT lets `font-family: HBSans` resolve.
    """
    def reg(fam, r, b=None, i=None, bi=None):
        variants = {(0, 0): r, (1, 0): b or r, (0, 1): i or r, (1, 1): bi or b or r}
        for (bold, italic), filename in variants.items():
            full = '%s_%d%d' % (fam, bold, italic)
            pdfmetrics.registerFont(TTFont(full, os.path.join(FONTS, filename)))
            addMapping(fam, bold, italic, full)
        DEFAULT_FONT[fam.lower()] = fam

    reg('HBSerif', 'SourceSerif4-Regular.ttf', 'SourceSerif4-Bold.ttf')
    reg('HBSerifBlack', 'SourceSerif4-Black.ttf')
    reg('HBSans', 'SourceSans3-Regular.ttf', 'SourceSans3-Bold.ttf',
        'SourceSans3-It.ttf', 'SourceSans3-BoldIt.ttf')


# --------------------------------------------------------------------------
# Title page -- drawn as a full-bleed PNG with Pillow.
# --------------------------------------------------------------------------
def build_title_png(out_path):
    """Render the full-bleed Employee Handbook cover (NWCA logo + title) to a letter-size PNG.

    Rendered at 300 DPI (2550x3300) so it stays crisp for professional printing
    and binding. The PNG is prepended to the body PDF by PyMuPDF as a full-page
    image (see prepend_cover), so it bleeds edge-to-edge regardless of pixel
    count -- the gradient also flate-compresses to ~200 KB inside the PDF.
    """
    dpi = 300
    w, h = int(8.5 * dpi), int(11 * dpi)

    def font(filename, size):
        return ImageFont.truetype(os.path.join(FONTS, filename), size)

    top = (28, 108, 49)     # #1c6c31  near GREEN_BRIGHT
    bot = (10, 52, 25)      # #0a3419  deeper than GREEN_DEEP
    sage = (168, 205, 176)

    img = Image.new('RGB', (w, h))
    px = img.load()
    for y in range(h):
        t = y / (h - 1)
        c = tuple(int(top[k] + (bot[k] - top[k]) * t) for k in range(3))
        for x in range(w):
            px[x, y] = c

    d = ImageDraw.Draw(img)
    m = int(0.55 * dpi)
    d.rectangle([m, m, w - m, h - m], outline=sage, width=3)
    d.rectangle([m + 12, m + 12, w - m - 12, h - m - 12], outline=sage, width=1)

    def ctext(cx, y, txt, fnt, fill, track=0):
        if track:
            total = sum(d.textlength(ch, font=fnt) + track for ch in txt) - track
            x = cx - total / 2
            for ch in txt:
                d.text((x, y), ch, font=fnt, fill=fill)
                x += d.textlength(ch, font=fnt) + track
            return
        tw = d.textlength(txt, font=fnt)
        d.text((cx - tw / 2, y), txt, font=fnt, fill=fill)

    cx = w // 2

    # NWCA logo on a white rounded plate (logo artwork is dark green — needs a light backing)
    logo = Image.open(LOGO_PATH).convert('RGBA')
    lw = int(2.3 * dpi)
    lh = int(lw * logo.height / logo.width)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    pad = int(0.24 * dpi)
    plate_w, plate_h = lw + pad * 2, lh + pad * 2
    plate_x, plate_y = cx - plate_w // 2, int(1.15 * dpi)
    d.rounded_rectangle([plate_x, plate_y, plate_x + plate_w, plate_y + plate_h],
                        radius=int(0.13 * dpi), fill=(255, 255, 255))
    img.paste(logo, (plate_x + pad, plate_y + pad), logo)

    # Stacked display title
    title_fnt = font('SourceSerif4-Black.ttf', int(0.82 * dpi))
    ctext(cx, int(3.75 * dpi), 'Employee', title_fnt, (255, 255, 255))
    ctext(cx, int(4.62 * dpi), 'Handbook', title_fnt, (255, 255, 255))

    d.line([cx - int(0.55 * dpi), int(5.78 * dpi), cx + int(0.55 * dpi), int(5.78 * dpi)],
           fill=sage, width=2)
    ctext(cx, int(5.95 * dpi), '2026 Edition',
          font('SourceSans3-Bold.ttf', int(0.17 * dpi)), sage, track=6)

    ctext(cx, int(8.95 * dpi), 'Northwest Custom Apparel',
          font('SourceSans3-Bold.ttf', int(0.16 * dpi)), (232, 243, 234), track=4)
    ctext(cx, int(9.25 * dpi), 'Effective %s  ·  Milton, Washington' % EFFECTIVE_DATE,
          font('SourceSans3-Regular.ttf', int(0.135 * dpi)), (191, 224, 200))

    img.save(out_path, 'PNG')


# --------------------------------------------------------------------------
# Caspio fetch.
# --------------------------------------------------------------------------
def fetch_json(url):
    """GET a URL and return parsed JSON. Cache-busts via timestamp."""
    sep = '&' if '?' in url else '?'
    full = f'{url}{sep}_={int(time.time())}'
    with urllib.request.urlopen(full, timeout=15) as resp:
        return json.load(resp)


def fetch_handbook_chapters():
    """Fetch the parent policy and all child chapters (full Body_HTML).

    The tree endpoint nests children under the parent and strips Body_HTML to
    keep the payload small, so we use it only to discover ordered chapter IDs,
    then fetch each chapter individually (throttled to avoid 429).
    """
    tree = fetch_json(f'{PROXY}/api/policies-public/tree')
    chapter_ids = []
    for cat in tree.get('tree', []):
        for p in cat.get('policies', []):
            if p.get('Policy_ID') == PARENT_ID:
                for child in p.get('children', []):
                    chapter_ids.append((
                        child['Policy_ID'],
                        child.get('Sort_Order', 99999),
                    ))
                break
    chapter_ids.sort(key=lambda x: x[1])

    parent_res = fetch_json(f'{PROXY}/api/policies-public/{PARENT_ID}')
    parent = parent_res.get('policy')

    full_chapters = []
    for cid, _ in chapter_ids:
        full = fetch_json(f'{PROXY}/api/policies-public/{cid}')
        full_chapters.append(full['policy'])
        time.sleep(0.4)  # gentle pacing -- 22 requests * 0.4s
    return parent, full_chapters


# --------------------------------------------------------------------------
# HTML cleaning.
# --------------------------------------------------------------------------
def strip_chapter_footer(html):
    """Strip the web-only chapter footer (everything after the final <hr>)."""
    parts = re.split(r'<hr\s*/?>', html, maxsplit=0)
    if len(parts) > 1:
        return '<hr>'.join(parts[:-1])
    return html


def strip_parent_intro_web_sections(html):
    """Remove web-only blocks from the parent intro before the PDF renders it.

    The parent Body_HTML carries a 'Read or download the handbook' section
    (links to the online reader + a bookmark tip) and a duplicate
    'Table of Contents' list. The PDF already IS the download and has its own
    Contents page, so both are stripped. Anything after the duplicate TOC list
    (e.g. 'How this handbook works') is preserved.
    """
    # Remove the "Read or download the handbook" heading through the next <h2>.
    html = re.sub(
        r'<h2[^>]*>\s*Read or download the handbook\s*</h2>.*?(?=<h2)',
        '', html, flags=re.S | re.I,
    )
    # Remove the duplicate "Table of Contents" heading + its list.
    html = re.sub(
        r'<h2[^>]*>\s*Table of Contents\s*</h2>\s*<ol.*?</ol>',
        '', html, flags=re.S | re.I,
    )
    return html


def normalize_links_for_pdf(html):
    """Convert relative policy-detail links to absolute URLs for PDF readers."""
    return re.sub(
        r'href="/pages/',
        'href="https://www.teamnwca.com/pages/',
        html,
    )


def _norm(s):
    """Normalize a title for matching against PDF bookmark text."""
    return re.sub(r'\s+', ' ', s or '').strip().lower()


def clean_chapter_title(title):
    """Strip a leading 'Chapter N:' prefix from a Caspio title.

    The chapter opener and Contents both show the number separately (eyebrow /
    number column), so the prefix in the stored title is redundant. Titles that
    lack the prefix pass through unchanged.
    """
    cleaned = re.sub(
        r'^\s*chapter\s+\d+\s*[:.–—-]\s*', '', title or '', flags=re.I
    ).strip()
    return cleaned or (title or 'Untitled')


# --------------------------------------------------------------------------
# CSS -- kept as a literal string (no f-string) so CSS braces stay literal.
# --------------------------------------------------------------------------
CSS = """
/* The body is rendered WITHOUT a cover; the full-bleed cover PNG is prepended
   afterward by PyMuPDF (see prepend_cover). So the DEFAULT @page is the content
   page -- margins + running footer -- and it governs every page xhtml2pdf
   emits, starting at the Contents page. Body page numbers therefore run 1..N
   from Contents, matching the Contents table; the prepended cover is unnumbered. */
@page {
  size: letter;
  margin: 0.95in 0.9in 1.0in 0.9in;
  @frame footer_frame {
    -pdf-frame-content: footer_content;
    bottom: 0.5in;
    margin-left: 0.9in;
    margin-right: 0.9in;
    height: 0.32in;
  }
}

html, body { margin: 0; padding: 0; }
body {
  font-family: HBSans;
  font-size: 10.5pt;
  line-height: 1.5;
  color: #20302a;
}

/* ---- running footer ---- */
/* Frame content does NOT inherit body's font-family in xhtml2pdf, so HBSans
   must be declared explicitly or the footer falls back to Helvetica. */
#footer_content { font-family: HBSans; color: #8a978f; font-size: 8pt; }
#footer_content .ft-rule { border-top: 0.5pt solid #d8e0da; padding-top: 3pt; }
#footer_content table { width: 100%; border-collapse: collapse; margin: 0; }
#footer_content td { font-family: HBSans; border: none; padding: 0; font-size: 8pt; color: #8a978f; }

/* ---- Contents ---- */
/* The Contents page is the FIRST flowable of the body, so it is page 1 (the
   cover is prepended later by PyMuPDF and is unnumbered). No page-break-before
   here -- it would emit a leading blank page. */
.toc-page h1 {
  font-family: HBSerif; font-weight: bold; font-size: 25pt; color: #175C28;
  margin: 0 0 4pt 0;
}
.toc-rule { border: 0; border-top: 2pt solid #175C28; margin: 0 0 14pt 0; }
table.toc { width: 100%; border-collapse: collapse; margin: 0; }
table.toc td { border: none; padding: 2pt 0; vertical-align: bottom; font-size: 11pt; line-height: 1.25; }
table.toc td.toc-num { width: 0.45in; color: #23843A; font-weight: bold; font-family: HBSans; }
table.toc td.toc-ttl { font-family: HBSerif; color: #20302a; }
table.toc td.toc-pg { width: 0.5in; text-align: right; color: #6f7d74; font-family: HBSans; }
.toc-note {
  margin-top: 16pt; font-size: 9pt; line-height: 1.45;
  color: #6f7d74; font-style: italic;
}

/* ---- chapter openers ---- */
.intro-page { page-break-before: always; }
.chapter { page-break-before: always; }
.chapter-eyebrow {
  font-family: HBSans; font-weight: bold; font-size: 9pt;
  letter-spacing: 2.5pt; color: #23843A; margin: 0 0 2pt 0;
}
h1.chapter-title {
  font-family: HBSerif; font-weight: bold; font-size: 26pt; color: #175C28;
  margin: 0 0 14pt 0; padding-bottom: 8pt; border-bottom: 2pt solid #175C28;
  -pdf-outline: true; -pdf-outline-level: 0;
}

/* ---- body typography ---- */
h2 {
  font-family: HBSans; font-weight: bold; font-size: 13.5pt; color: #175C28;
  margin: 16pt 0 5pt 0; -pdf-keep-with-next: true;
}
h3 {
  font-family: HBSans; font-weight: bold; font-size: 11.5pt; color: #2e5b3e;
  margin: 13pt 0 4pt 0; -pdf-keep-with-next: true;
}
p { margin: 0 0 7pt 0; }
ul, ol { margin: 0 0 8pt 0.3in; }
li { margin-bottom: 4pt; }
a { color: #175C28; text-decoration: underline; }
strong, b { font-weight: bold; }
blockquote {
  border-left: 3pt solid #23843A; padding: 2pt 0 2pt 12pt;
  margin: 8pt 0; color: #44524a; font-style: italic;
}
table { border-collapse: collapse; margin: 8pt 0; width: 100%; }
th, td {
  border: 0.5pt solid #b4c4ba; padding: 4pt 6pt;
  text-align: left; vertical-align: top; font-size: 9.5pt;
}
th { background-color: #eef3ef; font-weight: bold; color: #175C28; }
tr { page-break-inside: avoid; }
hr { border: 0; border-top: 0.5pt solid #d8e0da; margin: 10pt 0; }
"""


# --------------------------------------------------------------------------
# HTML assembly.
# --------------------------------------------------------------------------
# The "Page " literal before <pdf:pagenumber/> is REQUIRED: in xhtml2pdf 0.2.17 a
# table cell whose only content is the self-closing tag renders empty (no number).
# Adjacent literal text forces it to emit. Do not reduce to a bare <pdf:pagenumber/>.
FOOTER_DIV = (
    '<div id="footer_content">'
    '<div class="ft-rule">'
    '<table><tr>'
    '<td style="text-align:left; font-family:HBSans;">Northwest Custom Apparel &middot; Employee Handbook 2026</td>'
    '<td style="text-align:right; font-family:HBSans;">Page <pdf:pagenumber/></td>'
    '</tr></table>'
    '</div></div>'
)


def _toc_row(num, title, pg):
    return (
        '<tr>'
        f'<td class="toc-num">{num}</td>'
        f'<td class="toc-ttl">{title}</td>'
        f'<td class="toc-pg">{pg}</td>'
        '</tr>'
    )


def build_toc_table(chapters, page_map):
    """Build the Contents table. page_map=None -> width-stable placeholders."""
    def pageno(title):
        if page_map is None:
            return '00'
        return str(page_map.get(_norm(title), ''))

    rows = [_toc_row('', 'About This Handbook', pageno('About This Handbook'))]
    for i, ch in enumerate(chapters, start=1):
        title = clean_chapter_title(ch.get('Title', 'Untitled'))
        rows.append(_toc_row(str(i), title, pageno(title)))
    return '<table class="toc">' + ''.join(rows) + '</table>'


def build_html(parent, chapters, page_map, now):
    """Assemble the body HTML document for xhtml2pdf rendering (no cover).

    The cover is prepended later as a full-page image by prepend_cover, so the
    body starts at the Contents page.
    """
    toc_table = build_toc_table(chapters, page_map)
    toc_page = (
        '<div class="toc-page">'
        '<h1>Contents</h1>'
        '<hr class="toc-rule" />'
        f'{toc_table}'
        '<p class="toc-note">This handbook is a living document generated from '
        'the NWCA Policies Hub. Visit teamnwca.com/pages/policies-hub.html for '
        f'the always-current online version. Generated {now}.</p>'
        '</div>'
    )

    intro_body = strip_parent_intro_web_sections(parent.get('Body_HTML', ''))
    intro_body = strip_chapter_footer(intro_body)
    intro_body = normalize_links_for_pdf(intro_body)
    intro_page = (
        '<div class="intro-page">'
        '<p class="chapter-eyebrow">INTRODUCTION</p>'
        '<h1 class="chapter-title">About This Handbook</h1>'
        f'{intro_body}</div>'
    )

    chapter_blocks = []
    for i, ch in enumerate(chapters, start=1):
        body = strip_chapter_footer(ch.get('Body_HTML', ''))
        body = normalize_links_for_pdf(body)
        title = clean_chapter_title(ch.get('Title', 'Untitled'))
        chapter_blocks.append(
            '<div class="chapter">'
            f'<p class="chapter-eyebrow">CHAPTER {i}</p>'
            f'<h1 class="chapter-title">{title}</h1>'
            f'{body}'
            '</div>'
        )

    # FOOTER_DIV is pulled into the footer frame by id, so its position in the
    # flow is irrelevant. The Contents page is the first visible flowable.
    return (
        '<!DOCTYPE html><html><head><meta charset="utf-8" />'
        f'<style>{CSS}</style></head><body>'
        f'{FOOTER_DIV}{toc_page}{intro_page}{"".join(chapter_blocks)}'
        '</body></html>'
    )


# --------------------------------------------------------------------------
# Render + two-pass orchestration.
# --------------------------------------------------------------------------
def _make_link_callback(img_dir):
    """Resolve any <img src="..."> in chapter HTML to files in img_dir."""
    def link_callback(uri, rel):
        candidate = os.path.join(img_dir, os.path.basename(uri))
        return candidate if os.path.exists(candidate) else uri
    return link_callback


def render_pdf(html, out_path, link_callback):
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'wb') as out:
        status = pisa.CreatePDF(html, dest=out, encoding='utf-8',
                                link_callback=link_callback)
    if status.err:
        raise RuntimeError(f'xhtml2pdf reported {status.err} errors')


def extract_page_map(pdf_path):
    """Read PDF bookmarks -> {normalized title: 1-based page number}."""
    doc = fitz.open(pdf_path)
    toc = doc.get_toc(simple=True)  # [[level, title, page], ...]
    doc.close()
    page_map = {}
    for _level, title, page in toc:
        key = _norm(title)
        if key not in page_map:
            page_map[key] = page
    return page_map


def prepend_cover(body_pdf, cover_png, out_path):
    """Prepend the full-bleed cover image to the body PDF and write out_path.

    xhtml2pdf cannot place a true full-bleed cover (its <img> is width-capped and
    its only working @page background bleeds onto every page), so the body is
    rendered cover-less and the cover is added here as a real full-page image.
    The body's chapter outline is shifted +1 to account for the inserted page;
    the visible page numbers (footers + Contents) are left as-is -- the cover is
    intentionally unnumbered.
    """
    doc = fitz.open(body_pdf)
    toc = doc.get_toc(simple=True)  # body-relative, before the insert
    cover = doc.new_page(0, width=612, height=792)  # US Letter, pt
    cover.insert_image(cover.rect, filename=cover_png)
    if toc:
        doc.set_toc([[lvl, title, pg + 1] for lvl, title, pg in toc])
    # deflate + garbage-collect so the inserted PNG is recompressed (the gradient
    # flate-packs to ~200 KB instead of the ~25 MB an uncompressed save leaves).
    doc.save(out_path, deflate=True, garbage=4)
    doc.close()


def main():
    register_fonts()

    print('Fetching handbook content from Caspio...')
    parent, chapters = fetch_handbook_chapters()
    if parent is None:
        print('ERROR: Could not fetch parent policy "employee-handbook"', file=sys.stderr)
        sys.exit(1)
    print(f'Found parent + {len(chapters)} chapters')
    if len(chapters) == 0:
        print('ERROR: No chapter policies found', file=sys.stderr)
        sys.exit(1)

    now = datetime.now().strftime('%B %d, %Y')
    tmp = tempfile.mkdtemp(prefix='hbpdf_')
    try:
        print('Rendering cover image...')
        cover_png = os.path.join(tmp, 'title.png')
        build_title_png(cover_png)
        link_callback = _make_link_callback(tmp)

        print('Pass 1: building HTML + collecting page numbers...')
        html1 = build_html(parent, chapters, page_map=None, now=now)
        pass1_pdf = os.path.join(tmp, 'pass1.pdf')
        render_pdf(html1, pass1_pdf, link_callback)
        page_map = extract_page_map(pass1_pdf)
        print(f'  Captured {len(page_map)} bookmark page numbers')

        print('Pass 2: rendering body with Contents page numbers...')
        html2 = build_html(parent, chapters, page_map=page_map, now=now)
        body_pdf = os.path.join(tmp, 'body.pdf')
        render_pdf(html2, body_pdf, link_callback)

        print('Prepending full-bleed cover...')
        os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
        prepend_cover(body_pdf, cover_png, OUT_PATH)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

    pages = fitz.open(OUT_PATH).page_count
    size = os.path.getsize(OUT_PATH)
    print(f'OK Wrote {OUT_PATH}')
    print(f'   Pages: {pages}   Size: {size:,} bytes')


if __name__ == '__main__':
    main()
