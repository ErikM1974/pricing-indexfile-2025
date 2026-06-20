/* ============================================================
   garment-text-engine.js
   Pure, dependency-free math for the Easy Shirt Designer text tool
   and contrast warning. NO DOM, NO canvas — so it loads in the
   browser (window.GarmentTextEngine) AND in Jest (require()).
   The drawing (getContext/fillText) stays in garment-designer.js;
   this module owns only the layout geometry + string/colour logic,
   which is the part worth unit-testing.
   ============================================================ */
(function (root) {
  'use strict';

  // Apply a letter-case transform. Mirrors the text-tool "case" control.
  function txtCase(text, mode) {
    var t = String(text == null ? '' : text);
    if (mode === 'upper') return t.toUpperCase();
    if (mode === 'lower') return t.toLowerCase();
    if (mode === 'title') return t.replace(/\w\S*/g, function (w) { return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); });
    return t;
  }

  // Canonical text model (the editable state of one text layer).
  function defaultTextModel() {
    return {
      text: 'YOUR TEXT', font: 'Anton', weight: 700, italic: false,
      fill: '#1c2841', strokeOn: false, stroke: '#ffffff', strokeW: 8,
      tracking: 0, lineHeight: 1.1, align: 'center', arc: 0, rotation: 0, caseMode: 'none'
    };
  }

  // Bounding box of a w×h canvas rotated by `deg` degrees (axis-aligned).
  function rotatedBounds(w, h, deg) {
    var rad = deg * Math.PI / 180;
    var sin = Math.abs(Math.sin(rad)), cos = Math.abs(Math.cos(rad));
    return { W: Math.ceil(w * cos + h * sin), H: Math.ceil(w * sin + h * cos) };
  }

  // Lay out characters along a circular arc.
  //   charWidths : per-character advance widths (already include tracking), in px
  //   bend       : -1..1 (the text-tool "curve" / 100). >0 arcs up, <0 arcs down.
  //   px         : render font size in px (cap/glyph height basis)
  //   strokeW    : outline width in px (for padding)
  // Returns the canvas size (W/H), circle center (cx/cy) and a per-char list of
  // {theta, x, y, rot} the draw loop translates/rotates to. Pure trig — no canvas.
  function arcLayout(charWidths, bend, px, strokeW) {
    var widths = charWidths || [];
    var total = Math.max(1, widths.reduce(function (a, b) { return a + b; }, 0));
    var span = Math.abs(bend) * Math.PI;
    var up = bend > 0;
    var R = total / span;
    var chordW = 2 * R * Math.sin(span / 2);
    var sagitta = R * (1 - Math.cos(span / 2));
    var glyphH = px * 1.5;
    var pad = (strokeW || 0) * 1.6 + px * 0.3;
    var W = Math.ceil(chordW + glyphH + 2 * pad);
    var H = Math.ceil(sagitta + glyphH + 2 * pad);
    var cx = W / 2;
    var cy = up ? (pad + glyphH / 2 + R) : (H - pad - glyphH / 2 - R);
    var perChar = [];
    var acc = 0;
    for (var i = 0; i < widths.length; i++) {
      var wq = widths[i];
      var frac = (acc + wq / 2) / total;
      var theta = -span / 2 + frac * span;
      perChar.push({
        theta: theta,
        x: cx + R * Math.sin(theta),
        y: up ? (cy - R * Math.cos(theta)) : (cy + R * Math.cos(theta)),
        rot: up ? theta : -theta
      });
      acc += wq;
    }
    return { total: total, span: span, up: up, R: R, chordW: chordW, sagitta: sagitta, glyphH: glyphH, pad: pad, W: W, H: H, cx: cx, cy: cy, perChar: perChar };
  }

  // Rec.709 luminance (0..255) of a #rrggbb hex; null on bad input.
  function hexLuminance(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    var n = parseInt(m[1], 16);
    return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  }

  // Pick the art/garment low-contrast warning string (or '' when contrast is fine).
  //   al = art mean luminance, gl = garment luminance (both 0..255 or null).
  function pickContrastWarning(al, gl) {
    if (al == null || gl == null) return '';
    if (Math.abs(al - gl) >= 60) return '';
    if (al > 150 && gl > 150) return '⚠ Light art on a light shirt may be hard to see — preview only';
    if (al < 105 && gl < 105) return '⚠ Dark art on a dark shirt may be hard to see — preview only';
    return '⚠ Low art/shirt contrast — the print may be hard to see';
  }

  var api = { txtCase: txtCase, defaultTextModel: defaultTextModel, rotatedBounds: rotatedBounds, arcLayout: arcLayout, hexLuminance: hexLuminance, pickContrastWarning: pickContrastWarning };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.GarmentTextEngine = api;
})(typeof window !== 'undefined' ? window : this);
