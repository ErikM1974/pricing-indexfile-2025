"""Insert stylesheet links into pages (CRLF-aware, indentation copied from the anchor tag).
    python link-tokens.py --tokens=<href> [--before=<substring> --insert=<href>] <page.html> [...]
--tokens: insert `<link rel="stylesheet" href=HREF>` before the page's FIRST local stylesheet link (href not http(s)),
          unless the page already links tokens.css.
--before/--insert: insert `<link rel="stylesheet" href=INSERT>` immediately before the first <link> whose href
          contains BEFORE (e.g. the page's own sheet), unless INSERT is already linked.
"""
import re, sys
args = [a for a in sys.argv[1:] if not a.startswith('--')]
opt = dict(a[2:].split('=', 1) for a in sys.argv[1:] if a.startswith('--') and '=' in a)
LINK = re.compile(r'([ \t]*)<link\b[^>]*>', re.I)

def is_style(tag): return re.search(r'rel\s*=\s*"stylesheet"', tag, re.I) is not None
def href(tag):
    m = re.search(r'href\s*=\s*"([^"]+)"', tag, re.I); return m.group(1) if m else ''

for p in args:
    raw = open(p, 'rb').read().decode('utf-8'); nl = '\r\n' if '\r\n' in raw else '\n'; out = raw; done = []
    if 'tokens' in opt and '/shared_components/css/tokens.css' not in raw:
        for m in LINK.finditer(out):
            tag = m.group(0)
            if is_style(tag) and not re.match(r'https?:|//', href(tag)):
                out = out[:m.start()] + m.group(1) + '<link rel="stylesheet" href="' + opt['tokens'] + '">' + nl + out[m.start():]
                done.append('tokens'); break
    if 'before' in opt and 'insert' in opt and opt['insert'] not in out:
        for m in LINK.finditer(out):
            tag = m.group(0)
            if is_style(tag) and opt['before'] in href(tag):
                out = out[:m.start()] + m.group(1) + '<link rel="stylesheet" href="' + opt['insert'] + '">' + nl + out[m.start():]
                done.append('insert'); break
    if out != raw: open(p, 'wb').write(out.encode('utf-8'))
    print(f'{p}: {", ".join(done) or "nothing"}')
