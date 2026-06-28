/**
 * Safety-Stripe Garment Recommendations — shared renderer
 * --------------------------------------------------------
 * One component used by every surface (the 4 quote builders, Quick Quote, and
 * the customer catalog) so the curated hi-vis top-sellers stay in sync and a
 * Caspio edit needs no deploy. Data: GET /api/safety-stripes/top-sellers/styles
 * (Caspio table Safety_Stripe_Top_Sellers_2026, Erik-curated from 13 yrs of
 * hi-vis sales). Product image/colors hydrate from SanMar server-side.
 *
 * Usage:
 *   SafetyStripeRecs.render('mount-id', {
 *     variant: 'builder' | 'catalog',     // card style (default 'builder')
 *     audience: 'staff' | 'customer',      // 'customer' hides sales numbers (default 'staff')
 *     limit: 6,                            // max styles (default all)
 *     title:  'Recommended safety apparel',
 *     subtitle: 'Top hi-vis sellers that pair with safety stripes',
 *     onAdd: function(style, color) { ... }// builder: add to quote; catalog: omit → links to PDP
 *   });
 *
 * Recommendations are optional UX sugar: on fetch failure the panel hides itself
 * (logs a warning) rather than showing wrong/empty data — never blocks a quote.
 */
(function (global) {
  'use strict';

  var API_BASE = (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL)
    || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';
  var ENDPOINT = API_BASE + '/api/safety-stripes/top-sellers/styles';
  var CACHE_KEY = 'safetyStripeRecs.v1';
  var CACHE_TTL = 5 * 60 * 1000;

  // Hi-vis swatch dots — map known safety color names to representative hex.
  var SAFETY_HEX = {
    green: '#b9d300',  // hi-vis lime-green
    orange: '#ff6a13',
    yellow: '#f4e500',
    lime: '#b9d300',
    pink: '#ff5da2'
  };
  function hueHex(colorName) {
    var n = String(colorName || '').toLowerCase();
    var keys = Object.keys(SAFETY_HEX);
    for (var i = 0; i < keys.length; i++) { if (n.indexOf(keys[i]) !== -1) return SAFETY_HEX[keys[i]]; }
    return '#9aa0a6';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var _inflight = null;
  function fetchStyles() {
    // sessionStorage cache (shared across surfaces within a tab)
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.ts && (Date.now() - parsed.ts) < CACHE_TTL && Array.isArray(parsed.records)) {
          return Promise.resolve(parsed.records);
        }
      }
    } catch (e) { /* ignore */ }

    if (_inflight) return _inflight;
    _inflight = fetch(ENDPOINT)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        var records = (j && Array.isArray(j.records)) ? j.records : [];
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), records: records })); } catch (e) {}
        _inflight = null;
        return records;
      })
      .catch(function (err) {
        _inflight = null;
        throw err;
      });
    return _inflight;
  }

  function colorDotsHtml(style) {
    var colors = Array.isArray(style.colors) ? style.colors : [];
    return colors.map(function (c, i) {
      return '<button type="button" class="ssr-swatch' + (i === 0 ? ' is-selected' : '') + '"'
        + ' style="background:' + hueHex(c.color_name) + '"'
        + ' title="' + esc(c.color_name) + '"'
        + ' data-color-name="' + esc(c.color_name) + '"'
        + ' data-catalog-color="' + esc(c.catalog_color) + '"'
        + ' data-img="' + esc(c.front_image_url || '') + '"'
        + ' aria-label="' + esc(c.color_name) + '"></button>';
    }).join('');
  }

  function cardHtml(style, opts) {
    var isCustomer = opts.audience === 'customer';
    var isCatalog = opts.variant === 'catalog';
    var img = style.main_image_url || '';
    var photo = img
      ? '<img class="ssr-photo-img" src="' + esc(img) + '" alt="' + esc(style.product_title) + '" loading="lazy">'
      : '<span class="ssr-photo-pending">Photo coming soon</span>';
    var rankBadge = (!isCustomer && style.style_rank)
      ? '<span class="ssr-badge ssr-badge-rank">#' + esc(style.style_rank) + ' seller</span>'
      : (isCustomer ? '<span class="ssr-badge ssr-badge-hivis">Popular for hi-vis</span>' : '');
    var note = style.best_for ? '<div class="ssr-note">' + esc(style.best_for) + '</div>' : '';
    var brandStyle = esc(style.style);

    var action = isCatalog
      ? '' // catalog cards are whole-card links (built below)
      : '<button type="button" class="ssr-add" data-style="' + esc(style.style) + '">'
          + '<i class="fas fa-plus"></i> ' + esc(opts.addLabel || 'Add to quote') + '</button>';

    var inner =
      '<div class="ssr-photo">' + photo + rankBadge + '</div>'
      + '<div class="ssr-body">'
      + '<div class="ssr-style">' + brandStyle + '</div>'
      + '<div class="ssr-name">' + esc(style.product_title) + '</div>'
      + '<div class="ssr-swatches">' + colorDotsHtml(style) + '</div>'
      + note
      + action
      + '</div>';

    if (isCatalog) {
      var top = (style.colors && style.colors[0]) || {};
      var href = '/product.html?style=' + encodeURIComponent(style.style)
        + (top.color_name ? '&color=' + encodeURIComponent(top.color_name) : '');
      return '<a class="ssr-card ssr-card-link" href="' + href + '" data-style="' + esc(style.style) + '">' + inner + '</a>';
    }
    return '<div class="ssr-card" data-style="' + esc(style.style) + '">' + inner + '</div>';
  }

  function wire(root, records, opts) {
    // Swatch click: select + swap hero. (On catalog cards it also rewrites the link.)
    root.addEventListener('click', function (ev) {
      var sw = ev.target.closest ? ev.target.closest('.ssr-swatch') : null;
      if (sw) {
        var card = sw.closest('.ssr-card');
        if (!card) return;
        // catalog: let the swatch update the link target, then allow navigation
        card.querySelectorAll('.ssr-swatch').forEach(function (s) { s.classList.remove('is-selected'); });
        sw.classList.add('is-selected');
        var heroImg = sw.getAttribute('data-img');
        var heroEl = card.querySelector('.ssr-photo-img');
        if (heroImg && heroEl) heroEl.src = heroImg;
        if (card.classList.contains('ssr-card-link')) {
          var st = card.getAttribute('data-style');
          card.setAttribute('href', '/product.html?style=' + encodeURIComponent(st)
            + '&color=' + encodeURIComponent(sw.getAttribute('data-color-name') || ''));
        } else {
          ev.preventDefault();
        }
        return;
      }
      var addBtn = ev.target.closest ? ev.target.closest('.ssr-add') : null;
      if (addBtn && typeof opts.onAdd === 'function') {
        ev.preventDefault();
        var card2 = addBtn.closest('.ssr-card');
        var style = card2 && card2.getAttribute('data-style');
        var rec = records.find(function (r) { return r.style === style; });
        var selected = card2 && card2.querySelector('.ssr-swatch.is-selected');
        var color = selected
          ? { color_name: selected.getAttribute('data-color-name'), catalog_color: selected.getAttribute('data-catalog-color') }
          : (rec && rec.colors && rec.colors[0]) || { color_name: '', catalog_color: '' };
        try { opts.onAdd(style, color, rec); } catch (e) { console.error('[SafetyStripeRecs] onAdd error:', e); }
        // brief affordance
        var orig = addBtn.innerHTML;
        addBtn.innerHTML = '<i class="fas fa-check"></i> Added';
        addBtn.classList.add('is-added');
        setTimeout(function () { addBtn.innerHTML = orig; addBtn.classList.remove('is-added'); }, 1400);
      }
    });
  }

  /**
   * Render recommendation cards into `mountId`.
   * @returns {Promise<number>} count of styles rendered (0 = hidden)
   */
  function render(mountId, opts) {
    opts = opts || {};
    var root = (typeof mountId === 'string') ? document.getElementById(mountId) : mountId;
    if (!root) return Promise.resolve(0);

    var title = opts.title || 'Recommended safety apparel';
    var subtitle = opts.subtitle || 'Top hi-vis sellers that pair with safety stripes';

    return fetchStyles().then(function (records) {
      if (!records.length) { root.hidden = true; root.innerHTML = ''; return 0; }
      var list = (opts.limit > 0) ? records.slice(0, opts.limit) : records;
      root.classList.add('ssr-panel');
      root.classList.toggle('ssr-customer', opts.audience === 'customer');
      root.hidden = false;
      root.innerHTML =
        '<div class="ssr-head">'
        + '<span class="ssr-head-title"><i class="fas fa-bolt ssr-head-icon"></i>' + esc(title) + '</span>'
        + (subtitle ? '<span class="ssr-head-sub">' + esc(subtitle) + '</span>' : '')
        + '</div>'
        + '<div class="ssr-grid">' + list.map(function (s) { return cardHtml(s, opts); }).join('') + '</div>';
      wire(root, list, opts);
      return list.length;
    }).catch(function (err) {
      // Optional cross-sell — fail quiet (hide), never block or show wrong data.
      console.warn('[SafetyStripeRecs] recommendations unavailable:', err.message);
      root.hidden = true; root.innerHTML = '';
      return 0;
    });
  }

  global.SafetyStripeRecs = { render: render, fetchStyles: fetchStyles, _apiBase: API_BASE };
})(window);
