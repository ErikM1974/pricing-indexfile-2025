// ══════════════════════════════════════════════════════════════
// Calculator Inventory — Collapsible warehouse inventory grid
// Standalone script — include on any pricing calculator page.
// Requires: <div id="calculator-inventory-section"></div> in HTML
// Auto-detects color swatch clicks via event delegation.
// ══════════════════════════════════════════════════════════════
(function() {
    'use strict';

    // Proxy host from /config/app.config.js (Rule 6) — never guess a backend.
    var CALC_INV_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL) || '';
    if (!CALC_INV_BASE) console.error('[calculator-inventory] APP_CONFIG.API.BASE_URL missing — inventory cannot load');
    var SANMAR_API = CALC_INV_BASE + '/api/sanmar';
    var invCache = {};
    var INV_CACHE_TTL = 5 * 60 * 1000;
    var isExpanded = false;
    var currentRequestId = 0;
    var colorMapCache = {}; // Maps style -> {COLOR_NAME -> CATALOG_COLOR}

    // Lookup CATALOG_COLOR from COLOR_NAME via API (cached per style)
    function lookupCatalogColor(styleNumber, colorName, callback) {
        if (!styleNumber || !colorName) return callback(colorName);
        var mapKey = styleNumber.toUpperCase();
        if (colorMapCache[mapKey]) {
            var mapped = colorMapCache[mapKey][colorName] || colorMapCache[mapKey][colorName.trim()] || colorName;
            return callback(mapped);
        }
        // Fetch color swatches to build the mapping
        fetch(CALC_INV_BASE + '/api/color-swatches?styleNumber=' + encodeURIComponent(styleNumber))
            .then(function(r) { return r.json(); })
            .then(function(colors) {
                var map = {};
                if (Array.isArray(colors)) {
                    colors.forEach(function(c) {
                        var cn = c.COLOR_NAME || c.colorName || '';
                        var cc = c.CATALOG_COLOR || c.catalogColor || cn;
                        map[cn] = cc;
                        map[cn.trim()] = cc;
                    });
                }
                colorMapCache[mapKey] = map;
                callback(map[colorName] || map[colorName.trim()] || colorName);
            })
            .catch(function() { callback(colorName); });
    }

    // Styles: /shared_components/css/calculator-inventory.css (linked by every calculator page) — nothing injected.

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

            // Fallback: try to get CATALOG_COLOR from swatch element's data or title
            if (!catalogColor) {
                catalogColor = swatch.getAttribute('data-catalog-color') || swatch.title || colorName;
            }

            // If we only have COLOR_NAME (display name), also try currentColors array
            if (!catalogColor || catalogColor === colorName) {
                var colors = window.currentColors || [];
                for (var i = 0; i < colors.length; i++) {
                    if (colors[i].COLOR_NAME === colorName || colors[i].colorName === colorName) {
                        catalogColor = colors[i].CATALOG_COLOR || colors[i].catalogColor || catalogColor;
                        swatchImg = swatchImg || colors[i].COLOR_SQUARE_IMAGE || colors[i].swatchUrl || '';
                        break;
                    }
                }
            }

            if (colorName || catalogColor) {
                // Always resolve CATALOG_COLOR via lookup to handle abbreviations
                var displayName = colorName || catalogColor;
                if (!catalogColor || catalogColor === colorName) {
                    lookupCatalogColor(style, displayName, function(resolvedCatalog) {
                        window.loadCalculatorInventory(style, resolvedCatalog, displayName, swatchImg);
                    });
                } else {
                    window.loadCalculatorInventory(style, catalogColor, displayName, swatchImg);
                }
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
                // Always resolve CATALOG_COLOR via lookup
                lookupCatalogColor(style, colorName, function(resolvedCatalog) {
                    window.loadCalculatorInventory(style, resolvedCatalog, colorName, '');
                });
            }
        }, 3000);
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

        var cacheKey = styleNumber + '::' + catalogColor;
        var cached = invCache[cacheKey];
        var requestId = ++currentRequestId; // Track this request

        // Render loading bar immediately
        renderBar(container, colorName, swatchUrl, null);

        if (cached && (Date.now() - cached.ts < INV_CACHE_TTL)) {
            renderBar(container, colorName, swatchUrl, cached.data);
            return;
        }

        fetch(SANMAR_API + '/inventory/' + encodeURIComponent(styleNumber) + '?color=' + encodeURIComponent(catalogColor))
            .then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
            .then(function(data) {
                invCache[cacheKey] = { data: data, ts: Date.now() };
                // Only render if this is still the latest request (ignore stale)
                if (requestId === currentRequestId) {
                    renderBar(container, colorName, swatchUrl, data);
                }
            })
            .catch(function(err) {
                if (requestId === currentRequestId) {
                    // 400/404 = the proxy has no SanMar record for this style (Richardson caps, JDS, etc.) —
                    // a retry cannot help, so say what it is instead of "try again" (2026-09-06, C112).
                    var notSanmar = /HTTP 40[04]/.test(err && err.message ? err.message : '');
                    container.innerHTML = renderBarHtml(colorName, swatchUrl, 0) +
                        '<div class="calc-inv-error">' + (notSanmar
                            ? 'Live inventory is not available for this style (not a SanMar item).'
                            : 'Unable to load inventory. Please try again.') + '</div>';
                }
            });
    };

    // Global toggle function (avoids addEventListener leak on re-renders)
    // Bar click / Enter toggles (was an inline handler)
    document.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('[data-calc-inv-toggle]')) window._toggleCalcInventory();
    });
    document.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('[data-calc-inv-toggle]')) { e.preventDefault(); window._toggleCalcInventory(); }
    });
    window._toggleCalcInventory = function() {
        isExpanded = !isExpanded;
        var container = document.getElementById('calculator-inventory-section');
        if (!container) return;
        var body = container.querySelector('.calc-inv-body');
        var bar = container.querySelector('.calc-inv-bar');
        var chevron = container.querySelector('.calc-inv-chevron');
        if (body) body.classList.toggle('show');
        if (bar) bar.classList.toggle('expanded');
        if (chevron) chevron.classList.toggle('open');
    };

    function renderBar(container, colorName, swatchUrl, data) {
        var total = (data && typeof data.grandTotal === 'number') ? data.grandTotal : 0;
        var barHtml = renderBarHtml(colorName, swatchUrl, total);
        var bodyHtml = data ? renderTable(data) : '<div class="calc-inv-loading"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading inventory...</div>';

        container.innerHTML = barHtml +
            '<div class="calc-inv-body' + (isExpanded ? ' show' : '') + '">' + bodyHtml + '</div>';
    }

    function renderBarHtml(colorName, swatchUrl, total) {
        var swatchImg = swatchUrl ? '<img src="' + swatchUrl + '" alt="" class="calc-inv-swatch">' : '';
        return '<div class="calc-inv-bar' + (isExpanded ? ' expanded' : '') + '" data-calc-inv-toggle role="button" tabindex="0">' +
            '<div class="calc-inv-bar-left">' +
            swatchImg +
            '<span class="calc-inv-color-name">' + escHtml(colorName || '') + '</span>' +
            '<span class="calc-inv-label"><i class="fas fa-warehouse" aria-hidden="true"></i> Warehouse Inventory</span>' +
            '</div>' +
            '<div class="calc-inv-right">' +
            (total ? '<span class="calc-inv-total">' + total.toLocaleString() + ' units</span>' : '') +
            '<i class="fas fa-chevron-down calc-inv-chevron' + (isExpanded ? ' open' : '') + '" aria-hidden="true"></i>' +
            '</div>' +
            '</div>';
    }

    function renderTable(data) {
        if (!data || !data.inventory || data.inventory.length === 0) return '<div class="calc-inv-loading">No inventory data available</div>';
        var inv = data.inventory;
        if (!inv[0] || !inv[0].warehouses) return '<div class="calc-inv-loading">Inventory format unavailable</div>';
        var warehouses = inv[0].warehouses;

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
