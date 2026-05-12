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
     * Body-center reference sample — used by v4's triangular lerp. v5
     * doesn't use it directly (inpainting handles centering automatically),
     * but it's kept exposed for tests and any future tuning.
     *
     * Defines a clean horizontal slab below the mask (between the mask
     * bottom at y=1140 and the rib decoration start at ~y=1240) at the
     * body's horizontal center (~x=895). Verified clean on all 16
     * mockup-eligible SKUs.
     */
    var CENTER_REF_SAMPLE = {
        x: 815,
        y: 1222,
        w: 160,
        h: 16
    };

    /**
     * v5 vertical-band inpainting reference zones.
     *
     * ABOVE_REF_BAND: y=420-435 (16 source-px tall). Sits just below the
     * steel lid base (~y=400) and just above the mask top (y=440). At
     * y<420 the lid reflection contaminates the middle 30-70% of body
     * width; at y>=440 we're inside the mask (no clean body).
     *
     * BELOW_REF_BAND: y=1195-1234 (40 source-px tall). v5.3 fix — was
     * originally y=1145-1214 (70 rows) but LTM767 Miss Kiki's TIKI palm
     * trunks extend down to y=1184 on the trunks at x=820, x=925.
     * That made palm pixels MAJORITY at those columns, defeating the
     * v5.2 median-based outlier filter (median itself fell in palm-color
     * range). Per-Y luma scan on LTM767 confirms transition to clean body
     * at y=1185+; we start the band 10 source-px past that buffer at
     * y=1195. Band ends at y=1234, ~6 rows before the rib decoration
     * pattern intensifies (~y=1240+).
     *
     * Both bands verified clean across all 16 mockup-eligible SKUs.
     */
    var ABOVE_REF_BAND = { y: 420, h: 16 };
    var BELOW_REF_BAND = { y: 1195, h: 40 };

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
     * Algorithm (v5, 2026-05-12 — vertical-band inpainting from clean source body):
     *
     * Instead of synthesizing patch colors from edge samples (v3) or per-row
     * edge + center-reference (v4), v5 lerps SOURCE PIXELS from two clean
     * body bands: one ABOVE the mask (between the steel lid and the
     * placeholder logo zone) and one BELOW (between the placeholder bottom
     * and the rib decoration).
     *
     * Steps:
     *   1. Read two clean body bands as ImageData:
     *      - ABOVE: y=420-435 (16 source-px) just below the steel lid
     *      - BELOW: y=1145-1215 (70 source-px) between placeholder + ribs
     *   2. Detect body left/right bounds in each band's middle row.
     *   3. Read the full mask Y range in one getImageData call.
     *   4. For each pixel (X, Y) in the mask:
     *      a. Find this row's body bounds (handles cylinder taper)
     *      b. Compute the pixel's body-relative X position (0..1)
     *      c. Map to absolute X in each reference band using its body bounds
     *      d. Pick a source row in each band by cycling (py % bandHeight) —
     *         spreads grain pattern across patch rows, prevents visible
     *         repetition from using a single source row
     *      e. Lerp the two source pixels by vertical position (ty = py/mask.h)
     *      f. Copy the original row's alpha (preserves cylinder silhouette)
     *   5. Apply asymmetric feather (40px cubic top/bottom, 24px linear sides)
     *      and composite onto the main canvas.
     *
     * Why this beats v4: v4's per-row + CENTER_REF triangular lerp produced
     * good center matching (±1 luma) but couldn't reproduce the cylinder's
     * NATURAL grain texture or the asymmetric brightness profile the body
     * actually has (peaks at ~35% and ~65% across body width on these JDS
     * images, dim center). v5 copies real body pixels, so by construction:
     *   - Color matches the body exactly at the same body-relative X
     *   - Grain pattern matches (we ARE using real grain pixels)
     *   - Per-row lighting profile matches (each source row carries its own)
     *   - Vertical color shift through the mask is smooth (Y lerp)
     * No procedural noise is needed; no luminosity correction is needed.
     *
     * @param {CanvasRenderingContext2D} ctx — canvas with tumbler already drawn
     * @param {number} sourceW — source image width (scales the reference coords)
     * @param {number} sourceH — source image height
     * @param {string} [sku]   — SKU code (unused in v5; was noise seed in v4)
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

        // Step 1: Read the two clean reference bands.
        // ABOVE: y=420-435 — verified clean across all 16 SKUs (above this
        //   y the steel-lid reflection contaminates the middle 30-70% of
        //   body width; below y=440 we're inside the mask).
        // BELOW: y=1145-1215 — verified clean (between placeholder bottom at
        //   y~1100 and rib decoration start at ~y=1240).
        var aboveY = Math.round(ABOVE_REF_BAND.y * sy);
        var aboveH = Math.max(4, Math.round(ABOVE_REF_BAND.h * sy));
        var belowY = Math.round(BELOW_REF_BAND.y * sy);
        var belowH = Math.max(8, Math.round(BELOW_REF_BAND.h * sy));

        var aboveImg, belowImg;
        try {
            aboveImg = ctx.getImageData(0, aboveY, sourceW, aboveH);
            belowImg = ctx.getImageData(0, belowY, sourceW, belowH);
        } catch (e) {
            // Cross-origin block — bail (page will surface a Canvas error)
            return;
        }

        // Step 2: Detect body bounds in each band's middle row.
        var aboveBounds = findRowBodyBounds(aboveImg.data, Math.floor(aboveH / 2), sourceW);
        var belowBounds = findRowBodyBounds(belowImg.data, Math.floor(belowH / 2), sourceW);
        if (!aboveBounds || !belowBounds) {
            return;
        }
        var aboveBodyW = aboveBounds.right - aboveBounds.left;
        var belowBodyW = belowBounds.right - belowBounds.left;

        // CRITICAL: Average all rows of each band into a SINGLE per-X smooth
        // row. Using individual source rows + py-cycling produced visible
        // 2-pixel banding because adjacent band rows can have wildly different
        // luma at the same X (e.g., lid-reflection bleed makes one row bright,
        // the next dim). Averaging smooths color while preserving the per-X
        // cylinder lighting profile. Procedural noise restores grain after.
        // Verified 2026-05-12: cycling produced 70+ luma swings every 2 patch
        // rows on LTM763 around the 65% body-relative X position.
        var aboveAvg = averageBandRows(aboveImg.data, aboveH, sourceW);
        var belowAvg = averageBandRows(belowImg.data, belowH, sourceW);

        // Step 3: Read the mask Y range in one call.
        var rowSpan = ctx.getImageData(0, mask.y, sourceW, mask.h);
        var rowData = rowSpan.data;
        var rowW = rowSpan.width;

        var patch = ctx.createImageData(mask.w, mask.h);
        var pData = patch.data;

        // Step 4: Per-pixel inpaint.
        for (var py = 0; py < mask.h; py++) {
            var rowOffset = py * rowW * 4;

            // This mask row's body bounds (handles cylinder taper)
            var leftX = -1, rightX = -1;
            for (var x = 0; x < rowW; x++) {
                if (rowData[rowOffset + x * 4 + 3] > 200) {
                    if (leftX === -1) leftX = x;
                    rightX = x;
                }
            }
            if (leftX === -1) {
                // No body — clear row to transparent
                for (var ppx0 = 0; ppx0 < mask.w; ppx0++) {
                    pData[(py * mask.w + ppx0) * 4 + 3] = 0;
                }
                continue;
            }
            var bodyW = rightX - leftX;
            if (bodyW <= 0) continue;

            // Vertical lerp position within mask (0 at top, 1 at bottom)
            var ty = mask.h > 1 ? py / (mask.h - 1) : 0;

            for (var ppx = 0; ppx < mask.w; ppx++) {
                var srcX = mask.x + ppx;
                var srcAlpha = (srcX >= 0 && srcX < rowW) ? rowData[rowOffset + srcX * 4 + 3] : 0;
                var pidx = (py * mask.w + ppx) * 4;
                if (srcAlpha < 128) {
                    pData[pidx + 3] = 0;
                    continue;
                }

                // Body-relative X position (0 at body's left, 1 at body's right)
                var bodyRelX = (srcX - leftX) / bodyW;
                if (bodyRelX < 0) bodyRelX = 0;
                else if (bodyRelX > 1) bodyRelX = 1;

                // Map to absolute X in each reference band's averaged row.
                var aboveX = aboveBounds.left + Math.round(bodyRelX * aboveBodyW);
                var belowX = belowBounds.left + Math.round(bodyRelX * belowBodyW);
                if (aboveX < 0) aboveX = 0;
                else if (aboveX >= sourceW) aboveX = sourceW - 1;
                if (belowX < 0) belowX = 0;
                else if (belowX >= sourceW) belowX = sourceW - 1;

                // Read averaged-band pixels (single smooth row per band)
                var aboveIdx = aboveX * 4;
                var belowIdx = belowX * 4;

                var ar = aboveAvg[aboveIdx];
                var ag = aboveAvg[aboveIdx + 1];
                var ab = aboveAvg[aboveIdx + 2];
                var aa = aboveAvg[aboveIdx + 3];

                var brc = belowAvg[belowIdx];
                var bgc = belowAvg[belowIdx + 1];
                var bbc = belowAvg[belowIdx + 2];
                var bac = belowAvg[belowIdx + 3];

                // If a reference pixel landed on a transparent area, fall
                // back to the other band's pixel.
                if (aa < 128 && bac >= 128) { ar = brc; ag = bgc; ab = bbc; }
                else if (bac < 128 && aa >= 128) { brc = ar; bgc = ag; bbc = ab; }

                // Lerp vertically by Y position within mask
                pData[pidx]     = Math.round(ar + (brc - ar) * ty);
                pData[pidx + 1] = Math.round(ag + (bgc - ag) * ty);
                pData[pidx + 2] = Math.round(ab + (bbc - ab) * ty);
                pData[pidx + 3] = srcAlpha;
            }
        }

        // Move the synthesized patch onto an off-screen canvas so feathering
        // (destination-out compositing) has a surface to operate on.
        var patchCanvas = document.createElement('canvas');
        patchCanvas.width = mask.w;
        patchCanvas.height = mask.h;
        patchCanvas.getContext('2d').putImageData(patch, 0, 0);

        // v5.1: Band-averaging removed the natural grain that single-row
        // sampling preserved. Re-add subtle Gaussian noise (σ=2 luma, ~0.8%
        // amplitude) so the patch surface doesn't look unnaturally smooth.
        // Deterministic seed from SKU keeps repeat renders byte-identical.
        applyNoiseOverlay(patchCanvas, sku || 'default');

        // Asymmetric feather. Top/bottom uses cubic easing because the eye
        // picks up linear-gradient banding at wider feather radii. Sides
        // are narrower because per-row sampling matches body color exactly
        // at the row's edges.
        var fScale = Math.min(sx, sy);
        var featherTop = Math.max(20, Math.round(40 * fScale));
        var featherBottom = Math.max(20, Math.round(40 * fScale));
        var featherLR = Math.max(12, Math.round(24 * fScale));

        applyFeatheredCopy(ctx, patchCanvas, mask.x, mask.y, mask.w, mask.h, featherTop, featherBottom, featherLR);
    }

    /**
     * Find the leftmost and rightmost opaque pixel in row `rowIdx` of an
     * RGBA ImageData byte array. Returns null if the row has no opaque
     * pixels.
     */
    function findRowBodyBounds(data, rowIdx, width) {
        var offset = rowIdx * width * 4;
        var L = -1, R = -1;
        for (var x = 0; x < width; x++) {
            if (data[offset + x * 4 + 3] > 200) {
                if (L === -1) L = x;
                R = x;
            }
        }
        return L === -1 ? null : { left: L, right: R };
    }

    /**
     * Collapse all opaque rows of a band into a single per-X smooth row,
     * using OUTLIER-only rejection to drop placeholder-logo bleed-through
     * without destroying legitimate cylinder highlights.
     *
     * Per-X algorithm:
     *   1. Collect opaque (R, G, B, luma) tuples across all band rows
     *   2. Compute median luma for the column
     *   3. Drop pixels with luma > median + 30 (placeholder silver typically
     *      sits 50-100 luma above body color; cylinder natural highlights
     *      stay within ~15 luma of median)
     *   4. Mean-average whatever's kept
     *
     * Initial trimmed-mean approach (drop fixed top 35%) was too aggressive
     * for uncontaminated SKUs — it dropped the body's own cylinder peaks
     * along with any placeholder pixels, pulling patch luma down by 10-15
     * units. Outlier-only rejection preserves the data when there's nothing
     * to remove, and only kicks in when there's a real placeholder bleed.
     *
     * Verified 2026-05-12 on LTM767: palm trees at x=811-826 and x=919-933
     * in the below-band (y=1145-1214) produced visible streaks; the median+30
     * filter drops them while leaving clean SKUs untouched.
     *
     * @returns {Uint8ClampedArray} length = width * 4
     */
    function averageBandRows(data, rowCount, width) {
        var out = new Uint8ClampedArray(width * 4);
        // Reusable scratch buffers — avoid per-X allocation
        var rs = new Uint8Array(rowCount);
        var gs = new Uint8Array(rowCount);
        var bs = new Uint8Array(rowCount);
        var ls = new Float32Array(rowCount);
        var sortBuf = new Float32Array(rowCount);

        for (var x = 0; x < width; x++) {
            // Collect opaque pixel values at this X across all band rows
            var n = 0;
            for (var ry = 0; ry < rowCount; ry++) {
                var idx = (ry * width + x) * 4;
                if (data[idx + 3] > 200) {
                    rs[n] = data[idx];
                    gs[n] = data[idx + 1];
                    bs[n] = data[idx + 2];
                    ls[n] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                    n++;
                }
            }
            if (n === 0) { out[x * 4 + 3] = 0; continue; }

            // Median luma — copy then insertion-sort for small n
            for (var c = 0; c < n; c++) sortBuf[c] = ls[c];
            for (var i = 1; i < n; i++) {
                var key = sortBuf[i];
                var j = i - 1;
                while (j >= 0 && sortBuf[j] > key) {
                    sortBuf[j + 1] = sortBuf[j];
                    j--;
                }
                sortBuf[j + 1] = key;
            }
            var medianL = sortBuf[Math.floor(n / 2)];

            // Outlier threshold: median + 30 luma
            var threshold = medianL + 30;

            var rSum = 0, gSum = 0, bSum = 0, kept = 0;
            for (var k = 0; k < n; k++) {
                if (ls[k] <= threshold) {
                    rSum += rs[k];
                    gSum += gs[k];
                    bSum += bs[k];
                    kept++;
                }
            }
            if (kept === 0) {
                // Should never happen since median is always <= threshold,
                // but be defensive — fall back to a simple mean.
                for (var f = 0; f < n; f++) { rSum += rs[f]; gSum += gs[f]; bSum += bs[f]; }
                kept = n;
            }
            out[x * 4]     = Math.round(rSum / kept);
            out[x * 4 + 1] = Math.round(gSum / kept);
            out[x * 4 + 2] = Math.round(bSum / kept);
            out[x * 4 + 3] = 255;
        }
        return out;
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
        var sigma = 2; // v5.1 — 0.8% luma jitter (less than v4's 3 since color is now more accurate)
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
        ABOVE_REF_BAND: ABOVE_REF_BAND,
        BELOW_REF_BAND: BELOW_REF_BAND,
        getEngraveColor: getEngraveColor,
        paintMaskedArea: paintMaskedArea,
        buildEngravedLogo: buildEngravedLogo,
        drawLogoCentered: drawLogoCentered,
        getMaskCoords: getMaskCoords,
        detectLogoIssues: detectLogoIssues
    };
})();
