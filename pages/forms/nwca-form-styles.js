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
    var colorRequests = new WeakMap();
    var pickerSequence = 0;
    var floatingPickers = [];

    // Table scrolling must not clip a menu in the final row. Fixed menus stay
    // in the viewport; reposition on either page or table scroll.
    function placePicker(box, anchor) {
        // The public quote-request form still owns its legacy popup CSS.
        if (box.hidden || !anchor.closest('[data-ui="unified"][data-form="printable"]')) return;
        var rect = anchor.getBoundingClientRect();
        var width = Math.min(330, window.innerWidth - 24);
        var below = window.innerHeight - rect.bottom - 12;
        var above = rect.top - 12;
        var height = Math.max(44, Math.min(280, Math.max(below, above)));
        box.classList.add('form-picker-floating');
        box.style.width = width + 'px';
        box.style.left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) + 'px';
        box.style.maxHeight = height + 'px';
        box.style.top = (below >= Math.min(280, box.scrollHeight) || below >= above
            ? rect.bottom + 4 : Math.max(12, rect.top - Math.min(height, box.scrollHeight) - 4)) + 'px';
    }

    function trackPicker(box, anchor) { floatingPickers.push({ box: box, anchor: anchor }); }
    function positionOpenPickers() {
        floatingPickers = floatingPickers.filter(function (item) { return item.box.isConnected; });
        floatingPickers.forEach(function (item) { placePicker(item.box, item.anchor); });
    }
    document.addEventListener('scroll', positionOpenPickers, true);
    window.addEventListener('resize', positionOpenPickers);

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
        box.id = 'form-style-options-' + (++pickerSequence);
        box.setAttribute('role', 'listbox');
        box.setAttribute('aria-label', 'Matching garment styles');
        trackPicker(box, styleInput);
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
        styleInput.setAttribute('role', 'combobox');
        styleInput.setAttribute('aria-autocomplete', 'list');
        styleInput.setAttribute('aria-controls', box.id);
        styleInput.setAttribute('aria-expanded', 'false');

        styleInput.addEventListener('input', function () {
            if (suppressNext) { suppressNext = false; return; }
            // Hand-typed styles are allowed too. A previous product's catalog
            // color is no longer verified as soon as its style is edited.
            if (opts.colorCell) {
                colorRequests.set(opts.colorCell, {});
                opts.colorCell.querySelectorAll('.swatch-btn, .swatch-grid').forEach(function (el) { el.remove(); });
                var colorInput = opts.colorCell.querySelector('input');
                if (colorInput) { colorInput.hidden = false; delete colorInput.dataset.catalogColor; }
                colorMessage(opts.colorCell, '');
            }
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
                    if (q !== lastQuery || document.activeElement !== styleInput) return;
                    render(data || []);
                })
                .catch(function (err) {
                    if (q !== lastQuery || document.activeElement !== styleInput) return;
                    console.error('[form-styles] style search failed:', err);
                    renderMessage('Style lookup unavailable — keep typing manually.');
                });
        }

        function render(results) {
            box.setAttribute('role', 'listbox');
            box.innerHTML = '';
            items = [];
            active = -1;
            if (!results.length) { renderMessage('No SanMar match — keep typing manually.'); return; }
            results.slice(0, 10).forEach(function (r, i) {
                var el = document.createElement('div');
                el.className = 'contacts-row';
                el.id = box.id + '-' + i;
                el.setAttribute('role', 'option');
                el.setAttribute('aria-selected', 'false');
                el.innerHTML = '<strong>' + escapeHtml(r.value) + '</strong> <span class="contacts-muted">' + escapeHtml(r.label || '') + '</span>';
                el.addEventListener('mousedown', function (e) { e.preventDefault(); pick(items[i]); });
                el.addEventListener('mousemove', function () { setActive(i); });
                items.push({ el: el, style: r.value, title: r.label || '' });
                box.appendChild(el);
            });
            box.hidden = false;
            styleInput.setAttribute('aria-expanded', 'true');
            placePicker(box, styleInput);
        }

        function renderMessage(text) {
            box.setAttribute('role', 'status');
            box.innerHTML = '';
            items = [];
            active = -1;
            var el = document.createElement('div');
            el.className = 'contacts-row contacts-row--empty';
            el.textContent = text;
            box.appendChild(el);
            box.hidden = false;
            styleInput.setAttribute('aria-expanded', 'true');
            placePicker(box, styleInput);
        }

        function move(delta) {
            if (!items.length) return;
            setActive((active + delta + items.length) % items.length);
        }

        function setActive(i) {
            if (active >= 0 && items[active]) items[active].el.classList.remove('is-active');
            active = i;
            if (items[active]) {
                items.forEach(function (item, index) { item.el.setAttribute('aria-selected', String(index === active)); });
                styleInput.setAttribute('aria-activedescendant', items[active].el.id);
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
            styleInput.setAttribute('aria-expanded', 'false');
            styleInput.removeAttribute('aria-activedescendant');
            box.hidden = true;
            items = [];
            active = -1;
        }
    }

    function loadColors(styleNumber, opts) {
        var base = apiBase();
        var colorCell = opts.colorCell;
        if (!base || !colorCell) return;
        var request = {};
        colorRequests.set(colorCell, request);
        colorCell.querySelectorAll('.swatch-btn, .swatch-grid').forEach(function (el) { el.remove(); });
        var colorInput = colorCell.querySelector('input');
        if (colorInput) { colorInput.hidden = false; delete colorInput.dataset.catalogColor; }
        colorMessage(colorCell, '');

        var apply = function (data) {
            if (colorRequests.get(colorCell) !== request) return;
            var colors = (data && data.colors) || [];
            if (!colors.length) { colorMessage(colorCell, 'No catalog colors — type color manually.'); return; }
            colorMessage(colorCell, '');
            buildColorSelect(colorCell, colors);
        };

        if (colorsCache[styleNumber]) { apply(colorsCache[styleNumber]); return; }
        fetch(base + '/api/product-colors?styleNumber=' + encodeURIComponent(styleNumber))
            .then(function (resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .then(function (data) {
                if (data && data.colors && data.colors.length) colorsCache[styleNumber] = data;
                apply(data);
            })
            .catch(function (err) {
                if (colorRequests.get(colorCell) !== request) return;
                console.error('[form-styles] colors failed:', err);
                colorMessage(colorCell, 'Color lookup unavailable — type color manually or select the style to retry.');
            });
    }

    // Swatch picker (Erik 2026-07-11: "like the quote builder"). A button shows
    // the picked swatch+name; clicking opens a swatch grid. Built ONCE per
    // colors load and toggled — never regenerated on hover (archived combobox
    // lesson: regenerating DOM mid-hover eats the click).
    function colorMessage(colorCell, text) {
        var message = colorCell.querySelector('.form-lookup-status');
        if (!text) { if (message) message.remove(); return; }
        if (!message) {
            message = document.createElement('div');
            message.className = 'form-lookup-status no-print';
            message.setAttribute('role', 'status');
            colorCell.appendChild(message);
        }
        message.textContent = text;
    }

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
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<span class="swatch-chip"></span><span class="swatch-name">— pick color —</span>';

        var grid = document.createElement('div');
        grid.className = 'swatch-grid';
        grid.id = 'form-color-options-' + (++pickerSequence);
        btn.setAttribute('aria-controls', grid.id);
        trackPicker(grid, btn);
        grid.hidden = true;

        function choose(colorName, catalogColor, img) {
            textInput.value = colorName;
            textInput.dataset.catalogColor = catalogColor || '';
            btn.querySelector('.swatch-name').textContent = colorName || '— pick color —';
            var chip = btn.querySelector('.swatch-chip');
            chip.style.backgroundImage = img ? 'url("' + img + '")' : 'none';
            grid.hidden = true;
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-label', 'Change color: ' + colorName);
            btn.focus();
            textInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Native click handles pointer, Enter and Space once each.
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
                e.stopPropagation();
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
            e.stopPropagation();
            btn.remove();
            grid.remove();
            textInput.hidden = false;
            delete textInput.dataset.catalogColor; // manual = unverified
            textInput.focus();
        });
        grid.appendChild(manual);

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            grid.hidden = !grid.hidden;
            btn.setAttribute('aria-expanded', String(!grid.hidden));
            placePicker(grid, btn);
            if (!grid.hidden) grid.querySelector('button').focus();
        });
        document.addEventListener('mousedown', function (e) {
            if (!colorCell.contains(e.target)) { grid.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
        });

        grid.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                e.preventDefault(); grid.hidden = true; btn.setAttribute('aria-expanded', 'false'); btn.focus();
            }
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
