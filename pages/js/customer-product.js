/**
 * Customer Portal — product detail page  /portal/product/:style
 *
 * Shows the SanMar specs, ALL available colors (click a swatch to swap the model image),
 * THIS customer's order history for the style (per-color size matrix + per-order list),
 * a per-size availability traffic-light (from SanMar, never raw numbers), and a re-order
 * panel pre-filled from the color's last order. Data comes from the gated, customer-safe
 * /api/portal/product/:style (or the staff-preview mirror). No prices — the rep quotes it.
 */
(function () {
    'use strict';

    var PREVIEW = (function () { var m = location.pathname.match(/^\/portal-admin\/preview\/(\d+)\/product\//); return m ? m[1] : null; })();
    var STYLE = (function () { var m = location.pathname.match(/\/product\/([^\/?#]+)/); return m ? decodeURIComponent(m[1]) : ''; })();
    var BASE = PREVIEW ? ('/api/portal-admin/preview/' + PREVIEW + '/product/' + encodeURIComponent(STYLE)) : ('/api/portal/product/' + encodeURIComponent(STYLE));
    var AVAIL = BASE + '/availability';
    var BACK = PREVIEW ? ('/portal-admin/preview/' + PREVIEW) : '/portal';
    var LOGIN_URL = PREVIEW ? '/auth/saml/login' : '/customer/login';

    var SIZE_ORDER = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
    var state = { data: null, color: '', catalogColor: '', colorInfo: {}, orderedByColor: {} };

    var backEl = document.getElementById('pp-back');
    if (backEl) backEl.setAttribute('href', BACK);
    if (PREVIEW) showPreviewRibbon();
    load();

    function load() {
        if (!STYLE) { showError('No product specified.'); return; }
        fetch(BASE, { credentials: 'same-origin' })
            .then(function (r) {
                if (r.status === 401) { location.href = LOGIN_URL; throw new Error('auth'); }
                return r.ok ? r.json() : r.json().then(function (j) { throw new Error((j && j.error) || 'load'); });
            })
            .then(render)
            .catch(function (e) { if (e.message !== 'auth') showError('We couldn’t load this product. It may not be on file &mdash; call us at (253) 922-5793.'); });
    }

    function showError(msg) {
        document.getElementById('pp-loading').style.display = 'none';
        var box = document.getElementById('pp-error');
        document.getElementById('pp-error-message').innerHTML = msg;
        box.style.display = 'block';
    }

    function render(d) {
        state.data = d;
        (d.ordered.colors || []).forEach(function (c) { state.orderedByColor[c.name.toLowerCase()] = c; });
        (d.product.colors || []).forEach(function (c) { state.colorInfo[c.name.toLowerCase()] = { image: c.image, catalog: c.catalogColor }; });
        state.color = d.defaultColor || (d.product.colors[0] && d.product.colors[0].name) || '';
        state.catalogColor = d.defaultCatalogColor || '';

        var p = d.product;
        var h = '';
        h += '<div class="pp-head">'
            + '<div class="pp-title">' + esc(p.title) + '</div>'
            + '<div class="pp-sub">' + esc([p.brand, p.category, 'Style ' + p.style].filter(Boolean).join(' · ')) + '</div>';
        if (Number(d.ordered.styleTotalQty) > 0) {
            h += '<div class="pp-total">You’ve ordered ' + Number(d.ordered.styleTotalQty).toLocaleString() + ' of this style'
                + (d.ordered.lastOrdered ? ' · last ordered ' + esc(formatDate(d.ordered.lastOrdered)) : '') + '</div>';
        }
        h += '</div>';
        if (p.isCloseout) h += '<div class="pp-closeout"><i>&#9888;</i> This style is being discontinued &mdash; ask your rep about a great replacement.</div>';

        h += '<div class="pp-hero">'
            + '<div class="pp-hero-img" id="pp-hero-img"></div>'
            + '<div class="pp-hero-side">'
            + '<div class="pp-colorname" id="pp-colorname"></div>'
            + '<div class="pp-avail" id="pp-avail"></div>'
            + '<div class="pp-swatches-label">Colors <small>(your colors first)</small></div>'
            + '<div class="cp-swatch-picker pp-swatches" id="pp-swatches"></div>'
            + '</div>'
            + '</div>';

        if (p.description) h += '<section class="pp-section"><h2>About this product</h2><p class="pp-desc">' + esc(p.description) + '</p></section>';

        if (d.ordered.colors && d.ordered.colors.length) {
            h += '<section class="pp-section"><h2>What you’ve ordered</h2>'
                + '<p class="pp-section-sub">Your sizes by color &mdash; so a re-order matches what you bought.</p>'
                + matrixHtml(d.ordered.colors) + '</section>';
        }

        h += reorderHtml();

        if (d.history && d.history.length) {
            h += '<section class="pp-section"><h2>Order history</h2>' + historyHtml(d.history) + '</section>';
        }

        document.getElementById('pp-body').innerHTML = h;
        document.getElementById('pp-loading').style.display = 'none';
        document.getElementById('pp-content').style.display = 'block';

        renderSwatches();
        selectColor(state.color);
    }

    function matrixHtml(colors) {
        var head = '<th class="pp-mx-c">Color</th>' + SIZE_ORDER.map(function (s) { return '<th>' + s + '</th>'; }).join('') + '<th>Total</th>';
        var body = colors.map(function (c) {
            var cells = SIZE_ORDER.map(function (s) { var v = c.sizes[s] || 0; return '<td>' + (v > 0 ? v : '—') + '</td>'; }).join('');
            var sw = c.swatch
                ? '<img class="cp-swatch" src="' + esc(c.swatch) + '" alt="" onerror="this.style.display=\'none\'">'
                : '<span class="cp-swatch cp-swatch--noimg"></span>';
            return '<tr><td class="pp-mx-c">' + sw + '<span>' + esc(c.name) + '</span></td>' + cells
                + '<td class="pp-mx-total">' + Number(c.totalQty).toLocaleString() + '</td></tr>';
        }).join('');
        return '<div class="pp-mx-wrap"><table class="pp-mx"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table></div>';
    }

    function historyHtml(hist) {
        return '<div class="pp-hist">' + hist.map(function (x) {
            var szs = SIZE_ORDER.filter(function (s) { return x.sizes[s]; }).map(function (s) { return s + ':' + x.sizes[s]; }).join('  ');
            return '<div class="pp-hist-row">'
                + '<div class="pp-hist-main">' + esc(formatDate(x.date)) + ' · ' + esc(x.color) + '</div>'
                + '<div class="pp-hist-sub">' + Number(x.qty).toLocaleString() + ' pcs' + (szs ? ' · ' + esc(szs) : '') + '</div>'
                + '</div>';
        }).join('') + '</div>';
    }

    function reorderHtml() {
        return '<section class="pp-section pp-reorder"><h2>Re-order</h2>'
            + '<p class="pp-section-sub">Color: <strong id="pp-req-colorlabel"></strong> &mdash; pick sizes and we’ll send it to your rep for a fresh quote.</p>'
            + '<div class="pp-field"><span class="pp-flabel">Sizes &amp; quantities</span>'
            + '<div class="cp-size-grid" id="pp-sizes"></div>'
            + '<div class="cp-size-total">Total: <strong id="pp-sizetotal">0</strong></div></div>'
            + '<label class="pp-field"><span class="pp-flabel">Notes <small>(deadline, other sizes/colors &mdash; optional)</small></span>'
            + '<textarea id="pp-note" rows="2" placeholder="Anything the team should know"></textarea></label>'
            + '<div class="pp-req-error" id="pp-req-error"></div>'
            + '<button class="cp-btn-primary" id="pp-req-submit" type="button">Send to my rep</button>'
            + '</section>';
    }

    function renderSwatches() {
        var box = document.getElementById('pp-swatches'); if (!box) return;
        var enr = (state.data.product.colors || []).map(function (c, i) {
            var o = state.orderedByColor[c.name.toLowerCase()];
            return { name: c.name, swatch: c.swatch, catalog: c.catalogColor, qty: o ? o.totalQty : 0, i: i };
        });
        enr.sort(function (a, b) {
            if ((b.qty > 0) !== (a.qty > 0)) return (b.qty > 0 ? 1 : 0) - (a.qty > 0 ? 1 : 0);
            if (b.qty !== a.qty) return b.qty - a.qty;
            return a.i - b.i;
        });
        var selKey = state.color.toLowerCase();
        var top = (enr.length && enr[0].qty > 0) ? enr[0].name : null;
        box.innerHTML = enr.map(function (c) {
            var isSel = c.name.toLowerCase() === selKey;
            var sq = c.swatch
                ? '<span class="cp-swatch-sq"><img src="' + esc(c.swatch) + '" alt="" loading="lazy" onerror="this.remove();"></span>'
                : '<span class="cp-swatch-sq cp-swatch-sq--noimg"></span>';
            var tag = (top && c.name === top) ? '<span class="cp-swatch-tag">Top color</span>' : '';
            var q = c.qty > 0 ? '<span class="cp-swatch-qty">' + Number(c.qty).toLocaleString() + ' ordered</span>' : '';
            return '<button type="button" class="cp-swatch-btn' + (isSel ? ' is-selected' : '') + '" data-color="' + esc(c.name) + '">'
                + tag + sq + '<span class="cp-swatch-nm">' + esc(c.name) + '</span>' + q + '</button>';
        }).join('');
    }

    function selectColor(name) {
        if (!name) return;
        state.color = name;
        var info = state.colorInfo[name.toLowerCase()] || {};
        state.catalogColor = info.catalog || '';
        var img = info.image || state.data.defaultImage || '';
        document.getElementById('pp-hero-img').innerHTML = img
            ? '<img src="' + esc(img) + '" alt="" onerror="this.parentElement.classList.add(\'pp-noimg\');this.remove();">'
            : '<div class="pp-noimg-ico">&#128085;</div>';
        var cn = document.getElementById('pp-colorname'); if (cn) cn.textContent = name;
        var lbl = document.getElementById('pp-req-colorlabel'); if (lbl) lbl.textContent = name;
        var btns = document.querySelectorAll('#pp-swatches .cp-swatch-btn');
        for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('is-selected', btns[i].getAttribute('data-color').toLowerCase() === name.toLowerCase());
        var o = state.orderedByColor[name.toLowerCase()];
        buildSizeGrid(o ? o.sizes : {});
        fetchAvailability(state.catalogColor || name);
    }

    function fetchAvailability(color) {
        var box = document.getElementById('pp-avail'); if (!box || !color) { if (box) box.innerHTML = ''; return; }
        box.innerHTML = '<span class="pp-avail-load">checking availability&hellip;</span>';
        fetch(AVAIL + '?color=' + encodeURIComponent(color), { credentials: 'same-origin' })
            .then(function (r) { return r.ok ? r.json() : { lights: {} }; })
            .then(function (d) {
                var lights = (d && d.lights) || {};
                if (!Object.keys(lights).length) { box.innerHTML = ''; return; }
                var labels = { in: 'in stock', low: 'low stock', out: 'out of stock', na: 'not offered' };
                box.innerHTML = '<span class="pp-avail-label">Availability</span>' + SIZE_ORDER.map(function (s) {
                    var lv = lights[s] || 'na';
                    return '<span class="pp-dot pp-dot--' + lv + '" title="' + s + ': ' + labels[lv] + '">' + s + '</span>';
                }).join('');
            })
            .catch(function () { box.innerHTML = ''; });
    }

    function buildSizeGrid(sizes) {
        var grid = document.getElementById('pp-sizes'); if (!grid) return;
        grid.innerHTML = SIZE_ORDER.map(function (sz) {
            var v = Number(sizes && sizes[sz]) || 0;
            return '<label class="cp-size-cell"><span class="cp-size-name">' + sz + '</span>'
                + '<input type="number" min="0" inputmode="numeric" class="cp-size-input pp-size-input" data-size="' + sz + '" value="' + (v > 0 ? v : '') + '" placeholder="0"></label>';
        }).join('');
        var ins = grid.querySelectorAll('.pp-size-input');
        for (var i = 0; i < ins.length; i++) ins[i].addEventListener('input', updateSizeTotal);
        updateSizeTotal();
    }
    function collectSizes() {
        var out = {}, total = 0;
        var ins = document.querySelectorAll('#pp-sizes .pp-size-input');
        for (var i = 0; i < ins.length; i++) { var n = parseInt(ins[i].value, 10); if (n > 0) { out[ins[i].getAttribute('data-size')] = n; total += n; } }
        return { sizes: out, total: total };
    }
    function updateSizeTotal() { var el = document.getElementById('pp-sizetotal'); if (el) el.textContent = collectSizes().total; }

    document.addEventListener('click', function (e) {
        var sw = e.target.closest && e.target.closest('#pp-swatches .cp-swatch-btn');
        if (sw) { selectColor(sw.getAttribute('data-color')); return; }
        if (e.target.closest && e.target.closest('#pp-req-submit')) { submitReorder(); }
    });

    function submitReorder() {
        var picked = collectSizes();
        var err = document.getElementById('pp-req-error'); err.textContent = '';
        if (picked.total <= 0) { err.textContent = 'Enter a quantity for at least one size.'; return; }
        if (PREVIEW) { showToast('Staff preview — the customer would send this request to their rep.'); return; }
        var d = state.data;
        var breakdown = SIZE_ORDER.filter(function (s) { return picked.sizes[s]; }).map(function (s) { return s + ':' + picked.sizes[s]; }).join(', ');
        var btn = document.getElementById('pp-req-submit'); btn.disabled = true; btn.textContent = 'Sending…';
        fetch('/api/portal/reorder-request', {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                style: d.product.style, color: state.color, product_title: d.product.title,
                design_number: d.designNumber || '', design_name: d.designName || '',
                qty: String(picked.total), size_breakdown: breakdown,
                note: document.getElementById('pp-note').value.trim(), source: 'reorder'
            })
        })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (x) {
                btn.disabled = false; btn.textContent = 'Send to my rep';
                if (!x.ok || !x.j.ok) { err.textContent = (x.j && x.j.error) || 'Could not send. Please try again.'; return; }
                showToast('Sent to your rep' + (x.j.rep ? ' (' + x.j.rep + ')' : '') + '! We’ll follow up with a quote.');
            })
            .catch(function () { btn.disabled = false; btn.textContent = 'Send to my rep'; err.textContent = 'Could not send. Please try again.'; });
    }

    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function formatDate(s) {
        if (!s) return '';
        var d = new Date(String(s).slice(0, 10) + 'T00:00:00');
        if (isNaN(d.getTime())) return String(s).slice(0, 10);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    function showToast(msg) {
        var t = document.getElementById('cp-toast'); if (!t) return;
        t.innerHTML = msg; t.className = 'cp-toast show';
        setTimeout(function () { t.className = 'cp-toast'; }, 4000);
    }
    function showPreviewRibbon() {
        document.addEventListener('DOMContentLoaded', function () {
            var bar = document.createElement('div');
            bar.className = 'cp-preview-ribbon';
            bar.innerHTML = '<span><strong>Staff preview</strong> &middot; this is exactly what the customer sees (read-only)</span>'
                + '<a href="/dashboards/customer-portal-admin.html">&larr; Back to Customer Portals</a>';
            document.body.insertBefore(bar, document.body.firstChild);
            document.body.classList.add('cp-has-ribbon');
        });
    }
})();
