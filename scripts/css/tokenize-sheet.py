"""Tokenize one family with page-scoped theme variables for off-palette colours (zero visual change by construction).

    python family-tokenize2.py [--dry] <file.css> [more...]

For every hex outside comments:
  - EXACT match of a hex token in shared_components/css/tokens.css        -> var(--token)
  - NEAR  (max per-channel distance <= 16, the screenshot-diff threshold)  -> var(--nearest-token)
  - FAR                                                                    -> var(--page-<hue name>[-n])
    declared once in a `:root` block prepended to the file, wrapped in stylelint-disable/enable color-no-hex.
Semantic overrides: `color: var(--color-surface)` on text is rewritten to var(--color-on-brand).
Prints a per-file summary; --dry only prints. Bytes: CRLF/LF kept, comments untouched.
"""
import re, sys, os, colorsys, collections
sys.stdout.reconfigure(encoding="utf-8")

import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))  # the repo root, wherever it is cloned
tok = re.sub(r'/\*[\s\S]*?\*/', '', open(os.path.join(ROOT, 'shared_components/css/tokens.css'), encoding='utf-8').read())

def expand(h):
    h = h.lower()
    return h if len(h) == 7 else '#' + ''.join(c * 2 for c in h[1:])
def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def dist(a, b): return max(abs(x - y) for x, y in zip(rgb(a), rgb(b)))

tokens = {}  # hex -> token name (first wins: the ramps are declared before the semantic aliases)
for m in re.finditer(r'(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\b', tok):
    tokens.setdefault(expand(m.group(2)), m.group(1))
PREFER = {'#ffffff': '--color-surface', '#fff': '--color-surface'}

HUES = [(15, 'red'), (40, 'orange'), (65, 'yellow'), (95, 'lime'), (160, 'green'), (190, 'teal'), (215, 'cyan'),
        (250, 'blue'), (275, 'indigo'), (300, 'violet'), (335, 'magenta'), (361, 'red')]
def hue_name(h):
    r, g, b = [c / 255 for c in rgb(h)]
    hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
    if ss < 0.12 or ll > 0.97 or ll < 0.04:
        base = 'gray'
    else:
        deg = hh * 360
        base = next(n for lim, n in HUES if deg < lim)
    if ll > 0.85: return base + '-tint'
    if ll < 0.25: return base + '-dark'
    return base

# A colour, not an id selector: not followed by an identifier char (#add-to-cart) and, checked per match below,
# preceded on its line by a ':' (a declaration) — `#add {` / `#abc:hover` have no colon before them.
HEX = re.compile(r'#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])')
# A comment, OR the page-theme block this script itself writes (stylelint-disable … enable color-no-hex):
# both are skipped, so a re-run over an already-migrated sheet is idempotent (2026-09-07 lesson: a re-run
# once rewrote its own declarations into `--x: var(--x)`, which a browser treats as invalid).
COMMENT = re.compile(r'/\* stylelint-disable color-no-hex \*/[\s\S]*?/\* stylelint-enable color-no-hex \*/|/\*[\s\S]*?\*/')
EXISTING = re.compile(r'(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})(?![0-9a-zA-Z_-])')
DRY = '--dry' in sys.argv
PREFIX = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--prefix=')), 'page')

def process(path):
    raw = open(path, 'rb').read().decode('utf-8')
    nl = '\r\n' if '\r\n' in raw else '\n'
    live = COMMENT.sub(lambda m: ' ' * len(m.group(0)), raw)  # same offsets, comments blanked
    counts = collections.Counter(expand(m.group(0)) for m in HEX.finditer(live))
    # page variables an earlier run already declared (name -> hex): reuse them, never re-declare or collide
    existing = {name: expand(h) for name, h in EXISTING.findall(raw) if name.startswith('--' + PREFIX + '-')}
    existing_by_hex = {h: name for name, h in existing.items()}
    plan = {}  # hex -> replacement var name
    page_vars = {}  # NEW var name -> hex (declared by this run)
    stats = collections.Counter()
    # A sheet's body ink (--text, --ink, --text-primary…) is never NEAR-mapped: a shade on the page's text is a
    # look change even when no pixel crosses the diff threshold (garment designer, 2026-09-07). Exact tokens only.
    inks = {expand(h) for _, h in re.findall(r'^\s*(--(?:text|ink)(?:-primary)?)\s*:\s*(#[0-9a-fA-F]{3,6})\b', live, re.M)}
    for h, n in counts.most_common():
        if h in PREFER: plan[h] = PREFER[h]; stats['exact'] += n; continue
        if h in tokens: plan[h] = tokens[h]; stats['exact'] += n; continue
        best = min(tokens, key=lambda t: dist(h, t))
        if dist(h, best) <= 16 and h not in inks:
            plan[h] = tokens[best]; stats['near'] += n; continue
        if h in existing_by_hex: plan[h] = existing_by_hex[h]; stats['far'] += n; continue
        name = '--' + PREFIX + '-' + hue_name(h)
        k, cand = 1, name
        while cand in page_vars or cand in existing: k += 1; cand = f'{name}-{k}'
        page_vars[cand] = h; plan[h] = cand; stats['far'] += n
    # rewrite live segments only
    out = []; last = 0
    def sub(m):
        seg = m.string; ls = seg.rfind('\n', 0, m.start()) + 1
        if ':' not in seg[ls:m.start()]: return m.group(0)  # selector position — leave it
        return 'var(' + plan[expand(m.group(0))] + ')'
    for m in COMMENT.finditer(raw):
        out.append(HEX.sub(sub, raw[last:m.start()])); out.append(m.group(0)); last = m.end()
    out.append(HEX.sub(sub, raw[last:]))
    new = ''.join(out)
    new = re.sub(r'\bcolor: var\(--color-surface\)', 'color: var(--color-on-brand)', new)
    if page_vars:
        block = ['/* Page theme (CSS standardization, 2026-09-07): this page\'s own colours, auto-named by hue so the page',
                 '   keeps its exact look. Map them to shared_components/css/tokens.css names when the page is redesigned;',
                 '   every rule below uses var(). Raw hex is allowed ONLY in this block. */',
                 '/* stylelint-disable color-no-hex */', ':root {']
        block += [f'    {k}: {v};' for k, v in page_vars.items()]
        block += ['}', '/* stylelint-enable color-no-hex */', '']
        # insert after a leading comment block if the file starts with one
        lead = re.match(r'\s*/\*[\s\S]*?\*/\s*', new)
        pos = lead.end() if lead else 0
        new = new[:pos] + nl.join(block) + nl + new[pos:]
    rel = os.path.relpath(path, ROOT).replace('\\', '/')
    print(f'{rel}: exact {stats["exact"]} · near {stats["near"]} · far {stats["far"]} → {len(page_vars)} page vars'
          + ('' if not page_vars else '  [' + ', '.join(f'{k}={v}' for k, v in list(page_vars.items())[:6]) + (', …' if len(page_vars) > 6 else '') + ']'))
    if not DRY and new != raw:
        open(path, 'wb').write(new.encode('utf-8'))

for p in [a for a in sys.argv[1:] if not a.startswith('--')]:
    process(p)
