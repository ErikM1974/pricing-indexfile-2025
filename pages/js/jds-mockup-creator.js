/**
 * jds-mockup-creator.js — Standalone JDS Tumbler Mockup Creator page logic.
 *
 * Orchestrates:
 *   - Color picker (17 Polar Camel SKUs loaded from /api/jds-catalog)
 *   - Tumbler image fetch (via /api/jds/products/:sku, crossOrigin for canvas read)
 *   - Logo file upload (PNG, JPG, SVG — all formats handled by jds-tumbler-template)
 *   - Live canvas preview (source tumbler + masked patch + engraved logo overlay)
 *   - Drag-to-reposition the logo within the imprint area
 *   - Size slider (30–110% of mask width)
 *   - Download as PNG at full 1800×1800 source resolution
 *
 * The heavy lifting (mask, color sampling, logo silhouette, engrave color) lives
 * in jds-tumbler-template.js — this file just wires the UI to that pipeline.
 *
 * Depends on: jds-tumbler-template.js (loaded first), browser canvas, fetch.
 */
(function () {
    'use strict';

    var API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // Render canvas dimensions. The actual source is 1800×1800, but for preview
    // performance we render at 900×900 (half-size) by default. Download still
    // renders at full source resolution by rebuilding the canvas just-in-time.
    var PREVIEW_SIZE = 900;
    var DOWNLOAD_SIZE = 1800;

    // ── State ──────────────────────────────────────────────────────────
    var catalog = [];                 // {SKU, DisplayName, EngraveColor, ThumbnailURL?}[]
    var selectedSku = null;
    var selectedRow = null;
    var tumblerImage = null;          // loaded HTMLImageElement (crossOrigin)
    var logoImage = null;             // loaded HTMLImageElement of uploaded logo
    var logoFileName = '';
    var engravedLogoCanvas = null;    // result of buildEngravedLogo (cached)
    var logoOffset = { dx: 0, dy: 0 };// drag offset from mask center, in source coords
    var logoSizePct = 70;             // % of mask width
    var isDragging = false;
    var dragStart = null;

    // ── Init ───────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        wireFileUpload();
        wireSizeSlider();
        wireDownload();
        wireCanvasDrag();
        loadCatalog();
    });

    // SKUs we exclude from the mockup creator UI. These are valid JDS catalog
    // entries (the AE intake form can still submit them) but NWCA can't
    // physically produce a laser engrave on them, so a mockup would mislead
    // the customer. As of 2026-05-11:
    //   - LTM751 (Polar Camel Stainless Steel): the engrave would be a dark
    //     etch on bare silver/steel, which has too little contrast to be
    //     readable. Erik's call — confirmed during build verification.
    var MOCKUP_EXCLUDED_SKUS = ['LTM751'];

    // ── Catalog fetch + swatch render ──────────────────────────────────
    function loadCatalog() {
        fetch(API_BASE + '/api/jds-catalog?category=Drinkware')
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
            .then(function (data) {
                var raw = (data && data.result) || [];
                catalog = raw.filter(function (r) {
                    return MOCKUP_EXCLUDED_SKUS.indexOf(r.SKU) === -1;
                });
                renderSwatches();
            })
            .catch(function (err) {
                console.error('[jds-mockup-creator] Catalog fetch failed:', err);
                var grid = document.getElementById('jmc-swatch-grid');
                if (grid) {
                    grid.innerHTML = '<div class="jmc-swatch-loading" style="color:#b91c1c;">'
                        + 'Failed to load catalog. Refresh the page to retry.</div>';
                }
            });
    }

    function renderSwatches() {
        var grid = document.getElementById('jmc-swatch-grid');
        if (!grid) return;

        // Color label → hex preview for each swatch. JDS doesn't give us a hex,
        // so we map DisplayName → approximate fill color. The preview is purely
        // a visual indicator on the swatch; the real tumbler color comes from
        // the actual JDS image once selected.
        var colorHints = {
            'Stainless Steel': '#c0c0c0',
            'Black': '#1f2937',
            'Red': '#dc2626',
            'Royal Blue': '#1d4ed8',
            'Pink': '#ec4899',
            'Teal': '#14b8a6',
            'Light Purple': '#c084fc',
            'Purple': '#7c3aed',
            'Dark Gray': '#4b5563',
            'Navy Blue': '#1e3a8a',
            'Orange': '#ea580c',
            'Maroon': '#7f1d1d',
            'White': '#f3f4f6',
            'Green': '#16a34a',
            'Yellow': '#eab308',
            'Coral': '#fb7185',
            'Olive Green': '#65a30d'
        };

        grid.innerHTML = '';
        catalog.forEach(function (row) {
            // Pull "Orange" out of "Polar Camel 16 oz Pint - Orange"
            var colorName = (row.DisplayName || '').split(' - ').pop().trim();
            var hex = colorHints[colorName] || '#9ca3af';

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'jmc-swatch';
            btn.dataset.sku = row.SKU;
            btn.title = colorName + ' (' + row.SKU + ')';
            btn.innerHTML = '<span class="jmc-swatch-fill" style="background:' + hex + ';"></span>'
                + '<span class="jmc-swatch-label">' + escapeHtml(colorName) + '</span>';
            btn.addEventListener('click', function () { selectSku(row.SKU); });
            grid.appendChild(btn);
        });
    }

    // ── SKU selection ──────────────────────────────────────────────────
    function selectSku(sku) {
        selectedSku = sku;
        selectedRow = catalog.filter(function (r) { return r.SKU === sku; })[0];
        if (!selectedRow) return;

        // Active state on swatch
        var swatches = document.querySelectorAll('.jmc-swatch');
        swatches.forEach(function (s) {
            s.classList.toggle('jmc-swatch--active', s.dataset.sku === sku);
        });

        // Selected label
        var label = document.getElementById('jmc-selected-label');
        var skuEl = document.getElementById('jmc-selected-sku');
        var nameEl = document.getElementById('jmc-selected-name');
        if (label && skuEl && nameEl) {
            label.style.display = '';
            skuEl.textContent = sku;
            nameEl.textContent = selectedRow.DisplayName || '';
        }

        // Reset logo offset when SKU changes — logo re-centers on the new tumbler
        logoOffset = { dx: 0, dy: 0 };
        // Invalidate engraved-logo cache so it rebuilds with the NEW SKU's
        // engrave color (silver vs dark etch). Without this, switching from
        // a colored tumbler (silver engrave) to LTM751 stainless (dark etch)
        // would keep the silver coloration. Bug caught in initial verification.
        engravedLogoCanvas = null;

        loadTumblerImage();
    }

    function loadTumblerImage() {
        if (!selectedSku) return;
        showLoading(true);
        showError('');

        // Catalog override path: if Erik has populated ThumbnailURL with a
        // hi-res blank tumbler image, use that. Otherwise fall back to live
        // JDS API for the full-size variant (typical case today).
        var p = (selectedRow.ThumbnailURL && selectedRow.ThumbnailURL.trim())
            ? Promise.resolve(selectedRow.ThumbnailURL.trim())
            : fetch(API_BASE + '/api/jds/products/' + encodeURIComponent(selectedSku))
                .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
                .then(function (d) {
                    var url = d && d.result && (d.result.image || d.result.thumbnail);
                    if (!url) throw new Error('JDS API returned no image for ' + selectedSku);
                    return url;
                });

        p.then(function (url) { return loadImageCrossOrigin(url); })
         .then(function (img) {
            tumblerImage = img;
            showLoading(false);
            render();
        })
         .catch(function (err) {
            showLoading(false);
            console.error('[jds-mockup-creator] Tumbler load failed:', err);
            showError('Couldn\'t load the tumbler image. JDS\'s CDN may not allow cross-origin requests; '
                + 'try again or contact Erik to set up a proxy endpoint.');
        });
    }

    // ── Logo upload ────────────────────────────────────────────────────
    function wireFileUpload() {
        var dropZone = document.getElementById('jmc-drop-zone');
        var fileInput = document.getElementById('jmc-file-input');
        var removeBtn = document.getElementById('jmc-logo-remove');

        if (dropZone) {
            dropZone.addEventListener('click', function () { fileInput.click(); });
            dropZone.addEventListener('dragover', function (e) {
                e.preventDefault();
                dropZone.classList.add('jmc-drop-zone--active');
            });
            dropZone.addEventListener('dragleave', function () {
                dropZone.classList.remove('jmc-drop-zone--active');
            });
            dropZone.addEventListener('drop', function (e) {
                e.preventDefault();
                dropZone.classList.remove('jmc-drop-zone--active');
                if (e.dataTransfer.files.length > 0) handleLogoFile(e.dataTransfer.files[0]);
            });
        }
        if (fileInput) {
            fileInput.addEventListener('change', function () {
                if (fileInput.files.length > 0) handleLogoFile(fileInput.files[0]);
            });
        }
        if (removeBtn) {
            removeBtn.addEventListener('click', function () { clearLogo(); });
        }
    }

    function handleLogoFile(file) {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            toast('File is over 10 MB — please use a smaller logo.', 'error');
            return;
        }

        var reader = new FileReader();
        reader.onload = function (e) {
            var img = new Image();
            img.onload = function () {
                logoImage = img;
                logoFileName = file.name;
                engravedLogoCanvas = null; // invalidate cache, rebuilt on render
                logoOffset = { dx: 0, dy: 0 }; // re-center

                var info = document.getElementById('jmc-logo-info');
                var nameEl = document.getElementById('jmc-logo-name');
                var tip = document.getElementById('jmc-logo-tip');
                if (info && nameEl) {
                    info.style.display = '';
                    nameEl.textContent = file.name;
                }
                // Show the tip only for opaque formats where auto-silhouette runs
                if (tip) {
                    var needsTip = /\.jpe?g$/i.test(file.name);
                    tip.style.display = needsTip ? '' : 'none';
                }

                document.getElementById('jmc-size-step').style.display = '';
                document.getElementById('jmc-download-step').style.display = '';

                render();
            };
            img.onerror = function () {
                toast('Couldn\'t read that logo file. Try another format.', 'error');
            };
            img.src = e.target.result;
        };
        reader.onerror = function () {
            toast('File read failed.', 'error');
        };
        reader.readAsDataURL(file);
    }

    function clearLogo() {
        logoImage = null;
        logoFileName = '';
        engravedLogoCanvas = null;
        document.getElementById('jmc-file-input').value = '';
        document.getElementById('jmc-logo-info').style.display = 'none';
        document.getElementById('jmc-logo-tip').style.display = 'none';
        document.getElementById('jmc-size-step').style.display = 'none';
        document.getElementById('jmc-download-step').style.display = 'none';
        render();
    }

    // ── Size slider ────────────────────────────────────────────────────
    function wireSizeSlider() {
        var slider = document.getElementById('jmc-size-slider');
        var pct = document.getElementById('jmc-size-pct');
        if (!slider || !pct) return;
        slider.addEventListener('input', function () {
            logoSizePct = parseInt(slider.value, 10) || 70;
            pct.textContent = logoSizePct;
            render();
        });
    }

    // ── Drag to reposition ─────────────────────────────────────────────
    function wireCanvasDrag() {
        var canvas = document.getElementById('jmc-canvas');
        if (!canvas) return;

        function getCanvasCoords(evt) {
            var rect = canvas.getBoundingClientRect();
            // Convert client → source-image space
            var scaleX = canvas.width / rect.width;
            var scaleY = canvas.height / rect.height;
            return {
                x: (evt.clientX - rect.left) * scaleX,
                y: (evt.clientY - rect.top) * scaleY
            };
        }

        canvas.addEventListener('mousedown', function (e) {
            if (!logoImage || !tumblerImage) return;
            isDragging = true;
            dragStart = getCanvasCoords(e);
            dragStart.originalOffset = { dx: logoOffset.dx, dy: logoOffset.dy };
        });

        window.addEventListener('mousemove', function (e) {
            if (!isDragging) return;
            var cur = getCanvasCoords(e);
            var ddx = cur.x - dragStart.x;
            var ddy = cur.y - dragStart.y;
            // Keep logo center within the mask bounds — clamp offset
            var mask = JdsTumblerTemplate.getMaskCoords(canvas.width, canvas.height);
            var maxOffX = mask.w / 2 - 20;
            var maxOffY = mask.h / 2 - 20;
            logoOffset.dx = clamp(dragStart.originalOffset.dx + ddx, -maxOffX, maxOffX);
            logoOffset.dy = clamp(dragStart.originalOffset.dy + ddy, -maxOffY, maxOffY);
            render();
        });

        window.addEventListener('mouseup', function () {
            isDragging = false;
            dragStart = null;
        });
    }

    // ── Render ─────────────────────────────────────────────────────────
    function render() {
        var canvas = document.getElementById('jmc-canvas');
        var emptyEl = document.getElementById('jmc-preview-empty');
        var captionEl = document.getElementById('jmc-preview-caption');
        if (!canvas) return;

        if (!tumblerImage) {
            canvas.style.display = 'none';
            if (emptyEl) emptyEl.style.display = '';
            if (captionEl) captionEl.style.display = 'none';
            return;
        }

        canvas.style.display = '';
        if (emptyEl) emptyEl.style.display = 'none';

        var w = PREVIEW_SIZE;
        var h = PREVIEW_SIZE;
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');

        // 1. Draw tumbler base
        ctx.drawImage(tumblerImage, 0, 0, w, h);

        // 2. Paint the masked area (clears the placeholder logo)
        try {
            JdsTumblerTemplate.paintMaskedArea(ctx, w, h);
        } catch (err) {
            console.error('[jds-mockup-creator] Mask paint failed:', err);
            showError('Canvas access blocked — cross-origin issue with the tumbler image.');
            return;
        }

        // 3. Composite engraved logo
        if (logoImage) {
            if (!engravedLogoCanvas) {
                var engraveColor = JdsTumblerTemplate.getEngraveColor(selectedRow.EngraveColor);
                engravedLogoCanvas = JdsTumblerTemplate.buildEngravedLogo(logoImage, engraveColor);
            }
            var mask = JdsTumblerTemplate.getMaskCoords(w, h);
            var targetW = mask.w * (logoSizePct / 100);
            var cx = mask.cx + logoOffset.dx;
            var cy = mask.cy + logoOffset.dy;
            JdsTumblerTemplate.drawLogoCentered(ctx, engravedLogoCanvas, cx, cy, targetW);
        }

        if (captionEl) {
            captionEl.style.display = logoImage ? '' : 'none';
        }
    }

    // ── Download ───────────────────────────────────────────────────────
    function wireDownload() {
        var btn = document.getElementById('jmc-download-btn');
        if (!btn) return;
        btn.addEventListener('click', downloadMockup);
    }

    function downloadMockup() {
        if (!tumblerImage || !logoImage || !selectedRow) {
            toast('Pick a color and upload a logo first.', 'error');
            return;
        }
        // Re-render at full source resolution for a crisp output file
        var canvas = document.createElement('canvas');
        canvas.width = DOWNLOAD_SIZE;
        canvas.height = DOWNLOAD_SIZE;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(tumblerImage, 0, 0, DOWNLOAD_SIZE, DOWNLOAD_SIZE);

        try {
            JdsTumblerTemplate.paintMaskedArea(ctx, DOWNLOAD_SIZE, DOWNLOAD_SIZE);
        } catch (err) {
            toast('Render failed: ' + err.message, 'error');
            return;
        }

        if (!engravedLogoCanvas) {
            var engraveColor = JdsTumblerTemplate.getEngraveColor(selectedRow.EngraveColor);
            engravedLogoCanvas = JdsTumblerTemplate.buildEngravedLogo(logoImage, engraveColor);
        }
        var mask = JdsTumblerTemplate.getMaskCoords(DOWNLOAD_SIZE, DOWNLOAD_SIZE);
        // Scale drag offset from preview space → source space
        var scale = DOWNLOAD_SIZE / PREVIEW_SIZE;
        var targetW = mask.w * (logoSizePct / 100);
        var cx = mask.cx + logoOffset.dx * scale;
        var cy = mask.cy + logoOffset.dy * scale;
        JdsTumblerTemplate.drawLogoCentered(ctx, engravedLogoCanvas, cx, cy, targetW);

        // Force download
        try {
            canvas.toBlob(function (blob) {
                if (!blob) {
                    toast('Couldn\'t produce a PNG. Cross-origin block?', 'error');
                    return;
                }
                var url = URL.createObjectURL(blob);
                var safeLogo = logoFileName.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9]+/g, '_');
                var a = document.createElement('a');
                a.href = url;
                a.download = selectedSku + '-' + (safeLogo || 'mockup') + '.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
                toast('Mockup downloaded.', 'success');
            }, 'image/png');
        } catch (err) {
            toast('Download blocked: ' + err.message, 'error');
        }
    }

    // ── Helpers ────────────────────────────────────────────────────────
    function loadImageCrossOrigin(url) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error('Image load failed: ' + url)); };
            img.src = url;
        });
    }

    function showLoading(on) {
        var el = document.getElementById('jmc-preview-loading');
        if (el) el.style.display = on ? '' : 'none';
    }

    function showError(msg) {
        var el = document.getElementById('jmc-preview-error');
        if (!el) return;
        if (msg) {
            el.textContent = msg;
            el.style.display = '';
        } else {
            el.style.display = 'none';
        }
    }

    function toast(msg, type) {
        var el = document.getElementById('jmc-toast');
        if (!el) return;
        el.textContent = msg;
        el.className = 'jmc-toast jmc-toast--show' + (type ? ' jmc-toast--' + type : '');
        clearTimeout(toast._t);
        toast._t = setTimeout(function () {
            el.className = 'jmc-toast';
        }, 3000);
    }

    function clamp(v, lo, hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = String(s == null ? '' : s);
        return d.innerHTML;
    }

})();
