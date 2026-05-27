"""Build the NWCA Employee Handbook PDF from Caspio policy chapters.

Fetches the 'employee-handbook' parent + all child chapter policies via the
public proxy API, assembles them into a single HTML document with cover,
TOC, and page-breaks, then renders to PDF via xhtml2pdf.

Output: forms/Employee-Handbook-Latest.pdf

This script is NOT a temp script — it's the permanent handbook builder.
Re-run any time chapters change. Future: trigger via admin button + cron.

Run: python scripts/build-handbook-pdf.py
"""
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime
from xhtml2pdf import pisa

PROXY = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com'
PARENT_ID = 'employee-handbook'
OUT_PATH = os.path.abspath(os.path.join(
    os.path.dirname(__file__), '..', 'forms', 'Employee-Handbook-Latest.pdf'
))


def fetch_json(url):
    """GET a URL and return parsed JSON. Cache-busts via timestamp."""
    sep = '&' if '?' in url else '?'
    full = f'{url}{sep}_={int(time.time())}'
    with urllib.request.urlopen(full, timeout=15) as resp:
        return json.load(resp)


def fetch_handbook_chapters():
    """Fetch the parent policy and all child chapters.

    The tree endpoint nests child policies under the parent's `children` array
    (not as separate top-level entries). We pull the tree to discover chapter
    IDs, then fetch each chapter individually to get the full Body_HTML
    (the tree response strips Body_HTML via toListShape to keep payload small).
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

    # Fetch parent with full body
    parent_res = fetch_json(f'{PROXY}/api/policies-public/{PARENT_ID}')
    parent = parent_res.get('policy')

    # Fetch each chapter with full body. Throttle to avoid 429.
    full_chapters = []
    for cid, _ in chapter_ids:
        full = fetch_json(f'{PROXY}/api/policies-public/{cid}')
        full_chapters.append(full['policy'])
        time.sleep(0.4)  # gentle pacing — 23 requests * 0.4s = ~10s overhead
    return parent, full_chapters


def strip_chapter_footer(html):
    """Strip the web-only chapter footer (everything after the final <hr>).

    The CHAPTER_FOOTER added during migration is web-specific ('Return to TOC').
    For PDF we don't want it because the PDF IS the handbook.
    """
    # Split on the last <hr> tag — anything after is the footer
    parts = re.split(r'<hr\s*/?>', html, maxsplit=0)
    if len(parts) > 1:
        # Keep everything except the last segment (the footer)
        return '<hr>'.join(parts[:-1])
    return html


def normalize_links_for_pdf(html):
    """Convert relative policy-detail links to absolute URLs for PDF readers."""
    return re.sub(
        r'href="/pages/',
        'href="https://www.teamnwca.com/pages/',
        html,
    )


def build_html(parent, chapters):
    """Assemble the full HTML document for xhtml2pdf rendering."""
    now = datetime.now().strftime('%B %d, %Y')

    # Per-chapter HTML — cleaned, with page break before each chapter
    chapter_blocks = []
    for ch in chapters:
        body = ch.get('Body_HTML', '')
        body = strip_chapter_footer(body)
        body = normalize_links_for_pdf(body)
        title = ch.get('Title', 'Untitled')
        # Anchor for TOC links + page break
        chapter_blocks.append(
            f'<div class="chapter">'
            f'<h1 class="chapter-title">{title}</h1>'
            f'{body}'
            f'</div>'
        )

    # TOC entries
    toc_items = []
    for ch in chapters:
        title = ch.get('Title', 'Untitled')
        toc_items.append(f'<li>{title}</li>')
    toc_html = '<ol class="toc">' + '\n'.join(toc_items) + '</ol>'

    # Full document
    html = f'''<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page {{
    size: letter;
    margin: 0.75in 0.75in 0.85in 0.75in;
    @frame footer_frame {{
      -pdf-frame-content: footer_content;
      bottom: 0.35in;
      margin-left: 0.75in;
      margin-right: 0.75in;
      height: 0.3in;
    }}
  }}
  @page main_page {{
    size: letter;
    margin: 0.75in 0.75in 0.85in 0.75in;
    @frame footer_frame {{
      -pdf-frame-content: footer_content;
      bottom: 0.35in;
      margin-left: 0.75in;
      margin-right: 0.75in;
      height: 0.3in;
    }}
  }}
  @page cover_page {{
    size: letter;
    margin: 0;
  }}
  body {{
    font-family: Helvetica, Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: #1a1a1a;
  }}
  .cover {{
    page: cover_page;
    background-color: #175C28;
    color: #ffffff;
    padding: 1in 0.5in 0.5in 0.5in;
    text-align: center;
    -pdf-frame-border: 0;
  }}
  p.cover-title {{
    font-size: 36pt;
    line-height: 1.1;
    color: #ffffff;
    margin: 1.5in 0 0.15in 0;
    font-weight: bold;
  }}
  p.cover-subtitle {{
    font-size: 16pt;
    color: #cfead4;
    margin: 0 0 0.4in 0;
    font-weight: normal;
  }}
  p.cover-meta {{
    font-size: 11pt;
    color: #cfead4;
    margin: 0;
  }}
  h1.chapter-title {{
    font-size: 20pt;
    color: #175C28;
    border-bottom: 2pt solid #175C28;
    padding-bottom: 6pt;
    margin-top: 0;
    margin-bottom: 16pt;
    -pdf-outline: true;
    -pdf-outline-level: 0;
  }}
  h2 {{
    font-size: 14pt;
    color: #23843A;
    margin-top: 14pt;
    margin-bottom: 6pt;
  }}
  h3 {{
    font-size: 12pt;
    color: #1a1a1a;
    margin-top: 12pt;
    margin-bottom: 4pt;
  }}
  p {{
    margin-bottom: 8pt;
  }}
  ul, ol {{
    margin-left: 0.4in;
    margin-bottom: 8pt;
  }}
  li {{
    margin-bottom: 4pt;
  }}
  a {{
    color: #175C28;
    text-decoration: underline;
  }}
  blockquote {{
    border-left: 3pt solid #23843A;
    padding-left: 12pt;
    margin-left: 0;
    margin-right: 0;
    color: #444444;
    font-style: italic;
  }}
  table {{
    border-collapse: collapse;
    margin: 8pt 0;
    width: 100%;
  }}
  th, td {{
    border: 0.5pt solid #888888;
    padding: 4pt 6pt;
    text-align: left;
    vertical-align: top;
    font-size: 9.5pt;
  }}
  th {{
    background-color: #e8e8e8;
    font-weight: bold;
  }}
  .toc-page {{
    page: main_page;
    page-break-before: always;
    page-break-after: always;
  }}
  .toc-page h1 {{
    font-size: 22pt;
    color: #175C28;
    border-bottom: 2pt solid #175C28;
    padding-bottom: 6pt;
    margin-bottom: 16pt;
  }}
  ol.toc {{
    font-size: 11pt;
    line-height: 1.8;
  }}
  .chapter {{
    page-break-before: always;
  }}
  .intro-page {{
    /* No page-break-after — .chapter has page-break-before: always */
  }}
  #footer_content {{
    font-size: 8.5pt;
    color: #888888;
    text-align: center;
  }}
  hr {{
    border: 0;
    border-top: 0.5pt solid #cccccc;
    margin: 8pt 0;
  }}
</style>
</head>
<body>

<div id="footer_content">
  Northwest Custom Apparel &middot; Employee Handbook &middot; <pdf:pagenumber/> of <pdf:pagecount/>
</div>

<div class="cover">
  <p class="cover-title">Employee Handbook</p>
  <p class="cover-subtitle">Northwest Custom Apparel</p>
  <p class="cover-meta">Effective May 26, 2026<br/>Generated {now}</p>
</div>

<div class="toc-page">
  <h1>Table of Contents</h1>
  {toc_html}
  <p style="margin-top: 24pt; font-size: 9pt; color: #666666;">
    <em>This handbook is a living document generated from the NWCA Policies Hub.
    Visit <strong>teamnwca.com/pages/policies-hub.html</strong> for the always-current online version.</em>
  </p>
</div>

<div class="intro-page">
  <h1 class="chapter-title">About This Handbook</h1>
  {strip_chapter_footer(normalize_links_for_pdf(parent.get('Body_HTML', '')))}
</div>

{''.join(chapter_blocks)}

</body>
</html>'''
    return html


def main():
    print('Fetching handbook content from Caspio...')
    parent, chapters = fetch_handbook_chapters()
    if parent is None:
        print('ERROR: Could not fetch parent policy "employee-handbook"', file=sys.stderr)
        sys.exit(1)
    print(f'Found parent + {len(chapters)} chapters')
    if len(chapters) == 0:
        print('ERROR: No chapter policies found', file=sys.stderr)
        sys.exit(1)

    print('Building HTML document...')
    html = build_html(parent, chapters)
    print(f'  HTML size: {len(html):,} bytes')

    print(f'Generating PDF to {OUT_PATH}...')
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, 'wb') as out:
        pisa_status = pisa.CreatePDF(html, dest=out, encoding='utf-8')
    if pisa_status.err:
        print(f'ERROR: xhtml2pdf reported {pisa_status.err} errors', file=sys.stderr)
        sys.exit(1)
    size = os.path.getsize(OUT_PATH)
    print(f'OK Wrote {OUT_PATH}')
    print(f'   Size: {size:,} bytes')


if __name__ == '__main__':
    main()
