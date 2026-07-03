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
    var state = { data: null, color: '', catalogColor: '', colorInfo: {}, orderedByColor: {}, gallery: { images: [], idx: 0 } };

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
        (d.product.colors || []).forEach(function (c) {
            var imgs = (c.images && c.images.length) ? c.images : (c.image ? [{ url: c.image, label: '' }] : []);
            state.colorInfo[c.name.toLowerCase()] = { image: c.image, images: imgs, catalog: c.catalogColor };
        });
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

        var ql = [];
        if (p.description) ql.push('<a class="pp-ql" href="#pp-about">Product details</a>');
        ql.push('<a class="pp-ql" href="#pp-reorder">Re-order</a>');
        if (d.upgrades && d.upgrades.length) ql.push('<a class="pp-ql pp-ql--accent" href="#pp-upgrade">Upgrade to embroidery</a>');
        if (d.history && d.history.length) ql.push('<a class="pp-ql" href="#pp-history">Order history</a>');
        h += '<div class="pp-quicklinks">' + ql.join('') + '</div>';

        if (p.isCloseout) h += '<div class="pp-closeout"><i>&#9888;</i> This style is being discontinued &mdash; ask your rep about a great replacement.</div>';

        h += '<div class="pp-hero">'
            + '<div class="pp-hero-media"><div class="pp-hero-img" id="pp-hero-img"></div><div class="pp-thumbs" id="pp-thumbs"></div></div>'
            + '<div class="pp-hero-side">'
            + '<div class="pp-colorname" id="pp-colorname"></div>'
            + '<div class="pp-avail" id="pp-avail"></div>'
            + '<div class="pp-swatches-label">Colors <small>(your colors first)</small></div>'
            + '<div class="cp-swatch-picker pp-swatches" id="pp-swatches"></div>'
            + '</div>'
            + '</div>';

        if (p.description) h += '<section class="pp-section" id="pp-about"><h2>About this product</h2><p class="pp-desc">' + esc(p.description) + '</p></section>';

        if (d.ordered.colors && d.ordered.colors.length) {
            h += '<section class="pp-section"><h2>What you’ve ordered</h2>'
                + '<p class="pp-section-sub">Your sizes by color &mdash; so a re-order matches what you bought.</p>'
                + matrixHtml(d.ordered.colors) + '</section>';
        }

        h += reorderHtml();

        if (d.upgrades && d.upgrades.length) h += upgradesHtml(d.upgrades);

        if (d.history && d.history.length) {
            h += '<section class="pp-section" id="pp-history"><h2>Order history</h2>' + historyHtml(d.history) + '</section>';
        }

        document.getElementById('pp-body').innerHTML = h;
        document.getElementById('pp-loading').style.display = 'none';
        document.getElementById('pp-content').style.display = 'block';

        renderSwatches();
        selectColor(state.color);
        (d.upgrades || []).forEach(function (u, i) {
            priceUpgrade(i, u);
            buildUpSizeGrid(i);
            selectUpgradeColor(i, (u.colors && u.colors[0]) ? u.colors[0].name : '');
        });
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
        return '<section class="pp-section pp-reorder" id="pp-reorder"><h2>Re-order</h2>'
            + '<p class="pp-section-sub">Color: <strong id="pp-req-colorlabel"></strong> <span class="pp-req-hint">(tap any color above to switch)</span> &mdash; pick sizes and we’ll send it to your rep for a fresh quote.</p>'
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
        state.gallery = {
            images: (info.images && info.images.length) ? info.images
                : (state.data.defaultImage ? [{ url: state.data.defaultImage, label: '' }] : []),
            idx: 0
        };
        renderGallery();
        var cn = document.getElementById('pp-colorname'); if (cn) cn.textContent = name;
        var lbl = document.getElementById('pp-req-colorlabel'); if (lbl) lbl.textContent = name;
        var btns = document.querySelectorAll('#pp-swatches .cp-swatch-btn');
        for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('is-selected', btns[i].getAttribute('data-color').toLowerCase() === name.toLowerCase());
        var o = state.orderedByColor[name.toLowerCase()];
        buildSizeGrid(o ? o.sizes : {});
        fetchAvailability(state.catalogColor || name);
    }

    // Per-color image gallery: a main shot + a thumbnail strip of every angle we have (Model
    // front/back/side + Flat front/back, deduped server-side). Rebuilt on each color change.
    function renderGallery() {
        var imgs = (state.gallery && state.gallery.images) || [];
        var idx = (state.gallery && state.gallery.idx) || 0;
        if (idx >= imgs.length) idx = 0;
        var hero = document.getElementById('pp-hero-img');
        if (hero) {
            hero.classList.remove('pp-noimg');
            var main = imgs[idx];
            hero.innerHTML = main
                ? '<img src="' + esc(main.url) + '" alt="' + esc(state.color + (main.label ? ' — ' + main.label : '')) + '" onerror="this.parentElement.classList.add(\'pp-noimg\');this.remove();">'
                : '<div class="pp-noimg-ico">&#128085;</div>';
        }
        var th = document.getElementById('pp-thumbs');
        if (!th) return;
        if (imgs.length < 2) { th.innerHTML = ''; th.style.display = 'none'; return; }
        th.style.display = '';
        th.innerHTML = imgs.map(function (im, i) {
            var lbl = im.label || ('View ' + (i + 1));
            return '<button type="button" class="pp-thumb' + (i === idx ? ' is-active' : '') + '" data-idx="' + i + '" title="' + esc(lbl) + '" aria-label="' + esc(lbl) + '">'
                + '<img src="' + esc(im.url) + '" alt="" loading="lazy" onerror="var b=this.closest(\'.pp-thumb\'); if(b){b.style.display=\'none\';}">'
                + '</button>';
        }).join('');
    }
    function setGalleryImage(i) {
        if (!state.gallery) return;
        state.gallery.idx = i || 0;
        renderGallery();
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
        var th = e.target.closest && e.target.closest('#pp-thumbs .pp-thumb');
        if (th) { setGalleryImage(parseInt(th.getAttribute('data-idx'), 10) || 0); return; }
        var sw = e.target.closest && e.target.closest('#pp-swatches .cp-swatch-btn');
        if (sw) { selectColor(sw.getAttribute('data-color')); return; }
        if (e.target.closest && e.target.closest('#pp-req-submit')) { submitReorder(); return; }
        var upsw = e.target.closest && e.target.closest('.pp-up-sw');
        if (upsw) { selectUpgradeColor(parseInt(upsw.getAttribute('data-up'), 10), upsw.getAttribute('data-color')); return; }
        var up = e.target.closest && e.target.closest('.pp-up-btn');
        if (up) { requestUpgrade(parseInt(up.getAttribute('data-up'), 10)); }
    });

    // Each upgrade card has its OWN color + size grid (same "pick color, fill sizes, submit" flow
    // as the re-order). Sizes start blank (a premium product they haven't ordered before).
    var upState = {};   // upgrade index -> { color, catalog }
    function selectUpgradeColor(i, name) {
        var u = (state.data.upgrades || [])[i]; if (!u) return;
        var c = (u.colors || []).filter(function (x) { return x.name === name; })[0] || (u.colors || [])[0];
        if (!c) { upState[i] = { color: '', catalog: '' }; return; }
        upState[i] = { color: c.name, catalog: c.catalogColor || '' };
        var cn = document.getElementById('pp-up-cn-' + i); if (cn) cn.textContent = c.name;
        var box = document.getElementById('pp-up-colors-' + i);
        if (box) { var bs = box.querySelectorAll('.pp-up-sw'); for (var j = 0; j < bs.length; j++) bs[j].classList.toggle('is-selected', bs[j].getAttribute('data-color') === c.name); }
        var img = document.getElementById('pp-up-img-' + i);
        if (img && c.image) img.innerHTML = '<img src="' + esc(c.image) + '" alt="" loading="lazy" onerror="this.remove();">';
    }
    function buildUpSizeGrid(i) {
        var grid = document.getElementById('pp-up-sizes-' + i); if (!grid) return;
        grid.innerHTML = SIZE_ORDER.map(function (sz) {
            return '<label class="cp-size-cell"><span class="cp-size-name">' + sz + '</span>'
                + '<input type="number" min="0" inputmode="numeric" class="cp-size-input" data-size="' + sz + '" value="" placeholder="0"></label>';
        }).join('');
        var ins = grid.querySelectorAll('.cp-size-input');
        for (var k = 0; k < ins.length; k++) ins[k].addEventListener('input', (function (idx) { return function () { updateUpTotal(idx); }; })(i));
        updateUpTotal(i);
    }
    function collectUpSizes(i) {
        var out = {}, total = 0;
        var ins = document.querySelectorAll('#pp-up-sizes-' + i + ' .cp-size-input');
        for (var k = 0; k < ins.length; k++) { var n = parseInt(ins[k].value, 10); if (n > 0) { out[ins[k].getAttribute('data-size')] = n; total += n; } }
        return { sizes: out, total: total };
    }
    function updateUpTotal(i) { var el = document.getElementById('pp-up-total-' + i); if (el) el.textContent = collectUpSizes(i).total; }

    function requestUpgrade(i) {
        var u = (state.data.upgrades || [])[i]; if (!u) return;
        if (PREVIEW) { showToast('Staff preview — the customer would send this embroidered upgrade to their rep.'); return; }
        var st = upState[i] || {};
        var picked = collectUpSizes(i);
        var breakdown = SIZE_ORDER.filter(function (s) { return picked.sizes[s]; }).map(function (s) { return s + ':' + picked.sizes[s]; }).join(', ');
        var note = 'Upgrade to EMBROIDERY on ' + u.title + ' (' + u.style + ')' + (st.color ? ' in ' + st.color : '') + ' — ' + u.stitch + '-stitch ' + u.location + ' logo.' + (picked.total ? '' : ' Please send a quote.');
        var btn = document.querySelector('.pp-up-btn[data-up="' + i + '"]'); if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
        fetch('/api/portal/reorder-request', {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                style: u.style, color: st.color || '', product_title: u.title + ' (embroidered upgrade)',
                design_number: state.data.designNumber || '', design_name: state.data.designName || '',
                qty: picked.total ? String(picked.total) : '', size_breakdown: breakdown, note: note, source: 'reorder'
            })
        })
            .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
            .then(function (x) {
                if (btn) { btn.disabled = false; btn.textContent = 'Send this embroidered upgrade to my rep'; }
                if (x.ok && x.j.ok) showToast('Sent to your rep' + (x.j.rep ? ' (' + x.j.rep + ')' : '') + '! They’ll follow up about your embroidered upgrade.');
                else showToast('Could not send. Please call (253) 922-5793.');
            })
            .catch(function () { if (btn) { btn.disabled = false; btn.textContent = 'Send this embroidered upgrade to my rep'; } showToast('Could not send. Please call (253) 922-5793.'); });
    }

    // ── Upgrade to embroidery module (engine-priced matrix — same engine as Quick Quote, Rule 9) ──
    function upgradesHtml(ups) {
        var banner = (ups[0] && ups[0].pitchImage)
            ? '<div class="pp-up-banner"><img src="' + esc(ups[0].pitchImage) + '" alt="Custom embroidery" loading="lazy" onerror="this.parentElement.style.display=\'none\'"></div>'
            : '';
        var cards = ups.map(function (u, i) {
            var swBtns = (u.colors || []).map(function (c) {
                return '<button type="button" class="pp-up-sw" data-up="' + i + '" data-color="' + esc(c.name) + '" title="' + esc(c.name) + '">'
                    + (c.swatch ? '<img src="' + esc(c.swatch) + '" alt="" loading="lazy" onerror="this.remove();">' : '') + '</button>';
            }).join('');
            return '<div class="pp-up-card">'
                + '<div class="pp-up-top">'
                + '<div class="pp-up-img" id="pp-up-img-' + i + '">' + (u.image ? '<img src="' + esc(u.image) + '" alt="" loading="lazy" onerror="this.remove();">' : '') + '</div>'
                + '<div class="pp-up-info">'
                + (u.tier ? '<span class="pp-up-tier">' + esc(u.tier) + '</span>' : '')
                + '<div class="pp-up-name">' + esc(u.title) + '</div>'
                + (u.brand ? '<div class="pp-up-brand">' + esc(u.brand) + '</div>' : '')
                + (u.blurb ? '<div class="pp-up-blurb">' + esc(u.blurb) + '</div>' : '')
                + '</div></div>'
                + '<div class="pp-up-digit" id="pp-up-dig-' + i + '"><i>&#129525;</i> <span><strong>New to embroidery?</strong> We’ll digitize your logo for stitching at half off &mdash; a one-time setup, and the file’s yours to reuse on every future order.</span></div>'
                + '<div class="pp-up-matrix" id="pp-up-mx-' + i + '"><div class="pp-up-mxload">Pricing an ' + Number(u.stitch).toLocaleString() + '-stitch embroidered logo&hellip;</div></div>'
                + '<div class="pp-up-order">'
                + '<div class="pp-up-colorrow">Color: <strong class="pp-up-cn" id="pp-up-cn-' + i + '"></strong> <span class="pp-req-hint">(tap a swatch to change)</span></div>'
                + (swBtns ? '<div class="pp-up-colors" id="pp-up-colors-' + i + '">' + swBtns + '</div>' : '')
                + '<div class="pp-field"><span class="pp-flabel">Sizes &amp; quantities <small>(fill in what you need)</small></span>'
                + '<div class="cp-size-grid" id="pp-up-sizes-' + i + '"></div>'
                + '<div class="cp-size-total">Total: <strong id="pp-up-total-' + i + '">0</strong></div></div>'
                + '</div>'
                + '<button class="cp-btn-primary pp-up-btn" type="button" data-up="' + i + '">Send this embroidered upgrade to my rep</button>'
                + '</div>';
        }).join('');
        return '<section class="pp-section pp-upgrade" id="pp-upgrade"><h2>Upgrade to embroidery</h2>'
            + '<p class="pp-section-sub">Your logo, embroidered on a premium garment &mdash; the upgraded version of what you already buy. Your rep quotes the final price.</p>'
            + banner + cards + '</section>';
    }

    var _embCalc = null;
    function embDeps() {
        var d = {};
        if (window.EmbroideryPricingCalculator) d.EmbroideryPricingCalculator = function (opts) { if (!_embCalc) _embCalc = new window.EmbroideryPricingCalculator(opts || { skipInit: true }); return _embCalc; };
        return d;
    }
    function r2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
    function parseRange(label) {
        var s = String(label || '');
        var m = s.match(/(\d+)\s*[-–]\s*(\d+)/); if (m) return { min: +m[1], max: +m[2] };
        var p = s.match(/(\d+)\s*\+/); if (p) return { min: +p[1], max: Infinity };
        var n = s.match(/(\d+)/); return { min: n ? +n[1] : 0, max: Infinity };
    }
    function embGroups(stitch, digitize) {
        return { 'emb:garment': { logos: { primary: { position: 'Left Chest', stitchCount: Number(stitch) || 8000, needsDigitizing: !!digitize }, additional: [] } } };
    }
    function embItem(style, qty) {
        return { id: '__up__', method: 'EMB', styleNumber: style, title: style, colorName: '', catalogColor: '', isCap: false, sizes: { S: qty } };
    }
    // Probe a per-piece EMB price ladder + the digitizing base through the SAME engine Quick Quote uses.
    function probeEmbLadder(style, stitch) {
        var probes = [4, 12, 36, 60, 100];
        var groups = embGroups(stitch, false);
        var byTier = {};
        var chain = probes.reduce(function (ch, q) {
            return ch.then(function () {
                return window.QuoteCartEngine.singleItemPreview(embItem(style, q), { groups: groups, deps: embDeps(), nudge: false })
                    .then(function (pv) {
                        if (pv && pv.ok && pv.lines && pv.lines.length) {
                            var label = pv.tierLabel || ('q' + q);
                            if (!byTier[label]) {
                                var bu = pv.lines[0].baseUnit;
                                var svcPerPc = (pv.serviceLines || []).reduce(function (s, sl) { return s + (Number(sl.total) || 0); }, 0) / q;
                                var oneTimeT = (pv.fees || []).reduce(function (s, f) { return s + (f.oneTime ? (Number(f.amount) || 0) : 0); }, 0);
                                var ltmFlat = (pv.ltm && pv.ltm.fee) || 0;
                                var residual = Math.max(0, (pv.groupTotal - oneTimeT - ltmFlat - (bu + svcPerPc) * q) / q);
                                byTier[label] = { label: label, base: r2(bu + svcPerPc + residual), ltmFee: ltmFlat, range: parseRange(label) };
                            }
                        }
                    }).catch(function () {});
            });
        }, Promise.resolve());
        return chain
            .then(function () { return window.QuoteCartEngine.singleItemPreview(embItem(style, 24), { groups: embGroups(stitch, true), deps: embDeps(), nudge: false }).catch(function () { return null; }); })
            .then(function (digPv) {
                var digBase = 0;
                if (digPv && digPv.fees) digBase = digPv.fees.filter(function (f) { return /digit/i.test(f.label || ''); }).reduce(function (s, f) { return s + (Number(f.amount) || 0); }, 0);
                var tiers = Object.keys(byTier).map(function (k) { return byTier[k]; }).sort(function (a, b) { return a.range.min - b.range.min; });
                return { tiers: tiers, digBase: r2(digBase) };
            });
    }
    function rangeLabel(t) { return (!isFinite(t.range.max)) ? (t.range.min + '+') : (t.range.min + '–' + t.range.max); }
    function embMatrixHtml(tiers, stitch) {
        var hasLtm = tiers.some(function (t) { return t.ltmFee > 0; });
        var head = tiers.map(function (t) { return '<th>' + rangeLabel(t) + '</th>'; }).join('');
        var priceRow = tiers.map(function (t) { return '<td>$' + t.base.toFixed(2) + '</td>'; }).join('');
        var ltmRow = hasLtm ? ('<tr><td class="lbl">Small-batch fee</td>' + tiers.map(function (t) { return '<td class="' + (t.ltmFee > 0 ? 'warn' : '') + '">' + (t.ltmFee > 0 ? '+$' + t.ltmFee.toFixed(2) : '—') + '</td>'; }).join('') + '</tr>') : '';
        return '<div class="pp-up-mxtitle">Price breaks — ' + Number(stitch).toLocaleString() + '-stitch left-chest embroidery</div>'
            + '<div class="pp-up-mxwrap"><table class="pp-up-mxtable"><thead><tr><th class="lbl">Quantity</th>' + head + '</tr></thead>'
            + '<tbody><tr><td class="lbl">Per pc</td>' + priceRow + '</tr>' + ltmRow + '</tbody></table></div>'
            + '<div class="pp-up-mxfoot">Per pc for a standard size; 2XL+ adds its upcharge. Digitizing is a separate one-time fee. Same pricing engine as our quote tools &mdash; your rep confirms the final quote.</div>';
    }
    function priceUpgrade(i, u) {
        var box = document.getElementById('pp-up-mx-' + i);
        if (!box) return;
        if (!(window.QuoteCartEngine && window.EmbroideryPricingCalculator)) { box.innerHTML = '<div class="pp-up-mxnote">Ask your rep for a quick embroidery quote.</div>'; return; }
        probeEmbLadder(u.style, u.stitch).then(function (res) {
            if (!box) return;
            if (!res || !res.tiers.length) box.innerHTML = '<div class="pp-up-mxnote">Ask your rep for a quick embroidery quote.</div>';
            else box.innerHTML = embMatrixHtml(res.tiers, u.stitch);
            if (res && res.digBase > 0) {
                var dg = document.getElementById('pp-up-dig-' + i);
                if (dg) dg.innerHTML = '<i>&#129525;</i> <span><strong>New to embroidery?</strong> We’ll digitize your logo &mdash; <strong>$' + (res.digBase / 2).toFixed(2) + '</strong> <s>$' + res.digBase.toFixed(2) + '</s>, half off. One-time setup, and the file’s yours to reuse.</span>';
            }
        }).catch(function () { if (box) box.innerHTML = '<div class="pp-up-mxnote">Ask your rep for a quick embroidery quote.</div>'; });
    }

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
