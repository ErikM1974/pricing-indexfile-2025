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

    // Swatch picker (Erik 2026-07-11: "like the quote builder"). A button shows
    // the picked swatch+name; clicking opens a swatch grid. Built ONCE per
    // colors load and toggled — never regenerated on hover (archived combobox
    // lesson: regenerating DOM mid-hover eats the click).
    function buildColorSelect(colorCell, colors) {
        var textInput = colorCell.querySelector('input');
        var oldBtn = colorCell.querySelector('.swatch-btn');
        if (oldBtn) oldBtn.remove();
        var oldGrid = colorCell.querySelector('.swatch-grid');
        if (oldGrid) oldGrid.remove();

        colorCell.classList.add('contacts-anchor');

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'swatch-btn';
        btn.setAttribute('aria-label', 'Pick color');
        btn.innerHTML = '<span class="swatch-chip"></span><span class="swatch-name">— pick color —</span>';

        var grid = document.createElement('div');
        grid.className = 'swatch-grid';
        grid.hidden = true;

        function choose(colorName, catalogColor, img) {
            textInput.value = colorName;
            textInput.dataset.catalogColor = catalogColor || '';
            btn.querySelector('.swatch-name').textContent = colorName || '— pick color —';
            var chip = btn.querySelector('.swatch-chip');
            chip.style.backgroundImage = img ? 'url("' + img + '")' : 'none';
            grid.hidden = true;
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        colors.forEach(function (c) {
            var cell = document.createElement('button');
            cell.type = 'button';
            cell.className = 'swatch-cell';
            cell.title = c.COLOR_NAME || '';
            var img = c.COLOR_SQUARE_IMAGE || '';
            cell.innerHTML = '<span class="swatch-chip"' + (img ? ' style="background-image:url(&quot;' + img + '&quot;)"' : '') + '></span>' +
                '<span class="swatch-cell-name">' + escapeHtml(c.COLOR_NAME || '') + '</span>';
            cell.addEventListener('click', function (e) {
                e.preventDefault();
                choose(c.COLOR_NAME || '', c.CATALOG_COLOR || '', img);
            });
            grid.appendChild(cell);
        });

        var manual = document.createElement('button');
        manual.type = 'button';
        manual.className = 'swatch-cell swatch-cell--manual';
        manual.textContent = '⌨ type color manually';
        manual.addEventListener('click', function (e) {
            e.preventDefault();
            btn.remove();
            grid.remove();
            textInput.hidden = false;
            delete textInput.dataset.catalogColor; // manual = unverified
            textInput.focus();
        });
        grid.appendChild(manual);

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            grid.hidden = !grid.hidden;
        });
        document.addEventListener('click', function (e) {
            if (!colorCell.contains(e.target)) grid.hidden = true;
        });

        textInput.hidden = true;
        colorCell.appendChild(btn);
        colorCell.appendChild(grid);

        // preselect if the text input already holds one of the colors
        if (textInput.value) {
            var match = colors.filter(function (c) { return (c.COLOR_NAME || '').toLowerCase() === textInput.value.toLowerCase(); })[0];
            if (match) choose(match.COLOR_NAME, match.CATALOG_COLOR, match.COLOR_SQUARE_IMAGE || '');
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

    // ── Size list + extended-size upcharges (for dynamic size cells) ───────
    // sizes: /api/sizes-by-style-color (CATALOG color) → ordered real sizes.
    // upcharges: /api/max-prices-by-style → sellingPriceDisplayAddOns map
    // {SIZE: dollars} straight from Caspio Standard_Size_Upcharges (the same
    // source the pricing engine reads — Rule 9: never hardcoded).
    var sizesCache = {};
    var upchargeCache = {};

    function loadSizes(styleNumber, catalogColor) {
        var base = apiBase();
        var key = styleNumber + '|' + catalogColor;
        if (sizesCache[key]) return Promise.resolve(sizesCache[key]);
        if (!base) return Promise.reject(new Error('config missing'));
        return fetch(base + '/api/sizes-by-style-color?styleNumber=' + encodeURIComponent(styleNumber) + '&color=' + encodeURIComponent(catalogColor))
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
                var sizes = (data && data.sizes) || [];
                sizesCache[key] = sizes;
                return sizes;
            });
    }

    function loadUpcharges(styleNumber) {
        var base = apiBase();
        if (upchargeCache[styleNumber]) return Promise.resolve(upchargeCache[styleNumber]);
        if (!base) return Promise.reject(new Error('config missing'));
        return fetch(base + '/api/max-prices-by-style?styleNumber=' + encodeURIComponent(styleNumber))
            .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function (data) {
                var map = (data && data.sellingPriceDisplayAddOns) || {};
                upchargeCache[styleNumber] = map;
                return map;
            });
    }

    global.NWCAFormStyles = { attachRow: attachRow, loadSizes: loadSizes, loadUpcharges: loadUpcharges };
})(window);
