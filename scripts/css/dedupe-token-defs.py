"""For each sheet: custom properties it DEFINES whose name tokens.css also defines. Identical value (hex compared
case-insensitively, #fff == #ffffff, whitespace collapsed) -> the sheet's line is removed (tokens.css loads first, so
the page resolves the same value). Different value -> kept and reported (it shadows the token on that page).
    python dedupe-token-defs.py <sheet.css> [...]
"""
import re, sys, os
sys.stdout.reconfigure(encoding='utf-8')
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))  # the repo root, wherever it is cloned
tok = re.sub(r'/\*[\s\S]*?\*/', '', open(os.path.join(ROOT, 'shared_components/css/tokens.css'), encoding='utf-8').read())
def norm(v):
    v = ' '.join(v.split()).lower().rstrip(';').strip()
    m = re.fullmatch(r'#([0-9a-f]{3})', v)
    return '#' + ''.join(c * 2 for c in m.group(1)) if m else v
tokens = {m.group(1): norm(m.group(2)) for m in re.finditer(r'(--[a-z0-9-]+)\s*:\s*([^;]+);', tok)}
DEF = re.compile(r'^([ \t]*)(--[a-z0-9-]+)\s*:\s*([^;\r\n]+);[ \t]*(?:/\*[^\r\n]*\*/)?[ \t]*\r?$', re.M)
for p in sys.argv[1:]:
    raw = open(p, 'rb').read().decode('utf-8')
    removed, kept = [], []
    def sub(m):
        name, val = m.group(2), norm(m.group(3))
        if name not in tokens: return m.group(0)
        if tokens[name] == val:
            removed.append(name); return ''
        kept.append(f'{name} (page {m.group(3).strip()} vs token {tokens[name]})'); return m.group(0)
    new = DEF.sub(sub, raw)
    new = re.sub(r'(\r?\n)(?:\r?\n){2,}', r'\1\1', new)  # collapse the holes
    if new != raw: open(p, 'wb').write(new.encode('utf-8'))
    if removed or kept:
        print(f'{p}: removed {len(removed)} identical [{", ".join(removed[:8])}{"…" if len(removed) > 8 else ""}]'
              + (f'; KEPT (shadow) {len(kept)}: {"; ".join(kept[:6])}' if kept else ''))
