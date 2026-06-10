/**
 * custom-tees-calibration.js — per-style print-area calibration registry for
 * the Custom T-Shirts designer canvas (window.CTS_CALIBRATION).
 *
 * HYBRID model (Erik, 2026-06-10):
 *   • PC54 keeps its hand-calibrated frames (pixel-scanned 2026-06-09 for the
 *     3-Day Tees program, incl. heather per-color overrides) — ported here
 *     verbatim and marked `calibrated: true`.
 *   • Every OTHER style falls back to a single GENERIC flat-lay model
 *     (`calibrated: false`): a standard print-box rectangle per location,
 *     positioned by SanMar flat-photo heuristics. The on-photo placement is
 *     approximate; the box dimensions in INCHES are exact — pricing and the
 *     production placement notes consume inches, never pixels.
 *
 * Print areas (Custom T-Shirts program):
 *   LC — Left Chest   4×4″   (wearer's left = viewer's RIGHT on a front photo)
 *   FF — Full Front  12×16″
 *   JF — Jumbo Front 16×20″
 *   FB — Full Back   12×16″
 *   JB — Jumbo Back  16×20″
 *
 * Public API (the app codes against this):
 *   CTS_CALIBRATION.forStyle(styleNumber) → {
 *     styleNumber,             // normalized (trimmed, uppercased)
 *     calibrated,              // true ONLY for hand-calibrated styles (PC54)
 *     views,                   // { flatFront, flatBack } (+ front/back aliases)
 *     locations,               // { LC:{wIn,hIn}, FF, JF, FB, JB } — inches, authoritative
 *     colorOverrides,          // catalogColor → partial views (calibrated styles)
 *     area(view, location, catalogColor)            → frac rect | null
 *     areaPx(view, location, catalogColor, nW, nH)  → px rect + pxPerInch | null
 *   }
 *   `view` accepts 'flatFront'/'front' and 'flatBack'/'back'.
 *
 * Inch→pixel contract: areaPx().pxPerInch is ALWAYS derived from the box's
 * pixel width over the location's TRUE inch width. For generic (uncalibrated)
 * styles the box HEIGHT in px is forced to hIn × pxPerInch (square pixels),
 * so the rectangle always renders with its true physical aspect even when the
 * product photo's aspect ratio differs from the model below — only the box's
 * position on the photo is heuristic.
 *
 * ── HOW TO HAND-CALIBRATE A STYLE LATER ─────────────────────────────────
 * Copy the PC54 entry pattern:
 *   1. Pull the style's flat front/back photos (every color) through
 *      /api/image-proxy and pixel-measure on a dark color: torso left/right
 *      edges (→ garment centerline + px-per-inch from the flat chest width),
 *      collar seam y, armpit line y, hem y.
 *   2. Express each location box as xFrac/yFrac/wFrac/hFrac of the NATURAL
 *      image dimensions (wFrac = wIn × measured-wFrac-per-inch, etc.), using
 *      press placement rules: LC centered collar→armpit on the wearer's
 *      left; FF top ~4-5″ below the front collar; FB top ~4″ below the back
 *      collar; JF/JB ~2″ higher than FF/FB.
 *   3. Diff the other colors' framing against the measured color and add
 *      per-color overrides for any drift (see PC54's heather shift).
 *   4. Add `STYLES['XYZ'] = { calibrated: true, views: …, colorOverrides: … }`
 *      below. forStyle() picks it up automatically; the "approximate
 *      preview" hint disappears because calibrated:true.
 *   QA harness precedent: tests/ui/3dt-calibration-harness.html.
 */
(function (global) {
    'use strict';

    // ── Authoritative print-area dimensions (INCHES — production contract) ──
    const LOCATIONS = Object.freeze({
        LC: Object.freeze({ wIn: 4, hIn: 4 }),
        FF: Object.freeze({ wIn: 12, hIn: 16 }),
        JF: Object.freeze({ wIn: 16, hIn: 20 }),
        FB: Object.freeze({ wIn: 12, hIn: 16 }),
        JB: Object.freeze({ wIn: 16, hIn: 20 }),
    });

    // ════════════════════════════════════════════════════════════════════
    // PC54 — HAND-CALIBRATED (ported verbatim from 3-day-tees-calibration.js)
    // ════════════════════════════════════════════════════════════════════
    // CALIBRATED 2026-06-09 by pixel-scanning the PC54 jet-black ghost shots
    // (1200×1800): torso spans x 0.255–0.744 (center 0.50), front collar seam
    // y 0.1417, back collar y 0.126, ARMPIT LINE y 0.385, hem y 0.712. The
    // ghost form wraps the chest (visible width < flat width) so the on-photo
    // scale is foreshortening-adjusted: 1″ ≈ 30.5px (0.0254 wFrac, 0.0169
    // hFrac). Anchors follow press placement rules: LC centered between the
    // collar seam and the armpit line on the wearer's left; FF top ~2″ under
    // the chest line; FB top ~4″ below the back collar (between the blades).
    // JF/JB (NEW for Custom Tees) reuse the same measured per-inch scale,
    // share FF/FB's horizontal center, and start 2″ higher (jumbo prints sit
    // closer to the collar) — wFrac/hFrac scaled proportionally 16/12 × 20/16.
    const PC54_W_PER_IN = 0.305 / 12;   // wFrac per inch ≈ 0.025417
    const PC54_H_PER_IN = 0.271 / 16;   // hFrac per inch ≈ 0.016938
    const PC54_FF_CX = 0.3471 + 0.305 / 2;          // FF horizontal center ≈ 0.4996
    const PC54_JF_W = 16 * PC54_W_PER_IN;           // ≈ 0.40667
    const PC54_J_H = 20 * PC54_H_PER_IN;            // ≈ 0.33875
    const PC54_JF_X = PC54_FF_CX - PC54_JF_W / 2;   // ≈ 0.29627
    const PC54_JF_Y = 0.224 - 2 * PC54_H_PER_IN;    // FF top minus 2″ ≈ 0.19013
    const PC54_JB_Y = 0.194 - 2 * PC54_H_PER_IN;    // FB top minus 2″ ≈ 0.16013

    const PC54_VIEWS = {
        flatFront: {
            areas: {
                LC: { xFrac: 0.559, yFrac: 0.255, wFrac: 0.1017, hFrac: 0.0678, wIn: 4, hIn: 4 },
                // FF top dropped 2″ (Erik 2026-06-09) — clears the collar zone
                FF: { xFrac: 0.3471, yFrac: 0.224, wFrac: 0.305, hFrac: 0.271, wIn: 12, hIn: 16 },
                JF: { xFrac: PC54_JF_X, yFrac: PC54_JF_Y, wFrac: PC54_JF_W, hFrac: PC54_J_H, wIn: 16, hIn: 20 },
            },
        },
        flatBack: {
            areas: {
                // FB top raised 0.194 → 0.165 (≈1.7″ higher, ~0.5″ below the
                // collar) so back designs can sit at the standard upper-back
                // position. Preview is advisory — production places at the
                // standard print location. (Erik 2026-06-10)
                FB: { xFrac: 0.3471, yFrac: 0.165, wFrac: 0.305, hFrac: 0.271, wIn: 12, hIn: 16 },
                JB: { xFrac: PC54_JF_X, yFrac: PC54_JB_Y, wFrac: PC54_JF_W, hFrac: PC54_J_H, wIn: 16, hIn: 20 },
            },
        },
    };

    // Per-color overrides for photo-set drift (catalogColor → partial VIEWS
    // shape). Pixel-measured 2026-06-09: the heather shots sit ~0.9% left of
    // the Jet Black/Navy framing (garment center 0.491 vs 0.500) — enough to
    // skew a left-chest print ~0.35″ without these.
    const HEATHER_SHIFT = -0.009;
    const PC54_HEATHER_VIEWS = {
        flatFront: {
            areas: {
                LC: { xFrac: 0.559 + HEATHER_SHIFT, yFrac: 0.255, wFrac: 0.1017, hFrac: 0.0678, wIn: 4, hIn: 4 },
                FF: { xFrac: 0.3471 + HEATHER_SHIFT, yFrac: 0.224, wFrac: 0.305, hFrac: 0.271, wIn: 12, hIn: 16 },
                JF: { xFrac: PC54_JF_X + HEATHER_SHIFT, yFrac: PC54_JF_Y, wFrac: PC54_JF_W, hFrac: PC54_J_H, wIn: 16, hIn: 20 },
            },
        },
        flatBack: {
            areas: {
                // Heather BACK shots drift half as far as the fronts
                // (torso center 0.4955 vs 0.500 — measured 2026-06-09).
                // yFrac matches the main FB raise (0.165). (Erik 2026-06-10)
                FB: { xFrac: 0.3471 + HEATHER_SHIFT / 2, yFrac: 0.165, wFrac: 0.305, hFrac: 0.271, wIn: 12, hIn: 16 },
                JB: { xFrac: PC54_JF_X + HEATHER_SHIFT / 2, yFrac: PC54_JB_Y, wFrac: PC54_JF_W, hFrac: PC54_J_H, wIn: 16, hIn: 20 },
            },
        },
    };
    const PC54_COLOR_OVERRIDES = {
        'Ath Heather': PC54_HEATHER_VIEWS,
        'Dk Hthr Grey': PC54_HEATHER_VIEWS,
    };

    // ════════════════════════════════════════════════════════════════════
    // GENERIC — every non-calibrated style (calibrated: false)
    // ════════════════════════════════════════════════════════════════════
    // Standard-flat-lay model. SanMar product flats are fairly consistent:
    // garment centered, chest spanning roughly the middle 60% of a
    // square-ish frame. Assumptions (document any deviation to the app):
    //   • garment horizontal center at xFrac 0.50, symmetric framing
    //   • flat chest width ≈ 22″ (adult L tee) spanning xFrac 0.20–0.80
    //       → GEN_W_PER_IN = 0.60 / 22 ≈ 0.0273 wFrac per inch
    //   • front collar seam ≈ yFrac 0.18, back collar ≈ yFrac 0.16
    //   • SQUARE (1:1) image assumed for the vertical anchors below; on
    //     non-square photos the box keeps its true physical aspect (areaPx
    //     forces hPx = hIn × pxPerInch for generic styles) and only the
    //     yFrac anchor drifts — accepted, this is the "approximate" preview.
    // Vertical anchors (press placement rules, in inches below the collar):
    //   LC top 3″ · FF top 3.5″ · JF top 1.5″ · FB top 2″ · JB top 2″.
    //   (FB raised 4″→2″ — Erik 2026-06-10: back designs sit upper-back.)
    const GEN_W_PER_IN = 0.60 / 22;            // ≈ 0.02727 wFrac per inch
    const GEN_H_PER_IN = GEN_W_PER_IN;         // square-image assumption
    const GEN_FRONT_COLLAR_Y = 0.18;
    const GEN_BACK_COLLAR_Y = 0.16;
    const GEN_LC_CX = 0.50 + 4 * GEN_W_PER_IN; // LC center 4″ right of garment center

    /** Build a generic frac rect from a center-x, top-y and a location code. */
    function genRect(cxFrac, topFrac, loc) {
        const dims = LOCATIONS[loc];
        const wFrac = dims.wIn * GEN_W_PER_IN;
        return {
            xFrac: cxFrac - wFrac / 2,
            yFrac: topFrac,
            wFrac: wFrac,
            hFrac: dims.hIn * GEN_H_PER_IN,
            wIn: dims.wIn,
            hIn: dims.hIn,
        };
    }

    const GENERIC_VIEWS = {
        flatFront: {
            areas: {
                LC: genRect(GEN_LC_CX, GEN_FRONT_COLLAR_Y + 3 * GEN_H_PER_IN, 'LC'),
                FF: genRect(0.50, GEN_FRONT_COLLAR_Y + 3.5 * GEN_H_PER_IN, 'FF'),
                JF: genRect(0.50, GEN_FRONT_COLLAR_Y + 1.5 * GEN_H_PER_IN, 'JF'),
            },
        },
        flatBack: {
            areas: {
                FB: genRect(0.50, GEN_BACK_COLLAR_Y + 2 * GEN_H_PER_IN, 'FB'),
                JB: genRect(0.50, GEN_BACK_COLLAR_Y + 2 * GEN_H_PER_IN, 'JB'),
            },
        },
    };

    // ── Style registry — add hand-calibrated entries here (see guide above) ──
    const STYLES = {
        PC54: { calibrated: true, views: PC54_VIEWS, colorOverrides: PC54_COLOR_OVERRIDES },
    };
    const GENERIC_DEF = { calibrated: false, views: GENERIC_VIEWS, colorOverrides: {} };

    // ── Resolution helpers ──────────────────────────────────────────────
    function normalizeView(view) {
        return (view === 'back' || view === 'flatBack') ? 'flatBack' : 'flatFront';
    }

    function makeStyleApi(styleNumber, def) {
        const views = def.views;
        const overrides = def.colorOverrides || {};
        const calibrated = !!def.calibrated;

        /**
         * Resolve the print-area rect for a view + location + color.
         * Returns { xFrac, yFrac, wFrac, hFrac, wIn, hIn } or null when the
         * view doesn't carry that location (e.g. LC on the back photo).
         */
        function area(view, location, catalogColor) {
            const v = normalizeView(view);
            const o = overrides[catalogColor];
            const fromOverride = o && o[v] && o[v].areas && o[v].areas[location];
            const base = views[v] && views[v].areas && views[v].areas[location];
            const rect = fromOverride || base;
            return rect ? Object.assign({}, rect) : null;
        }

        /**
         * Pixel-space rect of a print area on an image of natural w×h.
         * pxPerInch ALWAYS = pixel width / TRUE inch width. Generic styles
         * force hPx = hIn × pxPerInch so the box keeps its physical aspect
         * on any photo aspect ratio (position approximate, inches exact).
         */
        function areaPx(view, location, catalogColor, naturalW, naturalH) {
            const a = area(view, location, catalogColor);
            if (!a) return null;
            const wPx = a.wFrac * naturalW;
            const pxPerInch = wPx / a.wIn;
            return {
                x: a.xFrac * naturalW,
                y: a.yFrac * naturalH,
                w: wPx,
                h: calibrated ? a.hFrac * naturalH : a.hIn * pxPerInch,
                wIn: a.wIn,
                hIn: a.hIn,
                pxPerInch: pxPerInch,
            };
        }

        return {
            styleNumber: styleNumber,
            calibrated: calibrated,
            views: {
                flatFront: views.flatFront,
                flatBack: views.flatBack,
                // Aliases so the app can address views as front/back too.
                front: views.flatFront,
                back: views.flatBack,
            },
            locations: LOCATIONS,
            colorOverrides: overrides,
            area: area,
            areaPx: areaPx,
        };
    }

    const styleApiCache = {};

    // ── Staff-tool overrides (Caspio DTG_Calibration via /api/dtg-calibration)
    // Rows define the 16×20 PRINT ENVELOPE rect per style+view (+optional
    // color). A style with overrides is treated as HAND-CALIBRATED — staff
    // laid the box on the actual photo, which beats the silhouette auto-fit
    // (and beats in-code entries: the tool reflects current intent).
    const remoteOverrides = {};   // STYLE → def {calibrated:true, views, colorOverrides}

    function applyRemoteOverrides(styleNumber, rows) {
        const key = String(styleNumber || '').trim().toUpperCase();
        if (!key || !Array.isArray(rows) || !rows.length) return false;
        const def = { calibrated: true, views: { flatFront: { areas: {} }, flatBack: { areas: {} } }, colorOverrides: {} };
        let applied = 0;
        rows.forEach((r) => {
            const v = r.ViewName === 'flatBack' ? 'flatBack' : (r.ViewName === 'flatFront' ? 'flatFront' : null);
            const x = parseFloat(r.XFrac), y = parseFloat(r.YFrac), w = parseFloat(r.WFrac), h = parseFloat(r.HFrac);
            if (!v || ![x, y, w, h].every(Number.isFinite) || !(w > 0.02)) return;
            const envLoc = v === 'flatBack' ? 'JB' : 'JF';
            const rect = { xFrac: x, yFrac: y, wFrac: w, hFrac: h, wIn: 16, hIn: 20 };
            const color = String(r.CatalogColor || '').trim();
            if (color) {
                def.colorOverrides[color] = def.colorOverrides[color] || { flatFront: { areas: {} }, flatBack: { areas: {} } };
                def.colorOverrides[color][v].areas[envLoc] = rect;
            } else {
                def.views[v].areas[envLoc] = rect;
            }
            applied++;
        });
        if (!applied) return false;
        // Views with no override row fall back to the style's previous geometry
        // (in-code entry or generic) so a front-only layout doesn't break the back.
        const prior = STYLES[key] || GENERIC_DEF;
        ['flatFront', 'flatBack'].forEach((v) => {
            const envLoc = v === 'flatBack' ? 'JB' : 'JF';
            if (!def.views[v].areas[envLoc] && prior.views[v] && prior.views[v].areas) {
                def.views[v].areas = Object.assign({}, prior.views[v].areas, def.views[v].areas);
            }
        });
        remoteOverrides[key] = def;
        delete styleApiCache[key];   // re-resolve with the new layout
        return true;
    }

    /** Per-style calibration entry; unknown styles get the generic model. */
    function forStyle(styleNumber) {
        const key = String(styleNumber || '').trim().toUpperCase() || 'GENERIC';
        if (!styleApiCache[key]) {
            styleApiCache[key] = makeStyleApi(key, remoteOverrides[key] || STYLES[key] || GENERIC_DEF);
        }
        return styleApiCache[key];
    }

    const CTS_CALIBRATION = { LOCATIONS, STYLES, forStyle, applyRemoteOverrides };

    // ── Legacy facade — same surface the 3DT clone exported, PC54-bound ──
    // (kept so any code still addressing TDTCalibration.areaPx() keeps
    // working until the app stream migrates to forStyle()).
    const pc54Api = forStyle('PC54');
    const TDTCalibration = {
        VIEWS: PC54_VIEWS,
        COLOR_OVERRIDES: PC54_COLOR_OVERRIDES,
        area: pc54Api.area,
        areaPx: pc54Api.areaPx,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CTS_CALIBRATION;
        module.exports.TDTCalibration = TDTCalibration;
    }
    global.CTS_CALIBRATION = CTS_CALIBRATION;
    global.TDTCalibration = TDTCalibration;
})(typeof window !== 'undefined' ? window : globalThis);
