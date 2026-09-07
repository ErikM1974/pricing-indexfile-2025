"""Restore NEAR-mapped custom-property declarations in a sheet's :root to their original hex (from git HEAD),
keeping only EXACT token aliases. Use on sheets whose :root palette is a deliberate design system (the quote
builders' --pnw-* / --builder-* palettes): a near token there re-tints every panel that reads the variable.
Usage: restore-near-root.py <sheet>...   (run from the repo root; prints what it restored)"""
import re, subprocess, sys

def expand(h):
    h = h.lower()
    return '#' + ''.join(c * 2 for c in h[1:]) if len(h) == 4 else h

tok_src = open('shared_components/css/tokens.css', encoding='utf-8').read()
tokens = {m.group(1): expand(m.group(2)) for m in re.finditer(r'(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\b', tok_src)}

for path in sys.argv[1:]:
    head = subprocess.run(['git', 'show', f'HEAD:{path}'], capture_output=True, text=True, encoding='utf-8').stdout
    orig = {m.group(1): expand(m.group(2)) for m in re.finditer(r'^\s*(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;', head, re.M)}
    raw = open(path, 'rb').read().decode('utf-8')
    restored = []
    def sub(m):
        name, tok = m.group(2), m.group(3)
        if name in orig and tok in tokens and tokens[tok] != orig[name]:
            restored.append(f'{name}: {orig[name]} (was near {tok} {tokens[tok]})')
            return f'{m.group(1)}{name}: {orig[name]};'
        return m.group(0)
    new = re.sub(r'^(\s*)(--[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\)\s*;', sub, raw, flags=re.M)
    if new != raw:
        open(path, 'wb').write(new.encode('utf-8'))
    print(f'{path}: restored {len(restored)}')
    for r in restored: print('   ', r)
