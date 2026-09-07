"""Count served stylesheets that still carry a raw hex colour OUTSIDE the two token files and the
stylelint-disable color-no-hex … enable page-theme blocks (comments stripped). Run from the repo root."""
import re, subprocess

files = subprocess.run(['git', 'ls-files', '*.css'], capture_output=True, text=True, encoding='utf-8').stdout.split()
import os
hits = []
for f in files:
    if not os.path.exists(f): continue
    if re.search(r'^(dist|node_modules|tests)/|/(vendor|archive)/|\.min\.css$', f): continue
    if f.endswith('/tokens.css'): continue
    src = open(f, encoding='utf-8', errors='ignore').read()
    src = re.sub(r'/\* stylelint-disable color-no-hex \*/[\s\S]*?/\* stylelint-enable color-no-hex \*/', '', src)
    src = re.sub(r'/\*[\s\S]*?\*/', '', src)
    if re.search(r'(?<![&\w-])#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_-])', src):
        hits.append(f)
print(len(hits), 'served sheets with a raw hex outside the token files and theme blocks')
for h in hits[:20]: print('  ', h)
