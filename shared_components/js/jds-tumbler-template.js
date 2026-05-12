/**
 * jds-tumbler-template.js — Algorithm module for the JDS Tumbler Mockup Creator.
 *
 * Pure logic, no DOM coupling. Exposes a small surface that both the standalone
 * mockup creator page and (Phase 2) the art-request-detail integration call.
 *
 * The pipeline (v3, 2026-05-11):
 *   1. Load the JDS catalog tumbler image (1800×1800 from JDS Cloudinary CDN)
 *   2. Scan each row inside the mask area to find the body's left/right
 *      opaque edges — handles the cylinder's natural taper (wider top,
 *      narrower bottom) without per-SKU coordinate tuning
 *   3. Sample left-edge tint and right-edge tint from a thin slab just
 *      inside each row's body edges; lerp horizontally to fill the row
 *   4. Preserve original alpha so the patch never paints over transparent
 *      pixels (i.e., never extends beyond the tumbler's silhouette)
 *   5. Apply asymmetric feather (cubic-eased top/bottom, linear sides) and
 *      composite — soft fade hides any minor mismatch at row boundaries
 *   6. Composite the user's logo into the mask area, recolored as silver (or
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
        // y=420 (not 440) so the mask's top rows sample from the body's
        // rim-shadow zone (y=420-440 sits just below the silver lid, in the
        // sharp brightness transition where the body emerges from the rim
        // cap). Capturing this zone in the patch produces a dark top that
        // blends smoothly into the body above — no visible seam at the
        // mask top edge. Placeholder logos don't extend up here on any SKU
        // (verified 2026-05-11): LTM767 TIKI palm trees fan up to y=440 max
        // but are centered horizontally, so per-row edge sampling at
        // x=leftX+8 stays clean.
        y: 420,
        w: 960,
        // h=800 covers y=420-1220. The bottom feather (40 source-px) erodes
        // patch alpha across the last 40px of the mask, revealing whatever
        // is underneath. So placeholder content must end at least 40px above
        // the mask bottom. LTM767 Miss Kiki's TIKI text extends to ~y=1175
        // (the lowest of any SKU), so mask bottom y=1220 keeps 45px of
        // safe clean-body margin before the feather starts eating into the
        // placeholder. Bottom rib decoration starts at y~1240, so we still
        // have 20px of safety to the ribs.
        h: 800,
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
     * Edge-sampling parameters for the per-row body-bounds algorithm.
     *
     * Tumblers TAPER — the Polar Camel 16oz Pint body is ~884px wide at the
     * top of the mask (y=440) but only ~772px wide at the bottom (y=1140).
     * For each row of the mask, the algorithm scans to find the body's left
     * and right opaque edges, then samples a thin slab INSIDE each edge for
     * the row's left/right tint.
     *
     * `EDGE_INSET` (20): how far inside the body's first opaque pixel to start
     * sampling. Was 8 in v3 but that picked up residual anti-aliasing pixels
     * which are partially desaturated — caused the patch to look slightly
     * pinkish/washed-out compared to surrounding body. 20px gets pure body.
     *
     * `EDGE_SAMPLE_W` (24): width of the slab to average for row tint. Was 16
     * in v3, widened with the inset to keep sample stability.
     */
    var EDGE_INSET = 20;
    var EDGE_SAMPLE_W = 24;

    /**
     * Body-center reference sample — used in addition to the per-row edge
     * samples to give the patch a realistic cylindrical lighting profile.
     *
     * The per-row left/right edge sampling captures the cylinder's edge-
     * shadow zone (darker, less saturated). Lerping linearly between two
     * edge colors gives a patch with NO brightness peak in the middle,
     * making it look "hazy" compared to the real cylinder which has a
     * natural brightness/saturation peak at its horizontal center.
     *
     * This constant defines a clean horizontal slab below the mask (between
     * the mask bottom at y=1220 and the rib decoration start at ~y=1240)
     * at the body's horizontal center (~x=895). Sampling here once per
     * render gives us the "true" cylinder center color for the SKU. The
     * patch interior then triangular-lerps from left edge → CENTER_REF →
     * right edge, producing the real cylinder lighting profile.
     *
     * Verified clean on all 16 mockup-eligible SKUs (2026-05-11).
     */
    var CENTER_REF_SAMPLE = {
        x: 815,
        y: 1222,
        w: 160,
        h: 16
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
     * Render the cleared imprint zone onto the given canvas context. Assumes
     * ctx already has the source tumbler image drawn at the canvas's full size.
     *
     * Algorithm (v4, 2026-05-11 — triangular lerp + cylindrical lighting + noise + luma correction):
     *   1. Sample a body-CENTER reference color from a clean band below the
     *      mask (CENTER_REF_SAMPLE) — represents the cylinder's brightness
     *      peak, which the per-row edge samples never reach.
     *   2. Sample reference luminosity from clean bands ABOVE and BELOW the
     *      mask (used by step 7 — luminosity correction).
     *   3. Read the full mask Y range from the canvas in one getImageData call.
     *   4. For each row: scan body left/right edges (handles cylinder taper),
     *      sample a slab 20 source-px inside each edge (deeper than v3's 8px
     *      — skips AA residue for better saturation).
     *   5. TRIANGULAR 3-point lerp: leftEdge → CENTER_REF → rightEdge across
     *      the mask width. Reproduces the real cylindrical lighting profile
     *      (dark edges, bright/saturated middle). Fixes v3's hazy-middle.
     *   6. Apply low-amplitude Gaussian noise overlay (σ≈3, ~1.2% luma jitter)
     *      seeded deterministically from SKU code — mimics powder-coat grain.
     *   7. Match the patch's overall luminosity to the surrounding body
     *      (clamped to [0.85, 1.15] ratio) — final correction for systematic
     *      mismatches the per-row sampling can't predict.
     *   8. Apply asymmetric feather (40px cubic top/bottom, 24px linear sides)
     *      and composite onto the main canvas.
     *
     * Why this beats v3: v3's edge-only sampling captured the cylinder's
     * edge-shadow zone exclusively. Lerping two edge colors produced a patch
     * uniformly at edge brightness, missing the cylinder's natural center
     * peak. The patch looked "hazy / cloudy" against the brighter real-
     * cylinder middle. CENTER_REF + triangular lerp restores the brightness
     * peak; noise restores texture grain; luma correction snaps residual
     * mismatch to surrounding body.
     *
     * @param {CanvasRenderingContext2D} ctx — canvas with tumbler already drawn
     * @param {number} sourceW — source image width (scales the reference coords)
     * @param {number} sourceH — source image height
     * @param {string} [sku]   — SKU code for deterministic noise seed
     */
    function paintMaskedArea(ctx, sourceW, sourceH, sku) {
        var sx = sourceW / 1800;
        var sy = sourceH / 1800;
        var mask = {
            x: Math.round(MASK.x * sx),
            y: Math.round(MASK.y * sy),
            w: Math.round(MASK.w * sx),
            h: Math.round(MASK.h * sy)
        };

        // Edge-sampling params scaled to the canvas resolution
        var edgeInset = Math.max(4, Math.round(EDGE_INSET * Math.min(sx, sy)));
        var edgeSampleW = Math.max(8, Math.round(EDGE_SAMPLE_W * Math.min(sx, sy)));

        // Step 1: Sample CENTER_REF color from clean band below mask. This
        // is the "cylinder brightness peak" reference that anchors the
        // triangular lerp's middle waypoint. Falls back to a per-row middle
        // sample if the band is somehow out of bounds.
        var centerRef = sampleAverageColor(ctx, sourceW, sourceH, {
            x: Math.round(CENTER_REF_SAMPLE.x * sx),
            y: Math.round(CENTER_REF_SAMPLE.y * sy),
            w: Math.round(CENTER_REF_SAMPLE.w * sx),
            h: Math.round(CENTER_REF_SAMPLE.h * sy)
        });

        // Step 2: Reference luminosity from clean bands ABOVE + BELOW mask.
        // Used by step 7 to correct any systematic over/under-brightness.
        // Above-mask band: 60 source-px tall, ending 10 source-px above mask top.
        // Below-mask band: 60 source-px tall, starting 10 source-px below mask bottom.
        var refLuma = sampleSurroundingLuma(ctx, sourceW, sourceH, mask, sx, sy);

        // Step 3: Read the full mask Y range from the canvas in ONE call. Per-row
        // getImageData would be ~350 separate Canvas API hits at preview size.
        var rowSpan = ctx.getImageData(0, mask.y, sourceW, mask.h);
        var rowData = rowSpan.data;
        var rowW = rowSpan.width;

        var patch = ctx.createImageData(mask.w, mask.h);
        var pData = patch.data;
        var lastCol = Math.max(1, mask.w - 1);

        for (var py = 0; py < mask.h; py++) {
            var rowOffset = py * rowW * 4;

            // Find body left/right edges for this row (first/last opaque pixel)
            var leftX = -1, rightX = -1;
            for (var x = 0; x < rowW; x++) {
                if (rowData[rowOffset + x * 4 + 3] > 200) {
                    if (leftX === -1) leftX = x;
                    rightX = x;
                }
            }
            if (leftX === -1) {
                // No body in this row — leave the patch row fully transparent
                for (var ppx0 = 0; ppx0 < mask.w; ppx0++) {
                    pData[(py * mask.w + ppx0) * 4 + 3] = 0;
                }
                continue;
            }

            // Sample left edge tint: average a slab `edgeSampleW` wide starting
            // `edgeInset` pixels inside the body's leftmost opaque pixel.
            var lSlabStart = leftX + edgeInset;
            var lSlabEnd = lSlabStart + edgeSampleW;
            var lr = 0, lg = 0, lb = 0, lcount = 0;
            for (var lx = lSlabStart; lx < lSlabEnd && lx < rowW; lx++) {
                var li = rowOffset + lx * 4;
                if (rowData[li + 3] > 200) {
                    lr += rowData[li]; lg += rowData[li + 1]; lb += rowData[li + 2];
                    lcount++;
                }
            }
            if (lcount === 0) { lr = lg = lb = 0; lcount = 1; }
            var lColR = lr / lcount, lColG = lg / lcount, lColB = lb / lcount;

            // Sample right edge tint: same slab, just inside body's rightmost edge.
            var rSlabEnd = rightX - edgeInset;
            var rSlabStart = rSlabEnd - edgeSampleW;
            var rr = 0, rg = 0, rb = 0, rcount = 0;
            for (var rx = rSlabStart; rx < rSlabEnd && rx >= 0; rx++) {
                var ri = rowOffset + rx * 4;
                if (rowData[ri + 3] > 200) {
                    rr += rowData[ri]; rg += rowData[ri + 1]; rb += rowData[ri + 2];
                    rcount++;
                }
            }
            if (rcount === 0) { rr = lColR; rg = lColG; rb = lColB; rcount = 1; }
            var rColR = rr / rcount, rColG = rg / rcount, rColB = rb / rcount;

            // Step 5: Triangular 3-point lerp through CENTER_REF.
            //   t < 0.5  →  leftEdge → centerRef  (left half of the patch)
            //   t >= 0.5 →  centerRef → rightEdge (right half of the patch)
            // This reproduces the cylinder's lighting profile: dark/desaturated
            // at edges, bright/saturated in the middle. v3's linear lerp
            // missed the middle peak and produced a uniformly hazy patch.
            // If centerRef sampling failed (off-canvas, etc), fall back to
            // the linear lerp's midpoint (matches v3 behavior for that row).
            var cR = centerRef ? centerRef.r : (lColR + rColR) / 2;
            var cG = centerRef ? centerRef.g : (lColG + rColG) / 2;
            var cB = centerRef ? centerRef.b : (lColB + rColB) / 2;
            for (var ppx = 0; ppx < mask.w; ppx++) {
                var srcX = mask.x + ppx;
                var srcAlpha = (srcX >= 0 && srcX < rowW) ? rowData[rowOffset + srcX * 4 + 3] : 0;
                var pidx = (py * mask.w + ppx) * 4;
                if (srcAlpha < 128) {
                    pData[pidx + 3] = 0;
                    continue;
                }
                var t = ppx / lastCol;
                var rOut, gOut, bOut;
                if (t < 0.5) {
                    var wL = t * 2; // 0..1 across left half
                    rOut = lColR + (cR - lColR) * wL;
                    gOut = lColG + (cG - lColG) * wL;
                    bOut = lColB + (cB - lColB) * wL;
                } else {
                    var wR = (t - 0.5) * 2; // 0..1 across right half
                    rOut = cR + (rColR - cR) * wR;
                    gOut = cG + (rColG - cG) * wR;
                    bOut = cB + (rColB - cB) * wR;
                }
                pData[pidx]     = Math.round(rOut);
                pData[pidx + 1] = Math.round(gOut);
                pData[pidx + 2] = Math.round(bOut);
                pData[pidx + 3] = srcAlpha;
            }
        }

        // Move the synthesized patch onto an off-screen canvas so feathering
        // (destination-out compositing) has a surface to operate on.
        var patchCanvas = document.createElement('canvas');
        patchCanvas.width = mask.w;
        patchCanvas.height = mask.h;
        patchCanvas.getContext('2d').putImageData(patch, 0, 0);

        // Step 6: Powder-coat noise overlay. Deterministic seed from SKU so
        // repeat renders are byte-identical (important: AE preview vs
        // customer-side preview must match if both screenshot the result).
        applyNoiseOverlay(patchCanvas, sku || 'default');

        // Step 7: Luminosity correction — DISABLED for v4 ship.
        // Live verification on 5 SKUs (2026-05-11) showed `sampleSurroundingLuma`'s
        // "above mask" band lands in the shiny steel-lid zone (y=370-430),
        // contaminating the reference luma by 50-100+ units. The correction
        // then pulled patches OFF the (good) CENTER_REF target by 8-22 luma.
        // Triangular lerp through CENTER_REF alone gets patch-center within
        // ±3 luma of target — no correction needed. Helper retained below in
        // case a future SKU with reliable above-mask body zone needs it.
        if (false && refLuma > 0) {
            correctLuminosity(patchCanvas, refLuma);
        }

        // Asymmetric feather. Top/bottom uses cubic easing because the eye
        // picks up linear-gradient banding at wider feather radii. We can't
        // make the feather TOO wide — at >40 source px the feather erodes
        // into the placeholder logo zone and re-exposes JDS's stock logo
        // through the alpha gradient. 40px is the sweet spot: enough fade
        // to hide minor mismatches, narrow enough to keep the placeholder
        // fully covered. Sides are narrowest because per-row sampling
        // matches body color exactly at the row's edges.
        var fScale = Math.min(sx, sy);
        var featherTop = Math.max(20, Math.round(40 * fScale));
        var featherBottom = Math.max(20, Math.round(40 * fScale));
        var featherLR = Math.max(12, Math.round(24 * fScale));

        applyFeatheredCopy(ctx, patchCanvas, mask.x, mask.y, mask.w, mask.h, featherTop, featherBottom, featherLR);
    }

    /**
     * Copy a source canvas onto the destination ctx at (dx,dy,dw,dh), with a
     * feathered alpha at all 4 edges so the patch transitions invisibly into
     * the surrounding tumbler surface.
     *
     * Asymmetric design (v2, 2026-05-11):
     *   - Top/bottom: CUBIC-EASED gradient. Cubic easing prevents the linear-
     *     gradient banding the eye picks up at wider feather radii, which
     *     was a visible artifact at the old 16px linear feather. Wider radius
     *     (40px @ 1800ref) needed because the dual-column lerp can mismatch
     *     by a few luma values at the top/bottom rows.
     *   - Left/right: LINEAR gradient. Narrower (24px @ 1800ref) is enough
     *     because the columns were sampled flush against the mask's left and
     *     right edges, so color continuity there is near-perfect — there's
     *     nothing to hide with cubic easing.
     *
     * @param {number} featherTop    — feather radius for top edge (source px)
     * @param {number} featherBottom — feather radius for bottom edge (source px)
     * @param {number} featherLR     — feather radius for left/right edges
     */
    function applyFeatheredCopy(destCtx, sourceCanvas, dx, dy, dw, dh, featherTop, featherBottom, featherLR) {
        var tmp = document.createElement('canvas');
        tmp.width = dw;
        tmp.height = dh;
        var tctx = tmp.getContext('2d');
        tctx.drawImage(sourceCanvas, 0, 0, dw, dh);

        tctx.globalCompositeOperation = 'destination-out';

        // Cubic-eased gradient stops approximating easeInOutCubic.
        // Position 0 = patch edge (alpha 1, fully erase → reveals tumbler below)
        // Position 1 = patch interior (alpha 0, keep patch intact)
        var cubicStops = [
            [0.0,  1.0],
            [0.12, 0.97],
            [0.28, 0.83],
            [0.5,  0.5],
            [0.72, 0.17],
            [0.88, 0.03],
            [1.0,  0.0]
        ];
        function addCubicStops(grad, reverseAlpha) {
            for (var i = 0; i < cubicStops.length; i++) {
                var pos = cubicStops[i][0];
                // reverseAlpha flips erase-intensity for the bottom feather where
                // gradient runs interior→edge instead of edge→interior.
                var alpha = reverseAlpha ? (1 - cubicStops[i][1]) : cubicStops[i][1];
                grad.addColorStop(pos, 'rgba(0,0,0,' + alpha.toFixed(3) + ')');
            }
        }

        // Top feather (cubic): erase max at top edge, fade to keep at interior
        var topGrad = tctx.createLinearGradient(0, 0, 0, featherTop);
        addCubicStops(topGrad, false);
        tctx.fillStyle = topGrad;
        tctx.fillRect(0, 0, dw, featherTop);

        // Bottom feather (cubic): keep at interior (top of band), erase max at bottom edge
        var botGrad = tctx.createLinearGradient(0, dh - featherBottom, 0, dh);
        addCubicStops(botGrad, true);
        tctx.fillStyle = botGrad;
        tctx.fillRect(0, dh - featherBottom, dw, featherBottom);

        // Left feather (linear)
        var leftGrad = tctx.createLinearGradient(0, 0, featherLR, 0);
        leftGrad.addColorStop(0, 'rgba(0,0,0,1)');
        leftGrad.addColorStop(1, 'rgba(0,0,0,0)');
        tctx.fillStyle = leftGrad;
        tctx.fillRect(0, 0, featherLR, dh);

        // Right feather (linear)
        var rightGrad = tctx.createLinearGradient(dw - featherLR, 0, dw, 0);
        rightGrad.addColorStop(0, 'rgba(0,0,0,0)');
        rightGrad.addColorStop(1, 'rgba(0,0,0,1)');
        tctx.fillStyle = rightGrad;
        tctx.fillRect(dw - featherLR, 0, featherLR, dh);

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
     *   'multi-color'     — 2+ chromatic color buckets OR 3+ non-white buckets
     *                       at coarse quantization. Drop shadows + overlapping
     *                       color regions collapse into a silver blob. Failure
     *                       mode confirmed on Shakey's, Barista Betties, and
     *                       Korum Ford (two-blue outlined letters, 2026-05-11).
     *   'photo'           — 50+ distinct colors at fine quantization. Photo-
     *                       realistic images can't engrave as a binary stencil.
     *   'dark-background' — >50% of opaque pixels are very dark (luma<40). The
     *                       silhouette algorithm assumes light/transparent bg;
     *                       reversed renders the whole bounding box as silver
     *                       with the design appearing as cutouts. Failure mode
     *                       confirmed on Kingfisher Charters (2026-05-11).
     *   'medium-gray-only'— opaque image with no dark pixels but significant
     *                       mid-luma content. Renders faded/translucent.
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
        // Filter to "chromatic" buckets — those where at least one RGB channel
        // bucket differs from another (chroma >= 1 at 4-level quantization).
        // Pure grayscale buckets (black, dark gray, light gray, white) all
        // have chroma=0 because R=G=B; anti-aliasing edges on a clean black
        // logo also fall here. This filter catches outlined-with-similar-hue
        // logos like Korum Ford (dark navy + light blue = 2 chromatic but
        // only 2 non-white buckets total — below the legacy >=3 threshold).
        var chromaticBuckets = significantBuckets.filter(function (k) {
            var parts = k.split('-').map(Number);
            return Math.max.apply(null, parts) - Math.min.apply(null, parts) >= 1;
        });

        // Fires when:
        //   2+ chromatic buckets (Korum's two blues, Shakey's red+yellow+black,
        //     Barista Betties' two teals, Kingfisher's blue+red)
        //   OR 3+ non-white buckets (legacy: catches multi-shade grayscale)
        // Single-color text logos (Thundercats, West Coast, Manke) have 1
        // non-white bucket = pass. KM Resorts (1 olive) has 1 chromatic = pass.
        if (chromaticBuckets.length >= 2 || significantBuckets.length >= 3) {
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

        // ── Check 4: dark-background ────────────────────────────────────
        // Image has a DARK background (>50% of opaque pixels are very dark,
        // luma < 40). The silhouette algorithm assumes the design is dark on
        // a light/transparent background — when reversed, the entire mockup
        // area renders as silver with the actual design appearing as
        // confusing cutouts. Confirmed via Kingfisher Charters sample
        // (2026-05-11): blue script + red ornament on solid black bg.
        var veryDarkCount = samples.filter(function (p) {
            if (p.a < 128) return false;
            var luma = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
            return luma < 40;
        }).length;
        if (opaqueCount / sampleCount > 0.95
            && veryDarkCount / Math.max(opaqueCount, 1) > 0.5) {
            issues.push('dark-background');
        }

        // ── Check 5: medium-gray only ───────────────────────────────────
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
        // Count NEAR-GRAY mid-luma pixels. The chroma filter (max-min < 30) is
        // critical — without it, any logo whose main color happens to land at
        // mid-luma (olive green, dark red, dusty rose, …) trips this check.
        // True grays have R≈G≈B so chroma is ~0. Caught 2026-05-11 via the
        // KM Resorts olive-green logo regressing into this bucket.
        var midCount = samples.filter(function (p) {
            if (p.a < 128) return false;
            var luma = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
            if (luma < 100 || luma > 230) return false;
            var chroma = Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);
            return chroma < 30;
        }).length;
        if (opaqueCount / sampleCount > 0.95
            && darkCount / sampleCount < 0.005
            && midCount / sampleCount > 0.15) {
            issues.push('medium-gray-only');
        }

        return issues;
    }

    // ── v4 helpers (CENTER_REF + noise + luma correction) ──────────────

    /**
     * Average RGB of an axis-aligned rectangle, opaque pixels only.
     * Returns null if the rect has no opaque coverage (e.g. lands outside
     * the tumbler body silhouette) so the caller can fall back gracefully.
     */
    function sampleAverageColor(ctx, sourceW, sourceH, rect) {
        var x = Math.max(0, rect.x);
        var y = Math.max(0, rect.y);
        var w = Math.min(rect.w, sourceW - x);
        var h = Math.min(rect.h, sourceH - y);
        if (w <= 0 || h <= 0) return null;
        var img;
        try {
            img = ctx.getImageData(x, y, w, h);
        } catch (e) {
            return null; // cross-origin block — caller falls back to lerp midpoint
        }
        var data = img.data;
        var r = 0, g = 0, b = 0, n = 0;
        for (var i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 200) {
                r += data[i]; g += data[i + 1]; b += data[i + 2];
                n++;
            }
        }
        if (n === 0) return null;
        return { r: r / n, g: g / n, b: b / n };
    }

    /**
     * Sample the average luminosity of body-pixel-only bands above AND below
     * the mask. Used as the target for luminosity correction so the patch
     * matches the surrounding cylinder body's overall brightness.
     *
     * 60 source-px tall bands give plenty of pixels to average against
     * per-pixel noise in the source image, with 10 source-px clearance from
     * the mask so feathered edges don't contaminate the reference.
     */
    function sampleSurroundingLuma(ctx, sourceW, sourceH, mask, sx, sy) {
        var bandHeightSrc = 60;
        var clearanceSrc = 10;
        var bandHeight = Math.max(8, Math.round(bandHeightSrc * sy));
        var clearance = Math.max(4, Math.round(clearanceSrc * sy));

        var aboveY = mask.y - clearance - bandHeight;
        var belowY = mask.y + mask.h + clearance;
        var aboveLuma = 0, aboveN = 0;
        var belowLuma = 0, belowN = 0;

        if (aboveY >= 0) {
            var aImg;
            try { aImg = ctx.getImageData(0, aboveY, sourceW, bandHeight); }
            catch (e) { aImg = null; }
            if (aImg) {
                var aData = aImg.data;
                for (var i = 0; i < aData.length; i += 4) {
                    if (aData[i + 3] > 200) {
                        aboveLuma += 0.299 * aData[i] + 0.587 * aData[i + 1] + 0.114 * aData[i + 2];
                        aboveN++;
                    }
                }
            }
        }

        if (belowY + bandHeight <= sourceH) {
            var bImg;
            try { bImg = ctx.getImageData(0, belowY, sourceW, bandHeight); }
            catch (e) { bImg = null; }
            if (bImg) {
                var bData = bImg.data;
                for (var j = 0; j < bData.length; j += 4) {
                    if (bData[j + 3] > 200) {
                        belowLuma += 0.299 * bData[j] + 0.587 * bData[j + 1] + 0.114 * bData[j + 2];
                        belowN++;
                    }
                }
            }
        }

        var totalLuma = aboveLuma + belowLuma;
        var totalN = aboveN + belowN;
        return totalN > 0 ? totalLuma / totalN : 0;
    }

    /**
     * Apply Gaussian-noise overlay to opaque patch pixels in place.
     * Same noise value applied to R, G, B per pixel → pure luma jitter, no
     * hue shift. Sigma ≈ 3 in 0-255 range is ~1.2% noise amplitude, which
     * gives visible powder-coat grain without producing visible "snow".
     */
    function applyNoiseOverlay(patchCanvas, seedStr) {
        var ctx = patchCanvas.getContext('2d');
        var w = patchCanvas.width;
        var h = patchCanvas.height;
        if (w === 0 || h === 0) return;
        var img = ctx.getImageData(0, 0, w, h);
        var data = img.data;
        var rng = makeSeededRng(seedStr);
        var sigma = 3;
        for (var i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) {
                var n = gaussian(rng) * sigma;
                data[i]     = clampByte(data[i] + n);
                data[i + 1] = clampByte(data[i + 1] + n);
                data[i + 2] = clampByte(data[i + 2] + n);
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    /**
     * Scale patch RGB so the patch's average luma matches the surrounding
     * body's average luma, clamped to [0.85, 1.15] so a bad reference
     * (rare, e.g. severe shadowing on one SKU) can't blow out the patch.
     */
    function correctLuminosity(patchCanvas, refLuma) {
        var ctx = patchCanvas.getContext('2d');
        var w = patchCanvas.width;
        var h = patchCanvas.height;
        if (w === 0 || h === 0) return;
        var img = ctx.getImageData(0, 0, w, h);
        var data = img.data;

        var sum = 0, n = 0;
        for (var i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 200) {
                sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                n++;
            }
        }
        if (n === 0) return;
        var patchLuma = sum / n;
        if (patchLuma <= 0) return;

        var ratio = refLuma / patchLuma;
        if (ratio < 0.85) ratio = 0.85;
        if (ratio > 1.15) ratio = 1.15;

        for (var j = 0; j < data.length; j += 4) {
            if (data[j + 3] > 200) {
                data[j]     = clampByte(data[j] * ratio);
                data[j + 1] = clampByte(data[j + 1] * ratio);
                data[j + 2] = clampByte(data[j + 2] * ratio);
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    /**
     * xorshift32 seeded from a string hash. Deterministic for a given seed
     * so renders are reproducible per SKU. Returns a function() → uniform
     * float in [0, 1).
     */
    function makeSeededRng(seedStr) {
        var s = 1;
        var str = String(seedStr || 'default');
        for (var i = 0; i < str.length; i++) {
            s = ((s << 5) - s + str.charCodeAt(i)) | 0;
        }
        if (s === 0) s = 1;
        return function () {
            s ^= s << 13;
            s ^= s >>> 17;
            s ^= s << 5;
            return (s >>> 0) / 4294967296;
        };
    }

    /**
     * Box-Muller gaussian sample (mean 0, stddev 1) from a uniform PRNG.
     */
    function gaussian(rng) {
        var u = 0, v = 0;
        while (u === 0) u = rng();
        while (v === 0) v = rng();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }

    function clampByte(v) {
        return v < 0 ? 0 : v > 255 ? 255 : v;
    }

    return {
        MASK: MASK,
        ENGRAVE_PALETTE: ENGRAVE_PALETTE,
        EDGE_INSET: EDGE_INSET,
        EDGE_SAMPLE_W: EDGE_SAMPLE_W,
        CENTER_REF_SAMPLE: CENTER_REF_SAMPLE,
        getEngraveColor: getEngraveColor,
        paintMaskedArea: paintMaskedArea,
        buildEngravedLogo: buildEngravedLogo,
        drawLogoCentered: drawLogoCentered,
        getMaskCoords: getMaskCoords,
        detectLogoIssues: detectLogoIssues
    };
})();
