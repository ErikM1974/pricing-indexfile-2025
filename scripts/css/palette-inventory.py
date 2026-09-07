"""Palette inventory for the customer-facing storefront + catalog sheets: every page-theme variable
(--<sheet>-<hue>…: #hex) with its use count, the nearest token and the per-channel distance, and every
token used. Run from the repo root; prints a table sorted by sheet then use count."""
import re, collections, sys

SHEETS = [
    'shared_components/css/nwca-2026-core.css', 'shared_components/css/nwca-2026.css', 'catalog-search.css',
    'shared_components/css/blog.css', 'product/css/product-2026.css', 'pages/css/catalog-2026.css',
    'shared_components/css/cart-drawer.css', 'brands.css', 'pages/css/fall-catalog-2026.css', 'pages/css/quote-cart.css',
    'pages/css/sample-cart.css', 'pages/css/instant-quote.css', 'pages/css/custom-banners.css',
    'pages/forms/nwca-form-shared.css', 'pages/request-a-quote.css', 'pages/forms/sample-checkout-form.css',
    'pages/css/custom-tees.css', 'pages/css/custom-caps.css', 'pages/css/3-day-tees.css', 'pages/css/customer-login.css',
    'pages/css/customer-portal.css', 'pages/css/customer-product.css', 'pages/css/portal-reorder-list.css',
    'shared_components/css/golf-tournament-showcase.css', 'shared_components/css/golf-tournament-product.css',
    'shared_components/css/safety-stripe-recs.css', 'shared_components/css/embroidery-quote-pricing.css',
]

def expand(h):
    h = h.lower()
    return '#' + ''.join(c * 2 for c in h[1:]) if len(h) == 4 else h
def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def dist(a, b): return max(abs(x - y) for x, y in zip(rgb(a), rgb(b)))

tok_src = open('shared_components/css/tokens.css', encoding='utf-8').read()
tok_src = re.sub(r'/\*[\s\S]*?\*/', '', tok_src)
tokens = {}
for m in re.finditer(r'(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\b', tok_src):
    tokens.setdefault(expand(m.group(2)), m.group(1))
by_name = {v: k for k, v in tokens.items()}

total_vars = 0
for f in SHEETS:
    try:
        src = open(f, encoding='utf-8').read()
    except FileNotFoundError:
        print(f'{f}: MISSING'); continue
    theme = re.search(r'/\* stylelint-disable color-no-hex \*/([\s\S]*?)/\* stylelint-enable color-no-hex \*/', src)
    body = re.sub(r'/\*[\s\S]*?\*/', '', src)
    uses = collections.Counter(m.group(1) for m in re.finditer(r'var\((--[a-z0-9-]+)', body))
    page_vars = {}
    if theme:
        for m in re.finditer(r'(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\b', theme.group(1)):
            page_vars[m.group(1)] = expand(m.group(2))
    tok_uses = {k: n for k, n in uses.items() if k in by_name}
    print(f'\n== {f}: {len(page_vars)} page vars, {len(tok_uses)} distinct tokens used ({sum(tok_uses.values())} uses)')
    for name, hexv in sorted(page_vars.items(), key=lambda kv: -uses.get(kv[0], 0)):
        best = min(tokens, key=lambda t: dist(hexv, t))
        print(f'   {name:42s} {hexv}  x{uses.get(name, 0):<3d} nearest {tokens[best]} {best} d={dist(hexv, best)}')
        total_vars += 1
print(f'\nTOTAL page vars across the storefront/catalog sheets: {total_vars}')
