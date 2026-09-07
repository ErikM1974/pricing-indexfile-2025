"""CSS standardization census — the numbers the 2026-09 cleanup is measured against.

    python scripts/css-census.py            # summary
    python scripts/css-census.py --top 30   # also list the 30 most-used hex colours and the most-duplicated rule bodies

Counts every tracked stylesheet outside dist/ node_modules/ tests/ vendor/ archive/: total size, files using
CSS variables, !important declarations, distinct hex colours, font families, and rule bodies that appear in
5+ files (the duplication the shared component layer should absorb). Re-run after each migrated family; the
targets are in memory/CSS_STANDARDIZATION_PLAN_2026-09.md.
"""
import re, subprocess, sys, collections
sys.stdout.reconfigure(encoding='utf-8')
TOP = int(sys.argv[sys.argv.index('--top') + 1]) if '--top' in sys.argv else 0
files = [f for f in subprocess.check_output(['git', 'ls-files', '*.css'], text=True).split('\n')
         if f and not re.search(r'^(dist|node_modules|tests)/|/vendor/|/archive/', f)]
total = 0; var_files = 0; important = 0
colors = collections.Counter(); blocks = collections.Counter(); fonts = collections.Counter(); raw_color_files = 0
for f in files:
    s = open(f, encoding='utf-8', errors='replace').read(); total += len(s)
    s2 = re.sub(r'/\*[\s\S]*?\*/', '', s)
    if 'var(--' in s2: var_files += 1
    important += s2.count('!important')
    hexes = re.findall(r'#[0-9a-fA-F]{6}\b', s2)
    if hexes: raw_color_files += 1
    for c in hexes: colors[c.lower()] += 1
    for m in re.finditer(r'font-family\s*:\s*([^;]+);', s2): fonts[m.group(1).split(',')[0].strip().strip('\'"').lower()] += 1
    for m in re.finditer(r'\{([^{}]{40,})\}', s2): blocks[re.sub(r'\s+', '', m.group(1))] += 1
dup = [(b, n) for b, n in blocks.items() if n >= 5]
print(f'stylesheets            {len(files)}')
print(f'total size             {total // 1024} KB')
print(f'files using var(--)    {var_files}')
print(f'files with raw hex     {raw_color_files}')
print(f'distinct hex colours   {len(colors)}')
print(f'!important             {important}')
print(f'rule bodies in 5+ files {len(dup)}')
print('font families          ' + ', '.join(f'{k} ({n})' for k, n in fonts.most_common(6)))
if TOP:
    print('\nmost-used colours:'); [print(f'  {c}  {n}') for c, n in colors.most_common(TOP)]
    print('\nmost-duplicated rule bodies:'); [print(f'  x{n}  {b[:110]}') for b, n in sorted(dup, key=lambda x: -x[1])[:TOP]]
