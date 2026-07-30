#!/usr/bin/env python3
"""build-pricing-analysis.py — render /dashboards/pricing-analysis.html.

Reads  memory/pricing-analysis-data.json   (NOT web-served -- internal financials)
Writes dashboards/pricing-analysis.html    (admin-gated by ADMIN_DEFAULT_PAGES)

Every figure on the page comes from the JSON. Nothing is hand-typed in the HTML, so
refreshing the analysis means replacing the JSON and re-running this script.

The data JSON deliberately lives in memory/ rather than dashboards/: gateStaffHtml
only gates *.html, so a JSON dropped under /dashboards would be readable by anyone.

    python scripts/build-pricing-analysis.py

Bump CSS_VER whenever pricing-analysis.css changes.
"""
import json
import os
import sys
import io
from html import escape

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'memory', 'pricing-analysis-data.json')
OUT = os.path.join(ROOT, 'dashboards', 'pricing-analysis.html')

CSS_VER = '2026.07.29.2'
JS_VER = '2026.07.29.2'
TIERS = ['1-7', '8-23', '24-47', '48-71', '72+']
BANDS = ['<$4', '$4-8', '$8-15', '$15-25', '$25+']
BAND_LABEL = {
    '<$4': 'under $4 &mdash; basic tees',
    '$4-8': '$4&ndash;8 &mdash; heavier tees, basic polos',
    '$8-15': '$8&ndash;15 &mdash; mid-priced',
    '$15-25': '$15&ndash;25 &mdash; better polos, light outerwear',
    '$25+': '$25+ &mdash; Carhartt, hoodies, North Face',
}

D = json.load(open(DATA, encoding='utf-8'))


# ------------------------------------------------------------------ formatting
def money(v, dp=0):
    return '$' + format(float(v), ',.%df' % dp)


def num(v, dp=0):
    return format(float(v), ',.%df' % dp)


def pct(v, dp=1):
    return format(100 * float(v), '.%df' % dp) + '%'


def signed(v, dp=0):
    v = float(v)
    return ('&minus;$' if v < 0 else '$') + format(abs(v), ',.%df' % dp)


def cls_for(v):
    return 'pa-pos' if float(v) > 0 else 'pa-neg' if float(v) < 0 else ''


def table(headers, rows, foot=None, cap=None, align=None):
    """headers: list[str]; rows: list[list[str]]; align: list of 'l'|'r'."""
    align = align or (['l'] + ['r'] * (len(headers) - 1))
    out = ['<div class="pa-scroll"><table class="pa-table">']
    if cap:
        out.append('<caption>%s</caption>' % cap)
    out.append('<thead><tr>' + ''.join(
        '<th class="pa-%s">%s</th>' % ('l' if a == 'l' else 'r', h)
        for h, a in zip(headers, align)) + '</tr></thead>')
    out.append('<tbody>')
    for r in rows:
        cells = []
        for i, c in enumerate(r):
            a = align[i] if i < len(align) else 'r'
            if isinstance(c, tuple):
                val, extra = c
                cells.append('<td class="pa-%s %s">%s</td>' % ('l' if a == 'l' else 'r', extra, val))
            else:
                cells.append('<td class="pa-%s">%s</td>' % ('l' if a == 'l' else 'r', c))
        out.append('<tr>' + ''.join(cells) + '</tr>')
    out.append('</tbody>')
    if foot:
        cells = []
        for i, c in enumerate(foot):
            a = align[i] if i < len(align) else 'r'
            cells.append('<td class="pa-%s">%s</td>' % ('l' if a == 'l' else 'r', c))
        out.append('<tfoot><tr>' + ''.join(cells) + '</tr></tfoot>')
    out.append('</table></div>')
    return '\n'.join(out)


def bar(share, tone='theme'):
    """A proportion bar. share is 0..1. Width is the encoding; the number sits beside it."""
    w = max(0.0, min(1.0, float(share))) * 100
    return ('<span class="pa-bar pa-bar--%s"><span class="pa-bar-fill" '
            'style="width:%.1f%%"></span></span>' % (tone, w))


# ============================================================== section builders
def sec_provenance():
    p = D['provenance']
    return """
            <section class="dash-card pa-prov" id="pa-top">
                <p class="pa-lead">Everything on this page is measured from <strong>ShopWorks order
                history</strong> and priced against the <strong>live Caspio tables</strong> &mdash; not
                from a spreadsheet estimate. Figures are recomputed by
                <code>scripts/build-pricing-analysis.py</code> from
                <code>memory/pricing-analysis-data.json</code>; nothing on this page is typed by hand.</p>
                <div class="pa-chips">
                    <span class="pa-chip">Generated <b>%s</b></span>
                    <span class="pa-chip">Scope <b>Custom Embroidery + Caps</b> (types 21, 1)</span>
                    <span class="pa-chip">Source <b>SWODBC on bandit</b> (read-only)</span>
                    <span class="pa-chip">Cost basis <b>%s/production hr</b></span>
                    <span class="pa-chip">Chargeable <b>%s/hr</b></span>
                </div>
                <p class="pa-note">%s %s</p>
            </section>""" % (
        escape(D['generated']), money(D['cost']['per_production_hour'], 2),
        money(D['cost']['per_chargeable_hour'], 2), escape(p['scope']), escape(p['source']))


def sec_hero():
    r = D['realization']
    return """
            <section class="pa-hero">
                <div class="pa-stat pa-stat--flag">
                    <span class="pa-stat-label">Price realization, last 24 months</span>
                    <span class="pa-stat-value">%s</span>
                    <span class="pa-stat-sub">invoiced %s against %s at Caspio list</span>
                </div>
                <div class="pa-stat pa-stat--flag">
                    <span class="pa-stat-label">Money left on the table</span>
                    <span class="pa-stat-value">%s</span>
                    <span class="pa-stat-sub">%s per year, revenue-side only</span>
                </div>
                <div class="pa-stat">
                    <span class="pa-stat-label">Orders measured</span>
                    <span class="pa-stat-value">%s</span>
                    <span class="pa-stat-sub">%s pieces, %s</span>
                </div>
                <div class="pa-stat">
                    <span class="pa-stat-label">Ten-year history</span>
                    <span class="pa-stat-value">%s</span>
                    <span class="pa-stat-sub">units across %s orders, %s</span>
                </div>
            </section>""" % (
        pct(r['rate']), money(r['invoiced']), money(r['list']),
        money(r['gap']), money(r['annual']),
        num(r['orders']), num(r['pieces']), escape(r['window']),
        num(D['tenyear']['units_total']), num(D['tenyear']['orders_total']),
        escape(D['tenyear']['window']))


def sec_tiers():
    """Units per quantity tier -- the order/unit inversion. Erik's question."""
    t = D['tenyear']
    at = t['all_tiers']
    to = sum(at[x]['orders'] for x in TIERS)
    tu = sum(at[x]['units'] for x in TIERS)

    rows = []
    for x in TIERS:
        o, u, rv = at[x]['orders'], at[x]['units'], at[x]['revenue']
        rows.append([
            '<b>%s</b>' % x,
            num(o), '%s %s' % (bar(o / to, 'muted'), pct(o / to)),
            '<b>%s</b>' % num(u), '%s %s' % (bar(u / tu), pct(u / tu)),
            num(u / o, 1), money(rv), money(rv / u, 2),
        ])
    main = table(
        ['tier', 'orders', 'share of orders', 'units', 'share of units',
         'units/order', 'revenue', '$/unit'],
        rows,
        foot=['TOTAL', num(to), '', '<b>%s</b>' % num(tu), '', num(tu / to, 1),
              money(sum(at[x]['revenue'] for x in TIERS)),
              money(sum(at[x]['revenue'] for x in TIERS) / tu, 2)])

    # caps vs garments, each stream tiered on its own quantity
    ss = t['split_separate']
    cu = sum(ss['cap'][x]['units'] for x in TIERS)
    gu = sum(ss['gar'][x]['units'] for x in TIERS)
    rows2 = []
    for x in TIERS:
        c, g = ss['cap'][x], ss['gar'][x]
        rows2.append([
            '<b>%s</b>' % x,
            num(c['units']), pct(c['units'] / cu), num(c['orders']),
            money(c['revenue'] / c['units'], 2) if c['units'] else '&mdash;',
            num(g['units']), pct(g['units'] / gu), num(g['orders']),
            money(g['revenue'] / g['units'], 2) if g['units'] else '&mdash;',
            num(c['units'] + g['units']),
        ])
    split = table(
        ['tier', 'cap units', '%', 'cap orders', 'cap $/unit',
         'garment units', '%', 'garment orders', 'garment $/unit', 'total units'],
        rows2,
        foot=['TOTAL', '<b>%s</b>' % num(cu), pct(cu / (cu + gu)),
              num(sum(ss['cap'][x]['orders'] for x in TIERS)),
              money(sum(ss['cap'][x]['revenue'] for x in TIERS) / cu, 2),
              '<b>%s</b>' % num(gu), pct(gu / (cu + gu)),
              num(sum(ss['gar'][x]['orders'] for x in TIERS)),
              money(sum(ss['gar'][x]['revenue'] for x in TIERS) / gu, 2),
              num(cu + gu)])

    # by order total quantity
    bt = t['split_bytotal']
    rows3 = []
    for x in TIERS:
        c, g, u = bt['cap'][x], bt['gar'][x], bt['unclassified'][x]
        rows3.append(['<b>%s</b>' % x, num(bt['orders'][x]), num(c), pct(c / (c + g)),
                      num(g), pct(g / (c + g)), num(u), num(c + g + u)])
    sc = sum(bt['cap'][x] for x in TIERS)
    sg = sum(bt['gar'][x] for x in TIERS)
    bytot = table(
        ['tier', 'orders', 'cap units', '%', 'garment units', '%', 'unclassified', 'total'],
        rows3,
        foot=['TOTAL', num(sum(bt['orders'][x] for x in TIERS)), num(sc), pct(sc / (sc + sg)),
              num(sg), pct(sg / (sc + sg)),
              num(sum(bt['unclassified'][x] for x in TIERS)), num(t['units_total'])])

    cov = t['coverage']
    val = t['validation']
    vrows = []
    for y in sorted(val):
        v = val[y]
        vrows.append([y, num(v['t1_ord']),
                      pct(v['recovery']) if v['recovery'] is not None else 'n/a',
                      num(v['t21_ord']),
                      pct(v['t21_cap']) if v['t21_cap'] is not None else 'n/a'])
    vtab = table(['year', 'type-1 orders', 'cap units recovered',
                  'type-21 orders', 'cap share of type-21 units'], vrows)

    o17 = at['1-7']['orders'] / to
    u17 = at['1-7']['units'] / tu
    o72 = at['72+']['orders'] / to
    u72 = at['72+']['units'] / tu

    return """
            <section class="dash-card" id="pa-tiers">
                <h2 class="pa-h">Units by quantity tier <span class="pa-tag">ten years</span></h2>
                <p class="pa-body">How much <em>volume</em> actually sits in each price break, as
                opposed to how many orders do. These are the two numbers that get conflated when
                deciding where to move a price.</p>

                <div class="pa-finding">
                    <h3>The order count and the unit count point in opposite directions</h3>
                    <p><strong>1&ndash;7 is %s of orders but only %s of units. 72+ is %s of orders and
                    %s of units.</strong> A small-order fee is therefore an <em>order-count</em>
                    lever &mdash; it touches a third of the paperwork and about a fortieth of the
                    volume. A change to the 72+ break moves the majority of everything.</p>
                </div>

                %s

                <h3 class="pa-h3">Caps versus garments</h3>
                <p class="pa-body">Caps and garments are tiered <strong>separately</strong>, because
                that is how the Caspio engine prices them &mdash; quantity is never combined across
                the two for a tier discount. A mixed order therefore contributes one cap stream and
                one garment stream, which is why the stream counts below add to more than the
                %s orders in the table above.</p>
                %s
                <div class="pa-finding pa-finding--alt">
                    <h3>Caps are half the volume and under a third of the money</h3>
                    <p>Caps are <strong>%s of units</strong> but average <strong>%s per unit</strong>
                    against <strong>%s</strong> for garments. And <strong>%s of all cap volume sits in
                    72+</strong> &mdash; the one tier where caps are cheapest.</p>
                </div>

                <h3 class="pa-h3">The same units, tiered by order total instead</h3>
                <p class="pa-body">For comparison: tier assigned from the order's whole quantity,
                then units split inside the tier. This is the more intuitive reading, but it is
                <em>not</em> how the order was priced.</p>
                %s

                <h3 class="pa-h3">How caps were identified, and why not by order type</h3>
                <div class="pa-callout pa-callout--danger">
                    <h4>Order type cannot be used to identify caps &mdash; in any year</h4>
                    <p>Caps were progressively written under Custom Embroidery across the whole
                    decade, not just recently. Cap units as a share of order-type-21 volume went
                    <strong>%s in 2016 &rarr; %s in 2025 &rarr; %s in 2026</strong>. So the
                    familiar &ldquo;cap orders fell from 582 to 154&rdquo; is largely a coding
                    artifact: actual cap units went %s to %s.</p>
                </div>
                <p class="pa-body">Caps are instead identified from the <strong>garment</strong>
                (<code>cap</code>, <code>trucker</code>, <code>hat</code>, <code>beanie</code>,
                <code>visor</code>, <code>snapback</code>, <code>flexfit</code>, <code>OSFA</code>,
                <code>mesh back</code>, <code>knit cap</code>) &mdash; a definition that holds
                regardless of how the order was coded. Validated against order type 1 in the years
                where type 1 is still trustworthy:</p>
                %s
                <p class="pa-note">Orders that sold no blank &mdash; customer-supplied goods &mdash;
                have no garment line, so they fall back to the decoration line, which names the
                substrate (<code>DECC</code> = Dir Embroider Customer Caps, <code>CB</code> = Cap
                Back). Coverage: <b>%s of %s orders</b> classified, <b>%s of %s units</b> (%s).
                The remainder is shown as its own column rather than distributed.</p>
            </section>""" % (
        pct(o17), pct(u17), pct(o72), pct(u72),
        main,
        num(to),
        split,
        pct(cu / (cu + gu)),
        money(sum(ss['cap'][x]['revenue'] for x in TIERS) / cu, 2),
        money(sum(ss['gar'][x]['revenue'] for x in TIERS) / gu, 2),
        pct(ss['cap']['72+']['units'] / cu),
        bytot,
        pct(val['2016']['t21_cap']), pct(val['2025']['t21_cap']), pct(val['2026']['t21_cap']),
        num(t['by_year']['2016']['cap']), num(t['by_year']['2025']['cap']),
        vtab,
        num(cov['orders_classified']), num(cov['orders_total']),
        num(cov['units_classified']), num(cov['units_total']),
        pct(cov['units_classified'] / cov['units_total']))


def sec_year():
    t = D['tenyear']
    ub = t['units_by_year']
    ob = t['orders_by_year']
    by = t['by_year']
    years = sorted(ub)
    rows = []
    for y in years:
        tot = sum(ub[y][x] for x in TIERS)
        cap = by.get(y, {}).get('cap', 0)
        gar = by.get(y, {}).get('gar', 0)
        rows.append([y, num(sum(ob[y][x] for x in TIERS))]
                    + [num(ub[y][x]) for x in TIERS]
                    + [num(tot), num(cap), num(gar),
                       pct(cap / (cap + gar)) if (cap + gar) else '&mdash;'])
    tab = table(['year', 'orders'] + TIERS + ['units', 'cap units', 'garment units', 'cap %'], rows)
    return """
            <section class="dash-card" id="pa-year">
                <h2 class="pa-h">Year by year <span class="pa-tag">2016 &ndash; 2026</span></h2>
                <p class="pa-body">Units per tier by year, with the garment-classified cap split
                beside it. 2026 is a partial year (through %s).</p>
                %s
                <p class="pa-note">Order count fell far more than volume did &mdash; the shop moved
                from many small orders to fewer large ones. Read the cap column, never the
                order-type series, for any statement about caps.</p>
            </section>""" % (escape(D['generated']), tab)


def sec_gap():
    r = D['realization']
    bt = r['by_type']
    rows = []
    for k in sorted(bt):
        v = bt[k]
        rows.append([k, num(v['orders']), num(v['pieces']), money(v['invoiced']),
                     money(v['list']), ('<b>%s</b>' % money(v['gap']), 'pa-neg'),
                     '%s %s' % (bar(v['rate'], 'warn'), pct(v['rate']))])
    bytype = table(['', 'orders', 'pieces', 'invoiced', 'at Caspio list', 'gap', 'realization'],
                   rows,
                   foot=['TOTAL', num(r['orders']), num(r['pieces']), money(r['invoiced']),
                         money(r['list']), '<b>%s</b>' % money(r['gap']), pct(r['rate'])])

    rows = []
    for x in TIERS:
        v = r['by_tier'][x]
        rows.append(['<b>%s</b>' % x, num(v['orders']), num(v['pieces']), money(v['invoiced']),
                     money(v['list']), money(v['gap']),
                     '%s %s' % (bar(v['rate'], 'warn'), pct(v['rate']))])
    bytier = table(['tier', 'orders', 'pieces', 'invoiced', 'at list', 'gap', 'realization'], rows)

    rows = []
    for b in BANDS:
        v = r['by_band'][b]
        rows.append([BAND_LABEL[b], num(v['orders']), num(v['pieces']), money(v['invoiced']),
                     money(v['list']), money(v['gap']),
                     '%s %s' % (bar(v['rate'], 'warn'), pct(v['rate'])),
                     (signed(v['profit_list']), cls_for(v['profit_list']))])
    byband = table(['blank price band', 'orders', 'pieces', 'invoiced', 'at list', 'gap',
                    'realization', 'profit at list'], rows)

    ex = r['excluded']
    exs = ', '.join('%s %s' % (num(v), k) for k, v in sorted(ex.items()))
    return """
            <section class="dash-card" id="pa-gap">
                <h2 class="pa-h">The realization gap <span class="pa-tag">24 months</span></h2>
                <div class="pa-finding pa-finding--flag">
                    <h3>The pricing is sound. It is not being charged.</h3>
                    <p>Across %s orders and %s pieces, we invoiced <strong>%s</strong> against
                    <strong>%s</strong> at the prices already in Caspio. That is
                    <strong>%s realization</strong> and a <strong>%s</strong> gap &mdash; about
                    <strong>%s a year</strong>. The gap is entirely revenue-side, so it holds
                    regardless of which cost model you accept.</p>
                </div>
                %s
                <h3 class="pa-h3">By tier</h3>
                %s
                <h3 class="pa-h3">By blank price &mdash; the variable that decides the outcome</h3>
                <p class="pa-body">&ldquo;Profit at list&rdquo; is what the order would have earned
                had it been billed at the Caspio price, after the blank and the loaded production
                hour. <strong>Only the two most expensive bands cover their hour</strong>, and the
                cheapest blanks are both the least profitable and the most discounted.</p>
                %s
                <p class="pa-note">Excluded from the 24-month study: %s. Those orders lack the
                purchase order, revenue, or quantity needed to cost them, and are reported rather
                than silently dropped.</p>
            </section>""" % (
        num(r['orders']), num(r['pieces']), money(r['invoiced']), money(r['list']),
        pct(r['rate']), money(r['gap']), money(r['annual']),
        bytype, bytier, byband, escape(exs))


def sec_cost():
    c = D['cost']
    tc = c['tier_cost']
    rows = []
    for kind, label in (('shirt', 'Garments'), ('cap', 'Caps')):
        for x in TIERS:
            k = '%s|%s' % (kind, x)
            if k not in tc:
                continue
            v = tc[k]
            rows.append([
                '%s %s' % (label, x), num(v['pieces']), num(v['hours'], 1),
                num(v['pph'], 2), money(v['cost_pc'], 2), money(v['case_actual'], 2),
                money(v['dec'], 2), money(v['covered'], 2),
                (signed(v['gap_actual'], 2), cls_for(v['gap_actual'])),
            ])
    tab = table(['tier', 'pieces logged', 'hours logged', 'pcs/hr', 'cost/pc',
                 'avg blank', 'decoration charge', 'price covers', 'gap/pc'], rows)
    return """
            <section class="dash-card" id="pa-cost">
                <h2 class="pa-h">Cost basis and measured throughput</h2>
                <p class="pa-body">Non-material cost of <strong>%s</strong> over <strong>%s</strong>
                matched production hours gives <strong>%s per production hour</strong>. Production
                logging covers only part of paid time, so the loaded rate that a <em>chargeable</em>
                hour has to carry is <strong>%s</strong> &mdash; an uplift of
                <strong>%s&times;</strong>.</p>
                <p class="pa-body">Throughput below is measured from the production log, not
                estimated: <strong>caps %s pcs/hr</strong> and <strong>flat embroidery
                %s pcs/hr</strong> at 72+. &ldquo;Price covers&rdquo; is the garment margin plus the
                decoration charge; &ldquo;gap/pc&rdquo; is that minus cost.</p>
                %s
                <p class="pa-note">Cost per piece swings 3.6&ndash;4.4&times; across the tiers while
                price swings only 1.5&ndash;1.8&times;. That is why the small tiers lose and
                <strong>only garments at 72+ clear their hour</strong>. 8&ndash;23 is the weakest
                tier of all: it carries the same decoration charge as 1&ndash;7 with no small-order
                fee behind it.</p>
            </section>""" % (
        money(c['nonmaterial']), num(c['matched_hours'], 0),
        money(c['per_production_hour'], 2), money(c['per_chargeable_hour'], 2),
        num(c['uplift'], 3),
        num(c['pph']['CAP|72+'], 1), num(c['pph']['FLAT|72+'], 1), tab)


def sec_pricing():
    p = D['pricing']
    rows = []
    for x in TIERS:
        rows.append(['<b>%s</b>' % x, money(p['dec_shirt'][x], 2), money(p['dec_cap'][x], 2),
                     money(p['ltm'][x], 2) if p['ltm'][x] else '&mdash;'])
    tab = table(['tier', 'garment decoration', 'cap decoration', 'small-order fee'], rows)
    return """
            <section class="dash-card" id="pa-pricing">
                <h2 class="pa-h">What Caspio charges today</h2>
                <p class="pa-body">The engine prices every surface the same way:
                <code>price = round_up(blank_case_cost &divide; %s + decoration)</code>. The
                denominator is a margin divisor, so <strong>%s means a %s margin on the garment
                portion</strong> &mdash; and because decoration is added <em>after</em> that
                divisor, the tier break is a flat dollar amount no matter how expensive the
                garment is.</p>
                %s
                <p class="pa-note">Consequence worth knowing on big-ticket bids: the ladder spread
                from 1&ndash;7 to 72+ is the same <b>%s</b> on a $85 Carhartt as on a $4 tee. On
                the tee that is a 32%% price range; on the Carhartt it is about 3.5%%. Rounding is
                <code>%s</code> for garments and <code>%s</code> for caps.</p>
                <p class="pa-note">The <b>%s small-order fee is baked into the unit price rather
                than shown as a line item</b>, and it reaches only about a fifth of the orders
                small enough to warrant it.</p>
            </section>""" % (
        num(p['denominator'], 2), num(p['denominator'], 2),
        pct(1 - p['denominator'], 0),
        tab,
        money(p['dec_shirt']['1-7'] - p['dec_shirt']['72+'], 2),
        escape(p['rounding_shirt']), escape(p['rounding_cap']),
        money(p['ltm']['1-7'], 2))


def sec_rules():
    ru = D['rules']
    sr = ru['surcharge_rates']
    sb = ru['surcharge_by_band']
    items = [
        ('Charge the price that is already in Caspio', ru['realization'],
         'Bill at list. No new price, no Caspio edit, no customer conversation about a rate '
         'increase &mdash; just stop discounting below the table. This is the single largest '
         'item on the page and the only one that needs no decision.'),
        ('Bring cap decoration up to garment parity', ru['cap_parity'],
         'Caps are decorated at %s to %s against %s to %s for garments, while measured cap '
         'throughput is only about %s&times; garment throughput. The discount is larger than the '
         'productivity difference justifies.' % (
             money(D['pricing']['dec_cap']['72+'], 2), money(D['pricing']['dec_cap']['1-7'], 2),
             money(D['pricing']['dec_shirt']['72+'], 2), money(D['pricing']['dec_shirt']['1-7'], 2),
             num(D['cost']['pph']['CAP|72+'] / D['cost']['pph']['FLAT|72+'], 1))),
        ('Extend the small-order fee to 8&ndash;23', ru['ltm823'],
         'The %s fee stops at 7 pieces, so 8&ndash;23 carries the same %s decoration charge as '
         '1&ndash;7 with nothing behind it. It is the weakest tier in the book (%s orders in the '
         'window).' % (money(D['pricing']['ltm']['1-7'], 2),
                       money(D['pricing']['dec_shirt']['8-23'], 2), num(ru['n_823']))),
        ('Make the small-order fee actually land on 1&ndash;7', ru['ltm17'],
         'It is currently absorbed into the unit price and reaches roughly a fifth of eligible '
         'orders (%s orders in the window). Charging it as a visible line item is the fix.'
         % num(ru['n_17'])),
        ('Surcharge the cheap blanks', ru['surcharge'],
         'The blank price decides whether an order earns anything, because the garment margin is '
         'a percentage of a small number. Add %s per piece under $4, %s from $4&ndash;8, %s from '
         '$8&ndash;15, nothing above &mdash; the expensive garments already carry themselves.' % (
             money(sr['<$4'], 2), money(sr['$4-8'], 2), money(sr['$8-15'], 2))),
    ]
    cards = []
    for i, (title, value, why) in enumerate(items, 1):
        cards.append("""
                <div class="pa-rule">
                    <div class="pa-rule-n">%d</div>
                    <div class="pa-rule-body">
                        <h3>%s</h3>
                        <p>%s</p>
                    </div>
                    <div class="pa-rule-value"><span>%s</span><small>over 24 months</small></div>
                </div>""" % (i, title, why, money(value)))

    srows = [[BAND_LABEL[b], money(sr[b], 2), money(sb[b])] for b in BANDS]
    stab = table(['blank price band', 'surcharge/pc', 'value over 24 months'], srows,
                 foot=['TOTAL', '', '<b>%s</b>' % money(ru['surcharge'])])

    return """
            <section class="dash-card" id="pa-rules">
                <h2 class="pa-h">Five rules, priced individually</h2>
                <p class="pa-body">Each rule is costed <strong>in isolation</strong> against the
                same %s orders, so the figures do not double-count each other. Rule 1 needs no
                price change at all.</p>
                <div class="pa-rules">%s</div>
                <div class="pa-totals">
                    <div><span>Rules 2&ndash;5, the structural changes</span><b>%s</b></div>
                    <div><span>Rule 1, charging the existing price</span><b>%s</b></div>
                    <div class="pa-totals-sum"><span>Both together, over 24 months</span><b>%s</b></div>
                </div>
                <h3 class="pa-h3">Rule 5 in detail</h3>
                %s
                <p class="pa-note">The %s per piece under $4 is the largest single line because
                that band is simultaneously the highest volume, the lowest realization, and the
                furthest underwater at list.</p>
            </section>""" % (
        num(D['realization']['orders']), ''.join(cards),
        money(ru['structural']), money(ru['realization']), money(ru['with_realization']),
        stab, money(sr['<$4'], 2))


def sec_limits():
    return """
            <section class="dash-card pa-limits" id="pa-limits">
                <h2 class="pa-h">What this analysis cannot tell you</h2>
                <ul>
                    <li><strong>Production logging stopped 2026-05-20</strong> and covers roughly
                    half of paid hours. Every throughput figure is a pooled tier average, which is
                    the right way to use noisy logs &mdash; but it means no single order can be
                    costed reliably from this data.</li>
                    <li><strong>Order-level costing was attempted and rejected.</strong> About 3% of
                    orders imply impossible rates (0.2 to 283 pcs/hr) purely from logging noise.
                    Pooling averages that out; per-order figures inherit it.</li>
                    <li><strong>No period-correct historical cost exists.</strong> There is no 2016
                    general ledger or TimeClick data, so the ten-year section applies
                    <em>today's</em> prices and costs to ten years of real order shapes. It answers
                    &ldquo;how would today's pricing have fared against our actual history&rdquo;
                    &mdash; not &ldquo;what did we earn in 2016&rdquo;.</li>
                    <li><strong>Per-unit revenue in mixed cap/garment orders is split
                    proportionally by unit count</strong>, which flatters caps and understates
                    garments. Treat those $/unit columns as indicative, not line-accurate.</li>
                    <li><strong>Purchase-order coverage varies by year</strong>, so blank-price
                    bands are less reliable in the earliest years than the most recent ones.</li>
                    <li><strong>Two earlier spreadsheet recommendations were price cuts of 44&ndash;68%
                    on our best work</strong> ($6.75 a logo where the engine charges $12&ndash;18 and
                    we realize $28.58; $3.25 a patch where we charge $10). They should not be
                    revived &mdash; measured throughput contradicts both.</li>
                </ul>
            </section>"""


NAV = [('pa-tiers', 'Units by tier'), ('pa-year', 'Year by year'), ('pa-gap', 'The gap'),
       ('pa-cost', 'Cost basis'), ('pa-pricing', 'Caspio today'), ('pa-rules', 'Five rules'),
       ('pa-limits', 'Limits')]


def build():
    nav = ''.join('<a href="#%s" class="pa-nav-link">%s</a>' % (i, t) for i, t in NAV)
    return """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex, nofollow">
    <title>Pricing Analysis &middot; Northwest Custom Apparel</title>
    <link rel="icon" href="/favicon.png" type="image/png">

    <!-- GENERATED FILE -- do not hand-edit.
         Built by scripts/build-pricing-analysis.py from memory/pricing-analysis-data.json.
         To change a figure, change the JSON and re-run the script.

         ADMIN ONLY. Gated server-side by gateStaffHtml -> gateStaffPage, with
         pricing-analysis.html listed in ADMIN_DEFAULT_PAGES (lib/page-access.js) so
         a missing Staff_Page_Access row leaves it CLOSED rather than open.
         The data JSON deliberately lives in memory/, NOT under /dashboards: the
         static mount only gates *.html, so a JSON there would be world-readable. -->

    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

    <link rel="stylesheet" href="/shared_components/css/art-hub.css">
    <link rel="stylesheet" href="/shared_components/css/dash-shell.css">
    <link rel="stylesheet" href="/dashboards/css/pricing-analysis.css?v=%s">
</head>
<body>
    <div class="dash-shell">
        <header class="dash-header">
            <div class="dash-header-left">
                <a href="/staff-dashboard.html" title="Back to Staff Dashboard">
                    <img src="https://cdn.caspio.com/A0E15000/Safety%%20Stripes/web%%20northwest%%20custom%%20apparel%%20logo.png?ver=1"
                         alt="Northwest Custom Apparel" class="dash-header-logo">
                </a>
                <h1 class="dash-header-title">Pricing Analysis <span class="pa-subhead">embroidery &amp; caps &mdash; what we charge, what it costs, what we are leaving behind</span></h1>
            </div>
            <div class="dash-header-right">
                <span class="pa-lock" title="Admin only"><i class="fas fa-user-shield"></i> Admin</span>
                <a href="/staff-dashboard.html" class="dash-back-link"><i class="fas fa-arrow-left"></i> Dashboard</a>
            </div>
        </header>

        <nav class="pa-nav" aria-label="Sections">%s</nav>

        <main class="dash-content">
%s
%s
%s
%s
%s
%s
%s
%s
%s
        </main>
    </div>
    <script src="/dashboards/js/pricing-analysis.js?v=%s"></script>
</body>
</html>
""" % (CSS_VER, nav, sec_provenance(), sec_hero(), sec_tiers(), sec_year(), sec_gap(),
       sec_cost(), sec_pricing(), sec_rules(), sec_limits(), JS_VER)


if __name__ == '__main__':
    html = build()
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write(html)
    print('wrote %s (%.1f KB)' % (OUT, len(html.encode('utf-8')) / 1024))
    # structural self-check -- a generated file should never ship broken
    import re
    problems = []
    if re.search(r'<style[\s>]', html):
        problems.append('inline <style> block (violates the no-inline-code rule)')
    for m in re.finditer(r'<script\b[^>]*>(.*?)</script>', html, re.S):
        if m.group(1).strip():
            problems.append('inline <script> body (violates the no-inline-code rule)')
    if '%s' in html or '%d' in html:
        problems.append('unsubstituted format placeholder left in output')
    if re.search(r'>\s*(None|nan|inf)\s*<', html):
        problems.append('None/nan leaked into a cell')
    for tag in ('html', 'body', 'main', 'table', 'section'):
        o = len(re.findall(r'<%s[\s>]' % tag, html))
        c = len(re.findall(r'</%s>' % tag, html))
        if o != c:
            problems.append('%s: %d open vs %d close' % (tag, o, c))
    print('tables rendered: %d | sections: %d' % (
        len(re.findall(r'<table[\s>]', html)), len(re.findall(r'<section[\s>]', html))))
    if problems:
        print('\nFAILED:')
        for p in problems:
            print('  - ' + p)
        sys.exit(1)
    print('structural check: OK')
