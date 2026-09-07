"""Remove `stylelint-disable-next-line` annotation lines that were inserted INSIDE an existing comment block
(a comment that merely mentions !important). Comment-aware scan: walking the text, a `/*` met while already inside
a comment is a nested opener — the whole annotation line is dropped. Reports per file.
    python fix-nested-annotations.py <file.css> [...]
"""
import re, sys
sys.stdout.reconfigure(encoding='utf-8')
ANN = 'stylelint-disable-next-line'
for p in sys.argv[1:]:
    raw = open(p, 'rb').read().decode('utf-8')
    lines = raw.split('\n')
    drop = set()
    in_comment = False
    for i, line in enumerate(lines):
        j = 0
        while j < len(line):
            if not in_comment:
                k = line.find('/*', j)
                if k < 0: break
                in_comment = True; j = k + 2
            else:
                k = line.find('*/', j)
                nested = line.find('/*', j)
                if nested >= 0 and (k < 0 or nested < k):
                    if ANN in line[nested:]:
                        drop.add(i)
                        # the annotation's own '*/' closes nothing real: skip past it and stay in the outer comment
                        close = line.find('*/', nested + 2)
                        j = (close + 2) if close >= 0 else len(line)
                        continue
                if k < 0: break
                in_comment = False; j = k + 2
    if drop:
        out = '\n'.join(l for i, l in enumerate(lines) if i not in drop)
        open(p, 'wb').write(out.encode('utf-8'))
        print(f'{p}: removed {len(drop)} nested annotation line(s) at {sorted(i + 1 for i in drop)}')
