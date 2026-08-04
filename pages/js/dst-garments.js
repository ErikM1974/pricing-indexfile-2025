/**
 * dst-garments.js — vector garment templates for the Embroidery Studio mockup stage.
 *
 * Each garment is an SVG built at runtime in any fabric color, plus REAL-WORLD
 * scale metadata (mmPerUnit) and placement anchors with industry max sizes, so
 * a 89 mm left-chest logo lands on the tee at a true 89 mm — the mockup is a
 * measurement, not an illustration.
 *
 * SVGs are loaded via data: URLs (same-origin clean), so the canvas stays
 * exportable. No external images, no CORS taint, works fully offline.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) { module.exports = factory(); }
    else { root.DSTGarments = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    /* ─── color helpers ─────────────────────────────────────────────── */

    function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }

    function shade(hex, pct) {
        var m = /^#?([0-9a-f]{6})$/i.exec(hex);
        if (!m) return hex;
        var v = parseInt(m[1], 16);
        var r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
        if (pct >= 0) {
            r += (255 - r) * pct / 100; g += (255 - g) * pct / 100; b += (255 - b) * pct / 100;
        } else {
            r *= 1 + pct / 100; g *= 1 + pct / 100; b *= 1 + pct / 100;
        }
        return '#' + ((clamp255(r) << 16) | (clamp255(g) << 8) | clamp255(b)).toString(16).padStart(6, '0');
    }

    function luma(hex) {
        var m = /^#?([0-9a-f]{6})$/i.exec(hex);
        if (!m) return 0;
        var v = parseInt(m[1], 16);
        return 0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255);
    }

    /* ─── standard blank-garment colors ─────────────────────────────── */

    var FABRIC_COLORS = [
        { name: 'White', hex: '#F4F4F2' },
        { name: 'Ash', hex: '#D5D6D2' },
        { name: 'Sport Grey', hex: '#9EA1A0' },
        { name: 'Charcoal', hex: '#4A4E54' },
        { name: 'Jet Black', hex: '#23252B' },
        { name: 'Navy', hex: '#1F2A44' },
        { name: 'Royal', hex: '#2456A4' },
        { name: 'Carolina', hex: '#7BA4DB' },
        { name: 'Red', hex: '#B32638' },
        { name: 'Cardinal', hex: '#77202D' },
        { name: 'Forest', hex: '#20402F' },
        { name: 'Kelly', hex: '#2E8B57' },
        { name: 'Purple', hex: '#4B2E63' },
        { name: 'Sand', hex: '#D6C6A5' },
        { name: 'Brown', hex: '#4E3B2B' },
        { name: 'Orange', hex: '#D2622A' }
    ];

    /* ─── SVG builders ──────────────────────────────────────────────── */

    function svgOpen(w, h, c, defsExtra) {
        // Per-instance ids are unnecessary: each build is its own SVG document.
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '">' +
            '<defs>' +
            '<linearGradient id="bodyShade" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#ffffff" stop-opacity="0.10"/>' +
            '<stop offset="0.35" stop-color="#ffffff" stop-opacity="0.02"/>' +
            '<stop offset="1" stop-color="#000000" stop-opacity="0.13"/>' +
            '</linearGradient>' +
            '<linearGradient id="sideL" x1="0" y1="0" x2="1" y2="0">' +
            '<stop offset="0" stop-color="#000000" stop-opacity="0.16"/>' +
            '<stop offset="1" stop-color="#000000" stop-opacity="0"/>' +
            '</linearGradient>' +
            '<linearGradient id="sideR" x1="1" y1="0" x2="0" y2="0">' +
            '<stop offset="0" stop-color="#000000" stop-opacity="0.16"/>' +
            '<stop offset="1" stop-color="#000000" stop-opacity="0"/>' +
            '</linearGradient>' +
            (defsExtra || '') +
            '</defs>';
    }

    function seam(d, opacity, w) {
        return '<path d="' + d + '" fill="none" stroke="#000000" stroke-opacity="' +
            (opacity || 0.16) + '" stroke-width="' + (w || 1.6) + '" stroke-linecap="round"/>';
    }

    function stitchLine(d, dark) {
        return '<path d="' + d + '" fill="none" stroke="' + (dark ? '#000000' : '#ffffff') +
            '" stroke-opacity="0.22" stroke-width="1.1" stroke-dasharray="4 3.2" stroke-linecap="round"/>';
    }

    /* T-SHIRT — body chest width 164u ≙ 558.8 mm (22 in, adult L) */
    function teeSVG(c) {
        var rib = shade(c, -14), dark = shade(c, -26);
        var body = 'M162,64 C176,58 224,58 238,64 L292,84 L346,150 L330,196 L282,178' +
            ' C281,168 280,160 278,156 L282,250 L280,398 C240,408 160,408 120,398 L118,250 L122,156' +
            ' C120,160 119,168 118,178 L70,196 L54,150 L108,84 Z';
        var s = svgOpen(400, 470, c);
        s += '<path d="' + body + '" fill="' + c + '"/>';
        s += '<path d="' + body + '" fill="url(#bodyShade)"/>';
        s += '<path d="M118,178 L122,156 L118,250 L120,398 C132,401 146,403 162,405 L156,240 Z" fill="url(#sideL)"/>';
        s += '<path d="M282,178 L278,156 L282,250 L280,398 C268,401 254,403 238,405 L244,240 Z" fill="url(#sideR)"/>';
        // sleeve seams + hems
        s += seam('M118,178 C120,150 124,120 108,84');
        s += seam('M282,178 C280,150 276,120 292,84');
        s += stitchLine('M70,196 L118,178', true);
        s += stitchLine('M330,196 L282,178', true);
        s += stitchLine('M121,388 C170,397 230,397 279,388', true);
        // crew ribbing
        s += '<path d="M162,64 C176,58 224,58 238,64 C232,92 216,104 200,104 C184,104 168,92 162,64 Z" fill="' + rib + '"/>';
        s += '<path d="M168,68 C180,64 220,64 232,68 C227,88 214,97 200,97 C186,97 173,88 168,68 Z" fill="' + dark + '" fill-opacity="0.55"/>';
        s += seam('M162,64 C168,92 184,104 200,104 C216,104 232,92 238,64', 0.2, 1.4);
        // shoulder seams
        s += seam('M162,64 L110,85'); s += seam('M238,64 L290,85');
        // soft wrinkles
        s += seam('M140,330 C160,340 180,342 196,338', 0.05, 2.4);
        s += seam('M262,300 C250,310 236,314 224,312', 0.05, 2.4);
        return s + '</svg>';
    }

    /* POLO — same scale as tee */
    function poloSVG(c) {
        var rib = shade(c, -12), dark = shade(c, -30), placket = shade(c, -7);
        var body = 'M164,66 C178,60 222,60 236,66 L292,86 L346,152 L330,198 L282,180' +
            ' C281,170 280,162 278,158 L282,252 L280,400 C240,410 160,410 120,400 L118,252 L122,158' +
            ' C120,162 119,170 118,180 L70,198 L54,152 L108,86 Z';
        var s = svgOpen(400, 470, c);
        s += '<path d="' + body + '" fill="' + c + '"/>';
        s += '<path d="' + body + '" fill="url(#bodyShade)"/>';
        s += '<path d="M118,180 L122,158 L118,252 L120,400 C132,403 146,405 162,407 L156,242 Z" fill="url(#sideL)"/>';
        s += '<path d="M282,180 L278,158 L282,252 L280,400 C268,403 254,405 238,407 L244,242 Z" fill="url(#sideR)"/>';
        s += seam('M118,180 C120,152 124,122 108,86');
        s += seam('M282,180 C280,152 276,122 292,86');
        s += stitchLine('M70,198 L118,180', true);
        s += stitchLine('M330,198 L282,180', true);
        s += stitchLine('M121,390 C170,399 230,399 279,390', true);
        // placket + buttons
        s += '<rect x="191" y="92" width="18" height="66" rx="3" fill="' + placket + '"/>';
        s += stitchLine('M193,94 L193,156', true) + stitchLine('M207,94 L207,156', true);
        s += '<circle cx="200" cy="112" r="3.4" fill="' + dark + '"/><circle cx="200" cy="138" r="3.4" fill="' + dark + '"/>';
        // collar
        s += '<path d="M164,66 C178,54 222,54 236,66 L236,74 C222,64 178,64 164,74 Z" fill="' + rib + '"/>';
        s += '<path d="M164,66 L191,92 L178,112 L156,84 Z" fill="' + rib + '"/>';
        s += '<path d="M236,66 L209,92 L222,112 L244,84 Z" fill="' + rib + '"/>';
        s += seam('M164,66 L191,92 M236,66 L209,92', 0.2, 1.4);
        s += '<path d="M164,66 L178,112 L156,84 Z" fill="#000000" fill-opacity="0.06"/>';
        s += seam('M156,84 L178,112 M244,84 L222,112', 0.14, 1.4);
        // shoulders
        s += seam('M164,66 L110,87'); s += seam('M236,66 L290,87');
        return s + '</svg>';
    }

    /* HOODIE — body chest width 170u ≙ 609.6 mm (24 in) */
    function hoodieSVG(c) {
        var dk = shade(c, -16), inner = shade(c, -48), band = shade(c, -12);
        var s = svgOpen(400, 480, c);
        // hood (behind body)
        s += '<path d="M148,88 C138,40 262,40 252,88 C262,74 268,64 262,50 C244,22 156,22 138,50 C132,64 138,74 148,88 Z" fill="' + dk + '"/>';
        s += '<path d="M148,88 C158,50 242,50 252,88 C236,72 164,72 148,88 Z" fill="' + inner + '"/>';
        var body = 'M150,86 C168,76 232,76 250,86 L300,104 L352,172 L336,218 L288,198' +
            ' C287,188 286,180 284,176 L288,262 L286,406 C244,416 156,416 114,406 L112,262 L116,176' +
            ' C114,180 113,188 112,198 L64,218 L48,172 L100,104 Z';
        s += '<path d="' + body + '" fill="' + c + '"/>';
        s += '<path d="' + body + '" fill="url(#bodyShade)"/>';
        s += '<path d="M112,198 L116,176 L112,262 L114,406 C126,409 140,411 156,413 L150,252 Z" fill="url(#sideL)"/>';
        s += '<path d="M288,198 L284,176 L288,262 L286,406 C274,409 260,411 244,413 L250,252 Z" fill="url(#sideR)"/>';
        s += seam('M112,198 C114,168 118,136 100,104');
        s += seam('M288,198 C286,168 282,136 300,104');
        // hood front rim over shoulders
        s += '<path d="M150,86 C160,58 240,58 250,86 C240,96 230,100 224,100 C216,88 184,88 176,100 C170,100 160,96 150,86 Z" fill="' + c + '"/>';
        s += seam('M150,86 C160,58 240,58 250,86', 0.2, 1.6);
        s += '<path d="M176,100 C184,88 216,88 224,100 C216,106 184,106 176,100 Z" fill="' + inner + '"/>';
        // drawstrings
        s += '<path d="M188,104 C186,130 187,148 190,164" fill="none" stroke="' + dk + '" stroke-width="3.4" stroke-linecap="round"/>';
        s += '<path d="M212,104 C214,132 213,152 210,170" fill="none" stroke="' + dk + '" stroke-width="3.4" stroke-linecap="round"/>';
        s += '<circle cx="190" cy="166" r="2.6" fill="' + inner + '"/><circle cx="210" cy="172" r="2.6" fill="' + inner + '"/>';
        // kangaroo pocket
        s += '<path d="M146,302 L254,302 L268,376 L132,376 Z" fill="' + shade(c, -6) + '"/>';
        s += '<path d="M146,302 L254,302 L268,376 L132,376 Z" fill="url(#bodyShade)" opacity="0.5"/>';
        s += stitchLine('M148,306 L252,306', true);
        s += seam('M146,302 L132,376 M254,302 L268,376', 0.18, 1.6);
        // ribbed hem + cuffs
        s += '<path d="M114,392 L286,392 L286,412 C244,420 156,420 114,412 Z" fill="' + band + '"/>';
        for (var x = 122; x < 282; x += 9) {
            s += '<line x1="' + x + '" y1="394" x2="' + x + '" y2="414" stroke="#000000" stroke-opacity="0.09" stroke-width="1.4"/>';
        }
        s += '<path d="M48,172 L64,218 L84,210 L66,166 Z" fill="#000000" opacity="0.06"/>';
        s += '<path d="M352,172 L336,218 L316,210 L334,166 Z" fill="#000000" opacity="0.06"/>';
        return s + '</svg>';
    }

    /* CAP — structured 6-panel front; visible crown width 208u ≙ 190 mm */
    function capSVG(c) {
        var dk = shade(c, -14), bill = shade(c, -8), under = shade(c, -30);
        var s = svgOpen(400, 310, c);
        // crown
        var crown = 'M96,200 C96,98 152,56 200,56 C248,56 304,98 304,200 C270,208 230,212 200,212 C170,212 130,208 96,200 Z';
        s += '<path d="' + crown + '" fill="' + c + '"/>';
        s += '<path d="' + crown + '" fill="url(#bodyShade)"/>';
        s += '<path d="M96,200 C96,98 152,56 200,56 C176,80 150,130 148,204 C128,203 110,201 96,200 Z" fill="url(#sideL)"/>';
        s += '<path d="M304,200 C304,98 248,56 200,56 C224,80 250,130 252,204 C272,203 290,201 304,200 Z" fill="url(#sideR)"/>';
        // panel seams
        s += seam('M200,56 L200,212', 0.15, 1.8);
        s += seam('M148,204 C150,128 176,80 200,56', 0.13, 1.6);
        s += seam('M252,204 C250,128 224,80 200,56', 0.13, 1.6);
        // eyelets
        s += '<circle cx="172" cy="108" r="3.4" fill="' + dk + '"/><circle cx="228" cy="108" r="3.4" fill="' + dk + '"/>';
        // top button
        s += '<circle cx="200" cy="56" r="7" fill="' + dk + '"/>';
        // bill
        s += '<path d="M84,202 C130,184 270,184 316,202 C312,242 262,266 200,266 C138,266 88,242 84,202 Z" fill="' + bill + '"/>';
        s += '<path d="M84,202 C130,184 270,184 316,202 C312,242 262,266 200,266 C138,266 88,242 84,202 Z" fill="url(#bodyShade)" opacity="0.7"/>';
        s += '<path d="M92,214 C140,238 260,238 308,214 C300,244 256,262 200,262 C144,262 100,244 92,214 Z" fill="' + under + '" opacity="0.35"/>';
        s += stitchLine('M96,208 C140,192 260,192 304,208', true);
        s += stitchLine('M100,218 C144,200 256,200 300,218', true);
        s += stitchLine('M106,228 C148,208 252,208 294,228', true);
        // sweatband shadow where crown meets bill
        s += '<path d="M96,200 C130,208 270,208 304,200 C270,212 130,212 96,200 Z" fill="#000000" opacity="0.18"/>';
        return s + '</svg>';
    }

    /* BEANIE — cuffed knit; flat width 248u ≙ 254 mm (10 in) */
    function beanieSVG(c) {
        var cuff = shade(c, -10), dk = shade(c, -22);
        var s = svgOpen(400, 330, c);
        var dome = 'M76,226 C76,96 136,46 200,46 C264,46 324,96 324,226 C280,236 120,236 76,226 Z';
        s += '<path d="' + dome + '" fill="' + c + '"/>';
        s += '<path d="' + dome + '" fill="url(#bodyShade)"/>';
        s += '<path d="M76,226 C76,96 136,46 200,46 C170,80 152,150 150,232 C120,231 94,229 76,226 Z" fill="url(#sideL)"/>';
        s += '<path d="M324,226 C324,96 264,46 200,46 C230,80 248,150 250,232 C280,231 306,229 324,226 Z" fill="url(#sideR)"/>';
        // knit ribs on dome
        for (var i = -4; i <= 4; i++) {
            var xTop = 200 + i * 13, xBot = 200 + i * 26;
            s += '<path d="M' + xBot + ',224 C' + (xBot * 0.6 + xTop * 0.4) + ',150 ' + (xTop * 0.85 + 30) + ',80 ' + xTop + ',50" fill="none" stroke="#000000" stroke-opacity="0.06" stroke-width="2.2"/>';
        }
        // cuff
        s += '<path d="M70,206 C120,196 280,196 330,206 L330,272 C280,284 120,284 70,272 Z" fill="' + cuff + '"/>';
        s += '<path d="M70,206 C120,196 280,196 330,206 L330,272 C280,284 120,284 70,272 Z" fill="url(#bodyShade)" opacity="0.6"/>';
        for (var x = 80; x <= 320; x += 10) {
            s += '<line x1="' + x + '" y1="202" x2="' + x + '" y2="279" stroke="#000000" stroke-opacity="0.08" stroke-width="2"/>';
        }
        s += '<path d="M70,206 C120,196 280,196 330,206 C280,200 120,200 70,206 Z" fill="' + dk + '" opacity="0.5"/>';
        s += seam('M70,208 C120,198 280,198 330,208', 0.14, 1.6);
        return s + '</svg>';
    }

    /* TOTE — canvas tote; body width 216u ≙ 381 mm (15 in) */
    function toteSVG(c) {
        var dk = shade(c, -18), hem = shade(c, -8);
        var s = svgOpen(400, 440, c);
        // handles behind body
        s += '<path d="M136,168 C136,62 184,62 184,168" fill="none" stroke="' + dk + '" stroke-width="13" stroke-linecap="round"/>';
        s += '<path d="M216,168 C216,62 264,62 264,168" fill="none" stroke="' + dk + '" stroke-width="13" stroke-linecap="round"/>';
        var body = 'M92,158 L308,158 L300,396 C300,406 292,412 282,412 L118,412 C108,412 100,406 100,396 Z';
        s += '<path d="' + body + '" fill="' + c + '"/>';
        s += '<path d="' + body + '" fill="url(#bodyShade)"/>';
        s += '<path d="M92,158 L118,158 L112,412 C104,410 100,404 100,396 Z" fill="url(#sideL)"/>';
        s += '<path d="M308,158 L282,158 L288,412 C296,410 300,404 300,396 Z" fill="url(#sideR)"/>';
        // top hem
        s += '<path d="M92,158 L308,158 L307,184 L93,184 Z" fill="' + hem + '"/>';
        s += stitchLine('M95,164 L305,164', true);
        s += stitchLine('M95,178 L305,178', true);
        // handle attach stitches
        s += stitchLine('M130,162 L146,180', true) + stitchLine('M174,162 L190,180', true);
        s += stitchLine('M210,162 L226,180', true) + stitchLine('M254,162 L270,180', true);
        // canvas texture
        for (var y = 200; y < 400; y += 16) {
            s += '<line x1="98" y1="' + y + '" x2="302" y2="' + y + '" stroke="#000000" stroke-opacity="0.025" stroke-width="6"/>';
        }
        s += '<path d="M100,392 C160,402 240,402 300,392 L300,396 C300,406 292,412 282,412 L118,412 C108,412 100,406 100,396 Z" fill="#000000" opacity="0.08"/>';
        return s + '</svg>';
    }

    /* ─── garment registry ──────────────────────────────────────────── */
    // mmPerUnit anchors: tee/polo 558.8mm across 164u body; hoodie 609.6/170;
    // cap visible crown 190/208; beanie 254/248; tote 381/216.

    var GARMENTS = [
        {
            id: 'tee', label: 'T-Shirt', icon: 'fa-shirt',
            build: teeSVG, vbW: 400, vbH: 470, mmPerUnit: 558.8 / 164,
            placements: {
                leftChest: { label: 'Left Chest', cx: 245, cy: 168, maxWmm: 101.6, maxHmm: 101.6 },
                rightChest: { label: 'Right Chest', cx: 155, cy: 168, maxWmm: 101.6, maxHmm: 101.6 },
                centerChest: { label: 'Center Chest', cx: 200, cy: 190, maxWmm: 203.2, maxHmm: 203.2 },
                fullFront: { label: 'Full Front', cx: 200, cy: 240, maxWmm: 254, maxHmm: 254 }
            },
            defaultPlacement: 'leftChest'
        },
        {
            id: 'polo', label: 'Polo', icon: 'fa-user-tie',
            build: poloSVG, vbW: 400, vbH: 470, mmPerUnit: 558.8 / 164,
            placements: {
                leftChest: { label: 'Left Chest', cx: 245, cy: 172, maxWmm: 101.6, maxHmm: 101.6 },
                rightChest: { label: 'Right Chest', cx: 155, cy: 172, maxWmm: 101.6, maxHmm: 101.6 },
                leftSleeve: { label: 'Center Chest', cx: 200, cy: 205, maxWmm: 152.4, maxHmm: 152.4 }
            },
            defaultPlacement: 'leftChest'
        },
        {
            id: 'hoodie', label: 'Hoodie', icon: 'fa-vest',
            build: hoodieSVG, vbW: 400, vbH: 480, mmPerUnit: 609.6 / 170,
            placements: {
                leftChest: { label: 'Left Chest', cx: 248, cy: 190, maxWmm: 101.6, maxHmm: 101.6 },
                rightChest: { label: 'Right Chest', cx: 152, cy: 190, maxWmm: 101.6, maxHmm: 101.6 },
                centerChest: { label: 'Center Chest', cx: 200, cy: 212, maxWmm: 203.2, maxHmm: 152.4 }
            },
            defaultPlacement: 'leftChest'
        },
        {
            id: 'cap', label: 'Cap', icon: 'fa-hat-cowboy',
            build: capSVG, vbW: 400, vbH: 310, mmPerUnit: 190 / 208,
            placements: {
                front: { label: 'Cap Front', cx: 200, cy: 150, maxWmm: 114.3, maxHmm: 57.2 },
                lowerFront: { label: 'Lower Crown', cx: 200, cy: 176, maxWmm: 114.3, maxHmm: 44.5 }
            },
            defaultPlacement: 'front'
        },
        {
            id: 'beanie', label: 'Beanie', icon: 'fa-hat-winter',
            build: beanieSVG, vbW: 400, vbH: 330, mmPerUnit: 254 / 248,
            placements: {
                cuff: { label: 'Cuff', cx: 200, cy: 240, maxWmm: 88.9, maxHmm: 38.1 },
                crown: { label: 'Crown', cx: 200, cy: 140, maxWmm: 88.9, maxHmm: 63.5 }
            },
            defaultPlacement: 'cuff'
        },
        {
            id: 'tote', label: 'Tote', icon: 'fa-bag-shopping',
            build: toteSVG, vbW: 400, vbH: 440, mmPerUnit: 381 / 216,
            placements: {
                center: { label: 'Center', cx: 200, cy: 280, maxWmm: 203.2, maxHmm: 203.2 },
                upper: { label: 'Upper Third', cx: 200, cy: 232, maxWmm: 203.2, maxHmm: 101.6 }
            },
            defaultPlacement: 'center'
        }
    ];

    /* ─── image cache ───────────────────────────────────────────────── */

    var imageCache = {};

    function getImage(garmentId, colorHex) {
        var key = garmentId + '|' + colorHex;
        if (imageCache[key]) return imageCache[key];
        var g = null;
        for (var i = 0; i < GARMENTS.length; i++) if (GARMENTS[i].id === garmentId) g = GARMENTS[i];
        if (!g) return Promise.reject(new Error('Unknown garment: ' + garmentId));
        imageCache[key] = new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error('Garment SVG failed to rasterize')); };
            img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(g.build(colorHex));
        });
        return imageCache[key];
    }

    function byId(id) {
        for (var i = 0; i < GARMENTS.length; i++) if (GARMENTS[i].id === id) return GARMENTS[i];
        return null;
    }

    return {
        GARMENTS: GARMENTS,
        FABRIC_COLORS: FABRIC_COLORS,
        byId: byId,
        getImage: getImage,
        shade: shade,
        luma: luma
    };
}));
