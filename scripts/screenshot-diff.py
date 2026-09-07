"""Pixel-diff before-*.png vs after-*.png in tests/e2e/screenshots (pairs by name).

Workflow (proved on the 2026-09-06 inline-style extraction and the <main> landmark pass, 96 pages, 91 identical):
    1. SHOT_TAG=before SHOT_PAGES_FILE=<list> npx playwright test --config tests/e2e/playwright.config.js builder-screenshots
    2. make the CSS/markup change; node scripts/build.js (the server serves hashed dist)
    3. SHOT_TAG=after  SHOT_PAGES_FILE=<list> npx playwright test --config tests/e2e/playwright.config.js builder-screenshots
    4. python scripts/screenshot-diff.py
Prints pages, identical count, and for each differing page the changed-pixel count, size change and bounding box.
Known benign diffs: loaded-at timestamps, random shuffles (team-match-game), async content the after-shot caught mid-load
(christmas-bundles grid, Caspio DataPage embeds) — re-check those in a browser rather than trusting either frame.
Requires Pillow (pip install pillow).
"""
import os, sys
from PIL import Image, ImageChops
sys.stdout.reconfigure(encoding='utf-8')
D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tests', 'e2e', 'screenshots')
rows = []
for f in sorted(os.listdir(D)):
    if not f.startswith('before-'): continue
    g = 'after-' + f[len('before-'):]
    if not os.path.exists(os.path.join(D, g)): rows.append((f, 'NO AFTER', '', '')); continue
    a = Image.open(os.path.join(D, f)).convert('RGB'); b = Image.open(os.path.join(D, g)).convert('RGB')
    if a.size != b.size: rows.append((f, 'SIZE', a.size, b.size)); continue
    diff = ImageChops.difference(a, b).convert('L').point(lambda v: 255 if v > 16 else 0)
    n = sum(1 for v in diff.getdata() if v)
    rows.append((f, n, a.size, diff.getbbox()))
print('pages', len(rows), 'identical', sum(1 for r in rows if r[1] == 0))
for r in rows:
    if r[1] != 0: print(*r)
