/**
 * laser-tumbler-mockup.js — Customer-facing logo mockup + instant quote for the
 * Polar Camel laser tumbler page (calculators/laser-tumbler-polarcamel.html).
 *
 * A trimmed, customer-worded version of the staff JDS Tumbler Mockup Creator
 * (pages/js/jds-mockup-creator.js). The engraving pipeline (mask, inpaint,
 * logo silhouette, engrave color) is the SAME shared jds-tumbler-template.js —
 * this module only wires it to the product page:
 *   - Follows the page's existing color picker (the page's 4 SKUs only —
 *     no separate color list)
 *   - Logo upload (PNG/JPG/SVG) with customer-worded artwork warnings
 *   - Live canvas preview with drag / arrow-key reposition + size slider
 *   - Download mockup PNG
 *   - Instant quote: quantity → live unit price/LTM/total using the SAME
 *     formula pricing as the tier table (JDS wholesale + Caspio JDS-MARGIN /
 *     JDS-LABOR / JDS-LTM via jds-api-service) — no hardcoded prices.
 *
 * Depends on: jds-tumbler-template.js (loaded first) and the page object
 * (window.laserTumblerPage) handed in via onPageReady(). All hooks from
 * laser-tumbler-simple.js are optional-chained, so this module is a
 * progressive enhancement — if it fails to load, the product page is unharmed.
 */
(function () {
    'use strict';

    var API_BASE = (window.APP_CONFIG && window.APP_CONFIG.API && window.APP_CONFIG.API.BASE_URL)
        || 'https://caspio-pricing-proxy-ab30a049961a.herokuapp.com';

    var PREVIEW_SIZE = 900;
    var DOWNLOAD_SIZE = 1800;
    var LTM_THRESHOLD = 12;   // matches JDS-LTM "per order under 12 pieces"
    var SUPPLIER_MIN = 24;    // 1 case — minimum when we have no local stock

    // ── State ──────────────────────────────────────────────────────────
    var page = null;                   // window.laserTumblerPage instance
    var catalogBySku = {};             // SKU → {EngraveColor,...} from /api/jds-catalog
    var tumblerImage = null;
    var logoImage = null;
    var logoFileName = '';
    var logoOffset = { dx: 0, dy: 0 };
    var logoSizePct = 70;
    var isDragging = false;
    var dragStart = null;
    var imageCache = {};               // sku → HTMLImageElement
    var engravedCache = {};            // engrave-hex → recolored logo canvas

    // ── Public API (called by laser-tumbler-simple.js) ─────────────────
    window.laserTumblerMockup = {
        onPageReady: onPageReady,
        onColorChanged: onColorChanged,
        // exposed for automated tests — not used by page code
        _handleLogoFile: handleLogoFile
    };

    function onPageReady(pageInstance) {
        page = pageInstance;
        var section = document.getElementById('mockup-section');
        if (!section || typeof window.JdsTumblerTemplate === 'undefined') return;
        section.hidden = false;

        wireFileUpload();
        wireSizeAndPosition();
        wireCanvasInteraction();
        wireDownload();
        wireQuote();
        loadCatalogMeta();
        onColorChanged();
    }

    function onColorChanged() {
        if (!page || !page.currentProduct) return;
        var nameEl = document.getElementById('ltmk-color-name');
        if (nameEl) nameEl.textContent = page.extractColorFromName(page.currentProduct.name);
        loadTumblerImage();
        updateQuote();
    }

    // ── Catalog meta (EngraveColor per SKU) ────────────────────────────
    // Non-fatal: if this fetch fails, getEngraveColor('') falls back to the
    // template's default silver — the preview still works.
    function loadCatalogMeta() {
        fetch(API_BASE + '/api/jds-catalog?category=Drinkware')
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
            .then(function (data) {
                ((data && data.result) || []).forEach(function (row) {
                    if (row.SKU) catalogBySku[row.SKU] = row;
                });
                if (logoImage) { engravedCache = {}; render(); }
            })
            .catch(function (err) {
                console.warn('[laser-tumbler-mockup] jds-catalog meta unavailable — using default engrave color:', err);
            });
    }

    function currentEngraveField() {
        var sku = page && page.currentSKU;
        var row = sku && catalogBySku[sku];
        return (row && row.EngraveColor) || '';
    }

    // ── Tumbler image (same JDS CDN image the hero uses) ───────────────
    function ensureImage(sku) {
        if (imageCache[sku]) return Promise.resolve(imageCache[sku]);
        var product = (page.allProducts || []).filter(function (p) { return p.sku === sku; })[0];
        var url = product && product.images && (product.images.full || product.images.thumbnail);
        var urlP = url
            ? Promise.resolve(url)
            : fetch(API_BASE + '/api/jds/products/' + encodeURIComponent(sku))
                .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
                .then(function (d) {
                    var u = d && d.result && (d.result.image || d.result.thumbnail);
                    if (!u) throw new Error('JDS API returned no image for ' + sku);
                    return u;
                });
        return urlP.then(loadImageCrossOrigin).then(function (img) {
            imageCache[sku] = img;
            return img;
        });
    }

    function loadTumblerImage() {
        if (!page || !page.currentSKU) return;
        showLoading(true);
        showError('');
        ensureImage(page.currentSKU)
            .then(function (img) {
                tumblerImage = img;
                showLoading(false);
                render();
            })
            .catch(function (err) {
                showLoading(false);
                console.error('[laser-tumbler-mockup] Tumbler image load failed:', err);
                showError('We couldn\'t load the tumbler preview image. Refresh to try again, or call us at 253-922-5793.');
            });
    }

    // ── Logo upload ────────────────────────────────────────────────────
    function wireFileUpload() {
        var dropZone = document.getElementById('ltmk-drop-zone');
        var fileInput = document.getElementById('ltmk-file-input');
        var removeBtn = document.getElementById('ltmk-logo-remove');
        var warnContinue = document.getElementById('ltmk-warning-continue');
        var warnReupload = document.getElementById('ltmk-warning-reupload');

        if (dropZone && fileInput) {
            dropZone.addEventListener('click', function () { fileInput.click(); });
            dropZone.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
            });
            dropZone.addEventListener('dragover', function (e) {
                e.preventDefault();
                dropZone.classList.add('ltmk-drop-zone--active');
            });
            dropZone.addEventListener('dragleave', function () {
                dropZone.classList.remove('ltmk-drop-zone--active');
            });
            dropZone.addEventListener('drop', function (e) {
                e.preventDefault();
                dropZone.classList.remove('ltmk-drop-zone--active');
                if (e.dataTransfer.files.length > 0) handleLogoFile(e.dataTransfer.files[0]);
            });
            fileInput.addEventListener('change', function () {
                if (fileInput.files.length > 0) handleLogoFile(fileInput.files[0]);
            });
        }
        if (removeBtn) removeBtn.addEventListener('click', clearLogo);
        if (warnContinue) {
            warnContinue.addEventListener('click', function () {
                applyAutoFit();
                revealEditing();
                render();
            });
        }
        if (warnReupload) {
            warnReupload.addEventListener('click', function () {
                clearLogo();
                hideWarning();
                document.getElementById('ltmk-file-input').click();
            });
        }
    }

    function handleLogoFile(file) {
        if (!file) return;
        if (file.size > 10 * 1024 * 1024) {
            showError('That file is over 10 MB — please upload a smaller logo.');
            return;
        }
        var reader = new FileReader();
        reader.onload = function (e) {
            var img = new Image();
            img.onload = function () {
                logoImage = img;
                logoFileName = file.name;
                engravedCache = {};
                logoOffset = { dx: 0, dy: 0 };
                showError('');

                var info = document.getElementById('ltmk-logo-info');
                var nameEl = document.getElementById('ltmk-logo-name');
                var thumb = document.getElementById('ltmk-logo-thumb');
                if (info && nameEl) {
                    info.hidden = false;
                    nameEl.textContent = file.name;
                }
                if (thumb) thumb.style.backgroundImage = 'url("' + e.target.result + '")';

                var issues = window.JdsTumblerTemplate.detectLogoIssues(img);
                if (issues.length > 0) {
                    showWarning(issues);
                } else {
                    hideWarning();
                    applyAutoFit();
                    revealEditing();
                    render();
                }
            };
            img.onerror = function () {
                showError('We couldn\'t read that file. Try a PNG, JPG, or SVG.');
            };
            img.src = e.target.result;
        };
        reader.onerror = function () { showError('File upload failed — please try again.'); };
        reader.readAsDataURL(file);
    }

    /**
     * Customer-worded versions of the artwork warnings (the staff tool's copy
     * addresses the AE — "ask the customer for…" — which doesn't work here).
     * Same issue detection from jds-tumbler-template.detectLogoIssues().
     */
    function showWarning(issueCodes) {
        var panel = document.getElementById('ltmk-warning');
        var titleEl = document.getElementById('ltmk-warning-title');
        var bodyEl = document.getElementById('ltmk-warning-body');
        if (!panel || !titleEl || !bodyEl) return;

        var primary = issueCodes[0];
        ['white-on-white', 'dark-background', 'photo', 'medium-gray-only', 'multi-color']
            .some(function (code) {
                if (issueCodes.indexOf(code) !== -1) { primary = code; return true; }
                return false;
            });

        var copy = {
            'white-on-white': {
                title: 'This logo looks white-on-white',
                body: 'Your logo appears to be the version designed for dark backgrounds, so the engraving preview can\'t detect the artwork. If you have a black-on-white or transparent version, that will preview (and engrave) much better.'
            },
            'multi-color': {
                title: 'This logo has multiple colors',
                body: 'Laser engraving is single-color — everything etches the same silver tone. Multi-color logos can lose detail. If you have a one-color version of your logo, it will look crisper; or continue and we\'ll fine-tune the artwork with you before production.'
            },
            'photo': {
                title: 'This looks like a photograph',
                body: 'Laser engraving works best with simple, high-contrast logos rather than photos. You can continue to get an idea of placement, and our art team will help prepare engraving-ready artwork before anything is produced.'
            },
            'medium-gray-only': {
                title: 'This logo is light gray',
                body: 'Engraving previews best from solid black artwork — light gray logos can look faded. If you have a darker version, try that; or continue and we\'ll sharpen it up before production.'
            },
            'dark-background': {
                title: 'This logo has a dark background',
                body: 'The preview reads dark areas as the engraving, so a dark background fills the whole imprint area. A transparent PNG (background removed) will preview much better — or continue and our art team will clean it up before production.'
            }
        };

        var c = copy[primary] || copy['multi-color'];
        titleEl.textContent = c.title;
        bodyEl.textContent = c.body;
        panel.hidden = false;
        setEditingVisible(false);
    }

    function hideWarning() {
        var panel = document.getElementById('ltmk-warning');
        if (panel) panel.hidden = true;
    }

    function revealEditing() { setEditingVisible(true); }

    function setEditingVisible(on) {
        ['ltmk-size-step', 'ltmk-download-step'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.hidden = !on;
        });
    }

    function clearLogo() {
        logoImage = null;
        logoFileName = '';
        engravedCache = {};
        var fileInput = document.getElementById('ltmk-file-input');
        if (fileInput) fileInput.value = '';
        var info = document.getElementById('ltmk-logo-info');
        if (info) info.hidden = true;
        var thumb = document.getElementById('ltmk-logo-thumb');
        if (thumb) thumb.style.backgroundImage = '';
        hideWarning();
        setEditingVisible(false);
        render();
    }

    // ── Size & position ────────────────────────────────────────────────
    function wireSizeAndPosition() {
        var slider = document.getElementById('ltmk-size-slider');
        var pct = document.getElementById('ltmk-size-pct');
        var fitBtn = document.getElementById('ltmk-fit-btn');
        var centerBtn = document.getElementById('ltmk-center-btn');

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
    }

    // Fit the logo inside the imprint area in BOTH dimensions (slider sizes by
    // width only, so tall logos could otherwise overflow). Same math as staff tool.
    function computeFitPct() {
        if (!logoImage) return 70;
        var w = logoImage.naturalWidth || logoImage.width;
        var h = logoImage.naturalHeight || logoImage.height;
        if (!w || !h) return 70;
        var aspect = h / w;
        var maskW = window.JdsTumblerTemplate.MASK.w;
        var maskH = window.JdsTumblerTemplate.MASK.h;
        var byWidth = 92;
        var byHeight = (maskH * 0.82) / (maskW * aspect) * 100;
        var p = Math.max(30, Math.min(110, Math.min(byWidth, byHeight)));
        return Math.round(p / 2) * 2;
    }

    function applyAutoFit() {
        logoSizePct = computeFitPct();
        var slider = document.getElementById('ltmk-size-slider');
        var pct = document.getElementById('ltmk-size-pct');
        if (slider) slider.value = logoSizePct;
        if (pct) pct.textContent = logoSizePct;
    }

    // ── Canvas interaction (pointer drag + arrow keys) ─────────────────
    function wireCanvasInteraction() {
        var canvas = document.getElementById('ltmk-canvas');
        if (!canvas) return;

        function getCanvasCoords(evt) {
            var rect = canvas.getBoundingClientRect();
            return {
                x: (evt.clientX - rect.left) * (canvas.width / rect.width),
                y: (evt.clientY - rect.top) * (canvas.height / rect.height)
            };
        }

        canvas.addEventListener('pointerdown', function (e) {
            if (!logoImage || !tumblerImage) return;
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

        canvas.addEventListener('keydown', function (e) {
            if (!logoImage || !tumblerImage) return;
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
        var mask = window.JdsTumblerTemplate.getMaskCoords(PREVIEW_SIZE, PREVIEW_SIZE);
        var maxX = mask.w / 2 - 20;
        var maxY = mask.h / 2 - 20;
        logoOffset.dx = Math.max(-maxX, Math.min(maxX, logoOffset.dx));
        logoOffset.dy = Math.max(-maxY, Math.min(maxY, logoOffset.dy));
    }

    // ── Mockup composition (same pipeline as the staff tool) ───────────
    function getEngravedLogo() {
        if (!logoImage) return null;
        var hex = window.JdsTumblerTemplate.getEngraveColor(currentEngraveField());
        if (!engravedCache[hex]) {
            engravedCache[hex] = window.JdsTumblerTemplate.buildEngravedLogo(logoImage, hex);
        }
        return engravedCache[hex];
    }

    function composeMockup(ctx, size) {
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(tumblerImage, 0, 0, size, size);
        window.JdsTumblerTemplate.paintMaskedArea(ctx, size, size, page.currentSKU);
        if (logoImage) {
            var engraved = getEngravedLogo();
            var mask = window.JdsTumblerTemplate.getMaskCoords(size, size);
            var scale = size / PREVIEW_SIZE;
            var targetW = mask.w * (logoSizePct / 100);
            var cx = mask.cx + logoOffset.dx * scale;
            var cy = mask.cy + logoOffset.dy * scale;
            window.JdsTumblerTemplate.drawLogoCentered(ctx, engraved, cx, cy, targetW);
        }
    }

    function render() {
        var canvas = document.getElementById('ltmk-canvas');
        var emptyEl = document.getElementById('ltmk-preview-empty');
        var captionEl = document.getElementById('ltmk-caption');
        if (!canvas) return;

        if (!tumblerImage) {
            canvas.hidden = true;
            if (emptyEl) emptyEl.hidden = false;
            if (captionEl) captionEl.hidden = true;
            return;
        }
        canvas.hidden = false;
        if (emptyEl) emptyEl.hidden = true;

        canvas.width = PREVIEW_SIZE;
        canvas.height = PREVIEW_SIZE;
        try {
            composeMockup(canvas.getContext('2d'), PREVIEW_SIZE);
        } catch (err) {
            console.error('[laser-tumbler-mockup] Render failed:', err);
            showError('Preview unavailable right now — refresh to try again, or call us at 253-922-5793.');
            return;
        }
        if (captionEl) captionEl.hidden = !logoImage;
    }

    // ── Download ───────────────────────────────────────────────────────
    function wireDownload() {
        var btn = document.getElementById('ltmk-download-btn');
        if (btn) btn.addEventListener('click', downloadMockup);
    }

    function downloadMockup() {
        if (!tumblerImage || !logoImage) return;
        var c = document.createElement('canvas');
        c.width = c.height = DOWNLOAD_SIZE;
        try {
            composeMockup(c.getContext('2d'), DOWNLOAD_SIZE);
        } catch (err) {
            showError('Download failed: ' + err.message);
            return;
        }
        c.toBlob(function (blob) {
            if (!blob) { showError('We couldn\'t produce the image — try again.'); return; }
            var url = URL.createObjectURL(blob);
            var safeLogo = logoFileName.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9]+/g, '_');
            var a = document.createElement('a');
            a.href = url;
            a.download = page.currentSKU + '-' + (safeLogo || 'mockup') + '.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
        }, 'image/png');
    }

    // ── Instant quote (same live formula pricing as the tier table) ────
    function wireQuote() {
        var qty = document.getElementById('ltmk-qty');
        if (!qty) return;
        qty.addEventListener('input', updateQuote);
        qty.addEventListener('change', function () {
            var v = parseInt(qty.value, 10);
            if (!Number.isFinite(v) || v < 1) qty.value = 1;
            if (v > 9999) qty.value = 9999;
            updateQuote();
        });
        updateQuote();
    }

    function updateQuote() {
        var qtyEl = document.getElementById('ltmk-qty');
        var box = document.getElementById('ltmk-quote-result');
        if (!qtyEl || !box || !page || !page.currentProduct || !page.apiService) return;

        var qty = parseInt(qtyEl.value, 10);
        if (!Number.isFinite(qty) || qty < 1) { box.innerHTML = ''; return; }

        var localStock = (page.localInventory && page.localInventory.totalStock) || 0;
        if (qty < SUPPLIER_MIN && localStock <= 0) {
            box.innerHTML = '<div class="ltmk-quote-warning"><i class="fas fa-exclamation-triangle"></i> '
                + 'This color has no local stock right now, so the minimum order is ' + SUPPLIER_MIN
                + ' pieces (one case from our supplier). Call us at 253-922-5793 for options.</div>';
            return;
        }

        var svc = page.apiService;
        var unit;
        try {
            var wholesale = svc.getWholesalePriceForQuantity(page.currentProduct, qty);
            if (!Number.isFinite(parseFloat(wholesale)) || wholesale <= 0) throw new Error('no wholesale price');
            unit = svc.halfDollarUp(svc.calculatePrice(parseFloat(wholesale)));
        } catch (err) {
            console.error('[laser-tumbler-mockup] Quote unavailable:', err);
            box.innerHTML = '<div class="ltmk-quote-warning"><i class="fas fa-exclamation-triangle"></i> '
                + 'Live pricing is unavailable right now — call us at 253-922-5793 for a quote.</div>';
            return;
        }

        var ltmFee = qty < LTM_THRESHOLD ? svc.SMALL_ORDER_HANDLING_FEE : 0;
        var total = unit * qty + ltmFee;

        var html = '<div class="ltmk-quote-line"><span>' + qty + ' &times; $' + unit.toFixed(2)
            + ' per tumbler</span><span>$' + (unit * qty).toFixed(2) + '</span></div>';
        if (ltmFee > 0) {
            html += '<div class="ltmk-quote-line"><span>Small-order fee (under ' + LTM_THRESHOLD
                + ' pieces)</span><span>$' + ltmFee.toFixed(2) + '</span></div>';
        }
        html += '<div class="ltmk-quote-total"><span>Estimated total</span><span>$' + total.toFixed(2) + '</span></div>'
            + '<p class="ltmk-quote-note">Includes one-location laser engraving. Plus any applicable charges listed above and sales tax.</p>';
        box.innerHTML = html;
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
        var el = document.getElementById('ltmk-preview-loading');
        if (el) el.hidden = !on;
    }

    function showError(msg) {
        var el = document.getElementById('ltmk-preview-error');
        if (!el) return;
        if (msg) { el.textContent = msg; el.hidden = false; }
        else { el.hidden = true; }
    }

})();
