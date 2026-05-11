/**
 * jds-tumbler-template.js — Algorithm module for the JDS Tumbler Mockup Creator.
 *
 * Pure logic, no DOM coupling. Exposes a small surface that both the standalone
 * mockup creator page and (Phase 2) the art-request-detail integration call.
 *
 * The pipeline:
 *   1. Load the JDS catalog tumbler image (1800×1800 from JDS Cloudinary CDN)
 *   2. Sample a thin horizontal strip JUST ABOVE the imprint area
 *   3. Stretch that strip vertically to fill a masked rectangle (the imprint zone),
 *      effectively painting over JDS's placeholder logo in the natural tumbler
 *      color — inherits the cylinder's left-right lighting gradient for free
 *   4. Composite the user's logo into the mask area, recolored as silver (or
 *      dark-etch on stainless), with a soft kerf-like edge that mimics engraving
 *
 * All 17 SKUs share the SAME tumbler shape (Polar Camel 16oz Pint, just different
 * colors), so a single mask coordinate set works for all of them. Per-SKU engrave
 * color comes from the catalog's EngraveColor field — no per-SKU tuning needed.
 *
 * Verified findings (2026-05-11):
 *   - Source images: all 17 are 1800×1800 PNG from Cloudinary, transparent bg
 *   - Imprint area: roughly centered around (900, 720) in source coords
 *   - LTM751 stainless engraves DARK (no powder coating to remove); other 16
 *     engrave SILVER (laser removes colored powder, reveals bare steel)
 *
 * Depends on: nothing external. Pure browser-side JS. CORS-friendly source needed.
 */
var JdsTumblerTemplate = (function () {
    'use strict';

    /**
     * Mask coordinates in the 1800×1800 source image space. Tuned via pixel-
     * scan of LTM762 (Orange) on 2026-05-11:
     *
     *   Steel lid ends at y~400
     *   Clean orange band: y=420 to y=540 (120px tall — sample strip lives here)
     *   Placeholder logo (SHIFT COMPONENTS stack): y=560 to y=945
     *   Below logo: clean orange y=960+
     *
     * Mask needs to cover the logo PLUS the feather radius on each side so the
     * gradient alpha edge doesn't reveal original logo pixels. With featherPx=24:
     *   - Top: 560 - 24 = 536 → set MASK.y = 520 (extra 16px slack)
     *   - Bottom: 945 + 24 = 969 → MASK.y + MASK.h = 1000 → MASK.h = 480
     *
     * Width: visually picked. SHIFT COMPONENTS is the widest logo we saw,
     * spanning roughly x=620-1180. With 24px feather → need x=596-1204.
     * Set 580-1220 (width 640) for comfort.
     */
    var MASK = {
        x: 420,
        y: 440,
        w: 960,
        h: 700,
        // Soft feather radius — pixel gradient at edges so the patch blends
        // into the surrounding tumbler surface even if the placeholder logo
        // on that SKU is smaller than the mask box. Kept tight (16px) so
        // the full-opacity center reaches all the way to the actual logo
        // bounds; otherwise the feather lets the placeholder bleed through.
        //
        // Sized generously to swallow EVERY placeholder logo across the 16
        // mockup-eligible SKUs. Logos vary wildly: LTM758 California Surfing
        // extends down to y~1100, LTM767 Miss Kiki's TIKI has palm trees
        // fanning up to y~440 and text below to y~1140. Mask y=440-1140 +
        // featherPx=16 → full-opacity coverage y=456 to y=1124. Wider mask
        // is visually invisible because we fill with the same tumbler color
        // we sampled — over-patching pure color over pure color shows no seam.
        featherPx: 16
    };

    /**
     * Where to sample the tumbler color from. A thin horizontal strip JUST
     * BELOW the mask, in the smooth body area between the imprint zone and
     * the bottom decorative ribs. Stretching this strip vertically reproduces
     * the cylinder's natural left-right lighting gradient inside the mask.
     *
     * Sampling BELOW (not above) the placeholder is more reliable across
     * the 16 SKUs because some placeholders (notably LTM767 Miss Kiki's
     * TIKI palm trees) extend close to the top of the colored body, leaving
     * little room for a clean sample above. But every placeholder ends by
     * y~1140, after which there's a clean ~100px band of pure tumbler
     * color before the rib decorations start (~y=1240+).
     */
    var SAMPLE_STRIP = {
        x: 420,
        y: 1160,
        w: 960,
        h: 30
    };

    /**
     * Tumbler-color engrave palette. JDS's EngraveColor field uses two
     * prefixes that drive the look:
     *   - "Silver on ..." → silver fill (laser removes coating, shows steel)
     *   - "Dark etch on Stainless" → near-black fill (laser oxidizes steel)
     * Hex values picked to match what we observed on real catalog images.
     */
    var ENGRAVE_PALETTE = {
        silver: '#C8C8C8',
        darkEtch: '#2A2A2A'
    };

    /**
     * Resolve the engrave color for a SKU from its catalog EngraveColor field.
     * Falls back to silver for unknown values — silver is correct for 16 of 17
     * SKUs, so it's the right default if we ever see a new color string.
     */
    function getEngraveColor(engraveColorField) {
        var v = String(engraveColorField || '').trim().toLowerCase();
        if (v.indexOf('dark etch') === 0 || v.indexOf('black') === 0) {
            return ENGRAVE_PALETTE.darkEtch;
        }
        return ENGRAVE_PALETTE.silver;
    }

    /**
     * Render the cleared imprint zone (mask filled with stretched sample strip)
     * onto the given canvas context. Assumes ctx already has the source tumbler
     * image drawn at the canvas's full size.
     *
     * Implementation:
     *   - Snapshot the sample strip's pixel data
     *   - Stretch it vertically to fill the mask area
     *   - Apply a feathered alpha mask so edges blend smoothly
     *
     * @param {CanvasRenderingContext2D} ctx — canvas with tumbler already drawn
     * @param {number} sourceW — source image width (so we can scale mask coords)
     * @param {number} sourceH — source image height
     */
    function paintMaskedArea(ctx, sourceW, sourceH) {
        // Scale mask + sample-strip coords from 1800×1800 reference to whatever
        // the actual source dimensions are. Locked-in 1800×1800 today but this
        // keeps us safe if JDS ever publishes at a different resolution.
        var sx = sourceW / 1800;
        var sy = sourceH / 1800;
        var mask = {
            x: MASK.x * sx,
            y: MASK.y * sy,
            w: MASK.w * sx,
            h: MASK.h * sy
        };
        var strip = {
            x: SAMPLE_STRIP.x * sx,
            y: SAMPLE_STRIP.y * sy,
            w: SAMPLE_STRIP.w * sx,
            h: SAMPLE_STRIP.h * sy
        };

        // Pull the sample strip into an off-canvas to stretch from.
        var stripCanvas = document.createElement('canvas');
        stripCanvas.width = strip.w;
        stripCanvas.height = strip.h;
        var stripCtx = stripCanvas.getContext('2d');
        stripCtx.drawImage(
            ctx.canvas,
            strip.x, strip.y, strip.w, strip.h,
            0, 0, strip.w, strip.h
        );

        // Build the feathered alpha mask off-screen. Radial-ish gradient so
        // the patch transitions softly into the tumbler surface — hides any
        // mismatch between strip-sampled color and the actual cylinder shading.
        var maskCanvas = document.createElement('canvas');
        maskCanvas.width = mask.w;
        maskCanvas.height = mask.h;
        var maskCtx = maskCanvas.getContext('2d');

        // First draw stretched strip onto mask canvas at full opacity.
        maskCtx.drawImage(
            stripCanvas,
            0, 0, strip.w, strip.h,
            0, 0, mask.w, mask.h
        );

        // Then apply feather: use destination-out with a soft inset rectangle
        // to leave a gradient alpha at the edges.
        var feather = MASK.featherPx * Math.min(sx, sy);
        var grad = maskCtx.createLinearGradient(0, 0, 0, mask.h);
        // The gradient strategy: full opacity in the middle 80%, fading out
        // toward top/bottom edges. We'll do horizontal feather separately.
        // Combine via canvas globalCompositeOperation = 'destination-in' with
        // a soft-edged rectangle pattern.

        // Composite mask onto the main canvas using destination over the
        // existing tumbler. Use globalCompositeOperation = 'source-over' so
        // mask pixels replace tumbler-and-logo where opaque.
        // The feathered alpha is built by painting a soft rounded rect mask.
        feather = Math.max(8, feather);
        applyFeatheredCopy(ctx, maskCanvas, mask.x, mask.y, mask.w, mask.h, feather);
    }

    /**
     * Copy a source canvas onto the destination ctx at (dx,dy,dw,dh), with a
     * feathered alpha (soft fade at edges). Achieves the seamless "patch over
     * the placeholder logo" effect.
     */
    function applyFeatheredCopy(destCtx, sourceCanvas, dx, dy, dw, dh, feather) {
        // Build a temp canvas the size of the patch, with the source drawn,
        // then erase a feathered border using destination-out with gradients.
        var tmp = document.createElement('canvas');
        tmp.width = dw;
        tmp.height = dh;
        var tctx = tmp.getContext('2d');
        tctx.drawImage(sourceCanvas, 0, 0, dw, dh);

        // Feather top
        var topGrad = tctx.createLinearGradient(0, 0, 0, feather);
        topGrad.addColorStop(0, 'rgba(0,0,0,1)');
        topGrad.addColorStop(1, 'rgba(0,0,0,0)');
        tctx.globalCompositeOperation = 'destination-out';
        tctx.fillStyle = topGrad;
        tctx.fillRect(0, 0, dw, feather);

        // Feather bottom
        var botGrad = tctx.createLinearGradient(0, dh - feather, 0, dh);
        botGrad.addColorStop(0, 'rgba(0,0,0,0)');
        botGrad.addColorStop(1, 'rgba(0,0,0,1)');
        tctx.fillStyle = botGrad;
        tctx.fillRect(0, dh - feather, dw, feather);

        // Feather left
        var leftGrad = tctx.createLinearGradient(0, 0, feather, 0);
        leftGrad.addColorStop(0, 'rgba(0,0,0,1)');
        leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
        tctx.fillStyle = leftGrad;
        tctx.fillRect(0, 0, feather, dh);

        // Feather right
        var rightGrad = tctx.createLinearGradient(dw - feather, 0, dw, 0);
        rightGrad.addColorStop(0, 'rgba(0,0,0,0)');
        rightGrad.addColorStop(1, 'rgba(0,0,0,1)');
        tctx.fillStyle = rightGrad;
        tctx.fillRect(dw - feather, 0, feather, dh);

        // Reset and draw the feathered patch onto the main canvas.
        tctx.globalCompositeOperation = 'source-over';
        destCtx.drawImage(tmp, dx, dy);
    }

    /**
     * Convert any image (HTMLImageElement, canvas, ImageBitmap) into a
     * silhouette-and-recolored bitmap matching engrave style. Returns a canvas
     * sized to the logo's natural dimensions.
     *
     * Detection rules:
     *   - If the image has transparency (alpha < 255 anywhere) → use alpha as
     *     mask, fill RGB with engrave color
     *   - Otherwise → threshold dark pixels (luminance < 128) as the logo
     *     silhouette; light pixels become transparent
     *
     * @param {HTMLImageElement|HTMLCanvasElement} logoSource — already-loaded image
     * @param {string} engraveColor — hex like '#C8C8C8'
     * @returns {HTMLCanvasElement} canvas containing the engraved-style logo
     */
    function buildEngravedLogo(logoSource, engraveColor) {
        var w = logoSource.naturalWidth || logoSource.width;
        var h = logoSource.naturalHeight || logoSource.height;
        if (!w || !h) {
            throw new Error('Logo source has zero dimensions');
        }

        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(logoSource, 0, 0, w, h);

        var img = ctx.getImageData(0, 0, w, h);
        var data = img.data;

        // Detect whether the source has any transparency. If yes, we use alpha
        // as the silhouette mask. If not, we threshold by luminance — useful
        // for opaque PNGs / JPGs where logo is dark on light background.
        var hasAlpha = false;
        for (var i = 3; i < data.length; i += 4) {
            if (data[i] < 250) { hasAlpha = true; break; }
        }

        // Parse engrave color hex once.
        var rgb = hexToRgb(engraveColor);
        var er = rgb[0], eg = rgb[1], eb = rgb[2];

        if (hasAlpha) {
            // Preserve alpha exactly, replace RGB with engrave color everywhere
            // there's any opacity. Edges naturally get a soft kerf because the
            // alpha gradient from antialiasing carries through.
            for (var j = 0; j < data.length; j += 4) {
                if (data[j + 3] > 0) {
                    data[j] = er;
                    data[j + 1] = eg;
                    data[j + 2] = eb;
                }
            }
        } else {
            // Threshold-to-silhouette path. Luminance < 128 → engrave color,
            // else → transparent. Anti-alias the edges with luminance gradient
            // mapped to alpha for a softer look (avoids jagged threshold edges).
            for (var k = 0; k < data.length; k += 4) {
                var luma = 0.299 * data[k] + 0.587 * data[k + 1] + 0.114 * data[k + 2];
                if (luma >= 220) {
                    // Background → fully transparent
                    data[k + 3] = 0;
                } else if (luma <= 60) {
                    // Solid logo center → engrave color
                    data[k] = er;
                    data[k + 1] = eg;
                    data[k + 2] = eb;
                    data[k + 3] = 255;
                } else {
                    // Edge gradient — interpolate alpha based on luma
                    data[k] = er;
                    data[k + 1] = eg;
                    data[k + 2] = eb;
                    data[k + 3] = Math.round(255 * (220 - luma) / 160);
                }
            }
        }

        ctx.putImageData(img, 0, 0);
        return canvas;
    }

    /**
     * Draw the engraved logo onto the main canvas centered at (cx, cy) with
     * the given target width. Maintains aspect ratio.
     *
     * @param {CanvasRenderingContext2D} ctx — destination canvas
     * @param {HTMLCanvasElement} engravedLogo — result of buildEngravedLogo
     * @param {number} cx — center x
     * @param {number} cy — center y
     * @param {number} targetW — desired width in destination pixels
     */
    function drawLogoCentered(ctx, engravedLogo, cx, cy, targetW) {
        var aspect = engravedLogo.height / engravedLogo.width;
        var targetH = targetW * aspect;
        ctx.drawImage(
            engravedLogo,
            cx - targetW / 2,
            cy - targetH / 2,
            targetW,
            targetH
        );
    }

    /** Helper: '#RRGGBB' → [r, g, b]. */
    function hexToRgb(hex) {
        var h = String(hex || '').replace('#', '');
        if (h.length === 3) {
            h = h.split('').map(function (c) { return c + c; }).join('');
        }
        var n = parseInt(h, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    /**
     * Get mask coords in source-image space. Useful for the UI layer that
     * needs to position drag handles relative to the displayed canvas.
     */
    function getMaskCoords(sourceW, sourceH) {
        var sx = (sourceW || 1800) / 1800;
        var sy = (sourceH || 1800) / 1800;
        return {
            x: MASK.x * sx,
            y: MASK.y * sy,
            w: MASK.w * sx,
            h: MASK.h * sy,
            cx: (MASK.x + MASK.w / 2) * sx,
            cy: (MASK.y + MASK.h / 2) * sy
        };
    }

    /**
     * Detect whether an uploaded logo is likely to render poorly in the
     * single-color engrave pipeline. Browser-side pixel sampling, no AI.
     * Returns an array of issue codes (empty = looks good):
     *
     *   'white-on-white'  — opaque image with almost all bright pixels (logo
     *                       designed for dark backgrounds, no dark pixels to
     *                       threshold against). Failure mode confirmed on the
     *                       Emily's Market sample (2026-05-11).
     *   'multi-color'     — 4+ distinct color clusters at coarse quantization.
     *                       Drop shadows + overlapping color regions collapse
     *                       into a silver blob. Failure mode confirmed on the
     *                       Shakey's Pizza and Barista Betties samples.
     *   'photo'           — 50+ distinct colors at fine quantization. Photo-
     *                       realistic images can't engrave as a binary stencil.
     *
     * Algorithm: render to a 200×200 canvas (downsampled for speed), sample
     * 500 random pixels, run three independent checks. All cheap math, runs
     * in <50ms on a typical browser.
     *
     * @param {HTMLImageElement|HTMLCanvasElement} logoSource — loaded image
     * @returns {string[]} issue codes
     */
    function detectLogoIssues(logoSource) {
        var w = logoSource.naturalWidth || logoSource.width;
        var h = logoSource.naturalHeight || logoSource.height;
        if (!w || !h) return [];

        // Downsample to 200×200 for cheap sampling — preserves color
        // distribution without paying the cost of reading 4K image data.
        var size = 200;
        var canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(logoSource, 0, 0, size, size);

        var img;
        try {
            img = ctx.getImageData(0, 0, size, size);
        } catch (e) {
            // Cross-origin canvas — can't read pixels. Bail rather than block.
            return [];
        }
        var data = img.data;

        // Random pixel sampling — 500 points is plenty for distribution stats
        var samples = [];
        var sampleCount = 500;
        for (var i = 0; i < sampleCount; i++) {
            var px = Math.floor(Math.random() * size * size) * 4;
            samples.push({
                r: data[px],
                g: data[px + 1],
                b: data[px + 2],
                a: data[px + 3]
            });
        }

        var issues = [];

        // ── Check 1: white-on-white ─────────────────────────────────────
        // Image is fully opaque, nearly all pixels are very bright, AND
        // there are essentially no dark pixels to use as the logo silhouette.
        // The "no dark pixels" condition is critical — without it, this fires
        // on legitimate black-text-on-white logos (which have lots of white
        // background BUT also have some black text pixels). Confirmed via
        // West Coast Truck logo test: 500 samples, most are white but ~5%
        // are dark text — that 5% IS the logo, so we should let it render.
        var opaqueCount = samples.filter(function (p) { return p.a > 250; }).length;
        var brightCount = samples.filter(function (p) {
            var luma = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
            return luma > 230;
        }).length;
        var darkCount = samples.filter(function (p) {
            var luma = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
            return luma < 100 && p.a > 128;
        }).length;
        if (opaqueCount / sampleCount > 0.95
            && brightCount / sampleCount > 0.9
            && darkCount / sampleCount < 0.005) {
            issues.push('white-on-white');
        }

        // ── Check 2: multi-color complexity ─────────────────────────────
        // Count distinct color buckets after coarse quantization. Bucket
        // each pixel to nearest 64-step grid (4 levels per channel = 64
        // possible colors max). Many distinct buckets → multi-color logo.
        // Skip near-transparent samples (alpha < 128) — those are background.
        //
        // Don't count WHITE-ish buckets as "color" — most logos have white
        // background which is its own bucket, and counting it inflates the
        // "color count" by 1. A truly multi-color brand logo will have
        // 4+ NON-WHITE distinct color buckets (e.g. Shakey's: red + yellow
        // + black + the white text). Threshold lowered to 1% to catch
        // smaller-area accent colors like Shakey's yellow PIZZA panel.
        var colorBuckets = {};
        samples.forEach(function (p) {
            if (p.a < 128) return;
            var key = (p.r >> 6) + '-' + (p.g >> 6) + '-' + (p.b >> 6);
            colorBuckets[key] = (colorBuckets[key] || 0) + 1;
        });
        // Buckets that hold >1% of samples and aren't pure white background
        var significantBuckets = Object.keys(colorBuckets).filter(function (k) {
            if (colorBuckets[k] / sampleCount <= 0.01) return false;
            // Exclude the "white-ish" bucket (3-3-3 in our 4-level grid).
            // That bucket represents the background; a logo with text on
            // a white card legitimately has 1 white bucket and shouldn't
            // be flagged just for that.
            if (k === '3-3-3') return false;
            return true;
        });
        // 3+ non-white color regions = high risk of blobbing. Catches Shakey's
        // (red + yellow + black panels), Barista Betties (2 teals + edges),
        // and similar multi-color brand logos. Single-color text logos like
        // Thundercats or West Coast only have ONE non-white bucket (black)
        // and pass through clean.
        if (significantBuckets.length >= 3) {
            issues.push('multi-color');
        }

        // ── Check 3: photo-likely ───────────────────────────────────────
        // Many distinct colors at fine quantization (32-step grid = 512
        // possible colors). Photos always hit 50+; clean logos rarely
        // exceed 20 even with anti-aliasing.
        var fineBuckets = {};
        samples.forEach(function (p) {
            if (p.a < 128) return;
            var key = (p.r >> 5) + '-' + (p.g >> 5) + '-' + (p.b >> 5);
            fineBuckets[key] = true;
        });
        if (Object.keys(fineBuckets).length >= 50) {
            issues.push('photo');
        }

        // ── Check 4: medium-gray only ───────────────────────────────────
        // Opaque image with NO dark pixels (luma <100) AND significant mid-
        // luma content (100-230). The luma-threshold silhouette extractor
        // expects DARK pixels as the logo; gray-only logos fall in the edge-
        // gradient zone and render as faded/translucent shapes that may be
        // hard to read on the tumbler. Confirmed via Northwest Raiders test
        // case — medium-gray shield logo on white background, no dark areas.
        //
        // The white-on-white check above requires brightCount > 90% which
        // means midCount < 10%; this check requires midCount > 15%, so the
        // two are mutually exclusive (no double-fire).
        var midCount = samples.filter(function (p) {
            if (p.a < 128) return false;
            var luma = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
            return luma >= 100 && luma <= 230;
        }).length;
        if (opaqueCount / sampleCount > 0.95
            && darkCount / sampleCount < 0.005
            && midCount / sampleCount > 0.15) {
            issues.push('medium-gray-only');
        }

        return issues;
    }

    return {
        MASK: MASK,
        SAMPLE_STRIP: SAMPLE_STRIP,
        ENGRAVE_PALETTE: ENGRAVE_PALETTE,
        getEngraveColor: getEngraveColor,
        paintMaskedArea: paintMaskedArea,
        buildEngravedLogo: buildEngravedLogo,
        drawLogoCentered: drawLogoCentered,
        getMaskCoords: getMaskCoords,
        detectLogoIssues: detectLogoIssues
    };
})();
