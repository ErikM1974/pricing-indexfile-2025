// ══════════════════════════════════════════════════════════════
// Calculator Inventory — Collapsible warehouse inventory grid
// Standalone script — include on any pricing calculator page.
// Requires: <div id="calculator-inventory-section"></div> in HTML
// Auto-detects color swatch clicks via event delegation.
// ══════════════════════════════════════════════════════════════
(function() {
    'use strict';

    var SANMAR_API = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com/api/sanmar';
    var invCache = {};
    var INV_CACHE_TTL = 5 * 60 * 1000;
    var isExpanded = false;

    // Inject CSS
    var style = document.createElement('style');
    style.textContent = [
        '.calc-inventory-section { max-width: 960px; margin: 1.5rem auto; font-family: inherit; }',
        '.calc-inv-bar { display: flex; align-items: center; justify-content: space-between; padding: 0.65rem 1rem; background: linear-gradient(135deg, #2f661e 0%, #3a9940 100%); color: white; border-radius: 8px; cursor: pointer; user-select: none; transition: border-radius 0.2s; }',
        '.calc-inv-bar.expanded { border-radius: 8px 8px 0 0; }',
        '.calc-inv-bar-left { display: flex; align-items: center; gap: 0.6rem; }',
        '.calc-inv-swatch { width: 28px; height: 28px; border-radius: 50%; border: 2px solid rgba(255,255,255,0.5); object-fit: cover; }',
        '.calc-inv-color-name { font-weight: 700; font-size: 0.95rem; color: #fff; }',
        '.calc-inv-label { font-size: 0.8rem; opacity: 0.85; margin-left: 0.5rem; }',
        '.calc-inv-right { display: flex; align-items: center; gap: 0.75rem; }',
        '.calc-inv-total { font-size: 0.75rem; background: rgba(255,255,255,0.2); padding: 0.2rem 0.6rem; border-radius: 12px; font-weight: 600; }',
        '.calc-inv-chevron { transition: transform 0.3s; font-size: 0.85rem; }',
        '.calc-inv-chevron.open { transform: rotate(180deg); }',
        '.calc-inv-body { display: none; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px; background: #fafafa; overflow-x: auto; }',
        '.calc-inv-body.show { display: block; }',
        '.calc-inv-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; white-space: nowrap; }',
        '.calc-inv-table th { background: #f5f5f5; color: #333; font-weight: 600; padding: 0.45rem 0.5rem; text-align: center; border-bottom: 2px solid #ddd; }',
        '.calc-inv-table th:first-child { text-align: left; min-width: 95px; }',
        '.calc-inv-table td { padding: 0.35rem 0.5rem; text-align: center; border-bottom: 1px solid #eee; font-variant-numeric: tabular-nums; }',
        '.calc-inv-table td:first-child { text-align: left; font-weight: 500; color: #555; font-size: 0.73rem; }',
        '.calc-inv-good { background: #e8f5e9; color: #2e7d32; }',
        '.calc-inv-low { background: #fff8e1; color: #f57f17; font-weight: 600; }',
        '.calc-inv-out { background: #ffebee; color: #c62828; }',
        '.calc-inv-total-row td { font-weight: 700; border-top: 2px solid #ccc; background: #f0f0f0; }',
        '.calc-inv-loading { padding: 1rem; text-align: center; color: #888; font-size: 0.8rem; }',
        '.calc-inv-error { padding: 0.75rem; text-align: center; color: #c62828; font-size: 0.8rem; background: #ffebee; border-radius: 0 0 8px 8px; border: 1px solid #e0e0e0; border-top: none; }',
        '@media (max-width: 768px) { .calc-inv-table { font-size: 0.68rem; } .calc-inv-table td, .calc-inv-table th { padding: 0.25rem 0.35rem; } .calc-inv-label { display: none; } }'
    ].join('\n');
    document.head.appendChild(style);

    // Auto-detect color swatch clicks via event delegation
    document.addEventListener('click', function(e) {
        var swatch = e.target.closest('.color-swatch');
        if (!swatch) return;

        // Delay to let the page's own click handler update state
        setTimeout(function() {
            var style = getStyleNumber();
            if (!style) return;

            // Try multiple sources for color info
            var colorObj = window.selectedColor || {};
            var catalogColor = colorObj.CATALOG_COLOR || colorObj.catalogColor || '';
            var colorName = colorObj.COLOR_NAME || colorObj.colorName || '';
            var swatchImg = colorObj.COLOR_SQUARE_IMAGE || colorObj.swatchUrl || '';

            // Fallback: read from DOM
            if (!colorName) {
                var el = document.getElementById('currentColor');
                if (el) colorName = el.textContent.trim();
            }
            if (!catalogColor) {
                catalogColor = swatch.title || colorName;
            }

            if (catalogColor || colorName) {
                window.loadCalculatorInventory(style, catalogColor || colorName, colorName || catalogColor, swatchImg);
            }
        }, 150);
    });

    // Also auto-load on page init if color is pre-selected
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(function() {
            var style = getStyleNumber();
            var colorEl = document.getElementById('currentColor');
            var colorName = colorEl ? colorEl.textContent.trim() : '';
            if (style && colorName && colorName !== 'Natural' && colorName !== 'Color') {
                var colorObj = window.selectedColor || {};
                window.loadCalculatorInventory(
                    style,
                    colorObj.CATALOG_COLOR || colorObj.catalogColor || colorName,
                    colorName,
                    colorObj.COLOR_SQUARE_IMAGE || colorObj.swatchUrl || ''
                );
            }
        }, 3000); // Wait for product to load
    });

    function getStyleNumber() {
        // Try all known global variable names across calculators
        if (window.currentStyleNumber) return window.currentStyleNumber;
        if (window.selectedStyleNumber) return window.selectedStyleNumber;
        if (window.currentProduct && window.currentProduct.STYLE) return window.currentProduct.STYLE;

        // Fallback: read from DOM
        var el = document.getElementById('currentStyle');
        if (el) {
            var text = el.textContent.replace('#', '').trim();
            if (text) return text;
        }

        // Fallback: URL params
        var params = new URLSearchParams(window.location.search);
        return params.get('StyleNumber') || params.get('styleNumber') || params.get('style') || '';
    }

    window.loadCalculatorInventory = function(styleNumber, catalogColor, colorName, swatchUrl) {
        var container = document.getElementById('calculator-inventory-section');
        if (!container) return;
        if (!styleNumber || !catalogColor) {
            container.innerHTML = '';
            return;
        }

        var cacheKey = styleNumber + '-' + catalogColor;
        var cached = invCache[cacheKey];

        // Render bar immediately
        renderBar(container, colorName, swatchUrl, null);

        if (cached && (Date.now() - cached.ts < INV_CACHE_TTL)) {
            renderBar(container, colorName, swatchUrl, cached.data);
            return;
        }

        fetch(SANMAR_API + '/inventory/' + encodeURIComponent(styleNumber) + '?color=' + encodeURIComponent(catalogColor))
            .then(function(r) { if (!r.ok) throw new Error('fail'); return r.json(); })
            .then(function(data) {
                invCache[cacheKey] = { data: data, ts: Date.now() };
                renderBar(container, colorName, swatchUrl, data);
            })
            .catch(function() {
                container.innerHTML = renderBarHtml(colorName, swatchUrl, 0) +
                    '<div class="calc-inv-error">Unable to load inventory</div>';
            });
    };

    function renderBar(container, colorName, swatchUrl, data) {
        var total = data ? data.grandTotal : 0;
        var barHtml = renderBarHtml(colorName, swatchUrl, total);
        var bodyHtml = data ? renderTable(data) : '<div class="calc-inv-loading"><i class="fas fa-spinner fa-spin"></i> Loading inventory...</div>';

        container.innerHTML = barHtml +
            '<div class="calc-inv-body' + (isExpanded ? ' show' : '') + '">' + bodyHtml + '</div>';

        var bar = container.querySelector('.calc-inv-bar');
        var body = container.querySelector('.calc-inv-body');
        var chevron = container.querySelector('.calc-inv-chevron');
        if (bar) {
            bar.addEventListener('click', function() {
                isExpanded = !isExpanded;
                body.classList.toggle('show');
                bar.classList.toggle('expanded');
                chevron.classList.toggle('open');
            });
            if (isExpanded) bar.classList.add('expanded');
        }
    }

    function renderBarHtml(colorName, swatchUrl, total) {
        var swatchImg = swatchUrl ? '<img src="' + swatchUrl + '" alt="" class="calc-inv-swatch">' : '';
        return '<div class="calc-inv-bar' + (isExpanded ? ' expanded' : '') + '">' +
            '<div class="calc-inv-bar-left">' +
            swatchImg +
            '<span class="calc-inv-color-name">' + escHtml(colorName || '') + '</span>' +
            '<span class="calc-inv-label"><i class="fas fa-warehouse"></i> Warehouse Inventory</span>' +
            '</div>' +
            '<div class="calc-inv-right">' +
            (total ? '<span class="calc-inv-total">' + total.toLocaleString() + ' units</span>' : '') +
            '<i class="fas fa-chevron-down calc-inv-chevron' + (isExpanded ? ' open' : '') + '"></i>' +
            '</div>' +
            '</div>';
    }

    function renderTable(data) {
        if (!data || !data.inventory || data.inventory.length === 0) return '<div class="calc-inv-loading">No inventory data</div>';
        var inv = data.inventory;
        var warehouses = inv[0].warehouses || [];

        var sizeHeaders = inv.map(function(item) { return '<th>' + item.size + '</th>'; }).join('');
        var whRows = warehouses.map(function(wh) {
            var cells = inv.map(function(item) {
                var w = (item.warehouses || []).find(function(x) { return x.id === wh.id; });
                var qty = w ? w.qty : 0;
                var cls = qty === 0 ? 'calc-inv-out' : qty < 50 ? 'calc-inv-low' : 'calc-inv-good';
                return '<td class="' + cls + '">' + qty.toLocaleString() + '</td>';
            }).join('');
            return '<tr><td>' + escHtml(wh.name) + '</td>' + cells + '</tr>';
        }).join('');

        var totalCells = inv.map(function(item) {
            var cls = item.totalQty === 0 ? 'calc-inv-out' : item.totalQty < 50 ? 'calc-inv-low' : 'calc-inv-good';
            return '<td class="' + cls + '">' + item.totalQty.toLocaleString() + '</td>';
        }).join('');

        return '<table class="calc-inv-table">' +
            '<thead><tr><th>Warehouse</th>' + sizeHeaders + '</tr></thead>' +
            '<tbody>' + whRows + '</tbody>' +
            '<tfoot><tr class="calc-inv-total-row"><td>TOTAL</td>' + totalCells + '</tr></tfoot>' +
            '</table>';
    }

    function escHtml(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }
})();
