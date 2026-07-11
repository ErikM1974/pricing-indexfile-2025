/**
 * nwca-form-styles.js — SanMar style lookup for the fillable form twins.
 *
 * Per-row style assist using the SAME public proxy endpoints the quote
 * builders trust: GET /api/stylesearch?term= ([{value: STYLE, label: TITLE}])
 * and GET /api/product-colors?styleNumber= ({colors:[{COLOR_NAME,
 * CATALOG_COLOR,…}], CATEGORY_NAME}).
 *
 * NWCAFormStyles.attachRow({ styleInput, colorCell, descInput, onProduct })
 *   - type-ahead dropdown on the style input
 *   - picking a style fills the description with the product title and swaps
 *     the color cell's text input for a <select> of that style's REAL colors
 *     (display COLOR_NAME; the row remembers CATALOG_COLOR — needed if this
 *     submission is ever pushed to ShopWorks). "— type color manually —"
 *     restores the free-text input (catalog color cleared: unverified).
 *   - lookup failure never blocks: everything stays hand-typable.
 */
(function (global) {
    'use strict';

    var DEBOUNCE_MS = 250;
    var MIN_CHARS = 2;
    var colorsCache = {};

    function apiBase() {
        if (global.APP_CONFIG && global.APP_CONFIG.API && global.APP_CONFIG.API.BASE_URL) {
            return global.APP_CONFIG.API.BASE_URL.replace(/\/+$/, '');
        }
        return null;
    }

    function attachRow(opts) {
        var styleInput = opts.styleInput;
        if (!styleInput) return;

        var box = document.createElement('div');
        box.className = 'contacts-dropdown styles-dropdown';
        box.hidden = true;
        var parent = styleInput.parentNode;
        parent.classList.add('contacts-anchor');
        parent.appendChild(box);

        var timer = null;
        var lastQuery = '';
        var items = [];
        var active = -1;
        var suppressNext = false;

        styleInput.setAttribute('autocomplete', 'off');

        styleInput.addEventListener('input', function () {
            if (suppressNext) { suppressNext = false; return; }
            var q = styleInput.value.trim();
            if (timer) clearTimeout(timer);
            if (q.length < MIN_CHARS) { hide(); return; }
            timer = setTimeout(function () { search(q); }, DEBOUNCE_MS);
        });

        styleInput.addEventListener('keydown', function (e) {
            if (box.hidden) return;
            if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
            else if (e.key === 'Enter') { if (active >= 0) { e.preventDefault(); pick(items[active]); } }
            else if (e.key === 'Escape') { hide(); }
        });

        document.addEventListener('click', function (e) {
            if (e.target !== styleInput && !box.contains(e.target)) hide();
        });

        function search(q) {
            var base = apiBase();
            if (!base) { hide(); return; }
            lastQuery = q;
            fetch(base + '/api/stylesearch?term=' + encodeURIComponent(q))
                .then(function (resp) {
                    if (!resp.ok) throw new Error('HTTP ' + resp.status);
                    return resp.json();
                })
                .then(function (data) {
                    if (q !== lastQuery) return;
                    render(data || []);
                })
                .catch(function (err) {
                    console.error('[form-styles] style search failed:', err);
                    renderMessage('Style lookup unavailable — keep typing manually.');
                });
        }

        function render(results) {
            box.innerHTML = '';
            items = [];
            active = -1;
            if (!results.length) { renderMessage('No SanMar match — keep typing manually.'); return; }
            results.slice(0, 10).forEach(function (r, i) {
                var el = document.createElement('div');
                el.className = 'contacts-row';
                el.innerHTML = '<strong>' + escapeHtml(r.value) + '</strong> <span class="contacts-muted">' + escapeHtml(r.label || '') + '</span>';
                el.addEventListener('mousedown', function (e) { e.preventDefault(); pick(items[i]); });
                el.addEventListener('mousemove', function () { setActive(i); });
                items.push({ el: el, style: r.value, title: r.label || '' });
                box.appendChild(el);
            });
            box.hidden = false;
        }

        function renderMessage(text) {
            box.innerHTML = '';
            items = [];
            active = -1;
            var el = document.createElement('div');
            el.className = 'contacts-row contacts-row--empty';
            el.textContent = text;
            box.appendChild(el);
            box.hidden = false;
        }

        function move(delta) {
            if (!items.length) return;
            setActive((active + delta + items.length) % items.length);
        }

        function setActive(i) {
            if (active >= 0 && items[active]) items[active].el.classList.remove('is-active');
            active = i;
            if (items[active]) {
                items[active].el.classList.add('is-active');
                items[active].el.scrollIntoView({ block: 'nearest' });
            }
        }

        function pick(item) {
            if (!item) return;
            if (timer) clearTimeout(timer);
            lastQuery = '';
            suppressNext = true;
            styleInput.value = item.style;
            styleInput.dispatchEvent(new Event('input', { bubbles: true }));
            hide();
            if (opts.descInput && item.title && !opts.descInput.dataset.manual) {
                opts.descInput.value = item.title;
            }
            loadColors(item.style, opts);
            if (typeof opts.onProduct === 'function') opts.onProduct(item);
        }

        function hide() {
            box.hidden = true;
            items = [];
            active = -1;
        }
    }

    function loadColors(styleNumber, opts) {
        var base = apiBase();
        var colorCell = opts.colorCell;
        if (!base || !colorCell) return;

        var apply = function (data) {
            var colors = (data && data.colors) || [];
            if (!colors.length) return;
            buildColorSelect(colorCell, colors);
        };

        if (colorsCache[styleNumber]) { apply(colorsCache[styleNumber]); return; }
        fetch(base + '/api/product-colors?styleNumber=' + encodeURIComponent(styleNumber))
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                colorsCache[styleNumber] = data;
                apply(data);
            })
            .catch(function (err) {
                console.error('[form-styles] colors failed:', err); // text input stays — never blocks
            });
    }

    function buildColorSelect(colorCell, colors) {
        var textInput = colorCell.querySelector('input');
        var old = colorCell.querySelector('select');
        if (old) old.remove();

        var select = document.createElement('select');
        select.className = 'color-select';
        select.setAttribute('aria-label', 'Color');
        var opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = '— pick color —';
        select.appendChild(opt0);
        colors.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.COLOR_NAME || '';
            opt.dataset.catalogColor = c.CATALOG_COLOR || '';
            opt.textContent = c.COLOR_NAME || '';
            select.appendChild(opt);
        });
        var optManual = document.createElement('option');
        optManual.value = '__manual__';
        optManual.textContent = '— type color manually —';
        select.appendChild(optManual);

        select.addEventListener('change', function () {
            if (select.value === '__manual__') {
                select.remove();
                textInput.hidden = false;
                delete textInput.dataset.catalogColor; // manual = unverified
                textInput.focus();
                return;
            }
            var picked = select.options[select.selectedIndex];
            textInput.value = select.value;
            textInput.dataset.catalogColor = (picked && picked.dataset.catalogColor) || '';
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
        });

        textInput.hidden = true;
        colorCell.appendChild(select);
        // preselect if the text input already holds one of the colors
        if (textInput.value) {
            for (var i = 0; i < select.options.length; i++) {
                if (select.options[i].value.toLowerCase() === textInput.value.toLowerCase()) {
                    select.selectedIndex = i;
                    textInput.dataset.catalogColor = select.options[i].dataset.catalogColor || '';
                    break;
                }
            }
        }
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    global.NWCAFormStyles = { attachRow: attachRow };
})(window);
