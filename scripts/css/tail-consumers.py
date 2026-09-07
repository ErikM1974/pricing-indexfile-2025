"""For every served sheet that still carries a raw hex outside the token files / theme blocks, list the pages
that link it by PATH (an href resolved against the page's directory), not by basename."""
import re, subprocess, os, posixpath

files = subprocess.run(['git', 'ls-files', '*.css'], capture_output=True, text=True, encoding='utf-8').stdout.split()
sheets = []
for f in files:
    if not os.path.exists(f) or re.search(r'^(dist|node_modules|tests)/|/(vendor|archive)/|\.min\.css$', f) or f.endswith('/tokens.css'):
        continue
    src = open(f, encoding='utf-8', errors='ignore').read()
    src = re.sub(r'/\* stylelint-disable color-no-hex \*/[\s\S]*?/\* stylelint-enable color-no-hex \*/', '', src)
    src = re.sub(r'/\*[\s\S]*?\*/', '', src)
    if re.search(r'(?<![&\w-])#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z_-])', src):
        sheets.append(f)
pages = [h for h in subprocess.run(['git', 'ls-files', '*.html'], capture_output=True, text=True, encoding='utf-8').stdout.split()
         if not re.search(r'^(dist|node_modules|tests|templates)/|/archive/', h)]
links = {}
for p in pages:
    html = open(p, encoding='utf-8', errors='ignore').read()
    for m in re.finditer(r'href="([^"]*\.css)[^"]*"', html):
        u = m.group(1)
        if u.startswith('http'): continue
        rel = u[1:] if u.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(p), u))
        links.setdefault(rel, []).append(p)
print(len(sheets), 'sheets')
for s in sheets:
    users = links.get(s, [])
    n = sum(1 for _ in open(s, encoding='utf-8', errors='ignore'))
    print(f'{s} ({n} lines) <- {len(users)}: {" ".join(users[:5])}{" …" if len(users) > 5 else ""}')
