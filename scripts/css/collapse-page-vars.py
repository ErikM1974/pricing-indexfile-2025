"""App-wide, zero-visual collapse: every page-theme variable (inside a sheet's stylelint-disable color-no-hex block)
whose hex equals a token in tokens.css is removed, and its uses `var(--page-var)` become `var(--token)`.
Value-identical by construction (both resolve to the same hex on every page that loads tokens.css — locked).
Usage: collapse-page-vars.py [--dry]   (run from the repo root; prints per-sheet counts)"""
import re, subprocess, os, sys, collections

DRY = '--dry' in sys.argv
def expand(h):
    h = h.lower()
    return '#' + ''.join(c * 2 for c in h[1:]) if len(h) == 4 else h

tok = re.sub(r'/\*[\s\S]*?\*/', '', open('shared_components/css/tokens.css', encoding='utf-8').read())
tokens = {}
for m in re.finditer(r'(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\b', tok):
    tokens.setdefault(expand(m.group(2)), m.group(1))   # first definition wins (ramps precede semantic aliases)

files = [f for f in subprocess.run(['git', 'ls-files', '*.css'], capture_output=True, text=True).stdout.split()
         if os.path.exists(f) and not re.search(r'^(dist|node_modules|tests)/|/(vendor|archive)/|\.min\.css$', f)
         and not f.endswith('tokens.css')]
THEME = re.compile(r'(/\* stylelint-disable color-no-hex \*/)([\s\S]*?)(/\* stylelint-enable color-no-hex \*/)')
total_vars = total_uses = 0; sheets = 0; by_token = collections.Counter()
for f in files:
    raw = open(f, 'rb').read().decode('utf-8')
    m = THEME.search(raw)
    if not m: continue
    block = m.group(2)
    mapping = {}
    for d in re.finditer(r'^([ \t]*)(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;[^\r\n]*\r?\n', block, re.M):
        h = expand(d.group(3))
        if h in tokens and tokens[h] != d.group(2):
            mapping[d.group(2)] = tokens[h]
    if not mapping: continue
    # 1. drop the declarations from the theme block
    new_block = block
    for name in mapping:
        new_block = re.sub(r'^[ \t]*' + re.escape(name) + r':\s*#[0-9a-fA-F]{3,6}\s*;[^\r\n]*\r?\n', '', new_block, flags=re.M)
    new = raw[:m.start(2)] + new_block + raw[m.end(2):]
    # 2. rewrite the uses everywhere in the sheet (var(--name) and var(--name, fallback))
    uses = 0
    for name, tokn in mapping.items():
        new, n = re.subn(r'var\(' + re.escape(name) + r'(?=[,)])', 'var(' + tokn, new)
        uses += n; by_token[tokn] += 1
    # 3. an emptied :root { } inside the theme block: leave it (stylelint block-no-empty) -> remove empty :root
    new = re.sub(r':root\s*\{\s*\}\r?\n?', '', new)
    total_vars += len(mapping); total_uses += uses; sheets += 1
    print(f'{f}: {len(mapping)} vars -> tokens, {uses} uses rewritten')
    if not DRY:
        open(f, 'wb').write(new.encode('utf-8'))
print(f'\n{sheets} sheets, {total_vars} page vars collapsed, {total_uses} uses rewritten')
print('top tokens:', by_token.most_common(12))
