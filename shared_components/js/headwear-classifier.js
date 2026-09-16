/**
 * headwear-classifier.js — is a product a structured cap, flat headwear or a garment?
 *
 * SanMar leaves CATEGORY_NAME blank for many headwear styles (every Richardson cap,
 * most visors and bucket hats), and Richardson/New Era also sell apparel, so brand
 * and style-number prefixes are not reliable. This reads, in order: the category
 * and subcategory, the title (with "cap sleeve" removed), and — only when the
 * category is blank — cap-shape words and cap anatomy in the description.
 *
 *   HeadwearClassifier.classify(productRow)
 *     → { kind: 'cap'|'flat'|'garment', isCap, isFlat, confident, reason }
 *
 * Accepts /api/product-details rows (PRODUCT_TITLE, CATEGORY_NAME, ...) or the
 * camelCase shapes (title/productTitle, category, subcategory, description, style).
 * `confident:false` means no signal was found; callers should keep the rep's choice.
 * First consumer: calculators/quick-quote/quick-quote.js.
 */
(function (root) {
    'use strict';
    // Strong cap words: trusted even when a non-headwear category is present (Workwear "Safety Cap").
    var CAP_WORD = /\b(caps?|hats?|visors?|snap ?backs?|headwear)\b/i;
    // Cap shapes: only trusted when the category is blank ("Trucker Jacket" is outerwear).
    var CAP_SHAPE = /\b(truckers?|flat ?bill|bucket|boonie|(?:[5-7]|five|six|seven)[- ]panel)\b/i;
    // Cap anatomy in the description, blank category only. Never "cap" (tees say "cap sleeve")
    // and never low/mid-pro (jacket descriptions use it).
    var CAP_ANATOMY = /\b(sweatband|backstrap|snap ?back closure|pre-?curved|flat ?bill)\b/i;
    var FLAT_TITLE = /\b(beanies?|knit(?:ted)?\s+(?:caps?|hats?)|watch\s+(?:caps?|hats?)|winter\s+hats?|toboggans?|skull\s?caps?|headbands?|face\s+masks?|gaiters?|helmet[- ]liners?|balaclavas?|scrub\s+caps?|bandanas?|fleece\s+hats?|2-in-1\s+headwear)\b/i;
    var CAP_SLEEVE = /\bcap[- ]sleeves?\b/gi;
    // With no category, a garment word outranks a cap shape ("Trucker Jacket", "Bucket Bag").
    var GARMENT_WORD = /\b(jackets?|coats?|vests?|parkas?|bags?|totes?|backpacks?|shirts?|tees?|t-shirts?|hoodies?|sweatshirts?|pullovers?|polos?|pants?|shorts|joggers?|aprons?|blankets?|towels?)\b/i;

    function text(value) { return String(value == null ? '' : value).trim(); }
    function pick(p, keys) {
        for (var i = 0; i < keys.length; i++) { var v = text(p[keys[i]]); if (v) return v; }
        return '';
    }
    function result(kind, confident, reason) {
        return { kind: kind, isCap: kind === 'cap', isFlat: kind === 'flat', confident: confident, reason: reason };
    }

    function classify(product) {
        var p = product && typeof product === 'object' ? product : {};
        var category = pick(p, ['CATEGORY_NAME', 'category', 'categoryName']);
        var subcategory = pick(p, ['SUBCATEGORY_NAME', 'subcategory', 'subcategoryName']);
        var title = pick(p, ['PRODUCT_TITLE', 'title', 'productTitle', 'name']).replace(CAP_SLEEVE, ' ');
        var description = pick(p, ['PRODUCT_DESCRIPTION', 'description']);
        var style = pick(p, ['STYLE', 'style', 'styleNumber', 'STYLE_NUMBER']).toUpperCase();
        var capCategory = /^caps$/i.test(category) || /^caps$/i.test(subcategory); // incl. Youth/Caps, Ladies/Caps
        var flat = /beanies/i.test(subcategory) || FLAT_TITLE.test(title);

        if (capCategory) return result(flat ? 'flat' : 'cap', true, 'category');
        if (flat) return category ? result('garment', true, 'category') : result('flat', true, 'title');
        if (CAP_WORD.test(title)) return result('cap', true, 'title');
        if (category) return result('garment', true, 'category');
        if (GARMENT_WORD.test(title)) return result('garment', false, 'title');
        if (CAP_SHAPE.test(title)) return result('cap', true, 'title');
        if (CAP_ANATOMY.test(description)) return result('cap', true, 'description');
        if (/^\d{2,3}$/.test(style)) return result('cap', false, 'style'); // legacy Richardson numbering
        return result('garment', false, 'unknown');
    }

    var api = { classify: classify };
    root.HeadwearClassifier = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
