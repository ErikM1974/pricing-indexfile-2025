/**
 * jds-mockup-creator.js — Standalone JDS Tumbler Mockup Creator page logic.
 *
 * Orchestrates:
 *   - Color picker (Polar Camel SKUs loaded from /api/jds-catalog)
 *   - Tumbler image fetch (via /api/jds/products/:sku, crossOrigin for canvas read)
 *   - Logo file upload (PNG, JPG, SVG — all formats handled by jds-tumbler-template)
 *   - Live canvas preview (source tumbler + masked patch + engraved logo overlay)
 *   - Drag/touch + arrow-key reposition of the logo within the imprint area
 *   - Auto-fit + size slider, recenter, and a toggleable imprint-area guide
 *   - Branded "presentation frame" deliverable (drop shadow, product name, NWCA
 *     wordmark, approval note) — toggle on/off
 *   - Download as PNG, copy-to-clipboard, and a multi-color comparison sheet
 *
 * The heavy lifting (mask, inpaint, logo silhouette, engrave color) lives in
 * jds-tumbler-template.js — this file wires the UI to that pipeline and adds the
 * export/presentation layer on top. It never reaches into the mask algorithm.
 *
 * Depends on: jds-tumbler-template.js (loaded first), browser canvas, fetch.
 */
(function () {
    'use strict';

    var API_BASE = 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    // Render canvas dimensions. The actual source is 1800×1800, but for preview
    // performance we render at 900×900 (half-size). Drag offsets are stored in
    // this PREVIEW space and scaled up (size / PREVIEW_SIZE) for any larger render.
    var PREVIEW_SIZE = 900;
    var DOWNLOAD_SIZE = 1800;

    // Literal colors used for canvas drawing on the branded frame / compare sheet.
    // (Canvas fills can't read CSS custom properties; these mirror the CSS tokens.)
    var INK = {
        brand:   '#7f1d1d',
        heading: '#111827',
        sub:     '#4b5563',
        faint:   '#9ca3af',
        bgTop:   '#ffffff',
        bgBottom:'#eef1f5',
        card:    '#ffffff',
        line:    '#e5e7eb'
    };

    // SKUs excluded from the mockup creator UI — valid catalog entries we can't
    // physically engrave a readable mockup for. LTM751 (stainless steel): a dark
    // etch on bare silver has too little contrast. Erik's call (2026-05-11).
    var MOCKUP_EXCLUDED_SKUS = ['LTM751'];

    // Approximate hex preview per color name. JDS gives us no hex; the swatch
    // fill is purely a visual cue — the real color comes from the JDS image.
    var COLOR_HINTS = {
        'Stainless Steel': '#c0c0c0', 'Black': '#1f2937', 'Red': '#dc2626',
        'Royal Blue': '#1d4ed8', 'Pink': '#ec4899', 'Teal': '#14b8a6',
        'Light Purple': '#c084fc', 'Purple': '#7c3aed', 'Dark Gray': '#4b5563',
        'Navy Blue': '#1e3a8a', 'Orange': '#ea580c', 'Maroon': '#7f1d1d',
        'White': '#f3f4f6', 'Green': '#16a34a', 'Yellow': '#eab308',
        'Coral': '#fb7185', 'Olive Green': '#65a30d'
    };

    // ── State ──────────────────────────────────────────────────────────
    var catalog = [];                  // {SKU, DisplayName, EngraveColor, ThumbnailURL?}[]
    var selectedSku = null;
    var selectedRow = null;
    var tumblerImage = null;           // loaded HTMLImageElement (crossOrigin)
    var logoImage = null;              // loaded HTMLImageElement of uploaded logo
    var logoFileName = '';
    var logoOffset = { dx: 0, dy: 0 }; // drag offset from mask center, in PREVIEW coords
    var logoSizePct = 70;              // % of mask width
    var showGuide = false;             // imprint-area outline overlay
    var previewMode = 'edit';          // 'edit' (draggable) | 'frame' (branded preview)
    var isDragging = false;
    var dragStart = null;

    var imageCache = {};               // sku → HTMLImageElement
    var engravedCache = {};            // engrave-hex → recolored logo canvas
    var compareSelection = [];         // SKUs chosen for the comparison sheet

    // ── Init ───────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', function () {
        wireFileUpload();
        wireSizeAndPosition();
        wireDownloadAndShare();
        wireCanvasInteraction();
        wirePreviewMode();
        wireCompare();
        preloadFonts();
        loadCatalog();
    });

    // Warm the Inter webfont so canvas text on the branded frame renders in
    // brand type rather than the system fallback. Non-blocking; Arial is a fine
    // fallback if the user exports before the font resolves.
    function preloadFonts() {
        if (!document.fonts || !document.fonts.load) return;
        ['800 30px Inter', '700 46px Inter', '500 28px Inter',
         'italic 400 24px Inter', '600 30px Inter'].forEach(function (f) {
            try { document.fonts.load(f); } catch (e) { /* ignore */ }
        });
    }

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

    function colorNameFromRow(row) {
        return ((row && row.DisplayName) || '').split(' - ').pop().trim();
    }

    function swatchFillHex(row) {
        return COLOR_HINTS[colorNameFromRow(row)] || '#9ca3af';
    }

    function renderSwatches() {
        var grid = document.getElementById('jmc-swatch-grid');
        if (!grid) return;
        grid.innerHTML = '';
        catalog.forEach(function (row) {
            var colorName = colorNameFromRow(row);
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'jmc-swatch';
            btn.dataset.sku = row.SKU;
            btn.title = colorName + ' (' + row.SKU + ')';
            btn.setAttribute('aria-label', colorName);
            btn.innerHTML = '<span class="jmc-swatch-fill" style="background:' + swatchFillHex(row) + ';"></span>'
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

        var swatches = document.querySelectorAll('#jmc-swatch-grid .jmc-swatch');
        swatches.forEach(function (s) {
            s.classList.toggle('jmc-swatch--active', s.dataset.sku === sku);
        });

        var label = document.getElementById('jmc-selected-label');
        var skuEl = document.getElementById('jmc-selected-sku');
        var nameEl = document.getElementById('jmc-selected-name');
        if (label && skuEl && nameEl) {
            label.classList.remove('jmc-hidden');
            skuEl.textContent = sku;
            nameEl.textContent = selectedRow.DisplayName || '';
        }

        // Logo position persists across color changes (all tumblers share the
        // same shape) so the customer sees their logo in the same spot on each.
        updateStepIndicators();
        loadTumblerImage();
    }

    // Load (and cache) the blank tumbler image for a SKU. Catalog ThumbnailURL
    // override wins; otherwise the live JDS API supplies the full-size variant.
    function ensureImage(sku) {
        if (imageCache[sku]) return Promise.resolve(imageCache[sku]);
        var row = catalog.filter(function (r) { return r.SKU === sku; })[0];
        var urlP = (row && row.ThumbnailURL && row.ThumbnailURL.trim())
            ? Promise.resolve(row.ThumbnailURL.trim())
            : fetch(API_BASE + '/api/jds/products/' + encodeURIComponent(sku))
                .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
                .then(function (d) {
                    var url = d && d.result && (d.result.image || d.result.thumbnail);
                    if (!url) throw new Error('JDS API returned no image for ' + sku);
                    return url;
                });
        return urlP.then(loadImageCrossOrigin).then(function (img) {
            imageCache[sku] = img;
            return img;
        });
    }

    function loadTumblerImage() {
        if (!selectedSku) return;
        showLoading(true);
        showError('');
        ensureImage(selectedSku)
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
        var warnContinue = document.getElementById('jmc-logo-warning-continue');
        var warnReupload = document.getElementById('jmc-logo-warning-reupload');

        if (warnContinue) {
            warnContinue.addEventListener('click', function () {
                // AE accepted the warning — fit the logo and reveal the rest of
                // the flow. The warning panel stays visible as a reminder.
                applyAutoFit();
                revealSizeAndDownload();
                render();
            });
        }
        if (warnReupload) {
            warnReupload.addEventListener('click', function () {
                clearLogo();
                hideLogoWarning();
                fileInput.click();
            });
        }

        if (dropZone) {
            dropZone.addEventListener('click', function () { fileInput.click(); });
            dropZone.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
            });
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
                engravedCache = {};          // invalidate — rebuilt per engrave color
                logoOffset = { dx: 0, dy: 0 }; // re-center on new logo

                var info = document.getElementById('jmc-logo-info');
                var nameEl = document.getElementById('jmc-logo-name');
                var thumb = document.getElementById('jmc-logo-thumb');
                var tip = document.getElementById('jmc-logo-tip');
                if (info && nameEl) {
                    info.classList.remove('jmc-hidden');
                    nameEl.textContent = file.name;
                }
                if (thumb) thumb.style.backgroundImage = 'url("' + e.target.result + '")';
                if (tip) tip.classList.remove('jmc-hidden');

                updateStepIndicators();

                // Complexity detection BEFORE revealing the rest of the flow.
                var issues = JdsTumblerTemplate.detectLogoIssues(img);
                if (issues.length > 0) {
                    showLogoWarning(issues);
                } else {
                    hideLogoWarning();
                    applyAutoFit();
                    revealSizeAndDownload();
                    render();
                }
            };
            img.onerror = function () {
                toast('Couldn\'t read that logo file. Try another format.', 'error');
            };
            img.src = e.target.result;
        };
        reader.onerror = function () { toast('File read failed.', 'error'); };
        reader.readAsDataURL(file);
    }

    /**
     * Show the complexity warning panel with copy tailored to the detected
     * issues. (Copy unchanged from the original — these messages are tuned to
     * real failure cases the team hit.)
     */
    function showLogoWarning(issueCodes) {
        var panel = document.getElementById('jmc-logo-warning');
        var titleEl = document.getElementById('jmc-logo-warning-title');
        var bodyEl = document.getElementById('jmc-logo-warning-body');
        if (!panel || !titleEl || !bodyEl) return;

        var primary = issueCodes[0];
        if (issueCodes.indexOf('white-on-white') !== -1) primary = 'white-on-white';
        else if (issueCodes.indexOf('dark-background') !== -1) primary = 'dark-background';
        else if (issueCodes.indexOf('photo') !== -1) primary = 'photo';
        else if (issueCodes.indexOf('medium-gray-only') !== -1) primary = 'medium-gray-only';
        else if (issueCodes.indexOf('multi-color') !== -1) primary = 'multi-color';

        var copy = {
            'white-on-white': {
                title: '⚠ This logo looks like white-on-white',
                body: 'This logo appears to be designed to overlay <strong>dark backgrounds</strong> — it\'s mostly white with no dark/transparent areas the engraving tool can detect.<br><br>' +
                      '<strong>Fix:</strong> Ask the customer for a <strong>black-on-white version</strong>, or open the logo in Preview/Photoshop, swap white→black, and save as a transparent PNG.'
            },
            'multi-color': {
                title: '⚠ This logo has multiple colors',
                body: 'Laser engraving is <strong>single-color only</strong> (silver on coated tumblers). Multi-color logos with drop shadows or overlapping fills collapse into a "silver blob" because every color region becomes the same fill.<br><br>' +
                      '<strong>Fix:</strong> Ask the customer for a <strong>one-color version</strong> of the logo (the brand guidelines usually include one), or have Steve simplify it in Photoshop first.'
            },
            'photo': {
                title: '⚠ This looks like a photograph',
                body: 'Laser engraving is a <strong>binary stencil</strong> — etched or not etched. Photos and detailed illustrations can\'t be reproduced as engraving and always look like muddy patches.<br><br>' +
                      '<strong>Fix:</strong> Ask the customer for a <strong>vector logo</strong> (.SVG or .AI file) instead of a photo.'
            },
            'medium-gray-only': {
                title: '⚠ This logo is rendered in medium gray',
                body: 'Laser engraving needs <strong>high-contrast black</strong> artwork to read cleanly. Medium-gray logos render as faded or translucent silhouettes that may be hard to see on the tumbler.<br><br>' +
                      '<strong>Fix:</strong> Ask the customer for a <strong>black-on-white version</strong> of this logo, or open the file in Preview/Photoshop and darken the gray to pure black.'
            },
            'dark-background': {
                title: '⚠ This logo has a dark background',
                body: 'Laser engraving works on a <strong>light or transparent</strong> background — the tool reads dark pixels as the design to engrave. With a dark background, the entire mockup area would render as one big silver patch, with the actual design showing as confusing cutouts.<br><br>' +
                      '<strong>Fix:</strong> Ask the customer for a <strong>transparent PNG</strong> (background removed) or the <strong>inverted version</strong> (dark design on a light background). Most brand kits include both.'
            }
        };

        var c = copy[primary] || copy['multi-color'];
        titleEl.innerHTML = c.title;
        bodyEl.innerHTML = c.body;
        panel.classList.remove('jmc-hidden');

        document.getElementById('jmc-size-step').classList.add('jmc-hidden');
        document.getElementById('jmc-download-step').classList.add('jmc-hidden');
        document.getElementById('jmc-compare-step').classList.add('jmc-hidden');
        document.getElementById('jmc-preview-toolbar').classList.add('jmc-hidden');
    }

    function hideLogoWarning() {
        var panel = document.getElementById('jmc-logo-warning');
        if (panel) panel.classList.add('jmc-hidden');
    }

    function revealSizeAndDownload() {
        document.getElementById('jmc-size-step').classList.remove('jmc-hidden');
        document.getElementById('jmc-download-step').classList.remove('jmc-hidden');
        document.getElementById('jmc-compare-step').classList.remove('jmc-hidden');
        document.getElementById('jmc-preview-toolbar').classList.remove('jmc-hidden');
        renderCompareGrid();
    }

    function clearLogo() {
        logoImage = null;
        logoFileName = '';
        engravedCache = {};
        document.getElementById('jmc-file-input').value = '';
        document.getElementById('jmc-logo-info').classList.add('jmc-hidden');
        document.getElementById('jmc-logo-tip').classList.add('jmc-hidden');
        document.getElementById('jmc-size-step').classList.add('jmc-hidden');
        document.getElementById('jmc-download-step').classList.add('jmc-hidden');
        document.getElementById('jmc-compare-step').classList.add('jmc-hidden');
        document.getElementById('jmc-preview-toolbar').classList.add('jmc-hidden');
        var thumb = document.getElementById('jmc-logo-thumb');
        if (thumb) thumb.style.backgroundImage = '';
        hideLogoWarning();
        setPreviewMode('edit');
        updateStepIndicators();
        render();
    }

    // ── Size & position controls ───────────────────────────────────────
    function wireSizeAndPosition() {
        var slider = document.getElementById('jmc-size-slider');
        var pct = document.getElementById('jmc-size-pct');
        var fitBtn = document.getElementById('jmc-fit-btn');
        var centerBtn = document.getElementById('jmc-center-btn');
        var guideToggle = document.getElementById('jmc-guide-toggle');

        if (slider && pct) {
            slider.addEventListener('input', function () {
                logoSizePct = parseInt(slider.value, 10) || 70;
                pct.textContent = logoSizePct;
                render();
            });
        }
        if (fitBtn) fitBtn.addEventListener('click', function () { applyAutoFit(); render(); });
        if (centerBtn) {
            centerBtn.addEventListener('click', function () {
                logoOffset = { dx: 0, dy: 0 };
                render();
            });
        }
        if (guideToggle) {
            guideToggle.addEventListener('change', function () {
                showGuide = guideToggle.checked;
                render();
            });
        }
    }

    // Pick a logo size that comfortably fits the imprint area in BOTH dimensions
    // (the slider sizes by width only, so a tall logo could otherwise overflow).
    function computeFitPct() {
        if (!logoImage) return 70;
        var w = logoImage.naturalWidth || logoImage.width;
        var h = logoImage.naturalHeight || logoImage.height;
        if (!w || !h) return 70;
        var aspect = h / w;
        var maskW = JdsTumblerTemplate.MASK.w;
        var maskH = JdsTumblerTemplate.MASK.h;
        var byWidth = 92;                                   // ≤92% of mask width
        var byHeight = (maskH * 0.82) / (maskW * aspect) * 100; // ≤82% of mask height
        var p = Math.max(30, Math.min(110, Math.min(byWidth, byHeight)));
        return Math.round(p / 2) * 2; // snap to slider step
    }

    function applyAutoFit() {
        logoSizePct = computeFitPct();
        var slider = document.getElementById('jmc-size-slider');
        var pct = document.getElementById('jmc-size-pct');
        if (slider) slider.value = logoSizePct;
        if (pct) pct.textContent = logoSizePct;
    }

    // ── Canvas interaction (pointer drag + keyboard nudge) ─────────────
    function wireCanvasInteraction() {
        var canvas = document.getElementById('jmc-canvas');
        if (!canvas) return;

        function getCanvasCoords(evt) {
            var rect = canvas.getBoundingClientRect();
            var scaleX = canvas.width / rect.width;
            var scaleY = canvas.height / rect.height;
            return {
                x: (evt.clientX - rect.left) * scaleX,
                y: (evt.clientY - rect.top) * scaleY
            };
        }

        // Pointer events unify mouse + touch + pen, so this works on the AEs'
        // iPads as well as desktop. touch-action:none on the canvas (CSS) keeps
        // a touch-drag from scrolling the page.
        canvas.addEventListener('pointerdown', function (e) {
            if (previewMode !== 'edit' || !logoImage || !tumblerImage) return;
            isDragging = true;
            try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            dragStart = getCanvasCoords(e);
            dragStart.originalOffset = { dx: logoOffset.dx, dy: logoOffset.dy };
        });
        canvas.addEventListener('pointermove', function (e) {
            if (!isDragging) return;
            var cur = getCanvasCoords(e);
            logoOffset.dx = dragStart.originalOffset.dx + (cur.x - dragStart.x);
            logoOffset.dy = dragStart.originalOffset.dy + (cur.y - dragStart.y);
            clampOffset();
            render();
        });
        function endDrag(e) {
            isDragging = false;
            dragStart = null;
            if (e && e.pointerId != null) {
                try { canvas.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            }
        }
        canvas.addEventListener('pointerup', endDrag);
        canvas.addEventListener('pointercancel', endDrag);

        // Arrow-key nudge for precise placement (Shift = larger step).
        canvas.addEventListener('keydown', function (e) {
            if (previewMode !== 'edit' || !logoImage || !tumblerImage) return;
            var step = e.shiftKey ? 20 : 5;
            var moved = true;
            if (e.key === 'ArrowLeft') logoOffset.dx -= step;
            else if (e.key === 'ArrowRight') logoOffset.dx += step;
            else if (e.key === 'ArrowUp') logoOffset.dy -= step;
            else if (e.key === 'ArrowDown') logoOffset.dy += step;
            else moved = false;
            if (moved) { e.preventDefault(); clampOffset(); render(); }
        });
    }

    function clampOffset() {
        var mask = JdsTumblerTemplate.getMaskCoords(PREVIEW_SIZE, PREVIEW_SIZE);
        var maxX = mask.w / 2 - 20;
        var maxY = mask.h / 2 - 20;
        logoOffset.dx = clamp(logoOffset.dx, -maxX, maxX);
        logoOffset.dy = clamp(logoOffset.dy, -maxY, maxY);
    }

    // ── Engraved-logo cache ────────────────────────────────────────────
    function getEngravedLogoFor(engraveColorField) {
        if (!logoImage) return null;
        var hex = JdsTumblerTemplate.getEngraveColor(engraveColorField);
        if (!engravedCache[hex]) {
            engravedCache[hex] = JdsTumblerTemplate.buildEngravedLogo(logoImage, hex);
        }
        return engravedCache[hex];
    }

    // ── Core mockup composition (single source of truth) ───────────────
    // Draws tumbler + cleared imprint patch + engraved logo onto `ctx` at the
    // given square `size`. Used by the live preview, download, copy, branded
    // frame, and every cell of the comparison sheet.
    function composeMockup(ctx, size, opts) {
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(opts.image, 0, 0, size, size);
        JdsTumblerTemplate.paintMaskedArea(ctx, size, size, opts.sku); // may throw on CORS taint
        if (logoImage) {
            var engraved = getEngravedLogoFor(opts.engraveColorField);
            var mask = JdsTumblerTemplate.getMaskCoords(size, size);
            var scale = size / PREVIEW_SIZE;
            var targetW = mask.w * (logoSizePct / 100);
            var cx = mask.cx + logoOffset.dx * scale;
            var cy = mask.cy + logoOffset.dy * scale;
            JdsTumblerTemplate.drawLogoCentered(ctx, engraved, cx, cy, targetW);
        }
    }

    function currentOpts() {
        return {
            image: tumblerImage,
            sku: selectedSku,
            engraveColorField: selectedRow ? selectedRow.EngraveColor : ''
        };
    }

    function currentMeta() {
        return {
            productName: selectedRow ? (selectedRow.DisplayName || colorNameFromRow(selectedRow)) : '',
            sku: selectedSku || '',
            colorName: colorNameFromRow(selectedRow)
        };
    }

    // ── Render (live preview) ──────────────────────────────────────────
    function render() {
        var canvas = document.getElementById('jmc-canvas');
        var emptyEl = document.getElementById('jmc-preview-empty');
        var captionEl = document.getElementById('jmc-preview-caption');
        if (!canvas) return;

        if (!tumblerImage) {
            canvas.classList.add('jmc-hidden');
            if (emptyEl) emptyEl.classList.remove('jmc-hidden');
            if (captionEl) captionEl.classList.add('jmc-hidden');
            return;
        }

        canvas.classList.remove('jmc-hidden');
        if (emptyEl) emptyEl.classList.add('jmc-hidden');

        // Branded-frame preview mode — show exactly what the customer receives.
        if (previewMode === 'frame' && logoImage) {
            try {
                var m = document.createElement('canvas');
                m.width = m.height = PREVIEW_SIZE;
                composeMockup(m.getContext('2d'), PREVIEW_SIZE, currentOpts());
                var frame = buildPresentationFrame(m, currentMeta());
                canvas.width = frame.width;
                canvas.height = frame.height;
                canvas.getContext('2d').drawImage(frame, 0, 0);
            } catch (err) {
                console.error('[jds-mockup-creator] Frame preview failed:', err);
                showError('Canvas access blocked — cross-origin issue with the tumbler image.');
                return;
            }
            if (captionEl) {
                captionEl.textContent = 'Branded preview — this is the image your customer receives.';
                captionEl.classList.remove('jmc-hidden');
            }
            return;
        }

        // Edit mode — live, draggable bare tumbler.
        canvas.width = PREVIEW_SIZE;
        canvas.height = PREVIEW_SIZE;
        var ctx = canvas.getContext('2d');
        try {
            composeMockup(ctx, PREVIEW_SIZE, currentOpts());
        } catch (err) {
            console.error('[jds-mockup-creator] Mask paint failed:', err);
            showError('Canvas access blocked — cross-origin issue with the tumbler image.');
            return;
        }

        if (showGuide) drawImprintGuide(ctx);

        if (captionEl) {
            if (logoImage) {
                captionEl.textContent = 'Live preview. Drag the logo to reposition.';
                captionEl.classList.remove('jmc-hidden');
            } else {
                captionEl.classList.add('jmc-hidden');
            }
        }
    }

    function drawImprintGuide(ctx) {
        var mask = JdsTumblerTemplate.getMaskCoords(PREVIEW_SIZE, PREVIEW_SIZE);
        ctx.save();
        ctx.strokeStyle = 'rgba(127, 29, 29, 0.85)';
        ctx.setLineDash([9, 6]);
        ctx.lineWidth = 2;
        ctx.strokeRect(mask.x, mask.y, mask.w, mask.h);
        ctx.restore();
    }

    // ── Branded presentation frame ─────────────────────────────────────
    // Wrap a square mockup canvas in a customer-ready card: studio backdrop,
    // soft contact shadow under the tumbler, product name, SKU, NWCA wordmark,
    // and an approval disclaimer.
    function buildPresentationFrame(mockupCanvas, meta) {
        var bounds = getOpaqueBounds(mockupCanvas) || {
            top: 0, left: 0, right: mockupCanvas.width - 1, bottom: mockupCanvas.height - 1
        };
        var bw = bounds.right - bounds.left + 1;
        var bh = bounds.bottom - bounds.top + 1;

        // Normalize the tumbler to a target height so the frame looks identical
        // regardless of the source mockup resolution (preview vs download).
        var targetTumblerH = 1500;
        var scale = targetTumblerH / bh;
        var drawW = Math.round(bw * scale);
        var drawH = Math.round(bh * scale);
        var u = drawH / 1500; // layout unit (~1)

        var padTop = Math.round(120 * u);
        var padX = Math.round(170 * u);
        var footerH = Math.round(360 * u);
        var W = Math.max(drawW + padX * 2, Math.round(1500 * u));
        var H = padTop + drawH + footerH;

        var c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        var ctx = c.getContext('2d');

        // Backdrop
        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, INK.bgTop);
        g.addColorStop(1, INK.bgBottom);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // Tumbler with a soft, shape-accurate drop shadow
        var dx = Math.round((W - drawW) / 2);
        ctx.save();
        ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
        ctx.shadowBlur = Math.round(55 * u);
        ctx.shadowOffsetY = Math.round(28 * u);
        ctx.drawImage(mockupCanvas, bounds.left, bounds.top, bw, bh, dx, padTop, drawW, drawH);
        ctx.restore();

        // Footer block
        var fy = padTop + drawH;
        ctx.fillStyle = INK.brand;
        ctx.fillRect(padX, fy + Math.round(14 * u), W - padX * 2, Math.max(2, Math.round(3 * u)));

        ctx.textAlign = 'center';
        var maxTextW = W - padX * 2;
        drawFitText(ctx, meta.productName || 'Custom Tumbler',
            "700 " + Math.round(46 * u) + "px 'Inter', Arial, sans-serif",
            INK.heading, W / 2, fy + Math.round(86 * u), maxTextW);
        ctx.fillStyle = INK.sub;
        ctx.font = "500 " + Math.round(27 * u) + "px 'Inter', Arial, sans-serif";
        ctx.fillText('Laser-engraved logo mockup' + (meta.sku ? '  ·  SKU ' + meta.sku : ''),
            W / 2, fy + Math.round(130 * u));
        drawFitText(ctx,
            'Mockup for visual approval — engraving prints silver; on-screen colors are approximate.',
            "italic 400 " + Math.round(23 * u) + "px 'Inter', Arial, sans-serif",
            INK.faint, W / 2, fy + Math.round(176 * u), maxTextW);

        drawSpacedText(ctx, 'NORTHWEST CUSTOM APPAREL',
            "800 " + Math.round(28 * u) + "px 'Inter', Arial, sans-serif",
            INK.brand, W / 2, fy + Math.round(258 * u), Math.round(3 * u));

        return c;
    }

    // ── Comparison sheet (multiple colors) ─────────────────────────────
    function buildCompareSheet(items, meta) {
        var n = items.length;
        var cols = n <= 1 ? 1 : (n <= 4 ? 2 : 3);
        var rows = Math.ceil(n / cols);
        var cell = 760;       // square mockup per cell
        var labelH = 78;
        var gap = 48;
        var padX = 70;
        var headerH = 210;
        var footerH = 130;

        var gridW = cols * cell + (cols - 1) * gap;
        var W = gridW + padX * 2;
        var H = headerH + rows * (cell + labelH) + (rows - 1) * gap + footerH;

        var c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        var ctx = c.getContext('2d');

        var g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, INK.bgTop);
        g.addColorStop(1, INK.bgBottom);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // Header
        ctx.textAlign = 'center';
        drawSpacedText(ctx, 'NORTHWEST CUSTOM APPAREL',
            "800 30px 'Inter', Arial, sans-serif", INK.brand, W / 2, 70, 3);
        drawFitText(ctx, 'Tumbler Color Options', "700 46px 'Inter', Arial, sans-serif",
            INK.heading, W / 2, 128, W - padX * 2);
        ctx.fillStyle = INK.sub;
        ctx.font = "500 26px 'Inter', Arial, sans-serif";
        ctx.fillText('Your logo, engraved on each color · ' + (meta.logoName || ''),
            W / 2, 168);

        // Cells
        var cellTmp = document.createElement('canvas');
        cellTmp.width = cellTmp.height = cell;
        var cellCtx = cellTmp.getContext('2d');

        items.forEach(function (item, i) {
            var col = i % cols;
            var row = Math.floor(i / cols);
            var cx = padX + col * (cell + gap);
            var cy = headerH + row * (cell + labelH + gap);

            composeMockup(cellCtx, cell, {
                image: item.img, sku: item.sku, engraveColorField: item.engraveColorField
            });

            ctx.save();
            ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
            ctx.shadowBlur = 34;
            ctx.shadowOffsetY = 18;
            ctx.drawImage(cellTmp, cx, cy, cell, cell);
            ctx.restore();

            ctx.textAlign = 'center';
            ctx.fillStyle = INK.heading;
            ctx.font = "600 30px 'Inter', Arial, sans-serif";
            ctx.fillText(item.colorName + '  (' + item.sku + ')', cx + cell / 2, cy + cell + 44);
        });

        // Footer
        ctx.textAlign = 'center';
        ctx.fillStyle = INK.faint;
        ctx.font = "italic 400 24px 'Inter', Arial, sans-serif";
        ctx.fillText('Mockup for visual approval — engraving prints silver; on-screen colors are approximate.',
            W / 2, H - 50);

        return c;
    }

    // ── Download & share ───────────────────────────────────────────────
    function wireDownloadAndShare() {
        var dl = document.getElementById('jmc-download-btn');
        var cp = document.getElementById('jmc-copy-btn');
        var frameToggle = document.getElementById('jmc-frame-toggle');
        if (dl) dl.addEventListener('click', downloadMockup);
        if (cp) cp.addEventListener('click', copyMockup);
        if (frameToggle) {
            frameToggle.addEventListener('change', function () {
                // Leaving frame-preview would be misleading if the frame is off.
                if (!frameToggle.checked && previewMode === 'frame') setPreviewMode('edit');
            });
        }
    }

    function framingEnabled() {
        var t = document.getElementById('jmc-frame-toggle');
        return !t || t.checked;
    }

    // Build the export-resolution deliverable (framed or bare per the toggle).
    function buildDeliverable() {
        var m = document.createElement('canvas');
        m.width = m.height = DOWNLOAD_SIZE;
        composeMockup(m.getContext('2d'), DOWNLOAD_SIZE, currentOpts());
        return framingEnabled() ? buildPresentationFrame(m, currentMeta()) : m;
    }

    function downloadMockup() {
        if (!tumblerImage || !logoImage || !selectedRow) {
            toast('Pick a color and upload a logo first.', 'error');
            return;
        }
        var canvas;
        try {
            canvas = buildDeliverable();
        } catch (err) {
            toast('Render failed: ' + err.message, 'error');
            return;
        }
        try {
            canvas.toBlob(function (blob) {
                if (!blob) { toast('Couldn\'t produce a PNG. Cross-origin block?', 'error'); return; }
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

    function copyMockup() {
        if (!tumblerImage || !logoImage || !selectedRow) {
            toast('Pick a color and upload a logo first.', 'error');
            return;
        }
        if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') {
            toast('Your browser can\'t copy images — use Download instead.', 'error');
            return;
        }
        var canvas;
        try {
            canvas = buildDeliverable();
        } catch (err) {
            toast('Render failed: ' + err.message, 'error');
            return;
        }
        canvas.toBlob(function (blob) {
            if (!blob) { toast('Couldn\'t produce an image to copy.', 'error'); return; }
            try {
                var item = new window.ClipboardItem({ 'image/png': blob });
                navigator.clipboard.write([item]).then(function () {
                    toast('Copied — paste into an email or Slack.', 'success');
                }).catch(function (err) {
                    toast('Copy failed: ' + err.message, 'error');
                });
            } catch (err) {
                toast('Copy failed: ' + err.message, 'error');
            }
        }, 'image/png');
    }

    // ── Preview-mode (Edit / Branded frame) ────────────────────────────
    function wirePreviewMode() {
        var edit = document.getElementById('jmc-mode-edit');
        var frame = document.getElementById('jmc-mode-frame');
        if (edit) edit.addEventListener('click', function () { setPreviewMode('edit'); });
        if (frame) frame.addEventListener('click', function () { setPreviewMode('frame'); });
    }

    function setPreviewMode(mode) {
        previewMode = mode;
        var edit = document.getElementById('jmc-mode-edit');
        var frame = document.getElementById('jmc-mode-frame');
        var canvas = document.getElementById('jmc-canvas');
        if (edit) { edit.classList.toggle('jmc-seg-btn--active', mode === 'edit'); edit.setAttribute('aria-pressed', String(mode === 'edit')); }
        if (frame) { frame.classList.toggle('jmc-seg-btn--active', mode === 'frame'); frame.setAttribute('aria-pressed', String(mode === 'frame')); }
        if (canvas) canvas.classList.toggle('jmc-canvas--locked', mode === 'frame');
        render();
    }

    // ── Compare colors ─────────────────────────────────────────────────
    function wireCompare() {
        var btn = document.getElementById('jmc-compare-btn');
        if (btn) btn.addEventListener('click', doCompare);
    }

    function renderCompareGrid() {
        var grid = document.getElementById('jmc-compare-grid');
        if (!grid) return;

        // Seed the selection with the current color the first time we show it.
        if (compareSelection.length === 0 && selectedSku) compareSelection = [selectedSku];

        grid.innerHTML = '';
        catalog.forEach(function (row) {
            var colorName = colorNameFromRow(row);
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'jmc-compare-swatch'
                + (compareSelection.indexOf(row.SKU) !== -1 ? ' jmc-compare-swatch--selected' : '');
            btn.dataset.sku = row.SKU;
            btn.title = colorName + ' (' + row.SKU + ')';
            btn.setAttribute('aria-label', colorName);
            btn.setAttribute('aria-pressed', String(compareSelection.indexOf(row.SKU) !== -1));
            btn.innerHTML = '<span class="jmc-swatch-fill" style="background:' + swatchFillHex(row) + ';"></span>';
            btn.addEventListener('click', function () { toggleCompare(row.SKU, btn); });
            grid.appendChild(btn);
        });
        updateCompareButton();
    }

    function toggleCompare(sku, btn) {
        var i = compareSelection.indexOf(sku);
        if (i === -1) compareSelection.push(sku);
        else compareSelection.splice(i, 1);
        var on = compareSelection.indexOf(sku) !== -1;
        btn.classList.toggle('jmc-compare-swatch--selected', on);
        btn.setAttribute('aria-pressed', String(on));
        updateCompareButton();
    }

    function updateCompareButton() {
        var btn = document.getElementById('jmc-compare-btn');
        var label = document.getElementById('jmc-compare-btn-label');
        if (!btn || !label) return;
        var n = compareSelection.length;
        if (n < 2) {
            btn.disabled = true;
            label.textContent = 'Pick 2 or more colors';
        } else {
            btn.disabled = false;
            label.textContent = 'Download comparison (' + n + ')';
        }
    }

    function doCompare() {
        if (!logoImage) { toast('Upload a logo first.', 'error'); return; }
        if (compareSelection.length < 2) return;

        var btn = document.getElementById('jmc-compare-btn');
        var label = document.getElementById('jmc-compare-btn-label');
        var prevLabel = label ? label.textContent : '';
        if (btn) btn.disabled = true;
        if (label) label.textContent = 'Building sheet…';

        // Preserve the on-screen selection order for a stable layout.
        var skus = compareSelection.slice();
        Promise.all(skus.map(ensureImage))
            .then(function (imgs) {
                var items = skus.map(function (sku, i) {
                    var row = catalog.filter(function (r) { return r.SKU === sku; })[0] || {};
                    return {
                        img: imgs[i],
                        sku: sku,
                        colorName: colorNameFromRow(row),
                        engraveColorField: row.EngraveColor
                    };
                });
                var sheet = buildCompareSheet(items, { logoName: logoFileName });
                sheet.toBlob(function (blob) {
                    if (!blob) { toast('Couldn\'t build the comparison sheet.', 'error'); restore(); return; }
                    var url = URL.createObjectURL(blob);
                    var safeLogo = logoFileName.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9]+/g, '_');
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = 'tumbler-comparison-' + (safeLogo || 'logo') + '.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
                    toast('Comparison sheet downloaded.', 'success');
                    restore();
                }, 'image/png');
            })
            .catch(function (err) {
                console.error('[jds-mockup-creator] Compare build failed:', err);
                toast('Couldn\'t load one of the tumbler images. Try again.', 'error');
                restore();
            });

        function restore() {
            if (btn) btn.disabled = false;
            if (label) label.textContent = prevLabel;
            updateCompareButton();
        }
    }

    // ── Step indicators ────────────────────────────────────────────────
    function updateStepIndicators() {
        setStepNum('jmc-step1-num', !!selectedSku, '1');
        setStepNum('jmc-step2-num', !!logoImage, '2');
    }

    function setStepNum(id, done, defaultLabel) {
        var el = document.getElementById(id);
        if (!el) return;
        el.textContent = done ? '✓' : defaultLabel;
        el.classList.toggle('jmc-step-num--done', done);
    }

    // ── Canvas text helpers ────────────────────────────────────────────
    // Shrink the font until the text fits maxWidth (keeps long product names on
    // one line without overflowing the frame).
    function drawFitText(ctx, text, baseFont, color, cx, y, maxWidth) {
        ctx.fillStyle = color;
        ctx.font = baseFont;
        var m = baseFont.match(/(\d+)px/);
        var size = m ? parseInt(m[1], 10) : 24;
        while (size > 10 && ctx.measureText(text).width > maxWidth) {
            size -= 2;
            ctx.font = baseFont.replace(/\d+px/, size + 'px');
        }
        ctx.fillText(text, cx, y);
    }

    // Letter-spaced centered text — uses native ctx.letterSpacing where present,
    // otherwise manual glyph placement (the NWCA wordmark reads better spaced).
    function drawSpacedText(ctx, text, font, color, cx, y, spacing) {
        ctx.fillStyle = color;
        ctx.font = font;
        if ('letterSpacing' in ctx) {
            var prev = ctx.letterSpacing;
            ctx.textAlign = 'center';
            ctx.letterSpacing = spacing + 'px';
            ctx.fillText(text, cx, y);
            ctx.letterSpacing = prev;
            return;
        }
        var widths = [];
        var total = 0;
        for (var i = 0; i < text.length; i++) {
            var w = ctx.measureText(text[i]).width;
            widths.push(w);
            total += w + (i < text.length - 1 ? spacing : 0);
        }
        ctx.textAlign = 'left';
        var x = cx - total / 2;
        for (var j = 0; j < text.length; j++) {
            ctx.fillText(text[j], x, y);
            x += widths[j] + spacing;
        }
        ctx.textAlign = 'center';
    }

    // Tight opaque bounding box of a canvas (for cropping the tumbler out of its
    // transparent margins). Samples every 2px for speed.
    function getOpaqueBounds(canvas) {
        var w = canvas.width, h = canvas.height;
        var data;
        try { data = canvas.getContext('2d').getImageData(0, 0, w, h).data; }
        catch (e) { return null; }
        var top = h, bottom = 0, left = w, right = 0, found = false;
        for (var y = 0; y < h; y += 2) {
            for (var x = 0; x < w; x += 2) {
                if (data[(y * w + x) * 4 + 3] > 16) {
                    found = true;
                    if (y < top) top = y;
                    if (y > bottom) bottom = y;
                    if (x < left) left = x;
                    if (x > right) right = x;
                }
            }
        }
        return found ? { top: top, bottom: bottom, left: left, right: right } : null;
    }

    // ── Misc helpers ───────────────────────────────────────────────────
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
        if (el) el.classList.toggle('jmc-hidden', !on);
    }

    function showError(msg) {
        var el = document.getElementById('jmc-preview-error');
        if (!el) return;
        if (msg) { el.textContent = msg; el.classList.remove('jmc-hidden'); }
        else { el.classList.add('jmc-hidden'); }
    }

    function toast(msg, type) {
        var el = document.getElementById('jmc-toast');
        if (!el) return;
        el.textContent = msg;
        el.className = 'jmc-toast jmc-toast--show' + (type ? ' jmc-toast--' + type : '');
        clearTimeout(toast._t);
        toast._t = setTimeout(function () { el.className = 'jmc-toast'; }, 3000);
    }

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

    function escapeHtml(s) {
        var d = document.createElement('div');
        d.textContent = String(s == null ? '' : s);
        return d.innerHTML;
    }

})();
