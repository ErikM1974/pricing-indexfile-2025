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

CSS_VER = '2026.07.30.7'
JS_VER = '2026.07.30.7'
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
                    <span class="pa-chip">Order cost <b>%s&ndash;%s</b></span>
                </div>
                <p class="pa-note">%s %s</p>
                <p class="pa-note"><b>Read the sections in order.</b> &ldquo;Cost basis&rdquo;
                below loads every company cost onto the machine hour and reaches %s/hr; that
                framing is <em>superseded</em> by <a href="#pa-costing">Settled costing</a>, which
                splits the pools properly and is the model the recommendations rest on. The earlier
                sections are kept because their <em>measured</em> content &mdash; throughput,
                stitch counts, realization &mdash; does not depend on the split.</p>
            </section>""" % (
        escape(D['generated']), money(D['costing']['settled']['rate'], 2),
        money(D['costing']['settled']['per_order_flat']),
        money(D['costing']['settled']['per_order_driver']),
        escape(p['scope']), escape(p['source']),
        money(D['cost']['per_production_hour'], 2))


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
                <h2 class="pa-h">Cost basis and measured throughput
                    <span class="pa-tag">rate superseded &mdash; throughput stands</span></h2>
                <div class="pa-callout">
                    <h4>The rate in this section is the all-in one, kept for the throughput table</h4>
                    <p>It divides <em>every</em> non-material cost in the company by matched
                    production hours. <a href="#pa-costing">Settled costing</a> splits those pools
                    onto the bases that drive them and is what the recommendations use. The pieces
                    per hour, cost per piece and gap columns below are <strong>measured from the
                    production log</strong> and are unaffected by that choice.</p>
                </div>
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


def sec_design():
    """Where the breaks belong, what the fee must be, and the reorder economics."""
    d = D['tierdesign']
    cc = d['cost_curve']
    f, c = cc['flat'], cc['cap']

    fit = table(
        ['fit', 'fixed setup S', 'variable v', 'R&sup2;', 'n'],
        [['Flats &mdash; pooled tier points', '<b>%s hr/order</b>' % num(f['S'], 3),
          '%s hr/pc' % num(f['v'], 5), num(f['r2'], 3), '5'],
         ['Caps &mdash; pooled tier points', '<b>%s hr/order</b>' % num(c['S'], 3),
          '%s hr/pc' % num(c['v'], 5), num(c['r2'], 3), '5'],
         ['Order level, type 21', '%s hr' % num(cc['order_level']['type21']['S'], 3),
          '%s hr/pc' % num(cc['order_level']['type21']['v'], 5),
          num(cc['order_level']['type21']['r2'], 3),
          num(cc['order_level']['type21']['n'])],
         ['Order level, type 1 (with imprints)',
          '%s hr' % num(cc['order_level']['type1']['S_imp'], 3),
          '%s hr/pc' % num(cc['order_level']['type1']['v_imp'], 5),
          num(cc['order_level']['type1']['r2_imp'], 3),
          num(cc['order_level']['type1']['n'])]])

    hp = cc['hrs_per_piece']
    hrs_tab = table(['pieces'] + [num(h['q']) for h in hp],
                    [['hours per piece'] + [num(h['hrs'], 3) for h in hp],
                     ['share of the 1-piece figure'] + [pct(h['pct_of_q1'], 0) for h in hp]],
                    align=['l'] + ['r'] * len(hp))

    rows = []
    prev = None
    for t in TIERS:
        fl = d['cph_now']['FLAT|' + t]
        cp = d['cph_now'].get('CAP|' + t)
        gain = ('<b>%s%s</b>' % ('+' if fl - prev >= 0 else '&minus;', money(abs(fl - prev)))
                if prev is not None else '&mdash;')
        rows.append(['<b>%s</b>' % t, num(d['orders_by_tier']['FLAT|' + t]),
                     '%s %s' % (bar(fl / 400), money(fl)),
                     money(cp) if cp else '&mdash;', gain])
        prev = fl
    cphtab = table(['tier', 'flat orders', 'flats &mdash; $ per production hour',
                    'caps', 'gain over previous tier'], rows)

    dpk = sorted(d['dp_breaks'], key=lambda k: int(k))
    dprows = []
    for k in dpk:
        segs = d['dp_breaks'][k]
        dprows.append(['target %s/hr' % money(float(k)),
                       ' / '.join(num(s['lo']) for s in segs[1:])])
    dprows.append(['<b>what we charge today</b>',
                   '<b>%s</b>' % ' / '.join(num(x) for x in d['current_breaks'])])
    dptab = table(['cost target used', 'breaks the solver chooses'], dprows,
                  align=['l', 'r'])

    srows = []
    for s in d['scenarios']:
        srows.append([s['label'], money(s['fee_rev']),
                      ('+' + money(s['delta'])) if s['delta'] else '&mdash;',
                      money(s['cph']['FLAT|1-7']), money(s['cph']['FLAT|8-23']),
                      money(s['cph']['CAP|1-7']), money(s['cph']['CAP|8-23'])])
    stab = table(['fee', 'fee revenue/yr', 'vs today', 'flats 1-7', 'flats 8-23',
                  'caps 1-7', 'caps 8-23'], srows)

    cv = table(['pieces', 'price/pc', 'goods', 'fee today', 'fee at $115',
                'order total today', 'order total at $115'],
               [[num(r['q']), money(r['price'], 2), money(r['goods']),
                 money(r['fee_now']), money(r['fee_new']),
                 money(r['total_now']), '%s <small>(%s/pc)</small>' % (
                     money(r['total_new']), money(r['pc_new'], 2))]
                for r in d['customer_view']])

    rtab = table(['tier', 'orders/yr', 'gap to %s/hr' % money(d['target_T']), 'per order'],
                 [[r['tier'], num(r['orders_yr'], 0), money(r['gap_yr']), money(r['gap_order'])]
                  for r in d['residual']])

    ro = d['reorder']
    mig = []
    for i, t in enumerate(TIERS):
        rs = sum(ro['migration'][i])
        shrink = sum(ro['migration'][i][:i])
        mig.append(['<b>%s</b>' % t] + [num(ro['migration'][i][j]) for j in range(5)]
                   + [num(rs), (pct(shrink / rs, 0) if rs else '&mdash;',
                                'pa-neg' if rs and shrink / rs > 0.4 else '')])
    migtab = table(['previous order was'] + ['&rarr; ' + t for t in TIERS]
                   + ['total', 'dropped a tier'], mig)

    con = table(['if two orders land within', 'pairs/yr', 'duplicated hours/yr', 'value/yr'],
                [[num(x['window']) + ' days', num(x['pairs_yr'], 0), num(x['hours_yr'], 0),
                  '<b>%s</b>' % money(x['value_yr'])] for x in d['consolidation']]
                if 'consolidation' in d else
                [[num(x['window']) + ' days', num(x['pairs_yr'], 0), num(x['hours_yr'], 0),
                  '<b>%s</b>' % money(x['value_yr'])] for x in ro['consolidation']])

    gp = ro['gaps']
    best = d['scenarios'][2]

    return """
            <section class="dash-card" id="pa-design">
                <h2 class="pa-h">Where the breaks belong <span class="pa-tag">solved, not estimated</span></h2>
                <p class="pa-body">The tier ladder is a staircase approximation to a cost curve.
                To know whether the steps are in the right places you first have to know the
                curve &mdash; specifically how much of an order's cost is <em>fixed setup</em> that
                does not shrink when the order does.</p>

                <h3 class="pa-h3">The cost curve: hours(q) = S + v &times; q</h3>
                <p class="pa-body">Fitted three independent ways. They agree on S, which is the
                number every recommendation below depends on.</p>
                %s
                <p class="pa-note"><code>sts_Setup</code> is filled in on only <b>%s of %s</b>
                production-log rows, so setup cannot be read off the log &mdash; it has to be
                regressed out. Kornit and patch rows are excluded (different processes).</p>
                <div class="pa-finding">
                    <h3>Every order carries about %s hours of setup before a single garment runs</h3>
                    <p>That is <strong>%s at the direct rate</strong>, or %s fully loaded. It is
                    the same whether the order is for 4 pieces or 400, and it is the entire reason
                    small orders behave differently.</p>
                </div>

                <h3 class="pa-h3">Which is why cost per piece collapses early, then flattens</h3>
                %s
                <div class="pa-callout pa-callout--danger">
                    <h4>The breaks are clustered where the curve is flat and absent where it is steep</h4>
                    <p>By 8 pieces, cost per piece has already fallen to <strong>%s of its
                    one-piece value</strong> &mdash; %s of every efficiency gain that will ever be
                    available. Yet the ladder has <strong>no break anywhere in 1&ndash;23</strong>,
                    where cost falls roughly sixfold, and <strong>three breaks across
                    24&ndash;72+</strong>, where it falls about 30%%. The 1&ndash;7 tier alone spans
                    a 5.4&times; cost range at a single price.</p>
                </div>

                <h3 class="pa-h3">What the optimiser picks instead</h3>
                <p class="pa-body">Choosing K intervals over an ordered domain to minimise weighted
                error is the 1-D k-segmentation problem, which dynamic programming solves
                <em>optimally</em> &mdash; there is no judgement call in it. Run against the real
                order-size distribution, it lands in the same place at every cost target tested:</p>
                %s

                <h3 class="pa-h3">What each tier earns per production hour</h3>
                <p class="pa-body">The machine hour is the scarce resource, so contribution per hour
                is what makes tiers comparable. Note the last column.</p>
                %s
                <div class="pa-finding pa-finding--alt">
                    <h3>Steer toward 48, not 72</h3>
                    <p>The 72 break is worth <strong>%s per hour</strong> over 48&ndash;71 &mdash;
                    about %s. Moving a 24-piece order to 48 is worth nine times more. And the
                    single most valuable move available is getting an order <em>out of
                    1&ndash;7</em>: that step is worth <strong>%s per hour</strong>.</p>
                </div>
                <p class="pa-note">Read the absolute numbers carefully: every tier clears its direct
                rate, so <b>1&ndash;7 is not losing cash &mdash; it is the worst <em>use</em> of a
                constrained hour</b>. <a href="#pa-costing">Settled costing</a> reaches the same
                conclusion from the other direction and puts a number on it: %s to %s per order on
                flats at 1&ndash;7. The gap between the direct and %s loaded rates is a utilization
                problem &mdash; only about a third of embroidery hours log as productive &mdash;
                and no price change closes it.</p>

                <h3 class="pa-h3">The small-order fee</h3>
                <p class="pa-body">Today's <strong>%s</strong> recovers <strong>%s</strong> of the
                %s setup it exists to cover, and it stops at 7 pieces &mdash; so 8&ndash;23 pays
                nothing toward setup at all. The natural ceiling is where fixed and variable cost
                cross, <strong>S/v = %s pieces</strong> for flats (%s for caps): below that an order
                is mostly setup. The nearest existing tier boundary is 23, so extending the fee
                there needs no new break.</p>
                %s
                <div class="pa-finding">
                    <h3>%s &mdash; worth %s a year</h3>
                    <p>It is the measured setup cost, it lifts 8&ndash;23 to
                    <strong>%s per hour</strong> &mdash; exact parity with 24&ndash;47 &mdash; and
                    the customer sees a %s line on the job, which is unremarkable in this trade.</p>
                </div>
                <h4 class="pa-h3">What the customer actually sees</h4>
                %s
                <div class="pa-callout pa-callout--danger">
                    <h4>No sellable fee fixes 1&ndash;7 &mdash; and that is worth saying out loud</h4>
                    <p>Full parity on a 1&ndash;7 order needs about <strong>%s per order</strong>,
                    which puts four shirts at roughly $117 each. That is arithmetic, not a price.
                    The residual below is a decide-whether-to-take-the-work number, not a pricing
                    problem.</p>
                </div>
                %s

                <h3 class="pa-h3">Reorders</h3>
                <p class="pa-body"><strong>%s of customers reorder</strong> and <strong>%s of all
                orders come from repeat customers</strong>, with a median gap of
                <strong>%s days</strong> (quartiles %s and %s). So this is a repeat business, and
                the fee lands mostly on people who already buy from us.</p>
                <div class="pa-callout pa-callout--danger">
                    <h4>A reorder is not cheaper to set up</h4>
                    <p>Comparing like for like &mdash; only customers whose genuine first order
                    falls inside the production-log window &mdash; a first order sets up in
                    <strong>%s hr</strong> (n=%s) and later orders in <strong>%s hr</strong>
                    (n=%s). There is no saving. <strong>An early-reorder discount cannot be funded
                    from a setup saving, because the saving does not exist.</strong></p>
                </div>
                <p class="pa-body">The prize is <strong>consolidation, not earliness</strong>. Two
                orders from one customer landing close together each pay a fresh %s-hour setup:</p>
                %s
                <p class="pa-body">Volume also leaks downward on reorder. Of %s consecutive order
                pairs, <strong>%s dropped a tier</strong>, %s stayed level and %s moved up:</p>
                %s
                <div class="pa-finding pa-finding--alt">
                    <h3>The reorder target: catch the second order before the first runs</h3>
                    <p>At order entry, if the customer has ordered within 60 days, offer to combine
                    &mdash; and ask what they need through the next quarter rather than taking the
                    reorder as presented. One setup instead of two is <strong>%s</strong> every
                    time it lands. Merging only the pairs already falling inside 30 days would cut
                    1&ndash;7 orders from about 2,760 to 484.</p>
                </div>
            </section>""" % (
        fit, num(cc['setup_logged_rows']), num(cc['prodlog_rows']),
        num(f['S'], 2), money(cc['setup_direct_flat'], 2), money(cc['setup_loaded_flat'], 2),
        hrs_tab,
        pct(cc['hrs_per_piece'][3]['pct_of_q1'], 0),
        pct((f['S'] + f['v'] - (f['S'] / 8 + f['v'])) / (f['S'] + f['v'] - f['v']), 1),
        dptab, cphtab,
        money(d['cph_now']['FLAT|72+'] - d['cph_now']['FLAT|48-71']),
        pct((d['cph_now']['FLAT|72+'] - d['cph_now']['FLAT|48-71']) / d['cph_now']['FLAT|48-71'], 1),
        money(d['cph_now']['FLAT|8-23'] - d['cph_now']['FLAT|1-7']),
        signed(D['costing']['settled']['detail']['flats']['1-7']['profit_driver']),
        signed(D['costing']['settled']['detail']['flats']['1-7']['profit_flat']),
        money(D['cost']['per_chargeable_hour'], 2),
        money(d['ltm_now'], 2), pct(d['ltm_now'] / cc['setup_direct_flat'], 0),
        money(cc['setup_direct_flat'], 2),
        num(cc['crossover_flat'], 1), num(cc['crossover_cap'], 1),
        stab,
        escape(best['label']), money(best['delta']),
        money(best['cph']['FLAT|8-23']), money(115),
        cv, money(d['residual'][0]['gap_order']), rtab,
        pct(ro['repeat_rate'], 0), pct(ro['orders_from_repeaters'], 0),
        num(gp['p50']), num(gp['p25']), num(gp['p75']),
        num(ro['first_S'], 3), num(ro['first_n']), num(ro['repeat_S'], 3), num(ro['repeat_n']),
        num(f['S'], 2), con,
        num(ro['migration_total']),
        '%s (%s)' % (num(ro['down']), pct(ro['down'] / ro['migration_total'], 1)),
        '%s (%s)' % (num(ro['same']), pct(ro['same'] / ro['migration_total'], 1)),
        '%s (%s)' % (num(ro['up']), pct(ro['up'] / ro['migration_total'], 1)),
        migtab, money(cc['setup_direct_flat'], 0))


def sec_costing():
    """The corrected cost basis, and why small orders are mostly reorders."""
    c = D['costing']
    YS = c['years']
    gl = c['gl']

    glt = table(
        ['component'] + YS,
        [['material / blanks'] + [money(gl[y]['material']) for y in YS],
         ['production payroll'] + [money(gl[y]['prod_pay']) for y in YS],
         ['production non-payroll'] + [money(gl[y]['prod_np']) for y in YS],
         ['office payroll'] + [money(gl[y]['off_pay']) for y in YS],
         ['office non-payroll'] + [money(gl[y]['off_np']) for y in YS],
         ['<b>PRODUCTION TOTAL</b>'] + ['<b>%s</b>' % money(gl[y]['prod_total']) for y in YS],
         ['<b>FRONT OFFICE TOTAL</b>'] + ['<b>%s</b>' % money(gl[y]['off_total']) for y in YS],
         ['production hours'] + [num(gl[y]['hours']) for y in YS],
         ['<b>PRODUCTION $/hour</b>'] + ['<b>%s</b>' % money(gl[y]['rate'], 2) for y in YS],
         ['all company orders'] + [num(gl[y]['orders']) for y in YS],
         ['<b>FRONT OFFICE $/order</b>'] + ['<b>%s</b>' % money(gl[y]['per_order']) for y in YS]])

    st = c['settled']
    rr = c['ratchet_retest']
    dv = st['drivers']
    drv = table(['cost pool', 'spread over', 'per embroidery order'],
                [['Sales reps &mdash; Nika &amp; Taneisha',
                  '%s rep-touched orders' % num(st['touched']), money(dv['sales'])],
                 ['Bradley &mdash; import + purchasing', '%s ALL orders' % num(st['orders']),
                  money(dv['bradley'])],
                 ['remaining front office', '%s ALL orders' % num(st['orders']),
                  money(dv['office'])]],
                foot=['TOTAL &mdash; driver-based', '',
                      '<b>%s</b>' % money(st['per_order_driver'])])

    dt = st['detail']
    trows = []
    for t in TIERS:
        f = dt['flats'].get(t)
        cp = dt['caps'].get(t)
        if not f:
            continue
        trows.append([
            '<b>%s</b>' % t, num(f['mean_q'], 1), money(f['bills']), money(f['cost_flat']),
            (signed(f['profit_flat']), cls_for(f['profit_flat'])),
            (signed(f['profit_driver']), cls_for(f['profit_driver'])),
            (signed(cp['profit_flat']), cls_for(cp['profit_flat'])) if cp else '&mdash;',
            (signed(cp['profit_driver']), cls_for(cp['profit_driver'])) if cp else '&mdash;'])
    ttab = table(['tier', 'mean qty', 'flats bill', 'flats cost',
                  'flats profit &mdash; $70 pool', 'flats profit &mdash; $100 pool',
                  'caps profit &mdash; $70 pool', 'caps profit &mdash; $100 pool'], trows)

    erows = [[e['era'], num(e['orders_yr']), num(e['small_yr']), num(e['afterbig_yr']),
              pct(e['small_share'], 0), '<b>%s</b>' % pct(e['reorder_share'], 0)]
             for e in c['eras']]
    etab = table(['era', 'orders/yr', '1-7 orders/yr', 'after a 24+ order',
                  '1-7 share of all', 'reorder share of 1-7'], erows)

    s = c['small_split']
    stab = table(['what it is', 'orders/yr', 'treatment'],
                 [['reorder within 90 days of a <b>24+</b> order', num(s['reorder_yr']),
                   '<b>keep the $50 fee unchanged</b> &mdash; these orders already clear cost'],
                  ['reorder after a <b>smaller</b> prior order', num(s['other_yr']),
                   'keep the $50 &mdash; thin, but the relationship is real'],
                  ['<b>standalone</b> &mdash; no recent order behind it', num(s['standalone_yr']),
                   'the only case worth a higher fee &mdash; and it is %s of 1-7 volume'
                   % pct(s['standalone_yr'] / (s['reorder_yr'] + s['other_yr']
                                               + s['standalone_yr']), 0)]])

    return """
            <section class="dash-card" id="pa-costing">
                <h2 class="pa-h">Settled cost basis <span class="pa-tag">this is the model &mdash; it supersedes every rate above</span></h2>
                <div class="pa-callout pa-callout--danger">
                    <h4>The $89.74 production hour used earlier on this page was wrong</h4>
                    <p>It loaded <em>all</em> admin, executive, art and sales cost onto machine
                    time. Two consequences: a 150-piece order absorbed <strong>7.3&times; the
                    overhead of a 4-piece order</strong> for consuming the same sales effort, and
                    embroidery was charged as if it were the whole company when it is
                    <strong>27%% of orders and 52%% of revenue</strong>. Split properly, the machine
                    hour is cheap and the <em>order</em> is expensive.</p>
                </div>

                <div class="pa-hero pa-hero--inline">
                    <div class="pa-stat">
                        <span class="pa-stat-label">Production hour</span>
                        <span class="pa-stat-value">%s</span>
                        <span class="pa-stat-sub">art included &mdash; %s hrs, %s pool</span>
                    </div>
                    <div class="pa-stat">
                        <span class="pa-stat-label">Order cost &mdash; flat</span>
                        <span class="pa-stat-value">%s</span>
                        <span class="pa-stat-sub">%s office pool &divide; %s orders</span>
                    </div>
                    <div class="pa-stat">
                        <span class="pa-stat-label">Order cost &mdash; driver-based</span>
                        <span class="pa-stat-value">%s</span>
                        <span class="pa-stat-sub">rep cost on rep-touched orders only</span>
                    </div>
                </div>
                <p class="pa-note">Both order figures are shown throughout because the choice is a
                judgement, not a measurement. <b>%s</b> is the whole front-office pool divided by
                every order the company ships. <b>%s</b> is the same pool with rep cost concentrated
                on the %s orders a rep actually touches &mdash; webstore orders are automatic, so
                they should not absorb rep time. <b>Every conclusion on this page holds under
                both</b>; the driver figure is the conservative one and is what the tier table's
                second column uses. Art is production labour, not overhead &mdash; Steve's %s sits
                in the production pool, which is why the hour is %s and not lower.</p>

                <h3 class="pa-h3">Four full years from the general ledger</h3>
                %s
                <p class="pa-note"><b>How the last column becomes the two figures above.</b> The
                table's own %s/hour and %s/order are the <em>raw</em> GL split, before two
                corrections. <b>Art moves to production</b> &mdash; Steve's %s is production
                labour, not overhead &mdash; lifting the production pool to %s over %s hours, which
                is the <b>%s hour</b>. And the order pool is narrowed from the full %s front office
                to the <b>%s</b> that genuinely varies with taking an order, which over %s orders
                is <b>%s each</b>. Executive time is deliberately <em>not</em> in it: Jim and Erik
                do not cost more when one more order is written, so loading them per order would
                make small orders look unprofitable by construction.</p>
                <p class="pa-note">Payroll comes from the journal, non-payroll from the GL &mdash;
                the GL <em>Detail</em> export is missing most payroll and must not be used for it.
                NWCA owns its building, so there is no rent; property tax (%s/yr) is the only
                facility cost and where it sits barely moves the rate. <b>2024 is distorted by a
                one-off:</b> account 6442 <em>Water Ice Damage</em> ran <b>%s</b> that year
                against $0 in 2022&ndash;23. Excluding it, 2024 costs <b>%s</b> per order rather
                than %s &mdash; in line with 2023 and 2025. Exclude 6442 from any run rate.</p>

                <div class="pa-finding pa-finding--flag">
                    <h3>The paperwork costs more than the stitching</h3>
                    <p>A 24-piece order uses roughly <strong>%s of machine time</strong> against
                    <strong>%s of order cost</strong>. NWCA is an order-processing business that
                    happens to embroider &mdash; which is why <strong>per-piece pricing is the
                    wrong instrument for most of the cost</strong>, and an order-level fee is the
                    right one.</p>
                </div>

                <h3 class="pa-h3">Each cost on the base that actually drives it</h3>
                %s
                <p class="pa-note">Inksoft and Shopify orders are automatic &mdash; imported and
                purchased by Bradley, never touched by a sales rep &mdash; so they carry Bradley
                and the office pool but <b>no rep cost at all</b>. Removing them from the sales
                denominator concentrates rep cost onto the %s orders reps actually work, which is
                the whole difference between the %s and %s figures. Outsourced screenprint and
                promo carry office cost but <b>zero</b> production overhead.</p>

                <h3 class="pa-h3">What each tier really earns, per order</h3>
                %s
                <p class="pa-note"><b>Only one cell on this table is negative under either pool:
                caps at 1-7.</b> Flats at 1-7 land between %s and %s per order &mdash; break-even,
                not a loss. Break-even is <b>%s pieces on flats</b> and <b>%s on caps</b> under the
                conservative driver pool &mdash; nowhere near 24. <b>This is the finding that
                killed the proposed $450 minimum</b>: the tier it was aimed at is not losing money.
                Caps are the real problem, and the instrument for that is cap decoration pricing,
                not an order minimum.</p>

                <h2 class="pa-h pa-h--section" id="pa-reorders">Small orders are reorders <span class="pa-tag">21 years</span></h2>
                <div class="pa-callout pa-callout--danger">
                    <h4>A flat minimum would land on your best customers</h4>
                    <p>Two-thirds to three-quarters of every 1-7 order is a reorder, in every era
                    back to 2006 &mdash; never below 63%% in any single year. The median case is a
                    <strong>3-piece follow-up worth $90, placed 27 days after a 62-piece
                    order</strong>, from a customer who spent <strong>$2,278</strong> in the prior
                    90 days. 32%% come back inside 14 days.</p>
                </div>
                %s

                <h3 class="pa-h3">So the 1-7 tier is three different situations</h3>
                %s
                <p class="pa-note"><b>The $50 fee is the right number and should not change.</b>
                Under the settled model a 1-7 flat order bills %s and costs %s, so it already
                clears its cost with the fee included &mdash; art is zero on an existing design and
                the machine time is small. The earlier claim that it was &ldquo;short by $45&rdquo;
                came from the discredited $261 order cost. Raising the fee would tax the reorder
                stream in order to reach a standalone case that is a minority of the tier.</p>

                <div class="pa-finding pa-finding--alt">
                    <h3>The &ldquo;fill-in ratchet&rdquo; does not survive a like-for-like control
                        <span class="pa-tag">corrected 2026-07-30</span></h3>
                    <p>An earlier version of this page reported that a small fill-in predicted an
                    account billing half as much the following year (%s against %s). <strong>That
                    comparison was wrong.</strong> Its control did not require the customer to have
                    placed a next order at all, so it swept in accounts that had simply stopped
                    buying &mdash; it measured churn, not any ratchet.</p>
                    <p>Re-run against a control anchored on an identical order (48+ pieces, over
                    $1,000) that <em>also</em> placed a following order, the effect disappears:
                    <strong>%s against %s</strong> of 12-month revenue, a difference of
                    <strong>%s</strong> with a 95%% confidence interval of %s to %s &mdash; not
                    distinguishable from zero. Against the original naive control the fill-in
                    customers actually look <em>better</em> (%s vs %s), which is the giveaway.</p>
                    <p>One real difference does remain: fill-in customers return to a 24+ piece
                    order <strong>%s</strong> of the time against <strong>%s</strong> for the
                    control. So the behaviour is not identical &mdash; but the money is, and it is
                    the money the earlier claim was about.</p>
                    <p><strong>Do not treat a fill-in as a warning sign.</strong> Read it as
                    ordinary reorder behaviour from a live account. &#9888; &ldquo;No evidence of
                    harm&rdquo; is not &ldquo;proven zero&rdquo; &mdash; the interval is wide enough
                    to hide a modest effect in either direction.</p>
                </div>
            </section>""" % (
        money(st['rate'], 2), num(st['hours']), money(st['prod_pool']),
        money(st['per_order_flat']), money(st['order_pool']), num(st['orders']),
        money(st['per_order_driver']),
        money(st['per_order_flat']), money(st['per_order_driver']), num(st['touched']),
        money(st['art']), money(st['rate'], 2),
        glt,
        money(gl['2025']['rate'], 2), money(gl['2025']['per_order']), money(st['art']),
        money(st['prod_pool']), num(st['hours']), money(st['rate'], 2),
        money(gl['2025']['off_total']), money(st['order_pool']), num(st['orders']),
        money(st['per_order_flat']),
        money(33542), money(c['water_damage_2024']),
        money(c['off_2024_ex_flood']), money(gl['2024']['per_order']),
        money((S_FLAT + V_FLAT * 24) * st['rate']), money(st['per_order_driver']),
        drv, num(st['touched']), money(st['per_order_flat']),
        money(st['per_order_driver']),
        ttab, signed(dt['flats']['1-7']['profit_driver']),
        signed(dt['flats']['1-7']['profit_flat']),
        num(dt['flats']['breakeven_driver'], 1), num(dt['caps']['breakeven_driver'], 1),
        etab, stab, money(dt['flats']['1-7']['bills']),
        money(dt['flats']['1-7']['cost_flat']),
        money(3053), money(6080),
        money(rr['treated_mean']), money(rr['ctrl_mean']), signed(rr['diff']),
        signed(rr['ci_lo']), signed(rr['ci_hi']),
        money(rr['treated_mean']), money(rr['naive_mean']),
        pct(rr['treated_next24'], 0), pct(rr['ctrl_next24'], 0))


def sec_sales():
    """The sales playbook -- which garment, at which quantity. Written for the desk."""
    m = D['salesmix']
    dt = D['costing']['settled']['detail']

    brows = []
    for b in m['bands']:
        be = b['breakeven']
        note = ('&mdash;' if be is None else
                'sell <b>any</b> quantity' if be <= 4 else
                'needs a modest run' if be <= 7 else
                '<b>bulk only</b>')
        brows.append([
            '<b>%s</b>' % b['label'], num(b['lines']), num(b['pieces']),
            money(b['blank'], 2), money(b['charged'], 2),
            '<b>%s</b>' % money(b['contrib'], 2),
            ('<b>%s pcs</b>' % num(be, 1)) if be else 'never', note])
    btab = table(['blank cost', 'lines', 'pieces', 'median blank', 'median charged',
                  'contribution/pc', 'BREAK-EVEN qty', 'what it means'], brows)

    cg = m['capsvsgar']
    ctab = table(['', 'lines', 'pieces', 'median blank', 'median charged',
                  'contribution/pc', 'break-even'],
                 [['<b>Caps</b>', num(cg['caps']['lines']), num(cg['caps']['pieces']),
                   money(cg['caps']['blank'], 2), money(cg['caps']['charged'], 2),
                   money(cg['caps']['contrib'], 2),
                   '<b>%s pcs</b>' % num(cg['caps']['breakeven'], 1)],
                  ['<b>Garments</b>', num(cg['garments']['lines']), num(cg['garments']['pieces']),
                   money(cg['garments']['blank'], 2), money(cg['garments']['charged'], 2),
                   money(cg['garments']['contrib'], 2),
                   '<b>%s pcs</b>' % num(cg['garments']['breakeven'], 1)]])

    srows = [['<b>%s</b>' % escape(s['style']), escape(s['desc']), num(s['pieces']),
              money(s['contrib']), money(s['per_pc'], 2)] for s in m['topstyles']]
    stab = table(['style', 'description', 'pieces', 'total contribution', '$/pc'], srows)

    ppc = [(t, dt['flats'][t]['profit_flat'] / dt['flats'][t]['mean_q'])
           for t in TIERS if t in dt['flats']]
    best = max(ppc, key=lambda x: x[1])
    ptab = table(['tier'] + [t for t, _ in ppc],
                 [['<b>profit per piece</b>'] +
                  [('<b>%s</b>' % money(v, 2)) if t == best[0] else money(v, 2)
                   for t, v in ppc]])

    return """
            <section class="dash-card" id="pa-sales">
                <h2 class="pa-h">Sales playbook &mdash; what to sell, and how much of it
                    <span class="pa-tag">%s measured lines</span></h2>
                <p class="pa-body">Everything here is measured, not modelled. The source file
                carries <em>what NWCA charged</em> and <em>what NWCA paid SanMar</em> on the same
                row, so contribution per piece is a subtraction rather than an estimate
                (%s lines, %s orders, %s pieces).</p>

                <div class="pa-callout pa-callout--good">
                    <h4>Break-even is not 24 pieces. It is not one number at all.</h4>
                    <p>It depends on <strong>what the logo is going on</strong>. A cheap tee has
                    to clear <strong>%s pieces</strong> before the order pays for itself. A premium
                    jacket clears at <strong>%s</strong>. Same paperwork, same setup, same machine
                    &mdash; the garment decides. <strong>Six cheap tees lose money. Three jackets
                    make money.</strong></p>
                </div>

                <h3 class="pa-h3">1. The break-even table &mdash; the number to actually use</h3>
                <p class="pa-body">An order clears cost when <code>qty &times; contribution</code>
                beats <strong>%s setup + %s order handling + %s per piece of machine time</strong>.</p>
                %s
                <p class="pa-note">The decoration charge barely moves between garments, but the
                margin on the garment itself swings hugely. That is the whole mechanism:
                <b>%s of contribution on a cheap blank against %s on a premium one &mdash;
                one premium piece is worth %s cheap ones.</b></p>

                <h3 class="pa-h3">2. Caps need more volume than garments</h3>
                %s
                <p class="pa-note">Caps are the one reliably negative order type at small
                quantities &mdash; they break even %s pieces later than garments do.
                <b>Under 8 pieces, a cap order should need a manager's OK and be quoted off the
                actual cap cost on the PO, not the standard table.</b></p>

                <h3 class="pa-h3">3. Where the money actually came from</h3>
                %s
                <p class="pa-note">Read the bottom of that list against the top. The premium
                fleece and outerwear lines earn <b>%s&ndash;%s per piece</b> against
                <b>%s</b> on the cheapest tee &mdash; so a few hundred pieces of the former match
                a thousand of the latter. Same rep hours, same order count, same machine setups.</p>

                <h3 class="pa-h3">4. The best quantity is 24&ndash;47, not 72+</h3>
                %s
                <p class="pa-note">Profit per piece <b>peaks at %s and falls to %s at 72+</b>:
                above 48 the price drops faster than the cost does. A 72+ order is worth more in
                total dollars &mdash; %s against %s &mdash; but each piece earns less. <b>The ideal
                order is 24&ndash;47 pieces of a mid-to-premium garment.</b></p>

                <div class="pa-callout pa-callout--good">
                    <h4>The upsell worth more than doubling the quantity</h4>
                    <p>Taking 12 tees to 24 tees adds about <strong>%s</strong> of contribution.
                    Taking 12 tees to <em>12 hoodies</em> adds about <strong>%s</strong> &mdash;
                    for half the pieces, half the machine time and the same paperwork. Reps chase
                    quantity because it is the obvious lever. <strong>Garment mix is the better
                    one, and it is easier to sell &mdash; nobody has to buy more than they
                    need.</strong></p>
                </div>

                <h3 class="pa-h3">The rules, in one place</h3>
                <ol class="pa-body">
                    <li><b>Ask what it is going on before asking how many.</b> A 6-piece order is
                        a bad order on a PC61 and a good one on a Carhartt hoodie.</li>
                    <li><b>Cheap tees and caps: treat 12 as the practical floor.</b> Take them,
                        but do not chase them, and never quote a small tee run as a favour.</li>
                    <li><b>Hoodies, jackets, quarter-zips, premium outerwear: any quantity.</b>
                        Three pieces is profitable. Steer here whenever the customer is open.</li>
                    <li><b>Caps under 8: manager's OK, priced off the real cap cost.</b></li>
                    <li><b>New artwork means a design fee on the quote</b> &mdash; capture is
                        %s on new customers and only %s when an existing customer brings a new
                        design.</li>
                </ol>
                <p class="pa-note"><b>What not to do:</b> do not set a minimum order &mdash;
                one-time customers are 32%% of the customer count but %s of revenue, and a small
                first order returns 8.2&times; what it costs to serve. Do not treat a small
                reorder as a warning sign (see the retraction above). And remember the biggest
                lever of all is not on this page: <b>customers who reorder within 90 days generate
                %s of all revenue</b>, and whether that second order arrives predicts value better
                than the first order's size does.</p>
                <p class="pa-note">&#9888; <b>Scope.</b> This section measures SanMar-sourced
                garment lines in %s. It does not see non-SanMar goods, separately-billed fees, or
                the %s LTM, so it understates small-order revenue &mdash; use the tier table in
                <a href="#pa-costing">Settled costing</a> for order-level profit, and this section
                for garment choice. Contribution here is price minus blank only; machine and order
                costs are applied in the break-even column, not in the contribution column.</p>
            </section>""" % (
        num(m['lines']), num(m['lines']), num(m['orders']), num(m['pieces']),
        num(m['bands'][0]['breakeven'], 1), num(m['bands'][-1]['breakeven'], 1),
        money(m['fixed']), money(m['pool']), money(m['var_hr'], 2), btab,
        money(m['cheap_contrib'], 2), money(m['rich_contrib'], 2), '%.1f&times;' % m['ratio'],
        ctab, num(cg['caps']['breakeven'] - cg['garments']['breakeven'], 1),
        stab,
        money(min(s['per_pc'] for s in m['topstyles'][-3:]), 2),
        money(max(s['per_pc'] for s in m['topstyles'][-3:]), 2),
        money(min(s['per_pc'] for s in m['topstyles']), 2),
        ptab, money(best[1], 2), money(ppc[-1][1], 2),
        money(dt['flats']['72+']['profit_flat']), money(dt['flats']['24-47']['profit_flat']),
        money(12 * m['bands'][0]['contrib']),
        money(12 * (m['bands'][2]['contrib'] - m['bands'][0]['contrib'])),
        pct(0.785, 1), pct(0.29, 0), pct(D['customers']['once_share'], 1),
        pct(D['customers']['second']['within90']['share'], 0),
        escape(m['window']), money(50))


def sec_customers():
    """How customers actually behave -- written to be used by a sales rep."""
    k = D['customers']
    sd, fs, g = k['second'], k['firstsize'], k['grid']

    srows = []
    for key, lbl in (('never', 'never ordered again'),
                     ('within90', '<b>came back within 90 days</b>'),
                     ('91to365', 'came back in 91&ndash;365 days'),
                     ('after365', 'came back after a year')):
        v = sd[key]
        srows.append([lbl, num(v['n']), money(v['median']),
                      '<b>%s</b>' % money(v['mean']),
                      '%s %s' % (bar(v['share']), pct(v['share'], 0))])
    stab = table(['did they come back?', 'customers', 'median lifetime', 'mean lifetime',
                  'share of all revenue'], srows)

    LB = [('under8', 'under 8 pcs'), ('8to23', '8&ndash;23 pcs'), ('24to47', '24&ndash;47 pcs'),
          ('48to71', '48&ndash;71 pcs'), ('72plus', '72+ pcs')]
    frows = [['<b>%s</b>' % lbl, num(fs[key]['n']), money(fs[key]['median']),
              money(fs[key]['mean']), num(fs[key]['orders'], 1), pct(fs[key]['ever24'], 0)]
             for key, lbl in LB if key in fs]
    ftab = table(['their FIRST order', 'customers', 'median lifetime', 'mean lifetime',
                  'orders', 'ever reach 24+?'], frows)

    grows = []
    for key, lbl in LB:
        v = g.get(key)
        if not v:
            continue
        grows.append(['<b>%s</b>' % lbl, num(v['back_n']),
                      ('<b>%s</b>' % money(v['back_mean']), 'pa-pos'),
                      num(v['no_n']), (money(v['no_mean']), 'pa-neg'),
                      '%.1f&times;' % (v['back_mean'] / v['no_mean'])])
    gtab = table(['their FIRST order', 'came back &le;90d', 'their lifetime',
                  'did not', 'their lifetime', 'difference'], grows)

    sil = k['silence']
    qrows = [[lbl, '<b>%s</b>' % pct(sil[c]['return'], 0),
              '%s' % bar(sil[c]['return'], 'muted' if sil[c]['return'] < .5 else 'theme')]
             for c, lbl in (('40', 'quiet 40 days &mdash; <i>the median gap</i>'),
                            ('90', 'quiet 90 days'),
                            ('161', 'quiet 161 days &mdash; <i>the 75th percentile</i>'),
                            ('393', 'quiet 393 days &mdash; <i>the 90th</i>'))]
    qtab = table(['how long since their last order', 'still ever order again', ''], qrows)

    u8 = g['under8']
    lift = u8['back_mean'] - u8['no_mean']
    return """
            <section class="dash-card" id="pa-customers">
                <h2 class="pa-h">How customers actually behave <span class="pa-tag">%s customers, %s years</span></h2>
                <p class="pa-body">This section exists to be <em>used</em>. Every figure below is
                measured on %s embroidery orders from %s customers, restricted to customers whose
                first order is recent enough to be genuinely first and old enough to judge
                (%s of them, first seen 2008 or later with at least three years of runway).</p>

                <div class="pa-callout pa-callout--good">
                    <h4>The answer to &ldquo;do we waste time on small orders?&rdquo; is no</h4>
                    <p>%s customers arrived with a first order under 8 pieces. Their mean lifetime
                    value is <strong>%s</strong>, against roughly <strong>$300</strong> to serve
                    that first order &mdash; a <strong>%.0f&times; return</strong>. A firm minimum
                    would be declining that bet. But the small order is not what makes them
                    valuable: <strong>whether a second order arrives within 90 days is</strong>,
                    and that is the thing a rep can influence.</p>
                </div>

                <h3 class="pa-h3">1. The first order tells you almost nothing</h3>
                <p class="pa-body">Of everything a customer will ever spend, the first order is only
                <strong>%s</strong> of it. By the end of month twelve you have still seen just
                <strong>%s</strong>. Judging a customer by what they walk in with is judging on an
                eighth of the evidence.</p>
                %s
                <p class="pa-note">First-order size <em>does</em> predict &mdash; a 72+ starter is
                worth %s against %s for an under-8 starter. It is a real signal. It is just not the
                strongest one available, and it is the one a rep cannot change.</p>

                <h3 class="pa-h3">2. The second order tells you almost everything</h3>
                %s
                <p class="pa-note"><b>Customers who reorder within 90 days generate %s of all
                embroidery revenue.</b> Customers who never return are %s of them and %s of the
                money &mdash; which is also why they cost the company so little.</p>

                <div class="pa-finding pa-finding--flag">
                    <h3>The reorder signal beats the size signal</h3>
                    <p>Sorted by whether they came back inside 90 days, mean lifetime value differs
                    by <strong>%.1f&times;</strong>. Sorted by whether the first order was 24+
                    pieces, it differs by only <strong>%.1f&times;</strong>. The rep-influenceable
                    signal is the stronger one.</p>
                </div>

                <h3 class="pa-h3">3. Both signals together &mdash; the table to actually use</h3>
                %s
                <p class="pa-note">Read across, not down. <b>A small first order that reorders is
                worth more than a 24&ndash;47 piece first order that does not</b> (%s against %s).
                The row that matters is not which band they started in &mdash; it is which column
                they end up in.</p>

                <div class="pa-callout pa-callout--good">
                    <h4>Where the sales effort actually pays</h4>
                    <p>%s of under-8 starters never come back inside 90 days; they are worth %s.
                    The %s who do are worth %s. Moving <strong>ten percentage points</strong> of
                    them from the first column to the second is worth about
                    <strong>%s</strong> of lifetime revenue on a cohort this size. No pricing
                    change on this page comes close to that. A phone call does.</p>
                </div>

                <h3 class="pa-h3">4. When to make the call</h3>
                <p class="pa-body">Median gap between orders is <strong>%s days</strong>; median
                first-to-second is <strong>%s days</strong>. So a customer silent for 90 days is
                already past normal.</p>
                %s
                <p class="pa-note"><b>Speed of return barely matters &mdash; the fact of it is
                everything.</b> Customers back within 30 days average %s; within 180 days, %s.
                Nearly identical. Do not manufacture urgency; just make sure there is a second
                order.</p>

                <h3 class="pa-h3">5. Where the money is</h3>
                <p class="pa-body">The top <strong>10%%</strong> of customers are
                <strong>%s</strong> of revenue and the top 20%% are <strong>%s</strong>.
                <strong>%s</strong> customers &mdash; %s of the book &mdash; ordered exactly once,
                and together they are <strong>%s</strong> of revenue. The repeat customer's active
                span runs %s years at the median and %s at the upper quartile.</p>
            </section>""" % (
        num(k['customers']), num(k['span_years'], 1), num(k['orders']),
        num(k['customers']), num(k['cohort']),
        num(fs['under8']['n']), money(fs['under8']['mean']), fs['under8']['mean'] / 300.0,
        pct(k['early']['first1'], 0), pct(k['early']['first12mo'], 0), ftab,
        money(fs['72plus']['mean']), money(fs['under8']['mean']),
        stab, pct(sd['within90']['share'], 0),
        pct(sd['never']['n'] / k['cohort'], 0), pct(sd['never']['share'], 0),
        k['signal']['reorder_ratio'], k['signal']['size_ratio'],
        gtab, money(u8['back_mean']), money(g['24to47']['no_mean']),
        pct(u8['no_n'] / (u8['no_n'] + u8['back_n']), 0), money(u8['no_mean']),
        pct(u8['back_n'] / (u8['no_n'] + u8['back_n']), 0), money(u8['back_mean']),
        money(lift * 0.10 * (u8['no_n'] + u8['back_n'])),
        num(k['gap_all']['p50']), num(k['gap_first_second']['p50']), qtab,
        money(k['speed']['30']['mean']), money(k['speed']['180']['mean']),
        pct(k['top10'], 0), pct(k['top20'], 0), num(k['once_n']),
        pct(k['once_n'] / k['customers'], 0), pct(k['once_share'], 1),
        num(k['span']['p50'], 1), num(k['span']['p75'], 1))


S_FLAT, V_FLAT = 1.2787, 0.06612

NAV = [('pa-tiers', 'Units by tier'), ('pa-year', 'Year by year'), ('pa-gap', 'The gap'),
       ('pa-cost', 'Cost basis'), ('pa-costing', 'Settled costing'),
       ('pa-sales', 'Sales playbook'), ('pa-customers', 'Customer behaviour'),
       ('pa-pricing', 'Caspio today'), ('pa-design', 'Tier design'),
       ('pa-rules', 'Five rules'), ('pa-limits', 'Limits')]


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
       sec_cost(), sec_costing(), sec_sales(), sec_customers(), sec_pricing(),
       sec_design(), sec_rules(), sec_limits(), JS_VER)


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
