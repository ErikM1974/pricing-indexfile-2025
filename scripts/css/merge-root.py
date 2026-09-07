"""If a sheet has the tokenizer's page-theme :root block AND a pre-existing top-level :root block, merge the page
vars into the existing block (at its start) and move the stylelint-disable/enable comments to wrap that block, so
no-duplicate-selectors is satisfied without changing the cascade (custom properties on :root are order-independent
unless redefined, and the names are unique).
    python merge-root.py <file.css> [...]
"""
import re, sys
sys.stdout.reconfigure(encoding='utf-8')
BLOCK = re.compile(r'/\* Page theme \(CSS standardization[\s\S]*?\*/\r?\n/\* stylelint-disable color-no-hex \*/\r?\n:root \{\r?\n([\s\S]*?)\}\r?\n/\* stylelint-enable color-no-hex \*/\r?\n\r?\n?')
for p in sys.argv[1:]:
    raw = open(p, 'rb').read().decode('utf-8'); nl = '\r\n' if '\r\n' in raw else '\n'
    m = BLOCK.search(raw)
    if not m: print(f'{p}: no page-theme block'); continue
    rest = raw[:m.start()] + raw[m.end():]
    r2 = re.search(r'(^|\n)([ \t]*):root\s*\{', rest)
    if not r2: print(f'{p}: single :root, nothing to merge'); continue
    vars_block = m.group(1).rstrip('\r\n')
    header = ('/* Page theme (CSS standardization, 2026-09-07): this page\'s own colours, auto-named by hue, merged into its' + nl +
              '   existing :root. Map them to shared_components/css/tokens.css names when the page is redesigned;' + nl +
              '   raw hex is allowed ONLY in this block. */' + nl + '/* stylelint-disable color-no-hex */' + nl)
    # insert header before the existing :root and the vars right after its opening brace
    start = r2.start() + len(r2.group(1))
    brace_end = r2.end()
    new = rest[:start] + header + rest[start:brace_end] + nl + vars_block + nl + rest[brace_end:]
    # find the end of that :root block and add the enable comment after it
    i, depth = new.find('{', start + len(header)), 1; i += 1
    while depth:
        if new[i] == '{': depth += 1
        elif new[i] == '}': depth -= 1
        i += 1
    tail_nl = nl if new[i:i + 2] != nl else ''
    new = new[:i] + nl + '/* stylelint-enable color-no-hex */' + tail_nl + new[i:]
    open(p, 'wb').write(new.encode('utf-8'))
    print(f'{p}: merged {vars_block.count("--")} vars into the existing :root')
