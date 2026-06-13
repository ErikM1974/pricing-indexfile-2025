/**
 * cts-gallery-merch.js — pure merchandising helpers for the Custom T-Shirts
 * gallery (2026-06-12, Erik's SanMar-style card upgrade).
 *
 * Owns ZERO pricing math (CTS_PRICING owns all money). This module only:
 *   • parses SanMar PRODUCT_DESCRIPTION copy into a card blurb + fabric facts
 *     (the copy already lives in Caspio Sanmar_Bulk — API-driven, no authored
 *     merch text in the codebase; a future Caspio Card_Blurb column wins
 *     over the parsed sentence when non-empty),
 *   • picks varied featured colors so the grid isn't a wall of Jet Black.
 * (Per-piece card prices come straight from CTS_PRICING.quote().perShirt —
 * the engine's own figure — in server.js priceCtsStyleRefs; nothing here.)
 *
 * Used by server.js (GET /api/cts/gallery-extras) AND the browser gallery —
 * dual-export like custom-tees-pricing.js so jest can lock the behavior.
 */
(function (global) {
    'use strict';

    // Minimal entity set actually seen in SanMar copy. Anything exotic falls
    // through untouched (renderers escapeHTML, so worst case is literal text).
    var ENTITIES = {
        '&mdash;': '—', '&ndash;': '–', '&amp;': '&',
        '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“',
        '&rdquo;': '”', '&trade;': '™', '&reg;': '®',
        '&copy;': '©', '&nbsp;': ' ', '&quot;': '"', '&#39;': "'",
    };

    function decodeEntities(s) {
        var out = String(s || '');
        Object.keys(ENTITIES).forEach(function (k) {
            out = out.split(k).join(ENTITIES[k]);
        });
        // Numeric entities (&#8217; etc.)
        out = out.replace(/&#(\d+);/g, function (_, n) {
            return String.fromCharCode(parseInt(n, 10));
        });
        return out;
    }

    /**
     * First selling sentence of a SanMar PRODUCT_DESCRIPTION — the part before
     * the fabric-spec block. "5.4" never false-ends a sentence because the
     * regex requires whitespace (or end) AFTER the punctuation.
     * Falls back to a word-boundary truncation when no sentence end is found.
     */
    function extractBlurb(desc) {
        var text = decodeEntities(desc).replace(/\s+/g, ' ').trim();
        if (!text) return '';
        var m = text.match(/^(.{15,220}?[.!?])(?:\s|$)/);
        if (m) return m[1].trim();
        if (text.length <= 140) return text;
        var cut = text.slice(0, 140);
        return cut.slice(0, cut.lastIndexOf(' ')) + '…';
    }

    /**
     * Full product detail for the step-2 "About this shirt" panel —
     * SanMar-style: a lead sentence + spec bullets. SanMar delimits the spec
     * block with RUNS OF 2+ SPACES, but parenthesized color lists use the
     * same double spaces internally ("(Black Heather  Dark Heather Grey)"),
     * so the splitter only breaks at parenthesis depth 0. Returns
     * { lead, specs: [...] }; descriptions with no spec block → all-lead,
     * empty specs (the panel renders lead-only).
     */
    function extractSpecs(desc) {
        var text = decodeEntities(desc).trim();
        if (!text) return { lead: '', specs: [] };
        var segments = [];
        var buf = '';
        var depth = 0;
        var i = 0;
        while (i < text.length) {
            var ch = text[i];
            if (ch === '(') depth++;
            if (ch === ')') depth = Math.max(0, depth - 1);
            if (depth === 0 && ch === ' ' && text[i + 1] === ' ') {
                if (buf.trim()) segments.push(buf.replace(/\s+/g, ' ').trim());
                buf = '';
                while (text[i] === ' ') i++;
                continue;
            }
            buf += ch;
            i++;
        }
        if (buf.trim()) segments.push(buf.replace(/\s+/g, ' ').trim());
        if (!segments.length) return { lead: '', specs: [] };
        var lead = segments[0];
        var specs = segments.slice(1).filter(function (s) { return s.length >= 2; }).slice(0, 12);
        return { lead: lead, specs: specs };
    }

    /**
     * Fabric facts for the card chip: { weightOz, fiber, label }.
     * label example: "5.4 oz · 100% cotton". Missing facts → nulls, label ''.
     */
    function extractFabric(desc) {
        var text = decodeEntities(desc).replace(/\s+/g, ' ');
        var weightOz = null;
        var wm = text.match(/(\d+(?:\.\d+)?)\s*-?\s*ounce/i);
        if (wm) weightOz = wm[1];

        var fiber = null;
        if (/100%\s+(?:ring\s+spun\s+|combed\s+ring\s+spun\s+)?cotton/i.test(text)) {
            fiber = '100% cotton';
        } else if (/tri-?blend/i.test(text)) {
            fiber = 'Tri-blend';
        } else {
            var bm = text.match(/(\d{2}\/\d{2})\s+(?:cotton\/poly|poly\/cotton)/i);
            if (bm) fiber = bm[1] + ' cotton/poly';
            else if (/100%\s+polyester/i.test(text)) fiber = '100% polyester';
        }

        var parts = [];
        if (weightOz) parts.push(weightOz + ' oz');
        if (fiber) parts.push(fiber);
        return { weightOz: weightOz, fiber: fiber, label: parts.join(' · ') };
    }

    /**
     * Featured-color variety pass: walk the cards in render order and give
     * each its most-popular color whose CATALOG_COLOR wasn't used as a hero in
     * the previous `lookback` cards — the grid reads black/heather/navy/red
     * instead of a wall of Jet Black. Deterministic (no randomness — stable
     * across renders); falls back to the style's #1 color when every option
     * was seen recently. Returns { [style]: topColorEntry|null }.
     */
    function pickVariedHeroColors(items, lookback) {
        var lb = lookback || 3;
        var recent = [];
        var out = {};
        (items || []).forEach(function (it) {
            var colors = Array.isArray(it.top_colors) ? it.top_colors : [];
            var pick = colors.length ? colors[0] : null;
            for (var i = 0; i < colors.length; i++) {
                var cc = String(colors[i].catalog_color || '');
                if (cc && recent.indexOf(cc) === -1) { pick = colors[i]; break; }
            }
            out[String(it.style || '')] = pick;
            if (pick && pick.catalog_color) {
                recent.push(String(pick.catalog_color));
                if (recent.length > lb) recent.shift();
            }
        });
        return out;
    }

    var CTS_MERCH = {
        decodeEntities: decodeEntities,
        extractBlurb: extractBlurb,
        extractSpecs: extractSpecs,
        extractFabric: extractFabric,
        pickVariedHeroColors: pickVariedHeroColors,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CTS_MERCH;
    }
    if (typeof global.window !== 'undefined' || typeof window !== 'undefined') {
        global.CTS_MERCH = CTS_MERCH;
    }
})(typeof window !== 'undefined' ? window : globalThis);
