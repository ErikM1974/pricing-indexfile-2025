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

    return {
        MASK: MASK,
        SAMPLE_STRIP: SAMPLE_STRIP,
        ENGRAVE_PALETTE: ENGRAVE_PALETTE,
        getEngraveColor: getEngraveColor,
        paintMaskedArea: paintMaskedArea,
        buildEngravedLogo: buildEngravedLogo,
        drawLogoCentered: drawLogoCentered,
        getMaskCoords: getMaskCoords
    };
})();
