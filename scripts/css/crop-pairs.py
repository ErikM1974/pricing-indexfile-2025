import sys
from PIL import Image
D = 'tests/e2e/screenshots/'
for spec in sys.argv[1:]:
    name, box = spec.split('@')
    x0, y0, x1, y1 = [int(v) for v in box.split(',')]
    pad = 30
    a = Image.open(D + 'before-' + name + '.png'); b = Image.open(D + 'after-' + name + '.png')
    box2 = (max(0, x0 - pad), max(0, y0 - pad), min(a.width, x1 + pad), min(a.height, y1 + pad))
    ca, cb = a.crop(box2), b.crop(box2)
    out = Image.new('RGB', (ca.width, ca.height * 2 + 6), (255, 0, 255))
    out.paste(ca, (0, 0)); out.paste(cb, (0, ca.height + 6))
    out.save(sys.argv[0].rsplit('/', 1)[0] + '/crop-' + name + '.png')
    print(name, box2)
