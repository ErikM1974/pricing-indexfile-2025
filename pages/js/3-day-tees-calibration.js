/**
 * 3-day-tees-calibration.js — print-area calibration for the 3-Day Tees
 * designer canvas.
 *
 * Maps each garment photo view (SanMar PC54 flat-lay front/back, 1200×1800)
 * to the on-shirt printable rectangles, expressed as FRACTIONS of the image's
 * natural width/height so any resolution of the same framing works. Physical
 * sizes (inches) define the press-side contract; pxPerInch for DPI math is
 * derived as areaPx.width / areaIn.w.
 *
 * Print areas (3-Day Tees program):
 *   LC — Left Chest 4×4″   (wearer's left = viewer's RIGHT on a front photo)
 *   FF — Full Front 12×16″
 *   FB — Full Back 12×16″
 *
 * The fractions below were tuned against the PC54 flat images (all 5 colors
 * share SanMar's framing; per-color overrides exist for drift). QA harness:
 * tests/ui/3dt-calibration-harness.html renders every color × view with the
 * areas overlaid — re-run it whenever SanMar reshoots the style.
 */
(function (global) {
    'use strict';

    // Default rectangles per VIEW, as fractions of natural image dimensions.
    // CALIBRATED 2026-06-09 by pixel-scanning the PC54 jet-black ghost shots
    // (1200×1800): torso spans x 0.255–0.744 (center 0.50), front collar seam
    // y 0.1417, back collar y 0.126, ARMPIT LINE y 0.385, hem y 0.712. The
    // ghost form wraps the chest (visible width < flat width) so the on-photo
    // scale is foreshortening-adjusted: 1″ ≈ 30.5px (0.0254 wFrac, 0.0169
    // hFrac). Anchors follow press placement rules: LC centered between the
    // collar seam and the armpit line on the wearer's left; FF top ~2″ under
    // the chest line; FB top ~4″ below the back collar (between the blades).
    // The placement JSON (inches) is the production contract — these rects
    // only govern how honest the on-photo preview looks.
    const VIEWS = {
        flatFront: {
            areas: {
                LC: { xFrac: 0.559, yFrac: 0.255, wFrac: 0.1017, hFrac: 0.0678, wIn: 4, hIn: 4 },
                FF: { xFrac: 0.3471, yFrac: 0.19, wFrac: 0.305, hFrac: 0.271, wIn: 12, hIn: 16 },
            },
        },
        flatBack: {
            areas: {
                FB: { xFrac: 0.3471, yFrac: 0.194, wFrac: 0.305, hFrac: 0.271, wIn: 12, hIn: 16 },
            },
        },
    };

    // Per-color overrides for photo-set drift (catalogColor → partial VIEWS
    // shape). Empty today — SanMar's 2021 PC54 flat set shares one framing.
    const COLOR_OVERRIDES = {};

    /**
     * Resolve the print-area rect for a view + location + color.
     * Returns { xFrac, yFrac, wFrac, hFrac, wIn, hIn } or null when the view
     * doesn't carry that location (e.g. LC on the back photo).
     */
    function area(view, location, catalogColor) {
        const o = COLOR_OVERRIDES[catalogColor];
        const fromOverride = o && o[view] && o[view].areas && o[view].areas[location];
        const base = VIEWS[view] && VIEWS[view].areas && VIEWS[view].areas[location];
        const rect = fromOverride || base;
        return rect ? Object.assign({}, rect) : null;
    }

    /** Pixel-space rect of a print area on an image of natural w×h. */
    function areaPx(view, location, catalogColor, naturalW, naturalH) {
        const a = area(view, location, catalogColor);
        if (!a) return null;
        return {
            x: a.xFrac * naturalW,
            y: a.yFrac * naturalH,
            w: a.wFrac * naturalW,
            h: a.hFrac * naturalH,
            wIn: a.wIn,
            hIn: a.hIn,
            pxPerInch: (a.wFrac * naturalW) / a.wIn,
        };
    }

    const TDTCalibration = { VIEWS, COLOR_OVERRIDES, area, areaPx };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TDTCalibration;
    }
    global.TDTCalibration = TDTCalibration;
})(typeof window !== 'undefined' ? window : globalThis);
